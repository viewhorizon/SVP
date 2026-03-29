-- Test manual de concurrencia para lifecycle de inventario (nxt-10)
-- Objetivo: validar que no hay sobregiro de cantidad ni saldos negativos por mutaciones simultaneas.

-- Requisitos:
-- 1) Ejecutar migraciones core + inventario + hash-chain.
-- 2) Tener dos sesiones SQL (A y B) conectadas al mismo ambiente.

-- Setup base (ejecutar una vez)
-- Reemplazar IDs por existentes si hace falta.
DO $$
DECLARE
  v_user_a UUID := '11111111-1111-1111-1111-111111111111';
  v_user_b UUID := '22222222-2222-2222-2222-222222222222';
  v_item UUID;
BEGIN
  SELECT item_id INTO v_item FROM inventory_catalog ORDER BY created_at ASC LIMIT 1;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'No hay items en inventory_catalog';
  END IF;

  INSERT INTO user_inventory (user_id, item_id, quantity, scope, park_id, metadata)
  SELECT v_user_a, v_item, 10, ic.scope, ic.park_id, '{"seed":"concurrency_test"}'::jsonb
  FROM inventory_catalog ic
  WHERE ic.item_id = v_item
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Setup listo con item %', v_item;
END $$;

-- Caso 1: carrera de transferencia simultanea sobre mismo item
-- Sesion A:
-- BEGIN;
-- SELECT quantity FROM user_inventory WHERE user_id='11111111-1111-1111-1111-111111111111' FOR UPDATE;
-- (mantener la transaccion abierta para simular lock)

-- Sesion B:
-- Intentar endpoint /api/inventory/lifecycle/transfer (o SQL equivalente) con quantity > disponible remanente.
-- Debe esperar lock o fallar por cantidad insuficiente, nunca dejar quantity < 0.

-- Caso 2: transform + destroy simultaneos sobre mismo item
-- Lanzar ambas operaciones en paralelo sobre misma fila FOR UPDATE.
-- Resultado esperado: serializacion por lock y consistencia final.

-- Verificaciones finales:
-- 1) Ninguna fila con quantity < 0
SELECT COUNT(*) AS negative_quantity_rows
FROM user_inventory
WHERE quantity < 0;

-- 2) Ledger hash-chain valido
-- (usar endpoint /api/inventory/ledger/verify o consulta dedicada)
