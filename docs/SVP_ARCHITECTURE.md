# SVP — especificación funcional breve

## Propósito

SVP convierte trabajo y actividad monitoreados en puntos. Los votos locales y globales son señales de entrada a la fórmula; no son dinero ni una instrucción para comprar bienes o servicios. No se ha definido una relación entre votos y compras.

## Unidad operativa

El monitoreo ocurre por persona, actividad y local: registrar quién realizó la actividad, cuándo, cuánto tiempo y qué evidencia valida el periodo. Solo el tiempo verificado y la actividad vinculada pueden entrar al cálculo de puntos. Los votos globales y locales alimentan la fórmula de conversión definida por el sistema.

**Flujo previsto:** persona + actividad/local → sesiones y evidencia → validación del tiempo → votos locales/globales como factores → fórmula → puntos → historial. Las transferencias de puntos son aparte; ningún flujo de compra queda implícito.

## Relación Dominio (Origen) → Actividades

El selector de actividad depende del dominio elegido. Ejemplo solicitado: `Panadería → Panadero, Vendedor, Limpieza`. La demo también muestra `Restaurante → Cocinero, Mesero, Limpieza` y `Peluquería → Peluquero, Recepcionista, Limpieza`. Solo aparecen actividades vinculadas y registradas; si falta la actividad backend, no se puede simular ese evento.

Actualmente esas tres relaciones viven en `SIMULATION_DOMAIN_LINKS` de `src/SPVSystem.tsx`; son configuración de demostración, no asociaciones persistidas ni un catálogo editable en producción.

## Implementación existente y brechas

- `POST /api/svp/votes` en `backend/src/routes/svp/votes.routes.ts` es el único endpoint de voto; calcula el otorgamiento con `point_rules`, registra votos/ledger y conserva historial y progreso de tareas vinculadas en una transacción.
- El endpoint anterior `/api/spv/vote` y el antiguo montaje `/api/votes` fueron retirados; los clientes internos llaman la ruta canónica y los clientes externos deben actualizar su URL.
- El monitoreo de sesiones/tiempo y su evidencia no está implementado de extremo a extremo.
- Las rutas de inventario/wallet son independientes. No documentan ni autorizan compras con votos.

## Fallbacks comprobados en código

- `src/services/spvApi.ts`: `getUsers` retorna cinco usuarios mock si falla; `getActivities`, `getTransactions` y `getTableData` retornan `[]`; `createActivity` y `updateActivity` fabrican respuestas locales; deletes y `cancelTransfer` ignoran errores.
- `src/hooks/useSpv.ts`: si fallan las llamadas reales, el voto y la transferencia pueden actualizar el estado local y mostrar éxito.
- Hay diferencias entre rutas cliente `/api/users` y `/api/activities` y rutas MVP del backend `/api/spv/users` y `/api/spv/activities`; no son el mismo contrato.

Este documento describe comportamiento comprobado y separa los flujos funcionales previstos de lo que aún falta implementar.
