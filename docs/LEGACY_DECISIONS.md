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

## 2026-11-25 — Revisión de `spvApi.ts`, flujos de saldo y migraciones

- **Corrección de alcance:** la búsqueda del repositorio encontró `src/hooks/useSpv.ts` como único importador de `spvApi.ts`; no hay evidencia local de plataformas externas suscritas. La compatibilidad fuera del repositorio sigue sin confirmarse, así que el módulo no se eliminó. El mapa función→consumidor→ruta→schema→tablas está en `docs/SYSTEM_INDEX.md`.
- **Cambios de frontend:** el bootstrap usa el balance de la sesión; actividades, usuarios e historial vienen de Neon y no se reemplazan por datos ficticios ni se restauran del almacenamiento local. Los fetchers señalan fallos al hook; el CRUD interno usa `neonClient` y solo refleja respuesta exitosa. Los controles de transferencia/crédito manual se deshabilitaron.
- **Deuda de contrato:** la lista MVP usa `spv_users`, pero `/api/points/transfer` necesita un ID de wallet. No se encontró vínculo entre ambos modelos; por eso la transferencia permanece deshabilitada.
- **Corrección de autorización:** `/api/points/credit` ahora exige un custom claim verificado de Firebase `admin: true`; débitos y consultas de balance a otra cuenta también requieren admin. Se añadieron pruebas para rechazar créditos sin claim, débitos cruzados y lecturas cruzadas. El claim debe asignarse solo a emisores autorizados; la UI mantiene crédito manual deshabilitado y los webhooks firmados siguen siendo una ruta distinta.

### Auditoría individual de ejecutores

| Archivo | Propósito y tablas/objetos | Dependencias/riesgos | Decisión |
| --- | --- | --- | --- |
| `scripts/run_migrations.js` | Ejecuta la lista de ocho SQL versionados (`20260318`–`20260325`): `points_wallet`, `points_ledger`, `point_rules`, `point_limits`, `votes`, identity/ingest, inventario, logros, `outbox_events`, `inventory_ledger_events`, `policy_rules` | Omite `20260326_operational_alerts.sql` y `20260330_spv_mvp_tables.sql`; identidad aparece antes que inventario; rutas absolutas; `split(';')` rompe bloques `DO $$`; captura errores y aun así informa éxito; sin tabla de versiones | Camino previsto, no seguro para despliegue hasta reparar y probar |
| `scripts/execute_sql.py` | Alternativa Python que ejecuta la misma lista/tablas versionadas | Rutas absolutas y parser `split(';')`; ignora errores dentro de una transacción `psycopg` y luego intenta `commit`; sin registro de migraciones | Histórico; no ejecutar |
| `scripts/execute_migrations.js` | Ejecuta `scripts/01_run_all_migrations.sql`; no declara DDL propio | Modelo legado detallado en la fila SQL inferior; ruta absoluta; división por `;`; continúa ante fallos, cuenta errores como ejecutados y termina con éxito | Histórico; no ejecutar |
| `scripts/execute_sprint3_migrations.js` | DDL inline para `operational_alerts`, sus índices y vista `operational_alerts_active` | Duplica `backend/sql/20260326_operational_alerts.sql`; no valida `DATABASE_URL` explícitamente; continúa tras errores y declara éxito | Histórico; no ejecutar |
| `scripts/migrations_consolidated.js` | Copia parcial con `points_*`, `votes`, `identity_links`, `source_app_rates`, `external_activity_events`, `liveops_rates`, `inventory_catalog`, `user_inventory`, `cross_system_transactions`, achievements, `outbox_events`, `inventory_ledger_events` y `policy_rules`; incluye seeds | No incluye alertas ni tablas MVP; duplica SQL versionado; `split(';')`; suprime fallos como statements omitidos; sin registro de versiones | Histórico; no ejecutar |
| `scripts/01_run_all_migrations.sql` | Esquema consolidado anterior: `users`, `votes`, `user_points`, `ledger`, `liveops_inventory`, achievements, `inventory_ledger`, `ledger_hash_chain`, `policy_rules`, `outbox*`, `operational_alerts`, `rate_limit_keys`, `identities`, `event_ingestion_log` | Tablas/columnas incompatibles con el modelo versionado (`points_wallet`, `points_ledger`, `user_inventory`, `outbox_events`, `spv_*`); `IF NOT EXISTS` no transforma una tabla existente | Archivo de referencia legado; no ejecutar junto al esquema actual |

### Mapa de migraciones SQL versionadas

| Archivo | Tablas/objetos principales | Dependencias y relación |
| --- | --- | --- |
| `20260318_spv_points_core.sql` | Enums `points_direction`, `points_operation_type`, `point_limit_type`, `point_limit_scope`; `points_wallet`, `points_ledger`, `point_rules`, `point_limits`; trigger function `set_updated_at()` | Base de puntos; incluye reglas, límites y saldos seed. Debe preceder a migraciones que usan `set_updated_at()` |
| `20260318_votes_table.sql` | `votes` e índices | Contrato de voto canónico; se aplica después del core en la lista del runner |
| `20260320_inventory_liveops_inventory.sql` | `liveops_rates`, `inventory_catalog`, `user_inventory`, `cross_system_transactions`; índices/triggers y semillas | Usa `set_updated_at()` del core; `inventory_catalog` es FK requerida por logros |
| `20260321_identity_and_ingest.sql` | `identity_links`, `source_app_rates`, `external_activity_events`; índices/triggers y tarifas seed | Usa `set_updated_at()` del core; el runner la ordena antes de la versión `20260320` aunque es independiente de ese catálogo |
| `20260322_achievements_voting.sql` | `achievement_definitions`, `achievement_votes` | FK `reward_item_id → inventory_catalog`; depende del inventario `20260320` y de `set_updated_at()` |
| `20260323_outbox_dispatcher.sql` | `outbox_events`, índices y trigger | Usa `set_updated_at()` |
| `20260324_inventory_ledger_hash_chain.sql` | `inventory_ledger_events`, índices y trigger | Usa `set_updated_at()` |
| `20260325_policy_rules.sql` | `policy_rules`, índices y trigger | Usa `set_updated_at()`; el schema canónico difiere del SQL consolidado antiguo |
| `20260326_operational_alerts.sql` | `operational_alerts`, `operational_alerts_active`, índices y comentarios | Migración canónica ausente del array de ambos runners que ejecutan el conjunto versionado; el runner Sprint 3 la copia inline |
| `20260330_spv_mvp_tables.sql` | `spv_users`, `spv_activities`, `spv_transactions`, `spv_history`, `spv_simulation_events`; índices y seeds | Requerida por las lecturas/CRUD de `/api/spv/*`; ausente del array de runners versionados |

`backend/sql/seed_demo_data.sql` inserta fixtures sobre el modelo canónico y `test_*.sql` son pruebas manuales/SQL, no migraciones del runner. No se encontraron referencias a estos ejecutores en `package.json` ni en `.github/workflows`; eso no descarta ejecución manual o fuera del repositorio.

**Decisión:** no se ejecutó ningún runner, no se cambió SQL y no se eliminó ningún archivo. Se mantiene el camino versionado como intención, no como garantía operativa; requiere registro de migraciones, ejecución transaccional apropiada, orden/dependencias correctas, inclusión explícita de versiones faltantes y fallo no-cero ante error.

### 2026-11-25 — Integración de inventario en el panel SVP

- `src/components/InventoryPanel.tsx` ya consulta catálogo, inventario del usuario y saldo mediante rutas existentes; las compras llaman `/api/inventory/purchase` con una clave de idempotencia y refrescan los tres datos tras éxito.
- Las rutas de compra integran wallet/ledger SVP, stock de catálogo, inventario de usuario y ledger de inventario dentro de una transacción. No se inventó un proveedor externo ni un mercado nuevo.
- Validación real del preview: `/api/points/balance` responde 200, pero `/api/inventory/catalog` y `/api/inventory/me` responden 500 por ausencia de tablas de inventario. La pantalla presenta el error retornado por el backend en vez de mostrar datos ficticios.
- La migración `backend/sql/20260320_inventory_liveops_inventory.sql` crea el catálogo/inventario y añade artículos y tasas de demostración. No se aplicó a la base activa; queda pendiente de aprobación explícita y se registra como tarea separada.
- El selector de simulación solo ofrece `Inventario externo (simulado)`; el antiguo listado estático de panadería/restaurante/peluquería no probaba suscripciones ni contratos existentes y se retiró.

## 2026-11-26/27 — Revisión del contrato de integración SVP e inmutabilidad

- **Corrección del registro:** el usuario adjuntó `SVP_Integration_Guide_v1_EN` en inglés el 2026-11-26. La búsqueda inicial no consultó el adjunto y la afirmación de que no podía confirmarse el idioma era incorrecta. Se incorporó una copia de trabajo en `docs/SVP_Integration_Guide_v1_EN.md`; el adjunto original permanece intacto. El contrato anterior `backend/TIERLIST_SVP_API_CONTRACT.md` es otro documento, en español.
- **Alineación funcional:** la fórmula del flujo de eventos actualmente implementado es `activityHours * votosTotales` (con tarifas/reglas), pero el usuario confirmó el 2026-11-27 que la fórmula objetivo es `((global_votes + local_votes) / worldwide_similar_activities_count) * registered_user_activity_hours + svp_voting_bonus`. El ejemplo de 1200 + 1200 votos, divisor 150 y 3 horas da 48 antes del bono. El contrato español ahora distingue el comportamiento actual del objetivo.
- **Hallazgo de seguridad:** `/api/events/validate` y `/api/events/results` solo comprueban `x-webhook-secret` si `WEBHOOK_SHARED_SECRET` está configurado; cuando no lo está, la comprobación permite continuar. No verifican Bearer ni HMAC. El HMAC existente de `POST /api/webhooks/points/credit` no se extiende a estas rutas. El contrato ahora describe esta brecha; no se afirma que la autenticación esté corregida. Requisito recomendado antes de exposición pública: autenticación/firma obligatoria, verificación HMAC sobre el cuerpo original y timestamp, protección anti-replay y pruebas de contrato.
- **Principio de inmutabilidad recomendado:** tratar los movimientos confirmados del ledger como append-only; nunca editarlos/borrarlos y usar asientos compensatorios enlazados al original para corregir errores. Mantener mutables perfiles, catálogos y vínculos cuando la operación lo necesite, pero auditar actor, fecha, motivo y valores cambiados.
- **Garantía criptográfica recomendada:** la hash-chain ayuda a detectar modificaciones, pero no basta para impedir que un operador con control de la base reescriba todos los registros y recalcule la cadena. Recomendación no implementada: anclar periódicamente hashes de cierre firmados fuera de la base transaccional, con almacenamiento independiente, versión del esquema/hash, timestamp y política de retención/verificación.
- **Alcance económico:** la comparación con oro/Bitcoin se registra como inspiración para escasez, reglas previsibles y verificabilidad, no como equivalencia: los puntos SVP no quedan definidos por ello como dinero, activo negociable ni promesa de convertibilidad.
- **Diferencias adicionales del v1 frente al código:** NestJS vs Express; fórmula con divisor de actividades similares/bono vs cálculo de eventos `hours × votes` más tarifas y políticas; votos ilimitados/confirmación por criterio vs límite diario configurable y sin `criterion`; rutas de actividad, gasto, valuación y liberación ausentes; IdP JWT/M2M por plataforma no alineado con la autenticación existente; modelo lock/frozen vs compra y lifecycle de inventario; Redis distribuido no confirmado. La matriz detallada quedó en el addendum de `docs/SVP_Integration_Guide_v1_EN.md`.
- **Decisión resuelta (2026-11-27):** el usuario confirma que `SVP_Integration_Guide_v1_EN` y sus endpoints son el objetivo; el backend debe converger al guide, no al revés. Vault es la plataforma vinculada de objetos; SVP conserva los puntos y bloquea el saldo asociado al objeto hasta su conversión de regreso. La apreciación/depreciación modifica el precio del objeto por propiedades de juego y demanda, no autoriza por sí misma emitir o destruir puntos SVP.
- **Pendientes de especificación:** definición exacta del denominador y snapshots; conteo/duplicación entre ámbitos global/local; verificación y límites de horas; regla del bono; redondeo/versionado; unidad y rescate del lock 1:1; settlement entre comprador/vendedor y titularidad del lock al comerciar; autoridad de precio; autorización/idempotencia por endpoint; HMAC; callbacks; cronograma NestJS/Redis; y política de anclaje externo. Checklist en `docs/SVP_Integration_Guide_v1_EN.md`.
- **Estado:** checklist y aclaraciones quedaron documentados; los aportes aceptados (HMAC/replay en M2M, ledger append-only con compensaciones e hitos periódicos firmados fuera de la base) son requisitos de implementación, pero aún no están implementados. No afirmar que están activos.

Última revisión: 2026-11-27.
