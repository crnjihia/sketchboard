process.env.NODE_ENV = 'test';

import { io as ClientSocket, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { createSketchboardServer } from '../apps/server/src/index';
import { BoardDocManager, StickyObject } from '@sketchboard/shared';

async function runChaosTest() {
  console.log('--- [Sketchboard Chaos Test: Server Failover Mid-Session] ---');

  // 1. Start two server instances simulating Server-1 and Server-2 replicas
  const server1Instance = createSketchboardServer();
  const server2Instance = createSketchboardServer();

  let server1Url = '';
  let server2Url = '';

  await Promise.all([
    new Promise<void>((resolve) => {
      server1Instance.server.listen(0, '127.0.0.1', () => {
        const addr = server1Instance.server.address() as AddressInfo;
        server1Url = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      server2Instance.server.listen(0, '127.0.0.1', () => {
        const addr = server2Instance.server.address() as AddressInfo;
        server2Url = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    }),
  ]);

  console.log(`[Chaos] Server 1 listening on ${server1Url}`);
  console.log(`[Chaos] Server 2 listening on ${server2Url}`);

  const boardId = 'chaos-board-kenya';

  // 2. Client A connects to Server 1
  let clientA: Socket = ClientSocket(server1Url, { transports: ['websocket'] });
  const docA = new BoardDocManager(boardId);

  await new Promise<void>((resolve) => {
    clientA.on('connect', () => {
      clientA.emit('join:board', { boardId, userId: 'user-a', userName: 'Amina' });
    });
    clientA.on('sync:init', (data: { snapshot: ArrayBuffer }) => {
      docA.applyUpdate(new Uint8Array(data.snapshot));
      resolve();
    });
  });

  // Client B connects to Server 2
  const clientB: Socket = ClientSocket(server2Url, { transports: ['websocket'] });
  const docB = new BoardDocManager(boardId);

  await new Promise<void>((resolve) => {
    clientB.on('connect', () => {
      clientB.emit('join:board', { boardId, userId: 'user-b', userName: 'Bob' });
    });
    clientB.on('sync:init', (data: { snapshot: ArrayBuffer }) => {
      docB.applyUpdate(new Uint8Array(data.snapshot));
      resolve();
    });
  });

  console.log('[Chaos] Both clients connected to separate server instances.');

  // 3. Client A creates a sticky note on Server 1
  const sticky1: StickyObject = {
    id: 'sticky-chaos-1',
    type: 'sticky',
    x: 100,
    y: 100,
    w: 200,
    h: 200,
    rotation: 0,
    z: 1,
    style: { fill: '#FDE047', stroke: '#EAB308', strokeWidth: 1, opacity: 1 },
    text: 'Pre-chaos sticky note',
    authorName: 'Amina',
    color: 'Njano',
    fontSize: 16,
    createdBy: 'user-a',
    updatedAt: Date.now(),
  };

  let updateA1: Uint8Array | null = null;
  docA.doc.on('update', (u: Uint8Array, origin: any) => {
    if (origin === 'local') updateA1 = u;
  });

  docA.transact(() => {
    docA.addObject(sticky1);
  }, 'local');

  await new Promise<void>((resolve) => {
    clientA.on('sync:ack', () => resolve());
    clientA.emit('sync:update', { boardId, update: updateA1, clientSeq: 1 });
  });

  console.log('[Chaos] Client A committed shape on Server 1.');

  // 4. CHAOS EVENT: Abruptly kill Server 1 mid-session!
  console.log('[Chaos] KILLING Server 1 abruptly (simulating pod crash / OOMKill)...');
  await new Promise<void>((resolve) => {
    server1Instance.io.close(() => {
      server1Instance.server.close(() => resolve());
    });
  });

  // Client A creates another shape while in-flight / offline
  const sticky2: StickyObject = {
    id: 'sticky-chaos-2',
    type: 'sticky',
    x: 400,
    y: 400,
    w: 200,
    h: 200,
    rotation: 0,
    z: 2,
    style: { fill: '#F472B6', stroke: '#DB2777', strokeWidth: 1, opacity: 1 },
    text: 'Offline edit created during failover',
    authorName: 'Amina',
    color: 'Waridi',
    fontSize: 16,
    createdBy: 'user-a',
    updatedAt: Date.now(),
  };

  let updateA2: Uint8Array | null = null;
  docA.transact(() => {
    docA.addObject(sticky2);
  }, 'local');

  docA.doc.on('update', (u: Uint8Array, origin: any) => {
    if (origin === 'local') updateA2 = u;
  });

  // 5. Client A reconnects to Server 2 (the surviving replica)
  console.log('[Chaos] Client A reconnecting to Server 2 replica...');
  clientA.disconnect();
  clientA = ClientSocket(server2Url, { transports: ['websocket'] });

  await new Promise<void>((resolve) => {
    clientA.on('connect', () => {
      clientA.emit('join:board', { boardId, userId: 'user-a', userName: 'Amina' });
    });
    clientA.on('sync:init', (data: { snapshot: ArrayBuffer }) => {
      // Re-apply state
      docA.applyUpdate(new Uint8Array(data.snapshot));
      resolve();
    });
  });

  // Flush missing state from Client A to Server 2
  const server2Session = await server2Instance.sessionManager.getOrCreateSession(boardId);
  const diffForServer2 = docA.diffUpdate(server2Session.getStateVector());

  await new Promise<void>((resolve) => {
    clientA.on('sync:ack', () => resolve());
    clientA.emit('sync:update', { boardId, update: diffForServer2, clientSeq: 99 });
  });

  // Also sync Client B with Server 2
  const diffForClientB = server2Session.diffUpdate(docB.getStateVector());
  docB.applyUpdate(diffForClientB);

  // 6. Verify assertions
  console.log('[Chaos] Verifying state convergence across all nodes...');
  const obj1A = docA.getObject('sticky-chaos-1');
  const obj1B = docB.getObject('sticky-chaos-1');
  const obj2A = docA.getObject('sticky-chaos-2');
  const obj2B = docB.getObject('sticky-chaos-2');

  if (!obj1A || !obj1B || !obj2A || !obj2B) {
    throw new Error('Chaos test failed: Shapes missing after failover!');
  }

  // Snapshots must be byte-identical
  const snapA = docA.getSnapshot();
  const snapB = docB.getSnapshot();
  const snapServer = server2Session.getSnapshot();

  if (Buffer.from(snapA).compare(Buffer.from(snapB)) !== 0) {
    throw new Error('Chaos test failed: Client A and Client B snapshots do not match!');
  }
  if (Buffer.from(snapA).compare(Buffer.from(snapServer)) !== 0) {
    throw new Error('Chaos test failed: Client A and Server 2 snapshots do not match!');
  }

  console.log('✅ [Chaos Test PASSED]: 0 edits lost. Reconnected to survivor replica and converged byte-identically.');

  // Clean up
  clientA.disconnect();
  clientB.disconnect();
  docA.destroy();
  docB.destroy();
  server2Instance.sessionManager.destroy();
  await new Promise<void>((resolve) => {
    server2Instance.io.close(() => {
      server2Instance.server.close(() => resolve());
    });
  });

  process.exit(0);
}

// Execute if run directly
runChaosTest().catch((err) => {
  console.error('❌ [Chaos Test Error]:', err);
  process.exit(1);
});
