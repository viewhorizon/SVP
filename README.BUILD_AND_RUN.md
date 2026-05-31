# Build and Run Guide

## Requisitos Previos
- Node.js 18+ (recomendado 20+)
- npm 9+

## Scripts Disponibles

```bash
npm run dev
npm run build
npm run preview
npm run check
npm run diagnose
```

## Backend (opcional)

Variables sugeridas en `.env.example`:

- `AUTH_MODE=dev` para local rapido (`Bearer dev:<uid>`)
- `AUTH_MODE=firebase` para verificar JWT con Firebase Admin
- `VOTES_RATE_LIMIT_WINDOW_MS` y `VOTES_RATE_LIMIT_MAX` para anti abuso
- `VOTES_CACHE_TTL_SECONDS` para cache de lectura en `GET /api/votes/count` y `GET /api/votes/limits`
- `PLANNING_AI_MODE=local` para analisis local sin proveedor externo
- `PLANNING_AI_MODE=openai_compatible` para usar proveedor tipo OpenAI
- Si usas `openai_compatible`: definir `PLANNING_AI_BASE_URL`, `PLANNING_AI_API_KEY`, `PLANNING_AI_MODEL`
- Webhook seguro recomendado: `WEBHOOK_SIGNING_SECRET` + headers `x-webhook-timestamp` y `x-webhook-signature`
- Dispatcher automatico opcional: `OUTBOX_DISPATCH_INTERVAL_MS` y `OUTBOX_DISPATCH_BATCH_LIMIT`
- Firma de auditoria de ledger opcional: `LEDGER_AUDIT_SIGNING_SECRET`

Contrato API base disponible en `backend/openapi.yaml`.

SQL recomendado para ambiente local (orden):

- `backend/sql/20260318_spv_points_core.sql`
- `backend/sql/20260318_votes_table.sql`
- `backend/sql/20260320_inventory_liveops_inventory.sql`
- `backend/sql/20260321_identity_and_ingest.sql`
- `backend/sql/20260322_achievements_voting.sql`
- `backend/sql/20260323_outbox_dispatcher.sql`
- `backend/sql/20260324_inventory_ledger_hash_chain.sql`
- `backend/sql/20260325_policy_rules.sql`
- `backend/sql/seed_demo_data.sql`

Swagger UI disponible en `GET /docs` y especificacion cruda en `GET /openapi.yaml`.

Integracion estandar de apps externas con SVP:

- `POST /api/identity/link` para vincular `sourceApp + externalUserId` con `svpUserId`
- `GET /api/identity/link` para resolver vinculo
- `POST /api/events/validate` para previsualizar conversion a puntos SVP (formula principal: horas * votos)
- `POST /api/events/results` para procesar resultados y acreditar puntos
- `POST /api/achievements` para crear logros votables por actividad
- `POST /api/achievements/:achievementId/vote` para votar logros
- `POST /api/achievements/:achievementId/close` para cerrar votaciones de logros
- `POST /api/inventory/lifecycle/transfer` para transferir objetos entre usuarios (y puntos equivalentes)
- `POST /api/inventory/lifecycle/destroy` para destruir objetos y acreditar puntos
- `POST /api/inventory/lifecycle/transform` para transformar objetos con delta de puntos configurable
- `GET /api/inventory/ledger/verify` para verificar integridad hash-chain por usuario
- `GET /api/outbox/pending` para revisar eventos pendientes del dispatcher
- `POST /api/outbox/dispatch` para despachar batch de eventos (at-least-once)
- `GET /api/policy/rules` para listar reglas activas por dominio
- `POST /api/policy/evaluate` para simular mutaciones (`ProposedMutation`) sin mutar datos
- Contrato versionado: los endpoints API tambien estan disponibles en `/api/v1/*`.
- Gestion de secretos: `backend/src/services/secrets.ts` centraliza lectura de secrets por entorno.
- Runbook operativo: `backend/RUNBOOK_DISPATCHER_LEDGER.md`.
- Test manual de concurrencia lifecycle: `backend/sql/test_inventory_lifecycle_concurrency.sql`.

## Probar Local Y En Red

1. Frontend local:
   - `npm run dev`
2. Backend local (sin script dedicado):
   - `npx tsx backend/src/app.ts`
3. Probar desde otra maquina en la misma red:
   - iniciar Vite con host abierto: `npm run dev -- --host 0.0.0.0 --port 5173`
   - iniciar API con puerto abierto: `PORT=4000 npx tsx backend/src/app.ts`
   - abrir en cliente remoto: `http://<IP_LOCAL>:5173`

Smoke tests rapidos:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/docs
curl -H "Authorization: Bearer dev:11111111-1111-1111-1111-111111111111" \
  http://localhost:4000/api/points/balance
```

Observabilidad basica:

- Todas las respuestas API incluyen `x-request-id`.
- Frontend SPV muestra el ultimo `Request ID` para facilitar debugging cruzado con logs backend.

## Tests API

Se agregaron pruebas de integracion en:

- `backend/tests/api.integration.test.ts`
- `backend/tests/aiPlanning.integration.test.ts`
- `src/services/kanbanService.test.ts`

Para ejecutarlas manualmente:

```bash
npx vitest run backend/tests/api.integration.test.ts
npx vitest run backend/tests/aiPlanning.integration.test.ts
npx vitest run src/services/kanbanService.test.ts
```

## CI/CD Basico

Pipeline inicial en `.github/workflows/ci.yml`:

- instala dependencias (`npm ci`)
- ejecuta type-check (`npm run check`)
- ejecuta build (`npm run build`)
- corre pruebas clave de frontend/backend con Vitest

Publicacion recomendada (manual):

```bash
git add .
git commit -m "chore: cierre sprint API+Kanban+docs"
git push origin main
```

Notas:

- Este entorno no hace push automatico a GitHub.
- El pipeline CI se ejecuta cuando tu haces push o abres PR.
- Si CI falla, revisa el log del job y corrige antes de mergear.

Resumen de sprints y terminos: `SPRINTS_Y_TERMINOS.md`.

Webhook HMAC (ejemplo):

```bash
ts=$(date +%s)
body='{"userId":"11111111-1111-1111-1111-111111111111","amount":5,"sourceSystem":"liveops"}'
sig=$(printf '%s.%s' "$ts" "$body" | openssl dgst -sha256 -hmac "$WEBHOOK_SIGNING_SECRET" -hex | sed 's/^.* //')

curl -X POST http://localhost:4000/api/webhooks/points/credit \
  -H "Content-Type: application/json" \
  -H "x-webhook-timestamp: $ts" \
  -H "x-webhook-signature: sha256=$sig" \
  -d "$body"
```

Notas de seguridad webhook:

- Repetir el mismo `timestamp + signature` dentro de la ventana de tolerancia responde `409` (anti-replay).
- Para idempotencia de negocio en webhook se prioriza: `requestId` -> `eventId` -> `Idempotency-Key`.

Idempotencia recomendada en operaciones criticas:

```bash
curl -X POST http://localhost:4000/api/points/credit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev:11111111-1111-1111-1111-111111111111" \
  -H "Idempotency-Key: credit-demo-001" \
  -d '{"amount":10}'
```

Idempotencia y concurrencia en terminos simples:

- Idempotencia: si reintentas una operacion por timeout/red con la misma clave (`requestId` o `Idempotency-Key`), el backend responde sin volver a aplicar el cambio.
- Concurrencia: si llegan dos operaciones casi al mismo tiempo sobre el mismo saldo, el backend usa transacciones y bloqueo de wallet para mantener consistencia y evitar saldos invalidos.

Pruebas sugeridas (manuales y automatizadas):

```bash
npx vitest run backend/tests/api.integration.test.ts
```

Scripts SQL de concurrencia (manual):

- `backend/sql/test_inventory_lifecycle_concurrency.sql`
- `backend/sql/test_points_ledger_concurrency.sql`

- Caso idempotente: repetir dos veces el mismo `POST /api/points/credit` con igual `Idempotency-Key`; la segunda debe responder `idempotent: true`.
- Caso concurrencia: dos debitos paralelos que superan saldo total; uno debe fallar con `409 Saldo insuficiente`.

## Diagnostico rapido

Si el preview sale en blanco:

1. Ejecuta `npm run build` y `npm run preview`.
1. Revisa errores de consola del navegador.
1. Usa `debug-inject.js` en DevTools para diagnostico.

## Estructura

```text
src/
backend/
scripts/
debug-inject.js
TROUBLESHOOTING.md
```