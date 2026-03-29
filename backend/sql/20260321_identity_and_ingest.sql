-- Identity links + generic event ingestion for external apps (TierList, games, etc.)
-- Execute after:
--   20260318_spv_points_core.sql
--   20260320_inventory_liveops_inventory.sql

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

-- Seed rates for TierList and generic LiveOps points.
INSERT INTO source_app_rates (source_app, source_unit, multiplier, bonus, rounding, is_active, metadata)
VALUES
  ('tierlist-global', 'liveops_points', 0.85, 0, 'floor', TRUE, '{"description":"Conversion base TierList->SVP"}'::jsonb),
  ('tierlist-global', 'svp_points', 1, 0, 'floor', TRUE, '{"description":"Sin conversion adicional"}'::jsonb),
  ('generic-app', 'liveops_points', 1, 0, 'floor', TRUE, '{"description":"Fallback para apps externas"}'::jsonb)
ON CONFLICT DO NOTHING;