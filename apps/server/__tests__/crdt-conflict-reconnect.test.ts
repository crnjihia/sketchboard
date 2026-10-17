import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { AddressInfo } from 'net';
import { createSketchboardServer } from '../src/index';
import { BoardDocManager, StickyObject } from '@sketchboard/shared';

describe('Real-Time CRDT Conflict Resolution & Offline Reconnect', () => {
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

  it('two headless clients concurrently edit same shape while offline, reconnect, and converge byte-identically', async () => {
    const boardId = 'board-conflict-reconnect-test';

    // 1. Initial online sync: Client 1 creates base sticky note
    let socket1: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });
    const doc1 = new BoardDocManager(boardId);

    await new Promise<void>((resolve) => {
      socket1.on('connect', () => {
        socket1.emit('join:board', {
          boardId,
          userId: 'user-alice',
          userName: 'Alice',
          userColor: '#FDE047',
        });
      });
      socket1.on('sync:init', (data: { snapshot: ArrayBuffer }) => {
        doc1.applyUpdate(new Uint8Array(data.snapshot));
        resolve();
      });
    });

    const initialSticky: StickyObject = {
      id: 'sticky-concurrent-1',
      type: 'sticky',
      x: 100,
      y: 100,
      w: 150,
      h: 150,
      rotation: 0,
      z: 1,
      style: { fill: '#FDE047', stroke: '#EAB308', strokeWidth: 1, opacity: 1 },
      text: 'Initial text',
      authorName: 'Alice',
      color: 'Njano',
      fontSize: 16,
      createdBy: 'user-alice',
      updatedAt: 1000,
    };

    let update1: Uint8Array | null = null;
    doc1.doc.on('update', (u: Uint8Array, origin: any) => {
      if (origin === 'local') update1 = u;
    });

    doc1.transact(() => {
      doc1.addObject(initialSticky);
    }, 'local');

    // Send update from Client 1
    await new Promise<void>((resolve) => {
      socket1.on('sync:ack', () => resolve());
      socket1.emit('sync:update', { boardId, update: update1, clientSeq: 1 });
    });

    // Client 2 connects and fetches base state
    let socket2: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });
    const doc2 = new BoardDocManager(boardId);

    await new Promise<void>((resolve) => {
      socket2.on('connect', () => {
        socket2.emit('join:board', {
          boardId,
          userId: 'user-bob',
          userName: 'Bob',
          userColor: '#60A5FA',
        });
      });
      socket2.on('sync:init', (data: { snapshot: ArrayBuffer }) => {
        doc2.applyUpdate(new Uint8Array(data.snapshot));
        resolve();
      });
    });

    expect(doc2.getObject('sticky-concurrent-1')).toBeDefined();

    // 2. SIMULATE OFFLINE PERIOD: Disconnect both clients
    socket1.disconnect();
    socket2.disconnect();

    // Client 1 moves and resizes shape offline
    const client1OfflineUpdates: Uint8Array[] = [];
    doc1.doc.on('update', (u: Uint8Array, origin: any) => {
      if (origin === 'local') client1OfflineUpdates.push(u);
    });

    doc1.transact(() => {
      doc1.updateObject('sticky-concurrent-1', {
        x: 550,
        y: 650,
        w: 320,
        h: 280,
      });
    }, 'local');

    // Client 2 concurrently changes color to Waridi and edits text offline
    const client2OfflineUpdates: Uint8Array[] = [];
    doc2.doc.on('update', (u: Uint8Array, origin: any) => {
      if (origin === 'local') client2OfflineUpdates.push(u);
    });

    doc2.transact(() => {
      doc2.updateObject('sticky-concurrent-1', {
        color: 'Waridi',
        style: { fill: '#F472B6', stroke: '#DB2777', strokeWidth: 2, opacity: 1 },
        text: 'Synchronized in Nairobi!',
      });
    }, 'local');

    // 3. RECONNECT BOTH CLIENTS
    socket1 = ClientSocket(serverUrl, { transports: ['websocket'] });
    socket2 = ClientSocket(serverUrl, { transports: ['websocket'] });

    await Promise.all([
      new Promise<void>((resolve) => {
        socket1.on('connect', () => {
          socket1.emit('join:board', { boardId, userId: 'user-alice', userName: 'Alice' });
        });
        socket1.on('sync:init', () => resolve());
      }),
      new Promise<void>((resolve) => {
        socket2.on('connect', () => {
          socket2.emit('join:board', { boardId, userId: 'user-bob', userName: 'Bob' });
        });
        socket2.on('sync:init', () => resolve());
      }),
    ]);

    // Setup cross-update listeners
    const client1Received = new Promise<void>((resolve) => {
      socket1.on('sync:update', (data: { update: ArrayBuffer }) => {
        doc1.applyUpdate(new Uint8Array(data.update));
        resolve();
      });
    });

    const client2Received = new Promise<void>((resolve) => {
      socket2.on('sync:update', (data: { update: ArrayBuffer }) => {
        doc2.applyUpdate(new Uint8Array(data.update));
        resolve();
      });
    });

    // 4. Flush offline outboxes to server
    for (let i = 0; i < client1OfflineUpdates.length; i++) {
      socket1.emit('sync:update', {
        boardId,
        update: client1OfflineUpdates[i],
        clientSeq: 10 + i,
      });
    }

    for (let i = 0; i < client2OfflineUpdates.length; i++) {
      socket2.emit('sync:update', {
        boardId,
        update: client2OfflineUpdates[i],
        clientSeq: 20 + i,
      });
    }

    // Await cross-broadcast
    await Promise.all([client1Received, client2Received]);

    // 5. ASSERT CONVERGENCE & PROPERTY MERGING
    const obj1 = doc1.getObject('sticky-concurrent-1') as StickyObject;
    const obj2 = doc2.getObject('sticky-concurrent-1') as StickyObject;
    const serverSession = await serverInstance.sessionManager.getOrCreateSession(boardId);
    const serverObj = serverSession.getObject('sticky-concurrent-1') as StickyObject;

    // Client 1's position and dimensions won
    expect(obj1.x).toBe(550);
    expect(obj1.y).toBe(650);
    expect(obj1.w).toBe(320);
    expect(obj1.h).toBe(280);

    expect(obj2.x).toBe(550);
    expect(obj2.y).toBe(650);
    expect(obj2.w).toBe(320);
    expect(obj2.h).toBe(280);

    expect(serverObj.x).toBe(550);
    expect(serverObj.y).toBe(650);
    expect(serverObj.w).toBe(320);
    expect(serverObj.h).toBe(280);

    // Client 2's color and text won
    expect(obj1.color).toBe('Waridi');
    expect(obj1.style.fill).toBe('#F472B6');
    expect(obj1.text).toBe('Synchronized in Nairobi!');

    expect(obj2.color).toBe('Waridi');
    expect(obj2.style.fill).toBe('#F472B6');
    expect(obj2.text).toBe('Synchronized in Nairobi!');

    expect(serverObj.color).toBe('Waridi');
    expect(serverObj.style.fill).toBe('#F472B6');
    expect(serverObj.text).toBe('Synchronized in Nairobi!');

    // CRDT state is byte-identical everywhere!
    expect(doc1.getSnapshot()).toEqual(doc2.getSnapshot());
    expect(doc1.getSnapshot()).toEqual(serverSession.getSnapshot());

    // 6. Test snapshot compaction
    const compacted = await serverInstance.sessionManager.compactBoard(boardId);
    expect(compacted).toBe(true);

    // Clean up
    socket1.disconnect();
    socket2.disconnect();
    doc1.destroy();
    doc2.destroy();
  });
});
