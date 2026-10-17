import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeId: process.env.NODE_ID || 'server-1',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxPayloadBytes: 256 * 1024, // 256 KB max update payload
  rateLimitPerSec: 60, // Max 60 sync:update messages per socket per second
};
