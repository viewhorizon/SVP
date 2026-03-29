-- Outbox pattern for at-least-once integration dispatch.
-- Execute after:
--   20260321_identity_and_ingest.sql

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
