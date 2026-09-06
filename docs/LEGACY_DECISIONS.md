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

Última revisión: 2026-09-06.
