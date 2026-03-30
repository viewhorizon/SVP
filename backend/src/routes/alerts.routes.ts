import { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { validateQuery } from '../middleware/validate';
import { withTransaction } from '../db/withTransaction';
import { generateOperationalAlerts, persistAlert } from '../services/operationalAlerts';
import { z } from 'zod';

type CreateAlertsRouterOptions = {
  pool: Pool;
};

const alertsQuerySchema = z.object({
  level: z.enum(['critical', 'warning', 'info']).optional(),
  type: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
}).strict();

export function createAlertsRouter({ pool }: CreateAlertsRouterOptions) {
  const router = Router();

  /**
   * POST /api/v1/alerts/check
   * sp3-03: Ejecuta diagnóstico de alertas operativas
   * 
   * Verifica:
   * - Backlog envejecido en outbox
   * - Fallos consecutivos por aplicación
   * - Acumulación de eventos en dead-letter
   */
  router.post(
    '/alerts/check',
    requireAuth,
    async (_req: AuthenticatedRequest, res) => {
      try {
        const alerts = await withTransaction(pool, (client) =>
          generateOperationalAlerts(client, {
            backlogAgeMinutes: { critical: 30, warning: 10 },
            failureThreshold: 5,
            deadLetterThresholds: { warning: 10, critical: 50 },
          })
        );

        // Persistir alertas críticas
        for (const alert of alerts) {
          if (alert.level === 'critical') {
            await withTransaction(pool, (client) =>
              persistAlert(client, alert)
            );
          }
        }

        const critical = alerts.filter((a) => a.level === 'critical');
        const warnings = alerts.filter((a) => a.level === 'warning');

        return res.json({
          health: critical.length > 0 ? 'critical' : warnings.length > 0 ? 'degraded' : 'healthy',
          totalAlerts: alerts.length,
          critical: critical.length,
          warnings: warnings.length,
          alerts: alerts.slice(0, 50),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error checking alerts';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * GET /api/v1/alerts/history
   * Obtiene historial de alertas persitidas
   */
  router.get(
    '/alerts/history',
    requireAuth,
    validateQuery(alertsQuerySchema),
    async (_req: AuthenticatedRequest, res) => {
      const query = res.locals.validatedQuery as {
        level?: string;
        type?: string;
        limit?: number;
      };

      try {
        let sqlQuery = 'SELECT * FROM operational_alerts WHERE 1=1';
        const params: unknown[] = [];

        if (query.level) {
          params.push(query.level);
          sqlQuery += ` AND level = $${params.length}`;
        }

        if (query.type) {
          params.push(query.type);
          sqlQuery += ` AND type = $${params.length}`;
        }

        params.push(query.limit ?? 100);
        sqlQuery += ` ORDER BY created_at DESC LIMIT $${params.length}`;

        const result = await pool.query(sqlQuery, params);

        return res.json({
          count: result.rowCount,
          alerts: result.rows.map((row) => ({
            alertId: row.alert_id,
            level: row.level,
            type: row.type,
            title: row.title,
            description: row.description,
            metadata: row.metadata,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error fetching alert history';
        return res.status(500).json({ error: message });
      }
    }
  );

  return router;
}
