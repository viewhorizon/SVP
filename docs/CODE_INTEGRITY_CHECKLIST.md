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
- [x] Se creó `docs/SYSTEM_INDEX.md` como índice canónico; los runners históricos quedan documentados y no se modifican sin decisión explícita.
- [~] `spvApi.ts` tiene un mapa función→consumidor→ruta→schema→tablas en `docs/SYSTEM_INDEX.md`; el único consumidor encontrado es interno (`useSpv.ts`). No hay evidencia local de suscriptores externos ni se afirma compatibilidad fuera del repositorio.
- [x] La arquitectura MVC queda indexada como `vista → hook → cliente apropiado → controlador → modelo/Neon`; las funciones sin ruta están marcadas y el adaptador no se eliminó por suposición.

### 2. Frontend con propósito

- [x] Actividades, puntos, historial, operaciones y Kanban tienen una función de producto identificable.
- [x] El voto del dashboard usa `/api/svp/votes`; el reward se calcula con `point_rules` y se registra en `points_ledger`, sin aceptar puntos indicados por el cliente.
- [x] El dominio de inventario tiene rutas/ledger propios, separados del propósito de voto y conversión SVP.
- [x] La especificación no atribuye capacidad de compra a votos; cualquier uso comercial requiere un requerimiento separado.
- [x] La demo vincula explícitamente cada Dominio (Origen) con sus actividades; una actividad no vinculada o no registrada no se puede simular.
- [ ] Persistir el catálogo dominio-actividad en backend antes de describirlo como administración productiva.
- [x] Health API muestra disponibilidad del backend y base de datos.
- [x] Paneles operativos exponen carga, errores, replay, alertas y conciliación.
- [~] `useSpv.ts` ya no carga usuarios/actividades/saldos mock ni afirma éxito local tras fallos; los helpers históricos de `spvApi.ts` aún contienen fallbacks, pero el hook no los consume.
- [x] El historial de negocio se carga desde el backend; los eventos recientes de la sesión viven solo en memoria y ya no se restauran desde `localStorage`.
- [~] Si falla el bootstrap, la UI muestra un mensaje explícito y limpia datos de negocio; falta un estado de degradación estructurado y común a todos los fetchers.

### 3. Frontend → backend → Neon

- [x] Vite hace proxy de `/api` y `/health` al backend Express.
- [x] Backend crea `Pool` con `DATABASE_URL` y ejecuta consultas parametrizadas.
- [x] `/health` ejecuta `SELECT 1` y distingue backend/base de datos no disponible.
- [~] Las lecturas MVP continúan en `/api/spv/*`; voto y bootstrap de puntos usan rutas autenticadas y el saldo de sesión. La lectura de `point_rules` en la base Neon del entorno objetivo debe confirmarse allí.
- [x] El voto y el CRUD de actividades solo reflejan operaciones confirmadas; no se cargan actividades ficticias si falla el backend.
- [x] Transferencia y crédito manual están deshabilitados en la UI hasta resolver el vínculo de identidad entre `spv_users` y wallet, y la autorización de emisión.
- [x] `/api/points/credit` exige el custom claim Firebase `admin: true`; `/api/points/debit` y `GET /api/points/balance/:userId` restringen acceso cruzado sin ese claim, con pruebas.
- [~] La asignación y revisión de claims admin es operacional y debe configurarse en Firebase antes de permitir emisión de puntos.
- [~] Los helpers históricos de `spvApi.ts` todavía ocultan errores y devuelven `false`, `[]` o datos locales; no son consumidos por el hook activo.
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
- [x] `npm run test:api`: 21/21 tests aprobados; incluye autorización admin para crédito y controles de acceso cruzado.
- [~] El último snapshot de cobertura corresponde a 17 tests (60.14% statements, 41.19% branches, 59.21% functions, 62.43% lines); no se recalculó con los 21 tests actuales.
- [~] La última ejecución local de `npm run test:e2e -- tests/e2e/spv-mvp.spec.ts` no pudo iniciar Chromium porque faltaba `chrome-headless-shell`; esto no es evidencia de que la prueba pase o falle.
- [~] `.github/workflows/ci.yml` sí instala Chromium y ejecuta Playwright. Falta comprobar el resultado verde más reciente y conservar su reporte antes de cerrar esta tarea.
- [ ] Ampliar las pruebas de navegador para cubrir las acciones disponibles y confirmar que las transferencias deshabilitadas sigan sin poder usarse.
- [ ] Añadir pruebas de contrato para los cuatro paneles operativos; la guía actual de rutas está en `docs/TESTING_SPRINT3.md`.

### 8. Migraciones y compatibilidad histórica

- [x] Se auditó individualmente `run_migrations.js`, `execute_sql.py`, `execute_migrations.js`, `execute_sprint3_migrations.js`, `migrations_consolidated.js` y `01_run_all_migrations.sql`; propósito, tablas, dependencias y riesgos están registrados en `docs/LEGACY_DECISIONS.md`.
- [x] Se comprobó que los runners alternos no aparecen invocados desde `package.json` ni `.github/workflows`; la ejecución manual o externa sigue siendo posible.
- [x] No se ejecutó ni modificó SQL durante esta revisión.
- [~] `scripts/run_migrations.js` es solo el camino previsto, no una ruta segura: separa por `;`, continúa tras fallos, carece de tracking y omite `20260326` y `20260330`.
- [~] Los scripts históricos crean esquemas divergentes; `CREATE TABLE IF NOT EXISTS` no migra columnas ya existentes.
- [ ] Reparar el runner y validar el conjunto completo en una base desechable antes de usarlo en despliegue.

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

Última auditoría: 2026-11-25.

## Términos en lenguaje sencillo

| Término | Significado práctico |
| --- | --- |
| Eventos fallidos / Dead Letter | Resumen de entregas que fallaron y que alguien puede filtrar o volver a intentar. No son mensajes “borrados”. |
| Prueba de carga / Load Test | Enviar muchas solicitudes de prueba para medir tiempos y errores. Puede afectar un servicio; usar solo un entorno aislado. |
| Conciliación | Comparar los saldos con sus movimientos para encontrar diferencias; no significa corregirlas automáticamente. |
| Demo / conectado / degradado | Demo usa datos simulados; conectado consulta el servicio real; degradado significa que funciona solo una parte o que un servicio no responde. No usar “live” como sinónimo de “verificado”. |
| Programa de migraciones | Herramienta que aplica cambios de estructura a la base de datos. Un script antiguo no es seguro solo por existir; debe registrar lo aplicado y detenerse ante errores. |
| Validación Zod | Reglas que revisan los datos recibidos antes de que el servidor los procese. |
| Prueba E2E (de extremo a extremo) | Una prueba automatizada que recorre la interfaz como una persona. Una prueba de API no sustituye esta prueba. |
| Sprint / sprintlog | Sprint es un grupo de trabajo planificado; sprintlog es una lista importada o registrada. El nombre no demuestra que las tareas se hayan realizado. |
| En revisión | Hay código o documentación, pero falta evidencia de que se cumplan todos los criterios. |

Validación de esta revisión: `npm run check`, `npm run build` y `npm run test:api` aprobaron; la suite reunió 23 pruebas en 3 archivos. Playwright no inició localmente porque falta la biblioteca del sistema `libnspr4.so`; CI instala Chromium con dependencias y conserva el reporte/artefactos, pero se debe confirmar su ejecución más reciente. El índice canónico está en `docs/SYSTEM_INDEX.md`.
