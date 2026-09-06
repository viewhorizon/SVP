# Índice estructural del sistema SVP

## Propósito

Este documento es el mapa canónico para evitar duplicar agentes, scripts, contratos o flujos. Antes de crear una nueva versión, se debe localizar el punto de extensión correspondiente aquí.

## Flujo principal

```text
Actividad externa
  -> src/SPVSystem.tsx
  -> src/hooks/useSpv.ts
  -> src/services/neonClient.ts
  -> /api/spv/vote
  -> backend/src/routes/spvMvp.routes.ts
  -> PostgreSQL/Neon
  -> saldo + historial + tarea + objetivo estratégico
```

## Puntos canónicos

| Responsabilidad | Fuente canónica | Regla |
| --- | --- | --- |
| Entrada frontend | `src/App.tsx` | No crear otra raíz de aplicación |
| Experiencia SVP | `src/SPVSystem.tsx` | Extender por componentes/hook, no duplicar la pantalla |
| Estado SVP | `src/hooks/useSpv.ts` | No crear otro hook paralelo para votos |
| Cliente HTTP base | `src/services/httpClient.ts` | Toda llamada nueva debe reutilizar `requestJSON` |
| Cliente API MVP Neon | `src/services/neonClient.ts` | Fuente del flujo SPV real y de su trazabilidad |
| Cliente API legacy | `src/services/spvApi.ts` | Mantener solo por compatibilidad; no agregar endpoints nuevos aquí |
| Rutas del backend | `backend/src/routes/index.ts` | Registrar cada router una sola vez |
| Controlador MVP | `backend/src/routes/spvMvp.routes.ts` | Validar contrato y orquestar transacción |
| Modelo/persistencia | `backend/src/db`, `backend/sql` | Queries parametrizadas y migraciones versionadas |
| Validación | `backend/src/validation/schemas.ts` | Contratos Zod antes del controlador |
| Operaciones | `src/components/Sprint3/*` | Un panel por responsabilidad, usando rutas existentes |
| Migraciones | `scripts/run_migrations.js` + `backend/sql/*.sql` | Escribir nuevas migraciones SQL versionadas; no duplicar SQL consolidado |
| Tests | `backend/tests`, `tests/e2e` | Añadir pruebas al suite existente |

## Duplicaciones detectadas y tratamiento

### Clientes API

`src/services/spvApi.ts` y `src/services/neonClient.ts` contienen contratos y llamadas parcialmente solapados. El flujo activo de SVP utiliza `neonClient.ts`; `spvApi.ts` queda congelado como compatibilidad legacy. Las nuevas funciones deben ir al cliente canónico y reutilizar `httpClient.ts`.

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
