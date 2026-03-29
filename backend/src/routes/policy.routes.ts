import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction } from '../db/withTransaction';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { applyPointMutations, evaluatePolicies, readPolicyRules } from '../services/policyEngine';
import {
  policyEvaluateSchema,
  policyRuleActivateSchema,
  policyRuleCreateSchema,
  policyRuleIdParamsSchema,
  policyRulesQuerySchema,
  policyRuleVersionsQuerySchema,
} from '../validation/schemas';

type CreatePolicyRouterOptions = {
  pool: Pool;
};

const mapDbError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes('policy_rules') && message.includes('does not exist')) {
    return `${fallback}. Ejecuta backend/sql/20260325_policy_rules.sql`;
  }
  return message;
};

export function createPolicyRouter({ pool }: CreatePolicyRouterOptions) {
  const router = Router();

  router.get('/policy/rules/versions', requireAuth, validateQuery(policyRuleVersionsQuerySchema), async (_req: AuthenticatedRequest, res) => {
    const query = res.locals.validatedQuery as {
      domain: string;
      sourceApp?: string;
      activityType?: string;
      includeInactive?: boolean;
      limit?: number;
    };

    const limit = Math.max(1, Math.min(query.limit ?? 200, 500));

    try {
      const data = await withTransaction(pool, async (client) => {
        const result = await client.query(
          `SELECT
              rule_id,
              domain,
              source_app,
              activity_type,
              priority,
              condition_json,
              mutation_json,
              notes,
              is_active,
              valid_from,
              valid_until,
              created_at,
              updated_at,
              ROW_NUMBER() OVER (
                PARTITION BY domain, COALESCE(source_app, '*'), COALESCE(activity_type, '*')
                ORDER BY valid_from ASC, created_at ASC
              ) AS version
           FROM policy_rules
           WHERE domain = $1
             AND ($2::text IS NULL OR source_app IS NULL OR source_app = $2)
             AND ($3::text IS NULL OR activity_type IS NULL OR activity_type = $3)
             AND ($4::boolean = TRUE OR is_active = TRUE)
           ORDER BY COALESCE(source_app, '*') ASC, COALESCE(activity_type, '*') ASC, valid_from DESC
           LIMIT $5`,
          [query.domain, query.sourceApp ?? null, query.activityType ?? null, Boolean(query.includeInactive), limit]
        );

        return result.rows;
      });

      return res.json({ count: data.length, rules: data });
    } catch (error) {
      return res.status(500).json({ error: mapDbError(error, 'Error consultando versiones de policy rules') });
    }
  });

  router.get('/policy/rules', requireAuth, validateQuery(policyRulesQuerySchema), async (_req: AuthenticatedRequest, res) => {
    const query = res.locals.validatedQuery as {
      domain?: string;
      sourceApp?: string;
      activityType?: string;
      limit?: number;
    };

    if (!query.domain) {
      return res.status(400).json({ error: 'domain es requerido' });
    }

    try {
      const rules = await withTransaction(pool, (client) =>
        readPolicyRules(client, {
          domain: query.domain!,
          sourceApp: query.sourceApp,
          activityType: query.activityType,
          limit: query.limit,
        })
      );

      return res.json({ count: rules.length, rules });
    } catch (error) {
      return res.status(500).json({ error: mapDbError(error, 'Error consultando policy rules') });
    }
  });

  router.post('/policy/evaluate', requireAuth, validateBody(policyEvaluateSchema), async (_req: AuthenticatedRequest, res) => {
    const body = res.locals.validatedBody as {
      domain: string;
      sourceApp?: string;
      activityType?: string;
      basePoints?: number;
      context: Record<string, unknown>;
    };

    try {
      const evaluation = await withTransaction(pool, (client) =>
        evaluatePolicies(
          client,
          {
            domain: body.domain,
            sourceApp: body.sourceApp,
            activityType: body.activityType,
          },
          body.context ?? {}
        )
      );

      const projected = typeof body.basePoints === 'number'
        ? applyPointMutations(body.basePoints, evaluation.proposedMutations)
        : null;

      return res.json({
        evaluatedRules: evaluation.evaluatedRules,
        matchedRuleIds: evaluation.matchedRuleIds,
        proposedMutations: evaluation.proposedMutations,
        projected,
      });
    } catch (error) {
      return res.status(500).json({ error: mapDbError(error, 'Error evaluando policy engine') });
    }
  });

  router.post('/policy/rules', requireAuth, validateBody(policyRuleCreateSchema), async (_req: AuthenticatedRequest, res) => {
    const body = res.locals.validatedBody as {
      domain: string;
      sourceApp?: string;
      activityType?: string;
      priority: number;
      conditionJson: Record<string, unknown>;
      mutations: Array<Record<string, unknown>>;
      notes?: string;
      activateNow: boolean;
      deactivatePrevious: boolean;
      validFrom?: string;
      validUntil?: string;
    };

    const ruleId = randomUUID();
    const validFrom = body.validFrom ? new Date(body.validFrom) : new Date();
    const validUntil = body.validUntil ? new Date(body.validUntil) : null;

    try {
      const created = await withTransaction(pool, async (client) => {
        if (body.deactivatePrevious) {
          await client.query(
            `UPDATE policy_rules
             SET is_active = FALSE,
                 valid_until = COALESCE(valid_until, NOW()),
                 updated_at = NOW()
             WHERE domain = $1
               AND ($2::text IS NULL OR source_app = $2)
               AND ($3::text IS NULL OR activity_type = $3)
               AND is_active = TRUE`,
            [body.domain, body.sourceApp ?? null, body.activityType ?? null]
          );
        }

        await client.query(
          `INSERT INTO policy_rules (
            rule_id, domain, source_app, activity_type, priority, condition_json, mutation_json, notes, is_active, valid_from, valid_until
          ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11)`,
          [
            ruleId,
            body.domain,
            body.sourceApp ?? null,
            body.activityType ?? null,
            body.priority,
            JSON.stringify(body.conditionJson ?? {}),
            JSON.stringify(body.mutations ?? []),
            body.notes ?? null,
            body.activateNow,
            validFrom,
            validUntil,
          ]
        );

        const result = await client.query(
          `SELECT rule_id, domain, source_app, activity_type, priority, condition_json, mutation_json, notes, is_active, valid_from, valid_until, created_at
           FROM policy_rules
           WHERE rule_id = $1`,
          [ruleId]
        );

        return result.rows[0];
      });

      return res.status(201).json({ rule: created });
    } catch (error) {
      return res.status(500).json({ error: mapDbError(error, 'Error creando policy rule versionada') });
    }
  });

  router.post('/policy/rules/:ruleId/activate', requireAuth, validateParams(policyRuleIdParamsSchema), validateBody(policyRuleActivateSchema), async (_req: AuthenticatedRequest, res) => {
    const params = res.locals.validatedParams as { ruleId: string };
    const body = res.locals.validatedBody as { deactivatePrevious: boolean };

    try {
      const result = await withTransaction(pool, async (client) => {
        const lookup = await client.query(
          `SELECT rule_id, domain, source_app, activity_type
           FROM policy_rules
           WHERE rule_id = $1
           LIMIT 1`,
          [params.ruleId]
        );

        if (lookup.rowCount === 0) {
          return null;
        }

        const current = lookup.rows[0] as { domain: string; source_app: string | null; activity_type: string | null };

        if (body.deactivatePrevious) {
          await client.query(
            `UPDATE policy_rules
             SET is_active = FALSE,
                 valid_until = COALESCE(valid_until, NOW()),
                 updated_at = NOW()
             WHERE domain = $1
               AND ($2::text IS NULL OR source_app = $2)
               AND ($3::text IS NULL OR activity_type = $3)
               AND is_active = TRUE`,
            [current.domain, current.source_app, current.activity_type]
          );
        }

        await client.query(
          `UPDATE policy_rules
           SET is_active = TRUE,
               valid_until = NULL,
               updated_at = NOW()
           WHERE rule_id = $1`,
          [params.ruleId]
        );

        const refreshed = await client.query(
          `SELECT rule_id, domain, source_app, activity_type, priority, condition_json, mutation_json, notes, is_active, valid_from, valid_until, created_at
           FROM policy_rules
           WHERE rule_id = $1`,
          [params.ruleId]
        );

        return refreshed.rows[0] ?? null;
      });

      if (!result) {
        return res.status(404).json({ error: 'ruleId no encontrado' });
      }

      return res.json({ rule: result });
    } catch (error) {
      return res.status(500).json({ error: mapDbError(error, 'Error activando policy rule') });
    }
  });

  return router;
}