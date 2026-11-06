// path: packages/shared/__tests__/payments.test.ts
import { describe, it, expect } from 'vitest';
import {
  isValidKenyanPhone,
  formatMpesaPhone,
  formatE164Phone,
  formatDisplayPhone,
  formatKES,
  KenyanPhoneSchema,
  MpesaStkPushRequestSchema,
  MpesaCallbackSchema,
  parseMpesaCallback,
  AfricaTalkingSmsRequestSchema,
  AfricaTalkingSmsResponseSchema,
  PaymentTransactionRecordSchema,
  WORKSPACE_PLANS,
} from '../src/schema/payments';

describe('Kenyan Phone Validation and Normalization', () => {
  it('correctly validates Kenyan mobile network operators (Safaricom, Airtel, Telkom)', () => {
    // Safaricom (070X, 071X, 072X, 074X, 079X, 011X)
    expect(isValidKenyanPhone('0712345678')).toBe(true);
    expect(isValidKenyanPhone('+254722000000')).toBe(true);
    expect(isValidKenyanPhone('254790112233')).toBe(true);
    expect(isValidKenyanPhone('0110123456')).toBe(true);
    expect(isValidKenyanPhone('+254110123456')).toBe(true);

    // Airtel (073X, 075X, 078X, 010X)
    expect(isValidKenyanPhone('0733123456')).toBe(true);
    expect(isValidKenyanPhone('+254780998877')).toBe(true);
    expect(isValidKenyanPhone('0100123456')).toBe(true);

    // Telkom (077X)
    expect(isValidKenyanPhone('0777123456')).toBe(true);
    expect(isValidKenyanPhone('+254777123456')).toBe(true);

    // Raw 9-digit format
    expect(isValidKenyanPhone('712345678')).toBe(true);
    expect(isValidKenyanPhone('110123456')).toBe(true);

    // Tolerant of spaces, dashes, and parentheses
    expect(isValidKenyanPhone('+254 712 345 678')).toBe(true);
    expect(isValidKenyanPhone('0712-345-678')).toBe(true);
    expect(isValidKenyanPhone('(0712) 345 678')).toBe(true);
  });

  it('rejects invalid or non-Kenyan numbers', () => {
    // Foreign international numbers
    expect(isValidKenyanPhone('+12025550123')).toBe(false); // US
    expect(isValidKenyanPhone('+447911123456')).toBe(false); // UK
    expect(isValidKenyanPhone('+2348031234567')).toBe(false); // Nigeria
    expect(isValidKenyanPhone('+256772123456')).toBe(false); // Uganda
    expect(isValidKenyanPhone('+255754123456')).toBe(false); // Tanzania

    // Kenyan landlines (020)
    expect(isValidKenyanPhone('0201234567')).toBe(false);

    // Malformed lengths and characters
    expect(isValidKenyanPhone('071234567')).toBe(false); // too short
    expect(isValidKenyanPhone('07123456789')).toBe(false); // too long
    expect(isValidKenyanPhone('071234567a')).toBe(false); // alphanumeric
    expect(isValidKenyanPhone('')).toBe(false);
  });

  it('normalizes to 12-digit M-Pesa Daraja format', () => {
    expect(formatMpesaPhone('0712345678')).toBe('254712345678');
    expect(formatMpesaPhone('+254712345678')).toBe('254712345678');
    expect(formatMpesaPhone('254712345678')).toBe('254712345678');
    expect(formatMpesaPhone('712345678')).toBe('254712345678');
    expect(formatMpesaPhone('0110123456')).toBe('254110123456');
    expect(formatMpesaPhone('+254 712-345 678')).toBe('254712345678');
  });

  it('normalizes to E.164 and localized display format', () => {
    expect(formatE164Phone('0712345678')).toBe('+254712345678');
    expect(formatDisplayPhone('254712345678')).toBe('0712 345 678');
    expect(formatDisplayPhone('0110123456')).toBe('0110 123 456');
  });

  it('transforms inputs cleanly in KenyanPhoneSchema', () => {
    const parsed = KenyanPhoneSchema.parse('0712 345 678');
    expect(parsed).toBe('254712345678');

    expect(() => KenyanPhoneSchema.parse('0800123456')).toThrow();
    expect(() => KenyanPhoneSchema.parse('+15551234567')).toThrow();
  });
});

describe('Currency and Workspace Plans', () => {
  it('formats KES currency with grouping and decimals', () => {
    expect(formatKES(150)).toBe('KES 150.00');
    expect(formatKES(1500)).toBe('KES 1,500.00');
    expect(formatKES(25000)).toBe('KES 25,000.00');
    expect(formatKES(1234567.89)).toBe('KES 1,234,567.89');
  });

  it('provides bilingual workspace plan definitions', () => {
    expect(WORKSPACE_PLANS.daily_pass.amountKes).toBe(150);
    expect(WORKSPACE_PLANS.daily_pass.nameSw).toBe('Pasi ya Siku ya Kikosi');
    expect(WORKSPACE_PLANS.team_monthly.amountKes).toBe(2500);
    expect(WORKSPACE_PLANS.enterprise_annual.amountKes).toBe(25000);
    expect(WORKSPACE_PLANS.export_pack.amountKes).toBe(500);
  });
});

describe('M-Pesa Safaricom Daraja Schemas', () => {
  it('validates a correct STK Push request payload', () => {
    const valid = {
      phone: '0712345678',
      amount: 1500,
      boardId: 'nairobi-hq',
      userId: 'usr_chris_001',
      planType: 'team_monthly',
      accountReference: 'SKETCHBOARD',
      transactionDesc: 'WorkspacePass',
    };

    const parsed = MpesaStkPushRequestSchema.parse(valid);
    expect(parsed.phone).toBe('254712345678'); // normalized
    expect(parsed.amount).toBe(1500);
  });

  it('rejects invalid amounts outside CBK limits', () => {
    const base = {
      phone: '0712345678',
      boardId: 'nairobi-hq',
      userId: 'usr_001',
      planType: 'daily_pass',
    };

    // Zero or negative
    expect(() => MpesaStkPushRequestSchema.parse({ ...base, amount: 0 })).toThrow();
    expect(() => MpesaStkPushRequestSchema.parse({ ...base, amount: -100 })).toThrow();

    // Fractional amount
    expect(() => MpesaStkPushRequestSchema.parse({ ...base, amount: 150.5 })).toThrow();

    // Over CBK STK limit (300,000 KES)
    expect(() => MpesaStkPushRequestSchema.parse({ ...base, amount: 350000 })).toThrow();
  });

  it('parses a successful Safaricom Daraja callback payload', () => {
    const rawCallback = {
      Body: {
        stkCallback: {
          MerchantRequestID: '29115-34620561-1',
          CheckoutRequestID: 'ws_CO_06112026103324123456789',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 1500.0 },
              { Name: 'MpesaReceiptNumber', Value: 'NLX8ABC123' },
              { Name: 'Balance' },
              { Name: 'TransactionDate', Value: 20261106103324 },
              { Name: 'PhoneNumber', Value: 254712345678 },
            ],
          },
        },
      },
    };

    expect(MpesaCallbackSchema.safeParse(rawCallback).success).toBe(true);

    const parsed = parseMpesaCallback(rawCallback);
    expect(parsed.success).toBe(true);
    expect(parsed.resultCode).toBe(0);
    expect(parsed.amount).toBe(1500);
    expect(parsed.mpesaReceiptNumber).toBe('NLX8ABC123');
    expect(parsed.transactionDate).toBe('20261106103324');
    expect(parsed.phoneNumber).toBe('254712345678');
  });

  it('parses a user-cancelled Safaricom Daraja callback', () => {
    const cancelledCallback = {
      Body: {
        stkCallback: {
          MerchantRequestID: '29115-34620561-2',
          CheckoutRequestID: 'ws_CO_06112026103324999999999',
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user',
        },
      },
    };

    const parsed = parseMpesaCallback(cancelledCallback);
    expect(parsed.success).toBe(false);
    expect(parsed.resultCode).toBe(1032);
    expect(parsed.resultDesc).toBe('Request cancelled by user');
    expect(parsed.mpesaReceiptNumber).toBeUndefined();
  });
});

describe('Africa Talking SMS Schemas', () => {
  it('validates SMS dispatch payloads with Kenyan recipients', () => {
    const payload = {
      to: ['0712345678', '+254110123456'],
      message: 'Habari! You have been invited to collaborate on Sketchboard ubao: nairobi-hq',
      from: 'SKETCHBOARD',
    };

    const parsed = AfricaTalkingSmsRequestSchema.parse(payload);
    expect(parsed.to).toEqual(['254712345678', '254110123456']);
  });

  it('rejects SMS requests with empty recipient lists or over-length bodies', () => {
    expect(() =>
      AfricaTalkingSmsRequestSchema.parse({
        to: [],
        message: 'Valid message',
      })
    ).toThrow();

    expect(() =>
      AfricaTalkingSmsRequestSchema.parse({
        to: ['0712345678'],
        message: 'a'.repeat(500), // Exceeds 480 chars
      })
    ).toThrow();
  });

  it('validates an Africa Talking SMS API response', () => {
    const responsePayload = {
      SMSMessageData: {
        Message: 'Sent to 1/1 Total Cost: KES 0.8000',
        Recipients: [
          {
            number: '+254712345678',
            status: 'Success',
            cost: 'KES 0.8000',
            messageId: 'ATXid_1234567890abcdef',
            statusCode: 101,
          },
        ],
      },
    };

    const parsed = AfricaTalkingSmsResponseSchema.parse(responsePayload);
    expect(parsed.SMSMessageData.Recipients[0].statusCode).toBe(101);
  });
});

describe('Payment Transaction Record Schema', () => {
  it('validates a complete persisted transaction record', () => {
    const record = {
      id: 'tx_987654321',
      boardId: 'nairobi-hq',
      userId: 'usr_chris_001',
      phoneNumber: '254712345678',
      amount: 2500,
      currency: 'KES' as const,
      planType: 'team_monthly' as const,
      merchantRequestId: '29115-34620561-1',
      checkoutRequestId: 'ws_CO_06112026103324123456789',
      mpesaReceipt: 'NLX8ABC123',
      status: 'completed' as const,
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
      createdAt: '2026-11-06T10:33:24+03:00',
      updatedAt: '2026-11-06T10:33:45+03:00',
    };

    const parsed = PaymentTransactionRecordSchema.parse(record);
    expect(parsed.currency).toBe('KES');
    expect(parsed.status).toBe('completed');
  });
});

