import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { validateBody } from '../middleware/validate';
import { runLoadTestSuite, VoteLoadTester, EventLoadTester } from '../services/loadTestSuite';
import { z } from 'zod';

const runLoadTestBodySchema = z.object({
  baseUrl: z.string().url(),
  scenarios: z.array(z.enum(['normal', 'peak', 'burst', 'degraded', 'recovery'])).optional(),
  verbose: z.boolean().optional(),
}).strict();

export function createLoadTestRouter() {
  const router = Router();

  /**
   * POST /api/v1/load-test/run
   * sp3-05: Ejecuta suite completa de pruebas de carga
   * 
   * Simula:
   * - Tráfico normal (10 RPS)
   * - Picos (50 RPS)
   * - Ráfagas (100 RPS)
   */
  router.post(
    '/load-test/run',
    requireAuth,
    validateBody(runLoadTestBodySchema),
    async (_req: AuthenticatedRequest, res) => {
      const body = res.locals.validatedBody as {
        baseUrl: string;
        scenarios?: string[];
        verbose?: boolean;
      };

      try {
        const authToken = _req.headers.authorization?.replace('Bearer ', '') || '';

        const results = await runLoadTestSuite(body.baseUrl, authToken, {
          scenarios: body.scenarios as any,
          verbose: body.verbose ?? false,
        });

        // Calcular resumen
        const avgThroughput =
          results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
        const avgLatency =
          results.reduce((sum, r) => sum + r.avgResponseTime, 0) /
          results.length;
        const totalSuccessful = results.reduce(
          (sum, r) => sum + r.successfulRequests,
          0
        );
        const totalFailed = results.reduce(
          (sum, r) => sum + r.failedRequests,
          0
        );

        return res.json({
          summary: {
            totalRequests: totalSuccessful + totalFailed,
            successfulRequests: totalSuccessful,
            failedRequests: totalFailed,
            successRate:
              totalSuccessful / (totalSuccessful + totalFailed) || 0,
            avgThroughput: Math.round(avgThroughput * 100) / 100,
            avgLatency: Math.round(avgLatency * 100) / 100,
          },
          results,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error running load test';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * POST /api/v1/load-test/votes
   * sp3-05: Prueba específica de carga para votos
   */
  router.post(
    '/load-test/votes',
    requireAuth,
    validateBody(
      z.object({
        rps: z.number().min(1).max(500).optional(),
        durationSeconds: z.number().min(5).max(300).optional(),
        workers: z.number().min(1).max(50).optional(),
      }).strict()
    ),
    async (_req: AuthenticatedRequest, res) => {
      const body = res.locals.validatedBody as {
        rps?: number;
        durationSeconds?: number;
        workers?: number;
      };

      try {
        const baseUrl = new URL(_req.protocol + '://' + _req.get('host')).toString();
        const authToken = _req.headers.authorization?.replace('Bearer ', '') || '';

        const tester = new VoteLoadTester();
        const result = await tester.runScenario(baseUrl, {
          rpsTarget: body.rps ?? 10,
          durationSeconds: body.durationSeconds ?? 20,
          parallelWorkers: body.workers ?? 2,
          scenario: 'custom',
          timestamp: new Date().toISOString(),
        }, authToken);

        return res.json(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error running vote load test';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * POST /api/v1/load-test/events
   * sp3-05: Prueba específica de carga para eventos
   */
  router.post(
    '/load-test/events',
    requireAuth,
    validateBody(
      z.object({
        rps: z.number().min(1).max(500).optional(),
        durationSeconds: z.number().min(5).max(300).optional(),
        workers: z.number().min(1).max(50).optional(),
      }).strict()
    ),
    async (_req: AuthenticatedRequest, res) => {
      const body = res.locals.validatedBody as {
        rps?: number;
        durationSeconds?: number;
        workers?: number;
      };

      try {
        const baseUrl = new URL(_req.protocol + '://' + _req.get('host')).toString();
        const authToken = _req.headers.authorization?.replace('Bearer ', '') || '';

        const tester = new EventLoadTester();
        const result = await tester.runScenario(baseUrl, {
          rpsTarget: body.rps ?? 10,
          durationSeconds: body.durationSeconds ?? 20,
          parallelWorkers: body.workers ?? 2,
          scenario: 'custom',
          timestamp: new Date().toISOString(),
        }, authToken);

        return res.json(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error running event load test';
        return res.status(500).json({ error: message });
      }
    }
  );

  return router;
}
