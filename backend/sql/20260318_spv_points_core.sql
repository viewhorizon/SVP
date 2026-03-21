-- SPV Core Tables (K-06)
-- PostgreSQL source of truth for points and wallet state.

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

-- Seed rules
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

-- Seed limits
INSERT INTO point_limits (limit_type, scope, max_value, window_interval, is_active, metadata)
VALUES
  ('VOTES_PER_DAY', 'GLOBAL', 5, INTERVAL '1 day', TRUE, '{"description":"Límite diario de votos por usuario"}'::jsonb),
  ('POINTS_CREDIT_DAILY', 'GLOBAL', 1000, INTERVAL '1 day', TRUE, '{"description":"Tope diario de acreditación"}'::jsonb),
  ('TRANSFER_COUNT_DAILY', 'GLOBAL', 20, INTERVAL '1 day', TRUE, '{"description":"Máximo transferencias por día"}'::jsonb),
  ('TRANSFER_AMOUNT_DAILY', 'GLOBAL', 2000, INTERVAL '1 day', TRUE, '{"description":"Máximo puntos transferidos por día"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Seed demo wallets
INSERT INTO points_wallet (user_id, available_points, lifetime_points, last_ledger_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 120, 1200, NOW()),
  ('22222222-2222-2222-2222-222222222222', 75, 640, NOW())
ON CONFLICT (user_id) DO NOTHING;