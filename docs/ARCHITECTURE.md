# Arquitectura del Proyecto SVP

## Verificacion de Modularizacion

El proyecto sigue una arquitectura modular con clara separacion de responsabilidades.

---

## Estructura de Capas

```
src/
├── components/          # Capa de UI (Presentacion)
│   ├── kanban/          # Componentes del tablero Kanban (21 archivos)
│   ├── Sprint3/         # Componentes de operaciones avanzadas (4 archivos)
│   └── AppErrorBoundary.tsx
├── hooks/               # Capa de Estado y Logica de UI
│   ├── useSpv.ts        # Hook principal del sistema SVP
│   └── useKanbanFilters.ts
├── services/            # Capa de Logica de Negocio
│   ├── spvApi.ts        # API client para SVP (CRUD completo)
│   ├── httpClient.ts    # Cliente HTTP base
│   └── kanbanService.ts # Servicios del Kanban
└── [Componentes raiz]
    ├── App.tsx
    ├── SPVSystem.tsx
    └── KanbanBoard.tsx

backend/
├── src/
│   ├── routes/          # Capa de API (Controladores)
│   │   ├── votes.routes.ts
│   │   ├── points.routes.ts
│   │   ├── deadLetter.routes.ts
│   │   ├── alerts.routes.ts
│   │   └── [12 archivos de rutas]
│   └── services/        # Capa de Servicios (Logica de Negocio)
│       ├── outboxService.ts
│       ├── policyEngine.ts
│       ├── ledgerReconciliation.ts
│       └── [12 archivos de servicios]
└── sql/                 # Capa de Datos (Migraciones)
    └── [8 archivos SQL]
```

---

## Índice canónico

Consulta `docs/SYSTEM_INDEX.md` antes de crear un nuevo cliente, ruta, script, panel o flujo. Ese índice identifica la fuente de verdad y los módulos legacy que no deben ampliarse. El índice también documenta el vínculo MVC `vista → hook → cliente → controlador → modelo/Neon` para evitar versiones paralelas.

## Separacion de Responsabilidades

### 1. Capa de Presentacion (UI)
**Ubicacion:** `src/components/`

| Componente | Responsabilidad |
|------------|-----------------|
| `KanbanColumn.tsx` | Renderizar columna con tareas |
| `TaskCard.tsx` | Tarjeta individual de tarea |
| `CreateTaskModal.tsx` | Formulario de creacion |
| `TaskDetailsModal.tsx` | Vista detallada de tarea |
| `DeadLetterPanel.tsx` | Panel de dead-letter queue |
| `AlertsPanel.tsx` | Panel de alertas operativas |
| `LoadTestPanel.tsx` | Panel de pruebas de carga |
| `ReconciliationPanel.tsx` | Panel de conciliacion |

**Principio:** Los componentes NO contienen logica de negocio, solo presentacion y delegacion a hooks/services.

---

### 2. Capa de Estado y Hooks
**Ubicacion:** `src/hooks/`

| Hook | Responsabilidad |
|------|-----------------|
| `useSpv.ts` | Estado global del sistema SVP, acciones CRUD |
| `useKanbanFilters.ts` | Estado de filtros del tablero |

**Caracteristicas:**
- Encapsulan estado local y efectos
- Llaman a servicios para operaciones de datos
- Proveen acciones tipadas a componentes

---

### 3. Capa de Servicios (Frontend)
**Ubicacion:** `src/services/`

| Servicio | Responsabilidad |
|----------|-----------------|
| `spvApi.ts` | Cliente API con CRUD completo |
| `httpClient.ts` | Wrapper de fetch con telemetria |
| `kanbanService.ts` | Logica del tablero Kanban |

**Operaciones CRUD en spvApi.ts:**
```typescript
// CREATE
createActivity(), castVote(), transferPoints(), creditPoints()

// READ
getSpvBootstrapState(), getUsers(), getActivities(), getTransactions()

// UPDATE
updateActivity(), updateTransaction()

// DELETE
deleteActivity(), deleteTransaction(), cancelTransfer()
```

---

### 4. Capa de API (Backend)
**Ubicacion:** `backend/src/routes/`

| Router | Endpoints |
|--------|-----------|
| `votes.routes.ts` | POST /votes, GET /votes/count |
| `points.routes.ts` | POST /transfer, POST /credit |
| `deadLetter.routes.ts` | GET /dlq, POST /dlq/replay |
| `alerts.routes.ts` | GET /alerts, POST /alerts/ack |
| `reconciliation.routes.ts` | GET /reconcile, POST /validate |

---

### 5. Capa de Servicios (Backend)
**Ubicacion:** `backend/src/services/`

| Servicio | Responsabilidad |
|----------|-----------------|
| `outboxService.ts` | Patron outbox para eventos |
| `policyEngine.ts` | Motor de reglas de negocio |
| `ledgerReconciliation.ts` | Conciliacion contable |
| `operationalAlerts.ts` | Sistema de alertas |
| `distributedRateLimit.ts` | Rate limiting con Redis |
| `loadTestSuite.ts` | Pruebas de carga |

---

### 6. Capa de Datos
**Ubicacion:** `backend/sql/`

Migraciones versionadas:
- `20260318_spv_points_core.sql` - Tablas core
- `20260318_votes_table.sql` - Votos
- `20260321_identity_and_ingest.sql` - Identidad
- `20260323_outbox_dispatcher.sql` - Outbox pattern
- `20260325_policy_rules.sql` - Reglas de negocio

---

## Flujo de Datos

```
[UI Component]
     |
     v
[Hook (useSpv)]
     |
     v
[Service (spvApi)]
     |
     v
[Backend Route]
     |
     v
[Backend Service]
     |
     v
[Database (Neon)]
```

---

## Estado de Modularizacion

| Criterio | Estado | Notas |
|----------|--------|-------|
| Separacion UI/Logica | OK | Componentes solo presentacion |
| Hooks encapsulados | OK | useSpv contiene estado y acciones |
| Services independientes | OK | spvApi, kanbanService separados |
| CRUD completo | OK | Create, Read, Update, Delete |
| Backend modular | OK | Routes separados de Services |
| Migraciones versionadas | OK | SQL con timestamps |
| Tests unitarios | PARCIAL | kanbanService.test.ts existe |

---

## Conclusiones

El proyecto esta correctamente modularizado con:

1. **Clara separacion de capas** (UI, Hooks, Services, API, Data)
2. **Responsabilidades bien definidas** por archivo/modulo
3. **CRUD completo** implementado en frontend y backend
4. **Servicios reutilizables** que no dependen de UI
5. **Hooks que encapsulan estado** y delegan a services

La arquitectura permite:
- Testear servicios independientemente
- Cambiar UI sin afectar logica
- Escalar backend agregando mas services
- Mantener consistencia de datos via services centralizados
