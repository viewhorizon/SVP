# Índice estructural del sistema SVP

## Propósito

Este documento es el mapa canónico. Los diagramas vigentes de estructura, responsabilidades, flujo y actividad están en `docs/SYSTEM_DIAGRAMS.md`.

Este documento es el mapa canónico para evitar duplicar agentes, scripts, contratos o flujos. Antes de crear una nueva versión, se debe localizar el punto de extensión correspondiente aquí. La guía de ejecución demostrable está en `docs/OPERATIONAL_EVIDENCE.md`; la arquitectura funcional está en `docs/SVP_ARCHITECTURE.md`; el plan de continuidad está en `docs/BACKLOG_NEXT_SPRINTS.md`.

## Flujo principal

```text
Dominio (origen) -> actividades vinculadas -> actividad registrada -> voto/monitoreo
  -> fórmula de conversión (votos locales/globales + tiempo validado) -> puntos
```

La demo define los vínculos en `SIMULATION_DOMAIN_LINKS` (`src/SPVSystem.tsx`): Panadería → Panadero/Vendedor/Limpieza; Restaurante → Cocinero/Mesero/Limpieza; Peluquería → Peluquero/Recepcionista/Limpieza. La relación es de demostración y aún no está persistida en backend.

El dashboard y las integraciones usan el endpoint canónico `POST /api/svp/votes`, que calcula puntos con `point_rules`, escribe `points_ledger` y conserva el historial y la propagación de progreso a tareas vinculadas. Los votos sirven como insumo de conversión; no hay requisito documentado de usar votos para comprar.

## Puntos canónicos

| Responsabilidad | Fuente canónica | Regla |
| --- | --- | --- |
| Entrada frontend | `src/App.tsx` | No crear otra raíz de aplicación |
| Experiencia SVP | `src/SPVSystem.tsx` | Extender por componentes/hook, no duplicar la pantalla |
| Panel de inventario | `src/components/InventoryPanel.tsx` | Consume `/api/inventory/catalog`, `/api/inventory/me`, `/api/points/balance` y compra por `/api/inventory/purchase`; usa `requestJSON` + SWR |
| Estado SVP | `src/hooks/useSpv.ts` | No crear otro hook paralelo para votos |
| Cliente HTTP base | `src/services/httpClient.ts` | Toda llamada nueva debe reutilizar `requestJSON` |
| Cliente API MVP Neon | `src/services/neonClient.ts` | Lecturas del modelo SPV; los votos pasan por el cliente autenticado `spvApi.ts` |
| Adaptador de API del dashboard | `src/services/spvApi.ts` | Bootstrap de sesión y voto canónico activos; helpers de escritura de puntos se conservan pero no se exponen en la UI hasta resolver identidad/autorización. No hay evidencia de consumidores externos en este repositorio |
| Rutas del backend | `backend/src/routes/index.ts` | Registrar cada router una sola vez |
| Controlador MVP | `backend/src/routes/spvMvp.routes.ts` | Rutas de lectura y operaciones MVP distintas de voto |
| Modelo/persistencia | `backend/src/db`, `backend/sql` | Queries parametrizadas y migraciones versionadas |
| Validación | `backend/src/validation/schemas.ts` | Contratos Zod antes del controlador |
| Operaciones | `src/components/Sprint3/*` | Un panel por responsabilidad, usando rutas existentes |
| Migraciones | `scripts/run_migrations.js` + `backend/sql/*.sql` | Escribir nuevas migraciones SQL versionadas; no duplicar SQL consolidado |
| Tests | `backend/tests`, `tests/e2e` | Añadir pruebas al suite existente |

## Duplicaciones detectadas y tratamiento

### Clientes API y contrato por función

`src/services/spvApi.ts` y `src/services/neonClient.ts` no son equivalentes. La interfaz interna lee el modelo MVP desde `/api/spv/*`; voto y puntos pasan por rutas autenticadas. La búsqueda de referencias encontró `useSpv.ts` como único importador en el frontend. No hay evidencia de consumidores externos en el repositorio, pero eso no prueba que no existan fuera de él.

| Función exportada | Consumidor del repo | Ruta, esquema y persistencia | Clasificación/evidencia |
| --- | --- | --- | --- |
| `getSpvBootstrapState` | `useSpv.ts` | `GET /api/points/balance`, `/api/svp/votes/count`, `/api/svp/votes/limits`; autenticadas. Balance lee `points_wallet`/`points_ledger`; conteo consulta `votes` y `point_limits` | Activa; el bootstrap ahora usa el balance de la sesión. El argumento opcional se conserva por compatibilidad, pero no determina el usuario |
| `castVote` | `useSpv.ts` | `POST /api/svp/votes`; `votesCreateSchema`; escribe `votes`, `points_ledger`/`points_wallet`, usa `point_rules` y `point_limits`, y puede actualizar tareas/objetivos vinculados | Activa y transaccional; el frontend solo actualiza el saldo tras confirmación del backend |
| `transferPoints` | Ninguno en la UI actual | `POST /api/points/transfer`; `pointsTransferSchema`; ledger debit/credit en `points_ledger` y balance en `points_wallet` | Helper de compatibilidad; botón deshabilitado porque no se verificó vínculo entre `spv_users` y UUIDs de wallet |
| `creditPoints` | Ninguno en la UI actual | `POST /api/points/credit`; `pointsCreditSchema`; `points_ledger` y `points_wallet` | Helper sin consumidor; la ruta exige claim Firebase `admin: true`; no reexponer hasta que el proyecto configure emisores admin autorizados |
| `checkApiHealth` | Ninguno encontrado | `GET /health` existe | No usada; el dashboard consulta health mediante `neonClient.checkNeonHealth` |
| `getUsers` | Ninguno tras retirar el fallback del hook | Helper llama `GET /api/users`; ruta MVP real: `/api/spv/users`, responde `{ok,data}` desde `spv_users` | Histórica/no alineada; helper conserva fallback mock |
| `getActivities` | Ninguno | Helper llama `GET /api/activities`; ruta real: `/api/spv/activities`, responde `{ok,data}` desde `spv_activities` | Histórica/no alineada; helper convierte fallos en lista vacía |
| `getTransactions` | Ninguno | Helper llama `/api/transactions`; hay `/api/monitor/transactions`, con contrato de monitor distinto | No equivalente verificada; fallback a lista vacía |
| `getTableData` | Ninguno | Helper llama `/api/data/:tableName`; no hay ruta correspondiente | No implementada; fallback a lista vacía |
| `createActivity` | Ninguno tras mover CRUD interno a `neonClient` | Helper llama `POST /api/activities`; ruta actual `POST /api/spv/activities` usa `spv_activities` y devuelve `{ok,data}` | Histórica/no alineada; la ruta interna carece de auth/Zod |
| `updateActivity` | Ninguno | Helper usa `PATCH /api/activities/:id`; ruta real es `PUT /api/spv/activities/:id` | Histórica/no alineada; la interfaz interna actual solo refleja cambios tras respuesta exitosa de `neonClient` |
| `deleteActivity` | Ninguno | Helper usa `DELETE /api/activities/:id`; ruta real `DELETE /api/spv/activities/:id` marca `is_active=false` | Histórica/no alineada; la interfaz interna ya no oculta fallos con una eliminación local |
| `updateTransaction` | Ninguno | `PATCH /api/transactions/:id`; no se encontró ruta | No implementada; helper devuelve objeto local ante error |
| `deleteTransaction` | Ninguno | `DELETE /api/transactions/:id`; no se encontró ruta | No implementada; helper silencia fallos |
| `cancelTransfer` | Ninguno | `POST /api/points/transfer/:id/cancel`; no se encontró ruta | No implementada; helper silencia fallos |

`neonClient.ts` realiza las lecturas y el CRUD MVP por `/api/spv/*`; el selector de actividad y el dashboard usan filas persistidas y no insertan tarjetas ficticias cuando la API falla. Las acciones de transferencia/crédito están deshabilitadas mientras falte vínculo de identidad y autorización adecuada. El endpoint de crédito exige el custom claim Firebase `admin: true`; los débitos y consultas de balance por `userId` solo aceptan la propia cuenta salvo actor admin. Los endpoints MVP de `spvMvp.routes.ts` todavía carecen de autenticación y esquemas Zod: no tratarlos como listos para producción. El endpoint `GET /api/points/balance/:userId` sigue disponible por compatibilidad; el hook ya no lo usa para el saldo de sesión.

### Inventario y puntos SVP

`InventoryPanel.tsx` consume el catálogo y la colección del usuario desde `/api/inventory/*`, presenta el saldo de sesión y llama `/api/inventory/purchase` con clave de idempotencia. El backend debita `points_ledger`, entrega `user_inventory`, actualiza existencias y registra `cross_system_transactions`/`inventory_ledger_events` dentro de la transacción. En la base activa consultada el saldo responde, pero `/api/inventory/catalog` y `/api/inventory/me` devuelven 500 porque faltan las tablas creadas por `backend/sql/20260320_inventory_liveops_inventory.sql`; el panel muestra el error específico y no simula catálogo. Esta migración incluye semillas de demostración y no se ejecutó en esta revisión. Requiere autorización explícita antes de modificar la base activa. El selector de simulación se restringió al único origen de inventario declarado como simulado; no representa conexión con proveedor externo.

### Migraciones

`backend/sql/*.sql` es la fuente versionada prevista, pero `scripts/run_migrations.js` no es todavía fiable para despliegue: divide por `;`, continúa tras errores, omite `20260326_operational_alerts.sql` y `20260330_spv_mvp_tables.sql`, y no registra versiones aplicadas. `scripts/execute_sql.py`, `scripts/execute_migrations.js`, `scripts/execute_sprint3_migrations.js`, `scripts/migrations_consolidated.js` y `scripts/01_run_all_migrations.sql` son rutas alternas/históricas con distintos riesgos y esquemas. Ninguno debe ejecutarse hasta corregir y validar un único runner; el detalle por archivo está en `docs/LEGACY_DECISIONS.md`.

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

Última revisión: 2026-11-25.
