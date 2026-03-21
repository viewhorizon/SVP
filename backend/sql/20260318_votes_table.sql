-- Votes Table (SPV - K-11)
-- Control de votos emitidos por usuarios y puntos generados

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

-- Índices para rendimiento en consultas frecuentes
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

-- Comment para documentación
COMMENT ON TABLE votes IS 'Registro de votos emitidos y puntos generados en el SPV';
COMMENT ON COLUMN votes.activity_scope IS 'Ambito de la actividad: global, local, digital, or real';
COMMENT ON COLUMN votes.points_generated IS 'Puntos generados por este voto según regla aplicada';