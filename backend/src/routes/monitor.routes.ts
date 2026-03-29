import { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { validateQuery } from '../middleware/validate';
import { transactionsMonitorQuerySchema } from '../validation/schemas';

type CreateMonitorRouterOptions = {
  pool: Pool;
};

export function createMonitorRouter({ pool }: CreateMonitorRouterOptions) {
  const router = Router();

  const fetchTransactions = async (query: {
    userId?: string;
    status?: string;
    transactionType?: string;
    limit?: number;
  }) => {
    const result = await pool.query(
      `SELECT
         transaction_id,
         user_id,
         transaction_type,
         origin_system,
         target_system,
         status,
         amount_in,
         amount_out,
         unit_in,
         unit_out,
         saga_step,
         created_at,
         completed_at,
         metadata
       FROM cross_system_transactions
       WHERE ($1::uuid IS NULL OR user_id = $1)
         AND ($2::text IS NULL OR status = $2)
         AND ($3::text IS NULL OR transaction_type = $3)
       ORDER BY created_at DESC
       LIMIT $4`,
      [query.userId ?? null, query.status ?? null, query.transactionType ?? null, query.limit ?? 100]
    );

    return {
      total: result.rowCount,
      items: result.rows.map((row) => ({
        transactionId: row.transaction_id,
        userId: row.user_id,
        transactionType: row.transaction_type,
        originSystem: row.origin_system,
        targetSystem: row.target_system,
        status: row.status,
        amountIn: Number(row.amount_in),
        amountOut: Number(row.amount_out),
        unitIn: row.unit_in,
        unitOut: row.unit_out,
        sagaStep: row.saga_step,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        metadata: row.metadata ?? {},
      })),
    };
  };

  router.get('/monitor/transactions', requireAuth, validateQuery(transactionsMonitorQuerySchema), async (_req: AuthenticatedRequest, res) => {
    const query = res.locals.validatedQuery as {
      userId?: string;
      status?: string;
      transactionType?: string;
      limit?: number;
    };

    try {
      const data = await fetchTransactions(query);
      return res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error consultando monitor transaccional';
      return res.status(500).json({ error: message });
    }
  });

  router.get('/monitor/transactions/stream', requireAuth, validateQuery(transactionsMonitorQuerySchema), async (_req: AuthenticatedRequest, res) => {
    const query = res.locals.validatedQuery as {
      userId?: string;
      status?: string;
      transactionType?: string;
      limit?: number;
      intervalMs?: number;
    };

    const intervalMs = query.intervalMs ?? 4000;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let active = true;

    const writeSnapshot = async () => {
      if (!active) return;
      try {
        const data = await fetchTransactions(query);
        res.write(`event: snapshot\n`);
        res.write(`data: ${JSON.stringify({ at: new Date().toISOString(), ...data })}\n\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error stream monitor';
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      }
    };

    await writeSnapshot();
    const timer = setInterval(writeSnapshot, intervalMs);

    _req.on('close', () => {
      active = false;
      clearInterval(timer);
      res.end();
    });
  });

  return router;
}
