// path: apps/server/src/integrations/africastalking/client.ts
import {
  AfricaTalkingSmsRequest,
  AfricaTalkingSmsResponse,
  AfricaTalkingSmsResponseSchema,
  formatE164Phone,
  formatKES,
} from '@sketchboard/shared';
import {
  AfricaTalkingClient,
  BoardInviteNotification,
  PaymentReceiptNotification,
} from './types';

export interface AfricaTalkingConfig {
  username: string;
  apiKey: string;
  senderId?: string;
  baseUrl?: string;
}

/**
 * Live Africa's Talking SMS API client.
 */
export class AfricaTalkingHttpClient implements AfricaTalkingClient {
  private readonly config: AfricaTalkingConfig;
  private readonly endpoint: string;

  constructor(config: AfricaTalkingConfig) {
    this.config = config;
    const isSandbox = config.username.toLowerCase() === 'sandbox';
    this.endpoint =
      config.baseUrl ||
      (isSandbox
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging');
  }

  public async sendSms(req: AfricaTalkingSmsRequest): Promise<AfricaTalkingSmsResponse> {
    const normalizedRecipients = req.to.map((phone) => formatE164Phone(phone)).join(',');

    const params = new URLSearchParams();
    params.append('username', this.config.username);
    params.append('to', normalizedRecipients);
    params.append('message', req.message);

    const sender = req.from || this.config.senderId;
    if (sender) {
      params.append('from', sender);
    }

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        apiKey: this.config.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Africa's Talking SMS dispatch failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return AfricaTalkingSmsResponseSchema.parse(data);
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
      from: this.config.senderId,
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
      from: this.config.senderId,
    });
  }
}
