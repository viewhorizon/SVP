-- Inventario (global/local), tasas LiveOps y transacciones cross-system
-- Ejecutar despues de 20260318_spv_points_core.sql

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

-- Seed minimo para pruebas locales
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