import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

export type LedgerOperation =
  | 'VOTE_CAST'
  | 'POINTS_GRANTED'
  | 'POINTS_DEBITED'
  | 'POINTS_TRANSFERRED_IN'
  | 'POINTS_TRANSFERRED_OUT'
  | 'POINTS_CONVERTED_TO_ITEM';

type AppendEntryInput = {
  userId: string;
  requestId: string;
  eventId?: string;
  operationType: LedgerOperation;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  relatedUserId?: string;
  activityId?: string;
  metadata?: Record<string, unknown>;
};

type WalletRow = {
  user_id: string;
  available_points: string;
  lifetime_points: string;
};

export async function ensureWalletForUpdate(client: PoolClient, userId: string) {
  await client.query(
    `INSERT INTO points_wallet (user_id, available_points, lifetime_points)
     VALUES ($1, 0, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const walletRes = await client.query<WalletRow>(
    `SELECT user_id, available_points, lifetime_points
     FROM points_wallet
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );

  if (!walletRes.rowCount) {
    throw new Error('No fue posible crear o bloquear points_wallet');
  }

  return walletRes.rows[0];
}

export async function appendLedgerEntry(client: PoolClient, input: AppendEntryInput) {
  const wallet = await ensureWalletForUpdate(client, input.userId);
  const balanceBefore = Number(wallet.available_points);
  const lifetimeBefore = Number(wallet.lifetime_points);
  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amount debe ser un número positivo');
  }

  const balanceAfter =
    input.direction === 'CREDIT' ? balanceBefore + amount : balanceBefore - amount;

  if (balanceAfter < 0) {
    throw new Error('Saldo insuficiente');
  }

  const lifetimeAfter = input.direction === 'CREDIT' ? lifetimeBefore + amount : lifetimeBefore;
  const eventId = input.eventId ?? randomUUID();

  const insertResult = await client.query(
    `INSERT INTO points_ledger (
       request_id,
       event_id,
       user_id,
       direction,
       operation_type,
       amount,
       balance_before,
       balance_after,
       related_user_id,
       activity_id,
       metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (user_id, request_id, operation_type) DO NOTHING
     RETURNING ledger_id, created_at`,
    [
      input.requestId,
      eventId,
      input.userId,
      input.direction,
      input.operationType,
      amount,
      balanceBefore,
      balanceAfter,
      input.relatedUserId ?? null,
      input.activityId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );

  if (!insertResult.rowCount) {
    const existing = await client.query(
      `SELECT ledger_id, balance_after, created_at
       FROM points_ledger
       WHERE user_id = $1 AND request_id = $2 AND operation_type = $3
       LIMIT 1`,
      [input.userId, input.requestId, input.operationType]
    );

    return {
      idempotent: true,
      ledgerId: existing.rows[0]?.ledger_id,
      balanceAfter: Number(existing.rows[0]?.balance_after ?? balanceBefore),
      createdAt: existing.rows[0]?.created_at,
    };
  }

  await client.query(
    `UPDATE points_wallet
     SET available_points = $2,
         lifetime_points = $3,
         last_ledger_at = NOW()
     WHERE user_id = $1`,
    [input.userId, balanceAfter, lifetimeAfter]
  );

  return {
    idempotent: false,
    ledgerId: insertResult.rows[0].ledger_id,
    balanceAfter,
    createdAt: insertResult.rows[0].created_at,
  };
}

export async function getBalance(client: PoolClient, userId: string) {
  const result = await client.query(
    `SELECT user_id, available_points, lifetime_points, updated_at
     FROM points_wallet
     WHERE user_id = $1`,
    [userId]
  );

  if (!result.rowCount) {
    return {
      userId,
      availablePoints: 0,
      lifetimePoints: 0,
      updatedAt: null,
    };
  }

  const row = result.rows[0];
  return {
    userId: row.user_id,
    availablePoints: Number(row.available_points),
    lifetimePoints: Number(row.lifetime_points),
    updatedAt: row.updated_at,
  };
}