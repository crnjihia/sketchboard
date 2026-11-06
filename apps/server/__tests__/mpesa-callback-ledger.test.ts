// path: apps/server/__tests__/mpesa-callback-ledger.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { AddressInfo } from 'net';
import { createSketchboardServer } from '../src/index';
import { paymentLedger } from '../src/persistence/payment-ledger';
import { resetMpesaClient } from '../src/integrations/mpesa';
import { resetAfricaTalkingClient, getAfricaTalkingClient, MockAfricaTalkingClient } from '../src/integrations/africastalking';

describe('Daraja Callback Webhook & Payment Ledger (Phase 7)', () => {
  let serverInstance: ReturnType<typeof createSketchboardServer>;
  let serverUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_REDIS = 'false';
    process.env.ENABLE_POSTGRES = 'false';
    process.env.MPESA_MOCK = 'true';
    process.env.AFRICASTALKING_MOCK = 'true';

    resetMpesaClient();
    resetAfricaTalkingClient();
    paymentLedger.clearInMemory();

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
    await paymentLedger.close();
    await new Promise<void>((resolve) => {
      serverInstance.io.close(() => {
        serverInstance.server.close(() => resolve());
      });
    });
  });

  beforeEach(() => {
    paymentLedger.clearInMemory();
    const atClient = getAfricaTalkingClient();
    if (atClient instanceof MockAfricaTalkingClient) {
      atClient.clearOutbox();
    }
  });

  it('processes successful Daraja callback, updates ledger, upgrades board plan, and dispatches SMS receipt', async () => {
    const boardId = 'nairobi-fintech-board';

    // 1. Initiate STK Push
    const stkRes = await fetch(`${serverUrl}/api/payments/mpesa/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0712345678',
        amount: 2500,
        boardId,
        userId: 'usr_chris_001',
        planType: 'team_monthly',
        accountReference: 'SKETCHBOARD',
        transactionDesc: 'WorkspacePass',
      }),
    });

    expect(stkRes.status).toBe(200);
    const stkData = (await stkRes.json()) as any;
    const checkoutRequestId = stkData.CheckoutRequestID;
    expect(checkoutRequestId).toBeDefined();

    // Verify pending transaction was created in ledger
    const pendingTx = await paymentLedger.getTransactionByCheckoutId(checkoutRequestId);
    expect(pendingTx).not.toBeNull();
    expect(pendingTx?.status).toBe('pending');
    expect(pendingTx?.amount).toBe(2500);

    // 2. Connect client to receive real-time Socket.io payment notification
    const clientSocket: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => {
        clientSocket.emit('join:board', {
          boardId,
          userId: 'usr_chris_001',
          userName: 'Chris Nairobi',
          userColor: '#10B981',
        });
      });
      clientSocket.on('sync:init', () => resolve());
    });

    const paymentConfirmedPromise = new Promise<any>((resolve) => {
      clientSocket.on('payment:confirmed', (data: any) => resolve(data));
    });

    // 3. Post Safaricom Daraja Webhook Callback Payload
    const callbackPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: stkData.MerchantRequestID,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 2500 },
              { Name: 'MpesaReceiptNumber', Value: 'NLX8NBO2026' },
              { Name: 'Balance' },
              { Name: 'TransactionDate', Value: 20261106113000 },
              { Name: 'PhoneNumber', Value: 254712345678 },
            ],
          },
        },
      },
    };

    const cbRes = await fetch(`${serverUrl}/api/payments/mpesa/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callbackPayload),
    });

    expect(cbRes.status).toBe(200);
    const cbData = (await cbRes.json()) as any;
    expect(cbData.ResultCode).toBe(0);
    expect(cbData.ResultDesc).toBe('Accepted');

    // 4. Verify transaction ledger updated to completed
    const completedTx = await paymentLedger.getTransactionByCheckoutId(checkoutRequestId);
    expect(completedTx?.status).toBe('completed');
    expect(completedTx?.mpesaReceipt).toBe('NLX8NBO2026');
    expect(completedTx?.resultCode).toBe(0);

    // 5. Verify board plan upgrade
    const planInfo = await paymentLedger.getBoardPlan(boardId);
    expect(planInfo.planTier).toBe('team_monthly');
    expect(planInfo.isActive).toBe(true);
    expect(planInfo.expiresAt).toBeGreaterThan(Date.now());

    // 6. Verify Africa's Talking SMS receipt dispatch
    const atClient = getAfricaTalkingClient() as MockAfricaTalkingClient;
    const outbox = atClient.getOutbox();
    expect(outbox.length).toBeGreaterThanOrEqual(1);
    expect(outbox[0].message).toContain('NLX8NBO2026');
    expect(outbox[0].message).toContain('KES 2,500.00');

    // 7. Verify Socket.io event received by client in the room
    const eventData = await paymentConfirmedPromise;
    expect(eventData.boardId).toBe(boardId);
    expect(eventData.planType).toBe('team_monthly');
    expect(eventData.mpesaReceipt).toBe('NLX8NBO2026');

    clientSocket.disconnect();
  });

  it('handles user-cancelled transaction callback and sets failed ledger state', async () => {
    const boardId = 'cancel-test-board';

    // Initiate
    const stkRes = await fetch(`${serverUrl}/api/payments/mpesa/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0712345678',
        amount: 150,
        boardId,
        userId: 'usr_cancel_001',
        planType: 'daily_pass',
      }),
    });
    const stkData = (await stkRes.json()) as any;
    const checkoutRequestId = stkData.CheckoutRequestID;

    // Post Cancelled Callback (ResultCode 1032)
    const cancelPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: stkData.MerchantRequestID,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user',
        },
      },
    };

    const cbRes = await fetch(`${serverUrl}/api/payments/mpesa/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cancelPayload),
    });

    expect(cbRes.status).toBe(200);

    // Verify ledger marked as failed
    const failedTx = await paymentLedger.getTransactionByCheckoutId(checkoutRequestId);
    expect(failedTx?.status).toBe('failed');
    expect(failedTx?.resultCode).toBe(1032);
    expect(failedTx?.mpesaReceipt).toBeNull();

    // Verify board remains free tier
    const planInfo = await paymentLedger.getBoardPlan(boardId);
    expect(planInfo.planTier).toBe('free');
  });

  it('reconciles status via GET /api/payments/mpesa/status/:id from ledger', async () => {
    const boardId = 'reconcile-test-board';

    // Create a mock transaction directly through mock simulation endpoint
    const stkRes = await fetch(`${serverUrl}/api/payments/mpesa/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0712345678',
        amount: 500,
        boardId,
        userId: 'usr_reconcile',
        planType: 'export_pack',
      }),
    });
    const { CheckoutRequestID } = (await stkRes.json()) as any;

    // Simulate completion
    await fetch(`${serverUrl}/api/payments/mpesa/mock-simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkoutRequestId: CheckoutRequestID, success: true }),
    });

    // Query status via GET
    const statusRes = await fetch(`${serverUrl}/api/payments/mpesa/status/${CheckoutRequestID}`);
    expect(statusRes.status).toBe(200);
    const statusData = (await statusRes.json()) as any;

    expect(statusData.status).toBe('completed');
    expect(statusData.mpesaReceiptNumber).toMatch(/^NLX/);
    expect(statusData.ResultCode).toBe(0);
  });

  it('retrieves board transactions history via GET /api/payments/mpesa/transactions/:boardId', async () => {
    const boardId = 'history-test-board';

    await fetch(`${serverUrl}/api/payments/mpesa/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0712345678',
        amount: 150,
        boardId,
        userId: 'usr_hist_1',
        planType: 'daily_pass',
      }),
    });

    const res = await fetch(`${serverUrl}/api/payments/mpesa/transactions/${boardId}`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.boardId).toBe(boardId);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].planType).toBe('daily_pass');
  });
});

