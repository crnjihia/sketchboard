// path: apps/server/src/integrations/mpesa/client.ts
import {
  MpesaStkPushRequest,
  MpesaStkPushResponse,
  MpesaStkPushResponseSchema,
  MpesaStkQueryResponse,
  MpesaStkQueryResponseSchema,
  ParsedMpesaCallbackResult,
} from '@sketchboard/shared';
import { MpesaClient } from './types';

export interface DarajaConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
  baseUrl?: string;
}

/**
 * Live Safaricom Daraja 2.0 API Sandbox Client.
 */
export class DarajaMpesaClient implements MpesaClient {
  private readonly config: DarajaConfig;
  private readonly baseUrl: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: DarajaConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://sandbox.safaricom.co.ke';
  }

  private getTimestamp(): string {
    const now = new Date();
    const eat = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${eat.getFullYear()}${pad(eat.getMonth() + 1)}${pad(eat.getDate())}${pad(eat.getHours())}${pad(eat.getMinutes())}${pad(eat.getSeconds())}`;
  }

  private generatePassword(timestamp: string): string {
    const raw = `${this.config.shortcode}${this.config.passkey}${timestamp}`;
    return Buffer.from(raw).toString('base64');
  }

  /**
   * Retrieves an OAuth 2.0 bearer access token from Safaricom Daraja.
   */
  public async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    const authHeader = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`
    ).toString('base64');

    const res = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Daraja OAuth token request failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: string };
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = now + parseInt(data.expires_in, 10) * 1000;

    return this.cachedToken;
  }

  public async initiateStkPush(req: MpesaStkPushRequest): Promise<MpesaStkPushResponse> {
    const token = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = this.generatePassword(timestamp);

    const payload = {
      BusinessShortCode: this.config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: req.amount,
      PartyA: req.phone,
      PartyB: this.config.shortcode,
      PhoneNumber: req.phone,
      CallBackURL: this.config.callbackUrl,
      AccountReference: req.accountReference || 'SKETCHBOARD',
      TransactionDesc: req.transactionDesc || 'WorkspacePass',
    };

    const res = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Daraja STK Push failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return MpesaStkPushResponseSchema.parse(data);
  }

  public async queryStkStatus(checkoutRequestId: string): Promise<MpesaStkQueryResponse> {
    const token = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = this.generatePassword(timestamp);

    const payload = {
      BusinessShortCode: this.config.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    const res = await fetch(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Daraja STK Query failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return MpesaStkQueryResponseSchema.parse(data);
  }

  public async simulateCallback(
    checkoutRequestId: string,
    success: boolean = true
  ): Promise<ParsedMpesaCallbackResult> {
    throw new Error(
      'simulateCallback is only supported on the MockMpesaClient adapter.'
    );
  }
}

