import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeId: process.env.NODE_ID || 'server-1',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxPayloadBytes: 256 * 1024, // 256 KB max update payload
  rateLimitPerSec: 60, // Max 60 sync:update messages per socket per second

  // Redis scaling & hot update log
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  enableRedis: process.env.ENABLE_REDIS === 'true' || Boolean(process.env.REDIS_URL),

  // PostgreSQL snapshot compaction
  postgresUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sketchboard',
  enablePostgres: process.env.ENABLE_POSTGRES === 'true' || Boolean(process.env.DATABASE_URL),

  // Compaction thresholds
  compactionThresholdUpdates: parseInt(process.env.COMPACTION_THRESHOLD || '50', 10),
  compactionMaxBytes: parseInt(process.env.COMPACTION_MAX_BYTES || `${512 * 1024}`, 10), // 512 KB
};
