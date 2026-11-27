# Contrato API TierList -> SVP

Contrato de transición para integrar plataformas externas (TierList u otras) con SVP sin acceso directo a la base de datos.

## Estado y prioridad

El contrato objetivo es `../docs/SVP_Integration_Guide_v1_EN.md`; el usuario confirmó el 2026-11-27 que sus endpoints y contratos son la especificación a implementar. Este archivo describe rutas/comportamiento actualmente presentes en el backend y no debe sustituirse por el contrato v1. Su fórmula y rutas son diferencias de implementación pendientes, no una alternativa aprobada al objetivo.

## Principios

- La app externa envia eventos a SVP API.
- SVP valida, calcula puntos y persiste en su DB.
- Fórmula que ejecuta hoy este flujo de eventos (no la fórmula objetivo v1): `puntosBase = activityHours * votosTotales`; las tarifas de origen y `policy_rules` pueden cambiar el crédito final. `unit` identifica la unidad de entrada; el saldo acreditado queda en puntos SVP.
- Fórmula objetivo confirmada por el usuario: `((global_votes + local_votes) / worldwide_similar_activities_count) * registered_user_activity_hours + svp_voting_bonus`. Ejemplo: `((1200 + 1200) / 150) * 3 = 48` puntos antes del bono. La implementación está pendiente; las definiciones abiertas están en el checklist del guide v1.
- `score` es opcional en el flujo de eventos existente y representa una señal de logro (achievement); no sustituye la fórmula principal objetivo v1.
- Todas las operaciones de mutacion deben usar idempotencia estricta por `sourceApp + eventId` (y opcionalmente `Idempotency-Key` para retries de cliente).
- La inmutabilidad recomendada aplica al ledger: movimientos confirmados no se editan ni borran; los errores se corrigen con asientos compensatorios y referencia al movimiento original. Los datos operativos mutables deben mantener auditoría de cambios.
- La ruta de vinculación de identidad actualmente actualiza `svpUserId` para el mismo par `sourceApp + externalUserId` mediante upsert. Si una identidad no debe reasignarse silenciosamente, este cambio necesita historial/versionado y auditoría explícita.

## Estado de seguridad verificado

- `POST /api/events/validate` y `POST /api/events/results` comprueban `x-webhook-secret` solo si `WEBHOOK_SHARED_SECRET` está configurado. Si falta el secreto, la comprobación actual permite continuar sin él.
- Estas dos rutas no verifican actualmente `Authorization: Bearer`, `x-webhook-timestamp` ni `x-webhook-signature`. El modo HMAC implementado para `POST /api/webhooks/points/credit` no protege automáticamente los endpoints de eventos.
- Por tanto, no presentar HMAC ni Bearer como protección efectiva de estos endpoints hasta implementarlos y probarlos. Antes de exponerlos en producción, exigir autenticación o firma y rechazar la petición si no hay secreto configurado.

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
