import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const sql = neon(process.env.DATABASE_URL);

const migrationSQL = `
-- sp3-03: Tabla de alertas operativas
CREATE TABLE IF NOT EXISTS operational_alerts (
  alert_id UUID PRIMARY KEY,
  level VARCHAR(20) NOT NULL CHECK (level IN ('critical', 'warning', 'info')),
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_operational_alerts_level ON operational_alerts(level);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_type ON operational_alerts(type);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_created_at ON operational_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_resolved_at ON operational_alerts(resolved_at);

-- Vista para alertas activas (no resueltas)
CREATE OR REPLACE VIEW operational_alerts_active AS
SELECT *
FROM operational_alerts
WHERE resolved_at IS NULL
ORDER BY created_at DESC;

COMMENT ON TABLE operational_alerts IS 'sp3-03: Registro de alertas operativas del dispatcher (backlog envejecido, fallos consecutivos, DLQ)';
COMMENT ON COLUMN operational_alerts.level IS 'Nivel de severidad: critical, warning, info';
COMMENT ON COLUMN operational_alerts.type IS 'Tipo de alerta: outbox_backlog_age, consecutive_failures, dead_letter_accumulation';
`;

async function runMigrations() {
  try {
    console.log('[v0] Ejecutando migraciones Sprint 3...');

    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    for (const statement of statements) {
      try {
        await sql(statement);
        console.log('[v0] ✅ Ejecutado');
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        if (msg.includes('already exists')) {
          console.log('[v0] ⚠️  Tabla ya existe');
        } else {
          console.error('[v0] Error:', msg);
        }
      }
    }

    console.log('[v0] 🎉 Migraciones Sprint 3 completadas');
  } catch (error) {
    console.error('[v0] Error fatal:', error instanceof Error ? error.message : 'Unknown');
    process.exit(1);
  }
}

runMigrations();
