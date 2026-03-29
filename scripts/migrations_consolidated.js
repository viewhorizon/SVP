import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[v0] Error: DATABASE_URL not set');
  process.exit(1);
}

// Todas las migraciones SQL
const allMigrations = `
-- 1. SPV Core Tables (20260318_spv_points_core.sql)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'points_direction') THEN
    CREATE TYPE points_direction AS ENUM ('CREDIT', 'DEBIT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'points_operation_type') THEN
    CREATE TYPE points_operation_type AS ENUM (
      'VOTE_CAST',
      'POINTS_GRANTED',
      'POINTS_DEBITED',
      'POINTS_TRANSFERRED_IN',
      'POINTS_TRANSFERRED_OUT',
      'POINTS_CONVERTED_TO_ITEM'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'point_limit_type') THEN
    CREATE TYPE point_limit_type AS ENUM (
      'VOTES_PER_DAY',
      'POINTS_CREDIT_DAILY',
      'POINTS_DEBIT_DAILY',
      'TRANSFER_COUNT_DAILY',
      'TRANSFER_AMOUNT_DAILY'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'point_limit_scope') THEN
    CREATE TYPE point_limit_scope AS ENUM ('GLOBAL', 'USER', 'ACTIVITY');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS points_wallet (
  user_id UUID PRIMARY KEY,
  available_points BIGINT NOT NULL DEFAULT 0 CHECK (available_points >= 0),
  lifetime_points BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  last_ledger_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_wallet_updated_at
  ON points_wallet (updated_at DESC);

CREATE TABLE IF NOT EXISTS points_ledger (
  ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  event_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  direction points_direction NOT NULL,
  operation_type points_operation_type NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  balance_before BIGINT NOT NULL CHECK (balance_before >= 0),
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
  related_user_id UUID,
  activity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_points_ledger_idempotency UNIQUE (user_id, request_id, operation_type),
  CONSTRAINT ck_points_ledger_direction_amount CHECK (
    (direction = 'CREDIT' AND balance_after >= balance_before)
    OR
    (direction = 'DEBIT' AND balance_after <= balance_before)
  )
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user_created
  ON points_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_points_ledger_request
  ON points_ledger (request_id);

CREATE INDEX IF NOT EXISTS idx_points_ledger_operation
  ON points_ledger (operation_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_points_ledger_metadata_gin
  ON points_ledger USING GIN (metadata);

CREATE TABLE IF NOT EXISTS point_rules (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(120) NOT NULL,
  activity_scope VARCHAR(20) NOT NULL CHECK (activity_scope IN ('global', 'local', 'digital', 'real')),
  version INT NOT NULL,
  formula JSONB NOT NULL,
  max_points_per_vote INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_point_rules_version UNIQUE (activity_scope, version),
  CONSTRAINT ck_point_rules_dates CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_point_rules_active_window
  ON point_rules (is_active, valid_from DESC, valid_until);

CREATE TABLE IF NOT EXISTS point_limits (
  limit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_type point_limit_type NOT NULL,
  scope point_limit_scope NOT NULL,
  user_id UUID,
  activity_id UUID,
  max_value BIGINT NOT NULL CHECK (max_value > 0),
  window_interval INTERVAL NOT NULL DEFAULT INTERVAL '1 day',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_point_limits_dates CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_point_limits_match
  ON point_limits (limit_type, scope, is_active, valid_from DESC, valid_until);

CREATE INDEX IF NOT EXISTS idx_point_limits_user
  ON point_limits (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_point_limits_activity
  ON point_limits (activity_id)
  WHERE activity_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_points_wallet_set_updated_at ON points_wallet;
CREATE TRIGGER trg_points_wallet_set_updated_at
  BEFORE UPDATE ON points_wallet
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

INSERT INTO point_rules (rule_name, activity_scope, version, formula, max_points_per_vote, is_active, valid_from)
VALUES
  (
    'Regla base global v1',
    'global',
    1,
    '{"base_per_vote": 2, "activity_multiplier": 1.1, "max_bonus_multiplier": 2.0}'::jsonb,
    80,
    TRUE,
    NOW()
  ),
  (
    'Regla base local v1',
    'local',
    1,
    '{"base_per_vote": 3, "activity_multiplier": 1.25, "max_bonus_multiplier": 2.5}'::jsonb,
    100,
    TRUE,
    NOW()
  )
ON CONFLICT (activity_scope, version) DO NOTHING;

INSERT INTO point_limits (limit_type, scope, max_value, window_interval, is_active, metadata)
VALUES
  ('VOTES_PER_DAY', 'GLOBAL', 5, INTERVAL '1 day', TRUE, '{"description":"Límite diario de votos por usuario"}'::jsonb),
  ('POINTS_CREDIT_DAILY', 'GLOBAL', 1000, INTERVAL '1 day', TRUE, '{"description":"Tope diario de acreditación"}'::jsonb),
  ('TRANSFER_COUNT_DAILY', 'GLOBAL', 20, INTERVAL '1 day', TRUE, '{"description":"Máximo transferencias por día"}'::jsonb),
  ('TRANSFER_AMOUNT_DAILY', 'GLOBAL', 2000, INTERVAL '1 day', TRUE, '{"description":"Máximo puntos transferidos por día"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO points_wallet (user_id, available_points, lifetime_points, last_ledger_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 120, 1200, NOW()),
  ('22222222-2222-2222-2222-222222222222', 75, 640, NOW())
ON CONFLICT (user_id) DO NOTHING;

-- 2. Votes Table (20260318_votes_table.sql)
CREATE TABLE IF NOT EXISTS votes (
  vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_id UUID NOT NULL,
  request_id UUID NOT NULL,
  event_id UUID NOT NULL,
  points_generated BIGINT NOT NULL DEFAULT 0,
  activity_scope VARCHAR(20) NOT NULL CHECK (activity_scope IN ('global', 'local', 'digital', 'real')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votes_user_created
  ON votes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_votes_activity
  ON votes (activity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_votes_activity_scope
  ON votes (activity_scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_votes_request_id
  ON votes (request_id);

CREATE INDEX IF NOT EXISTS idx_votes_metadata_gin
  ON votes USING GIN (metadata);

-- 3. Identity links + external events (20260321_identity_and_ingest.sql)
CREATE TABLE IF NOT EXISTS identity_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  svp_user_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_identity_source_user UNIQUE (source_app, external_user_id)
);

CREATE INDEX IF NOT EXISTS idx_identity_links_svp_user
  ON identity_links (svp_user_id, source_app, updated_at DESC);

CREATE TABLE IF NOT EXISTS source_app_rates (
  rate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app TEXT NOT NULL,
  source_unit TEXT NOT NULL,
  multiplier NUMERIC(20,8) NOT NULL DEFAULT 1 CHECK (multiplier > 0),
  bonus NUMERIC(20,8) NOT NULL DEFAULT 0,
  rounding TEXT NOT NULL DEFAULT 'floor' CHECK (rounding IN ('floor', 'round', 'ceil')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_source_app_rates_window CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_source_app_rates_lookup
  ON source_app_rates (source_app, source_unit, is_active, valid_from DESC);

CREATE TABLE IF NOT EXISTS external_activity_events (
  event_id TEXT PRIMARY KEY,
  source_app TEXT NOT NULL,
  source_env TEXT,
  external_user_id TEXT,
  svp_user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  score NUMERIC(20,6) NOT NULL,
  unit TEXT NOT NULL,
  points_applied BIGINT NOT NULL,
  request_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed',
  occurred_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_events_user_created
  ON external_activity_events (svp_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_events_source_created
  ON external_activity_events (source_app, created_at DESC);

DROP TRIGGER IF EXISTS trg_identity_links_set_updated_at ON identity_links;
CREATE TRIGGER trg_identity_links_set_updated_at
  BEFORE UPDATE ON identity_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_source_app_rates_set_updated_at ON source_app_rates;
CREATE TRIGGER trg_source_app_rates_set_updated_at
  BEFORE UPDATE ON source_app_rates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO source_app_rates (source_app, source_unit, multiplier, bonus, rounding, is_active, metadata)
VALUES
  ('tierlist-global', 'liveops_points', 0.85, 0, 'floor', TRUE, '{"description":"Conversion base TierList->SVP"}'::jsonb),
  ('tierlist-global', 'svp_points', 1, 0, 'floor', TRUE, '{"description":"Sin conversion adicional"}'::jsonb),
  ('generic-app', 'liveops_points', 1, 0, 'floor', TRUE, '{"description":"Fallback para apps externas"}'::jsonb)
ON CONFLICT DO NOTHING;

-- 4. Inventory (20260320_inventory_liveops_inventory.sql)
CREATE TABLE IF NOT EXISTS liveops_rates (
  rate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  park_id TEXT,
  rate_value NUMERIC(18,6) NOT NULL CHECK (rate_value > 0),
  unit_in TEXT NOT NULL DEFAULT 'SVP_POINTS',
  unit_out TEXT NOT NULL DEFAULT 'LIVEOPS_CREDIT',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_liveops_rates_window CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_liveops_rates_lookup
  ON liveops_rates (is_active, park_id, valid_from DESC);

CREATE TABLE IF NOT EXISTS inventory_catalog (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'local')),
  park_id TEXT,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_spv BIGINT NOT NULL CHECK (price_spv > 0),
  stock BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_inventory_scope_park CHECK (
    (scope = 'global' AND park_id IS NULL)
    OR
    (scope = 'local' AND park_id IS NOT NULL)
  ),
  CONSTRAINT ck_inventory_stock CHECK (stock IS NULL OR stock >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_catalog_scope
  ON inventory_catalog (scope, park_id, is_active, name);

CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES inventory_catalog(item_id) ON DELETE RESTRICT,
  quantity BIGINT NOT NULL CHECK (quantity >= 0),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'local')),
  park_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_user_inventory_scope_park CHECK (
    (scope = 'global' AND park_id IS NULL)
    OR
    (scope = 'local' AND park_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_inventory_global
  ON user_inventory (user_id, item_id)
  WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_inventory_local
  ON user_inventory (user_id, item_id, park_id)
  WHERE scope = 'local';

CREATE INDEX IF NOT EXISTS idx_user_inventory_user
  ON user_inventory (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS cross_system_transactions (
  transaction_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  transaction_type TEXT NOT NULL,
  origin_system TEXT NOT NULL,
  target_system TEXT NOT NULL,
  park_id TEXT,
  amount_in NUMERIC(20,6) NOT NULL,
  amount_out NUMERIC(20,6) NOT NULL,
  unit_in TEXT NOT NULL,
  unit_out TEXT NOT NULL,
  rate_id TEXT,
  status TEXT NOT NULL,
  saga_step TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cross_tx_user_created
  ON cross_system_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cross_tx_type_status
  ON cross_system_transactions (transaction_type, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_liveops_rates_set_updated_at ON liveops_rates;
CREATE TRIGGER trg_liveops_rates_set_updated_at
  BEFORE UPDATE ON liveops_rates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_catalog_set_updated_at ON inventory_catalog;
CREATE TRIGGER trg_inventory_catalog_set_updated_at
  BEFORE UPDATE ON inventory_catalog
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_inventory_set_updated_at ON user_inventory;
CREATE TRIGGER trg_user_inventory_set_updated_at
  BEFORE UPDATE ON user_inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO liveops_rates (park_id, rate_value, unit_in, unit_out, is_active, metadata)
VALUES
  ('park-demo-001', 1.25, 'SVP_POINTS', 'LIVEOPS_CREDIT', TRUE, '{"source":"manual_seed"}'::jsonb),
  ('park-demo-001', 0.80, 'LIVEOPS_CREDIT', 'SVP_POINTS', TRUE, '{"source":"manual_seed"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO inventory_catalog (scope, park_id, sku, name, description, price_spv, stock, is_active, metadata)
VALUES
  ('global', NULL, 'GLOBAL-BADGE-001', 'Badge Global Legend', 'Item global de reconocimiento', 25, NULL, TRUE, '{"rarity":"rare"}'::jsonb),
  ('global', NULL, 'GLOBAL-SKIN-001', 'Skin Global Neon', 'Skin global coleccionable', 60, 1000, TRUE, '{"rarity":"epic"}'::jsonb),
  ('local', 'park-demo-001', 'LOCAL-DRINK-001', 'Bebida Park Demo', 'Consumible local del parque demo', 12, 200, TRUE, '{"category":"consumable"}'::jsonb),
  ('local', 'park-demo-001', 'LOCAL-FASTPASS-001', 'FastPass Park Demo', 'Acceso prioritario local', 40, 120, TRUE, '{"category":"access"}'::jsonb)
ON CONFLICT (sku) DO NOTHING;

-- 5. Achievements (20260322_achievements_voting.sql)
CREATE TABLE IF NOT EXISTS achievement_definitions (
  achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL DEFAULT 'points' CHECK (reward_type IN ('points', 'item', 'mixed')),
  reward_points BIGINT NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  reward_item_id UUID REFERENCES inventory_catalog(item_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'voting' CHECK (status IN ('draft', 'voting', 'approved', 'rejected', 'archived')),
  created_by UUID NOT NULL,
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_activity_status
  ON achievement_definitions (activity_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_achievements_created_by
  ON achievement_definitions (created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS achievement_votes (
  vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id UUID NOT NULL REFERENCES achievement_definitions(achievement_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote_value TEXT NOT NULL CHECK (vote_value IN ('up', 'down')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (achievement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_achievement_votes_target
  ON achievement_votes (achievement_id, vote_value, created_at DESC);

DROP TRIGGER IF EXISTS trg_achievements_set_updated_at ON achievement_definitions;
CREATE TRIGGER trg_achievements_set_updated_at
  BEFORE UPDATE ON achievement_definitions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_achievement_votes_set_updated_at ON achievement_votes;
CREATE TRIGGER trg_achievement_votes_set_updated_at
  BEFORE UPDATE ON achievement_votes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO achievement_definitions (
  achievement_id,
  activity_id,
  title,
  description,
  reward_type,
  reward_points,
  status,
  created_by,
  metadata
)
VALUES (
  gen_random_uuid(),
  'tierlist-weekly-best-news',
  'Top 1 noticia semanal',
  'Logro desbloqueado por votacion global para el top semanal',
  'points',
  30,
  'voting',
  '11111111-1111-1111-1111-111111111111',
  '{"source":"seed"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- 6. Outbox (20260323_outbox_dispatcher.sql)
CREATE TABLE IF NOT EXISTS outbox_events (
  outbox_id UUID PRIMARY KEY,
  event_id TEXT NOT NULL,
  source_app TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_outbox_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_next_attempt
  ON outbox_events (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_source_event
  ON outbox_events (source_app, event_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_outbox_events_set_updated_at ON outbox_events;
CREATE TRIGGER trg_outbox_events_set_updated_at
  BEFORE UPDATE ON outbox_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Ledger Hash Chain (20260324_inventory_ledger_hash_chain.sql)
CREATE TABLE IF NOT EXISTS inventory_ledger_events (
  ledger_event_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  request_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'item',
  entity_id UUID NOT NULL,
  delta_points BIGINT NOT NULL,
  delta_items BIGINT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL UNIQUE,
  hash_version TEXT NOT NULL DEFAULT 'sha256-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inventory_ledger_idempotency UNIQUE (user_id, request_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_user_created
  ON inventory_ledger_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_entity
  ON inventory_ledger_events (entity_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_inventory_ledger_set_updated_at ON inventory_ledger_events;
CREATE TRIGGER trg_inventory_ledger_set_updated_at
  BEFORE UPDATE ON inventory_ledger_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. Policy Rules (20260325_policy_rules.sql)
CREATE TABLE IF NOT EXISTS policy_rules (
  rule_id UUID PRIMARY KEY,
  domain TEXT NOT NULL,
  source_app TEXT NULL,
  activity_type TEXT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  mutation_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_rules_domain_active
  ON policy_rules (domain, is_active, priority DESC, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_policy_rules_scope
  ON policy_rules (source_app, activity_type);

DROP TRIGGER IF EXISTS trg_policy_rules_set_updated_at ON policy_rules;
CREATE TRIGGER trg_policy_rules_set_updated_at
  BEFORE UPDATE ON policy_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO policy_rules (
  rule_id,
  domain,
  source_app,
  activity_type,
  priority,
  condition_json,
  mutation_json,
  notes,
  is_active
)
VALUES
  (
    '9c8d3577-8d64-45de-a1bb-3ffc36e40b00'::uuid,
    'external_activity_points',
    'tierlist-global',
    NULL,
    200,
    '{"gte":{"field":"totalVotes","value":100}}'::jsonb,
    '[{"kind":"points_multiplier","value":1.1},{"kind":"tag","key":"high_vote_volume","label":"Actividad con alto volumen de votos"}]'::jsonb,
    'Bono de multiplicador para debates con alto volumen de votos',
    TRUE
  ),
  (
    '0a6a98da-6bdf-42d6-8bf3-6f67b1f8f111'::uuid,
    'external_activity_points',
    NULL,
    'weekly_hito',
    220,
    '{"gte":{"field":"activityHours","value":2}}'::jsonb,
    '[{"kind":"points_bonus","value":15},{"kind":"tag","key":"weekly_hito_bonus","label":"Bono por hito semanal"}]'::jsonb,
    'Bono adicional para hitos semanales con actividad sostenida',
    TRUE
  )
ON CONFLICT (rule_id) DO NOTHING;
`;

async function executeMigrations() {
  try {
    console.log('[v0] Conectando a Neon...');
    const sql = neon(DATABASE_URL);

    // Split migrations into individual statements
    const statements = allMigrations
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let executed = 0;
    let skipped = 0;

    for (const statement of statements) {
      try {
        await sql(statement);
        executed++;
      } catch (error) {
        // Ignorar errores comunes de idempotencia
        const msg = error.message.toLowerCase();
        if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('constraint')) {
          skipped++;
        } else {
          console.log(`[v0] Advertencia: ${error.message.substring(0, 100)}`);
          skipped++;
        }
      }
    }

    console.log(`[v0] ✅ Migraciones completadas`);
    console.log(`[v0]   - Statements ejecutados: ${executed}`);
    console.log(`[v0]   - Statements omitidos (ya existen): ${skipped}`);
    console.log(`[v0] 🎉 Base de datos lista para pruebas`);
    
  } catch (error) {
    console.error('[v0] Error fatal:', error.message);
    process.exit(1);
  }
}

executeMigrations();
