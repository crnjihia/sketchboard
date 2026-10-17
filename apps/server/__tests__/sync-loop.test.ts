import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { AddressInfo } from 'net';
import { createSketchboardServer } from '../src/index';
import { BoardDocManager, StickyObject } from '@sketchboard/shared';

describe('Socket.io Single-Node Real-Time Sync Loop', () => {
  let serverInstance: ReturnType<typeof createSketchboardServer>;
  let serverUrl: string;

  beforeAll(async () => {
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

  it('synchronizes document edits between two headless clients via Socket.io', async () => {
    const boardId = 'test-board-sync';

    // 1. Client 1 connects and joins board
    const socket1: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });
    const doc1 = new BoardDocManager(boardId);

    await new Promise<void>((resolve) => {
      socket1.on('connect', () => {
        socket1.emit('join:board', {
          boardId,
          userId: 'user-1',
          userName: 'Alice Nairobi',
          userColor: '#FDE047',
        });
      });

      socket1.on('sync:init', (data: { snapshot: ArrayBuffer }) => {
        doc1.applyUpdate(new Uint8Array(data.snapshot));
        resolve();
      });
    });

    // 2. Client 1 creates a sticky note
    const sticky: StickyObject = {
      id: 'sticky-nairobi-1',
      type: 'sticky',
      x: 150,
      y: 200,
      w: 180,
      h: 180,
      rotation: 0,
      z: 1,
      style: {
        fill: '#FDE047',
        stroke: '#EAB308',
        strokeWidth: 1,
        opacity: 1,
      },
      text: 'Hujambo Sketchboard!',
      authorName: 'Alice Nairobi',
      color: 'Njano',
      fontSize: 16,
      createdBy: 'user-1',
      updatedAt: Date.now(),
    };

    let client1Update: Uint8Array | null = null;
    doc1.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin === 'local') {
        client1Update = update;
      }
    });

    doc1.transact(() => {
      doc1.addObject(sticky);
    }, 'local');

    expect(client1Update).not.toBeNull();

    // 3. Client 1 sends update and awaits ACK
    const ackPromise = new Promise<void>((resolve) => {
      socket1.on('sync:ack', (ack: { clientSeq: number }) => {
        if (ack.clientSeq === 1) {
          resolve();
        }
      });
    });

    socket1.emit('sync:update', {
      boardId,
      update: client1Update,
      clientSeq: 1,
    });

    await ackPromise;

    // 4. Client 2 connects and joins board
    const socket2: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });
    const doc2 = new BoardDocManager(boardId);

    await new Promise<void>((resolve) => {
      socket2.on('connect', () => {
        socket2.emit('join:board', {
          boardId,
          userId: 'user-2',
          userName: 'Bob Mombasa',
          userColor: '#60A5FA',
        });
      });

      socket2.on('sync:init', (data: { snapshot: ArrayBuffer }) => {
        doc2.applyUpdate(new Uint8Array(data.snapshot));
        resolve();
      });
    });

    // Client 2 must immediately have Client 1's sticky note!
    const client2Obj = doc2.getObject('sticky-nairobi-1') as StickyObject;
    expect(client2Obj).toBeDefined();
    expect(client2Obj.text).toBe('Hujambo Sketchboard!');
    expect(client2Obj.authorName).toBe('Alice Nairobi');

    // 5. Client 2 moves the sticky note and sends update
    let client2Update: Uint8Array | null = null;
    doc2.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin === 'local') {
        client2Update = update;
      }
    });

    doc2.transact(() => {
      doc2.updateObject('sticky-nairobi-1', { x: 450, y: 550 });
    }, 'local');

    // Client 1 listens for broadcast update
    const client1ReceivedPromise = new Promise<void>((resolve) => {
      socket1.on('sync:update', (data: { update: ArrayBuffer }) => {
        doc1.applyUpdate(new Uint8Array(data.update));
        resolve();
      });
    });

    socket2.emit('sync:update', {
      boardId,
      update: client2Update,
      clientSeq: 101,
    });

    await client1ReceivedPromise;

    // Verify both clients and the server have converged
    const obj1After = doc1.getObject('sticky-nairobi-1');
    const obj2After = doc2.getObject('sticky-nairobi-1');
    const serverSession = await serverInstance.sessionManager.getOrCreateSession(boardId);
    const serverObj = serverSession.getObject('sticky-nairobi-1');

    expect(obj1After?.x).toBe(450);
    expect(obj1After?.y).toBe(550);
    expect(obj2After?.x).toBe(450);
    expect(obj2After?.y).toBe(550);
    expect(serverObj?.x).toBe(450);
    expect(serverObj?.y).toBe(550);

    // CRDT state snapshots are byte-identical
    expect(doc1.getSnapshot()).toEqual(doc2.getSnapshot());
    expect(doc1.getSnapshot()).toEqual(serverSession.getSnapshot());

    // Clean up test sockets
    socket1.disconnect();
    socket2.disconnect();
    doc1.destroy();
    doc2.destroy();
  });
});
