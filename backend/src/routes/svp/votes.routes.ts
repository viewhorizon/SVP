import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import { withTransaction } from '../../db/withTransaction';
import { appendLedgerEntry, getBalance } from '../../db/pointsRepository';
import { requireAuth, type AuthenticatedRequest } from '../../middleware/requireAuth';
import { votesRateLimit } from '../../middleware/votesRateLimit';
import { validateBody, validateQuery } from '../../middleware/validate';
import { votesCountQuerySchema, votesCreateSchema } from '../../validation/schemas';
import {
  buildVotesCountCacheKey,
  buildVotesLimitsCacheKey,
  getCached,
  invalidateVotesCacheForUser,
  setCached,
} from '../../services/votesCache';

type CreateVotesRouterOptions = {
  pool: Pool;
};

const readIdempotencyKey = (headers: { [key: string]: unknown }) => {
  const raw = headers['idempotency-key'] ?? headers['x-idempotency-key'];
  const value = String(raw ?? '').trim();
  return value.length > 0 ? value : null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toDatabaseUuid = (value: string, namespace: string) => {
  if (uuidPattern.test(value)) return value.toLowerCase();
  const hex = createHash('sha256').update(`${namespace}:${value}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export function createVotesRouter({ pool }: CreateVotesRouterOptions) {
  const router = Router();

  router.post('/votes', requireAuth, votesRateLimit, validateBody(votesCreateSchema), async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    if (!uuidPattern.test(userId)) {
      return res.status(422).json({ error: 'El usuario autenticado debe resolverse a un UUID para la base de puntos.' });
    }

    const body = res.locals.validatedBody as {
      activityId: string;
      activityScope?: 'local' | 'global';
      requestId?: string;
      eventId?: string;
      metadata?: Record<string, unknown>;
    };
    const activityId = body.activityId;
    const activityScope = body.activityScope ?? 'local';
    const requestId = toDatabaseUuid(body.requestId ?? readIdempotencyKey(req.headers) ?? randomUUID(), `vote-request:${userId}`);
    const eventId = toDatabaseUuid(body.eventId ?? randomUUID(), 'vote-event');
    const metadata = body.metadata ?? {};

    try {
      const payload = await withTransaction(pool, async (client) => {
        const idempotentCheck = await client.query(
          `SELECT ledger_id, balance_after
           FROM points_ledger
           WHERE user_id = $1
             AND request_id = $2
             AND operation_type = 'POINTS_GRANTED'
           LIMIT 1`,
          [userId, requestId]
        );

        if (idempotentCheck.rowCount) {
          const balance = await getBalance(client, userId);
          return {
            idempotent: true,
            message: 'Voto ya procesado previamente',
            pointsGranted: 0,
            balance,
          };
        }

        const limitResult = await client.query(
          `SELECT max_value
           FROM point_limits
           WHERE limit_type = 'VOTES_PER_DAY'
             AND is_active = TRUE
             AND valid_from <= NOW()
             AND (valid_until IS NULL OR valid_until > NOW())
             AND (scope = 'GLOBAL' OR (scope = 'USER' AND user_id = $1))
           ORDER BY scope = 'USER' DESC, valid_from DESC
           LIMIT 1`,
          [userId]
        );

        const dailyLimit = Number(limitResult.rows[0]?.max_value ?? 5);

        const usedVotesResult = await client.query(
          `SELECT COUNT(*)::int AS used
           FROM votes
           WHERE user_id = $1
             AND created_at >= date_trunc('day', NOW())
             AND created_at < date_trunc('day', NOW()) + INTERVAL '1 day'`,
          [userId]
        );

        const usedVotes = Number(usedVotesResult.rows[0]?.used ?? 0);
        if (usedVotes >= dailyLimit) {
          return {
            blocked: true,
            reason: 'Límite diario de votos alcanzado',
            limits: {
              dailyLimit,
              usedVotes,
              remainingVotes: 0,
            },
          };
        }

        const ruleResult = await client.query(
          `SELECT formula, max_points_per_vote
           FROM point_rules
           WHERE activity_scope = $1
             AND is_active = TRUE
             AND valid_from <= NOW()
             AND (valid_until IS NULL OR valid_until > NOW())
           ORDER BY version DESC
           LIMIT 1`,
          [activityScope]
        );

        const formula = ruleResult.rows[0]?.formula ?? {
          base_per_vote: 1,
          activity_multiplier: 1,
          max_bonus_multiplier: 1,
        };

        const basePerVote = Number(formula.base_per_vote ?? 1);
        const activityMultiplier = Number(formula.activity_multiplier ?? 1);
        const maxPerVote = Number(ruleResult.rows[0]?.max_points_per_vote ?? 100);
        const pointsGranted = Math.min(Math.floor(basePerVote * activityMultiplier), maxPerVote);

        await client.query(
          `INSERT INTO votes (vote_id, user_id, activity_id, request_id, event_id, points_generated, activity_scope, metadata, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
          [randomUUID(), userId, activityId, requestId, eventId, pointsGranted, activityScope, JSON.stringify(metadata)]
        );

        await appendLedgerEntry(client, {
          userId,
          requestId,
          operationType: 'POINTS_GRANTED',
          direction: 'CREDIT',
          amount: pointsGranted,
          activityId,
          metadata: {
            domain_event: 'VOTE_CAST',
            points_event: 'POINTS_GRANTED',
            activityScope,
            ...metadata,
          },
        });

        const activityResult = await client.query(
          `UPDATE spv_activities
           SET votes_count = votes_count + 1, updated_at = NOW()
           WHERE id = $1
           RETURNING name, linked_task_id`,
          [activityId]
        );
        let impact: {
          taskId: string;
          taskTitle: string;
          taskProgress: number;
          taskStatus: string;
          strategicId: string | null;
          strategicTitle: string | null;
          strategicProgress: number | null;
        } | null = null;

        if (activityResult.rows.length > 0) {
          const activity = activityResult.rows[0];
          const legacyUserResult = await client.query(
            'SELECT id FROM spv_users WHERE id = $1',
            [userId]
          );

          if (legacyUserResult.rowCount) {
            await client.query(
              'INSERT INTO spv_history (user_id, description, type, amount, status, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
              [
                userId,
                `Voto en ${activity.name}`,
                'vote',
                pointsGranted,
                'success',
                JSON.stringify({
                  operationId: requestId,
                  externalDomain: metadata.externalDomain ?? null,
                  externalReference: metadata.externalReference ?? null,
                  valueUnit: 'SVP_POINTS',
                }),
              ]
            );
          }

          const linkedTaskId = activity.linked_task_id as string | null;
          if (linkedTaskId) {
            const taskResult = await client.query(
              `UPDATE spv_tasks
               SET progress = LEAST(progress + 10, 100),
                   status = CASE
                     WHEN LEAST(progress + 10, 100) >= 100 THEN 'done'
                     WHEN progress = 0 THEN 'in-progress'
                     ELSE status
                   END,
                   updated_at = NOW()
               WHERE id = $1
               RETURNING id, title, progress, status, strategic_item_id`,
              [linkedTaskId]
            );

            if (taskResult.rows.length > 0) {
              const task = taskResult.rows[0];
              let strategicProgress: number | null = null;
              let strategicTitle: string | null = null;

              if (task.strategic_item_id) {
                const strategicResult = await client.query(
                  `UPDATE spv_strategic_items s
                   SET progress = sub.avg_progress, updated_at = NOW()
                   FROM (
                     SELECT strategic_item_id, COALESCE(AVG(progress), 0)::int AS avg_progress
                     FROM spv_tasks WHERE strategic_item_id = $1 GROUP BY strategic_item_id
                   ) sub
                   WHERE s.id = sub.strategic_item_id
                   RETURNING s.title, s.progress`,
                  [task.strategic_item_id]
                );
                if (strategicResult.rows.length > 0) {
                  strategicProgress = strategicResult.rows[0].progress;
                  strategicTitle = strategicResult.rows[0].title;
                }
              }

              impact = {
                taskId: task.id,
                taskTitle: task.title,
                taskProgress: task.progress,
                taskStatus: task.status,
                strategicId: task.strategic_item_id,
                strategicTitle,
                strategicProgress,
              };
            }
          }
        }

        const balance = await getBalance(client, userId);

        return {
          idempotent: false,
          pointsGranted,
          balance,
          impact,
          limits: {
            dailyLimit,
            usedVotes: usedVotes + 1,
            remainingVotes: Math.max(dailyLimit - (usedVotes + 1), 0),
          },
          events: [
            { event_id: eventId, type: 'VOTE_CAST' },
            { request_id: requestId, type: 'POINTS_GRANTED' },
          ],
        };
      });

      if ('blocked' in payload && payload.blocked) {
        return res.status(429).json({ error: payload.reason, limits: payload.limits });
      }

      if (!payload.idempotent) {
        invalidateVotesCacheForUser(userId);
      }

      return res.status(payload.idempotent ? 200 : 201).json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno al votar';
      return res.status(500).json({ error: message });
    }
  });

  router.get('/votes/count', requireAuth, validateQuery(votesCountQuerySchema), async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const query = res.locals.validatedQuery as { activityId?: string };
    const activityId = query.activityId ? String(query.activityId) : null;
    const cacheKey = buildVotesCountCacheKey(userId, activityId);

    const cached = getCached<{ userId: string; activityId: string | null; votesToday: number }>(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM votes
         WHERE user_id = $1
           AND ($2::uuid IS NULL OR activity_id = $2)
           AND created_at >= date_trunc('day', NOW())
           AND created_at < date_trunc('day', NOW()) + INTERVAL '1 day'`,
        [userId, activityId]
      );

      const payload = {
        userId,
        activityId,
        votesToday: Number(result.rows[0]?.total ?? 0),
      };

      setCached(cacheKey, payload);
      return res.json({ ...payload, cached: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error consultando votos';
      return res.status(500).json({ error: message });
    }
  });

  router.get('/votes/limits', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const cacheKey = buildVotesLimitsCacheKey(userId);

    const cached = getCached<{ userId: string; dailyLimit: number; usedVotes: number; remainingVotes: number }>(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    try {
      const [limitResult, usedVotesResult] = await Promise.all([
        pool.query(
          `SELECT max_value
           FROM point_limits
           WHERE limit_type = 'VOTES_PER_DAY'
             AND is_active = TRUE
             AND valid_from <= NOW()
             AND (valid_until IS NULL OR valid_until > NOW())
             AND (scope = 'GLOBAL' OR (scope = 'USER' AND user_id = $1))
           ORDER BY scope = 'USER' DESC, valid_from DESC
           LIMIT 1`,
          [userId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS used
           FROM votes
           WHERE user_id = $1
             AND created_at >= date_trunc('day', NOW())
             AND created_at < date_trunc('day', NOW()) + INTERVAL '1 day'`,
          [userId]
        ),
      ]);

      const dailyLimit = Number(limitResult.rows[0]?.max_value ?? 5);
      const usedVotes = Number(usedVotesResult.rows[0]?.used ?? 0);

      const payload = {
        userId,
        dailyLimit,
        usedVotes,
        remainingVotes: Math.max(dailyLimit - usedVotes, 0),
      };

      setCached(cacheKey, payload);
      return res.json({ ...payload, cached: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error consultando límites';
      return res.status(500).json({ error: message });
    }
  });

  return router;
}
