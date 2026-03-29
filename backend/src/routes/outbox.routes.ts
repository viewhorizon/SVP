import { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { validateQuery } from '../middleware/validate';
import { withTransaction } from '../db/withTransaction';
import { dispatchOutboxBatch, readPendingOutboxEvents } from '../services/outboxService';
import { outboxDispatchQuerySchema } from '../validation/schemas';

type CreateOutboxRouterOptions = {
  pool: Pool;
};

const normalizeDbError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes('relation') && message.includes('does not exist')) {
    return `${fallback}. Ejecuta backend/sql/20260323_outbox_dispatcher.sql`;
  }
  return message;
};

export function createOutboxRouter({ pool }: CreateOutboxRouterOptions) {
  const router = Router();

  router.get('/outbox/pending', requireAuth, validateQuery(outboxDispatchQuerySchema), async (_req: AuthenticatedRequest, res) => {
    const query = res.locals.validatedQuery as { limit?: number };
    const limit = query.limit ?? 25;

    try {
      const events = await withTransaction(pool, (client) => readPendingOutboxEvents(client, limit));
      return res.json({ count: events.length, events });
    } catch (error) {
      const message = normalizeDbError(error, 'Error consultando outbox pending');
      return res.status(500).json({ error: message });
    }
  });

  router.post('/outbox/dispatch', requireAuth, validateQuery(outboxDispatchQuerySchema), async (_req: AuthenticatedRequest, res) => {
    const query = res.locals.validatedQuery as { limit?: number };
    const limit = query.limit ?? 25;

    try {
      const report = await withTransaction(pool, (client) => dispatchOutboxBatch(client, limit));
      return res.json(report);
    } catch (error) {
      const message = normalizeDbError(error, 'Error ejecutando dispatcher de outbox');
      return res.status(500).json({ error: message });
    }
  });

  return router;
}
