# Índice estructural del sistema SVP

## Propósito

Este documento es el mapa canónico. Los diagramas vigentes de estructura, responsabilidades, flujo y actividad están en `docs/SYSTEM_DIAGRAMS.md`.

Este documento es el mapa canónico para evitar duplicar agentes, scripts, contratos o flujos. Antes de crear una nueva versión, se debe localizar el punto de extensión correspondiente aquí. La guía de ejecución demostrable está en `docs/OPERATIONAL_EVIDENCE.md`; la arquitectura funcional está en `docs/SVP_ARCHITECTURE.md`; el plan de continuidad está en `docs/BACKLOG_NEXT_SPRINTS.md`.

## Flujo principal

```text
Actividad externa (voto MVP)
  -> src/SPVSystem.tsx -> src/hooks/useSpv.ts -> src/services/neonClient.ts
  -> /api/spv/vote -> backend/src/routes/spvMvp.routes.ts
  -> spv_users.points_balance + spv_history + tarea + objetivo estratégico

Compra desde inventario (flujo transaccional distinto)
  -> /api/inventory/purchase -> backend/src/routes/inventory.routes.ts
  -> points_wallet + points_ledger (débito) + user_inventory
  -> cross_system_transactions + inventory_ledger_events (hash-chain)

IMPORTANTE: el voto MVP acredita spv_users.points_balance, pero la compra debita points_wallet.
No existe un puente demostrado entre ambos saldos ni una vista de inventario en src/; no presentar
los puntos ganados por voto como saldo disponible para comprar hasta reconciliar identidades/saldos.
```

## Puntos canónicos

| Responsabilidad | Fuente canónica | Regla |
| --- | --- | --- |
| Entrada frontend | `src/App.tsx` | No crear otra raíz de aplicación |
| Experiencia SVP | `src/SPVSystem.tsx` | Extender por componentes/hook, no duplicar la pantalla |
| Estado SVP | `src/hooks/useSpv.ts` | No crear otro hook paralelo para votos |
| Cliente HTTP base | `src/services/httpClient.ts` | Toda llamada nueva debe reutilizar `requestJSON` |
| Cliente API MVP Neon | `src/services/neonClient.ts` | Fuente del flujo SPV real y de su trazabilidad |
| Adaptador de integración externa | `src/services/spvApi.ts` | Contrato público para plataformas suscritas: actividades, votos, puntos y transacciones; no eliminar ni congelar sin verificar consumidores externos |
| Rutas del backend | `backend/src/routes/index.ts` | Registrar cada router una sola vez |
| Controlador MVP | `backend/src/routes/spvMvp.routes.ts` | Validar contrato y orquestar transacción |
| Modelo/persistencia | `backend/src/db`, `backend/sql` | Queries parametrizadas y migraciones versionadas |
| Validación | `backend/src/validation/schemas.ts` | Contratos Zod antes del controlador |
| Operaciones | `src/components/Sprint3/*` | Un panel por responsabilidad, usando rutas existentes |
| Migraciones | `scripts/run_migrations.js` + `backend/sql/*.sql` | Escribir nuevas migraciones SQL versionadas; no duplicar SQL consolidado |
| Tests | `backend/tests`, `tests/e2e` | Añadir pruebas al suite existente |

## Duplicaciones detectadas y tratamiento

### Clientes API

`src/services/spvApi.ts` y `src/services/neonClient.ts` contienen contratos y llamadas parcialmente solapados, pero no son equivalentes. Evidencia de consumidores: `src/hooks/useSpv.ts` importa y llama `getSpvBootstrapState`, `getUsers`, `castVote`, `transferPoints` y `createActivity`; el camino de voto real también llama `neonClient.castVote`.

| Funciones de spvApi | Rutas actuales | Clasificación |
| --- | --- | --- |
| `getSpvBootstrapState` | `GET /api/points/balance/:userId`, `/api/votes/count`, `/api/votes/limits` | Implementadas; requieren auth |
| `castVote` | `POST /api/votes` | Implementada; requiere auth |
| `transferPoints` | `POST /api/points/transfer` | Implementada; requiere auth |
| `getUsers`, `getActivities`, `getTransactions`, `getTableData` | No se hallaron las rutas `/api/users`, `/api/activities`, `/api/transactions`, `/api/data/:tableName` en `backend/src/routes` | No implementadas en backend actual; algunos métodos degradan silenciosamente a mock/array vacío |
| `createActivity`, `updateActivity`, `updateTransaction`, deletes y cancel transfer | No se hallaron rutas correspondientes en el backend actual | No implementadas; varias funciones retornan éxito/datos locales silenciosamente |

`neonClient.ts` alimenta el dashboard con `/api/spv/*`. No eliminar ni considerar operativo un endpoint de `spvApi` solo porque tenga un helper cliente; confirmar ruta y contrato en backend.

### Migraciones

Existen `scripts/run_migrations.js`, `scripts/execute_migrations.js`, `scripts/migrations_consolidated.js`, `scripts/execute_sprint3_migrations.js` y el SQL consolidado. No deben ejecutarse indistintamente: `run_migrations.js` es el runner de referencia y `backend/sql/*.sql` es la fuente versionada. Los demás scripts requieren migración explícita antes de ser usados en producción.

### Tests y reportes

`tests/e2e`, `playwright-report` y `test-results` tienen responsabilidades diferentes: pruebas fuente, reporte generado y artefactos de ejecución. No copiar specs ni editar reportes generados manualmente.

## Reglas anti-duplicación

1. Buscar primero en este índice y en `backend/src/routes/index.ts`.
2. Preferir extender el contrato y módulo canónicos antes de crear otro archivo.
3. Una ruta, un controlador, un modelo de persistencia y un test de contrato.
4. No introducir fallback mock silencioso para datos de negocio.
5. Todo flujo externo debe conservar `externalDomain`, `externalReference`, `operationId` y `valueUnit`.
6. Toda nueva migración debe ser incremental, versionada y ejecutable una sola vez.
7. Si una pieza legacy debe permanecer, documentar su motivo y prohibir nuevas dependencias.

Última revisión: 2026-09-06.
