# Guía de Uso - Nuevas Mejoras del Sistema

## 1. Panel Analizar IA

### Cómo Usar

#### Opción A: Analizar Archivo
1. Click en botón **"Analizar IA"**
2. Se abre modal con opciones
3. Selecciona proveedor:
   - **Automático** - Selección más rápida (recomendado)
   - **OpenAI** - Análisis más preciso
   - **Groq** - Análisis en tiempo real
4. Click en **"Analizar IA"**
5. El modal muestra resultado con 4 secciones

#### Opción B: Importar y Analizar Documento
1. Click en **"Importar tablero"** e importar archivo (`.md`, `.txt`, `.json`, `.csv`)
2. El contenido se carga en el modal AnalyzeAI
3. Selecciona proveedor de IA
4. Click en **"Analizar IA"**

### Resultado del Análisis

El análisis te proporciona:

```
RESUMEN EJECUTIVO
- Línea 1: Descripción del sistema
- Línea 2: Arquitectura principal
- Línea 3: Capacidades clave

DEPENDENCIAS TÉCNICAS
- Herramientas y librerías requeridas
- Versiones mínimas
- Compatibilidades

RIESGOS IDENTIFICADOS
- Cuellos de botella potenciales
- Limitaciones técnicas
- Consideraciones de performance

RECOMENDACIONES
- Mejoras inmediatas (prioridad 1)
- Optimizaciones a mediano plazo
- Estrategia a largo plazo
```

---

## 2. Backlog Estratégico

### Activar/Desactivar

Click en botón **"Backlog Estrategico"** en la barra de acciones:
- Azul/activo: Panel visible
- Gris/inactivo: Panel oculto

### Entender el Panel

#### Indicador de Progreso

Cada tarea estratégica muestra:
- **Número grande (centro-derecha)**: Porcentaje completado (0-100%)
- **Texto pequeño**: "X/Y completas" (cantidad de subtareas)
- **Color de fondo**: Indicador visual del estado

```
Rango de Colores:
┌────────────────────────────────────────────┐
│ 0% [Gris]   → Sin iniciar                  │
│ 1-24% [Rojo] → Crítico, requiere atención  │
│ 25-49% [Naranja] → En riesgo               │
│ 50-74% [Amarillo] → En progreso normal     │
│ 75-99% [Lima] → Casi completado            │
│ 100% [Verde] → Completado                  │
└────────────────────────────────────────────┘
```

#### Expandir Tarea Estratégica

Click en cualquier tarjeta para expandir y ver:

**Criterios de Aceptación** ✓
- Requisitos medibles
- Deben estar TODOS completos
- Ejemplo:
  ```
  ✓ Endpoint retorna en < 500ms
  ✓ Incluye firma del servidor
  ✓ Verificable en toda la cadena
  ```

**Dependencias** 🔗
- Otras tareas que deben estar completas primero
- Click para navegar a la tarea
- Ejemplo: sp3-01, sp3-02

**Riesgos Identificados** ⚠️
- Posibles problemas
- Consideraciones importantes
- Acciones preventivas

**Subtareas** 📋
- Listado de tareas desplegadas de esta
- Indicador de color por estado:
  - Verde: Completada
  - Amarillo: En proceso
  - Violeta: En revisión
  - Gris: Pendiente

### Ejemplo: Task sp3-02 (Dead-Letter Replay)

```
sp3-02 | Outbox dead-letter replay seguro
Descripción: Herramienta para reintentar eventos DLQ...

[Expandido]

Criterios de Aceptación:
✓ Panel muestra eventos en DLQ con filtros
✓ Botón de replay individual y masivo
✓ Control de idempotencia previene duplicados
✓ Máximo 3 reintentos por evento

Dependencias:
🔗 nxt-03  🔗 nxt-04

Riesgos Identificados:
⚠️ Eventos corruptos pueden bloquear cola
⚠️ Replay masivo puede saturar sistema destino

Subtareas (2/4 completas):
● sp3-02-a - Crear componente UI
● sp3-02-b - Implementar servicio replay
● sp3-02-c - Agregar control idempotencia (EN PROGRESO)
● sp3-02-d - Testing y validación (REVISION)
```

---

## 3. Crear/Editar Tareas con Criterios

### Al Crear Nueva Tarea

Nuevo formulario mejorado con campos:
- Título ✓
- Descripción ✓
- Categoría ✓
- Prioridad ✓
- Tiempo estimado ✓
- **Criterios de Aceptación** (NEW) - agregar lista
- **Dependencias** (NEW) - enlaces a otras tareas
- **Riesgos** (NEW) - lista de riesgos

### Ejemplo: Crear Tarea "API Gateway Setup"

```
Título: Configurar API Gateway
Descripción: Exponer endpoints públicamente

Criterios de Aceptación:
+ Endpoints accesibles en dominio público
+ Rate limiting configurado (100 req/min)
+ CORS habilitado para dominios específicos
+ Logging de todas las requests

Dependencias:
+ nxt-01 (Autenticación)
+ nxt-02 (Base de datos)

Riesgos:
+ Exposición accidental de endpoints privados
+ Performance bajo alta carga
```

---

## 4. Botones Consolidados

### Exportar

Click en **"Exportar"** para elegir formato:

```
┌────────────────────────────────┐
│ Exportar                       │
├────────────────────────────────┤
│ CSV (Trello)                   │
│ CSV (Jira)                     │
│ CSV (Asana)                    │
│ JSON                           │
└────────────────────────────────┘
```

Cada formato está optimizado para:
- **Trello**: Columnas simples
- **Jira**: Campos personalizados + estimaciones
- **Asana**: Dependencias + asignables
- **JSON**: Estructura completa con metadata

---

## 5. Pestaña "Simulacion"

### Acceso

Click en pestaña **"Simulacion"** en SPVSystem

### Paneles Disponibles

Cuatro paneles interactivos:

#### 1. Dead-Letter Panel
- Ver eventos fallidos
- Reintentar individual/masivo
- Monitorear idempotencia

#### 2. Alerts Panel
- Configurar umbrales
- Ver historial de alertas
- Test de webhooks

#### 3. Load Test Panel
- 4 escenarios de prueba
- Métricas: p50, p95, p99
- Exportar resultados

#### 4. Reconciliation Panel
- 5 validaciones contables
- Indicadores visuales (🟢 🟡 🔴)
- Exportar discrepancias

---

## 6. Mejoras en Etiquetas

### Health Check

Ahora muestra estado más claro:

```
ANTES:
🔴 API no disponible
🟢 API online (spv-api)

DESPUÉS:
🔴 No disponible
🟢 Disponible (spv-api)
```

---

## Flujos Comunes

### Flujo 1: Planificar Sprint Estratégico

1. Click en **"Backlog Estrategico"** para activar
2. Ver todas las tareas estratégicas con su progreso
3. Para cada tarea:
   - Revisar **Criterios de Aceptación**
   - Verificar **Dependencias** están en orden
   - Considerar **Riesgos** en planificación
4. Crear subtareas usando **"Nueva tarea"**
5. Asignar a desarrolladores

### Flujo 2: Análisis de Documentación

1. Preparar documento (Markdown o texto)
2. Click **"Analizar IA"**
3. Cargar documento
4. Elegir proveedor (recomendado: Automático)
5. Revisar análisis:
   - ¿Qué tecnologías se necesitan?
   - ¿Qué riesgos hay?
   - ¿Qué se recomienda?
6. Crear tareas basadas en recomendaciones

### Flujo 3: Monitoreo de Progreso

1. Cada hora revisar **Backlog Estrategico**
2. Observar cambio de color:
   - Si sigue **rojo** (< 25%) → Investigar bloqueos
   - Si va a **naranja** (25-49%) → Buen progreso
   - Si llega a **verde** (100%) → Celebrar completación
3. Actualizar estado de subtareas
4. El color padre cambia automáticamente

---

## Tips & Tricks

### Tip 1: Dependencias Circulares
- Cuidado con crear A → B → A
- El sistema no lo previene automáticamente
- Revisar antes de guardar

### Tip 2: Criterios Medibles
- ✓ "Endpoint retorna en < 500ms"
- ✗ "API es rápida"
- ✓ "95% uptime"
- ✗ "Sistema es confiable"

### Tip 3: Riesgos Realistas
- Identificar desde el inicio
- Actualizar conforme aparecen nuevos
- Marcar como mitigados cuando se resuelven

### Tip 4: Progreso Visual
- Color del fondo es automático
- Se calcula por subtareas completadas
- Útil para reportes ejecutivos rápidos

### Tip 5: Análisis IA
- Funciona mejor con documentación bien estructurada
- Resumen ejecutivo es útil para stakeholders
- Riesgos identificados ayudan con planificación

---

## Solución de Problemas

### Problema: Los criterios no se guardan
**Solución:** Verificar que el navegador tiene localStorage habilitado

### Problema: Backlog panel muestra tareas vacías
**Solución:** Crear subtareas usando el botón "Nueva tarea" con padre configurado

### Problema: El color no cambia
**Solución:** Refrescar página (F5) para recalcular progreso

### Problema: Modal AnalyzeAI tarda mucho
**Solución:** Cambiar a "Automático" en lugar de OpenAI/Groq

---

## Personalización

### Cambiar colores de progreso

Editar `src/components/kanban/StrategicBacklogPanel.tsx`:

```typescript
const getProgressColor = (progress: number): string => {
  if (progress === 0) return 'from-slate-200 to-slate-300';   // Cambiar aquí
  if (progress < 25) return 'from-red-200 to-red-300';        // O aquí
  // ... etc
};
```

### Cambiar umbrales de progreso

```typescript
if (progress === 0) return 'gris';      // 0%
if (progress < 25) return 'rojo';       // 0-24%
if (progress < 50) return 'naranja';    // 25-49%
if (progress < 75) return 'amarillo';   // 50-74%
if (progress < 100) return 'lima';      // 75-99%
return 'verde';                         // 100%
```

---

## Más Información

- Documentación técnica: `IMPROVEMENTS_SUMMARY.md`
- Ejemplos de tareas: `src/services/kanbanService.ts` (líneas 142-248)
- Componentes: `src/components/kanban/`
