// path: apps/web/src/services/mpesa-service.ts
import {
  MpesaStkPushRequest,
  MpesaStkPushResponse,
  MpesaStkQueryResponse,
  WorkspacePlanType,
  WORKSPACE_PLANS,
  formatMpesaPhone,
  isValidKenyanPhone,
} from '@sketchboard/shared';

export interface InitiatePaymentParams {
  phone: string;
  planType: WorkspacePlanType;
  boardId: string;
  userId: string;
}

export interface PollOptions {
  intervalMs?: number;
  maxAttempts?: number;
  onAttempt?: (attempt: number) => void;
}

/**
 * Client service interfacing with Sketchboard's Safaricom Daraja 2.0 M-Pesa endpoints.
 */
export class MpesaService {
  private static getBaseUrl(): string {
    // In production or when behind reverse proxy, use relative paths.
    // In standalone Vite dev, proxy routes /api to the backend.
    return '';
  }

  /**
   * Initiates Lipa Na M-Pesa Online (STK Push) transaction.
   */
  public static async initiateStkPush(params: InitiatePaymentParams): Promise<MpesaStkPushResponse> {
    if (!isValidKenyanPhone(params.phone)) {
      throw new Error('Invalid Kenyan phone number. Expected 07... or 01... format.');
    }

    const plan = WORKSPACE_PLANS[params.planType];
    if (!plan) {
      throw new Error(`Invalid workspace plan type: ${params.planType}`);
    }

    const payload: MpesaStkPushRequest = {
      phone: formatMpesaPhone(params.phone),
      amount: plan.amountKes,
      boardId: params.boardId,
      userId: params.userId,
      planType: params.planType,
      accountReference: 'SKETCHBOARD',
      transactionDesc: plan.id.substring(0, 13),
    };

    const res = await fetch(`${this.getBaseUrl()}/api/payments/mpesa/stkpush`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Network request failed' }));
      throw new Error(errData.error || `STK push request failed with HTTP status ${res.status}`);
    }

    return (await res.json()) as MpesaStkPushResponse;
  }

  /**
   * Queries status of an in-flight STK Push request.
   */
  public static async queryStatus(checkoutRequestId: string): Promise<MpesaStkQueryResponse> {
    const res = await fetch(`${this.getBaseUrl()}/api/payments/mpesa/status/${encodeURIComponent(checkoutRequestId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Status query failed' }));
      throw new Error(errData.error || `Status query failed with HTTP status ${res.status}`);
    }

    return (await res.json()) as MpesaStkQueryResponse;
  }

  /**
   * Development helper to simulate customer PIN entry in mock mode.
   */
  public static async simulateCallback(checkoutRequestId: string, success: boolean = true): Promise<unknown> {
    const res = await fetch(`${this.getBaseUrl()}/api/payments/mpesa/mock-simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ checkoutRequestId, success }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Simulation failed' }));
      throw new Error(errData.error || 'Mock callback simulation failed');
    }

    return await res.json();
  }

  /**
   * Polls status of checkout request until completion, failure, or timeout.
   */
  public static async pollUntilComplete(
    checkoutRequestId: string,
    options: PollOptions = {}
  ): Promise<MpesaStkQueryResponse> {
    const intervalMs = options.intervalMs ?? 2000;
    const maxAttempts = options.maxAttempts ?? 30; // 60 seconds total

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (options.onAttempt) {
        options.onAttempt(attempt);
      }

      const status = await this.queryStatus(checkoutRequestId);

      // Check completion status
      const isCompleted =
        status.status === 'completed' ||
        Boolean(status.mpesaReceiptNumber) ||
        (Number(status.ResultCode) === 0 && !status.ResultDesc.includes('being processed'));

      if (isCompleted) {
        return status;
      }

      // Check failure status
      const isFailed =
        status.status === 'failed' ||
        (Number(status.ResultCode) !== 0 && !status.ResultDesc.includes('being processed'));

      if (isFailed) {
        throw new Error(status.ResultDesc || 'Transaction failed or was cancelled by user.');
      }

      // Wait before next poll attempt
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('STK Push verification timed out waiting for PIN entry. Please check your phone.');
  }
}

