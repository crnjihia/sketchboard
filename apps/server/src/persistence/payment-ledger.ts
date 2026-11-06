// path: apps/server/src/persistence/payment-ledger.ts
import pg from 'pg';
import {
  PaymentTransactionRecord,
  WorkspacePlanType,
  ParsedMpesaCallbackResult,
} from '@sketchboard/shared';
import { config } from '../config';

const { Pool } = pg;

export interface BoardPlanInfo {
  boardId: string;
  planTier: WorkspacePlanType | 'free';
  expiresAt: number | null;
  isActive: boolean;
}

export interface IPaymentLedger {
  init(): Promise<void>;
  createPendingTransaction(params: {
    merchantRequestId: string;
    checkoutRequestId: string;
    boardId: string;
    userId: string;
    phoneNumber: string;
    amountKes: number;
    planType: WorkspacePlanType;
  }): Promise<PaymentTransactionRecord>;
  getTransactionByCheckoutId(checkoutRequestId: string): Promise<PaymentTransactionRecord | null>;
  getTransactionsByBoardId(boardId: string): Promise<PaymentTransactionRecord[]>;
  applyCallbackResult(result: ParsedMpesaCallbackResult): Promise<PaymentTransactionRecord | null>;
  getBoardPlan(boardId: string): Promise<BoardPlanInfo>;
  close(): Promise<void>;
  clearInMemory(): void;
}

export class PostgresPaymentLedger implements IPaymentLedger {
  private pool: pg.Pool | null = null;
  private readonly inMemoryTransactions = new Map<string, PaymentTransactionRecord>();
  private readonly inMemoryBoardPlans = new Map<string, { planTier: WorkspacePlanType; expiresAt: number }>();
  private useFallback = false;

  constructor() {
    if (config.enablePostgres) {
      this.pool = new Pool({
        connectionString: config.postgresUrl,
        connectionTimeoutMillis: 3000,
      });
    } else {
      this.useFallback = true;
    }
  }

  public async init(): Promise<void> {
    if (this.useFallback || !this.pool) return;

    try {
      const client = await this.pool.connect();
      try {
        // Create transactions ledger table
        await client.query(`
          CREATE TABLE IF NOT EXISTS mpesa_transactions (
            id VARCHAR(255) PRIMARY KEY,
            board_id VARCHAR(255) NOT NULL,
            user_id VARCHAR(255) NOT NULL,
            phone_number VARCHAR(20) NOT NULL,
            amount INT NOT NULL,
            currency VARCHAR(10) DEFAULT 'KES',
            plan_type VARCHAR(50) NOT NULL,
            merchant_request_id VARCHAR(255) NOT NULL,
            checkout_request_id VARCHAR(255) NOT NULL UNIQUE,
            mpesa_receipt VARCHAR(50),
            status VARCHAR(20) NOT NULL,
            result_code INT,
            result_desc TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Enhance boards table with plan metadata
        await client.query(`
          ALTER TABLE boards ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50) DEFAULT 'free';
          ALTER TABLE boards ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;
        `);
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[PaymentLedger] Postgres unavailable, switching to in-memory fallback:', err?.message);
      this.useFallback = true;
    }
  }

  public async createPendingTransaction(params: {
    merchantRequestId: string;
    checkoutRequestId: string;
    boardId: string;
    userId: string;
    phoneNumber: string;
    amountKes: number;
    planType: WorkspacePlanType;
  }): Promise<PaymentTransactionRecord> {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    const record: PaymentTransactionRecord = {
      id,
      boardId: params.boardId,
      userId: params.userId,
      phoneNumber: params.phoneNumber,
      amount: params.amountKes,
      currency: 'KES',
      planType: params.planType,
      merchantRequestId: params.merchantRequestId,
      checkoutRequestId: params.checkoutRequestId,
      mpesaReceipt: null,
      status: 'pending',
      resultCode: null,
      resultDesc: 'Pending customer PIN authorization',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.inMemoryTransactions.set(params.checkoutRequestId, record);

    if (!this.useFallback && this.pool) {
      try {
        await this.pool.query(
          `
          INSERT INTO mpesa_transactions (
            id, board_id, user_id, phone_number, amount, currency,
            plan_type, merchant_request_id, checkout_request_id,
            status, result_desc, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (checkout_request_id) DO NOTHING
          `,
          [
            record.id,
            record.boardId,
            record.userId,
            record.phoneNumber,
            record.amount,
            record.currency,
            record.planType,
            record.merchantRequestId,
            record.checkoutRequestId,
            record.status,
            record.resultDesc,
          ]
        );
      } catch (err) {
        console.error('[PaymentLedger] Error inserting transaction to PostgreSQL:', err);
      }
    }

    return record;
  }

  public async getTransactionByCheckoutId(checkoutRequestId: string): Promise<PaymentTransactionRecord | null> {
    if (!this.useFallback && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT * FROM mpesa_transactions WHERE checkout_request_id = $1 LIMIT 1`,
          [checkoutRequestId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            boardId: row.board_id,
            userId: row.user_id,
            phoneNumber: row.phone_number,
            amount: row.amount,
            currency: 'KES',
            planType: row.plan_type as WorkspacePlanType,
            merchantRequestId: row.merchant_request_id,
            checkoutRequestId: row.checkout_request_id,
            mpesaReceipt: row.mpesa_receipt,
            status: row.status,
            resultCode: row.result_code,
            resultDesc: row.result_desc,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString(),
          };
        }
      } catch (err) {
        console.error('[PaymentLedger] Error reading from PostgreSQL:', err);
      }
    }

    return this.inMemoryTransactions.get(checkoutRequestId) ?? null;
  }

  public async getTransactionsByBoardId(boardId: string): Promise<PaymentTransactionRecord[]> {
    if (!this.useFallback && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT * FROM mpesa_transactions WHERE board_id = $1 ORDER BY created_at DESC`,
          [boardId]
        );
        return res.rows.map((row) => ({
          id: row.id,
          boardId: row.board_id,
          userId: row.user_id,
          phoneNumber: row.phone_number,
          amount: row.amount,
          currency: 'KES',
          planType: row.plan_type as WorkspacePlanType,
          merchantRequestId: row.merchant_request_id,
          checkoutRequestId: row.checkout_request_id,
          mpesaReceipt: row.mpesa_receipt,
          status: row.status,
          resultCode: row.result_code,
          resultDesc: row.result_desc,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        }));
      } catch (err) {
        console.error('[PaymentLedger] Error querying transactions by boardId:', err);
      }
    }

    const all = Array.from(this.inMemoryTransactions.values());
    return all.filter((t) => t.boardId === boardId);
  }

  public async applyCallbackResult(result: ParsedMpesaCallbackResult): Promise<PaymentTransactionRecord | null> {
    const existing = await this.getTransactionByCheckoutId(result.checkoutRequestId);
    const nowIso = new Date().toISOString();

    const status = result.success ? 'completed' : 'failed';
    const mpesaReceipt = result.mpesaReceiptNumber || null;
    const resultCode = result.resultCode;
    const resultDesc = result.resultDesc;

    let updatedRecord: PaymentTransactionRecord;

    if (existing) {
      updatedRecord = {
        ...existing,
        status,
        mpesaReceipt,
        resultCode,
        resultDesc,
        updatedAt: nowIso,
      };
    } else {
      updatedRecord = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        boardId: 'nairobi-hq',
        userId: 'usr_callback',
        phoneNumber: result.phoneNumber || '254700000000',
        amount: result.amount || 0,
        currency: 'KES',
        planType: 'daily_pass',
        merchantRequestId: result.merchantRequestId,
        checkoutRequestId: result.checkoutRequestId,
        mpesaReceipt,
        status,
        resultCode,
        resultDesc,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    this.inMemoryTransactions.set(result.checkoutRequestId, updatedRecord);

    // If successful, calculate plan duration and upgrade board
    if (result.success) {
      const planDurationMs = this.calculatePlanDuration(updatedRecord.planType);
      const expiresAt = Date.now() + planDurationMs;

      this.inMemoryBoardPlans.set(updatedRecord.boardId, {
        planTier: updatedRecord.planType,
        expiresAt,
      });

      if (!this.useFallback && this.pool) {
        try {
          const expiresDate = new Date(expiresAt);
          await this.pool.query(
            `
            INSERT INTO boards (id, name, plan_tier, plan_expires_at, updated_at)
            VALUES ($1, 'Board ' || $1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
              plan_tier = EXCLUDED.plan_tier,
              plan_expires_at = EXCLUDED.plan_expires_at,
              updated_at = CURRENT_TIMESTAMP
            `,
            [updatedRecord.boardId, updatedRecord.planType, expiresDate]
          );
        } catch (err) {
          console.error('[PaymentLedger] Error updating board plan in PostgreSQL:', err);
        }
      }
    }

    if (!this.useFallback && this.pool) {
      try {
        await this.pool.query(
          `
          UPDATE mpesa_transactions
          SET status = $1, mpesa_receipt = $2, result_code = $3, result_desc = $4, updated_at = CURRENT_TIMESTAMP
          WHERE checkout_request_id = $5
          `,
          [status, mpesaReceipt, resultCode, resultDesc, result.checkoutRequestId]
        );
      } catch (err) {
        console.error('[PaymentLedger] Error updating transaction in PostgreSQL:', err);
      }
    }

    return updatedRecord;
  }

  public async getBoardPlan(boardId: string): Promise<BoardPlanInfo> {
    if (!this.useFallback && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT plan_tier, plan_expires_at FROM boards WHERE id = $1 LIMIT 1`,
          [boardId]
        );
        if (res.rows.length > 0 && res.rows[0].plan_tier) {
          const row = res.rows[0];
          const expiresAt = row.plan_expires_at ? new Date(row.plan_expires_at).getTime() : null;
          const isActive = expiresAt ? expiresAt > Date.now() : row.plan_tier !== 'free';
          return {
            boardId,
            planTier: row.plan_tier as WorkspacePlanType | 'free',
            expiresAt,
            isActive,
          };
        }
      } catch (err) {
        console.error('[PaymentLedger] Error reading board plan from PostgreSQL:', err);
      }
    }

    const inMem = this.inMemoryBoardPlans.get(boardId);
    if (inMem) {
      return {
        boardId,
        planTier: inMem.planTier,
        expiresAt: inMem.expiresAt,
        isActive: inMem.expiresAt > Date.now(),
      };
    }

    return {
      boardId,
      planTier: 'free',
      expiresAt: null,
      isActive: false,
    };
  }

  private calculatePlanDuration(plan: WorkspacePlanType): number {
    switch (plan) {
      case 'daily_pass':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'team_monthly':
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      case 'enterprise_annual':
        return 365 * 24 * 60 * 60 * 1000; // 365 days
      case 'export_pack':
        return 90 * 24 * 60 * 60 * 1000; // 90 days credits validity
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  public clearInMemory(): void {
    this.inMemoryTransactions.clear();
    this.inMemoryBoardPlans.clear();
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
    this.clearInMemory();
  }
}

export const paymentLedger: IPaymentLedger = new PostgresPaymentLedger();

