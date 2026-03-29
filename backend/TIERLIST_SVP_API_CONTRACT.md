# Contrato API TierList -> SVP

Contrato operativo para integrar plataformas externas (TierList u otras) con SVP sin acceso directo a la base de datos.

## Principios

- La app externa envia eventos a SVP API.
- SVP valida, calcula puntos y persiste en su DB.
- Formula principal SVP: `puntosBase = activityHours * votosTotales`.
- `score` es opcional y representa una senal de logro (achievement), no la formula principal por defecto.
- Todas las operaciones de mutacion deben usar idempotencia estricta por `sourceApp + eventId` (y opcionalmente `Idempotency-Key` para retries de cliente).

## Endpoints

1. `POST /api/identity/link`
- Vincula `sourceApp + externalUserId` con `svpUserId`.

2. `GET /api/identity/link?sourceApp=...&externalUserId=...`
- Resuelve el usuario SVP vinculado.

3. `POST /api/events/validate`
- Valida payload sin mutar estado.
- Devuelve proyeccion de puntos.

4. `POST /api/events/results`
- Ingesta real del resultado.
- Acredita puntos en SVP y registra auditoria.
- Tambien disponible como `POST /api/v1/events/results`.

5. `POST /api/achievements`
- Crea un logro votable asociado a `activityId`.

6. `POST /api/achievements/:achievementId/vote`
- Registra voto `up/down` sobre el logro (1 voto por usuario, actualizable).

7. `POST /api/achievements/:achievementId/close`
- Cierra la votacion del logro (`approved`, `rejected`, `archived`).

## Request estandar (`/api/events/results`)

```json
{
  "eventId": "tierlist-2026-03-09-best-news-001",
  "sourceApp": "tierlist-global",
  "sourceEnv": "prod",
  "externalUserId": "usr_abc_445",
  "activityType": "vote_result",
  "activityId": "best_news_week_10",
  "activityHours": 3,
  "localVotes": 1200,
  "globalVotes": 1200,
  "unit": "liveops_points",
  "requestId": "1d7b3f63-d152-4b38-a529-f2d8cc57de51",
  "metadata": {
    "rank": 1,
    "topic": "mejor noticia de la semana"
  }
}
```

## Variante por logro (`score`)

```json
{
  "eventId": "tierlist-achievement-001",
  "sourceApp": "tierlist-global",
  "activityType": "achievement_score",
  "activityId": "debate-final-week-10",
  "score": 125,
  "unit": "achievement_score"
}
```

## Headers recomendados

- `Authorization: Bearer <token>` cuando aplique.
- `Idempotency-Key: <uuid>` para reintentos seguros.
- `x-webhook-secret: <secret>` en modo basico.
- `x-webhook-timestamp` + `x-webhook-signature` en modo HMAC.

## Respuestas clave

- `201`: evento procesado y puntos aplicados.
- `200`: replay idempotente (sin duplicar puntos).
- `400`: payload invalido.
- `401`: autenticacion/firma invalida.
- `404`: identidad no resolvible en SVP.
- `409`: conflicto (ejemplo: replay bloqueado).

## Recomendacion de mapeo de identidad

- No exigir el mismo UUID interno en todas las plataformas.
- Usar identidad federada con `sourceApp + externalUserId`.
- Mantener `svpUserId` interno como fuente de verdad para wallet y ledger.