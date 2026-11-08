# Backlog de continuidad y nuevos sprints

Este backlog separa trabajo verificable por el sistema de trabajo que debe ejecutar el usuario.

## Sprint 4 — Operación observable

- [x] Añadir descarga `.log` desde la consola de monitoreo.
- [x] Incluir en el log: fecha, estado Health API, modo simulación, request ID y eventos.
- [ ] Validar en preview que el archivo descargado conserva la secuencia completa.
- [ ] Definir retención y almacenamiento de logs del backend para producción.

## Sprint 5 — Contrato API y datos reales

- [ ] Levantar el backend Express en el entorno de desarrollo y validar `GET /health`.
- [ ] Validar `GET /api/spv/activities`, `POST /api/spv/vote` y `GET /api/spv/history` contra Neon.
- [ ] Registrar errores de base de datos con request ID y respuesta segura.
- [ ] Añadir pruebas de integración para límite diario de 5 votos y respuesta HTTP 429.

## Sprint 6 — Robustez y liberación

- [ ] Completar pruebas de UI responsive en Moto G7 Play y escritorio 1512×720.
- [ ] Ejecutar pruebas de carga únicamente en modo simulación y con límites explícitos.
- [ ] Ejecutar reconciliación y dead-letter con datos controlados.
- [ ] Mover tarjetas a `done` solo cuando sus criterios de aceptación tengan evidencia; las pruebas manuales permanecen en `review` hasta que el usuario las ejecute.

## Regla de movimiento de tarjetas

Una tarjeta implementada pasa a `done` cuando existe evidencia automática o reproducible. Una tarjeta que requiere observar el entorno, conectar Neon, descargar un log o ejecutar un flujo manual no se marca como terminada por anticipado: se mantiene en `review` y se adjunta la evidencia.

## Bloqueo actual

El indicador `Backend no disponible` significa que el navegador no está alcanzando el proceso Express en el proxy configurado o que `/health` no puede completar su comprobación de Neon. No se debe ocultar con datos simulados: primero se valida el proceso, la ruta, el proxy y la conexión de base de datos.
