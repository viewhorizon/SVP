# Guía de Operaciones y Pruebas

Actualizada: 2026-11-25.

## Qué está implementado y qué falta comprobar

El backend y la interfaz incluyen cuatro herramientas operativas. Que un panel exista o responda no significa que todas sus reglas estén probadas. La suite actual de pruebas no contiene todavía pruebas de contrato para estos cuatro paneles; por eso la tarea de verificación sigue pendiente en el Kanban.

| Herramienta | En palabras sencillas | Rutas actuales |
| --- | --- | --- |
| Eventos fallidos (Dead Letter) | Muestra un resumen de entregas fallidas y permite volver a intentar enviarlas con filtros. | `GET /api/v1/dead-letter/stats`, `GET /api/v1/dead-letter/by-app`, `POST /api/v1/dead-letter/replay` |
| Alertas | Revisa atrasos y fallos del despachador; guarda las alertas críticas. | `POST /api/v1/alerts/check`, `GET /api/v1/alerts/history` |
| Prueba de carga | Envía solicitudes controladas y mide respuesta; no demuestra capacidad de producción por sí sola. | `POST /api/v1/load-test/run`, `POST /api/v1/load-test/votes`, `POST /api/v1/load-test/events` |
| Revisión de saldos (conciliación) | Compara saldos, movimientos y referencias para encontrar diferencias; no corrige datos. | `POST /api/v1/reconciliation/report`, `POST /api/v1/reconciliation/check/balances`, `/hash-chain`, `/transactions`, `/orphaned` |

Todas las rutas anteriores requieren autenticación. El prefijo `/api/v1` está registrado por el backend. Los nombres aquí se contrastaron con `backend/src/routes/`; si cambia una ruta, actualizar esta tabla junto con las pruebas.

## Uso seguro

- Probar en un entorno de desarrollo o pruebas, nunca contra producción sin autorización.
- La prueba de carga genera tráfico real hacia la dirección indicada. Empezar con un objetivo aislado y carga baja.
- Reintentar eventos fallidos vuelve a ejecutar su entrega; confirmar el destino y evitar repetir acciones sin revisar el resultado.
- La revisión de saldos solo informa diferencias; cualquier reparación de datos requiere revisión humana y aprobación.
- El chequeo de alertas puede guardar alertas críticas en la base de datos.
- No crear datos falsos en la base compartida para que un panel “se vea lleno”. Las pruebas deben usar datos de prueba controlados.

## Qué significa cada resultado de la verificación

- **Completado:** existe evidencia reproducible de que se cumplen los criterios escritos.
- **En revisión:** la función parece estar implementada, pero falta comprobar uno o más criterios.
- **Pendiente:** falta implementar la función o una prueba necesaria.
- Un reporte de `npm run test:api` valida rutas de backend; no valida la interfaz del navegador.
- Una prueba de Playwright navega por la interfaz. El CI instala Chromium y ejecuta estas pruebas, pero hay que revisar que la ejecución más reciente haya terminado correctamente antes de marcarla completada.

## Prioridad de seguimiento

1. Añadir pruebas de contrato para las rutas de eventos fallidos, alertas, carga y revisión de saldos.
2. Ejecutar y revisar el recorrido de navegador en CI; corregir las pruebas que aún dependan de rutas o funciones antiguas.
3. Medir carga solo en ambiente aislado y registrar el resultado, sin prometer un objetivo que no se haya medido.
4. Reparar y probar el programa que aplica migraciones de base de datos en una base desechable antes de usarlo en despliegue.

Este documento describe las rutas verificadas en el código actual. No sustituye los resultados de CI ni certifica disponibilidad o rendimiento en producción.
