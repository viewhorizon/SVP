-- Logros votados para desbloqueo de recompensas por actividad.
-- Ejecutar despues de 20260320_inventory_liveops_inventory.sql

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

-- Seed de ejemplo para entorno local.
INSERT INTO achievement_definitions (
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
