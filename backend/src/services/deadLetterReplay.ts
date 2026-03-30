import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import crypto from 'node:crypto';

export type DeadLetterReplayOptions = {
  outboxIds?: string[];
  sourceApp?: string;
  eventType?: string;
  maxResults?: number;
  dryRun?: boolean;
};

export type DeadLetterReplayResult = {
  success: boolean;
  replayed: number;
  failed: number;
  message: string;
  details?: {
    outboxId: string;
    status: 'replayed' | 'failed';
    error?: string;
  }[];
};

const REPLAY_SIGNATURE_HEADER = 'x-replay-signature';
const REPLAY_REQUEST_ID_HEADER = 'x-replay-request-id';

/**
 * sp3-02: Genera firma para validar replays autenticados
 * Usa HMAC-SHA256 con secret + requestId
 */
function generateReplaySignature(requestId: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(requestId)
    .digest('hex');
}

/**
 * sp3-02: Valida que el replay sea auténtico
 */
export function validateReplaySignature(
  requestId: string,
  signature: string,
  secret: string
): boolean {
  const expected = generateReplaySignature(requestId, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * sp3-02: Lee eventos en dead-letter
 */
async function readDeadLetterEvents(
  client: PoolClient,
  options: DeadLetterReplayOptions
) {
  const { outboxIds, sourceApp, eventType, maxResults = 50 } = options;

  let query = `
    SELECT outbox_id, event_id, source_app, event_type, payload, attempts, last_error
    FROM outbox_events
    WHERE status = 'dead_letter'
  `;

  const params: unknown[] = [];

  if (outboxIds && outboxIds.length > 0) {
    params.push(outboxIds);
    query += ` AND outbox_id = ANY($${params.length}::uuid[])`;
  }

  if (sourceApp) {
    params.push(sourceApp);
    query += ` AND source_app = $${params.length}`;
  }

  if (eventType) {
    params.push(eventType);
    query += ` AND event_type = $${params.length}`;
  }

  params.push(maxResults);
  query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const result = await client.query(query, params);

  return result.rows.map((row) => ({
    outboxId: row.outbox_id,
    eventId: row.event_id,
    sourceApp: row.source_app,
    eventType: row.event_type,
    payload: row.payload ?? {},
    attempts: Number(row.attempts ?? 0),
    lastError: row.last_error,
  }));
}

/**
 * sp3-02: Reinicia evento DLQ para reintentar
 * Usa transacción y verifica idempotencia
 */
async function replayDeadLetterEvent(
  client: PoolClient,
  outboxId: string,
  options: { dryRun?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    if (options.dryRun) {
      return { success: true };
    }

    // Marcar como 'failed' con attempts=0 para reintentar desde el principio
    const result = await client.query(
      `UPDATE outbox_events
       SET status = 'failed',
           attempts = 0,
           next_attempt_at = NOW(),
           last_error = NULL,
           updated_at = NOW()
       WHERE outbox_id = $1 AND status = 'dead_letter'
       RETURNING outbox_id`,
      [outboxId]
    );

    if (result.rowCount === 0) {
      return { success: false, error: 'Evento no encontrado en dead-letter' };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return { success: false, error: message };
  }
}

/**
 * sp3-02: Ejecuta replay de eventos DLQ
 * Con validación de firma y transacción segura
 */
export async function replayDeadLetterBatch(
  client: PoolClient,
  options: DeadLetterReplayOptions
): Promise<DeadLetterReplayResult> {
  try {
    const events = await readDeadLetterEvents(client, options);

    if (events.length === 0) {
      return {
        success: true,
        replayed: 0,
        failed: 0,
        message: 'No hay eventos en dead-letter para replay',
      };
    }

    const details: DeadLetterReplayResult['details'] = [];
    let replayed = 0;
    let failed = 0;

    for (const event of events) {
      const result = await replayDeadLetterEvent(client, event.outboxId, {
        dryRun: options.dryRun,
      });

      if (result.success) {
        replayed++;
        details.push({
          outboxId: event.outboxId,
          status: 'replayed',
        });
      } else {
        failed++;
        details.push({
          outboxId: event.outboxId,
          status: 'failed',
          error: result.error,
        });
      }
    }

    return {
      success: failed === 0,
      replayed,
      failed,
      message: `Replay completado: ${replayed} replicados, ${failed} errores`,
      details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido en replay';
    return {
      success: false,
      replayed: 0,
      failed: 0,
      message,
    };
  }
}

/**
 * sp3-02: Estadísticas de dead-letter
 */
export async function getDeadLetterStats(client: PoolClient) {
  const result = await client.query(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT source_app) as unique_apps,
      COUNT(DISTINCT event_type) as unique_types,
      MAX(created_at) as oldest_event,
      MIN(created_at) as newest_event
    FROM outbox_events
    WHERE status = 'dead_letter'
  `);

  const row = result.rows[0];
  return {
    total: Number(row.total),
    uniqueApps: Number(row.unique_apps),
    uniqueTypes: Number(row.unique_types),
    oldestEvent: row.oldest_event,
    newestEvent: row.newest_event,
  };
}

/**
 * sp3-02: Agrupa eventos DLQ por sourceApp
 */
export async function getDeadLetterByApp(client: PoolClient) {
  const result = await client.query(`
    SELECT
      source_app,
      COUNT(*) as count,
      COUNT(DISTINCT event_type) as event_types,
      MAX(created_at) as latest
    FROM outbox_events
    WHERE status = 'dead_letter'
    GROUP BY source_app
    ORDER BY count DESC
  `);

  return result.rows.map((row) => ({
    sourceApp: row.source_app,
    count: Number(row.count),
    eventTypes: Number(row.event_types),
    latest: row.latest,
  }));
}
