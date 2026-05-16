-- SPV MVP Tables for Testing
-- Creates the core tables needed for the prototype simulation

-- Users table
CREATE TABLE IF NOT EXISTS spv_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  points_balance INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activities table
CREATE TABLE IF NOT EXISTS spv_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'local' CHECK (type IN ('global', 'local')),
  votes_count INTEGER DEFAULT 0,
  points_reward INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table (transfers, votes rewards, etc)
CREATE TABLE IF NOT EXISTS spv_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES spv_users(id),
  to_user_id UUID REFERENCES spv_users(id),
  amount INTEGER NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('vote_reward', 'transfer', 'receive', 'adjustment', 'external')),
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- History table (audit log)
CREATE TABLE IF NOT EXISTS spv_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES spv_users(id),
  description TEXT NOT NULL,
  type VARCHAR(30) NOT NULL,
  amount INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'success',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simulation events table (for operations panel)
CREATE TABLE IF NOT EXISTS spv_simulation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  details TEXT,
  status VARCHAR(20) DEFAULT 'success',
  source_app VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_spv_users_username ON spv_users(username);
CREATE INDEX IF NOT EXISTS idx_spv_transactions_from_user ON spv_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_spv_transactions_to_user ON spv_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_spv_transactions_created ON spv_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spv_history_user ON spv_history(user_id);
CREATE INDEX IF NOT EXISTS idx_spv_history_created ON spv_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spv_simulation_events_created ON spv_simulation_events(created_at DESC);

-- Seed data for testing
INSERT INTO spv_users (username, name, email, points_balance) VALUES
  ('admin', 'Administrador', 'admin@svp.local', 1000),
  ('user1', 'Usuario Prueba 1', 'user1@svp.local', 500),
  ('user2', 'Usuario Prueba 2', 'user2@svp.local', 250),
  ('user3', 'Usuario Prueba 3', 'user3@svp.local', 100),
  ('demo', 'Demo User', 'demo@svp.local', 750)
ON CONFLICT (username) DO NOTHING;

INSERT INTO spv_activities (name, description, type, votes_count, points_reward) VALUES
  ('Completar tutorial', 'Terminar el tutorial de introduccion al sistema', 'global', 45, 50),
  ('Primer voto del dia', 'Realizar el primer voto del dia', 'global', 120, 10),
  ('Referir amigo', 'Invitar a un amigo al sistema', 'global', 23, 100),
  ('Completar perfil', 'Llenar todos los campos del perfil', 'local', 89, 25),
  ('Participar en encuesta', 'Responder encuesta semanal', 'local', 67, 15),
  ('Revisar documentacion', 'Leer la guia de usuario', 'local', 34, 20),
  ('Reportar bug', 'Reportar un problema tecnico', 'global', 12, 75),
  ('Sugerir mejora', 'Proponer una mejora al sistema', 'global', 28, 50),
  ('Actividad diaria', 'Iniciar sesion todos los dias', 'local', 156, 5),
  ('Meta semanal', 'Completar objetivos de la semana', 'global', 41, 100)
ON CONFLICT DO NOTHING;
