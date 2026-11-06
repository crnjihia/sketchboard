// path: apps/web/__tests__/payments.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MpesaService } from '../src/services/mpesa-service';
import { translations, Locale } from '../src/i18n';
import { WORKSPACE_PLANS, formatKES, isValidKenyanPhone } from '@sketchboard/shared';

describe('Web Payments Client Service (MpesaService)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects invalid non-Kenyan mobile numbers before initiating network requests', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await expect(
      MpesaService.initiateStkPush({
        phone: '0812345678', // Invalid non-Kenyan prefix
        planType: 'daily_pass',
        boardId: 'nairobi-hq',
        userId: 'usr_001',
      })
    ).rejects.toThrow(/Invalid Kenyan phone number/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('initiates Lipa Na M-Pesa STK Push with normalized MSISDN and selected plan details', async () => {
    const mockResponse = {
      MerchantRequestID: '29115-1234-1',
      CheckoutRequestID: 'ws_CO_20261106112000_ABC123',
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
      CustomerMessage: 'Success. Request accepted for processing',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    global.fetch = fetchMock;

    const result = await MpesaService.initiateStkPush({
      phone: '0712345678',
      planType: 'team_monthly',
      boardId: 'nairobi-dev',
      userId: 'usr_chris',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/payments/mpesa/stkpush');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body);
    expect(body.phone).toBe('254712345678');
    expect(body.amount).toBe(2500); // KES 2,500 for team_monthly
    expect(body.planType).toBe('team_monthly');
    expect(body.boardId).toBe('nairobi-dev');
    expect(result.CheckoutRequestID).toBe('ws_CO_20261106112000_ABC123');
  });

  it('queries payment status via GET endpoint', async () => {
    const mockStatus = {
      ResponseCode: '0',
      ResponseDescription: 'The service request has been accepted successfully',
      MerchantRequestID: '29115-1234-1',
      CheckoutRequestID: 'ws_CO_123',
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      status: 'completed',
      mpesaReceiptNumber: 'NLX9XYZ456',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockStatus,
    });
    global.fetch = fetchMock;

    const res = await MpesaService.queryStatus('ws_CO_123');
    expect(fetchMock).toHaveBeenCalledWith('/api/payments/mpesa/status/ws_CO_123', expect.anything());
    expect(res.status).toBe('completed');
    expect(res.mpesaReceiptNumber).toBe('NLX9XYZ456');
  });

  it('polls status until completion and reports incremental attempts', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ResponseCode: '0',
            ResponseDescription: 'Processing',
            MerchantRequestID: 'req-1',
            CheckoutRequestID: 'ws_CO_999',
            ResultCode: 0,
            ResultDesc: 'The transaction is being processed',
            status: 'pending',
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          ResponseCode: '0',
          ResponseDescription: 'Success',
          MerchantRequestID: 'req-1',
          CheckoutRequestID: 'ws_CO_999',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          status: 'completed',
          mpesaReceiptNumber: 'NLX8REC789',
        }),
      });
    });
    global.fetch = fetchMock;

    const attempts: number[] = [];
    const finalResult = await MpesaService.pollUntilComplete('ws_CO_999', {
      intervalMs: 10,
      maxAttempts: 5,
      onAttempt: (a) => attempts.push(a),
    });

    expect(callCount).toBe(3);
    expect(attempts).toEqual([1, 2, 3]);
    expect(finalResult.mpesaReceiptNumber).toBe('NLX8REC789');
  });

  it('throws descriptive error when transaction fails or is cancelled by user', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ResponseCode: '0',
        ResponseDescription: 'Failed',
        MerchantRequestID: 'req-1',
        CheckoutRequestID: 'ws_CO_cancel',
        ResultCode: 1032,
        ResultDesc: 'Request cancelled by user',
        status: 'failed',
      }),
    });
    global.fetch = fetchMock;

    await expect(
      MpesaService.pollUntilComplete('ws_CO_cancel', { intervalMs: 10, maxAttempts: 2 })
    ).rejects.toThrow(/Request cancelled by user/i);
  });
});

describe('Bilingual English & Swahili Payment Localization Dictionaries', () => {
  const locales: Locale[] = ['en', 'sw'];

  it.each(locales)('ensures all required mpesaModal keys exist for locale "%s"', (loc) => {
    const t = translations[loc];
    expect(t.header.mpesa).toBeDefined();
    expect(typeof t.header.mpesa).toBe('string');

    const mpesa = t.mpesaModal;
    expect(mpesa).toBeDefined();
    expect(mpesa.title).toBeTruthy();
    expect(mpesa.subtitle).toBeTruthy();
    expect(mpesa.badge).toBe('LIPA NA M-PESA');
    expect(mpesa.selectPlan).toBeTruthy();
    expect(mpesa.phoneLabel).toBeTruthy();
    expect(mpesa.phonePlaceholder).toBeTruthy();
    expect(mpesa.payButton).toBeTruthy();
    expect(mpesa.promptTitle).toBeTruthy();
    expect(mpesa.promptInstruction).toBeTruthy();
    expect(mpesa.successTitle).toBeTruthy();
    expect(mpesa.receiptLabel).toBeTruthy();
    expect(mpesa.amountPaidLabel).toBeTruthy();
    expect(mpesa.doneButton).toBeTruthy();
    expect(mpesa.failedTitle).toBeTruthy();
    expect(mpesa.cbkLimitNote).toContain('300,000');
  });

  it('validates all workspace plans have both English and Swahili names and descriptions', () => {
    for (const plan of Object.values(WORKSPACE_PLANS)) {
      expect(plan.name).toBeTruthy();
      expect(plan.nameSw).toBeTruthy();
      expect(plan.description).toBeTruthy();
      expect(plan.descriptionSw).toBeTruthy();
      expect(plan.amountKes).toBeGreaterThan(0);
      expect(formatKES(plan.amountKes)).toContain('KES');
    }
  });

  it('validates common Kenyan phone input formats', () => {
    expect(isValidKenyanPhone('0712345678')).toBe(true);
    expect(isValidKenyanPhone('0110123456')).toBe(true);
    expect(isValidKenyanPhone('+254712345678')).toBe(true);
    expect(isValidKenyanPhone('+254110123456')).toBe(true);
    expect(isValidKenyanPhone('254712345678')).toBe(true);

    expect(isValidKenyanPhone('0812345678')).toBe(false);
    expect(isValidKenyanPhone('071234567')).toBe(false);
    expect(isValidKenyanPhone('+12025550123')).toBe(false);
  });
});

