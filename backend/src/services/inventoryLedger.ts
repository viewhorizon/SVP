import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

export type InventoryLedgerAppendInput = {
  userId: string;
  requestId: string;
  eventType: 'PURCHASE' | 'TRANSFER' | 'TRANSFORM' | 'DESTROY' | 'ADJUSTMENT';
  entityId: string;
  deltaPoints: number;
  deltaItems: number;
  payload?: Record<string, unknown>;
};

const normalizeJson = (value: unknown): JsonLike => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => [key, normalizeJson(val)] as const);
    return Object.fromEntries(entries);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  return String(value);
};

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

const canonicalize = (value: unknown) => JSON.stringify(normalizeJson(value));

export async function appendInventoryLedgerEvent(client: PoolClient, input: InventoryLedgerAppendInput) {
  const previousResult = await client.query<{ current_hash: string }>(
    `SELECT current_hash
     FROM inventory_ledger_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.userId]
  );

  const previousHash = previousResult.rows[0]?.current_hash ?? 'GENESIS';
  const canonicalPayload = normalizeJson({
    userId: input.userId,
    requestId: input.requestId,
    eventType: input.eventType,
    entityId: input.entityId,
    deltaPoints: input.deltaPoints,
    deltaItems: input.deltaItems,
    payload: input.payload ?? {},
    previousHash,
  });
  const currentHash = sha256(JSON.stringify(canonicalPayload));

  const result = await client.query<{ ledger_event_id: string; current_hash: string; previous_hash: string }>(
    `INSERT INTO inventory_ledger_events (
       ledger_event_id,
       user_id,
       request_id,
       event_type,
       entity_type,
       entity_id,
       delta_points,
       delta_items,
       payload,
       previous_hash,
       current_hash,
       hash_version
     ) VALUES ($1,$2,$3,$4,'item',$5,$6,$7,$8::jsonb,$9,$10,'sha256-v1')
     ON CONFLICT (user_id, request_id, event_type)
     DO UPDATE SET updated_at = NOW()
     RETURNING ledger_event_id, current_hash, previous_hash`,
    [
      randomUUID(),
      input.userId,
      input.requestId,
      input.eventType,
      input.entityId,
      input.deltaPoints,
      input.deltaItems,
      JSON.stringify(input.payload ?? {}),
      previousHash,
      currentHash,
    ]
  );

  return {
    eventId: result.rows[0].ledger_event_id,
    previousHash: result.rows[0].previous_hash,
    currentHash: result.rows[0].current_hash,
  };
}

type VerifyOptions = {
  userId?: string;
  limit?: number;
};

export async function verifyInventoryLedgerIntegrity(client: PoolClient, options: VerifyOptions = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 5000, 10000));
  const result = await client.query<{
    ledger_event_id: string;
    user_id: string;
    request_id: string;
    event_type: string;
    entity_id: string;
    delta_points: string;
    delta_items: string;
    payload: Record<string, unknown>;
    previous_hash: string;
    current_hash: string;
    created_at: string;
  }>(
    `SELECT
       ledger_event_id,
       user_id,
       request_id,
       event_type,
       entity_id,
       delta_points,
       delta_items,
       payload,
       previous_hash,
       current_hash,
       created_at
     FROM inventory_ledger_events
     WHERE ($1::text IS NULL OR user_id = $1)
     ORDER BY user_id ASC, created_at ASC
     LIMIT $2`,
    [options.userId ?? null, limit]
  );

  const issues: Array<{ eventId: string; reason: string; expected?: string; actual?: string }> = [];
  const previousByUser = new Map<string, string>();

  for (const row of result.rows) {
    const expectedPrev = previousByUser.get(row.user_id) ?? 'GENESIS';
    if (row.previous_hash !== expectedPrev) {
      issues.push({
        eventId: row.ledger_event_id,
        reason: 'previous_hash_mismatch',
        expected: expectedPrev,
        actual: row.previous_hash,
      });
    }

    const canonicalPayload = normalizeJson({
      userId: row.user_id,
      requestId: row.request_id,
      eventType: row.event_type,
      entityId: row.entity_id,
      deltaPoints: Number(row.delta_points),
      deltaItems: Number(row.delta_items),
      payload: row.payload ?? {},
      previousHash: row.previous_hash,
    });
    const expectedCurrent = sha256(JSON.stringify(canonicalPayload));

    if (row.current_hash !== expectedCurrent) {
      issues.push({
        eventId: row.ledger_event_id,
        reason: 'current_hash_mismatch',
        expected: expectedCurrent,
        actual: row.current_hash,
      });
    }

    previousByUser.set(row.user_id, row.current_hash);
  }

  return {
    scanned: result.rowCount,
    valid: issues.length === 0,
    issues,
  };
}

export function signInventoryLedgerReport(payload: unknown, secret: string) {
  const canonical = canonicalize(payload);
  const signature = createHmac('sha256', secret).update(canonical).digest('hex');
  return {
    hashVersion: 'hmac-sha256-v1',
    signature,
  };
}