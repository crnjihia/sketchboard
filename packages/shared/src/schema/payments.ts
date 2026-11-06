// path: packages/shared/src/schema/payments.ts
import { z } from 'zod';

/**
 * Validates whether an input string conforms to valid Kenyan mobile phone standards
 * across Safaricom, Airtel, and Telkom networks (prefix 07XX, 01XX).
 */
export function isValidKenyanPhone(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const cleaned = input.replace(/[\s\-\(\)\.]/g, '');
  return /^(?:\+?254|0)?[17]\d{8}$/.test(cleaned);
}

/**
 * Formats any valid Kenyan phone number to the 12-digit standard required by Safaricom Daraja (2547XXXXXXXX or 2541XXXXXXXX).
 */
export function formatMpesaPhone(input: string): string {
  const cleaned = input.replace(/[\s\-\(\)\.]/g, '');
  const match = cleaned.match(/^(?:\+?254|0)?([17]\d{8})$/);
  if (!match) {
    throw new Error(
      `Invalid Kenyan phone number "${input}". Expected format: +2547XXXXXXXX, 07XXXXXXXX, or 01XXXXXXXX.`
    );
  }
  return `254${match[1]}`;
}

/**
 * Formats any valid Kenyan phone number to the international E.164 standard (+2547XXXXXXXX or +2541XXXXXXXX).
 */
export function formatE164Phone(input: string): string {
  return `+${formatMpesaPhone(input)}`;
}

/**
 * Formats a Kenyan phone number into an ergonomic localized display representation (e.g. 0712 345 678).
 */
export function formatDisplayPhone(input: string): string {
  const mpesa = formatMpesaPhone(input);
  return `0${mpesa.slice(3, 6)} ${mpesa.slice(6, 9)} ${mpesa.slice(9)}`;
}

/**
 * Formats numerical values in Kenyan Shillings (KES) with comma grouping and 2 decimal points.
 * Example: formatKES(1500) -> "KES 1,500.00"
 */
export function formatKES(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const parts = rounded.toFixed(2).split('.');
  const integerWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `KES ${integerWithCommas}.${parts[1]}`;
}

/**
 * Strict Zod Schema for Kenyan phone inputs that automatically sanitizes and normalizes to 254XXXXXXXXX.
 */
export const KenyanPhoneSchema = z.string().transform((val, ctx) => {
  const cleaned = val.replace(/[\s\-\(\)\.]/g, '');
  if (!isValidKenyanPhone(cleaned)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid Kenyan phone number. Must be a valid Safaricom/Airtel/Telkom number (+2547XX or +2541XX).',
    });
    return z.NEVER;
  }
  return formatMpesaPhone(cleaned);
});

/**
 * Available monetization tiers for team canvas collaboration and export licensing.
 */
export const WorkspacePlanTypeSchema = z.enum([
  'daily_pass',
  'team_monthly',
  'enterprise_annual',
  'export_pack',
]);

export type WorkspacePlanType = z.infer<typeof WorkspacePlanTypeSchema>;

export interface WorkspacePlanMetadata {
  id: WorkspacePlanType;
  name: string;
  nameSw: string;
  amountKes: number;
  description: string;
  descriptionSw: string;
  badge: string;
}

export const WORKSPACE_PLANS: Record<WorkspacePlanType, WorkspacePlanMetadata> = {
  daily_pass: {
    id: 'daily_pass',
    name: 'Daily Squad Pass',
    nameSw: 'Pasi ya Siku ya Kikosi',
    amountKes: 150,
    description: '24-hour unlimited real-time collaboration & board access',
    descriptionSw: 'Masaa 24 ya ushirikiano usio na kikomo na ufikiaji wa ubao',
    badge: 'KES 150 / 24h',
  },
  team_monthly: {
    id: 'team_monthly',
    name: 'Team Pro Monthly',
    nameSw: 'Timu ya Kila Mwezi',
    amountKes: 2500,
    description: 'Full team workspace, up to 10 boards, and unlimited collaborators',
    descriptionSw: 'Nafasi nzima ya timu, vibao hadi 10, na washirika wasio na kikomo',
    badge: 'KES 2,500 / mo',
  },
  enterprise_annual: {
    id: 'enterprise_annual',
    name: 'Enterprise Annual',
    nameSw: 'Shirika ya Mwaka',
    amountKes: 25000,
    description: 'Unlimited boards, dedicated Redis isolation, priority sync, and custom branding',
    descriptionSw: 'Vibao visivyo na kikomo, utengano wa Redis, na usawazishaji wa haraka',
    badge: 'KES 25,000 / yr',
  },
  export_pack: {
    id: 'export_pack',
    name: 'High-DPI Export Pack',
    nameSw: 'Kifurushi cha Uhamishaji',
    amountKes: 500,
    description: '10 High-resolution 300 DPI vector PDF & high-res PNG export credits',
    descriptionSw: 'Mikopo 10 ya uhamishaji wa picha na PDF za ubora wa juu',
    badge: 'KES 500',
  },
};

/**
 * Safaricom Daraja STK Push (Lipa Na M-Pesa Online) Request Schema.
 */
export const MpesaStkPushRequestSchema = z.object({
  phone: KenyanPhoneSchema,
  amount: z
    .number()
    .int('Amount must be a whole integer in KES')
    .min(1, 'Minimum amount is KES 1')
    .max(300000, 'Central Bank of Kenya STK Push transaction limit is KES 300,000'),
  boardId: z.string().min(1, 'boardId is required'),
  userId: z.string().min(1, 'userId is required'),
  planType: WorkspacePlanTypeSchema,
  accountReference: z.string().max(12, 'Daraja AccountReference max length is 12').default('SKETCHBOARD'),
  transactionDesc: z.string().max(13, 'Daraja TransactionDesc max length is 13').default('WorkspacePass'),
});

export type MpesaStkPushRequest = z.infer<typeof MpesaStkPushRequestSchema>;

/**
 * Safaricom Daraja STK Push Response Schema.
 */
export const MpesaStkPushResponseSchema = z.object({
  MerchantRequestID: z.string(),
  CheckoutRequestID: z.string(),
  ResponseCode: z.string(),
  ResponseDescription: z.string(),
  CustomerMessage: z.string(),
});

export type MpesaStkPushResponse = z.infer<typeof MpesaStkPushResponseSchema>;

/**
 * Safaricom Daraja STK Query Status Request Schema.
 */
export const MpesaStkQueryRequestSchema = z.object({
  checkoutRequestId: z.string().min(1),
});

export type MpesaStkQueryRequest = z.infer<typeof MpesaStkQueryRequestSchema>;

/**
 * Safaricom Daraja STK Query Response Schema.
 */
export const MpesaStkQueryResponseSchema = z.object({
  ResponseCode: z.string(),
  ResponseDescription: z.string(),
  MerchantRequestID: z.string(),
  CheckoutRequestID: z.string(),
  ResultCode: z.union([z.string(), z.number()]),
  ResultDesc: z.string(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
  mpesaReceiptNumber: z.string().optional(),
});

export type MpesaStkQueryResponse = z.infer<typeof MpesaStkQueryResponseSchema>;

/**
 * Raw item structure in Safaricom CallbackMetadata.
 */
export const MpesaCallbackItemSchema = z.object({
  Name: z.string(),
  Value: z.union([z.string(), z.number()]).optional(),
});

/**
 * Full Safaricom Daraja 2.0 Webhook Callback Payload Schema.
 */
export const MpesaCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string(),
      CallbackMetadata: z
        .object({
          Item: z.array(MpesaCallbackItemSchema),
        })
        .optional(),
    }),
  }),
});

export type MpesaCallbackPayload = z.infer<typeof MpesaCallbackSchema>;

export interface ParsedMpesaCallbackResult {
  success: boolean;
  resultCode: number;
  resultDesc: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  amount?: number;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  phoneNumber?: string;
}

/**
 * Safely parses and flattens a Daraja STK Push webhook callback into a structured result.
 */
export function parseMpesaCallback(payload: unknown): ParsedMpesaCallbackResult {
  const parsed = MpesaCallbackSchema.parse(payload);
  const cb = parsed.Body.stkCallback;
  const isSuccess = cb.ResultCode === 0;

  let amount: number | undefined;
  let mpesaReceiptNumber: string | undefined;
  let transactionDate: string | undefined;
  let phoneNumber: string | undefined;

  if (cb.CallbackMetadata?.Item) {
    for (const item of cb.CallbackMetadata.Item) {
      if (item.Name === 'Amount' && typeof item.Value === 'number') {
        amount = item.Value;
      } else if (item.Name === 'MpesaReceiptNumber' && typeof item.Value === 'string') {
        mpesaReceiptNumber = item.Value;
      } else if (item.Name === 'TransactionDate' && item.Value !== undefined) {
        transactionDate = String(item.Value);
      } else if (item.Name === 'PhoneNumber' && item.Value !== undefined) {
        phoneNumber = String(item.Value);
      }
    }
  }

  return {
    success: isSuccess,
    resultCode: cb.ResultCode,
    resultDesc: cb.ResultDesc,
    merchantRequestId: cb.MerchantRequestID,
    checkoutRequestId: cb.CheckoutRequestID,
    amount,
    mpesaReceiptNumber,
    transactionDate,
    phoneNumber,
  };
}

/**
 * Africa's Talking SMS Dispatch Request Schema.
 */
export const AfricaTalkingSmsRequestSchema = z.object({
  to: z.array(KenyanPhoneSchema).min(1, 'At least one recipient phone number is required'),
  message: z
    .string()
    .min(1, 'SMS message cannot be empty')
    .max(480, 'Maximum length is 480 characters (3 SMS segments)'),
  from: z.string().optional(),
});

export type AfricaTalkingSmsRequest = z.infer<typeof AfricaTalkingSmsRequestSchema>;

/**
 * Africa's Talking SMS API Response Schema.
 */
export const AfricaTalkingSmsRecipientSchema = z.object({
  number: z.string(),
  status: z.string(),
  cost: z.string(),
  messageId: z.string(),
  statusCode: z.number(),
});

export const AfricaTalkingSmsResponseSchema = z.object({
  SMSMessageData: z.object({
    Message: z.string(),
    Recipients: z.array(AfricaTalkingSmsRecipientSchema),
  }),
});

export type AfricaTalkingSmsResponse = z.infer<typeof AfricaTalkingSmsResponseSchema>;

/**
 * Payment Transaction Record Schema (used for persistence in PostgreSQL & Redis).
 */
export const PaymentTransactionRecordSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  userId: z.string(),
  phoneNumber: z.string(),
  amount: z.number(),
  currency: z.literal('KES'),
  planType: WorkspacePlanTypeSchema,
  merchantRequestId: z.string(),
  checkoutRequestId: z.string(),
  mpesaReceipt: z.string().nullable(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']),
  resultCode: z.number().nullable(),
  resultDesc: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PaymentTransactionRecord = z.infer<typeof PaymentTransactionRecordSchema>;

