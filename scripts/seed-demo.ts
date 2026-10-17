import { io, Socket } from 'socket.io-client';
import { BoardDocManager } from '../packages/shared/src/crdt/board-doc';
import { seedNairobiHQ } from '../apps/server/src/sync/seed-data';

/**
 * CLI script to seed any active Sketchboard server instance with the
 * Nairobi FinTech Super-App demo board.
 *
 * Usage:
 *   pnpm tsx scripts/seed-demo.ts [serverUrl] [boardId]
 *   e.g. pnpm tsx scripts/seed-demo.ts http://localhost:8080 nairobi-hq
 */
async function main() {
  const serverUrl = process.argv[2] || process.env.VITE_SERVER_URL || 'http://localhost:4000';
  const targetBoardId = process.argv[3] || 'nairobi-hq';

  console.log(`[Seed] Connecting to Sketchboard server at ${serverUrl}...`);
  console.log(`[Seed] Target board: ${targetBoardId}`);

  const socket: Socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    timeout: 5000,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Connection to ${serverUrl} timed out after 5s`));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log(`[Seed] Connected to server (socketId: ${socket.id})`);
      resolve();
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Create local doc and seed demo objects
  const localDoc = new BoardDocManager(targetBoardId);
  seedNairobiHQ(localDoc);

  const snapshot = localDoc.getSnapshot();
  console.log(`[Seed] Generated demo snapshot (${snapshot.byteLength} bytes, ${localDoc.getObjectsMap().size} objects)`);

  // Join board and send update
  await new Promise<void>((resolve) => {
    socket.emit('board:join', { boardId: targetBoardId, userId: 'usr_seeder', userName: 'System Seeder' }, () => {
      console.log(`[Seed] Joined board ${targetBoardId}`);
      socket.emit('doc:update', {
        boardId: targetBoardId,
        update: snapshot,
        clientSeq: 1,
      }, (ack: any) => {
        console.log(`[Seed] Server acknowledged update:`, ack);
        resolve();
      });
    });
  });

  socket.disconnect();
  console.log(`✅ [Seed Completed Successfully]: Board '${targetBoardId}' seeded with Kenyan FinTech canvas.`);
  process.exit(0);
}

main().catch((err) => {
  console.warn(`[Seed Warning]: Could not connect to live server (${err.message}).`);
  console.log(`Note: The server auto-seeds 'nairobi-hq' on first launch when accessed via web.`);
  process.exit(0);
});
