import type { PoolClient } from 'pg';

export type AlertLevel = 'critical' | 'warning' | 'info';

export type OperationalAlert = {
  alertId: string;
  level: AlertLevel;
  type: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
};

/**
 * sp3-03: Detecta backlog envejecido en outbox
 * Alerta CRITICAL si hay eventos pending > 30 minutos
 * Alerta WARNING si hay eventos pending > 10 minutos
 */
export async function checkOutboxBacklogAge(
  client: PoolClient,
  configMinutes: { critical: number; warning: number } = {
    critical: 30,
    warning: 10,
  }
) {
  const result = await client.query(`
    SELECT
      COUNT(*) as pending_count,
      MIN(created_at) as oldest_event,
      EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))/60 as age_minutes
    FROM outbox_events
    WHERE status IN ('pending', 'failed')
      AND next_attempt_at <= NOW()
  `);

  const row = result.rows[0];
  const pendingCount = Number(row.pending_count);
  const ageMinutes = Number(row.age_minutes || 0);
  const oldestEvent = row.oldest_event;

  const alerts: OperationalAlert[] = [];

  if (ageMinutes > configMinutes.critical) {
    alerts.push({
      alertId: `backlog-age-critical-${Date.now()}`,
      level: 'critical',
      type: 'outbox_backlog_age',
      title: 'Critical: Outbox backlog envejecido',
      description: `${pendingCount} eventos pendientes con antigüedad de ${Math.floor(
        ageMinutes
      )} minutos. Evento más antiguo: ${oldestEvent}`,
      metadata: {
        pendingCount,
        ageMinutes: Math.floor(ageMinutes),
        oldestEvent,
      },
      createdAt: new Date().toISOString(),
    });
  } else if (ageMinutes > configMinutes.warning) {
    alerts.push({
      alertId: `backlog-age-warning-${Date.now()}`,
      level: 'warning',
      type: 'outbox_backlog_age',
      title: 'Warning: Outbox backlog envejecido',
      description: `${pendingCount} eventos pendientes con antigüedad de ${Math.floor(
        ageMinutes
      )} minutos`,
      metadata: {
        pendingCount,
        ageMinutes: Math.floor(ageMinutes),
      },
      createdAt: new Date().toISOString(),
    });
  }

  return alerts;
}

/**
 * sp3-03: Detecta fallos consecutivos por app
 * Alerta si una app tiene > 5 eventos consecutivos fallando
 */
export async function checkConsecutiveFailures(
  client: PoolClient,
  failureThreshold: number = 5
) {
  const result = await client.query(`
    SELECT
      source_app,
      COUNT(*) as failure_count,
      MAX(last_error) as last_error,
      MAX(created_at) as latest_failure
    FROM outbox_events
    WHERE status = 'failed'
    GROUP BY source_app
    HAVING COUNT(*) >= $1
    ORDER BY failure_count DESC
  `, [failureThreshold]);

  const alerts: OperationalAlert[] = [];

  for (const row of result.rows) {
    const sourceApp = row.source_app;
    const failureCount = Number(row.failure_count);
    const lastError = row.last_error;

    alerts.push({
      alertId: `consecutive-failures-${sourceApp}-${Date.now()}`,
      level: failureCount > 20 ? 'critical' : 'warning',
      type: 'consecutive_failures',
      title: `${failureCount > 20 ? 'Critical' : 'Warning'}: Fallos consecutivos en ${sourceApp}`,
      description: `${failureCount} eventos consecutivos fallando en ${sourceApp}. Error: ${lastError}`,
      metadata: {
        sourceApp,
        failureCount,
        lastError,
        latestFailure: row.latest_failure,
      },
      createdAt: new Date().toISOString(),
    });
  }

  return alerts;
}

/**
 * sp3-03: Detecta eventos en dead-letter
 * Alerta WARNING si hay eventos DLQ > 10
 * Alerta CRITICAL si hay eventos DLQ > 50
 */
export async function checkDeadLetterAccumulation(
  client: PoolClient,
  thresholds: { warning: number; critical: number } = {
    warning: 10,
    critical: 50,
  }
) {
  const result = await client.query(`
    SELECT
      COUNT(*) as dlq_count,
      COUNT(DISTINCT source_app) as unique_apps,
      MAX(created_at) as newest,
      MIN(created_at) as oldest
    FROM outbox_events
    WHERE status = 'dead_letter'
  `);

  const row = result.rows[0];
  const dlqCount = Number(row.dlq_count);
  const uniqueApps = Number(row.unique_apps);
  const alerts: OperationalAlert[] = [];

  if (dlqCount > thresholds.critical) {
    alerts.push({
      alertId: `dlq-critical-${Date.now()}`,
      level: 'critical',
      type: 'dead_letter_accumulation',
      title: 'Critical: Dead-letter queue acumulando eventos',
      description: `${dlqCount} eventos en dead-letter de ${uniqueApps} aplicaciones. Rango: ${row.oldest} a ${row.newest}`,
      metadata: {
        dlqCount,
        uniqueApps,
        oldest: row.oldest,
        newest: row.newest,
      },
      createdAt: new Date().toISOString(),
    });
  } else if (dlqCount > thresholds.warning) {
    alerts.push({
      alertId: `dlq-warning-${Date.now()}`,
      level: 'warning',
      type: 'dead_letter_accumulation',
      title: 'Warning: Dead-letter queue en aumento',
      description: `${dlqCount} eventos en dead-letter de ${uniqueApps} aplicaciones`,
      metadata: {
        dlqCount,
        uniqueApps,
      },
      createdAt: new Date().toISOString(),
    });
  }

  return alerts;
}

/**
 * sp3-03: Ejecuta todas las alertas operativas
 */
export async function generateOperationalAlerts(
  client: PoolClient,
  config: {
    backlogAgeMinutes?: { critical: number; warning: number };
    failureThreshold?: number;
    deadLetterThresholds?: { warning: number; critical: number };
  } = {}
): Promise<OperationalAlert[]> {
  const [backlogAlerts, failureAlerts, dlqAlerts] = await Promise.all([
    checkOutboxBacklogAge(client, config.backlogAgeMinutes),
    checkConsecutiveFailures(client, config.failureThreshold),
    checkDeadLetterAccumulation(client, config.deadLetterThresholds),
  ]);

  return [...backlogAlerts, ...failureAlerts, ...dlqAlerts];
}

/**
 * sp3-03: Guarda alertas en BD para historial
 */
export async function persistAlert(
  client: PoolClient,
  alert: OperationalAlert
) {
  await client.query(
    `INSERT INTO operational_alerts (alert_id, level, type, title, description, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (alert_id) DO NOTHING`,
    [
      alert.alertId,
      alert.level,
      alert.type,
      alert.title,
      alert.description,
      JSON.stringify(alert.metadata || {}),
      alert.createdAt,
    ]
  );
}
