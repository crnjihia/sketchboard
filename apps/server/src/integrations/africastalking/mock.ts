// path: apps/server/src/integrations/africastalking/mock.ts
import {
  AfricaTalkingSmsRequest,
  AfricaTalkingSmsResponse,
  formatE164Phone,
  formatKES,
} from '@sketchboard/shared';
import {
  AfricaTalkingClient,
  BoardInviteNotification,
  PaymentReceiptNotification,
} from './types';

export interface SentSmsRecord {
  to: string[];
  message: string;
  from?: string;
  sentAt: number;
  messageIds: string[];
}

/**
 * Zero-credential mock adapter for Africa's Talking SMS API.
 * Enables 100% test and offline execution with synthetic dispatch confirmation.
 */
export class MockAfricaTalkingClient implements AfricaTalkingClient {
  private readonly outbox: SentSmsRecord[] = [];

  public async sendSms(req: AfricaTalkingSmsRequest): Promise<AfricaTalkingSmsResponse> {
    const normalizedRecipients = req.to.map((phone) => formatE164Phone(phone));
    const messageIds: string[] = [];

    const recipientsData = normalizedRecipients.map((phone) => {
      const msgId = `ATXid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      messageIds.push(msgId);
      return {
        number: phone,
        status: 'Success',
        cost: 'KES 0.8000',
        messageId: msgId,
        statusCode: 101, // 101 = Sent successfully in Africa's Talking protocol
      };
    });

    this.outbox.push({
      to: normalizedRecipients,
      message: req.message,
      from: req.from,
      sentAt: Date.now(),
      messageIds,
    });

    const totalCost = (normalizedRecipients.length * 0.8).toFixed(4);

    return {
      SMSMessageData: {
        Message: `Sent to ${normalizedRecipients.length}/${normalizedRecipients.length} Total Cost: KES ${totalCost}`,
        Recipients: recipientsData,
      },
    };
  }

  public async sendBoardInvite(invite: BoardInviteNotification): Promise<AfricaTalkingSmsResponse> {
    const isSwahili = invite.locale === 'sw';
    const baseUrl = invite.appBaseUrl || 'https://crnjihia.github.io/sketchboard';
    const title = invite.boardTitle || invite.boardId;
    const boardUrl = `${baseUrl}?board=${invite.boardId}`;

    const message = isSwahili
      ? `Habari! Umealikwa na ${invite.inviterName} kushirikiana kwenye ubao wa Sketchboard '${title}'. Ungana moja kwa moja: ${boardUrl}`
      : `Hello! You have been invited by ${invite.inviterName} to collaborate on Sketchboard '${title}'. Join live at: ${boardUrl}`;

    return this.sendSms({
      to: [invite.recipientPhone],
      message,
      from: 'SKETCHBOARD',
    });
  }

  public async sendPaymentReceipt(receipt: PaymentReceiptNotification): Promise<AfricaTalkingSmsResponse> {
    const isSwahili = receipt.locale === 'sw';
    const formattedAmount = formatKES(receipt.amountKes);

    const message = isSwahili
      ? `Uthibitisho: Malipo yako ya ${formattedAmount} kwa ajili ya Sketchboard ${receipt.planName} (Risiti: ${receipt.mpesaReceipt}) yamefaulu. Asante!`
      : `Confirmed: Your payment of ${formattedAmount} for Sketchboard ${receipt.planName} (Receipt: ${receipt.mpesaReceipt}) was successful. Thank you!`;

    return this.sendSms({
      to: [receipt.recipientPhone],
      message,
      from: 'SKETCHBOARD',
    });
  }

  public getOutbox(): readonly SentSmsRecord[] {
    return this.outbox;
  }

  public clearOutbox(): void {
    this.outbox.length = 0;
  }
}
