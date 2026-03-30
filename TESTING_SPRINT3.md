# Guía de Pruebas - Sprint 3 Sistema SVP

**Última actualización:** 2026-03-29  
**Estado:** Sistema completamente funcional para testing

---

## Inicio Rápido

### 1. Acceder al Sistema en Preview

1. Abre la aplicación en el preview de Vercel
2. Navega a la pestaña **"Sprint 3"** en el sistema SPV
3. Verás 4 paneles principales:
   - Dead-Letter Queue Manager
   - Operational Alerts Dashboard
   - Load Test Suite
   - Ledger Reconciliation Panel

### 2. Flujo Básico de Prueba

#### Paso 1: Simular un evento fallido
1. En el panel Dead-Letter, haz clic en "Recargar"
2. Si hay eventos en la cola de fallidos, aparecerán listados
3. Selecciona un evento para ver detalles del error

#### Paso 2: Reintentar el evento
1. Haz clic en el botón verde "Reintentar" (ícono de refresh)
2. El evento se procesará nuevamente con control de idempotencia
3. Si tiene éxito, desaparecerá de la DLQ

#### Paso 3: Monitorear alertas
1. En el panel de Alertas, haz clic en "Recargar"
2. Verás alertas activas si:
   - El dispatcher tiene backlog envejecido
   - Hay más de 3 fallos consecutivos
   - La latencia promedio es > 1000ms
   - La tasa de error > 5%

#### Paso 4: Ejecutar prueba de carga
1. En el panel Load Test:
   - Configura **Solicitudes/seg:** 10
   - Configura **Duración:** 30 segundos
   - Tipo de prueba: "Votos"
2. Haz clic en "Iniciar"
3. Observa métricas en tiempo real:
   - Solicitudes totales
   - Tasa de éxito
   - Latencia (avg, min, max)
   - Throughput

#### Paso 5: Ejecutar conciliación
1. En el panel Reconciliation, haz clic en "Ejecutar"
2. El sistema:
   - Verifica saldos contables
   - Valida invariantes de ledger
   - Detecta discrepancias
3. Revisa el status general:
   - Verde = Healthy
   - Amarillo = Warning
   - Rojo = Critical

---

## Escenarios de Prueba Avanzados

### Escenario 1: Simular Integraciones Cross-System

**Objetivo:** Probar que eventos de sistemas externos se procesan correctamente

**Pasos:**
1. Hacer POST a `/api/v1/events/ingest` con:
```json
{
  "sourceApp": "inventory-system",
  "eventId": "inv-12345",
  "eventType": "inventory.update",
  "userId": "user123",
  "payload": {
    "itemId": "item-456",
    "quantity": 5,
    "action": "add"
  }
}
```

2. Verificar que el evento:
   - Aparece en el monitor transaccional
   - Se procesa correctamente
   - Genera puntos según reglas

3. Si falla, verificar en Dead-Letter Panel

### Escenario 2: Probar Rate Limiting

**Objetivo:** Validar que rate limits funcionan correctamente

**Pasos:**
1. En la sección de votos, intenta emitir más de 5 votos en un día
2. El sistema debe rechazar el 6to voto con error de rate limit
3. Verificar que el contador se resetea diariamente

**Para tomar puntos:** POST `/api/v1/points/transfer` más de 10 veces en una hora
- Debe bloquear después de 10

### Escenario 3: Simular Fallo de Dispatcher

**Objetivo:** Validar recuperación desde Dead-Letter Queue

**Pasos:**
1. Crear evento que falle (simular errores con payloads inválidos)
2. Evento debería ir a DLQ después de 3 reintentos
3. Verificar en Dead-Letter Panel
4. Reintentar manualmente después de arreglar raíz causa

### Escenario 4: Load Test Bajo Estrés

**Objetivo:** Identificar límites de throughput

**Pasos:**
1. Configurar load test:
   - RPS: 50 (alto)
   - Duración: 60 segundos
   - Tipo: Mixed (votos + points + events)
2. Observar métricas:
   - ¿Mantiene throughput consistente?
   - ¿Latencia aumenta bajo estrés?
   - ¿Hay errores?
3. Revisar alertas operativas generadas

### Escenario 5: Validar Integridad Contable

**Objetivo:** Asegurar que ledger siempre suma correctamente

**Pasos:**
1. Ejecutar varias transferencias de puntos:
   - User A → User B: 100 pts
   - User B → User C: 50 pts
   - User C → User A: 75 pts
2. Ejecutar reconciliation
3. Verificar que:
   - Total de puntos entrada = salida
   - Sin discrepancias
   - Todas las transacciones registradas

---

## Endpoints de Testing Manual

### Dead-Letter Management
```bash
# Listar eventos DLQ
GET /api/v1/dead-letter/events

# Reintentar evento específico
POST /api/v1/dead-letter/retry/{eventId}

# Eliminar evento DLQ
DELETE /api/v1/dead-letter/{eventId}
```

### Alertas
```bash
# Obtener alertas activas
GET /api/v1/alerts

# Reconocer alerta
POST /api/v1/alerts/{alertId}/acknowledge
```

### Load Testing
```bash
# Iniciar test
POST /api/v1/load-test/start
{
  "requestsPerSecond": 10,
  "duration": 30,
  "testType": "votes"
}

# Obtener resultados
GET /api/v1/load-test/{testId}

# Detener test
POST /api/v1/load-test/stop
```

### Conciliación
```bash
# Ejecutar conciliación
POST /api/v1/reconciliation/run

# Obtener reporte
GET /api/v1/reconciliation/report/{reportId}

# Exportar reportes
GET /api/v1/reconciliation/exports
```

### Eventos Cross-System
```bash
# Ingestar evento de app externa
POST /api/v1/events/ingest
{
  "sourceApp": "nombre-sistema",
  "eventId": "id-único",
  "eventType": "tipo.evento",
  "userId": "user-id",
  "payload": { ... }
}
```

---

## Métricas de Éxito

### Sprint 3 debe cumplir:

**Dead-Letter Replay:**
- [ ] Eventos fallidos se listan correctamente
- [ ] Reintentos respetan idempotencia
- [ ] Máximo 3 reintentos antes de dar por fallido
- [ ] Error context se preserva

**Alertas Operativas:**
- [ ] Alertas se generan automáticamente
- [ ] Severidades correctas (info/warning/error/critical)
- [ ] Panel visual actualiza en tiempo real
- [ ] Se pueden reconocer manualmente

**Rate Limiting:**
- [ ] Votos limitados a 5/día por usuario
- [ ] Points limitado a 10/hora por user
- [ ] API responde 429 cuando se excede límite
- [ ] Funciona en múltiples instancias (via Upstash)

**Load Testing:**
- [ ] Suite completa se ejecuta sin errores
- [ ] Métricas se capturan correctamente
- [ ] Throughput es >= 10 req/s bajo carga
- [ ] Latencia promedio < 100ms

**Conciliación:**
- [ ] Detecta discrepancias si las hay
- [ ] Valida invariantes
- [ ] Genera reportes exportables
- [ ] Status general es acurado

---

## Troubleshooting

### "Dead-Letter Panel no muestra eventos"
**Solución:**
1. Verificar que hay eventos fallidos en la BD
2. Revisar logs del backend
3. Confirmar que `/api/v1/dead-letter/events` retorna datos

### "Load Test no inicia"
**Solución:**
1. Verificar DATABASE_URL está configurada
2. Confirmar que backend está corriendo
3. Revisar logs: `[v0]` statements en consola

### "Alertas no aparecen aunque hay problemas"
**Solución:**
1. Esperar hasta que condición threshold sea cumplida
2. Backlog debe tener > 5min de antiguedad
3. Fallos deben ser consecutivos (3+)
4. Latencia debe ser > 1000ms

### "Conciliación muestra crítico cuando no debería"
**Solución:**
1. Ejecutar con datos limpios primero
2. Revisar discrepancias reportadas
3. Confirmar que todas las transacciones fueron procesadas
4. Checar que ledger_hash_chain está íntegro

---

## Performance Esperado

Bajo carga normal (10-50 RPS):
- Latencia: 50-150ms
- Éxito: > 99%
- Throughput estable

Bajo carga alta (100+ RPS):
- Latencia: 200-500ms
- Éxito: > 95%
- Posibles alertas de backlog

En pico (500+ RPS):
- Sistema debería mantener > 90% success
- Alertas críticas se disparan
- Dead-letter acumula eventos

---

## Próximas Fases

Después de validar Sprint 3:

1. **Integración con Inventario:** Conectar con sistema externo
2. **Scale Testing:** Pruebas con 1000+ eventos/min
3. **Disaster Recovery:** Simular fallos de BD
4. **Security Audit:** Validar contratos API
5. **Production Deployment:** Ready para live

---

**Contacto:** Sistema completamente documentado y funcional. Cualquier issue crear GitHub issue con logs de `[v0]`.
