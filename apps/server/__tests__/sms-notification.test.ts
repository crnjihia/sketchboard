// path: apps/server/__tests__/sms-notification.test.ts
import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import http from 'http';
import { MockAfricaTalkingClient } from '../src/integrations/africastalking/mock';
import {
  getAfricaTalkingClient,
  resetAfricaTalkingClient,
} from '../src/integrations/africastalking';
import { createSketchboardServer } from '../src/index';

describe('Africa Talking MockAfricaTalkingClient Adapter', () => {
  let client: MockAfricaTalkingClient;

  beforeEach(() => {
    client = new MockAfricaTalkingClient();
  });

  it('dispatches SMS to Kenyan mobile numbers with normalized E.164 format and synthetic cost', async () => {
    const res = await client.sendSms({
      to: ['0712345678', '+254110123456'],
      message: 'Habari kutoka Sketchboard Nairobi!',
      from: 'SKETCHBOARD',
    });

    expect(res.SMSMessageData.Recipients).toHaveLength(2);
    expect(res.SMSMessageData.Recipients[0].number).toBe('+254712345678');
    expect(res.SMSMessageData.Recipients[1].number).toBe('+254110123456');
    expect(res.SMSMessageData.Recipients[0].statusCode).toBe(101);
    expect(res.SMSMessageData.Recipients[0].cost).toBe('KES 0.8000');
    expect(res.SMSMessageData.Message).toContain('KES 1.6000');

    // Verify in-memory outbox
    const outbox = client.getOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toEqual(['+254712345678', '+254110123456']);
  });

  it('generates bilingual board invite SMS messages (English and Swahili)', async () => {
    // English invite
    const enRes = await client.sendBoardInvite({
      boardId: 'nairobi-hq',
      boardTitle: 'FinTech Architecture 2026',
      inviterName: 'Chris Njihia',
      recipientPhone: '0712345678',
      locale: 'en',
    });

    expect(enRes.SMSMessageData.Recipients[0].status).toBe('Success');
    const enOutbox = client.getOutbox();
    expect(enOutbox[0].message).toContain('You have been invited by Chris Njihia');
    expect(enOutbox[0].message).toContain('FinTech Architecture 2026');

    // Swahili invite
    await client.sendBoardInvite({
      boardId: 'nairobi-hq',
      boardTitle: 'FinTech Architecture 2026',
      inviterName: 'Chris Njihia',
      recipientPhone: '0722000000',
      locale: 'sw',
    });

    const swOutbox = client.getOutbox();
    expect(swOutbox[1].message).toContain('Umealikwa na Chris Njihia');
    expect(swOutbox[1].message).toContain('ubao wa Sketchboard');
  });

  it('generates payment confirmation receipt notifications', async () => {
    await client.sendPaymentReceipt({
      recipientPhone: '0712345678',
      amountKes: 2500,
      planName: 'Team Pro Monthly',
      mpesaReceipt: 'NLX8ABC123',
      locale: 'sw',
    });

    const outbox = client.getOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].message).toContain('KES 2,500.00');
    expect(outbox[0].message).toContain('NLX8ABC123');
    expect(outbox[0].message).toContain('Uthibitisho: Malipo yako ya KES 2,500.00');
  });
});

describe('Africa Talking HTTP API Endpoints', () => {
  let server: http.Server;
  let serverPort: number;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_REDIS = 'false';
    process.env.ENABLE_POSTGRES = 'false';
    process.env.AFRICASTALKING_MOCK = 'true';
    resetAfricaTalkingClient();

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

  it('POST /api/notifications/sms/send dispatches an SMS via Africa Talking client', async () => {
    const payload = {
      to: ['0712345678'],
      message: 'Test message for Sketchboard collaborator',
      from: 'SKETCHBOARD',
    };

    const res = await fetch(`${baseUrl}/api/notifications/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.SMSMessageData.Recipients).toHaveLength(1);
    expect(data.SMSMessageData.Recipients[0].statusCode).toBe(101);

    // Query outbox
    const outboxRes = await fetch(`${baseUrl}/api/notifications/sms/outbox`);
    expect(outboxRes.status).toBe(200);
    const outboxData = (await outboxRes.json()) as any;
    expect(outboxData.outbox.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/notifications/sms/invite sends a collaborator invite link', async () => {
    const payload = {
      boardId: 'nairobi-hq',
      boardTitle: 'Design System Sprint',
      inviterName: 'Chris',
      recipientPhone: '0712345678',
      locale: 'sw',
    };

    const res = await fetch(`${baseUrl}/api/notifications/sms/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.SMSMessageData.Recipients[0].status).toBe('Success');
  });

  it('POST /api/notifications/sms/send rejects non-Kenyan phone numbers', async () => {
    const payload = {
      to: ['+447911123456'],
      message: 'Invalid recipient test',
    };

    const res = await fetch(`${baseUrl}/api/notifications/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(400);
  });
});

