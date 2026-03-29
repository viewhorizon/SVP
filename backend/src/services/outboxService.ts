import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

export type OutboxEventStatus = 'pending' | 'sent' | 'failed' | 'dead_letter';

export type OutboxEvent = {
  outboxId: string;
  eventId: string;
  sourceApp: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempts: number;
  nextAttemptAt: string | null;
};

type EnqueueOutboxParams = {
  eventId: string;
  sourceApp: string;
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
};

type DeliverResult = {
  ok: boolean;
  message?: string;
};

const MAX_ATTEMPTS = 8;

const normalizeError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

export async function enqueueOutboxEvent(client: PoolClient, params: EnqueueOutboxParams) {
  const idempotencyKey = params.idempotencyKey?.trim() || `${params.sourceApp}:${params.eventId}:${params.eventType}`;

  const result = await client.query(
    `INSERT INTO outbox_events (
       outbox_id,
       event_id,
       source_app,
       event_type,
       payload,
       status,
       attempts,
       idempotency_key
     ) VALUES ($1,$2,$3,$4,$5::jsonb,'pending',0,$6)
     ON CONFLICT (idempotency_key)
     DO UPDATE SET
       payload = outbox_events.payload,
       updated_at = NOW()
     RETURNING outbox_id, event_id, source_app, event_type, payload, status, attempts, next_attempt_at`,
    [randomUUID(), params.eventId, params.sourceApp, params.eventType, JSON.stringify(params.payload), idempotencyKey]
  );

  const row = result.rows[0];
  return {
    outboxId: row.outbox_id,
    eventId: row.event_id,
    sourceApp: row.source_app,
    eventType: row.event_type,
    payload: row.payload ?? {},
    status: row.status,
    attempts: Number(row.attempts ?? 0),
    nextAttemptAt: row.next_attempt_at ?? null,
  } as OutboxEvent;
}

export async function readPendingOutboxEvents(client: PoolClient, limit = 25) {
  const result = await client.query(
    `SELECT outbox_id, event_id, source_app, event_type, payload, status, attempts, next_attempt_at
     FROM outbox_events
     WHERE status IN ('pending', 'failed')
       AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
     ORDER BY created_at ASC
     LIMIT $1`,
    [Math.max(1, Math.min(limit, 200))]
  );

  return result.rows.map((row) => ({
    outboxId: row.outbox_id,
    eventId: row.event_id,
    sourceApp: row.source_app,
    eventType: row.event_type,
    payload: row.payload ?? {},
    status: row.status,
    attempts: Number(row.attempts ?? 0),
    nextAttemptAt: row.next_attempt_at ?? null,
  })) as OutboxEvent[];
}

async function markOutboxSent(client: PoolClient, outboxId: string) {
  await client.query(
    `UPDATE outbox_events
     SET status = 'sent',
         sent_at = NOW(),
         last_error = NULL,
         updated_at = NOW()
     WHERE outbox_id = $1`,
    [outboxId]
  );
}

async function markOutboxFailed(client: PoolClient, outboxId: string, attempts: number, errorMessage: string) {
  const nextAttempts = attempts + 1;
  const goDeadLetter = nextAttempts >= MAX_ATTEMPTS;
  const backoffMinutes = Math.min(60, Math.max(1, nextAttempts * 2));

  await client.query(
    `UPDATE outbox_events
     SET status = $2,
         attempts = $3,
         last_error = $4,
         next_attempt_at = CASE WHEN $2 = 'dead_letter' THEN NULL ELSE NOW() + ($5::text || ' minutes')::interval END,
         updated_at = NOW()
     WHERE outbox_id = $1`,
    [outboxId, goDeadLetter ? 'dead_letter' : 'failed', nextAttempts, errorMessage.slice(0, 500), String(backoffMinutes)]
  );
}

async function defaultDeliver(event: OutboxEvent): Promise<DeliverResult> {
  const sinkUrl = String(process.env.OUTBOX_DISPATCH_URL ?? '').trim();
  if (!sinkUrl) {
    return { ok: true, message: 'OUTBOX_DISPATCH_URL no configurado; evento marcado como enviado en modo local' };
  }

  const response = await fetch(sinkUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-event-id': event.eventId,
      'x-source-app': event.sourceApp,
      'x-event-type': event.eventType,
    },
    body: JSON.stringify(event.payload),
  });

  if (!response.ok) {
    return { ok: false, message: `Dispatch ${response.status}: ${response.statusText}` };
  }

  return { ok: true };
}

export async function dispatchOutboxBatch(
  client: PoolClient,
  limit = 25,
  deliver: (event: OutboxEvent) => Promise<DeliverResult> = defaultDeliver
) {
  const pending = await readPendingOutboxEvents(client, limit);
  let sent = 0;
  let failed = 0;
  let deadLetter = 0;

  for (const event of pending) {
    try {
      const result = await deliver(event);
      if (result.ok) {
        await markOutboxSent(client, event.outboxId);
        sent += 1;
      } else {
        await markOutboxFailed(client, event.outboxId, event.attempts, result.message ?? 'Error de dispatch');
        if (event.attempts + 1 >= MAX_ATTEMPTS) deadLetter += 1;
        else failed += 1;
      }
    } catch (error) {
      await markOutboxFailed(client, event.outboxId, event.attempts, normalizeError(error, 'Error no controlado en dispatch'));
      if (event.attempts + 1 >= MAX_ATTEMPTS) deadLetter += 1;
      else failed += 1;
    }
  }

  return {
    scanned: pending.length,
    sent,
    failed,
    deadLetter,
  };
}
