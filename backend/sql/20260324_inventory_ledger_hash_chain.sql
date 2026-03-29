-- Hash-chain ledger for inventory mutations (nxt-01)
-- Execute after:
--   20260318_spv_points_core.sql
--   20260320_inventory_liveops_inventory.sql

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