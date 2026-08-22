# Estado de pruebas y guía de continuidad del MVP SVP

**Fecha de registro:** 2026-08-22
**Propósito:** conservar el estado de pruebas comunicado y convertirlo en una guía ejecutable.

## Respuesta registrada

## Estado de pruebas

### Vitest + Supertest

- **15/15 pruebas aprobadas** en la última ejecución.
- Cubren:
  - Votación y actualización de puntos.
  - Transferencias entre usuarios.
  - Saldos.
  - Idempotencia.
  - Concurrencia y prevención de sobregiro.
  - Webhooks con HMAC válido/inválido.
  - Protección contra replay.
  - Timestamps expirados.
  - Parsers y métricas del Kanban.
- **Cobertura porcentual:** todavía no medida con `--coverage`. Por tanto, no sería correcto afirmar que el proyecto tiene, por ejemplo, 80% de cobertura. El dato disponible actualmente es **100% de aprobación de los tests ejecutados**, no 100% de cobertura de código.

### Playwright

Hay **3 pruebas E2E preparadas**:

1. Renderizado del dashboard y métricas principales.
2. Navegación entre las pestañas principales.
3. Carga del historial sin errores cuando el backend no está disponible.

El preview también fue verificado manualmente con `agent-browser`: navegación, pestañas y flujo de voto. La ejecución completa de Playwright quedó bloqueada por una dependencia del entorno Linux (`libnspr4.so`), no por un fallo funcional del MVP.

## Cobertura funcional aproximada

Esta es una estimación de áreas funcionales, no un reporte de líneas de código:

- **Backend de votos y puntos:** aproximadamente 70–80%.
- **Seguridad de webhooks/idempotencia:** aproximadamente 80–90%.
- **Kanban/parser:** aproximadamente 50–60%.
- **UI principal:** aproximadamente 25–35%.
- **Trazabilidad Neon actividad → tarea → objetivo:** aproximadamente 30–40%.
- **Cobertura global funcional estimada:** aproximadamente 50–60%.

Reporte real ejecutado el 2026-08-22 con `npx vitest run --coverage`: Statements **59.77% (489/818)**, Branches **40.89% (274/670)**, Functions **58.55% (89/152)** y Lines **62.15% (450/724)**. Este reporte cubre los tests Vitest configurados y excluye E2E Playwright.

## Lo que falta probar

### Prioridad alta

- Rutas nuevas: `GET /api/spv/activities`, `GET /api/spv/strategic`, `GET /api/spv/tasks`, `POST /api/spv/vote`.
- Propagación de progreso: voto → tarea vinculada; tarea → objetivo estratégico; límite máximo de 100%; estados `in-progress` y `done`.
- Transacciones y rollback cuando falla una operación.
- Lectura real desde Neon con datos semilla.
- Voto duplicado y límites diarios desde la nueva ruta MVP.

### Prioridad media

- Crear, editar y eliminar actividades.
- Transferencias con usuarios inexistentes.
- Montos inválidos, negativos o excesivos.
- Historial y filtros.
- Notificaciones visuales de impacto y autocierre.
- Kanban sincronizado con los datos de Neon.
- Responsive en móvil y desktop.

### Prioridad baja

- Accesibilidad con teclado y lectores de pantalla.
- Rendimiento y Web Vitals.
- Pruebas de múltiples sesiones.
- Pruebas de carga y concurrencia real.
- Pruebas de despliegue en producción.

## Guía para continuar sin estancarse

1. Resolver el runner de Playwright localmente e instalar las dependencias del sistema indicadas por Playwright; ejecutar `npm run test:e2e`.
2. Medir cobertura real con `npx vitest run --coverage` y registrar statements, branches, functions y lines.
3. Completar pruebas de API MVP con casos correctos, inválidos y de error, verificando la cadena de trazabilidad.
4. Completar E2E: votar, actualizar puntos, mostrar notificación, cambiar progreso en Kanban y probar backend disponible/no disponible.
5. Actualizar el Kanban: marcar tablas/seed como completadas; poner pruebas API MVP en proceso; separar UI, Neon y pruebas.
6. Cerrar el MVP cuando API, E2E, cobertura, trazabilidad, build, type-check, responsive y accesibilidad básica estén validados.

## Alcance real de esta plataforma

- Se pueden ejecutar tests locales del repositorio, builds, type-check/lint configurados y pruebas de navegador con `agent-browser`.
- Playwright requiere navegador y librerías del sistema disponibles en el runner.
- Las pruebas de producción, carga distribuida y concurrencia a escala requieren infraestructura externa.
- El porcentaje de tests aprobados no equivale a cobertura de código.

## Hallazgos abiertos para esta iteración

- El backend Express corre separado del preview Vite; ahora dispone del script reproducible `npm run dev:api`. Con `DATABASE_URL` disponible, `/health` respondió `200 healthy/database available` y `/api/spv/strategic` respondió `200` con 3 objetivos y 7 tareas agregadas.
- Operaciones y Monitoreo deben mostrar estados reales de carga, error y disponibilidad, no asumir que sus endpoints están disponibles.
- Health API ahora distingue `healthy`, `database_unavailable` y `backend-unreachable`; el estado seguirá sin disponibilidad si Express no se ejecuta junto al preview Vite.
- El selector de eventos de inventario, CRM y e-commerce es simulación cross-system; no puntúa ni muta sistemas externos.
- El scoring real corresponde a actividades reales votadas: voto → puntos → historial → tarea → objetivo estratégico.

## Criterios de evidencia

| Área | Evidencia requerida | Estado |
|---|---|---|
| API existente | `npm run test:api` | 15/15 aprobado previamente |
| Build | `npm run build` | aprobado previamente |
| API MVP | Supertest para endpoints nuevos | pendiente |
| Cobertura | `npm run test:coverage` | 59.77% statements / 62.15% lines |
| Playwright | `npm run test:e2e` | 3 specs preparados; ejecución bloqueada por `libnspr4.so` ausente en Chromium |
| E2E | `npm run test:e2e` | bloqueado por librería Chromium del runner; `apt-get` no existe en este VM |
| Preview | `agent-browser` con snapshot y screenshot | verificado parcialmente |
| Neon | consulta de trazabilidad y scoring | seed cargado; flujo completo pendiente |
| Operaciones/Monitoreo | estados y endpoints comprobables | pendiente |

## Próximo orden de ejecución

1. Diagnosticar y corregir Health API/backend.
2. Auditar Operaciones y Monitoreo contra las rutas reales.
3. Añadir tests API de trazabilidad y scoring.
4. Ejecutar cobertura.
5. Repetir pruebas del navegador y validar voto real.
6. Actualizar las tareas Kanban solo con resultados reproducibles.

## Nota de control

No se debe presentar el selector de simulación como integración productiva. Las actividades que deben recibir puntuación son las actividades reales del SPV, mediante votos autenticados/identificados y persistencia en Neon.

---

**Registro:** este documento conserva íntegramente el contenido de la respuesta anterior sobre pruebas, cobertura, pendientes y guía de continuidad, y añade los límites operativos y hallazgos que motivan la siguiente fase.
