// path: apps/server/src/config.ts
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

  // Safaricom Daraja M-PESA Integration
  mpesaMock: process.env.MPESA_MOCK !== 'false', // Defaults to true for zero-credential operation
  darajaConsumerKey: process.env.DARAJA_CONSUMER_KEY || '',
  darajaConsumerSecret: process.env.DARAJA_CONSUMER_SECRET || '',
  darajaPasskey:
    process.env.DARAJA_PASSKEY ||
    'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919', // Public Safaricom sandbox passkey
  darajaShortcode: process.env.DARAJA_SHORTCODE || '174379', // Public Safaricom sandbox paybill
  darajaCallbackUrl:
    process.env.DARAJA_CALLBACK_URL ||
    'http://localhost:4000/api/payments/mpesa/callback',

  // Africa's Talking SMS Integration
  africasTalkingMock: process.env.AFRICASTALKING_MOCK !== 'false', // Defaults to true for zero-credential operation
  africasTalkingUsername: process.env.AFRICASTALKING_USERNAME || 'sandbox',
  africasTalkingApiKey: process.env.AFRICASTALKING_API_KEY || '',
  africasTalkingSenderId: process.env.AFRICASTALKING_SENDER_ID || 'SKETCHBOARD',
};
