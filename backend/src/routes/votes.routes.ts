import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import { withTransaction } from '../db/withTransaction';
import { appendLedgerEntry, getBalance } from '../db/pointsRepository';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';

type CreateVotesRouterOptions = {
  pool: Pool;
};

export function createVotesRouter({ pool }: CreateVotesRouterOptions) {
  const router = Router();

  router.post('/votes', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const activityId = String(req.body?.activityId ?? '').trim();
    const activityScope = String(req.body?.activityScope ?? 'local').trim();
    const requestId = String(req.body?.requestId ?? randomUUID());
    const eventId = String(req.body?.eventId ?? randomUUID());
    const metadata = req.body?.metadata ?? {};

    if (!activityId) {
      return res.status(400).json({ error: 'activityId es requerido' });
    }

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
          `INSERT INTO votes (vote_id, user_id, activity_id, request_id, event_id, points_generated, metadata, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
          [randomUUID(), userId, activityId, requestId, eventId, pointsGranted, JSON.stringify(metadata)]
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

        const balance = await getBalance(client, userId);

        return {
          idempotent: false,
          pointsGranted,
          balance,
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

      return res.status(201).json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno al votar';
      return res.status(500).json({ error: message });
    }
  });

  router.get('/votes/count', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const activityId = req.query.activityId ? String(req.query.activityId) : null;

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

      return res.json({
        userId,
        activityId,
        votesToday: Number(result.rows[0]?.total ?? 0),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error consultando votos';
      return res.status(500).json({ error: message });
    }
  });

  router.get('/votes/limits', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;

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

      return res.json({
        userId,
        dailyLimit,
        usedVotes,
        remainingVotes: Math.max(dailyLimit - usedVotes, 0),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error consultando límites';
      return res.status(500).json({ error: message });
    }
  });

  return router;
}
