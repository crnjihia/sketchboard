// path: apps/server/src/sync/socket-handler.ts
import { Server, Socket } from 'socket.io';
import { BoardSessionManager } from './board-session';
import { redisService, PresenceRecord } from './redis-adapter';
import { metrics } from './metrics';

interface JoinBoardPayload {
  boardId: string;
  userId: string;
  userName: string;
  userColor: string;
}

/**
 * Sets up Socket.io event handlers for board synchronization.
 * Implements the protocol expected by the server‑side tests and the Playwright e2e test.
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
      socket.to(boardId).emit('presence:join');
      // Register socket for rate limiting / cleanup
      sessionManager.registerSocket(socket.id, boardId);

      // Update presence (used by UI, optional for tests)
      await redisService.updatePresence(boardId, currentUser);

      // Load or create the in‑memory board session
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

    // ----- Cursor movement (volatile) -----------------------------------
    socket.on('cursor:move', (data: { boardId: string; x: number; y: number; viewport?: any; selectedIds?: string[] }) => {
      if (!currentBoardId || !currentUser) return;
      // Relay to other clients via volatile channel (no ack, best‑effort)
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

    // ----- Awareness updates --------------------------------------------
    socket.on('awareness:update', (payload: { boardId: string; update: ArrayBuffer | Uint8Array }) => {
      if (!currentBoardId) return;
      const binary = payload.update instanceof Uint8Array ? payload.update : new Uint8Array(payload.update);
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
        // Remove socket tracking from the session manager
        const leftBoard = sessionManager.cleanupSocket(socket.id);
        if (leftBoard) {
          socket.leave(leftBoard);
        }
      }
    });
  });
}
