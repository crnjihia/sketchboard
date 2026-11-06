// path: apps/server/__tests__/mpesa-daraja.test.ts
import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import http from 'http';
import { MockMpesaClient } from '../src/integrations/mpesa/mock';
import { getMpesaClient, resetMpesaClient } from '../src/integrations/mpesa';
import { createSketchboardServer } from '../src/index';

describe('Safaricom Daraja MockMpesaClient Adapter', () => {
  let client: MockMpesaClient;

  beforeEach(() => {
    client = new MockMpesaClient();
  });

  it('initiates an STK Push and returns standard Daraja response structure', async () => {
    const res = await client.initiateStkPush({
      phone: '254712345678',
      amount: 1500,
      boardId: 'board-nairobi-01',
      userId: 'usr_chris_001',
      planType: 'team_monthly',
      accountReference: 'SKETCHBOARD',
      transactionDesc: 'WorkspacePass',
    });

    expect(res.ResponseCode).toBe('0');
    expect(res.ResponseDescription).toContain('Success');
    expect(res.MerchantRequestID).toBeDefined();
    expect(res.CheckoutRequestID).toMatch(/^ws_CO_\d{14}_[A-Z0-9]+$/);
  });

  it('queries an initiated STK Push request status', async () => {
    const initRes = await client.initiateStkPush({
      phone: '254712345678',
      amount: 150,
      boardId: 'board-nairobi-01',
      userId: 'usr_chris_001',
      planType: 'daily_pass',
      accountReference: 'SKETCHBOARD',
      transactionDesc: 'WorkspacePass',
    });

    const queryRes = await client.queryStkStatus(initRes.CheckoutRequestID);
    expect(queryRes.ResponseCode).toBe('0');
    expect(queryRes.CheckoutRequestID).toBe(initRes.CheckoutRequestID);
  });

  it('simulates a successful Daraja callback with synthetic M-Pesa receipt', async () => {
    const initRes = await client.initiateStkPush({
      phone: '254722000000',
      amount: 2500,
      boardId: 'board-nairobi-01',
      userId: 'usr_chris_001',
      planType: 'team_monthly',
      accountReference: 'SKETCHBOARD',
      transactionDesc: 'WorkspacePass',
    });

    const callback = await client.simulateCallback(initRes.CheckoutRequestID, true);
    expect(callback.success).toBe(true);
    expect(callback.resultCode).toBe(0);
    expect(callback.amount).toBe(2500);
    expect(callback.phoneNumber).toBe('254722000000');
    expect(callback.mpesaReceiptNumber).toMatch(/^NLX[A-Z0-9]{7}$/);
  });

  it('simulates a user-cancelled transaction (ResultCode 1032)', async () => {
    const initRes = await client.initiateStkPush({
      phone: '254712345678',
      amount: 500,
      boardId: 'board-nairobi-01',
      userId: 'usr_chris_001',
      planType: 'export_pack',
      accountReference: 'SKETCHBOARD',
      transactionDesc: 'WorkspacePass',
    });

    const callback = await client.simulateCallback(initRes.CheckoutRequestID, false);
    expect(callback.success).toBe(false);
    expect(callback.resultCode).toBe(1032);
    expect(callback.resultDesc).toContain('cancelled');
    expect(callback.mpesaReceiptNumber).toBeUndefined();
  });
});

describe('M-Pesa HTTP API Endpoints', () => {
  let server: http.Server;
  let serverPort: number;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_REDIS = 'false';
    process.env.ENABLE_POSTGRES = 'false';
    process.env.MPESA_MOCK = 'true';
    resetMpesaClient();

    const instance = createSketchboardServer();
    server = instance.server;

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 4000;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('POST /api/payments/mpesa/stkpush accepts valid payload and triggers STK', async () => {
    const payload = {
      phone: '0712345678',
      amount: 1500,
      boardId: 'board-demo',
      userId: 'usr_001',
      planType: 'team_monthly',
      accountReference: 'SKETCHBOARD',
      transactionDesc: 'WorkspacePass',
    };

    const res = await fetch(`${baseUrl}/api/payments/mpesa/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.ResponseCode).toBe('0');
    expect(data.CheckoutRequestID).toBeDefined();

    // Query status via GET
    const statusRes = await fetch(`${baseUrl}/api/payments/mpesa/status/${data.CheckoutRequestID}`);
    expect(statusRes.status).toBe(200);
    const statusData = (await statusRes.json()) as any;
    expect(statusData.ResponseCode).toBe('0');

    // Simulate callback via POST
    const simRes = await fetch(`${baseUrl}/api/payments/mpesa/mock-simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkoutRequestId: data.CheckoutRequestID, success: true }),
    });
    expect(simRes.status).toBe(200);
    const simData = (await simRes.json()) as any;
    expect(simData.success).toBe(true);
    expect(simData.mpesaReceiptNumber).toMatch(/^NLX/);
  });

  it('POST /api/payments/mpesa/stkpush rejects invalid non-Kenyan phone numbers', async () => {
    const payload = {
      phone: '+12025550123',
      amount: 1500,
      boardId: 'board-demo',
      userId: 'usr_001',
      planType: 'team_monthly',
    };

    const res = await fetch(`${baseUrl}/api/payments/mpesa/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(400);
    const err = (await res.json()) as any;
    expect(err.error).toBeDefined();
  });

  it('POST /api/payments/mpesa/stkpush rejects negative or excessive amounts', async () => {
    const payload = {
      phone: '0712345678',
      amount: -50,
      boardId: 'board-demo',
      userId: 'usr_001',
      planType: 'team_monthly',
    };

    const res = await fetch(`${baseUrl}/api/payments/mpesa/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(400);
  });
});

