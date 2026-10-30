# Auditoría de integridad del sistema SVP

Fecha: 2026-10-30
Estado: auditoría estructural ejecutada sobre el árbol actual.

## Resumen ejecutivo

El sistema tiene una base funcional y modular, pero no es correcto afirmar que cada símbolo está completamente justificado ni que está listo para producción. La evidencia permite afirmar:

- Flujo funcional SVP: **aprox. 75%** (actividades, voto, puntos, historial, trazabilidad y paneles principales).
- Preparación productiva: **aprox. 55%** (autenticación demo, contratos compartidos, pruebas E2E formales y algunos fallbacks pendientes).
- Ciclo de vida global estimado: **aprox. 65%**. Es una estimación de madurez, no cobertura de líneas ni porcentaje de archivos aprobados.

La cifra global no sustituye a los criterios de aceptación: los riesgos P0/P1 siguen abiertos.

## 1. Ciclo de vida

| Fase | Estado | Evidencia |
| --- | --- | --- |
| Descubrimiento y arquitectura | Completa con deuda | `docs/ARCHITECTURE.md`, `docs/SYSTEM_INDEX.md` |
| Implementación funcional | Avanzada | `src/`, `backend/src/`, scoring Neon validado |
| Integración persistente | Avanzada | `backend/src/routes/spvMvp.routes.ts`, migraciones SQL |
| Verificación automatizada | Parcial | 17/17 API; Playwright preparado para CI |
| Endurecimiento productivo | Pendiente | auth demo, contratos compartidos, E2E CI y tests operativos |
| Operación y mantenimiento | Parcial | paneles, logs y health existen; falta contrato completo de paneles |

## 2. Verificación por unidad

No se puede certificar individualmente cada script, clase, función y método solo con `check`/`build`: esos comandos prueban compilación, no intención ni cobertura completa. El estado verificable es:

- **Módulos canónicos:** justificados en `docs/SYSTEM_INDEX.md` y `docs/ARCHITECTURE.md`.
- **Rutas y servicios backend:** tienen responsabilidad identificable; requieren ampliar pruebas de contrato.
- **Componentes de operaciones:** uno por responsabilidad, conectados a rutas reales; faltan tests automatizados por panel.
- **Scripts de migración:** requieren registro individual de propósito y no deben ejecutarse indistintamente.
- **Archivos generados:** `playwright-report/` y `test-results/` son artefactos, no código fuente; no deben editarse manualmente.
- **Símbolos sin justificación demostrada:** no se declara ninguno eliminado en esta auditoría; se requiere análisis estático de imports y cobertura por función para certificarlo.

## 3. Prácticas de ingeniería

| Área | Estado | Hallazgo |
| --- | --- | --- |
| TypeScript/build | PASS | `npm run check` y `npm run build` aprobados previamente |
| Validación de entrada | PASS/PARCIAL | Zod y validación de voto; ampliar cobertura por ruta |
| Persistencia | PASS | consultas parametrizadas y transacciones en flujo SVP |
| Rollback/idempotencia | PASS/PARCIAL | scoring y webhooks cubiertos; ampliar inventario |
| Manejo de errores | PARCIAL | hay estados visuales y logs, pero existen retornos silenciosos legacy |
| Comentarios | PARCIAL | documentación arquitectónica existe; comentarios deben explicar solo decisiones no obvias |
| Debug logs | PARCIAL | hay `console.log` de diagnóstico; deben consolidarse antes de producción |
| Observabilidad | PARCIAL | request id, health y paneles; falta contrato automatizado de paneles |
| Seguridad | PARCIAL | HMAC/rate limit presentes; autenticación demo no es producción |

## 4. Adherencia al diseño

La implementación respeta el flujo previsto:

```text
Vista → useSpv → cliente HTTP/API → controlador Express → servicio/repositorio → Neon
```

La actividad externa sirve como puente de simulación y de integración: `externalDomain`, `externalReference`, `operationId` y `valueUnit` preservan la trazabilidad. Inventory/CRM/E-commerce son contextos externos; no se deben tratar como mercado ni como dinero sin reglas externas.

La principal desviación pendiente es que MVC es funcional, no una implementación clásica basada en clases: parte de la orquestación transaccional permanece en rutas. Esto está documentado como deuda, no como incumplimiento oculto.

## 5. Orfandad y basura

No se eliminó ningún archivo por suposición. La auditoría clasifica:

- **Fuente activa:** `src/`, `backend/src/`, `backend/tests/`, `tests/e2e/`.
- **Compatibilidad/histórico:** scripts de migración alternativos; conservar hasta confirmar consumidores y documentar decisión en `docs/LEGACY_DECISIONS.md`.
- **Generado:** `playwright-report/`, `test-results/`; conservar como evidencia local o excluir de releases, nunca modificarlos como fuente.
- **Candidatos a revisión posterior:** `debug-inject.js`, scripts de diagnóstico y migraciones duplicadas aparentes; no se consideran basura sin evidencia de no uso.

Conclusión: no hay base suficiente para afirmar “cero huérfanos”. Sí hay un índice canónico y reglas anti-duplicación para impedir nuevas copias.

## 6. Trabajo requerido para certificar integridad

1. Ejecutar análisis de imports/exports y referencias para cada archivo fuente.
2. Generar cobertura por archivo y revisar funciones no cubiertas.
3. Añadir tests de contrato para Alerts, Dead Letter, Load Test y Reconciliation.
4. Reemplazar fallbacks silenciosos por estados explícitos `live`, `degraded` o `demo`.
5. Sustituir autenticación demo por autenticación de producción.
6. Ejecutar Playwright en CI con dependencias instaladas.
7. Registrar cada decisión de migración antes de retirar cualquier script.

## Criterio de cierre

No declarar integridad total hasta que los siete puntos anteriores tengan evidencia. La cobertura existente es un indicador, no el criterio único de calidad.
