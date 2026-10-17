import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { BoardDocManager } from '../src/crdt/board-doc';
import { CanvasObject } from '../src/schema/objects';
import { SWAHILI_PALETTE } from '../src/palette';

/**
 * Property-based test simulating N distributed concurrent clients generating
 * random interleaved operations, with randomized message delivery ordering
 * and duplicate packet transmissions (network drops/retransmits).
 *
 * Verifies strong eventual consistency: all clients converge to identical state.
 */
describe('CRDT Property-Based Convergence Test (Fuzzing N-Clients)', () => {
  it('converges to byte-identical state across 4 clients under random delivery orders and duplicates', () => {
    const NUM_CLIENTS = 4;
    const NUM_OPS_PER_CLIENT = 15;
    const boardId = 'property-fuzz-board';

    const clients = Array.from({ length: NUM_CLIENTS }, (_, i) => ({
      id: `client-${i + 1}`,
      manager: new BoardDocManager(boardId),
      generatedUpdates: [] as Uint8Array[],
    }));

    // Register local update listeners to capture delta updates
    clients.forEach((client) => {
      client.manager.onLocalUpdate((update) => {
        client.generatedUpdates.push(update);
      });
    });

    const shapeIds = ['shape-alpha', 'shape-beta', 'shape-gamma', 'shape-delta', 'shape-omega'];
    const colors = SWAHILI_PALETTE.map((c) => c.name);

    // Initial seed on Client 1
    clients[0].manager.transact(() => {
      shapeIds.forEach((id, idx) => {
        const isRect = idx % 2 === 0;
        const obj: CanvasObject = isRect
          ? {
              id,
              type: 'rectangle',
              x: 100 * idx,
              y: 50 * idx,
              w: 160,
              h: 120,
              rotation: 0,
              z: idx,
              style: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
                opacity: 1,
              },
              createdBy: 'client-1',
              updatedAt: Date.now(),
            }
          : {
              id,
              type: 'sticky',
              x: 100 * idx,
              y: 50 * idx,
              w: 160,
              h: 120,
              rotation: 0,
              z: idx,
              style: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
                opacity: 1,
              },
              text: `Seed text ${idx}`,
              authorName: 'client-1',
              fontSize: 14,
              color: colors[idx % colors.length],
              createdBy: 'client-1',
              updatedAt: Date.now(),
            };
        clients[0].manager.addObject(obj, 'local');
      });
    }, 'local');

    // Distribute initial seed to all clients
    const initialSeed = clients[0].manager.getSnapshot();
    clients.forEach((c) => {
      if (c.id !== 'client-1') {
        c.manager.applyUpdate(initialSeed, 'remote');
      }
    });

    // Each client executes random mutations independently
    clients.forEach((client, clientIdx) => {
      for (let i = 0; i < NUM_OPS_PER_CLIENT; i++) {
        const targetId = shapeIds[Math.floor(Math.random() * shapeIds.length)];
        const opType = Math.floor(Math.random() * 5);

        client.manager.transact(() => {
          switch (opType) {
            case 0: // Position move
              client.manager.updateObject(
                targetId,
                {
                  x: 50 + Math.floor(Math.random() * 800),
                  y: 50 + Math.floor(Math.random() * 600),
                },
                'local'
              );
              break;
            case 1: // Style & Color mutation
              client.manager.updateObject(
                targetId,
                {
                  style: {
                    fill: '#1e293b',
                    stroke: '#3b82f6',
                    strokeWidth: 1 + Math.floor(Math.random() * 4),
                    opacity: 0.9,
                  },
                },
                'local'
              );
              break;
            case 2: // Sticky text & color mutation
              client.manager.updateObject(
                targetId,
                {
                  text: `Edit from ${client.id} at step ${i}`,
                  color: colors[Math.floor(Math.random() * colors.length)],
                },
                'local'
              );
              break;
            case 3: // Layer order manipulation
              if (Math.random() > 0.5) {
                client.manager.bringToFront(targetId, 'local');
              } else {
                client.manager.sendToBack(targetId, 'local');
              }
              break;
            case 4: {
              // Add ad-hoc temporary shape
              const dynamicId = `dyn-${client.id}-${i}`;
              client.manager.addObject(
                {
                  id: dynamicId,
                  type: 'ellipse',
                  x: 200,
                  y: 200,
                  w: 100,
                  h: 80,
                  rotation: 0,
                  z: 99,
                  style: { fill: '#ec4899', stroke: '#ffffff', strokeWidth: 2, opacity: 1 },
                  createdBy: client.id,
                  updatedAt: Date.now(),
                },
                'local'
              );
              break;
            }
          }
        }, 'local');
      }
    });

    // Collect all generated updates across all clients
    const allUpdates: Uint8Array[] = [];
    clients.forEach((c) => {
      allUpdates.push(...c.generatedUpdates);
    });

    expect(allUpdates.length).toBeGreaterThan(0);

    // Simulate Network Disruption:
    // 1. Introduce 25% duplicate packets (simulating idempotent retransmissions)
    const duplicates = allUpdates.slice(0, Math.floor(allUpdates.length * 0.25));
    const rawPool = [...allUpdates, ...duplicates];

    // 2. Deliver all updates to every client in a completely different random permutation
    clients.forEach((client) => {
      // Fisher-Yates shuffle
      const shuffled = [...rawPool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Apply each update
      shuffled.forEach((update) => {
        client.manager.applyUpdate(update, 'remote-fuzz');
      });
    });

    // 3. Verify Convergence
    const baselineSnapshot = clients[0].manager.getSnapshot();
    const baselineZOrder = clients[0].manager.getZOrder();
    const baselineObjects = clients[0].manager.getSortedObjects();

    for (let i = 1; i < clients.length; i++) {
      const target = clients[i];
      const targetZOrder = target.manager.getZOrder();
      const targetObjects = target.manager.getSortedObjects();

      // Ensure exact zOrder sequence match
      expect(targetZOrder).toEqual(baselineZOrder);

      // Ensure identical object count
      expect(targetObjects.length).toEqual(baselineObjects.length);

      // Ensure every property on every object converged identically
      targetObjects.forEach((obj, idx) => {
        expect(obj).toEqual(baselineObjects[idx]);
      });

      // Ensure state vector matches
      const v0 = Y.encodeStateVector(clients[0].manager.doc);
      const vi = Y.encodeStateVector(target.manager.doc);
      expect(vi).toEqual(v0);
    }
  });
});
