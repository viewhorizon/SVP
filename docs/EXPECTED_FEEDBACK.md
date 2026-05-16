# Feedback Esperado del Sistema MVP

## Arquiectura de Testing y Feedback

### Ciclo de Feedback Propuesto

El usuario sugiere un sistema donde los tests exitosos de la simulación generen eventos que se envíen automáticamente al Kanban board, moviéndose progresivamente a través de las columnas según el avance.

### Propuesta de Implementación

**Test Backlog separado** en el Kanban con tareas como:
- Test de votación (Actividades tab)
- Test de transferencia (Puntos tab)
- Test de historia (Historial tab)
- Test de operaciones (Operations tab)

**Flujo automático:**
1. Usuario ejecuta acción (ej: Votar)
2. Sistema registra evento con éxito/fallo
3. Si es exitoso y modo simulación está activo:
   - Crea/actualiza tarea de test en Kanban
   - La tarea se mueve automáticamente: Todo → In Progress → Review → Done
   - Dashboard muestra métricas de éxito

### Eventos a Capturar para Feedback

Desde **Actividades**:
- Votación exitosa: +X puntos
- Votación fallida: razón del fallo
- Tasa de éxito: % de votos exitosos

Desde **Puntos**:
- Transferencia completada: usuario receptor
- Recepción de puntos: cantidad
- Balance actualizado correctamente

Desde **Historial**:
- Transacciones registradas correctamente
- Sincronización con BD exitosa
- Integridad de datos verificada

Desde **Operaciones**:
- Dead-letter replay exitoso
- Alertas operativas disparadas
- Conciliación contable validada

### Métricas a Mostrar

- Total de pruebas ejecutadas
- Tasa de éxito (%)
- Promedio de latencia
- Eventos procesados hoy
- Integraciones sincronizadas

## Próximos Pasos

1. Implementar conexión Kanban ↔ SPVSystem
2. Crear Test Tasks automáticamente
3. Mover tareas según estado de eventos
4. Mostrar dashboard de métricas
5. Exportar reporte de pruebas

---

**Estado Actual:**
- Sistema MVP funcional con 4 pestañas
- Consola de eventos simulados
- CRUD completo en historial
- Listo para integración con Kanban
