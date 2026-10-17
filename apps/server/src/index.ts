import http from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { BoardSessionManager } from './sync/board-session';
import { setupSocketHandlers } from './sync/socket-handler';
import { redisService } from './sync/redis-adapter';
import { storage } from './persistence/storage';
import { metrics } from './sync/metrics';

export function createSketchboardServer() {
  const sessionManager = new BoardSessionManager();

  const server = http.createServer(async (req, res) => {
    // 1. Liveness Probe
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', node: config.nodeId, timestamp: Date.now() }));
      return;
    }

    // 2. Readiness Probe (checks Redis and PostgreSQL)
    if (req.url === '/readyz') {
      const redisOk = await redisService.isHealthy();
      const pgOk = await storage.isHealthy();
      const isReady = redisOk && pgOk;

      res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: isReady ? 'ready' : 'unhealthy',
          node: config.nodeId,
          redis: redisOk,
          postgres: pgOk,
          timestamp: Date.now(),
        })
      );
      return;
    }

    // 3. Prometheus Metrics Endpoint
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      res.end(metrics.getMetricsAsPrometheusText());
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: config.maxPayloadBytes * 2,
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling'],
  });

  // Attach Socket.io handlers
  setupSocketHandlers(io, sessionManager);

  return { server, io, sessionManager };
}

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    await storage.init();
    const { server, io, sessionManager } = createSketchboardServer();
    await redisService.init(io);

    server.listen(config.port, config.host, () => {
      console.log(`[Sketchboard Server] Listening on http://${config.host}:${config.port} (node: ${config.nodeId})`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`[Sketchboard Server] Received ${signal}. Draining sockets and flushing state...`);
      io.emit('server:shutdown', { message: 'Server is restarting, reconnecting...' });

      try {
        await sessionManager.flushAllOnShutdown();
        await redisService.close();
        await storage.close();

        server.close(() => {
          console.log('[Sketchboard Server] Graceful shutdown complete.');
          process.exit(0);
        });
      } catch (err) {
        console.error('[Sketchboard Server] Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })();
}
