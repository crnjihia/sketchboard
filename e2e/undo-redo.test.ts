// path: e2e/undo-redo.test.ts
import { test, expect } from '@playwright/test';
import { setupTestEnvironment, TestEnvironment } from './helpers/test-env';

let env: TestEnvironment;

test.beforeAll(async () => {
  env = await setupTestEnvironment();
});

test.afterAll(async () => {
  if (env) await env.close();
});

test('undo/redo sync across two clients', async ({ browser }) => {
  const board = 'e2e-undo-' + Math.random().toString(36).substring(2, 9);
  const url = `${env.baseURL}?board=${board}`;

  // Client A
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await pageA.goto(url);
  await pageA.waitForFunction(() => !!(window as any).__SKETCHBOARD__);
  await pageA.waitForSelector('[data-testid="connection-status"]');
  await expect(pageA.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 10000 });

  // Client B
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(url);
  await pageB.waitForFunction(() => !!(window as any).__SKETCHBOARD__);
  await pageB.waitForSelector('[data-testid="connection-status"]');
  await expect(pageB.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 10000 });

  const rect = {
    id: 'e2e-undo-rect',
    type: 'rectangle' as const,
    x: 50,
    y: 50,
    w: 120,
    h: 80,
    rotation: 0,
    z: 1,
    style: { fill: '#f59e0b', stroke: '#1e293b', strokeWidth: 2, opacity: 1 },
    createdBy: 'e2e-tester',
    updatedAt: Date.now(),
  };

  // Add rectangle from client A
  await pageA.evaluate((shape) => {
    const { docManager } = (window as any).__SKETCHBOARD__;
    docManager.addObject(shape, 'local');
    docManager.stopCapturing();
  }, rect);

  // Wait for shape to appear on client B
  await pageB.waitForFunction(
    (id) => {
      const { docManager } = (window as any).__SKETCHBOARD__;
      return !!docManager.getObject(id);
    },
    rect.id,
    { timeout: 10000 }
  );

  // Move shape on client A
  await pageA.evaluate((id) => {
    const { docManager } = (window as any).__SKETCHBOARD__;
    docManager.updateObject(id, { x: 300, y: 300 }, 'local');
    docManager.stopCapturing();
  }, rect.id);

  // Verify moved on client B
  await pageB.waitForFunction(
    (id) => {
      const { docManager } = (window as any).__SKETCHBOARD__;
      const obj = docManager.getObject(id);
      return obj && obj.x === 300 && obj.y === 300;
    },
    rect.id,
    { timeout: 10000 }
  );

  // Undo on client A
  await pageA.evaluate(() => {
    const { docManager } = (window as any).__SKETCHBOARD__;
    docManager.undo();
  });

  // Verify original position on client B
  await pageB.waitForFunction(
    ({ id, x, y }) => {
      const { docManager } = (window as any).__SKETCHBOARD__;
      const obj = docManager.getObject(id);
      return obj && obj.x === x && obj.y === y;
    },
    { id: rect.id, x: rect.x, y: rect.y },
    { timeout: 10000 }
  );

  // Redo on client A
  await pageA.evaluate(() => {
    const { docManager } = (window as any).__SKETCHBOARD__;
    docManager.redo();
  });

  // Verify moved again on client B
  await pageB.waitForFunction(
    (id) => {
      const { docManager } = (window as any).__SKETCHBOARD__;
      const obj = docManager.getObject(id);
      return obj && obj.x === 300 && obj.y === 300;
    },
    rect.id,
    { timeout: 10000 }
  );

  await contextA.close();
  await contextB.close();
});
