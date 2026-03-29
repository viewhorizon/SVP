# Runbook - Dispatcher y Ledger

Guia operativa para incidentes comunes de outbox/dispatcher y ledger de inventario.

## 1) Outbox saturado o eventos estancados

- Sintoma:
  - `GET /api/outbox/pending` muestra alto backlog por mucho tiempo.
- Acciones:
  - Verificar `OUTBOX_DISPATCH_INTERVAL_MS` y `OUTBOX_DISPATCH_BATCH_LIMIT`.
  - Ejecutar dispatch manual: `POST /api/outbox/dispatch?limit=100`.
  - Revisar `last_error` y `retry_count` en `outbox_events`.
  - Si supera max intentos, revisar `dead_letter` y reprocesar manualmente.

## 2) Replay o duplicacion de eventos externos

- Sintoma:
  - Reintentos con mismo `sourceApp + eventId`.
- Acciones:
  - Confirmar constraint unica en `external_activity_events`.
  - Verificar respuestas `idempotent: true` en endpoints de ingesta.
  - Revisar headers `Idempotency-Key` y firma HMAC.

## 3) Sospecha de manipulacion de ledger de inventario

- Sintoma:
  - Desbalance entre inventario y puntos, o auditoria inconsistente.
- Acciones:
  - Ejecutar `GET /api/inventory/ledger/verify`.
  - Revisar `issues[]` (`previous_hash_mismatch` / `current_hash_mismatch`).
  - Identificar rango temporal afectado y congelar mutaciones si aplica.
  - Aplicar compensaciones por eventos de reversal, no borrar historial.

## 4) Saldo insuficiente inesperado en lifecycle

- Sintoma:
  - `409 Saldo insuficiente` en transfer/transform con impacto en puntos.
- Acciones:
  - Revisar valor equivalente del item (`metadata.points_equivalent` o `price_spv`).
  - Confirmar override recibido (`pointsValuePerItem` / `pointsDelta`).
  - Verificar `points_wallet.available_points` y entradas de `points_ledger`.

## 5) Checklist post-incidente

- Documentar causa raiz y ventana de impacto.
- Registrar transacciones afectadas (`requestId`, `eventId`, `transaction_id`).
- Generar tareas de hardening en Kanban (`nxt-10`, `nxt-11`, `nxt-12`).
