# Code Integrity Checklist

## Alcance

Auditoría del MVP SVP: frontend React/Vite, backend Express, PostgreSQL/Neon, paneles de Operaciones y Monitoreo, pruebas y documentación.

Estados: `PASS` verificado, `PARTIAL` implementado con riesgos, `FAIL` no cumple, `BLOCKED` depende del entorno.

## Documentos existentes

| Documento | Qué cubre | Evaluación |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | Capas, rutas, persistencia y flujo general | Existe, pero no es un checklist de integridad ni describe completamente MVC |
| `docs/RELEASE_CHECKLIST.md` | Preparación de release | Existe; útil para release, no sustituye esta auditoría |
| `docs/TESTING_MVP_STATUS.md` | Tests, cobertura, E2E y hallazgos | Existe y contiene evidencia ejecutada |
| `docs/TESTING_SPRINT3.md` | Operaciones, observabilidad y pruebas de Sprint 3 | Existe; debe leerse junto con esta auditoría |
| `docs/README.BUILD_AND_RUN.md` | Arranque y comandos | Existe; ahora incluye `npm run dev:api` como procedimiento operativo |

Conclusión: antes de este documento no existía un checklist integral que relacionara calidad de código, arquitectura, paneles, contratos API y persistencia frontend → backend → Neon.

## Checklist ejecutivo

### 1. Arquitectura y responsabilidades

- [x] Frontend organizado en páginas, hooks, servicios y componentes especializados.
- [x] Backend separado en rutas, validación, servicios y acceso PostgreSQL.
- [x] `src/services/spvApi.ts` y `src/services/neonClient.ts` aíslan llamadas HTTP.
- [x] `backend/src/validation/schemas.ts` centraliza validación Zod.
- [~] MVC clásico completo: existe separación Controller/Service/Model funcional, pero no hay clases o directorios MVC explícitos; las rutas contienen parte de la orquestación de transacciones.
- [ ] Contratos tipados compartidos entre frontend y backend; actualmente hay interfaces duplicadas en frontend y schemas/backend separados.

### 2. Frontend con propósito

- [x] Actividades, puntos, historial, operaciones y Kanban tienen una función de producto identificable.
- [x] Voto real conectado a Neon y propagado a saldo, historial, tarea y objetivo.
- [x] Inventory, CRM y E-commerce se modelan como dominios externos suscritos que originan actividades SVP.
- [x] La simulación permite seleccionar la actividad puente y ejecutar el contrato real de voto.
- [x] Health API muestra disponibilidad del backend y base de datos.
- [x] Paneles operativos exponen carga, errores, replay, alertas y conciliación.
- [~] Algunos fallbacks muestran usuarios mock cuando API falla (`src/services/spvApi.ts`, `src/hooks/useSpv.ts`); válido para demo, no válido como estado de producción.
- [~] Historial, vista y trazabilidad usan `localStorage`; es apropiado para preferencias/local UX, pero no debe ser la fuente de verdad de datos de negocio.
- [ ] El frontend debe mostrar estado `degraded/demo` cuando usa fallback, nunca presentarlo como datos Neon reales.

### 3. Frontend → backend → Neon

- [x] Vite hace proxy de `/api` y `/health` al backend Express.
- [x] Backend crea `Pool` con `DATABASE_URL` y ejecuta consultas parametrizadas.
- [x] `/health` ejecuta `SELECT 1` y distingue backend/base de datos no disponible.
- [x] Endpoints SPV de actividades, usuarios, historial, transacciones, tareas, objetivos, voto y transferencia están conectados.
- [x] Prueba real validó `actividad → voto → puntos → historial → task-4 → strategic-2`.
- [x] Casos inválidos devuelven 400/404 y no mutan datos.
- [~] Algunas funciones legacy en `spvApi.ts` silencian errores y devuelven `false`, `[]` o `null`.
- [ ] Migrar errores silenciosos a un resultado discriminado `{ data, error, source }` para distinguir vacío real de backend caído.

### 4. Paneles de Operaciones y Monitoreo

- [x] Dead Letter, Alertas, Load Test y Conciliación están modularizados por responsabilidad.
- [x] Las llamadas se compararon con las rutas backend reales.
- [x] Conciliación usa `/api/v1/reconciliation/report`.
- [x] Dead Letter usa estadísticas y replay reales.
- [x] Load Test usa `/api/v1/load-test/run` y el contrato de respuesta del backend.
- [x] Acciones no soportadas se deshabilitan o muestran estado no disponible.
- [x] Cada panel tiene feedback visual de carga/error/éxito.
- [~] Deben añadirse tests de contrato por panel para evitar futuras divergencias de endpoint.
- [ ] Validar en CI con backend activo y base de datos de prueba.

### 5. Simulación y observabilidad

- [x] Los dominios Inventory/CRM/E-commerce representan actividades externas suscritas al SVP.
- [x] La actividad externa se valida en el controlador y se registra con `externalDomain`, `externalReference`, `operationId` y `valueUnit: SVP_POINTS`.
- [x] El flujo de simulación ejecuta actividad externa → voto → valor SVP → saldo → historial → tarea/objetivo.
- [x] Los eventos sirven como feedback visual y consola de operación.
- [~] Cotización, comercio o uso de puntos como propiedad de inventario gamer queda preparado por trazabilidad, pero requiere un mercado/reglas externas antes de considerarse valor negociable.
- [x] Backend agrega `x-request-id` y logs estructurados de método, ruta, status y duración.
- [x] Health API y paneles exponen degradación.
- [~] Simulación todavía usa `Math.random()` y `setTimeout()` para eventos visuales; correcto para demo, no debe confundirse con telemetría real.
- [ ] Añadir un identificador de sesión de simulación y un modo explícito `demo`/`live` en la API y UI.

### 6. Calidad, seguridad y manejo de errores

- [x] Validación Zod en rutas sensibles.
- [x] Queries parametrizadas.
- [x] Voto con transacción y rollback.
- [x] HMAC/replay protection cubiertos por tests existentes.
- [x] Errores operativos se registran y se muestran de forma contextual.
- [~] Hay `console.log("[v0]")` de diagnóstico en rutas cliente; deben consolidarse o eliminarse cuando deje de ser necesario depurar.
- [~] El token demo se inicializa en `localStorage`; aceptable solo para entorno demo, no para autenticación de producción.
- [ ] Añadir límites/rate limiting y autenticación de producción antes de release público.

### 7. Tests y release

- [x] `npm run check` aprobado.
- [x] `npm run build` aprobado.
- [x] API: 17/17 tests aprobados.
- [x] Cobertura registrada: 60.14% statements, 41.19% branches, 59.21% functions, 62.43% lines (17 tests).
- [x] E2E alternativo con `agent-browser` verificado.
- [~] Playwright formal preparado y añadido al CI, pero bloqueado en este VM por `libnspr4.so` ausente.
- [ ] Ejecutar Playwright en CI y conservar artefactos/reporte.
- [ ] Añadir tests de contrato para los cuatro paneles operativos.

## Hallazgos priorizados

### P0 — bloquear producción

1. Autenticación demo/localStorage no debe considerarse autenticación de producción.
2. Fallbacks mock deben quedar limitados a modo demo y señalizados en UI.
3. Playwright formal debe ejecutarse en CI con navegador instalado.

### P1 — siguiente sprint

1. Crear contratos compartidos o generar tipos desde OpenAPI/Zod.
2. Sustituir errores silenciosos por estados explícitos de API.
3. Añadir tests de contrato para Operaciones/Monitoreo.
4. Separar orquestación transaccional de las rutas en servicios de aplicación.

### P2 — calidad continua

1. Limpiar logs de depuración.
2. Añadir métricas de cobertura mínima en CI.
3. Añadir modo de simulación con session ID y exportación de eventos.
4. Mantener `docs/TESTING_MVP_STATUS.md` y este checklist en cada release.

## Criterio de aceptación de integridad

El sistema podrá considerarse íntegro para release cuando todos los P0 estén resueltos, cada panel operativo tenga un test de contrato, el flujo de scoring real tenga pruebas API y E2E, los fallbacks estén señalizados como demo y Playwright pase en CI con artefactos guardados.

Última auditoría: 2026-09-06.
