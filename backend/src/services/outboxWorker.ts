import type { Pool } from 'pg';
import { withTransaction } from '../db/withTransaction';
import { dispatchOutboxBatch } from './outboxService';

const normalizePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value ?? '');
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

export function startOutboxWorker(pool: Pool) {
  const intervalMs = normalizePositiveInt(process.env.OUTBOX_DISPATCH_INTERVAL_MS, 0);
  const batchLimit = normalizePositiveInt(process.env.OUTBOX_DISPATCH_BATCH_LIMIT, 25);

  if (intervalMs <= 0) {
    // eslint-disable-next-line no-console
    console.info('[outbox-worker] deshabilitado (OUTBOX_DISPATCH_INTERVAL_MS=0)');
    return;
  }

  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const report = await withTransaction(pool, (client) => dispatchOutboxBatch(client, batchLimit));
      if (report.scanned > 0 || report.failed > 0 || report.deadLetter > 0) {
        // eslint-disable-next-line no-console
        console.info(
          JSON.stringify({
            level: 'info',
            scope: 'outbox-worker',
            scanned: report.scanned,
            sent: report.sent,
            failed: report.failed,
            deadLetter: report.deadLetter,
          })
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[outbox-worker] error en dispatch', error);
    } finally {
      running = false;
    }
  };

  // eslint-disable-next-line no-console
  console.info(`[outbox-worker] activo cada ${intervalMs}ms (batch=${batchLimit})`);
  void tick();
  setInterval(() => {
    void tick();
  }, intervalMs);
}
