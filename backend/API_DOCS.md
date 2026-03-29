# SPV API - Documentación

Endpoints, reglas y convenciones para el backend SPV.

- Votos API: `POST /api/votes`, `GET /api/votes/count`, `GET /api/votes/limits`
- Puntos API: `POST /api/points/credit`, `POST /api/points/debit`, `POST /api/points/transfer`, `POST /api/points/convert`, `POST /api/points/liveops/convert`, `GET /api/points/balance`, `GET /api/points/balance/:userId`
- Inventario API: `GET /api/inventory/catalog`, `GET /api/inventory/me`, `POST /api/inventory/purchase`, `POST /api/inventory/lifecycle/transfer`, `POST /api/inventory/lifecycle/destroy`, `POST /api/inventory/lifecycle/transform`, `GET /api/inventory/ledger/verify`
- Logros votados API: `GET /api/achievements`, `POST /api/achievements`, `POST /api/achievements/:achievementId/vote`, `POST /api/achievements/:achievementId/close`
- Outbox Dispatcher API: `GET /api/outbox/pending`, `POST /api/outbox/dispatch`
- Policy Engine API: `GET /api/policy/rules`, `POST /api/policy/evaluate`
- Webhooks: `POST /api/webhooks/points/credit`
- Identidad e ingesta externa: `POST /api/identity/link`, `GET /api/identity/link`, `POST /api/events/validate`, `POST /api/events/results`
- Versionado estable adicional: mismos endpoints bajo prefijo `/api/v1/*`.
- Planeacion: `POST /api/ai/planning/analyze`
- Auth: `Authorization: Bearer <token>`
- Idempotencia opcional: header `Idempotency-Key` o `x-idempotency-key`
- Observabilidad: todas las respuestas incluyen header `x-request-id`
- Auth modo `dev`: `Bearer dev:<uid>` cuando `AUTH_MODE=dev` o `AUTH_MODE=auto`
- Auth modo Firebase real: `AUTH_MODE=firebase` + credenciales de servicio
- Errores: `{ "error": "mensaje" }`
- DB principal: `points_wallet`, `points_ledger`, `votes`, `point_rules`, `point_limits`, `inventory_catalog`, `user_inventory`, `liveops_rates`, `cross_system_transactions`
- DB integracion externa: `identity_links`, `source_app_rates`, `external_activity_events`
- DB logros votados: `achievement_definitions`, `achievement_votes`
- DB outbox: `outbox_events`
- DB policy engine: `policy_rules`

## Novedades GLM completadas

- Rate limit de votos en memoria por usuario/IP:
  - `VOTES_RATE_LIMIT_WINDOW_MS` (default `60000`)
  - `VOTES_RATE_LIMIT_MAX` (default `30`)
  - Aplica en `POST /api/votes`
- Cache de lectura en memoria para votos:
  - `VOTES_CACHE_TTL_SECONDS` (default `20`)
  - Aplica en `GET /api/votes/count` y `GET /api/votes/limits`
  - Respuesta incluye `cached: true|false`
- Contrato OpenAPI base en `backend/openapi.yaml`.
- Script de prueba manual de atomicidad en `backend/sql/test_cross_system_transactions_atomicity.sql`.
- Swagger UI: `GET /docs`
- OpenAPI raw: `GET /openapi.yaml`
- Validacion de input con Zod en rutas criticas (`votes`, `points`, `ai/planning`, webhook):
  - Respuesta de validacion: `{ "error": "Body invalido|Query invalida|Params invalidos", "details": [{ "path": "campo", "message": "..." }] }`
- Idempotencia aplicada en operaciones de mutacion de votos/puntos:
  - Repetir la misma solicitud con igual `requestId` o `Idempotency-Key` devuelve `idempotent: true` y no duplica movimientos en ledger.
  - Primera ejecucion exitosa: `201`. Reintento idempotente: `200`.
 - Concurrencia de saldo:
  - Operaciones de wallet se ejecutan con transaccion SQL y bloqueo `FOR UPDATE` en `points_wallet` para evitar sobreconsumo.

## Variables de entorno clave

- `AUTH_MODE=auto|dev|firebase`
- `AUTH_INSECURE_FALLBACK=false|true`
- `FIREBASE_PROJECT_ID=<id>`
- `FIREBASE_SERVICE_ACCOUNT_JSON=<json stringificado>`
- `PLANNING_AI_MODE=local|openai_compatible`
- `PLANNING_AI_BASE_URL=<https://...>`
- `PLANNING_AI_API_KEY=<secret>`
- `PLANNING_AI_MODEL=<model-name>`
- `VOTES_CACHE_TTL_SECONDS=<segundos de cache de lectura para votos>`
- `WEBHOOK_SHARED_SECRET=<secret opcional para validar x-webhook-secret>`
- `WEBHOOK_SIGNING_SECRET=<secret para firma HMAC SHA-256 de webhook>`
- `WEBHOOK_HMAC_TOLERANCE_SECONDS=<ventana anti-replay, default 300>`
- `OUTBOX_DISPATCH_URL=<endpoint opcional para publicar eventos pendientes>`
- `OUTBOX_DISPATCH_INTERVAL_MS=<intervalo del worker automatico; 0 deshabilita>`
- `OUTBOX_DISPATCH_BATCH_LIMIT=<cantidad por ciclo del worker>`

## Integracion externa estandar (TierList, juegos, apps)

- Flujo recomendado:
  - La app externa envia resultados a SVP (`POST /api/events/results`).
  - SVP valida, calcula base de puntos y persiste en DB.
  - Regla principal de calculo base: `activityHours * votosTotales`.
  - `score` se usa como senal de logro (achievement) cuando aplique por gameplay o votacion de logros.
  - La app externa no escribe directo en la DB de SVP.
- Vinculacion de identidad federada:
  - `POST /api/identity/link` para mapear `sourceApp + externalUserId` -> `svpUserId`.
  - `GET /api/identity/link` para resolver una vinculacion.
- Validacion previa sin mutacion:
  - `POST /api/events/validate` devuelve `projectedPoints`.
- Ingesta con mutacion:
  - `POST /api/events/results` acredita puntos con idempotencia estricta por `sourceApp + eventId`.
  - Internamente se genera `sourceEventKey = sourceApp:eventId` para evitar doble procesamiento entre apps distintas.
  - Cuando la ingesta se procesa, se encola evento en `outbox_events` para despacho at-least-once.

## Outbox y dispatcher

- Objetivo:
  - Garantizar entrega at-least-once de eventos de dominio hacia integraciones externas.
- Endpoints:
  - `GET /api/outbox/pending?limit=25`: lista pendientes/reintentos.
  - `POST /api/outbox/dispatch?limit=25`: procesa batch y actualiza estados (`sent`, `failed`, `dead_letter`).
- Worker automatico:
  - Se activa con `OUTBOX_DISPATCH_INTERVAL_MS > 0`.
  - Ejecuta ciclos de dispatch por intervalo con limite `OUTBOX_DISPATCH_BATCH_LIMIT`.
- Reintentos:
  - Backoff progresivo por intento y corte a dead letter al superar max intentos.

## Policy Engine desacoplado

- Objetivo:
  - Evaluar reglas de negocio por dominio y devolver `ProposedMutation` sin acoplar logica a las rutas.
- Endpoints:
  - `GET /api/policy/rules?domain=external_activity_points`: lista reglas activas por alcance (`sourceApp`, `activityType`).
  - `POST /api/policy/evaluate`: evalua contexto y devuelve mutaciones propuestas + proyeccion de puntos.
- Integracion actual:
  - `POST /api/events/validate` y `POST /api/events/results` consultan `policy_rules` (`domain=external_activity_points`).
  - Las mutaciones soportadas son `points_multiplier`, `points_bonus`, `min_points_floor`, `tag`.
  - El response incluye bloque `policy` con reglas aplicadas y resultado de ajuste.

## Logros votados por actividad

- Objetivo:
  - Definir logros por actividad que la comunidad puede votar para aprobar/rechazar desbloqueos.
- Endpoints:
  - `POST /api/achievements`: crea propuesta en estado `voting`.
  - `GET /api/achievements`: lista por `activityId` y/o `status` con conteo `up/down`.
  - `POST /api/achievements/:achievementId/vote`: voto `up` o `down` (1 voto por usuario; re-voto actualiza).
  - `POST /api/achievements/:achievementId/close`: cierra votacion (`approved`, `rejected`, `archived`).
- Reglas actuales:
  - Solo se vota cuando el logro esta en estado `voting`.
  - Solo el creador del logro puede cerrarlo.
  - El cierre guarda snapshot de votos en metadata para auditoria.

## Lifecycle de inventario (objetos dinamicos)

- Endpoints:
  - `POST /api/inventory/lifecycle/transfer`: transfiere items entre usuarios e impacta puntos equivalentes cuando `transferPoints=true`.
  - `POST /api/inventory/lifecycle/destroy`: destruye items y acredita puntos segun `pointsValuePerItem` o valor de catalogo.
  - `POST /api/inventory/lifecycle/transform`: transforma item origen->destino y ajusta puntos por delta de valorizacion.
- Regla de valorizacion por defecto:
  - Si no se envia override explicito, se usa `metadata.points_equivalent` del `inventory_catalog`.
  - Si no existe metadata, se usa `price_spv` del catalogo.
- Auditoria:
  - Cada mutacion registra evento en `inventory_ledger_events` (hash-chain).
  - Los ajustes de puntos se registran en `points_ledger` (`POINTS_TRANSFERRED_IN/OUT`, `POINTS_GRANTED`, `POINTS_DEBITED`).
  - `GET /api/inventory/ledger/verify` acepta `sign=true|false`.
  - Si `sign=true` y existe `LEDGER_AUDIT_SIGNING_SECRET`, devuelve `auditSignature` (`hashVersion`, `signature`, `signedAt`).

Ejemplo payload (`POST /api/events/results`):

```json
{
  "eventId": "tierlist-2026-03-08-best-news-001",
  "sourceApp": "tierlist-global",
  "sourceEnv": "prod",
  "externalUserId": "usr_abc_445",
  "activityType": "vote_result",
  "activityId": "best_news_week_10",
  "activityHours": 3,
  "localVotes": 1200,
  "globalVotes": 1200,
  "unit": "liveops_points",
  "metadata": {
    "rank": 1,
    "votesReceived": 2400
  }
}
```

Opcional por logro (score):

```json
{
  "eventId": "tierlist-achievement-001",
  "sourceApp": "tierlist-global",
  "activityType": "achievement_score",
  "activityId": "match-99",
  "score": 125,
  "unit": "achievement_score"
}
```

## Seguridad de webhook

- Modo basico: header `x-webhook-secret` contra `WEBHOOK_SHARED_SECRET`.
- Modo recomendado (HMAC):
  - `x-webhook-timestamp`: unix epoch en segundos.
  - `x-webhook-signature`: `sha256=<hex>` o `<hex>`.
  - Firma esperada sobre el payload `timestamp.rawBody` usando HMAC SHA-256.
  - Se valida tolerancia de tiempo con `WEBHOOK_HMAC_TOLERANCE_SECONDS` para evitar replay.
  - Si llega exactamente la misma firma dentro de la ventana de tolerancia, responde `409 Webhook replay detectado`.
  - Para idempotencia de negocio, el webhook usa `requestId`, luego `eventId`, luego `Idempotency-Key`.

Nota: el detalle completo permanece en la rama remota de referencia y los archivos SQL incluidos en `backend/sql`.

## Manager de secretos

- El proyecto incluye un manager local en `backend/src/services/secrets.ts`.
- Actualmente abstrae lectura desde variables de entorno para centralizar acceso a secretos.
- En produccion se puede reemplazar por un adapter de Secret Manager/Vault sin tocar rutas.

## Monitor transaccional SVP

- Endpoint:
  - `GET /api/monitor/transactions`
  - `GET /api/v1/monitor/transactions`
  - `GET /api/monitor/transactions/stream` (SSE tiempo real)
  - `GET /api/v1/monitor/transactions/stream` (SSE tiempo real)
- Query params opcionales:
  - `userId`
  - `status`
  - `transactionType`
  - `limit` (default 100)
  - `intervalMs` (solo stream, default 4000)
- Responsabilidad:
  - SVP centraliza el monitor oficial del ledger/transacciones.
  - Cada plataforma externa puede exponer su monitor propio para UX local, pero sin reemplazar la fuente de verdad de SVP.

## Glosario rapido

- `credit`: movimiento que suma puntos SPV al wallet.
- `debit`: movimiento que resta puntos SPV del wallet.
- `transfer`: movimiento de puntos entre dos usuarios (debito emisor + credito receptor).
- `convert`: cambio de puntos SPV por activo externo (item, inventario, LiveOps).
- `idempotency key`: clave para reintentos seguros sin duplicar efectos.
- `concurrencia`: multiples requests simultaneas sobre el mismo recurso sin perder consistencia.
- `ledger`: historial auditable append-only de movimientos de puntos.
- `cross_system_transactions`: auditoria de conversiones entre sistemas (SPV, INVENTORY, LIVEOPS, etc.).
- `scope global/local`: `global` aplica al ecosistema completo; `local` depende del parque (`park_id`).