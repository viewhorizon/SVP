-- SVP System - All Migrations Consolidated
-- Executes all required migrations to set up the complete system

-- ============================================
-- 1. CORE TABLES: Users, Votes, Points, Ledger
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_system VARCHAR(100) NOT NULL,
  reference_id VARCHAR(255) NOT NULL,
  vote_type VARCHAR(50) NOT NULL CHECK (vote_type IN ('upvote', 'downvote', 'neutral')),
  points_delta INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_vote UNIQUE (user_id, source_system, reference_id)
);

CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  source_system VARCHAR(100),
  reference_id VARCHAR(255),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_source_system ON votes(source_system);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);

-- ============================================
-- 2. INVENTORY & LIVEOPS
-- ============================================
CREATE TABLE IF NOT EXISTS liveops_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_liveops_inventory_user_id ON liveops_inventory(user_id);

-- ============================================
-- 3. ACHIEVEMENTS & VOTING
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS achievement_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type VARCHAR(50) NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (achievement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievement_votes_achievement_id ON achievement_votes(achievement_id);

-- ============================================
-- 4. INVENTORY LEDGER & HASH CHAIN
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  item_id VARCHAR(100) NOT NULL,
  quantity_delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  source_system VARCHAR(100),
  reference_id VARCHAR(255),
  idempotency_key VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_hash_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sequence_number BIGINT NOT NULL,
  previous_hash VARCHAR(64),
  current_hash VARCHAR(64) NOT NULL,
  ledger_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_user_id ON inventory_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_created_at ON inventory_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_hash_chain_user_id ON ledger_hash_chain(user_id);

-- ============================================
-- 5. POLICY & RULES ENGINE
-- ============================================
CREATE TABLE IF NOT EXISTS policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  source_system VARCHAR(100) NOT NULL,
  rule_type VARCHAR(100) NOT NULL,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_policy_rules_source_system ON policy_rules(source_system);
CREATE INDEX IF NOT EXISTS idx_policy_rules_enabled ON policy_rules(enabled);

-- ============================================
-- 6. OUTBOX DISPATCHER & EVENT STREAMING
-- ============================================
CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  source_app VARCHAR(100) NOT NULL,
  source_event_id VARCHAR(255) NOT NULL,
  destination_app VARCHAR(100),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_event_idempotency UNIQUE (source_app, source_event_id)
);

CREATE TABLE IF NOT EXISTS outbox_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id UUID NOT NULL REFERENCES outbox(id) ON DELETE CASCADE,
  error_message TEXT,
  error_stack TEXT,
  failure_context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS outbox_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id UUID NOT NULL REFERENCES outbox(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  http_status_code INTEGER,
  response_body TEXT,
  dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  next_retry_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_outbox_processed ON outbox(processed);
CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox(created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_source_app_event ON outbox(source_app, source_event_id);
CREATE INDEX IF NOT EXISTS idx_outbox_retry_count ON outbox(retry_count) WHERE NOT processed;
CREATE INDEX IF NOT EXISTS idx_outbox_dead_letter_outbox_id ON outbox_dead_letter(outbox_id);
CREATE INDEX IF NOT EXISTS idx_outbox_dispatch_log_outbox_id ON outbox_dispatch_log(outbox_id);

-- ============================================
-- 7. MONITORING & ALERTS
-- ============================================
CREATE TABLE IF NOT EXISTS outbox_monitor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  value NUMERIC NOT NULL,
  dimensions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operational_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  context JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbox_monitor_created_at ON outbox_monitor(created_at);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_resolved ON operational_alerts(resolved);

-- ============================================
-- 8. RATE LIMITING
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limit_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  limit_type VARCHAR(100) NOT NULL,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  window_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_keys_key ON rate_limit_keys(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_keys_window_end ON rate_limit_keys(window_end);

-- ============================================
-- 9. IDENTITY & EVENT INGESTION
-- ============================================
CREATE TABLE IF NOT EXISTS identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) NOT NULL,
  external_source VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (external_id, external_source)
);

CREATE TABLE IF NOT EXISTS event_ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_identities_user_id ON identities(user_id);
CREATE INDEX IF NOT EXISTS idx_event_ingestion_log_processed ON event_ingestion_log(processed);

-- ============================================
-- Migrations complete
-- ============================================
