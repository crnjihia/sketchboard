import http from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { BoardSessionManager } from './sync/board-session';
import { setupSocketHandlers } from './sync/socket-handler';

export function createSketchboardServer() {
  const server = http.createServer((req, res) => {
    // Health checks
    if (req.url === '/healthz' || req.url === '/readyz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', node: config.nodeId, timestamp: Date.now() }));
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
  });

  const sessionManager = new BoardSessionManager();
  setupSocketHandlers(io, sessionManager);

  return { server, io, sessionManager };
}

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  const { server } = createSketchboardServer();
  server.listen(config.port, config.host, () => {
    console.log(`[Sketchboard Server] Listening on http://${config.host}:${config.port} (node: ${config.nodeId})`);
  });
}
