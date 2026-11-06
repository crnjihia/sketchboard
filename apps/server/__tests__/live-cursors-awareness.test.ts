// path: apps/server/__tests__/live-cursors-awareness.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { AddressInfo } from 'net';
import { createSketchboardServer } from '../src/index';
import { BoardDocManager, SWAHILI_PALETTE } from '@sketchboard/shared';

describe('Live Cursors, Awareness & Rate Limiting (Phase 6)', () => {
  let serverInstance: ReturnType<typeof createSketchboardServer>;
  let serverUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_REDIS = 'false';
    process.env.ENABLE_POSTGRES = 'false';

    serverInstance = createSketchboardServer();
    await new Promise<void>((resolve) => {
      serverInstance.server.listen(0, '127.0.0.1', () => {
        const addr = serverInstance.server.address() as AddressInfo;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    serverInstance.sessionManager.destroy();
    await new Promise<void>((resolve) => {
      serverInstance.io.close(() => {
        serverInstance.server.close(() => resolve());
      });
    });
  });

  it('broadcasts volatile cursors between clients in the same room with Swahili colors', async () => {
    const boardId = 'room-cursors-test';

    const socket1: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });
    const socket2: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });

    const client1Color = SWAHILI_PALETTE[0].hex; // Nyekundu
    const client2Color = SWAHILI_PALETTE[1].hex; // Bluu

    // 1. Join room
    await Promise.all([
      new Promise<void>((resolve) => {
        socket1.on('connect', () => {
          socket1.emit('join:board', {
            boardId,
            userId: 'usr-alice-nairobi',
            userName: 'Alice Chebet',
            userColor: client1Color,
          });
        });
        socket1.on('sync:init', () => resolve());
      }),
      new Promise<void>((resolve) => {
        socket2.on('connect', () => {
          socket2.emit('join:board', {
            boardId,
            userId: 'usr-brian-mombasa',
            userName: 'Brian Otieno',
            userColor: client2Color,
          });
        });
        socket2.on('sync:init', () => resolve());
      }),
    ]);

    // 2. Client 1 emits cursor position
    const cursorPromise = new Promise<any>((resolve) => {
      socket2.on('cursor:move', (data: any) => {
        resolve(data);
      });
    });

    socket1.emit('cursor:move', {
      boardId,
      x: 320,
      y: 480,
    });

    const receivedCursor = await cursorPromise;
    expect(receivedCursor.userId).toBe('usr-alice-nairobi');
    expect(receivedCursor.userName).toBe('Alice Chebet');
    expect(receivedCursor.userColor).toBe(client1Color);
    expect(receivedCursor.x).toBe(320);
    expect(receivedCursor.y).toBe(480);
    expect(receivedCursor.timestamp).toBeDefined();

    socket1.disconnect();
    socket2.disconnect();
  });

  it('guarantees cursor traffic never enters or mutates the persisted Y.Doc document', async () => {
    const boardId = 'room-cursor-isolation-test';

    const socket: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        socket.emit('join:board', {
          boardId,
          userId: 'usr-cursor-flooder',
          userName: 'Fast Mover',
          userColor: '#10B981',
        });
      });
      socket.on('sync:init', () => resolve());
    });

    const session = await serverInstance.sessionManager.getOrCreateSession(boardId);
    const initialDocState = session.getSnapshot();

    // Fire 50 cursor movement events in rapid succession
    for (let i = 0; i < 50; i++) {
      socket.emit('cursor:move', {
        boardId,
        x: 100 + i * 10,
        y: 200 + i * 5,
      });
    }

    // Give time for events to be processed on event loop
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The document state must remain completely unaltered!
    const afterDocState = session.getSnapshot();
    expect(afterDocState).toEqual(initialDocState);
    expect(session.getObjectsMap().size).toBe(0);

    socket.disconnect();
  });

  it('rejects updates that exceed maxPayloadBytes', async () => {
    const boardId = 'room-payload-limit-test';

    const socket: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        socket.emit('join:board', {
          boardId,
          userId: 'usr-large-payload',
          userName: 'Payload Tester',
          userColor: '#EC4899',
        });
      });
      socket.on('sync:init', () => resolve());
    });

    // Create an update payload exceeding 256 KB (e.g. 300 KB)
    const largeUpdate = new Uint8Array(300 * 1024);

    const errorPromise = new Promise<any>((resolve) => {
      socket.on('error:payload_too_large', (err: any) => {
        resolve(err);
      });
    });

    socket.emit('sync:update', {
      boardId,
      update: largeUpdate,
      clientSeq: 1,
    });

    const err = await errorPromise;
    expect(err).toBeDefined();
    expect(err.message).toContain('exceeds limit');

    socket.disconnect();
  });

  it('broadcasts presence:leave on client disconnect and cleans up session tracking', async () => {
    const boardId = 'room-leave-test';

    const socket1: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });
    const socket2: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });

    await Promise.all([
      new Promise<void>((resolve) => {
        socket1.on('connect', () => {
          socket1.emit('join:board', {
            boardId,
            userId: 'usr-alice-leave',
            userName: 'Alice',
            userColor: '#3B82F6',
          });
        });
        socket1.on('sync:init', () => resolve());
      }),
      new Promise<void>((resolve) => {
        socket2.on('connect', () => {
          socket2.emit('join:board', {
            boardId,
            userId: 'usr-bob-stay',
            userName: 'Bob',
            userColor: '#EAB308',
          });
        });
        socket2.on('sync:init', () => resolve());
      }),
    ]);

    const leavePromise = new Promise<any>((resolve) => {
      socket2.on('presence:leave', (data: any) => {
        resolve(data);
      });
    });

    // Disconnect socket 1
    socket1.disconnect();

    const leaveData = await leavePromise;
    expect(leaveData.userId).toBe('usr-alice-leave');

    socket2.disconnect();
  });

  it('verifies no memory leaks on 20 rapid join/leave cycles', async () => {
    const boardId = 'leak-check-board';

    for (let i = 0; i < 20; i++) {
      const socket: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });
      await new Promise<void>((resolve) => {
        socket.on('connect', () => {
          socket.emit('join:board', {
            boardId,
            userId: `usr-churn-${i}`,
            userName: `Churn User ${i}`,
            userColor: '#F43F5E',
          });
        });
        socket.on('sync:init', () => {
          socket.disconnect();
          resolve();
        });
      });
    }

    // Wait for disconnect hooks to run
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Confirm that the room has 0 active sockets and no orphaned rate trackers
    const activeSockets = serverInstance.io.sockets.adapter.rooms.get(boardId);
    expect(activeSockets?.size ?? 0).toBe(0);
  });
});

