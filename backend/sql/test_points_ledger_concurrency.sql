-- Test manual de concurrencia para points_ledger y points_wallet (nxt-10)
-- Objetivo: validar invariantes contables bajo operaciones simultaneas.

-- Requisitos:
-- 1) Migraciones core ejecutadas (20260318_spv_points_core.sql)
-- 2) Dos sesiones SQL activas (A y B)
-- 3) Usuario de prueba existente

-- Setup sugerido (ajustar UUID si hace falta)
DO $$
DECLARE
  v_user UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  INSERT INTO points_wallet (user_id, available_points, lifetime_points)
  VALUES (v_user, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Credito base para pruebas de debito concurrente
  UPDATE points_wallet
  SET available_points = 10,
      lifetime_points = GREATEST(lifetime_points, 10),
      updated_at = NOW()
  WHERE user_id = v_user;
END $$;

-- Caso 1: debitos concurrentes que exceden saldo
-- Sesion A (mantener abierta):
-- BEGIN;
-- SELECT available_points FROM points_wallet
-- WHERE user_id='11111111-1111-1111-1111-111111111111'
-- FOR UPDATE;

-- Sesion B:
-- Intentar debito por API o SQL equivalente en paralelo.
-- Resultado esperado: serializacion por lock y al menos una operacion rechazada.

-- Caso 2: transferencias cruzadas simultaneas
-- Ejecutar dos transferencias opuestas al mismo tiempo entre A y B.
-- Resultado esperado: suma neta consistente, sin saldos negativos.

-- Verificacion 1: no hay saldos negativos
SELECT COUNT(*) AS negative_wallets
FROM points_wallet
WHERE available_points < 0;

-- Verificacion 2: conciliacion basica ledger vs wallet
-- points_ledger.amount es positivo; el signo se interpreta por direction.
SELECT
  w.user_id,
  w.available_points,
  COALESCE(SUM(CASE WHEN l.direction = 'CREDIT' THEN l.amount ELSE -l.amount END), 0) AS ledger_net
FROM points_wallet w
LEFT JOIN points_ledger l ON l.user_id = w.user_id
GROUP BY w.user_id, w.available_points
ORDER BY w.user_id;
