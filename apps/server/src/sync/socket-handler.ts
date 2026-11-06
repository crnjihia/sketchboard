// path: apps/server/src/sync/socket-handler.ts
import { Server, Socket } from 'socket.io';
import { BoardSessionManager } from './board-session';
import { redisService, PresenceRecord } from './redis-adapter';
import { config } from '../config';
import { metrics } from './metrics';

interface JoinBoardPayload {
  boardId: string;
  userId: string;
  userName: string;
  userColor: string;
}

/**
 * Sets up Socket.io event handlers for board synchronization, live awareness,
 * and volatile cursor tracking with rate limiting and payload validation.
 */
export function setupSocketHandlers(io: Server, sessionManager: BoardSessionManager): void {
  io.on('connection', (socket: Socket) => {
    let currentBoardId: string | null = null;
    let currentUser: PresenceRecord | null = null;

    // ----- Join board ----------------------------------------------------
    socket.on('join:board', async (payload: JoinBoardPayload) => {
      const { boardId, userId, userName, userColor } = payload;
      currentBoardId = boardId;
      currentUser = { userId, userName, userColor, lastSeen: Date.now() };

      // Join socket.io room for this board
      socket.join(boardId);

      // Notify other clients that a new participant has joined
      socket.to(boardId).emit('presence:join', { userId, userName, userColor });

      // Register socket for rate limiting / cleanup
      sessionManager.registerSocket(socket.id, boardId);

      // Update presence record in Redis / memory
      await redisService.updatePresence(boardId, currentUser);

      // Load or create the in-memory board session
      const session = await sessionManager.getOrCreateSession(boardId);

      // Determine participant count (including this socket)
      const participantCount = io.sockets.adapter.rooms.get(boardId)?.size ?? 1;

      // Send the current snapshot and participant count to the newly joined client
      const snapshot = session.getSnapshot();
      socket.emit('sync:init', { snapshot, participantCount });
    });

    // ----- Sync update from client --------------------------------------
    socket.on('sync:update', async (payload: { boardId: string; update: Uint8Array | ArrayBuffer; clientSeq: number }) => {
      const { boardId, update, clientSeq } = payload;
      const upd = update instanceof Uint8Array ? update : new Uint8Array(update);

      // 1. Guard update payload size against memory exhaustion attacks
      if (upd.byteLength > config.maxPayloadBytes) {
        socket.emit('error:payload_too_large', {
          message: `Update payload size of ${upd.byteLength} bytes exceeds limit of ${config.maxPayloadBytes} bytes`,
        });
        return;
      }

      // 2. Guard per-socket update rate limit
      if (!sessionManager.checkRateLimit(socket.id, config.rateLimitPerSec)) {
        socket.emit('error:rate_limit', {
          message: `Update rate limit exceeded (maximum ${config.rateLimitPerSec} updates per second)`,
        });
        return;
      }

      // Record the update for persistence / compaction
      await sessionManager.recordUpdate(boardId, upd);

      // Apply to the server's document session
      const session = await sessionManager.getOrCreateSession(boardId);
      session.applyUpdate(upd, `client:${socket.id}`);

      // Acknowledge the originating client
      socket.emit('sync:ack', { clientSeq });

      // Broadcast to all other clients in the same board (excluding the sender)
      socket.to(boardId).emit('sync:update', { update: upd });
    });

    // ----- Cursor movement (volatile, never enters persisted document) -----
    socket.on('cursor:move', (data: { boardId: string; x: number; y: number; viewport?: any; selectedIds?: string[] }) => {
      if (!currentBoardId || !currentUser) return;

      // Validate numeric coordinates
      if (
        typeof data.x !== 'number' ||
        typeof data.y !== 'number' ||
        !Number.isFinite(data.x) ||
        !Number.isFinite(data.y)
      ) {
        return;
      }

      // Relay to other clients via volatile channel (no ack, best-effort at 30-60 fps)
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

    // ----- Awareness updates (ephemeral peer presence & selection vectors) ---
    socket.on('awareness:update', (payload: { boardId: string; update: ArrayBuffer | Uint8Array }) => {
      if (!currentBoardId) return;
      const binary = payload.update instanceof Uint8Array ? payload.update : new Uint8Array(payload.update);

      // Cap awareness vector payload to 64 KB
      if (binary.byteLength > 64 * 1024) return;

      // Broadcast raw binary to peers in the same board
      socket.to(payload.boardId).emit('awareness:update', { update: Buffer.from(binary) });
    });

    // ----- Disconnect ----------------------------------------------------
    socket.on('disconnect', async () => {
      if (currentBoardId) {
        // Notify remaining clients that this participant has left
        if (currentUser) {
          socket.to(currentBoardId).emit('presence:leave', { userId: currentUser.userId });
          await redisService.removePresence(currentBoardId, currentUser.userId);
        }
        // Remove socket tracking and rate limiting state from the session manager
        const leftBoard = sessionManager.cleanupSocket(socket.id);
        if (leftBoard) {
          socket.leave(leftBoard);
        }
      }
    });
  });
}
