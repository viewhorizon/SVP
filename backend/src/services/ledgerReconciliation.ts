/**
 * sp3-06: Servicio de conciliación contable
 * Verifica invariantes de ledger y detecta desbalances
 */

import type { PoolClient } from 'pg';
import { verifyInventoryLedgerIntegrity } from './inventoryLedger';

export type ReconciliationIssue = {
  type: 'balance_mismatch' | 'orphaned_record' | 'missing_entry' | 'hash_mismatch';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  affectedIds?: string[];
  metadata?: Record<string, unknown>;
};

export type ReconciliationReport = {
  timestamp: string;
  totalChecks: number;
  issuesFound: number;
  issues: ReconciliationIssue[];
  systemHealth: 'healthy' | 'degraded' | 'critical';
  ledgerStats: {
    totalEntries: number;
    totalBalance: number;
    uniqueUsers: number;
  };
};

/**
 * sp3-06: Verifica que los saldos de usuarios coincidan con sus ledger entries
 */
export async function checkUserBalances(
  client: PoolClient
): Promise<ReconciliationIssue[]> {
  const issues: ReconciliationIssue[] = [];

  const result = await client.query(`
    SELECT
      wallet.user_id,
      wallet.available_points AS wallet_balance,
      latest.balance_after AS ledger_balance
    FROM points_wallet wallet
    JOIN LATERAL (
      SELECT balance_after
      FROM points_ledger
      WHERE user_id = wallet.user_id
      ORDER BY created_at DESC, ledger_id DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE wallet.available_points <> latest.balance_after
    ORDER BY wallet.user_id
  `);

  for (const row of result.rows) {
    issues.push({
      type: 'balance_mismatch',
      severity: 'critical',
      description: `Usuario ${row.user_id}: saldo wallet=${row.wallet_balance}, último saldo ledger=${row.ledger_balance}`,
      affectedIds: [row.user_id],
      metadata: {
        userId: row.user_id,
        walletBalance: Number(row.wallet_balance),
        ledgerBalance: Number(row.ledger_balance),
        difference: Number(row.wallet_balance) - Number(row.ledger_balance),
      },
    });
  }

  return issues;
}

/**
 * sp3-06: Verifica que los hash chain no estén rotos
 */
export async function checkHashChainIntegrity(
  client: PoolClient
): Promise<ReconciliationIssue[]> {
  const issues: ReconciliationIssue[] = [];

  const verification = await verifyInventoryLedgerIntegrity(client, { limit: 10000 });

  for (const row of verification.issues) {
    issues.push({
      type: 'hash_mismatch',
      severity: 'critical',
      description: `Cadena de inventario inconsistente en evento ${row.eventId}: ${row.reason}`,
      affectedIds: [row.eventId],
      metadata: {
        eventId: row.eventId,
        reason: row.reason,
        expected: row.expected,
        actual: row.actual,
      },
    });
  }

  return issues;
}

/**
 * sp3-06: Verifica transacciones cross-system
 */
export async function checkCrossSystemTransactions(
  client: PoolClient
): Promise<ReconciliationIssue[]> {
  const issues: ReconciliationIssue[] = [];

  const result = await client.query(`
    SELECT transaction_id, origin_system, target_system, status,
           amount_in, amount_out, completed_at
    FROM cross_system_transactions
    WHERE status = 'completed'
      AND (amount_in <= 0 OR amount_out <= 0 OR completed_at IS NULL)
    ORDER BY created_at DESC
    LIMIT 100
  `);

  for (const row of result.rows) {
    issues.push({
      type: 'missing_entry',
      severity: 'critical',
      description: `Transacción ${row.transaction_id} marcada como completada con importes inválidos o sin completed_at`,
      affectedIds: [row.transaction_id],
      metadata: {
        transactionId: row.transaction_id,
        originSystem: row.origin_system,
        targetSystem: row.target_system,
        amountIn: Number(row.amount_in),
        amountOut: Number(row.amount_out),
        completedAt: row.completed_at,
      },
    });
  }

  return issues;
}

/**
 * sp3-06: Verifica registros huérfanos en ledger
 */
export async function checkOrphanedRecords(
  client: PoolClient
): Promise<ReconciliationIssue[]> {
  const issues: ReconciliationIssue[] = [];

  const orphanedLedgerEntries = await client.query(`
    SELECT ledger.ledger_id, ledger.user_id
    FROM points_ledger ledger
    LEFT JOIN points_wallet wallet ON wallet.user_id = ledger.user_id
    WHERE wallet.user_id IS NULL
    ORDER BY ledger.created_at DESC
    LIMIT 100
  `);

  if (orphanedLedgerEntries.rowCount) {
    issues.push({
      type: 'orphaned_record',
      severity: 'warning',
      description: `${orphanedLedgerEntries.rowCount} entradas points_ledger no tienen wallet asociado`,
      affectedIds: orphanedLedgerEntries.rows.map((row) => row.ledger_id),
      metadata: { orphanedCount: orphanedLedgerEntries.rowCount },
    });
  }

  const orphanedInventoryEvents = await client.query(`
    SELECT event.ledger_event_id, event.entity_id
    FROM inventory_ledger_events event
    WHERE event.entity_type = 'item'
      AND NOT EXISTS (
        SELECT 1 FROM inventory_catalog item WHERE item.item_id = event.entity_id
      )
    ORDER BY event.created_at DESC
    LIMIT 100
  `);

  if (orphanedInventoryEvents.rowCount) {
    issues.push({
      type: 'orphaned_record',
      severity: 'warning',
      description: `${orphanedInventoryEvents.rowCount} eventos de inventario apuntan a items inexistentes`,
      affectedIds: orphanedInventoryEvents.rows.map((row) => row.ledger_event_id),
      metadata: { orphanedCount: orphanedInventoryEvents.rowCount },
    });
  }

  return issues;
}

/**
 * sp3-06: Obtiene estadísticas generales del ledger
 */
export async function getLedgerStats(client: PoolClient) {
  const result = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM points_ledger) AS total_entries,
      COUNT(*) AS unique_users,
      COALESCE(SUM(available_points), 0) AS total_balance,
      COALESCE(AVG(available_points), 0) AS avg_amount,
      COALESCE(MIN(available_points), 0) AS min_amount,
      COALESCE(MAX(available_points), 0) AS max_amount
    FROM points_wallet
  `);

  const row = result.rows[0];

  return {
    totalEntries: Number(row.total_entries),
    uniqueUsers: Number(row.unique_users),
    totalBalance: Number(row.total_balance),
    avgAmount: Number(row.avg_amount),
    minAmount: Number(row.min_amount),
    maxAmount: Number(row.max_amount),
  };
}

/**
 * sp3-06: Ejecuta reporte completo de conciliación
 */
export async function generateReconciliationReport(
  client: PoolClient
): Promise<ReconciliationReport> {
  const startTime = Date.now();

  const [
    balanceIssues,
    hashIssues,
    transactionIssues,
    orphanIssues,
    stats,
  ] = await Promise.all([
    checkUserBalances(client),
    checkHashChainIntegrity(client),
    checkCrossSystemTransactions(client),
    checkOrphanedRecords(client),
    getLedgerStats(client),
  ]);

  const allIssues = [
    ...balanceIssues,
    ...hashIssues,
    ...transactionIssues,
    ...orphanIssues,
  ];

  // Determinar salud del sistema
  const criticalCount = allIssues.filter((i) => i.severity === 'critical').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;

  let systemHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (criticalCount > 0) {
    systemHealth = 'critical';
  } else if (warningCount > 0) {
    systemHealth = 'degraded';
  }

  return {
    timestamp: new Date().toISOString(),
    totalChecks: 4,
    issuesFound: allIssues.length,
    issues: allIssues,
    systemHealth,
    ledgerStats: stats,
  };
}

/**
 * sp3-06: Exporta reporte en formato JSON para auditoría
 */
export async function exportReconciliationReport(
  client: PoolClient,
  format: 'json' | 'csv' = 'json'
): Promise<string> {
  const report = await generateReconciliationReport(client);

  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }

  // Formato CSV
  let csv = 'Type,Severity,Description,AffectedIDs,Timestamp\n';

  for (const issue of report.issues) {
    const affectedIds = (issue.affectedIds || []).join(';');
    csv += `"${issue.type}","${issue.severity}","${issue.description.replace(/"/g, '""')}","${affectedIds}","${report.timestamp}"\n`;
  }

  return csv;
}
