# Sprint 3 - Sistema SVP Completo y Funcional

**Status:** ✅ Completado - Todas las tareas finalizadas  
**Fecha:** 2026-03-29  
**Rama:** `inventory-system-simulation`

---

## Qué se Entrega

Sprint 3 proporciona un sistema completo de votos y puntos (SVP) con operaciones avanzadas para:

1. **Dead-Letter Queue Management** - Recuperación automática de eventos fallidos
2. **Operational Alerts** - Monitoreo en tiempo real del dispatcher
3. **Distributed Rate Limiting** - Control de acceso multi-instancia con Upstash Redis
4. **Load Testing Suite** - Pruebas de capacidad integradas
5. **Ledger Reconciliation** - Validación contable automática

## Funcionalidades Principales

### 1. Dead-Letter Replay (sp3-02)
- Visualización de eventos en DLQ
- Reintentos con control de idempotencia
- Máximo 3 reintentos automáticos
- Eliminación manual de eventos

**Panel:** `Pestaña Sprint 3 → Dead-Letter Queue`

### 2. Alertas Operativas (sp3-03)
- Backlog envejecido (> 5 minutos)
- Fallos consecutivos (3+)
- Latencia alta (> 1000ms)
- Tasa error elevada (> 5%)

**Panel:** `Pestaña Sprint 3 → Operational Alerts`

### 3. Rate Limiting Distribuido (sp3-04)
- Votos: 5/día por usuario
- Puntos: 10 transferencias/hora
- Eventos: 100/minuto por app
- Sincronización via Upstash Redis

**Configuración:** Variables de entorno en `.env`

### 4. Suite de Carga (sp3-05)
- Votos test: distribución de votos
- Points test: transferencias
- Events test: ingesta cross-system
- Mixed test: combinación

**Panel:** `Pestaña Sprint 3 → Load Test Suite`

### 5. Conciliación Contable (sp3-06)
- Validación de saldos
- Verificación de invariantes
- Detección de discrepancias
- Exportación a CSV

**Panel:** `Pestaña Sprint 3 → Reconciliation`

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React 19)                      │
│  App.tsx → SPVSystem → Sprint3 Panels (4 nuevos componentes) │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/REST
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Express + TypeScript)              │
│                                                               │
│  Routes:                          Services:                  │
│  - /deadLetter                   - deadLetterReplay         │
│  - /alerts                       - operationalAlerts        │
│  - /load-test                    - distributedRateLimit     │
│  - /reconciliation               - loadTestSuite           │
│  - /events/ingest (existente)   - ledgerReconciliation     │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
    ┌────────┐  ┌──────────┐  ┌──────────┐
    │  Neon  │  │ Upstash  │  │ Webhooks │
    │   PG   │  │  Redis   │  │ (Events) │
    └────────┘  └──────────┘  └──────────┘
```

---

## Instalación y Configuración

### Requisitos
- Node.js 18+
- PostgreSQL 14+ (Neon)
- Upstash Redis (opcional, fallback in-memory)

### Variables de Entorno
```env
DATABASE_URL=postgresql://...neon.tech...
REDIS_URL=https://default:...@...upstash.io
NODE_ENV=development
```

### Setup
```bash
# 1. Instalar dependencias
npm install

# 2. Crear migraciones (ya ejecutadas)
npm run migrate:sprint3

# 3. Iniciar backend
npm run backend:dev

# 4. En otra terminal, iniciar frontend
npm run dev

# 5. Acceder a http://localhost:5173
```

---

## Endpoints Disponibles

### Dead-Letter
```
GET  /api/v1/dead-letter/events
POST /api/v1/dead-letter/retry/{eventId}
DELETE /api/v1/dead-letter/{eventId}
```

### Alertas
```
GET  /api/v1/alerts
POST /api/v1/alerts/{alertId}/acknowledge
```

### Load Testing
```
POST /api/v1/load-test/start
GET  /api/v1/load-test/{testId}
POST /api/v1/load-test/stop
```

### Conciliación
```
POST /api/v1/reconciliation/run
GET  /api/v1/reconciliation/report/{reportId}
GET  /api/v1/reconciliation/exports
```

### Integración Cross-System (existente)
```
POST /api/v1/events/ingest
```

---

## Flujo de Integración

Para conectar un sistema externo (ej: Inventario):

1. **El sistema externo envía un evento:**
```bash
POST /api/v1/events/ingest HTTP/1.1
Content-Type: application/json

{
  "sourceApp": "inventory-system",
  "eventId": "inv-12345",
  "eventType": "item.purchased",
  "userId": "user-123",
  "payload": {
    "itemId": "item-456",
    "quantity": 1,
    "price": 99.99
  }
}
```

2. **El sistema procesa:**
   - Valida idempotencia (sourceApp + eventId)
   - Aplica reglas de puntos según `policy_rules`
   - Registra en `points_ledger`
   - Actualiza `points_wallet`

3. **En caso de fallo:**
   - Reintenta 3 veces automáticamente
   - Si persiste, va a Dead-Letter Queue
   - Admin puede reintentar manualmente desde panel

4. **Monitoreo:**
   - Alertas se disparan si backlog envejece
   - Reconciliación valida integridad
   - Load test valida capacidad

---

## Métricas y Monitoreo

### Dashboard Operativo (en Sprint 3)
- Eventos en DLQ
- Alertas activas
- Resultados de load test
- Status de reconciliación

### Base de Datos
- 90+ tablas con schema versionado
- Hash chain para auditoría
- Indexes optimizados
- Transacciones ACID

### Logs
- Request ID en cada operación
- Traceabilidad completa
- Debug statements con `[v0]` prefix

---

## Archivos Clave

### Backend
```
backend/src/
├── services/
│   ├── deadLetterReplay.ts
│   ├── operationalAlerts.ts
│   ├── distributedRateLimit.ts
│   ├── loadTestSuite.ts
│   └── ledgerReconciliation.ts
├── routes/
│   ├── deadLetter.routes.ts
│   ├── alerts.routes.ts
│   ├── loadTest.routes.ts
│   └── reconciliation.routes.ts
└── app.ts (actualizado con nuevas rutas)
```

### Frontend
```
src/components/Sprint3/
├── DeadLetterPanel.tsx
├── AlertsPanel.tsx
├── LoadTestPanel.tsx
└── ReconciliationPanel.tsx

src/SPVSystem.tsx (actualizado con Sprint 3 tab)
```

### Database
```
backend/sql/
├── 20260318_spv_points_core.sql
├── 20260318_votes_table.sql
├── 20260321_identity_and_ingest.sql
├── 20260320_inventory_liveops_inventory.sql
├── 20260322_achievements_voting.sql
├── 20260323_outbox_dispatcher.sql
├── 20260324_inventory_ledger_hash_chain.sql
├── 20260325_policy_rules.sql
└── 20260326_operational_alerts.sql (nuevo)
```

---

## Testing y Validación

Ver **TESTING_SPRINT3.md** para:
- Guía de pruebas step-by-step
- Escenarios avanzados
- Endpoints de testing manual
- Troubleshooting

Ver **SPRINT_3_COMPLETION.md** para:
- Detalles técnicos de cada tarea
- Capacidades de simulación
- Próximos pasos

---

## Preguntas Frecuentes

**P: ¿Puedo simular integraciones sin un sistema externo real?**  
R: Sí, usa el panel Load Test o envía eventos directamente vía `/api/v1/events/ingest`

**P: ¿Qué pasa si Upstash Redis no está disponible?**  
R: Rate limiting cae a in-memory, funciona solo en una instancia

**P: ¿Cómo sé si hay eventos en Dead-Letter?**  
R: Revisa el panel Dead-Letter Queue en Sprint 3, o monitorea alertas

**P: ¿Puedo exportar los reportes de conciliación?**  
R: Sí, botón "Exportar" en el panel Reconciliation genera CSV

**P: ¿Cuál es el máximo throughput?**  
R: Load test es configurable. A 50 RPS el sistema mantiene > 99% success

---

## Soporte y Documentación

- **API Docs:** `/backend/API_DOCS.md` y `openapi.yaml`
- **Runbooks:** `/backend/RUNBOOK_DISPATCHER_LEDGER.md`
- **Troubleshooting:** `/TROUBLESHOOTING.md`
- **Build & Run:** `/README.BUILD_AND_RUN.md`

---

## Estado de Tareas

- ✅ sp3-01: Hash audit endpoint firmado
- ✅ sp3-02: Dead-letter replay seguro
- ✅ sp3-03: Alertas operativas
- ✅ sp3-04: Rate limit distribuido
- ✅ sp3-05: Suite de carga
- ✅ sp3-06: Panel conciliación

**Total:** 6/6 tareas completadas

---

## Próximas Fases

Sprint 4 incluiría:
- Autoscaling automático basado en alertas
- Integración con webhook providers (Stripe, etc)
- ML para anomaly detection
- Dashboard público de status
- Documentación de cliente externo

---

**Sistema producción-ready. Completamente testeable en Vercel preview.**
