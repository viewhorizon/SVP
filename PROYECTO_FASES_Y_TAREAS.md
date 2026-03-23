# Proyecto SPV - Fases y Tareas del Ciclo de Desarrollo
**Generado por GLM para coordinación entre agentes en nuevo chat**

---

## 📋 Estado Actual del Proyecto

**Stack Tecnológico:**
- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Base de Datos: PostgreSQL (fuente de verdad de puntos)
- Auth: Firebase (middleware requireAuth implementado)

**Componentes Principales:**
- `src/App.tsx` - Shell de navegación (SPV | Kanban)
- `src/SPVSystem.tsx` - Sistema de Votos y Puntos
- `src/KanbanBoard.tsx` - Tablero Kanban general
- `src/services/kanbanService.ts` - Servicios del tablero
- `src/services/spvApi.ts` - Cliente API del SPV
- `backend/src/` - APIs completas K-11 y K-12

---

## 🎯 Mapa de Responsabilidades por Agente

| Agente | Responsabilidad Principal | Áreas de Trabajo |
|--------|--------------------------|------------------|
| **GLM** | Backend + Infraestructura + Testing | APIs, SQL, scripts diagnósticos, config build, troubleshooting |
| **G5c** | Frontend + UX + Estilización | Componentes UI, servicios frontend, módulos, responsive, tema |

---

## 📊 FASES DEL CICLO DE DESARROLLO

### FASE 1: ARQUITECTURA Y SETUP ✅ COMPLETADA

| ID | Tarea | Estado | Responsable |
|-----|-------|--------|-------------|
| F1-01 | Definición de alcance SPV + Inventario + Actividades + LiveOps + Unity | ✅ | GLM |
| F1-02 | Confirmación PostgreSQL como fuente de verdad | ✅ | GLM |
| F1-03 | Confirmación Firebase para inventario de usuario | ✅ | GLM |
| F1-04 | Prototipo UI HTML inicial | ✅ | G5c |
| F1-05 | Migración a React + TypeScript | ✅ | G5c |
| F1-06 | Configuración Vite + Tailwind | ✅ | GLM |

---

### FASE 2: BASE DE DATOS ✅ COMPLETADA

| ID | Tarea | Estado | Responsable |
|-----|-------|--------|-------------|
| F2-01 | Crear tabla `points_wallet` (saldo vs histórico) | ✅ | GLM |
| F2-02 | Crear tabla `points_ledger` (append-only) | ✅ | GLM |
| F2-03 | Crear tabla `point_rules` (reglas versionadas) | ✅ | GLM |
| F2-04 | Crear tabla `point_limits` (límites antifraude) | ✅ | GLM |
| F2-05 | Crear tabla `votes` (registro de votos) | ✅ | GLM |
| F2-06 | Índices optimizados en todas las tablas | ✅ | GLM |
| F2-07 | Datos seed para pruebas | ✅ | GLM |

**Tablas PostgreSQL existentes (NO recrear):**
- `liveops_balances`
- `liveops_rates`
- `cross_system_transactions`
- `capsule_activations`
- `park_objects`
- `park_config`

---

### FASE 3: BACKEND - CORE APIS ✅ COMPLETADA

| ID | Tarea | Estado | Responsable |
|-----|-------|--------|-------------|
| F3-01 | Middleware `requireAuth` (Firebase token validation) | ✅ | GLM |
| F3-02 | Helper `withTransaction` (PostgreSQL transacciones) | ✅ | GLM |
| F3-03 | Repository `pointsRepository` (ledger append-only) | ✅ | GLM |
| F3-04 | **API K-11: POST /api/votes** | ✅ | GLM |
| F3-05 | **API K-11: GET /api/votes/count** | ✅ | GLM |
| F3-06 | **API K-11: GET /api/votes/limits** | ✅ | GLM |
| F3-07 | **API K-12: POST /api/points/credit** | ✅ | GLM |
| F3-08 | **API K-12: POST /api/points/debit** | ✅ | GLM |
| F3-09 | **API K-12: POST /api/points/transfer** | ✅ | GLM |
| F3-10 | **API K-12: POST /api/points/convert** | ✅ | GLM |
| F3-11 | **API K-12: GET /api/points/balance/:userId** | ✅ | GLM |

---

### FASE 4: FRONTEND - SPV ⚠️ EN PROGRESO

| ID | Tarea | Estado | Responsable |
|-----|-------|--------|-------------|
| F4-01 | Integración navegación SPV | Kanban en pestañas | ✅ | G5c |
| F4-02 | Agregar iconos a SPV (lucide-react) | ✅ | G5c |
| F4-03 | Manejo de errores + logs panel visible | ✅ | G5c |
| F4-04 | Error Boundary para evitar pantalla blanca | ✅ | G5c |
| F4-05 | Extracción de `spvApi.ts` (servicio HTTP) | ✅ | G5c |
| F4-06 | Fallback local cuando API falla | ✅ | G5c |
| F4-07 | Conectar SPV a endpoints reales (reemplazar mock) | ⚠️ | G5c |
| F4-08 | Panel Health Check conectividad API | ⏳ | G5c |
| F4-09 | Registro de eventos en UI | ⏳ | G5c |
| F4-10 | Observabilidad: requestId visible | ⏳ | G5c |

---

### FASE 5: FRONTEND - KANBAN ⚠️ EN PROGRESO

| ID | Tarea | Estado | Responsable |
|-----|-------|--------|-------------|
| F5-01 | Tablero Kanban responsive (móvil/tablet/desktop) | ✅ | G5c |
| F5-02 | Extracción de `kanbanService.ts` (servicios) | ✅ | G5c |
| F5-03 | Botonera de estados (no select) | ✅ | G5c |
| F5-04 | Botón "Todas las tareas" | ✅ | G5c |
| F5-05 | Modal crear tarea con formulario completo | ✅ | G5c |
| F5-06 | Check slide desplazamiento horizontal | ✅ | G5c |
| F5-07 | Ocultar scrollbars visibles móvil/tablet | ✅ | G5c |
| F5-08 | Métricas SMART + FODA | ✅ | G5c |
| F5-09 | Pestaña Métricas separada | ✅ | G5c |
| F5-10 | Upload documento para análisis IA | ✅ | G5c |
| F5-11 | Solo ver contenedor activo por filtro | ✅ | G5c |
| F5-12 | Importación JSON/CSV/TOON/TXT | ✅ | G5c |
| F5-13 | Exportación Trello CSV + JSON | ✅ | G5c |
| F5-14 | Corrección `priorityStyles is not defined` | ✅ | G5c |
| F5-15 | Eliminar imports sin usar | ✅ | G5c |
| F5-16 | Dividir KanbanBoard en subcomponentes | ⏳ | G5c |

---

### FASE 6: INTEGRACIÓN DE SISTEMAS ⏳ PENDIENTE

| ID | Tarea | Estado | Responsable |
|-----|-------|--------|-------------|
| F6-01 | Integración con `cross_system_transactions` | ⏳ | GLM |
| F6-02 | Conversión puntos ↔ LiveOps con `liveops_rates` | ⏳ | GLM |
| F6-03 | Alineación de contratos API (requestId/remainingVotes) | ⏳ | GLM |
| F6-04 | Webhook para recibir puntos externos | ⏳ | GLM |
| F6-05 | POST /api/ai/planning/analyze (IA backend) | ⏳ | GLM |
| F6-06 | Integración SPV ↔ Inventario (Firebase) | ⏳ | G5c |
| F6-07 | Integración Tienda Global ↔ Inventario Global | ⏳ | GLM |

---

### FASE 7: TESTING ⏳ PENDIENTE

| ID | Tarea | Estado | Responsable |
|-----|-------|--------|-------------|
| F7-01 | Unit tests: parsers JSON/CSV/TOON | ⏳ | GLM |
| F7-02 | Unit tests: métricas SMART/FODA | ⏳ | GLM |
| F7-03 | Integration tests: endpoints votos | ⏳ | GLM |
| F7-04 | Integration tests: endpoints puntos | ⏳ | GLM |
| F7-05 | E2E tests: flujo voto → puntos → transferencia | ⏳ | GLM |
| F7-06 | E2E tests: flujo Kanban upload → tareas | ⏳ | G5c |
| F7-07 | Testing responsive móvil/tablet/desktop | ⏳ | G5c |
| F7-08 | Testing sin conexión (fallback local) | ⏳ | G5c |

---

### FASE 8: OPTIMIZACIÓN ⏳ PENDIENTE

| ID | Tarea | Estado | Responsable |
|-----|-------|--------|-------------|
| F8-01 | Dividir KanbanBoard en subcomponentes reutilizables | ⏳ | G5c |
| F8-02 | Extraer SPV lógica a hooks (useSpv) | ⏳ | G5c |
| F8-03 | Extraer Kanban lógica a hooks (useKanban) | ⏳ | G5c |
| F8-04 | Observabilidad: requestId en logs remotos | ⏳ | GLM |
| F8-05 | Performance: lazy loading de componentes | ⏳ | GLM |
| F8-06 | Cache: Redis para contadores votos | ⏳ | GLM |

---

### FASE 9: FUTURO FEATURES ⏳ PENDIENTE

| ID | Tarea | Estado | Responsable |
|-----|-------|--------|-------------|
| F9-01 | Vista tabla "Todas las tareas" | ⏳ | G5c |
| F9-02 | Contadores carga en botones de estado | ⏳ | G5c |
| F9-03 | Conversor texto requisitos → JSON | ⏳ | G5c |
| F9-04 | Exportación Jira/Asana clic | ⏳ | GLM |
| F9-05 | Notificaciones push | ⏳ | G5c |
| F9-06 | Modo oscuro completo Kanban | ⏳ | G5c |
| F9-07 | Microapp Tienda Global | ⏳ | GLM |

---

### FASE 10: INFRAESTRUCTURA Y DEPLOY ⏳ PENDIENTE

| ID | Tarea | Estado | Responsable |
|-----|-------|--------|-------------|
| F10-01 | Build alternativo sin singlefile (CSP safe) | ✅ | GLM |
| F10-02 | Script de diagnóstico para runtime | ✅ | GLM |
| F10-03 | `.env.example` con variables requeridas | ✅ | GLM |
| F10-04 | Documentación troubleshooting preview blanco | ✅ | GLM |
| F10-05 | Documentación API completa | ✅ | GLM |
| F10-06 | CI/CD pipeline | ⏳ | GLM |
| F10-07 | Deploy Vercel + Railway + Supabase | ⏳ | GLM |
| F10-08 | Monitoring setup (Sentry, Grafana) | ⏳ | GLM |

---

## ✅ RESUMEN POR AGENTE

### GLM - Tareas Pendientes Prioritarias

| Prioridad | ID | Tarea | Fase |
|-----------|----|-------|------|
| 🔴 Alta | F3-04 | Alinear contratos API (requestId, remainingVotes) | 6 |
| 🔴 Alta | F6-01 | Integración cross_system_transactions | 6 |
| 🔴 Alta | F6-02 | Conversión puntos↔LiveOps | 6 |
| 🟡 Media | F6-05 | POST /api/ai/planning/analyze | 6 |
| 🟡 Media | F7-01..F7-05 | Testing de APIs | 7 |
| 🟢 Baja | F9-04 | Exportación Jira/Asana | 9 |

### G5c - Tareas Pendientes Prioritarias

| Prioridad | ID | Tarea | Fase |
|-----------|----|-------|------|
| 🔴 Alta | F4-07 | Conectar SPV a endpoints reales | 4 |
| 🔴 Alta | F4-08 | Panel Health Check SPV | 4 |
| 🔴 Alta | F5-16 | Dividir KanbanBoard en subcomponentes | 8 |
| 🟡 Media | F6-06 | Integración SPV ↔ Inventario Firebase | 6 |
| 🟡 Media | F7-06..F7-08 | Testing frontend | 7 |
| 🟢 Baja | F8-02..F8-03 | Extraer hooks (useSpv, useKanban) | 8 |

---

## 📌 INSTRUCCIONES PARA NUEVO CHAT

1. **Copiar este resumen** al inicio del nuevo chat con glm y g5c
2. **Cada agente debe enfocarse en sus tareas pendientes por fase**
3. **Antes de modificar un archivo, verificar que no está siendo editado por el otro agente**
4. **Coordenar mediante esta lista: usar IDs de fase para referenciar tareas**
5. **Confirmar disponibilidad de archivos clave:**
   - GLM: `backend/src/`, `backend/sql/`, `package.json`
   - G5c: `src/App.tsx`, `src/SPVSystem.tsx`, `src/KanbanBoard.tsx`, `src/components/`

---

**Versión:** 1.0  
**Fecha:** 2026-03-18  
**Generado por:** GLM  
**Para:** Coordinación GLM + G5c en nuevo chat arena.ai
