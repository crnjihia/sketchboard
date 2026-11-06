// path: apps/server/src/integrations/mpesa/mock.ts
import {
  MpesaStkPushRequest,
  MpesaStkPushResponse,
  MpesaStkQueryResponse,
  ParsedMpesaCallbackResult,
  PaymentTransactionRecord,
} from '@sketchboard/shared';
import { MpesaClient } from './types';

interface MockTransactionState {
  request: MpesaStkPushRequest;
  merchantRequestId: string;
  checkoutRequestId: string;
  status: 'pending' | 'completed' | 'failed';
  mpesaReceipt?: string;
  resultCode: number;
  resultDesc: string;
  timestamp: string;
  createdAt: number;
}

/**
 * Zero-credential in-memory mock adapter for Safaricom Daraja STK Push.
 * Enables 100% end-to-end local and offline operation without real Safaricom credentials.
 */
export class MockMpesaClient implements MpesaClient {
  private readonly transactions = new Map<string, MockTransactionState>();

  /**
   * Generates a synthetic alphanumeric M-Pesa receipt code conforming to Safaricom's 10-character standard.
   * Example: "NLX8ABC123"
   */
  private generateSyntheticReceipt(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'NLX';
    for (let i = 0; i < 7; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Formats current timestamp as YYYYMMDDHHmmss in Africa/Nairobi timezone context.
   */
  private getTimestamp(): string {
    const now = new Date();
    // Offset +3 hours for East Africa Time (Africa/Nairobi)
    const eat = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${eat.getFullYear()}${pad(eat.getMonth() + 1)}${pad(eat.getDate())}${pad(eat.getHours())}${pad(eat.getMinutes())}${pad(eat.getSeconds())}`;
  }

  public async initiateStkPush(req: MpesaStkPushRequest): Promise<MpesaStkPushResponse> {
    const timestamp = this.getTimestamp();
    const randomSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
    const merchantRequestId = `29115-${Date.now()}-1`;
    const checkoutRequestId = `ws_CO_${timestamp}_${randomSuffix}`;

    const state: MockTransactionState = {
      request: req,
      merchantRequestId,
      checkoutRequestId,
      status: 'pending',
      resultCode: 0,
      resultDesc: 'The transaction is being processed',
      timestamp,
      createdAt: Date.now(),
    };

    this.transactions.set(checkoutRequestId, state);

    return {
      MerchantRequestID: merchantRequestId,
      CheckoutRequestID: checkoutRequestId,
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
      CustomerMessage: 'Success. Request accepted for processing',
    };
  }

  public async queryStkStatus(checkoutRequestId: string): Promise<MpesaStkQueryResponse> {
    const state = this.transactions.get(checkoutRequestId);
    if (!state) {
      return {
        ResponseCode: '1',
        ResponseDescription: 'The transaction does not exist.',
        MerchantRequestID: 'unknown',
        CheckoutRequestID: checkoutRequestId,
        ResultCode: 1,
        ResultDesc: 'The transaction does not exist.',
      };
    }

    return {
      ResponseCode: '0',
      ResponseDescription: 'The service request has been accepted successfully',
      MerchantRequestID: state.merchantRequestId,
      CheckoutRequestID: state.checkoutRequestId,
      ResultCode: state.status === 'pending' ? 0 : state.resultCode,
      ResultDesc: state.status === 'pending' ? 'The transaction is being processed' : state.resultDesc,
      status: state.status,
      mpesaReceiptNumber: state.mpesaReceipt,
    };
  }

  public async simulateCallback(
    checkoutRequestId: string,
    success: boolean = true
  ): Promise<ParsedMpesaCallbackResult> {
    const state = this.transactions.get(checkoutRequestId);
    if (!state) {
      throw new Error(`CheckoutRequestID "${checkoutRequestId}" not found in mock store.`);
    }

    if (success) {
      state.status = 'completed';
      state.resultCode = 0;
      state.resultDesc = 'The service request is processed successfully.';
      state.mpesaReceipt = this.generateSyntheticReceipt();
    } else {
      state.status = 'failed';
      state.resultCode = 1032;
      state.resultDesc = 'Request cancelled by user';
      state.mpesaReceipt = undefined;
    }

    return {
      success,
      resultCode: state.resultCode,
      resultDesc: state.resultDesc,
      merchantRequestId: state.merchantRequestId,
      checkoutRequestId: state.checkoutRequestId,
      amount: success ? state.request.amount : undefined,
      mpesaReceiptNumber: state.mpesaReceipt,
      transactionDate: state.timestamp,
      phoneNumber: state.request.phone,
    };
  }

  public getTransaction(checkoutRequestId: string): MockTransactionState | undefined {
    return this.transactions.get(checkoutRequestId);
  }

  public clear(): void {
    this.transactions.clear();
  }
}

