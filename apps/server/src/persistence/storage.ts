import pg from 'pg';
import { config } from '../config';

const { Pool } = pg;

export interface IStorageEngine {
  init(): Promise<void>;
  loadSnapshot(boardId: string): Promise<Uint8Array | null>;
  saveSnapshot(boardId: string, snapshot: Uint8Array, name?: string): Promise<void>;
  isHealthy(): Promise<boolean>;
  close(): Promise<void>;
}

export class PostgresStorageEngine implements IStorageEngine {
  private pool: pg.Pool | null = null;
  private inMemoryFallback = new Map<string, Uint8Array>();
  private useFallback = false;

  constructor() {
    if (config.enablePostgres) {
      this.pool = new Pool({
        connectionString: config.postgresUrl,
        connectionTimeoutMillis: 3000,
      });
    } else {
      this.useFallback = true;
    }
  }

  public async init(): Promise<void> {
    if (this.useFallback || !this.pool) return;

    try {
      const client = await this.pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS boards (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) DEFAULT 'Untitled Board',
            snapshot BYTEA,
            snapshot_version INT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn('[PostgresStorage] Could not connect to PostgreSQL, switching to in-memory fallback:', (err as Error).message);
      this.useFallback = true;
    }
  }

  public async loadSnapshot(boardId: string): Promise<Uint8Array | null> {
    if (this.useFallback || !this.pool) {
      return this.inMemoryFallback.get(boardId) ?? null;
    }

    try {
      const res = await this.pool.query(
        'SELECT snapshot FROM boards WHERE id = $1 LIMIT 1',
        [boardId]
      );
      if (res.rows.length === 0 || !res.rows[0].snapshot) {
        return null;
      }
      return new Uint8Array(res.rows[0].snapshot);
    } catch (err) {
      console.error('[PostgresStorage] Error loading snapshot:', err);
      return this.inMemoryFallback.get(boardId) ?? null;
    }
  }

  public async saveSnapshot(
    boardId: string,
    snapshot: Uint8Array,
    name = 'Untitled Board'
  ): Promise<void> {
    // Keep in-memory cache updated
    this.inMemoryFallback.set(boardId, snapshot);

    if (this.useFallback || !this.pool) return;

    try {
      const buffer = Buffer.from(snapshot);
      await this.pool.query(
        `
        INSERT INTO boards (id, name, snapshot, snapshot_version, updated_at)
        VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          snapshot = EXCLUDED.snapshot,
          snapshot_version = boards.snapshot_version + 1,
          updated_at = CURRENT_TIMESTAMP
        `,
        [boardId, name, buffer]
      );
    } catch (err) {
      console.error('[PostgresStorage] Error saving snapshot to PostgreSQL:', err);
    }
  }

  public async isHealthy(): Promise<boolean> {
    if (this.useFallback || !this.pool) return true;
    try {
      const res = await this.pool.query('SELECT 1');
      return res.rowCount === 1;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
    this.inMemoryFallback.clear();
  }
}

export const storage = new PostgresStorageEngine();
