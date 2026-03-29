import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { appendLedgerEntry, getBalance } from '../db/pointsRepository';
import { withTransaction } from '../db/withTransaction';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { validateBody, validateQuery } from '../middleware/validate';
import { enqueueOutboxEvent } from '../services/outboxService';
import { applyPointMutations, evaluatePolicies } from '../services/policyEngine';
import { getSecret } from '../services/secrets';
import {
  externalEventIngestSchema,
  externalEventValidateSchema,
  identityLinkSchema,
  identityResolveQuerySchema,
} from '../validation/schemas';

type CreateEventsRouterOptions = {
  pool: Pool;
};

type ExternalEventPayload = {
  eventId: string;
  sourceApp: string;
  sourceEnv?: string;
  svpUserId?: string;
  externalUserId?: string;
  activityType: string;
  activityId: string;
  score?: number;
  activityHours?: number;
  totalVotes?: number;
  localVotes?: number;
  globalVotes?: number;
  unit: string;
  requestId?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

const buildSourceEventKey = (sourceApp: string, eventId: string) => `${sourceApp}:${eventId}`;

const sharedSecretIsValid = (received: string) => {
  const expected = normalizeText(getSecret('WEBHOOK_SHARED_SECRET'));
  if (!expected) return true;
  return received === expected;
};

const stableUuidFromSeed = (seed: string) => {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

async function resolveSvpUserId(client: PoolClient, payload: ExternalEventPayload) {
  if (payload.svpUserId) return payload.svpUserId;
  if (!payload.externalUserId) return null;

  const linked = await client.query<{ svp_user_id: string }>(
    `SELECT svp_user_id
     FROM identity_links
     WHERE source_app = $1 AND external_user_id = $2
     LIMIT 1`,
    [payload.sourceApp, payload.externalUserId]
  );

  return linked.rows[0]?.svp_user_id ?? null;
}

async function resolveSourceRate(
  client: PoolClient,
  sourceApp: string,
  sourceUnit: string
): Promise<{ multiplier: number; bonus: number; rounding: 'floor' | 'round' | 'ceil'; rateId: string | null }> {
  const result = await client.query<{
    rate_id: string;
    multiplier: string;
    bonus: string;
    rounding: 'floor' | 'round' | 'ceil';
  }>(
    `SELECT rate_id, multiplier, bonus, rounding
     FROM source_app_rates
     WHERE source_app = $1
       AND source_unit = $2
       AND is_active = TRUE
       AND valid_from <= NOW()
       AND (valid_until IS NULL OR valid_until > NOW())
     ORDER BY valid_from DESC
     LIMIT 1`,
    [sourceApp, sourceUnit]
  );

  if (!result.rowCount) {
    return { multiplier: 1, bonus: 0, rounding: 'floor', rateId: null };
  }

  const row = result.rows[0];
  return {
    multiplier: Number(row.multiplier ?? 1),
    bonus: Number(row.bonus ?? 0),
    rounding: row.rounding ?? 'floor',
    rateId: row.rate_id ?? null,
  };
}

function normalizeDbError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes('outbox_events') && message.includes('does not exist')) {
    return `${fallback}. Ejecuta backend/sql/20260323_outbox_dispatcher.sql`;
  }
  if (message.includes('relation') && message.includes('does not exist')) {
    return `${fallback}. Ejecuta backend/sql/20260321_identity_and_ingest.sql`;
  }
  return message;
}

function resolveBaseValue(payload: ExternalEventPayload) {
  if (typeof payload.score === 'number') {
    return {
      baseValue: payload.score,
      formula: 'achievement_score',
      votesTotal: null as number | null,
    };
  }

  const votesTotal =
    typeof payload.totalVotes === 'number' ? payload.totalVotes : (payload.localVotes ?? 0) + (payload.globalVotes ?? 0);
  const baseValue = (payload.activityHours ?? 0) * votesTotal;

  return {
    baseValue,
    formula: 'hours_x_votes',
    votesTotal,
  };
}

function computeAppliedPoints(baseValue: number, multiplier: number, bonus: number, rounding: 'floor' | 'round' | 'ceil') {
  const raw = baseValue * multiplier + bonus;
  const rounded =
    rounding === 'ceil' ? Math.ceil(raw) : rounding === 'round' ? Math.round(raw) : Math.floor(raw);
  const points = Math.max(1, rounded);
  return {
    raw,
    points,
  };
}

export function createEventsRouter({ pool }: CreateEventsRouterOptions) {
  const router = Router();

  router.post('/identity/link', requireAuth, validateBody(identityLinkSchema), async (req: AuthenticatedRequest, res) => {
    const body = res.locals.validatedBody as {
      sourceApp: string;
      externalUserId: string;
      svpUserId?: string;
      metadata?: Record<string, unknown>;
    };
    const svpUserId = body.svpUserId ?? req.user!.uid;

    if (svpUserId !== req.user!.uid) {
      return res.status(403).json({ error: 'No puedes vincular una identidad de otro usuario' });
    }

    try {
      const linked = await withTransaction(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO identity_links (source_app, external_user_id, svp_user_id, metadata, last_linked_at)
           VALUES ($1,$2,$3,$4,NOW())
           ON CONFLICT (source_app, external_user_id)
           DO UPDATE SET
             svp_user_id = EXCLUDED.svp_user_id,
             metadata = identity_links.metadata || EXCLUDED.metadata,
             last_linked_at = NOW(),
             updated_at = NOW()
           RETURNING link_id, source_app, external_user_id, svp_user_id, metadata, last_linked_at, updated_at`,
          [body.sourceApp, body.externalUserId, svpUserId, JSON.stringify(body.metadata ?? {})]
        );

        return result.rows[0];
      });

      return res.status(201).json({
        linkId: linked.link_id,
        sourceApp: linked.source_app,
        externalUserId: linked.external_user_id,
        svpUserId: linked.svp_user_id,
        metadata: linked.metadata ?? {},
        lastLinkedAt: linked.last_linked_at,
        updatedAt: linked.updated_at,
      });
    } catch (error) {
      const message = normalizeDbError(error, 'Error vinculando identidad');
      return res.status(500).json({ error: message });
    }
  });

  router.get('/identity/link', requireAuth, validateQuery(identityResolveQuerySchema), async (_req: AuthenticatedRequest, res) => {
    const query = res.locals.validatedQuery as { sourceApp: string; externalUserId: string };

    try {
      const row = await withTransaction(pool, async (client) => {
        const result = await client.query(
          `SELECT link_id, source_app, external_user_id, svp_user_id, metadata, last_linked_at, updated_at
           FROM identity_links
           WHERE source_app = $1 AND external_user_id = $2
           LIMIT 1`,
          [query.sourceApp, query.externalUserId]
        );
        return result.rows[0] ?? null;
      });

      if (!row) {
        return res.status(404).json({ error: 'Identidad externa no vinculada' });
      }

      return res.json({
        linkId: row.link_id,
        sourceApp: row.source_app,
        externalUserId: row.external_user_id,
        svpUserId: row.svp_user_id,
        metadata: row.metadata ?? {},
        lastLinkedAt: row.last_linked_at,
        updatedAt: row.updated_at,
      });
    } catch (error) {
      const message = normalizeDbError(error, 'Error consultando identidad vinculada');
      return res.status(500).json({ error: message });
    }
  });

  router.post('/events/validate', validateBody(externalEventValidateSchema), async (req, res) => {
    const providedSecret = normalizeText(req.header('x-webhook-secret'));
    if (!sharedSecretIsValid(providedSecret)) {
      return res.status(401).json({ error: 'Webhook secret invalido' });
    }

    const payload = res.locals.validatedBody as ExternalEventPayload;

    try {
      const preview = await withTransaction(pool, async (client) => {
        const svpUserId = await resolveSvpUserId(client, payload);
        const rate = await resolveSourceRate(client, payload.sourceApp, payload.unit);
        const base = resolveBaseValue(payload);
        const projection = computeAppliedPoints(base.baseValue, rate.multiplier, rate.bonus, rate.rounding);
        const policyEvaluation = await evaluatePolicies(
          client,
          {
            domain: 'external_activity_points',
            sourceApp: payload.sourceApp,
            activityType: payload.activityType,
            limit: 100,
          },
          {
            sourceApp: payload.sourceApp,
            activityType: payload.activityType,
            sourceEnv: payload.sourceEnv ?? 'prod',
            activityHours: payload.activityHours ?? null,
            totalVotes: base.votesTotal,
            localVotes: payload.localVotes ?? null,
            globalVotes: payload.globalVotes ?? null,
            baseValue: base.baseValue,
            unit: payload.unit,
            score: payload.score ?? null,
            metadata: payload.metadata ?? {},
          }
        );
        const projectedWithPolicy = applyPointMutations(projection.points, policyEvaluation.proposedMutations);
        return {
          svpUserId,
          rate,
          base,
          projection,
          policyEvaluation,
          projectedWithPolicy,
        };
      });

      return res.json({
        valid: true,
        resolvableUser: Boolean(preview.svpUserId),
        svpUserId: preview.svpUserId,
        sourceRate: preview.rate,
        projectionBase: {
          formula: preview.base.formula,
          baseValue: preview.base.baseValue,
          votesTotal: preview.base.votesTotal,
        },
        projectedPoints: preview.projectedWithPolicy.points,
        policy: {
          evaluatedRules: preview.policyEvaluation.evaluatedRules,
          matchedRuleIds: preview.policyEvaluation.matchedRuleIds,
          proposedMutations: preview.policyEvaluation.proposedMutations,
          applied: preview.projectedWithPolicy.policy,
        },
      });
    } catch (error) {
      const message = normalizeDbError(error, 'Error validando evento externo');
      return res.status(500).json({ error: message });
    }
  });

  router.post('/events/results', validateBody(externalEventIngestSchema), async (req, res) => {
    const providedSecret = normalizeText(req.header('x-webhook-secret'));
    if (!sharedSecretIsValid(providedSecret)) {
      return res.status(401).json({ error: 'Webhook secret invalido' });
    }

    const payload = res.locals.validatedBody as ExternalEventPayload;

    try {
      const result = await withTransaction(pool, async (client) => {
        const svpUserId = await resolveSvpUserId(client, payload);
        if (!svpUserId) {
          throw new Error('No se pudo resolver svpUserId para este evento');
        }

        const sourceUnit = payload.unit.toLowerCase();
        const base = resolveBaseValue(payload);
        const rate = await resolveSourceRate(client, payload.sourceApp, sourceUnit);
        const pointsProjection = computeAppliedPoints(base.baseValue, rate.multiplier, rate.bonus, rate.rounding);
        const policyEvaluation = await evaluatePolicies(
          client,
          {
            domain: 'external_activity_points',
            sourceApp: payload.sourceApp,
            activityType: payload.activityType,
            limit: 100,
          },
          {
            sourceApp: payload.sourceApp,
            activityType: payload.activityType,
            sourceEnv: payload.sourceEnv ?? 'prod',
            activityHours: payload.activityHours ?? null,
            totalVotes: base.votesTotal,
            localVotes: payload.localVotes ?? null,
            globalVotes: payload.globalVotes ?? null,
            baseValue: base.baseValue,
            unit: sourceUnit,
            score: payload.score ?? null,
            metadata: payload.metadata ?? {},
          }
        );
        const pointsWithPolicy = applyPointMutations(pointsProjection.points, policyEvaluation.proposedMutations);
        const sourceEventKey = buildSourceEventKey(payload.sourceApp, payload.eventId);
        const requestId = payload.requestId ?? stableUuidFromSeed(`${sourceEventKey}:request`);
        const eventLedgerId = stableUuidFromSeed(`${sourceEventKey}:ledger`);
        const occurredAt = payload.occurredAt ? new Date(payload.occurredAt).toISOString() : new Date().toISOString();

        const ingestion = await client.query(
          `INSERT INTO external_activity_events (
             event_id,
             source_app,
             source_env,
             external_user_id,
             svp_user_id,
             activity_type,
             activity_id,
             score,
             unit,
             points_applied,
             request_id,
             status,
             occurred_at,
             metadata
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (event_id) DO NOTHING
           RETURNING event_id`,
          [
            sourceEventKey,
            payload.sourceApp,
            payload.sourceEnv ?? 'prod',
            payload.externalUserId ?? null,
            svpUserId,
            payload.activityType,
            payload.activityId,
             base.baseValue,
            sourceUnit,
             pointsWithPolicy.points,
            requestId,
            'processed',
            occurredAt,
            JSON.stringify(payload.metadata ?? {}),
          ]
        );

        if (!ingestion.rowCount) {
          const existing = await client.query<{ svp_user_id: string; points_applied: string; request_id: string }>(
            `SELECT svp_user_id, points_applied, request_id
             FROM external_activity_events
             WHERE event_id = $1
             LIMIT 1`,
            [sourceEventKey]
          );

          const balance = await getBalance(client, existing.rows[0]?.svp_user_id ?? svpUserId);
          return {
            eventId: payload.eventId,
            requestId: existing.rows[0]?.request_id ?? requestId,
            idempotent: true,
            svpUserId,
            pointsApplied: Number(existing.rows[0]?.points_applied ?? pointsWithPolicy.points),
            balance,
            sourceRate: rate,
            policy: {
              evaluatedRules: policyEvaluation.evaluatedRules,
              matchedRuleIds: policyEvaluation.matchedRuleIds,
              proposedMutations: policyEvaluation.proposedMutations,
              applied: pointsWithPolicy.policy,
            },
          };
        }

        const ledgerEntry = await appendLedgerEntry(client, {
          userId: svpUserId,
          requestId,
          eventId: eventLedgerId,
          operationType: 'POINTS_GRANTED',
          direction: 'CREDIT',
          amount: pointsWithPolicy.points,
          activityId: randomUUID(),
          metadata: {
            domain_event: 'EXTERNAL_ACTIVITY_RESULT',
            source_app: payload.sourceApp,
            source_env: payload.sourceEnv ?? 'prod',
            source_unit: sourceUnit,
            scoring: {
              formula: base.formula,
              base_value: base.baseValue,
              activity_hours: payload.activityHours ?? null,
              votes_total: base.votesTotal,
              votes_local: payload.localVotes ?? null,
              votes_global: payload.globalVotes ?? null,
              score_signal: payload.score ?? null,
            },
            conversion: {
              multiplier: rate.multiplier,
              bonus: rate.bonus,
              rounding: rate.rounding,
              rate_id: rate.rateId,
              points_raw: pointsProjection.raw,
            },
            policy: {
              evaluated_rules: policyEvaluation.evaluatedRules,
              matched_rule_ids: policyEvaluation.matchedRuleIds,
              proposed_mutations: policyEvaluation.proposedMutations,
              applied: pointsWithPolicy.policy,
            },
            external: {
              source_event_key: sourceEventKey,
              event_id: payload.eventId,
              external_user_id: payload.externalUserId ?? null,
              activity_type: payload.activityType,
              activity_id: payload.activityId,
            },
            occurred_at: occurredAt,
            ...(payload.metadata ?? {}),
          },
        });

        const transactionId = randomUUID();
        if (!ledgerEntry.idempotent) {
          await client.query(
            `INSERT INTO cross_system_transactions (
               transaction_id,
               user_id,
               transaction_type,
               origin_system,
               target_system,
               park_id,
               amount_in,
               amount_out,
               unit_in,
               unit_out,
               rate_id,
               status,
               saga_step,
               completed_at,
               metadata
             ) VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9,$10,$11,$12,NOW(),$13::jsonb)`,
            [
              transactionId,
              svpUserId,
              'EXTERNAL_ACTIVITY_RESULT',
              payload.sourceApp,
              'SVP',
               base.baseValue,
                pointsWithPolicy.points,
              sourceUnit,
              'SVP_POINTS',
              rate.rateId,
              'COMPLETED',
              'SPV_CREDIT_COMPLETED',
              JSON.stringify({
                sourceEventKey,
                eventId: payload.eventId,
                activityType: payload.activityType,
                activityId: payload.activityId,
              }),
            ]
          );

          await enqueueOutboxEvent(client, {
            eventId: payload.eventId,
            sourceApp: payload.sourceApp,
            eventType: 'external.activity.result.processed',
            idempotencyKey: `${payload.sourceApp}:${payload.eventId}:processed`,
            payload: {
              eventId: payload.eventId,
              sourceApp: payload.sourceApp,
              svpUserId,
                pointsApplied: pointsWithPolicy.points,
              projectionBase: {
                formula: base.formula,
                baseValue: base.baseValue,
                votesTotal: base.votesTotal,
              },
              occurredAt,
            },
          });
        }

        const balance = await getBalance(client, svpUserId);
        return {
          eventId: payload.eventId,
          requestId,
          idempotent: ledgerEntry.idempotent,
          svpUserId,
          pointsApplied: pointsWithPolicy.points,
          projectionBase: {
            formula: base.formula,
            baseValue: base.baseValue,
            votesTotal: base.votesTotal,
          },
          unit: sourceUnit,
          sourceRate: rate,
          policy: {
            evaluatedRules: policyEvaluation.evaluatedRules,
            matchedRuleIds: policyEvaluation.matchedRuleIds,
            proposedMutations: policyEvaluation.proposedMutations,
            applied: pointsWithPolicy.policy,
          },
          balance,
        };
      });

      return res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      const message = normalizeDbError(error, 'Error procesando evento externo');
      if (message.includes('No se pudo resolver svpUserId')) {
        return res.status(404).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  return router;
}