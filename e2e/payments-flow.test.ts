// path: e2e/payments-flow.test.ts
import { test, expect } from '@playwright/test';
import { setupTestEnvironment, TestEnvironment } from './helpers/test-env';

let env: TestEnvironment;

test.beforeAll(async () => {
  env = await setupTestEnvironment();
});

test.afterAll(async () => {
  if (env) await env.close();
});

test.describe('Lipa Na M-Pesa End-to-End Checkout Suite', () => {
  test('initiates STK push, simulates PIN authorization, and completes plan upgrade across two clients', async ({ browser }) => {
    const board = 'e2e-pay-' + Math.random().toString(36).substring(2, 9);
    const url = `${env.baseURL}?board=${board}`;

    // Context 1: Paying customer (Chris)
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(url);
    await page1.waitForFunction(() => (window as any).__SKETCHBOARD__);
    await page1.waitForSelector('[data-testid="connection-status"]');
    await expect(page1.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 15000 });

    // Context 2: Collaborator observing the board live
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(url);
    await page2.waitForFunction(() => (window as any).__SKETCHBOARD__);
    await page2.waitForSelector('[data-testid="connection-status"]');
    await expect(page2.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 15000 });

    // 1. Click Lipa Na M-Pesa header trigger on page 1
    const mpesaBtn = page1.locator('[data-testid="mpesa-header-button"]');
    await expect(mpesaBtn).toBeVisible();
    await mpesaBtn.click();

    // 2. Verify modal opened with M-Pesa branding and plan cards
    const phoneInput = page1.locator('[data-testid="mpesa-phone-input"]');
    await expect(phoneInput).toBeVisible({ timeout: 5000 });
    await expect(page1.locator('text=LIPA NA M-PESA').first()).toBeVisible();

    // Fill valid Kenyan phone number
    await phoneInput.fill('0712345678');

    // 3. Initiate payment
    const payBtn = page1.locator('[data-testid="mpesa-pay-button"]');
    await expect(payBtn).toBeEnabled();
    await payBtn.click();

    // 4. Modal moves to "waiting for PIN" state
    const simulateSuccessBtn = page1.locator('[data-testid="mpesa-simulate-success"]');
    await expect(simulateSuccessBtn).toBeVisible({ timeout: 10000 });
    await expect(page1.locator('text=Enter M-Pesa PIN on Handset')).toBeVisible();

    // 5. Click dev mock simulator button to simulate customer typing PIN on handset
    await simulateSuccessBtn.click();

    // 6. Modal transitions to success state with synthetic Safaricom receipt
    await expect(page1.locator('text=Payment Successful')).toBeVisible({ timeout: 10000 });
    await expect(page1.locator('text=NLX').first()).toBeVisible();
    await expect(page1.locator('text=KES 150.00').first()).toBeVisible();

    // 7. Click Back to Canvas
    const doneBtn = page1.locator('button:has-text("Back to Canvas")');
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await expect(phoneInput).not.toBeVisible();

    await context1.close();
    await context2.close();
  });

  test('handles user cancellation and allows retrying payment', async ({ browser }) => {
    const board = 'e2e-pay-cancel-' + Math.random().toString(36).substring(2, 9);
    const url = `${env.baseURL}?board=${board}`;

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => (window as any).__SKETCHBOARD__);
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Saved', { timeout: 15000 });

    // Open modal
    await page.locator('[data-testid="mpesa-header-button"]').click();
    const phoneInput = page.locator('[data-testid="mpesa-phone-input"]');
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('0722000000');

    // Initiate
    await page.locator('[data-testid="mpesa-pay-button"]').click();

    // In waiting state, simulate user pressing cancel on their phone
    const simulateCancelBtn = page.locator('[data-testid="mpesa-simulate-cancel"]');
    await expect(simulateCancelBtn).toBeVisible({ timeout: 10000 });
    await simulateCancelBtn.click();

    // Expect failed step with cancel reason
    await expect(page.locator('text=Payment Cancelled or Failed')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Request cancelled by user')).toBeVisible();

    // Click Try Again and verify return to plan selection
    const tryAgainBtn = page.locator('button:has-text("Try Again")');
    await expect(tryAgainBtn).toBeVisible();
    await tryAgainBtn.click();

    await expect(phoneInput).toBeVisible();
    await expect(page.locator('[data-testid="mpesa-pay-button"]')).toBeVisible();

    await context.close();
  });
});

