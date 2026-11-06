// path: apps/server/src/integrations/africastalking/types.ts
import {
  AfricaTalkingSmsRequest,
  AfricaTalkingSmsResponse,
} from '@sketchboard/shared';

export interface BoardInviteNotification {
  boardId: string;
  boardTitle?: string;
  inviterName: string;
  recipientPhone: string;
  appBaseUrl?: string;
  locale?: 'en' | 'sw';
}

export interface PaymentReceiptNotification {
  recipientPhone: string;
  amountKes: number;
  planName: string;
  mpesaReceipt: string;
  locale?: 'en' | 'sw';
}

export interface AfricaTalkingClient {
  /**
   * Dispatches an SMS message payload to one or more Kenyan mobile recipients.
   */
  sendSms(req: AfricaTalkingSmsRequest): Promise<AfricaTalkingSmsResponse>;

  /**
   * Helper to dispatch an invite notification for a collaborative Sketchboard canvas.
   */
  sendBoardInvite(invite: BoardInviteNotification): Promise<AfricaTalkingSmsResponse>;

  /**
   * Helper to dispatch an instant payment confirmation receipt SMS.
   */
  sendPaymentReceipt(receipt: PaymentReceiptNotification): Promise<AfricaTalkingSmsResponse>;
}
