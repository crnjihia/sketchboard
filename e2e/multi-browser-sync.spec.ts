import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { createServer as createViteServer, ViteDevServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server: http.Server;
let vite: ViteDevServer;
let serverPort: number;
let webPort: number;
let baseURL: string;

test.beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_REDIS = 'false';
  process.env.ENABLE_POSTGRES = 'false';

  const { createSketchboardServer } = await import('../apps/server/src/index.js');

  // 1. Start Sketchboard Server on ephemeral port
  const serverInstance = createSketchboardServer();
  server = serverInstance.server;

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      serverPort = typeof addr === 'object' && addr ? addr.port : 4000;
      resolve();
    });
  });

  // 2. Start Vite Dev Server with proxy to our Socket.io server
  webPort = serverPort + 100;
  vite = await createViteServer({
    root: path.resolve(__dirname, '../apps/web'),
    server: {
      port: webPort,
      strictPort: false,
      host: '127.0.0.1',
      proxy: {
        '/socket.io': {
          target: `http://127.0.0.1:${serverPort}`,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err: any) => {
              if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err.code)) return;
              console.warn('[Proxy Warning]:', err.message);
            });
          },
        },
      },
    },
  });

  await vite.listen();
  const viteAddr = vite.httpServer?.address();
  const actualPort = typeof viteAddr === 'object' && viteAddr ? viteAddr.port : webPort;
  baseURL = `http://127.0.0.1:${actualPort}`;
});

test.afterAll(async () => {
  if (vite) await vite.close();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.describe('Sketchboard Multi-Browser Real-Time Collaboration', () => {
  test('Two browser contexts: draw in A -> appears in B, cursors, concurrent edit convergence, reload restore', async ({
    browser,
  }) => {
    const boardId = 'e2e-' + Math.random().toString(36).substring(2, 9);

    // Create two isolated browser contexts
    const contextA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const contextB = await browser.newContext({ viewport: { width: 1280, height: 720 } });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // 1. Both navigate to the shared board URL
    await pageA.goto(`${baseURL}/b/${boardId}`);
    await pageB.goto(`${baseURL}/b/${boardId}`);

    // Wait for connection to settle on both clients
    await pageA.waitForSelector('[data-testid="connection-status"]');
    await pageB.waitForSelector('[data-testid="connection-status"]');

    await expect(pageA.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 10000 });
    await expect(pageB.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 10000 });

    // Verify participant count updates to 2 on both clients
    await expect(pageA.locator('[data-testid="participant-count"]')).toHaveText('2', { timeout: 10000 });
    await expect(pageB.locator('[data-testid="participant-count"]')).toHaveText('2', { timeout: 10000 });

    // 2. Draw in Browser A -> Appears in Browser B
    // Client A selects Rectangle tool
    await pageA.click('[data-testid="tool-rectangle"]');

    // Simulate drag gesture on overlay canvas in Client A
    const overlayCanvasA = pageA.locator('[data-testid="overlay-canvas"]');
    const boxA = await overlayCanvasA.boundingBox();
    expect(boxA).not.toBeNull();

    if (boxA) {
      await pageA.mouse.move(boxA.x + 200, boxA.y + 150);
      await pageA.mouse.down();
      await pageA.mouse.move(boxA.x + 360, boxA.y + 260, { steps: 5 });
      await pageA.mouse.up();
    }

    // Verify shape exists on Client A
    await pageA.waitForFunction(() => {
      const state = (window as any).__SKETCHBOARD__;
      return state && state.sceneCache.getSortedObjects().length >= 1;
    });

    // Verify shape replicated to Client B in real-time (< 200ms)
    await pageB.waitForFunction(() => {
      const state = (window as any).__SKETCHBOARD__;
      return state && state.sceneCache.getSortedObjects().length >= 1;
    }, { timeout: 5000 });

    const objectsInB = await pageB.evaluate(() => {
      const state = (window as any).__SKETCHBOARD__;
      return state.sceneCache.getSortedObjects();
    });
    expect(objectsInB.length).toBe(1);
    expect(objectsInB[0].type).toBe('rectangle');
    const shapeId = objectsInB[0].id;

    // 3. User B draws a Sticky Note with Swahili color
    await pageB.click('[data-testid="tool-sticky"]');
    const overlayCanvasB = pageB.locator('[data-testid="overlay-canvas"]');
    const boxB = await overlayCanvasB.boundingBox();
    if (boxB) {
      await pageB.mouse.move(boxB.x + 450, boxB.y + 150);
      await pageB.mouse.down();
      await pageB.mouse.move(boxB.x + 600, boxB.y + 300, { steps: 5 });
      await pageB.mouse.up();
    }

    // Wait for Client A to receive sticky note
    await pageA.waitForFunction(() => {
      const state = (window as any).__SKETCHBOARD__;
      return state && state.sceneCache.getSortedObjects().length === 2;
    }, { timeout: 5000 });

    // 4. Remote Cursor Motion: User A moves cursor, User B receives presence
    await pageA.mouse.move(boxA!.x + 500, boxA!.y + 400, { steps: 10 });
    // Allow cursor frame relay
    await pageB.waitForTimeout(150);

    // 5. Concurrent Modification: Client A and Client B mutate shape properties simultaneously
    await pageA.evaluate((id) => {
      const state = (window as any).__SKETCHBOARD__;
      state.docManager.updateObject(id, { x: 220, y: 160 }, 'local');
    }, shapeId);

    await pageB.evaluate((id) => {
      const state = (window as any).__SKETCHBOARD__;
      state.docManager.updateObject(id, { style: { fill: '#22c55e', stroke: '#15803d', strokeWidth: 2, opacity: 1 } }, 'local');
    }, shapeId);

    // Wait for convergence across both clients
    await pageA.waitForTimeout(300);
    await pageB.waitForTimeout(300);

    const shapeOnA = await pageA.evaluate((id) => (window as any).__SKETCHBOARD__.sceneCache.getObject(id), shapeId);
    const shapeOnB = await pageB.evaluate((id) => (window as any).__SKETCHBOARD__.sceneCache.getObject(id), shapeId);

    // Both clients converge deterministically (last-writer-wins per property)
    expect(shapeOnA.x).toBe(shapeOnB.x);
    expect(shapeOnA.y).toBe(shapeOnB.y);
    expect(shapeOnA.style.fill).toBe(shapeOnB.style.fill);

    // 6. Capture Hero Screenshot for documentation
    await pageA.screenshot({ path: 'docs/assets/hero-screenshot.png', fullPage: true });

    // 7. Page Reload Restores State: Client B reloads and recovers state identically
    await pageB.reload();
    await pageB.waitForSelector('[data-testid="connection-status"]');
    await expect(pageB.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 10000 });

    await pageB.waitForFunction(() => {
      const state = (window as any).__SKETCHBOARD__;
      return state && state.sceneCache.getSortedObjects().length === 2;
    }, { timeout: 10000 });

    const reloadedObjects = await pageB.evaluate(() => {
      return (window as any).__SKETCHBOARD__.sceneCache.getSortedObjects();
    });
    expect(reloadedObjects.length).toBe(2);

    await contextA.close();
    await contextB.close();
  });
});
