import { BoardDocManager } from '@sketchboard/shared';
import { storage } from '../persistence/storage';
import { redisService } from './redis-adapter';
import { config } from '../config';
import { metrics } from './metrics';

interface SocketRateTracker {
  count: number;
  resetAt: number;
}

interface BoardStats {
  uncompactedUpdates: number;
  uncompactedBytes: number;
  activeSockets: Set<string>;
}

/**
 * Manages in-memory Yjs board sessions, lazy loading from PostgreSQL/Redis,
 * rate limiting, and periodic snapshot compaction.
 */
export class BoardSessionManager {
  private sessions = new Map<string, BoardDocManager>();
  private boardStats = new Map<string, BoardStats>();
  private rateTrackers = new Map<string, SocketRateTracker>();
  private socketBoards = new Map<string, string>(); // socketId -> boardId

  /**
   * Retrieves or lazy-loads an active BoardDocManager for the given boardId.
   * Hydrates state first from PostgreSQL snapshot, then applies hot updates from Redis.
   */
  public async getOrCreateSession(boardId: string): Promise<BoardDocManager> {
    let session = this.sessions.get(boardId);
    if (!session) {
      session = new BoardDocManager(boardId);

      // 1. Hydrate from PostgreSQL snapshot
      const snapshot = await storage.loadSnapshot(boardId);
      if (snapshot) {
        session.applyUpdate(snapshot, 'init:snapshot');
      }

      // 2. Hydrate from hot updates in Redis log
      const hotUpdates = await redisService.getHotUpdates(boardId);
      for (const update of hotUpdates) {
        session.applyUpdate(update, 'init:hot-update');
      }

      this.sessions.set(boardId, session);
      this.boardStats.set(boardId, {
        uncompactedUpdates: hotUpdates.length,
        uncompactedBytes: 0,
        activeSockets: new Set(),
      });

      metrics.activeBoards = this.sessions.size;
    }
    return session;
  }

  public getExistingSession(boardId: string): BoardDocManager | undefined {
    return this.sessions.get(boardId);
  }

  /**
   * Checks if an incoming socket has exceeded its update rate limit.
   */
  public checkRateLimit(socketId: string, limitPerSec: number): boolean {
    const now = Date.now();
    let tracker = this.rateTrackers.get(socketId);

    if (!tracker || now > tracker.resetAt) {
      tracker = { count: 1, resetAt: now + 1000 };
      this.rateTrackers.set(socketId, tracker);
      return true;
    }

    if (tracker.count >= limitPerSec) {
      return false; // Rate limit exceeded
    }

    tracker.count++;
    return true;
  }

  /**
   * Registers a socket with a board.
   */
  public registerSocket(socketId: string, boardId: string): void {
    this.socketBoards.set(socketId, boardId);
    const stats = this.boardStats.get(boardId);
    if (stats) {
      stats.activeSockets.add(socketId);
    }
  }

  /**
   * Records an ingested update and checks compaction conditions.
   */
  public async recordUpdate(boardId: string, updateBytes: Uint8Array): Promise<void> {
    metrics.updatesTotal++;

    // Append to Redis hot update log
    await redisService.appendHotUpdate(boardId, updateBytes);

    let stats = this.boardStats.get(boardId);
    if (!stats) {
      stats = { uncompactedUpdates: 0, uncompactedBytes: 0, activeSockets: new Set() };
      this.boardStats.set(boardId, stats);
    }

    stats.uncompactedUpdates++;
    stats.uncompactedBytes += updateBytes.byteLength;

    // Check compaction thresholds
    if (
      stats.uncompactedUpdates >= config.compactionThresholdUpdates ||
      stats.uncompactedBytes >= config.compactionMaxBytes
    ) {
      // Run background compaction
      this.compactBoard(boardId).catch((err) => {
        console.error(`[Compaction] Error compacting board ${boardId}:`, err);
      });
    }
  }

  /**
   * Compaction: merges current doc state into one snapshot, writes to PostgreSQL, and trims Redis log.
   * Protected by distributed lock to prevent multi-node compaction stampedes.
   */
  public async compactBoard(boardId: string): Promise<boolean> {
    const session = this.sessions.get(boardId);
    if (!session) return false;

    // Acquire distributed lock (10s TTL)
    const acquired = await redisService.acquireCompactionLock(boardId, 10000);
    if (!acquired) {
      return false; // Another node is already compacting
    }

    try {
      // 1. Encode complete state as binary snapshot
      const snapshot = session.getSnapshot();

      // 2. Persist to PostgreSQL
      await storage.saveSnapshot(boardId, snapshot);

      // 3. Trim Redis hot update log
      await redisService.trimHotUpdates(boardId);

      // 4. Reset in-memory stats
      const stats = this.boardStats.get(boardId);
      if (stats) {
        stats.uncompactedUpdates = 0;
        stats.uncompactedBytes = 0;
      }

      return true;
    } finally {
      await redisService.releaseCompactionLock(boardId);
    }
  }

  /**
   * Cleans up socket tracking on disconnect.
   * If last client leaves the board, triggers snapshot compaction.
   */
  public cleanupSocket(socketId: string): string | undefined {
    this.rateTrackers.delete(socketId);
    const boardId = this.socketBoards.get(socketId);
    this.socketBoards.delete(socketId);

    if (boardId) {
      const stats = this.boardStats.get(boardId);
      if (stats) {
        stats.activeSockets.delete(socketId);
        // On last client leave, flush compaction to database
        if (stats.activeSockets.size === 0) {
          this.compactBoard(boardId).catch(() => {});
        }
      }
    }

    return boardId;
  }

  /**
   * Flushes all active boards to PostgreSQL on graceful shutdown.
   */
  public async flushAllOnShutdown(): Promise<void> {
    console.log('[BoardSessionManager] Flushing all active boards to PostgreSQL snapshot...');
    const compactPromises = Array.from(this.sessions.keys()).map((id) => this.compactBoard(id));
    await Promise.allSettled(compactPromises);
  }

  /**
   * Cleans up all resources.
   */
  public destroy(): void {
    for (const session of this.sessions.values()) {
      session.destroy();
    }
    this.sessions.clear();
    this.boardStats.clear();
    this.rateTrackers.clear();
    this.socketBoards.clear();
    metrics.activeBoards = 0;
  }
}
