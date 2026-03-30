import { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { validateQuery, validateBody } from '../middleware/validate';
import { withTransaction } from '../db/withTransaction';
import {
  replayDeadLetterBatch,
  getDeadLetterStats,
  getDeadLetterByApp,
  validateReplaySignature,
} from '../services/deadLetterReplay';
import { z } from 'zod';

type CreateDeadLetterRouterOptions = {
  pool: Pool;
};

// Schemas para validación
const deadLetterStatsQuerySchema = z.object({}).strict();

const deadLetterReplayQuerySchema = z.object({
  sourceApp: z.string().optional(),
  eventType: z.string().optional(),
  maxResults: z.coerce.number().min(1).max(200).optional(),
  dryRun: z.enum(['true', 'false']).optional(),
}).strict();

const deadLetterReplayBodySchema = z.object({
  outboxIds: z.array(z.string().uuid()).optional(),
  sourceApp: z.string().optional(),
  eventType: z.string().optional(),
  maxResults: z.number().min(1).max(200).optional(),
  dryRun: z.boolean().optional(),
}).strict();

export function createDeadLetterRouter({ pool }: CreateDeadLetterRouterOptions) {
  const router = Router();

  /**
   * GET /api/v1/dead-letter/stats
   * Obtiene estadísticas de eventos en dead-letter
   */
  router.get(
    '/dead-letter/stats',
    requireAuth,
    validateQuery(deadLetterStatsQuerySchema),
    async (_req: AuthenticatedRequest, res) => {
      try {
        const stats = await withTransaction(pool, (client) =>
          getDeadLetterStats(client)
        );

        return res.json(stats);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error consultando dead-letter stats';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * GET /api/v1/dead-letter/by-app
   * Agrupa eventos dead-letter por aplicación origen
   */
  router.get(
    '/dead-letter/by-app',
    requireAuth,
    validateQuery(deadLetterStatsQuerySchema),
    async (_req: AuthenticatedRequest, res) => {
      try {
        const apps = await withTransaction(pool, (client) =>
          getDeadLetterByApp(client)
        );

        return res.json({ items: apps });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error consultando dead-letter by-app';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * POST /api/v1/dead-letter/replay
   * sp3-02: Ejecuta replay de eventos en dead-letter
   * 
   * Body:
   * {
   *   outboxIds?: string[],        // IDs específicas a replicar
   *   sourceApp?: string,          // Filtrar por app origen
   *   eventType?: string,          // Filtrar por tipo evento
   *   maxResults?: number,         // Máximo eventos a procesar
   *   dryRun?: boolean            // Simular sin ejecutar
   * }
   */
  router.post(
    '/dead-letter/replay',
    requireAuth,
    validateBody(deadLetterReplayBodySchema),
    async (_req: AuthenticatedRequest, res) => {
      const body = res.locals.validatedBody as {
        outboxIds?: string[];
        sourceApp?: string;
        eventType?: string;
        maxResults?: number;
        dryRun?: boolean;
      };

      try {
        const result = await withTransaction(pool, (client) =>
          replayDeadLetterBatch(client, {
            outboxIds: body.outboxIds,
            sourceApp: body.sourceApp,
            eventType: body.eventType,
            maxResults: body.maxResults ?? 50,
            dryRun: body.dryRun ?? false,
          })
        );

        return res.json({
          success: result.success,
          replayed: result.replayed,
          failed: result.failed,
          message: result.message,
          details: result.details,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error ejecutando dead-letter replay';
        return res.status(500).json({ error: message });
      }
    }
  );

  return router;
}
