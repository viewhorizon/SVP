# Estado de pruebas y prioridades del SVP

Actualizado: 2026-11-25.

Este documento registra resultados observados en el repositorio. “Hay código” o “hay una tarea en el tablero” no equivale a una prueba aprobada.

## Resultados verificados en esta revisión

| Revisión | Resultado |
| --- | --- |
| `npm run check` | Aprobado |
| `npm run build` | Aprobado |
| `npm run test:api` | Aprobado: 23 pruebas en 3 archivos de prueba |
| Prueba de coherencia del Kanban | Incluida en la suite; revisa que tareas no verificadas no aparezcan como completadas |
| Interfaz Kanban en navegador | Verificada a 346 × 459, modo claro; la lista muestra estados pendientes y en revisión |
| `npm run test:e2e -- tests/e2e/spv-mvp.spec.ts` | No pudo iniciar Chromium: falta una biblioteca del sistema (`libnspr4.so`). No es un fallo funcional de una prueba; el resultado E2E sigue sin confirmarse |

La cobertura de código tiene una cifra histórica, no actual: el último reporte guardado (2026-09-06) cubrió 17 pruebas y registró 60.14% statements, 41.19% branches, 59.21% functions y 62.43% lines. No usar esos porcentajes como cobertura de las 22 pruebas actuales.

El workflow `.github/workflows/ci.yml` instala Chromium con sus dependencias, ejecuta Playwright y ahora guarda `playwright-report/` y `test-results/` como artefacto de CI por 14 días. La configuración demuestra que CI intenta correr las pruebas, no que la ejecución más reciente haya pasado; revisar el resultado del workflow antes de cambiar el estado E2E a completado.

## Coherencia del Kanban

- Los criterios antiguos de crear tablas `spv_transactions` y `spv_history`, insertar cinco usuarios ficticios y probar transferencias de UI ya no describen el sistema actual. Se reemplazaron por tareas alineadas con `points_wallet`, `points_ledger`, `point_rules`, `point_limits` y `votes`.
- Las pruebas de API pueden verificar transacciones entre billeteras; eso no hace que las transferencias estén disponibles en la interfaz. Crédito y transferencia siguen deshabilitados hasta resolver identidad y autorización.
- Las pruebas automatizadas de navegador usan respuestas de prueba; no acreditan que una base Neon productiva esté configurada correctamente.
- Las tareas ya guardadas en el navegador reciben estos títulos y criterios corregidos, conservando sus notas y estados elegidos por la persona, salvo los estados explícitamente fijados como evidencia por el tablero.
- Las funciones operativas sí tienen rutas de backend, pero faltan pruebas de contrato de los cuatro paneles. Las rutas vigentes están en `docs/TESTING_SPRINT3.md`.

## Plan por prioridad

### P0 — antes de producción

1. Sustituir o restringir la autenticación de demostración; una simulación no protege cuentas reales.
2. No ejecutar reintentos ni pruebas de carga en producción sin autorización y un límite seguro.

### P1 — siguiente trabajo funcional

1. Conseguir una ejecución Playwright aprobada en CI y revisar el reporte descargable.
2. Añadir pruebas para respuestas correctas y errores de los paneles de eventos fallidos, alertas, carga y revisión de saldos.
3. Corregir el programa de migraciones y ensayarlo en una base de datos desechable antes de cambiar una base compartida.
4. Confirmar el esquema de datos activo en cada entorno; no crear tablas históricas por el nombre de una tarea antigua.

### P2 — ampliar confianza

1. Añadir pruebas de navegador para crear/votar actividades y estados de error.
2. Recalcular cobertura con la suite vigente y guardar el reporte.
3. Ampliar pruebas de accesibilidad, tamaños de pantalla y rendimiento medido.

## Términos rápidos

- **Prueba de API:** comprueba una solicitud al servidor y su respuesta.
- **Prueba de navegador (E2E):** usa la interfaz como una persona y comprueba el recorrido completo.
- **Prueba de carga:** envía tráfico de prueba para observar tiempos y errores; no prueba por sí sola la capacidad de producción.
- **Conciliación:** compara saldos y movimientos para encontrar diferencias; no las corrige automáticamente.
- **Programa de migraciones:** aplica cambios de estructura a la base de datos; debe registrar qué aplicó y detenerse ante errores.
- Para otros términos, ver “Términos en lenguaje sencillo” en `docs/CODE_INTEGRITY_CHECKLIST.md`.
