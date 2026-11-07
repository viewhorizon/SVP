# Evidencia operativa del sistema SVP

## Propósito

Este documento define cómo demostrar el flujo completo del Sistema de Votos y Puntos (SVP), desde una actividad externa hasta el valor acumulado, la persistencia y la observabilidad. La consola de simulación no sustituye la base de datos: sirve como guía visible de ejecución y debe coincidir con los registros del backend.

## Flujo verificable

1. **Origen externo**: Inventory, CRM, E-commerce o un adaptador personalizado representa una plataforma suscrita al SVP.
2. **Actividad SVP**: el selector usa una actividad real cargada desde `/api/activities` y no una tarjeta ficticia local.
3. **Contrato**: la vista envía el identificador de actividad, dominio externo, referencia y `requestId` al adaptador `spvApi`.
4. **Controlador**: Express valida el contrato, identifica usuario/actividad, aplica límites e idempotencia.
5. **Modelo/Neon**: el voto, saldo, historial y vínculos de tarea/objetivo se escriben de forma transaccional.
6. **Resultado**: la interfaz muestra puntos, progreso, notificación de impacto y evento en la consola.
7. **Auditoría**: `requestId`, `eventId`, estado, timestamp y mensaje permiten reconstruir la operación.

## Evidencia por módulo

| Módulo | Evidencia requerida | Resultado esperado |
| --- | --- | --- |
| Health API | respuesta `/health` y estado visible | servicio y base de datos diferenciados |
| Actividades | captura/listado y respuesta API | actividades reales disponibles |
| Votación | log pending → success/error | puntos y límite diario actualizados |
| Puntos | saldo antes/después e historial | operación persistida |
| Inventario | evento externo con referencia de objeto | consumo futuro de saldo SVP trazable |
| CRM/E-commerce | evento externo con dominio | misma cadena SVP, sin sistemas externos falsos |
| Operaciones | paneles y endpoint correspondiente | errores, alertas, dead-letter, carga y conciliación observables |
| Kanban | tarea y objetivo vinculados | progreso actualizado sin datos desconectados |
| Errores | payload inválido, 404, rollback | respuesta controlada y sin mutación parcial |

## Registro de ejecución

Cada ejecución debe conservar:

- fecha y entorno;
- commit probado;
- viewport y modo de navegador;
- `requestId`/`eventId`;
- actividad y dominio externo;
- saldo y puntos antes/después;
- resultado de cada endpoint;
- captura de pantalla o snapshot del panel;
- errores y limitaciones del entorno.

## Evidencia actual

- Captura visual `/tmp/agent-browser/svp-operational-console.png`: viewport 346x458, modo claro; la pantalla carga y muestra cuatro actividades disponibles.
- Captura visual `/tmp/agent-browser/svp-simulation-console.png`: el modo `Eventos Sintéticos de Demostración` se activa y expone la consola, los dos selectores y los sistemas externos.
- Limitación observada en esta sesión: `Health API` mostró `Backend no disponible`; por tanto, esta captura demuestra el flujo de interfaz y no acredita una escritura real en Neon.
- Tests API: 17/17 aprobados en la última ejecución registrada.
- Verificación TypeScript (`npm run check`): aprobada en esta sesión.
- Build: aprobado en la última auditoría registrada.
- Cobertura: indicador disponible; no es criterio único de aceptación.
- Flujo externo → actividad → voto → puntos → historial → tarea/objetivo: verificado funcionalmente contra Neon en la auditoría previa.
- Flujo de navegador formal Playwright: requiere un runner con dependencias Chromium; el preview se ha verificado con `agent-browser` como alternativa funcional.

## Trabajo restante para robustez

1. Automatizar el registro de cada paso en un artefacto de CI.
2. Ejecutar E2E formal en CI con Chromium y adjuntar screenshots/traces.
3. Añadir pruebas de cada panel operativo contra su endpoint real.
4. Probar rollback, concurrencia y duplicación con datos aislados.
5. Definir retención y redacción de logs para no exponer datos sensibles.
6. Repetir la matriz con una actividad de inventario que tenga `externalReference` de objeto gamer.

La consola es evidencia de comportamiento del frontend; la prueba de integridad requiere contrastarla con respuestas HTTP y registros persistidos.
