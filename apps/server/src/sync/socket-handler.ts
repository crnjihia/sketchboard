import { Server, Socket } from 'socket.io';
import { BoardSessionManager } from './board-session';
import { redisService } from './redis-adapter';
import { metrics } from './metrics';
import { config } from '../config';

export function setupSocketHandlers(io: Server, sessionManager: BoardSessionManager) {
  io.on('connection', (socket: Socket) => {
    metrics.connectedSockets++;

    let currentBoardId: string | null = null;
    let currentUser: { userId: string; userName: string; userColor: string } | null = null;

    socket.on('join:board', async (data: { boardId: string; userId: string; userName: string; userColor?: string }) => {
      const { boardId, userId, userName, userColor = '#60A5FA' } = data;
      currentBoardId = boardId;
      currentUser = { userId, userName, userColor };

      socket.join(boardId);
      sessionManager.registerSocket(socket.id, boardId);

      // Lazy load doc from PostgreSQL + Redis hot log
      const session = await sessionManager.getOrCreateSession(boardId);

      // Update room presence in Redis
      await redisService.updatePresence(boardId, {
        userId,
        userName,
        userColor,
        lastSeen: Date.now(),
      });

      // Send initial snapshot directly to joining client
      const snapshot = session.getSnapshot();
      socket.emit('sync:init', {
        boardId,
        snapshot: Buffer.from(snapshot),
        nodeId: config.nodeId,
      });

      // Notify others in room
      socket.to(boardId).emit('presence:join', {
        userId,
        userName,
        userColor,
        timestamp: Date.now(),
      });
    });

    // Yjs handshake step 1: client sends its state vector
    socket.on('sync:step1', async (data: { boardId: string; stateVector: ArrayBuffer | Uint8Array }) => {
      const { boardId, stateVector } = data;
      const session = await sessionManager.getOrCreateSession(boardId);
      const vector = stateVector instanceof Uint8Array ? stateVector : new Uint8Array(stateVector);

      const diff = session.diffUpdate(vector);
      socket.emit('sync:step2', {
        boardId,
        update: Buffer.from(diff),
      });

      // Also request what client has that server is missing
      const serverVector = session.getStateVector();
      socket.emit('sync:step1', {
        boardId,
        stateVector: Buffer.from(serverVector),
      });
    });

    // Yjs sync:update event with size check, rate limit, Redis log, ACK, and broadcast
    socket.on('sync:update', async (data: { boardId: string; update: ArrayBuffer | Uint8Array; clientSeq: number }) => {
      const startTime = performance.now();
      const { boardId, update, clientSeq } = data;
      const updateBytes = update instanceof Uint8Array ? update : new Uint8Array(update);

      // 1. Validate payload size (256 KB max)
      if (updateBytes.byteLength > config.maxPayloadBytes) {
        socket.emit('sync:error', {
          boardId,
          clientSeq,
          error: 'PayloadTooLarge',
          message: `Update exceeds maximum allowed size of ${config.maxPayloadBytes} bytes`,
        });
        return;
      }

      // 2. Validate socket rate limit
      if (!sessionManager.checkRateLimit(socket.id, config.rateLimitPerSec)) {
        socket.emit('sync:error', {
          boardId,
          clientSeq,
          error: 'RateLimitExceeded',
          message: `Too many updates. Limit is ${config.rateLimitPerSec}/sec`,
        });
        return;
      }

      // 3. Apply to in-memory Y.Doc
      const session = await sessionManager.getOrCreateSession(boardId);
      session.applyUpdate(updateBytes, socket.id);

      // 4. Record to Redis hot log & check compaction threshold
      await sessionManager.recordUpdate(boardId, updateBytes);

      // 5. Send ACK back to the emitting client
      const ackLatency = performance.now() - startTime;
      metrics.recordAckLatency(ackLatency);

      socket.emit('sync:ack', {
        boardId,
        clientSeq,
        serverTime: Date.now(),
      });

      // 6. Broadcast binary update to all other clients in the board room (relayed by Redis adapter to peer nodes)
      socket.to(boardId).emit('sync:update', {
        boardId,
        update: Buffer.from(updateBytes),
      });
    });

    // Live cursor: ephemeral world coordinate updates (volatile relay)
    socket.on('cursor:move', (data: { boardId: string; x: number; y: number; viewport?: any; selectedIds?: string[] }) => {
      if (!currentBoardId || !currentUser) return;
      socket.volatile.to(data.boardId).emit('cursor:move', {
        userId: currentUser.userId,
        userName: currentUser.userName,
        userColor: currentUser.userColor,
        x: data.x,
        y: data.y,
        viewport: data.viewport,
        selectedIds: data.selectedIds,
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', async () => {
      metrics.connectedSockets = Math.max(0, metrics.connectedSockets - 1);
      const boardId = sessionManager.cleanupSocket(socket.id);
      if (boardId && currentUser) {
        await redisService.removePresence(boardId, currentUser.userId);
        socket.to(boardId).emit('presence:leave', {
          userId: currentUser.userId,
          timestamp: Date.now(),
        });
      }
    });
  });
}
