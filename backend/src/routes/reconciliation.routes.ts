import { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { validateQuery } from '../middleware/validate';
import { withTransaction } from '../db/withTransaction';
import {
  generateReconciliationReport,
  exportReconciliationReport,
  getLedgerStats,
  checkUserBalances,
  checkHashChainIntegrity,
  checkCrossSystemTransactions,
  checkOrphanedRecords,
} from '../services/ledgerReconciliation';
import { z } from 'zod';

type CreateReconciliationRouterOptions = {
  pool: Pool;
};

const reconciliationQuerySchema = z.object({
  format: z.enum(['json', 'csv']).optional(),
  check: z.enum([
    'balances',
    'hash-chain',
    'transactions',
    'orphaned',
    'all',
  ]).optional(),
}).strict();

export function createReconciliationRouter({
  pool,
}: CreateReconciliationRouterOptions) {
  const router = Router();

  /**
   * POST /api/v1/reconciliation/report
   * sp3-06: Genera reporte completo de conciliación contable
   * 
   * Verifica:
   * - Saldos de usuarios vs suma de ledger entries
   * - Integridad del hash chain
   * - Asientos de transacciones cross-system
   * - Registros huérfanos
   */
  router.post(
    '/reconciliation/report',
    requireAuth,
    validateQuery(reconciliationQuerySchema),
    async (_req: AuthenticatedRequest, res) => {
      const query = res.locals.validatedQuery as {
        format?: 'json' | 'csv';
      };

      try {
        const report = await withTransaction(pool, (client) =>
          generateReconciliationReport(client)
        );

        if (query.format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename="reconciliation-report.csv"'
          );

          const csv = await withTransaction(pool, (client) =>
            exportReconciliationReport(client, 'csv')
          );

          return res.send(csv);
        }

        return res.json(report);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error generating reconciliation report';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * GET /api/v1/reconciliation/balances
   * sp3-06: Verifica saldos de usuarios
   */
  router.post(
    '/reconciliation/check/balances',
    requireAuth,
    async (_req: AuthenticatedRequest, res) => {
      try {
        const issues = await withTransaction(pool, (client) =>
          checkUserBalances(client)
        );

        return res.json({
          check: 'balances',
          issuesFound: issues.length,
          critical: issues.filter((i) => i.severity === 'critical').length,
          issues: issues.slice(0, 50),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error checking balances';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * POST /api/v1/reconciliation/check/hash-chain
   * sp3-06: Verifica integridad del hash chain
   */
  router.post(
    '/reconciliation/check/hash-chain',
    requireAuth,
    async (_req: AuthenticatedRequest, res) => {
      try {
        const issues = await withTransaction(pool, (client) =>
          checkHashChainIntegrity(client)
        );

        return res.json({
          check: 'hash-chain',
          issuesFound: issues.length,
          issues: issues.slice(0, 50),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error checking hash chain';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * POST /api/v1/reconciliation/check/transactions
   * sp3-06: Verifica transacciones cross-system
   */
  router.post(
    '/reconciliation/check/transactions',
    requireAuth,
    async (_req: AuthenticatedRequest, res) => {
      try {
        const issues = await withTransaction(pool, (client) =>
          checkCrossSystemTransactions(client)
        );

        return res.json({
          check: 'transactions',
          issuesFound: issues.length,
          issues: issues.slice(0, 50),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error checking transactions';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * POST /api/v1/reconciliation/check/orphaned
   * sp3-06: Verifica registros huérfanos
   */
  router.post(
    '/reconciliation/check/orphaned',
    requireAuth,
    async (_req: AuthenticatedRequest, res) => {
      try {
        const issues = await withTransaction(pool, (client) =>
          checkOrphanedRecords(client)
        );

        return res.json({
          check: 'orphaned',
          issuesFound: issues.length,
          issues,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error checking orphaned records';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * GET /api/v1/reconciliation/ledger-stats
   * sp3-06: Obtiene estadísticas del ledger
   */
  router.get(
    '/reconciliation/ledger-stats',
    requireAuth,
    async (_req: AuthenticatedRequest, res) => {
      try {
        const stats = await withTransaction(pool, (client) =>
          getLedgerStats(client)
        );

        return res.json({
          timestamp: new Date().toISOString(),
          ledgerStats: stats,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error fetching ledger stats';
        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * GET /api/v1/reconciliation/dashboard
   * sp3-06: Panel consolidado de conciliación
   */
  router.get(
    '/reconciliation/dashboard',
    requireAuth,
    async (_req: AuthenticatedRequest, res) => {
      try {
        const [report, stats] = await Promise.all([
          withTransaction(pool, (client) =>
            generateReconciliationReport(client)
          ),
          withTransaction(pool, (client) => getLedgerStats(client)),
        ]);

        return res.json({
          timestamp: new Date().toISOString(),
          health: report.systemHealth,
          summary: {
            totalIssues: report.issuesFound,
            critical: report.issues.filter((i) => i.severity === 'critical')
              .length,
            warnings: report.issues.filter((i) => i.severity === 'warning')
              .length,
          },
          ledgerStats: stats,
          recentIssues: report.issues.slice(0, 10),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error fetching reconciliation dashboard';
        return res.status(500).json({ error: message });
      }
    }
  );

  return router;
}
