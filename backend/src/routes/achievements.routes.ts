import { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { withTransaction } from '../db/withTransaction';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import {
  achievementCloseSchema,
  achievementCreateSchema,
  achievementIdParamsSchema,
  achievementListQuerySchema,
  achievementVoteSchema,
} from '../validation/schemas';

type CreateAchievementsRouterOptions = {
  pool: Pool;
};

const mapDbError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes('relation') && message.includes('does not exist')) {
    return `${fallback}. Ejecuta backend/sql/20260322_achievements_voting.sql`;
  }
  return message;
};

export function createAchievementsRouter({ pool }: CreateAchievementsRouterOptions) {
  const router = Router();

  router.get('/achievements', requireAuth, validateQuery(achievementListQuerySchema), async (_req: AuthenticatedRequest, res) => {
    const query = res.locals.validatedQuery as {
      activityId?: string;
      status?: 'draft' | 'voting' | 'approved' | 'rejected' | 'archived';
      limit?: number;
    };

    try {
      const items = await withTransaction(pool, async (client) => {
        const result = await client.query(
          `SELECT
             a.achievement_id,
             a.activity_id,
             a.title,
             a.description,
             a.reward_type,
             a.reward_points,
             a.reward_item_id,
             a.status,
             a.created_by,
             a.closed_by,
             a.closed_at,
             a.metadata,
             a.created_at,
             a.updated_at,
             COALESCE(SUM(CASE WHEN v.vote_value = 'up' THEN 1 ELSE 0 END), 0) AS votes_up,
             COALESCE(SUM(CASE WHEN v.vote_value = 'down' THEN 1 ELSE 0 END), 0) AS votes_down
           FROM achievement_definitions a
           LEFT JOIN achievement_votes v ON v.achievement_id = a.achievement_id
           WHERE ($1::text IS NULL OR a.activity_id = $1)
             AND ($2::text IS NULL OR a.status = $2)
           GROUP BY a.achievement_id
           ORDER BY a.created_at DESC
           LIMIT $3`,
          [query.activityId ?? null, query.status ?? null, query.limit ?? 50]
        );

        return result.rows.map((row) => ({
          achievementId: row.achievement_id,
          activityId: row.activity_id,
          title: row.title,
          description: row.description,
          rewardType: row.reward_type,
          rewardPoints: Number(row.reward_points ?? 0),
          rewardItemId: row.reward_item_id,
          status: row.status,
          createdBy: row.created_by,
          closedBy: row.closed_by,
          closedAt: row.closed_at,
          metadata: row.metadata ?? {},
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          votes: {
            up: Number(row.votes_up ?? 0),
            down: Number(row.votes_down ?? 0),
          },
        }));
      });

      return res.json({ items });
    } catch (error) {
      return res.status(500).json({ error: mapDbError(error, 'Error listando logros') });
    }
  });

  router.post('/achievements', requireAuth, validateBody(achievementCreateSchema), async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const body = res.locals.validatedBody as {
      activityId: string;
      title: string;
      description?: string;
      rewardType: 'points' | 'item' | 'mixed';
      rewardPoints?: number;
      rewardItemId?: string;
      metadata?: Record<string, unknown>;
    };

    try {
      const item = await withTransaction(pool, async (client) => {
        const created = await client.query(
          `INSERT INTO achievement_definitions (
             activity_id,
             title,
             description,
             reward_type,
             reward_points,
             reward_item_id,
             status,
             created_by,
             metadata
           ) VALUES ($1,$2,$3,$4,$5,$6,'voting',$7,$8::jsonb)
           RETURNING achievement_id, activity_id, title, description, reward_type, reward_points, reward_item_id, status, created_by, metadata, created_at, updated_at`,
          [
            body.activityId,
            body.title,
            body.description ?? null,
            body.rewardType,
            body.rewardPoints ?? 0,
            body.rewardItemId ?? null,
            userId,
            JSON.stringify(body.metadata ?? {}),
          ]
        );
        return created.rows[0];
      });

      return res.status(201).json({
        achievementId: item.achievement_id,
        activityId: item.activity_id,
        title: item.title,
        description: item.description,
        rewardType: item.reward_type,
        rewardPoints: Number(item.reward_points ?? 0),
        rewardItemId: item.reward_item_id,
        status: item.status,
        createdBy: item.created_by,
        metadata: item.metadata ?? {},
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      });
    } catch (error) {
      return res.status(500).json({ error: mapDbError(error, 'Error creando logro') });
    }
  });

  router.post(
    '/achievements/:achievementId/vote',
    requireAuth,
    validateParams(achievementIdParamsSchema),
    validateBody(achievementVoteSchema),
    async (req: AuthenticatedRequest, res) => {
      const userId = req.user!.uid;
      const params = res.locals.validatedParams as { achievementId: string };
      const body = res.locals.validatedBody as { vote: 'up' | 'down'; metadata?: Record<string, unknown> };

      try {
        const payload = await withTransaction(pool, async (client) => {
          const target = await client.query<{ status: string }>(
            `SELECT status
             FROM achievement_definitions
             WHERE achievement_id = $1
             FOR UPDATE`,
            [params.achievementId]
          );
          if (!target.rowCount) {
            throw new Error('Logro no encontrado');
          }
          if (target.rows[0].status !== 'voting') {
            throw new Error('Solo se puede votar logros en estado voting');
          }

          await client.query(
            `INSERT INTO achievement_votes (achievement_id, user_id, vote_value, metadata)
             VALUES ($1,$2,$3,$4::jsonb)
             ON CONFLICT (achievement_id, user_id)
             DO UPDATE SET vote_value = EXCLUDED.vote_value,
                           metadata = achievement_votes.metadata || EXCLUDED.metadata,
                           updated_at = NOW()`,
            [params.achievementId, userId, body.vote, JSON.stringify(body.metadata ?? {})]
          );

          const tally = await client.query<{ up: string; down: string }>(
            `SELECT
               COALESCE(SUM(CASE WHEN vote_value = 'up' THEN 1 ELSE 0 END), 0) AS up,
               COALESCE(SUM(CASE WHEN vote_value = 'down' THEN 1 ELSE 0 END), 0) AS down
             FROM achievement_votes
             WHERE achievement_id = $1`,
            [params.achievementId]
          );

          return {
            achievementId: params.achievementId,
            vote: body.vote,
            votes: {
              up: Number(tally.rows[0]?.up ?? 0),
              down: Number(tally.rows[0]?.down ?? 0),
            },
          };
        });

        return res.status(201).json(payload);
      } catch (error) {
        const message = mapDbError(error, 'Error registrando voto del logro');
        if (message.includes('Logro no encontrado')) {
          return res.status(404).json({ error: message });
        }
        if (message.includes('estado voting')) {
          return res.status(409).json({ error: message });
        }
        return res.status(500).json({ error: message });
      }
    }
  );

  router.post(
    '/achievements/:achievementId/close',
    requireAuth,
    validateParams(achievementIdParamsSchema),
    validateBody(achievementCloseSchema),
    async (req: AuthenticatedRequest, res) => {
      const userId = req.user!.uid;
      const params = res.locals.validatedParams as { achievementId: string };
      const body = res.locals.validatedBody as { status: 'approved' | 'rejected' | 'archived'; note?: string };

      try {
        const payload = await withTransaction(pool, async (client) => {
          const target = await client.query<{
            status: string;
            created_by: string;
          }>(
            `SELECT status, created_by
             FROM achievement_definitions
             WHERE achievement_id = $1
             FOR UPDATE`,
            [params.achievementId]
          );
          if (!target.rowCount) {
            throw new Error('Logro no encontrado');
          }
          if (target.rows[0].status !== 'voting' && target.rows[0].status !== 'draft') {
            throw new Error('Logro ya cerrado');
          }
          if (target.rows[0].created_by !== userId) {
            throw new Error('Solo el creador puede cerrar el logro');
          }

          const tally = await client.query<{ up: string; down: string }>(
            `SELECT
               COALESCE(SUM(CASE WHEN vote_value = 'up' THEN 1 ELSE 0 END), 0) AS up,
               COALESCE(SUM(CASE WHEN vote_value = 'down' THEN 1 ELSE 0 END), 0) AS down
             FROM achievement_votes
             WHERE achievement_id = $1`,
            [params.achievementId]
          );

          const closed = await client.query(
            `UPDATE achievement_definitions
             SET status = $2,
                 closed_by = $3,
                 closed_at = NOW(),
                 metadata = metadata || $4::jsonb,
                 updated_at = NOW()
             WHERE achievement_id = $1
             RETURNING achievement_id, status, closed_by, closed_at, metadata`,
            [
              params.achievementId,
              body.status,
              userId,
              JSON.stringify({ close_note: body.note ?? null, votes: tally.rows[0] ?? { up: 0, down: 0 } }),
            ]
          );

          return {
            achievementId: closed.rows[0].achievement_id,
            status: closed.rows[0].status,
            closedBy: closed.rows[0].closed_by,
            closedAt: closed.rows[0].closed_at,
            votes: {
              up: Number(tally.rows[0]?.up ?? 0),
              down: Number(tally.rows[0]?.down ?? 0),
            },
          };
        });

        return res.json(payload);
      } catch (error) {
        const message = mapDbError(error, 'Error cerrando logro');
        if (message.includes('Logro no encontrado')) {
          return res.status(404).json({ error: message });
        }
        if (message.includes('Solo el creador') || message.includes('Logro ya cerrado')) {
          return res.status(409).json({ error: message });
        }
        return res.status(500).json({ error: message });
      }
    }
  );

  return router;
}
