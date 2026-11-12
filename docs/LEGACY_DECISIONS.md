# Registro de decisiones sobre piezas históricas

## Propósito

Este registro evita eliminar o congelar código fundamental por una inferencia. Cada descarte, reclasificación o compatibilidad histórica debe indicar evidencia y reemplazo.

## 2026-09-06 — `src/services/spvApi.ts`

- **Decisión inicial revisada:** había sido descrito como cliente legacy congelado.
- **Verificación:** el módulo contiene el contrato de actividades, votos, puntos y transacciones (`/api/activities`, `/api/svp/votes`, `/api/points`, `/api/transactions`). `backend/API_DOCS.md` documenta esos endpoints como integración externa y los tests de contrato usan `/api/svp/votes` y `/api/points`.
- **Decisión correcta:** conservarlo y reclasificarlo como adaptador de integración externa.
- **Razón:** plataformas externas suscritas al SVP pueden depender de ese contrato aunque el dashboard interno use `neonClient.ts`.
- **Acción:** no se eliminó ni se congeló la lógica; se corrigió únicamente la documentación y el comentario de responsabilidad.
- **Regla:** cualquier cambio de estos endpoints requiere revisión de compatibilidad, idempotencia y pruebas de contrato.

## 2026-09-06 — Runners históricos de migración

- `scripts/execute_migrations.js`, `scripts/execute_sprint3_migrations.js`, `scripts/migrations_consolidated.js` y `scripts/01_run_all_migrations.sql` fueron marcados como referencias históricas.
- **Razón:** existe un camino canónico (`scripts/run_migrations.js` + `backend/sql/*.sql`) y mantener varios runners activos puede ejecutar esquemas divergentes.
- **Acción:** no se borraron ni se alteró su lógica de ejecución; solo se añadió una advertencia de referencia. Antes de eliminar cualquiera se debe comprobar historial, CI, despliegues y consumidores.

## Terminología

- **MVP:** primera superficie funcional verificable del flujo SVP; no significa que el contrato externo sea provisional o descartable.
- **Fallback:** respuesta alternativa cuando falla una llamada, como datos demo o un array vacío. Un fallback de UI no es una fuente de verdad y debe mostrarse como estado degradado.
- **Legacy/histórico:** pieza existente cuya compatibilidad debe investigarse; no significa automáticamente que esté obsoleta.

## 2026-11-11 — Corrección semántica de dominios

- Corrección de la decisión anterior: `Dominio (Origen)` es el negocio/local (p. ej. Panadería), no la clase global/local de actividad ni la aplicación externa. La demo ahora expresa la relación explícita dominio→actividad.
- La demo tiene las relaciones descritas en `docs/SVP_ARCHITECTURE.md`; son configuración frontend, no asociaciones persistidas.
- No se ha definido que los votos se usen para comprar. Las rutas de inventario son independientes y no deben conectarse al cálculo de puntos sin un requerimiento explícito.
- Los cuatro scripts de migración revisados no fueron modificados en esta tarea porque son runners/referencias históricas y no son necesarios para corregir la semántica de los selectores.

## 2026-11-11 — Auditoría de puntos e inventario

- **Evidencia histórica previa a la migración:** el endpoint retirado `POST /api/spv/vote` escribía `spv_users.points_balance` y `spv_history` sin `appendLedgerEntry`; esos efectos de historial y tareas se trasladaron a la transacción canónica `/api/svp/votes`.
- **Evidencia:** `backend/src/routes/inventory.routes.ts` compra con `appendLedgerEntry` sobre `points_wallet`, y registra además `user_inventory`, `cross_system_transactions` e `inventory_ledger_events` dentro de la misma transacción.
- **Conclusión corregida:** los modelos de saldo son independientes, pero eso no define una relación de compra requerida. No se debe inferir que los votos o puntos SVP compren inventario; el propósito especificado para votos es alimentar la fórmula de conversión a puntos.
- **Identidad:** inventario y votos canónicos derivan `userId` de `requireAuth`; el endpoint de voto anterior ya no acepta `userId` ni puntos desde el body. La equivalencia UUID con los modelos MVP de lectura aún debe confirmarse.
- **UI:** no se hallaron consumidores frontend de `/api/inventory/catalog`, `/api/inventory/me` o `/api/inventory/purchase`.
- **Migraciones:** `scripts/run_migrations.js` + `backend/sql/*.sql` es el camino versionado previsto, pero su runner actual no es seguro para afirmar éxito: divide SQL por `;`, continúa tras errores de cada sentencia y aun así imprime completado. La lista además procesa `20260321_identity_and_ingest.sql` antes de `20260320_inventory_liveops_inventory.sql` pese a las fechas. Requiere reparar/validar antes de considerarlo fiable en despliegue.
- `scripts/execute_migrations.js` aplica `scripts/01_run_all_migrations.sql` (modelo legado con `users`, `user_points`, `ledger`, `liveops_inventory`); divide por `;`, ignora errores individuales y declara éxito.
- `scripts/execute_sprint3_migrations.js` tiene el DDL de `operational_alerts` inline y también continúa pese a errores; no sigue el conjunto versionado.
- `scripts/migrations_consolidated.js` contiene un esquema consolidado alternativo con nombres/columnas divergentes y no es la fuente canónica.
- **Decisión:** no ejecutar ni borrar runners históricos durante esta auditoría. Se recomienda usar migraciones SQL versionadas solo tras validar los cambios en base de datos desechable y corregir el runner, con registro de migraciones y fallo no-cero ante errores.
- **Corrección:** se retiró una guarda inválida de la ruta de compra que referenciaba `fromUserId` y `toUserId` fuera de su alcance; no correspondía al contrato de compra.
- **Corrección:** no se requiere diseñar puente de compra. El dashboard y el contrato de voto ya convergen en `/api/svp/votes`; las relaciones de dominio-actividad siguen siendo configuración de demostración salvo que se requieran fuera de ella.
- **Mapa de `spvApi.ts`:** `src/hooks/useSpv.ts` llama bootstrap, usuarios, voto, transferencia y creación de actividad. Balance/conteo/límites, `POST /api/svp/votes` y `POST /api/points/transfer` tienen rutas protegidas. Los helpers llaman `/api/users` y `/api/activities`, pero las rutas MVP disponibles son `/api/spv/users` y `/api/spv/activities`; path y contrato no coinciden. No se hallaron `/api/transactions` ni `/api/data/*` ni rutas de CRUD/cancelación equivalentes. Evidencia de fallbacks: `spvApi.ts:124-162, 200-269` y `useSpv.ts:317-357, 367-376`.
- **Pruebas:** `backend/tests/api.integration.test.ts` cubre `/api/svp/votes` y `/api/points`; no hay evidencia de prueba de contrato para inventario ni el adaptador parcial.

Última revisión: 2026-11-11.
