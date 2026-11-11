# Registro de decisiones sobre piezas históricas

## Propósito

Este registro evita eliminar o congelar código fundamental por una inferencia. Cada descarte, reclasificación o compatibilidad histórica debe indicar evidencia y reemplazo.

## 2026-09-06 — `src/services/spvApi.ts`

- **Decisión inicial revisada:** había sido descrito como cliente legacy congelado.
- **Verificación:** el módulo contiene el contrato de actividades, votos, puntos y transacciones (`/api/activities`, `/api/votes`, `/api/points`, `/api/transactions`). `backend/API_DOCS.md` documenta esos endpoints como integración externa y los tests de contrato usan `/api/votes` y `/api/points`.
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

## 2026-10-29 — Selectores de eventos sintéticos e inventario

- El selector de actividad SVP es la fuente funcional: solo ofrece actividades cargadas desde el contrato `/api/spv/activities` y sirve para probar el flujo de voto y acumulación de valor.
- El selector de dominio (`inventory`, `crm`, `ecommerce`, `custom`) identifica el sistema externo suscrito que origina la actividad; no representa tablas locales ni inventa integraciones externas.
- `custom` ahora solicita el nombre del sistema externo antes de enviar el evento. No crea una actividad automáticamente: la tarjeta debe crearse mediante el formulario de actividades y persistirse por su endpoint canónico.
- El inventario existente se conserva como consumidor posterior del saldo/ledger SVP mediante `/api/inventory/*`; no se crea un modelo paralelo de puntos ni una migración nueva.
- Los cuatro scripts de migración revisados no fueron modificados en esta tarea porque son runners/referencias históricas y no son necesarios para corregir la semántica de los selectores.

## 2026-11-11 — Auditoría de puntos e inventario

- **Evidencia:** `backend/src/routes/spvMvp.routes.ts` registra los votos en `spv_users.points_balance` y `spv_history`; no llama a `appendLedgerEntry`.
- **Evidencia:** `backend/src/routes/inventory.routes.ts` compra con `appendLedgerEntry` sobre `points_wallet`, y registra además `user_inventory`, `cross_system_transactions` e `inventory_ledger_events` dentro de la misma transacción.
- **Conclusión:** son dos fuentes de saldo independientes. No hay integración que permita gastar automáticamente puntos acumulados por el flujo de voto MVP. No se debe afirmar que inventario y votos ya comparten un wallet.
- **Identidad:** inventario deriva `userId` de `requireAuth`; el flujo MVP recibe `userId` de body y usa tabla `spv_users`. No está verificada la equivalencia UUID entre estos espacios.
- **UI:** no se hallaron consumidores frontend de `/api/inventory/catalog`, `/api/inventory/me` o `/api/inventory/purchase`.
- **Migraciones:** `scripts/run_migrations.js` + `backend/sql/*.sql` es el camino versionado previsto, pero su runner actual no es seguro para afirmar éxito: divide SQL por `;`, continúa tras errores de cada sentencia y aun así imprime completado. La lista además procesa `20260321_identity_and_ingest.sql` antes de `20260320_inventory_liveops_inventory.sql` pese a las fechas. Requiere reparar/validar antes de considerarlo fiable en despliegue.
- `scripts/execute_migrations.js` aplica `scripts/01_run_all_migrations.sql` (modelo legado con `users`, `user_points`, `ledger`, `liveops_inventory`); divide por `;`, ignora errores individuales y declara éxito.
- `scripts/execute_sprint3_migrations.js` tiene el DDL de `operational_alerts` inline y también continúa pese a errores; no sigue el conjunto versionado.
- `scripts/migrations_consolidated.js` contiene un esquema consolidado alternativo con nombres/columnas divergentes y no es la fuente canónica.
- **Decisión:** no ejecutar ni borrar runners históricos durante esta auditoría. Se recomienda usar migraciones SQL versionadas solo tras validar los cambios en base de datos desechable y corregir el runner, con registro de migraciones y fallo no-cero ante errores.
- **Corrección:** se retiró una guarda inválida de la ruta de compra que referenciaba `fromUserId` y `toUserId` fuera de su alcance; no correspondía al contrato de compra.
- **Próxima decisión requerida:** definir una única identidad canónica y migrar/acreditar votos al ledger antes de habilitar compras con puntos ganados por votos. No se hizo una migración de datos en esta auditoría.
- **Mapa de `spvApi.ts`:** el hook `src/hooks/useSpv.ts` llama bootstrap, usuarios, voto, transferencia y creación de actividad. Balance/conteo/límites, `POST /api/votes` y `POST /api/points/transfer` tienen rutas actuales protegidas por autenticación. No se encontraron rutas para `/api/users`, `/api/activities`, `/api/transactions` ni `/api/data/*`, ni CRUD/cancelación; los helpers correspondientes no deben tratar sus fallbacks silenciosos como persistencia.
- **Pruebas:** `backend/tests/api.integration.test.ts` cubre `/api/votes` y `/api/points`; no hay evidencia de prueba de contrato para inventario ni el adaptador parcial.

Última revisión: 2026-11-11.
