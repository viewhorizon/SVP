# SVP — guía breve de verificación

## Flujo previsto

`Dominio (Origen) → actividad vinculada → monitoreo individual/local (persona + tiempo + evidencia) → votos locales/globales como factores → fórmula de conversión → puntos`.

Votos no son compras. La demo tiene relaciones configuradas en `SIMULATION_DOMAIN_LINKS` (Panadería, Restaurante y Peluquería); esas relaciones no están guardadas en backend.

## Implementación a distinguir

- Dashboard e integraciones: `src/hooks/useSpv.ts` llama `POST /api/svp/votes` mediante `src/services/spvApi.ts`, que adjunta el Bearer token.
- Contrato único: `backend/src/routes/svp/votes.routes.ts` calcula puntos con `point_rules`, persiste `votes`/`points_ledger` y, cuando la actividad MVP existe, registra historial y progreso de tarea dentro de la misma transacción.
- Tiempo y evidencia laboral: no está completo de extremo a extremo.
- Inventario: rutas independientes; no se deriva de ello un requisito de compra con puntos.

## Verificación recomendada

1. Elegir Dominio (Origen) y comprobar que el segundo selector solo muestra actividades vinculadas y registradas.
2. Si no hay una actividad backend con ese nombre, la simulación debe quedar deshabilitada; no simular un voto ficticio.
3. Al votar, contrastar la respuesta de la ruta, votos, regla aplicada, ledger/historial y saldo.
4. En viewport móvil y 1512×720, comprobar que los selectores y botones no se desbordan y que la página puede desplazarse verticalmente.
5. Registrar commit, viewport, endpoint y evidencia real. No describir un estado local/mock como persistido.

## Fallbacks que existen en el código

- `src/services/spvApi.ts`: `getUsers` devuelve usuarios mock en catch; `getActivities`, `getTransactions`, `getTableData` devuelven `[]`; create/update devuelven objetos locales; algunos deletes/cancelaciones tragan errores.
- `src/hooks/useSpv.ts`: el catch de voto actualiza puntos/historial localmente; el catch de transferencia también cambia el balance local y muestra éxito.
- `src/SPVSystem.tsx`: el catálogo de vínculos es configuración de demo; no prueba una relación persistida en base de datos.

Estas son observaciones directas de implementación, no requisitos de producto. La prueba de persistencia requiere respuestas HTTP y datos en backend.
