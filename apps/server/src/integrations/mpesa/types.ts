// path: apps/server/src/integrations/mpesa/types.ts
import {
  MpesaStkPushRequest,
  MpesaStkPushResponse,
  MpesaStkQueryResponse,
  ParsedMpesaCallbackResult,
} from '@sketchboard/shared';

export interface MpesaClient {
  /**
   * Dispatches a Safaricom Daraja STK Push prompt to the customer's mobile device.
   */
  initiateStkPush(req: MpesaStkPushRequest): Promise<MpesaStkPushResponse>;

  /**
   * Queries the live status of an initiated STK Push request by CheckoutRequestID.
   */
  queryStkStatus(checkoutRequestId: string): Promise<MpesaStkQueryResponse>;

  /**
   * Simulates a Daraja webhook callback for testing and offline development.
   */
  simulateCallback(
    checkoutRequestId: string,
    success?: boolean
  ): Promise<ParsedMpesaCallbackResult>;
}

