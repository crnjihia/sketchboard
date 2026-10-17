/**
 * High-Scale Load Test Script for Sketchboard
 * Simulates high-density concurrent sockets across multiple boards:
 * - 30fps cursor streaming (volatile emits)
 * - 1 edit/sec per socket
 * - Reports p95 broadcast latency across cluster nodes
 */
process.env.NODE_ENV = 'test';

import { io as ClientSocket, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { createSketchboardServer } from '../apps/server/src/index';
import { BoardDocManager, RectangleObject } from '@sketchboard/shared';

interface LoadConfig {
  numBoards: number;
  usersPerBoard: number;
  durationSeconds: number;
}

const DEFAULT_CONFIG: LoadConfig = {
  numBoards: 10,
  usersPerBoard: 5,
  durationSeconds: 5,
};

async function runLoadTest(customConfig?: Partial<LoadConfig>) {
  const cfg = { ...DEFAULT_CONFIG, ...customConfig };
  const totalSockets = cfg.numBoards * cfg.usersPerBoard;

  console.log(`--- [Sketchboard Cluster Load Test] ---`);
  console.log(`Boards: ${cfg.numBoards} | Users/Board: ${cfg.usersPerBoard} | Total Sockets: ${totalSockets}`);
  console.log(`Duration: ${cfg.durationSeconds}s | Cursor: 30fps | Edits: 1/sec\n`);

  // Start two server replicas
  const server1 = createSketchboardServer();
  const server2 = createSketchboardServer();
  let url1 = '';
  let url2 = '';

  await Promise.all([
    new Promise<void>((r) => {
      server1.server.listen(0, '127.0.0.1', () => {
        url1 = `http://127.0.0.1:${(server1.server.address() as AddressInfo).port}`;
        r();
      });
    }),
    new Promise<void>((r) => {
      server2.server.listen(0, '127.0.0.1', () => {
        url2 = `http://127.0.0.1:${(server2.server.address() as AddressInfo).port}`;
        r();
      });
    }),
  ]);

  const sockets: Socket[] = [];
  const latencies: number[] = [];
  let totalEditsSent = 0;
  let totalEditsAcked = 0;
  let totalCursorsSent = 0;
  let totalCursorsReceived = 0;

  // Connect sockets distributed across Server 1 and Server 2
  for (let b = 0; b < cfg.numBoards; b++) {
    const boardId = `load-board-${b}`;

    for (let u = 0; u < cfg.usersPerBoard; u++) {
      const serverUrl = u % 2 === 0 ? url1 : url2;
      const userId = `usr-load-${b}-${u}`;
      const socket = ClientSocket(serverUrl, { transports: ['websocket'] });

      socket.on('connect', () => {
        socket.emit('join:board', {
          boardId,
          userId,
          userName: `Bot ${u}`,
        });
      });

      socket.on('sync:ack', () => {
        totalEditsAcked++;
      });

      socket.on('cursor:move', (data: { timestamp?: number }) => {
        totalCursorsReceived++;
        if (data.timestamp) {
          const lat = performance.now() - data.timestamp;
          if (lat >= 0 && lat < 5000) {
            latencies.push(lat);
          }
        }
      });

      sockets.push(socket);
    }
  }

  // Allow sockets to complete connection handshake
  await new Promise((r) => setTimeout(r, 1000));
  console.log(`[Load] Connected ${sockets.length} sockets across cluster. Starting traffic generation...`);

  const startTime = Date.now();
  const endTime = startTime + cfg.durationSeconds * 1000;

  // Active load loop
  const cursorInterval = setInterval(() => {
    const now = performance.now();
    for (let i = 0; i < sockets.length; i++) {
      const b = Math.floor(i / cfg.usersPerBoard);
      sockets[i].emit('cursor:move', {
        boardId: `load-board-${b}`,
        x: Math.round(Math.random() * 2000),
        y: Math.round(Math.random() * 2000),
      });
      totalCursorsSent++;
    }
  }, 33); // 30fps ~33ms

  // Pre-generate valid Yjs binary updates
  const testDoc = new BoardDocManager('test');
  testDoc.addObject({
    id: 'shape-load',
    type: 'rectangle',
    x: 10,
    y: 10,
    w: 100,
    h: 100,
    rotation: 0,
    z: 1,
    style: { fill: '#FDE047', stroke: '#000000', strokeWidth: 1, opacity: 1 },
    createdBy: 'bot',
    updatedAt: Date.now(),
  });
  const validYjsUpdate = testDoc.getSnapshot();

  const editInterval = setInterval(() => {
    for (let i = 0; i < sockets.length; i++) {
      const b = Math.floor(i / cfg.usersPerBoard);
      sockets[i].emit('sync:update', {
        boardId: `load-board-${b}`,
        update: validYjsUpdate,
        clientSeq: Date.now() + i,
      });
      totalEditsSent++;
    }
  }, 1000); // 1 edit/sec

  // Wait for test duration
  await new Promise((r) => setTimeout(r, cfg.durationSeconds * 1000));

  clearInterval(cursorInterval);
  clearInterval(editInterval);

  // Allow trailing ACKs to land
  await new Promise((r) => setTimeout(r, 600));

  // Compute Latency Percentiles
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p90 = latencies[Math.floor(latencies.length * 0.9)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  console.log(`\n================== LOAD TEST RESULTS ==================`);
  console.log(`Total Sockets Connected : ${sockets.length}`);
  console.log(`Total Cursors Emitted   : ${totalCursorsSent}`);
  console.log(`Total Cursors Relayed   : ${totalCursorsReceived}`);
  console.log(`Total Edits Dispatched  : ${totalEditsSent}`);
  console.log(`Total Edits ACKed       : ${totalEditsAcked} (${Math.round((totalEditsAcked / totalEditsSent) * 100)}% ACK rate)`);
  console.log(`-------------------------------------------------------`);
  console.log(`Broadcast Latency p50   : ${p50.toFixed(2)} ms`);
  console.log(`Broadcast Latency p90   : ${p90.toFixed(2)} ms`);
  console.log(`Broadcast Latency p95   : ${p95.toFixed(2)} ms`);
  console.log(`Broadcast Latency p99   : ${p99.toFixed(2)} ms`);
  console.log(`=======================================================\n`);

  // Teardown
  for (const s of sockets) s.disconnect();
  server1.sessionManager.destroy();
  server2.sessionManager.destroy();

  await Promise.all([
    new Promise<void>((r) => server1.io.close(() => server1.server.close(() => r()))),
    new Promise<void>((r) => server2.io.close(() => server2.server.close(() => r()))),
  ]);

  console.log('✅ [Load Test Completed Successfully]');
  process.exit(0);
}

runLoadTest().catch((err) => {
  console.error('❌ [Load Test Error]:', err);
  process.exit(1);
});
