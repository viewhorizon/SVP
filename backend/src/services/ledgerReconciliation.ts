/**
 * sp3-06: Servicio de conciliación contable
 * Verifica invariantes de ledger y detecta desbalances
 */

import type { PoolClient } from 'pg';

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

  // Verificar saldos de puntos
  const result = await client.query(`
    SELECT
      u.user_id,
      u.points_balance as user_balance,
      COALESCE(SUM(le.amount), 0) as ledger_sum
    FROM users u
    LEFT JOIN ledger_entries le ON u.user_id = le.user_id
    GROUP BY u.user_id, u.points_balance
    HAVING u.points_balance != COALESCE(SUM(le.amount), 0)
  `);

  for (const row of result.rows) {
    issues.push({
      type: 'balance_mismatch',
      severity: 'critical',
      description: `Usuario ${row.user_id}: saldo en tabla=${row.user_balance}, suma de ledger=${row.ledger_sum}`,
      affectedIds: [row.user_id],
      metadata: {
        userId: row.user_id,
        userBalance: Number(row.user_balance),
        ledgerSum: Number(row.ledger_sum),
        difference: Number(row.user_balance) - Number(row.ledger_sum),
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

  // Verificar que cada hash apunte correctamente al anterior
  const result = await client.query(`
    SELECT
      le.ledger_id,
      le.previous_hash,
      le.entry_hash,
      le.created_at,
      prev_le.entry_hash as expected_previous_hash,
      prev_le.ledger_id as prev_ledger_id
    FROM ledger_entries le
    LEFT JOIN ledger_entries prev_le ON le.previous_hash = prev_le.entry_hash
    WHERE le.previous_hash IS NOT NULL
      AND prev_le.entry_hash IS NULL
    LIMIT 100
  `);

  for (const row of result.rows) {
    issues.push({
      type: 'hash_mismatch',
      severity: 'critical',
      description: `Hash chain roto en entrada ${row.ledger_id}: previous_hash=${row.previous_hash} no encontrado`,
      affectedIds: [row.ledger_id],
      metadata: {
        ledgerId: row.ledger_id,
        previousHash: row.previous_hash,
        createdAt: row.created_at,
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

  // Verificar que todas las transacciones completadas tengan sus asientos contables
  const result = await client.query(`
    SELECT
      cst.transaction_id,
      cst.origin_system,
      cst.target_system,
      cst.status,
      COUNT(le.ledger_id) as ledger_entries
    FROM cross_system_transactions cst
    LEFT JOIN ledger_entries le ON cst.transaction_id = le.transaction_id
    WHERE cst.status = 'completed'
    GROUP BY cst.transaction_id, cst.origin_system, cst.target_system, cst.status
    HAVING COUNT(le.ledger_id) < 2  -- Debe haber al menos 2 asientos (origen y destino)
  `);

  for (const row of result.rows) {
    issues.push({
      type: 'missing_entry',
      severity: 'critical',
      description: `Transacción ${row.transaction_id} completada pero con solo ${row.ledger_entries} asientos (esperado 2+)`,
      affectedIds: [row.transaction_id],
      metadata: {
        transactionId: row.transaction_id,
        originSystem: row.origin_system,
        targetSystem: row.target_system,
        ledgerEntries: Number(row.ledger_entries),
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

  // Verificar ledger entries sin usuario
  const orphanedUsers = await client.query(`
    SELECT COUNT(*) as count
    FROM ledger_entries le
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = le.user_id)
  `);

  if (orphanedUsers.rows[0].count > 0) {
    issues.push({
      type: 'orphaned_record',
      severity: 'warning',
      description: `${orphanedUsers.rows[0].count} asientos contables referencia usuarios inexistentes`,
      metadata: {
        orphanedCount: Number(orphanedUsers.rows[0].count),
      },
    });
  }

  // Verificar transacciones sin ledger entries asociadas
  const orphanedTransactions = await client.query(`
    SELECT COUNT(*) as count
    FROM cross_system_transactions cst
    WHERE NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.transaction_id = cst.transaction_id)
      AND cst.status = 'completed'
  `);

  if (orphanedTransactions.rows[0].count > 0) {
    issues.push({
      type: 'orphaned_record',
      severity: 'warning',
      description: `${orphanedTransactions.rows[0].count} transacciones completadas sin asientos contables`,
      metadata: {
        orphanedCount: Number(orphanedTransactions.rows[0].count),
      },
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
      COUNT(*) as total_entries,
      COUNT(DISTINCT user_id) as unique_users,
      SUM(amount) as total_balance,
      AVG(amount) as avg_amount,
      MIN(amount) as min_amount,
      MAX(amount) as max_amount
    FROM ledger_entries
  `);

  const row = result.rows[0];

  return {
    totalEntries: Number(row.total_entries),
    uniqueUsers: Number(row.unique_users),
    totalBalance: Number(row.total_balance || 0),
    avgAmount: Number(row.avg_amount || 0),
    minAmount: Number(row.min_amount || 0),
    maxAmount: Number(row.max_amount || 0),
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
