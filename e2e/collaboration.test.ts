// path: e2e/collaboration.test.ts
import { test, expect } from '@playwright/test';
import { setupTestEnvironment, TestEnvironment } from './helpers/test-env';

let env: TestEnvironment;

test.beforeAll(async () => {
  env = await setupTestEnvironment();
});

test.afterAll(async () => {
  if (env) await env.close();
});

test('collaborative shape appears across two clients', async ({ browser }) => {
  const board = 'e2e-collab-' + Math.random().toString(36).substring(2, 9);
  const url = `${env.baseURL}?board=${board}`;

  // First client
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await page1.goto(url);
  await page1.waitForFunction(() => (window as any).__SKETCHBOARD__);
  await page1.waitForSelector('[data-testid="connection-status"]');
  await expect(page1.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 10000 });

  // Insert a rectangle shape via the exposed docManager
  const rect = {
    id: 'e2e-rect',
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

  await page1.evaluate((shape) => {
    const { docManager } = (window as any).__SKETCHBOARD__;
    docManager.addObject(shape, 'local');
  }, rect);

  // Second client
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto(url);
  await page2.waitForFunction(() => (window as any).__SKETCHBOARD__);
  await page2.waitForSelector('[data-testid="connection-status"]');
  await expect(page2.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 10000 });

  // Wait for the shape to appear in the second client
  const shapeExists = await page2.waitForFunction(
    (id) => {
      const { docManager } = (window as any).__SKETCHBOARD__;
      return !!docManager.getObject(id);
    },
    rect.id,
    { timeout: 10000 }
  );

  expect(shapeExists).toBeTruthy();

  await context1.close();
  await context2.close();
});
