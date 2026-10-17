import { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';
import { config } from '../config';
import { metrics } from './metrics';

export interface PresenceRecord {
  userId: string;
  userName: string;
  userColor: string;
  lastSeen: number;
}

export class RedisService {
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private client: Redis | null = null;
  private isConnected = false;

  // In-memory fallbacks when Redis is offline or running standalone
  private inMemoryHotUpdates = new Map<string, Uint8Array[]>();
  private inMemoryPresence = new Map<string, Map<string, PresenceRecord>>();
  private inMemoryLocks = new Set<string>();

  constructor() {
    if (config.enableRedis) {
      try {
        const redisOpts = {
          maxRetriesPerRequest: 1,
          retryStrategy: (times: number) => (times <= 3 ? 1000 : null),
          enableReadyCheck: true,
          lazyConnect: true,
        };

        this.client = new Redis(config.redisUrl, redisOpts);
        this.pubClient = new Redis(config.redisUrl, redisOpts);
        this.subClient = this.pubClient.duplicate();

        this.client.on('error', (err) => {
          metrics.redisErrorsTotal++;
          if (this.isConnected) {
            console.warn('[RedisService] Redis client error:', err.message);
          }
        });
      } catch (err) {
        console.warn('[RedisService] Failed to initialize Redis clients, using fallback:', (err as Error).message);
      }
    }
  }

  public async init(io?: Server): Promise<void> {
    if (!this.client || !this.pubClient || !this.subClient) return;

    try {
      await Promise.all([
        this.client.connect(),
        this.pubClient.connect(),
        this.subClient.connect(),
      ]);

      this.isConnected = true;
      console.log(`[RedisService] Connected to Redis at ${config.redisUrl}`);

      if (io) {
        io.adapter(createAdapter(this.pubClient, this.subClient));
        console.log('[RedisService] Attached Socket.io Redis adapter for cross-node broadcasts');
      }
    } catch (err) {
      this.isConnected = false;
      console.warn('[RedisService] Redis not available, running with in-memory sync:', (err as Error).message);
    }
  }

  // --- Hot Update Log ---

  public async appendHotUpdate(boardId: string, update: Uint8Array): Promise<number> {
    const buffer = Buffer.from(update);

    if (this.isConnected && this.client) {
      try {
        const key = `sketchboard:board:${boardId}:updates`;
        const len = await this.client.rpush(key, buffer.toString('base64'));
        await this.client.expire(key, 86400); // 24h TTL
        return len;
      } catch (err) {
        metrics.redisErrorsTotal++;
        console.error('[RedisService] Error appending update to Redis:', err);
      }
    }

    // Fallback in-memory
    let list = this.inMemoryHotUpdates.get(boardId);
    if (!list) {
      list = [];
      this.inMemoryHotUpdates.set(boardId, list);
    }
    list.push(update);
    return list.length;
  }

  public async getHotUpdates(boardId: string): Promise<Uint8Array[]> {
    if (this.isConnected && this.client) {
      try {
        const key = `sketchboard:board:${boardId}:updates`;
        const raw = await this.client.lrange(key, 0, -1);
        return raw.map((item) => new Uint8Array(Buffer.from(item, 'base64')));
      } catch (err) {
        metrics.redisErrorsTotal++;
        console.error('[RedisService] Error retrieving hot updates from Redis:', err);
      }
    }

    return this.inMemoryHotUpdates.get(boardId) ?? [];
  }

  public async trimHotUpdates(boardId: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        const key = `sketchboard:board:${boardId}:updates`;
        await this.client.del(key);
        return;
      } catch (err) {
        metrics.redisErrorsTotal++;
        console.error('[RedisService] Error trimming hot updates:', err);
      }
    }

    this.inMemoryHotUpdates.delete(boardId);
  }

  // --- Distributed Compaction Lock ---

  public async acquireCompactionLock(boardId: string, ttlMs = 10000): Promise<boolean> {
    const lockKey = `sketchboard:lock:compact:${boardId}`;

    if (this.isConnected && this.client) {
      try {
        const res = await this.client.set(lockKey, config.nodeId, 'PX', ttlMs, 'NX');
        return res === 'OK';
      } catch (err) {
        metrics.redisErrorsTotal++;
        console.error('[RedisService] Error acquiring compaction lock:', err);
      }
    }

    // In-memory lock fallback
    if (this.inMemoryLocks.has(lockKey)) {
      return false;
    }
    this.inMemoryLocks.add(lockKey);
    setTimeout(() => this.inMemoryLocks.delete(lockKey), ttlMs);
    return true;
  }

  public async releaseCompactionLock(boardId: string): Promise<void> {
    const lockKey = `sketchboard:lock:compact:${boardId}`;

    if (this.isConnected && this.client) {
      try {
        // Only release if value equals current nodeId
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await this.client.eval(script, 1, lockKey, config.nodeId);
        return;
      } catch (err) {
        metrics.redisErrorsTotal++;
        console.error('[RedisService] Error releasing compaction lock:', err);
      }
    }

    this.inMemoryLocks.delete(lockKey);
  }

  // --- Room Presence ---

  public async updatePresence(boardId: string, user: PresenceRecord): Promise<void> {
    const key = `sketchboard:board:${boardId}:presence`;

    if (this.isConnected && this.client) {
      try {
        await this.client.hset(key, user.userId, JSON.stringify(user));
        await this.client.expire(key, 60); // 60s TTL
        return;
      } catch (err) {
        metrics.redisErrorsTotal++;
      }
    }

    let boardPresence = this.inMemoryPresence.get(boardId);
    if (!boardPresence) {
      boardPresence = new Map();
      this.inMemoryPresence.set(boardId, boardPresence);
    }
    boardPresence.set(user.userId, user);
  }

  public async getPresence(boardId: string): Promise<PresenceRecord[]> {
    const key = `sketchboard:board:${boardId}:presence`;

    if (this.isConnected && this.client) {
      try {
        const raw = await this.client.hvals(key);
        return raw.map((item) => JSON.parse(item));
      } catch (err) {
        metrics.redisErrorsTotal++;
      }
    }

    const boardPresence = this.inMemoryPresence.get(boardId);
    return boardPresence ? Array.from(boardPresence.values()) : [];
  }

  public async removePresence(boardId: string, userId: string): Promise<void> {
    const key = `sketchboard:board:${boardId}:presence`;

    if (this.isConnected && this.client) {
      try {
        await this.client.hdel(key, userId);
        return;
      } catch (err) {
        metrics.redisErrorsTotal++;
      }
    }

    this.inMemoryPresence.get(boardId)?.delete(userId);
  }

  public async isHealthy(): Promise<boolean> {
    if (!this.isConnected || !this.client) return true;
    try {
      const ping = await this.client.ping();
      return ping === 'PONG';
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    this.isConnected = false;
    if (this.client) await this.client.quit().catch(() => {});
    if (this.pubClient) await this.pubClient.quit().catch(() => {});
    if (this.subClient) await this.subClient.quit().catch(() => {});
    this.inMemoryHotUpdates.clear();
    this.inMemoryPresence.clear();
    this.inMemoryLocks.clear();
  }
}

export const redisService = new RedisService();
