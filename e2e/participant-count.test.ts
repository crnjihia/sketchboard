// path: e2e/participant-count.test.ts
import { test, expect } from '@playwright/test';
import { setupTestEnvironment, TestEnvironment } from './helpers/test-env';

let env: TestEnvironment;

test.beforeAll(async () => {
  env = await setupTestEnvironment();
});

test.afterAll(async () => {
  if (env) await env.close();
});

test('participant count reflects three simultaneous clients', async ({ browser }) => {
  const board = 'e2e-count-' + Math.random().toString(36).substring(2, 9);
  const url = `${env.baseURL}?board=${board}`;

  // First client
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();
  await page1.goto(url);
  await page1.waitForFunction(() => !!(window as any).__SKETCHBOARD__);
  await page1.waitForSelector('[data-testid="connection-status"]');
  await expect(page1.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 10000 });

  // Second client
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(url);
  await page2.waitForFunction(() => !!(window as any).__SKETCHBOARD__);
  await page2.waitForSelector('[data-testid="connection-status"]');
  await expect(page2.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 10000 });

  // Verify count is 2 on both
  await expect(page1.locator('[data-testid="participant-count"]')).toHaveText('2', { timeout: 10000 });
  await expect(page2.locator('[data-testid="participant-count"]')).toHaveText('2', { timeout: 10000 });

  // Third client
  const ctx3 = await browser.newContext();
  const page3 = await ctx3.newPage();
  await page3.goto(url);
  await page3.waitForFunction(() => !!(window as any).__SKETCHBOARD__);
  await page3.waitForSelector('[data-testid="connection-status"]');
  await expect(page3.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 10000 });

  // Verify count is 3 on all three clients
  await expect(page1.locator('[data-testid="participant-count"]')).toHaveText('3', { timeout: 10000 });
  await expect(page2.locator('[data-testid="participant-count"]')).toHaveText('3', { timeout: 10000 });
  await expect(page3.locator('[data-testid="participant-count"]')).toHaveText('3', { timeout: 10000 });

  await ctx1.close();
  await ctx2.close();
  await ctx3.close();
});
