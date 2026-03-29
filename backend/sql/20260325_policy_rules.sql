-- Policy Engine rules for configurable point/object valuation
-- Execute after:
--   20260321_identity_and_ingest.sql

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

-- Seed example rules for external activity points
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
    '9c8d3577-8d64-45de-a1bb-3ffc36e40b00',
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
    '0a6a98da-6bdf-42d6-8bf3-6f67b1f8f111',
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