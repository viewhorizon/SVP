import { Router } from 'express';
import type { Pool } from 'pg';

export function createSpvMvpRouter({ pool }: { pool: Pool }) {
  const router = Router();

  // GET /spv/users - Lista todos los usuarios
  router.get('/spv/users', async (_req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, username, name, email, points_balance, created_at FROM spv_users ORDER BY points_balance DESC'
      );
      res.json({ ok: true, data: result.rows });
    } catch (err) {
      console.error('[spvMvp] Error fetching users:', err);
      res.status(500).json({ ok: false, error: 'Error fetching users' });
    }
  });

  // GET /spv/activities - Lista todas las actividades (incluye vinculo a tarea)
  router.get('/spv/activities', async (_req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, name, description, type, votes_count, points_reward, is_active, linked_task_id, slug, created_at FROM spv_activities WHERE is_active = true ORDER BY votes_count DESC'
      );
      res.json({ ok: true, data: result.rows });
    } catch (err) {
      console.error('[spvMvp] Error fetching activities:', err);
      res.status(500).json({ ok: false, error: 'Error fetching activities' });
    }
  });

  // GET /spv/strategic - Lista items estrategicos con progreso calculado
  router.get('/spv/strategic', async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT s.id, s.title, s.description, s.progress,
          COALESCE(AVG(t.progress), 0)::int AS computed_progress,
          COUNT(t.id)::int AS total_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS done_tasks
        FROM spv_strategic_items s
        LEFT JOIN spv_tasks t ON t.strategic_item_id = s.id
        GROUP BY s.id, s.title, s.description, s.progress
        ORDER BY s.id`
      );
      res.json({ ok: true, data: result.rows });
    } catch (err) {
      console.error('[spvMvp] Error fetching strategic items:', err);
      res.status(500).json({ ok: false, error: 'Error fetching strategic items' });
    }
  });

  // GET /spv/tasks - Lista tareas con criterios, riesgo y dependencias
  router.get('/spv/tasks', async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, title, description, status, progress, strategic_item_id,
          acceptance_criteria, completed_criteria, risk, dependencies, updated_at
        FROM spv_tasks ORDER BY id`
      );
      res.json({ ok: true, data: result.rows });
    } catch (err) {
      console.error('[spvMvp] Error fetching tasks:', err);
      res.status(500).json({ ok: false, error: 'Error fetching tasks' });
    }
  });

  // GET /spv/history - Lista historial de transacciones
  router.get('/spv/history', async (_req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, user_id, description, type, amount, status, metadata, created_at FROM spv_history ORDER BY created_at DESC LIMIT 100'
      );
      res.json({ ok: true, data: result.rows });
    } catch (err) {
      console.error('[spvMvp] Error fetching history:', err);
      res.status(500).json({ ok: false, error: 'Error fetching history' });
    }
  });

  // POST /spv/vote - Registrar un voto y propagar progreso (trazabilidad)
  router.post('/spv/vote', async (req, res) => {
    const { activityId, userId, points, externalDomain, externalReference } = req.body;
    const reward = points === undefined ? 10 : points;
    const operationId = typeof externalReference === 'string' && externalReference.trim()
      ? externalReference.trim()
      : `spv-vote-${Date.now()}`;
    const allowedExternalDomains = new Set(['inventory', 'crm', 'ecommerce']);
    if (externalDomain !== undefined && (!allowedExternalDomains.has(externalDomain) || typeof externalReference !== 'string' || !externalReference.trim())) {
      return res.status(400).json({ ok: false, error: 'externalDomain y externalReference deben formar un contexto externo válido' });
    }
    if (typeof activityId !== 'string' || !activityId || typeof userId !== 'string' || !userId) {
      return res.status(400).json({ ok: false, error: 'activityId y userId son obligatorios' });
    }
    if (!Number.isInteger(reward) || reward <= 0 || reward > 1000) {
      return res.status(400).json({ ok: false, error: 'points debe ser un entero entre 1 y 1000' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userResult = await client.query('SELECT id FROM spv_users WHERE id = $1 FOR UPDATE', [userId]);
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      }

      // Incrementar votos en la actividad y obtener su tarea vinculada
      const activityResult = await client.query(
        'UPDATE spv_activities SET votes_count = votes_count + 1, updated_at = NOW() WHERE id = $1 RETURNING name, linked_task_id',
        [activityId]
      );
      if (activityResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'Actividad no encontrada' });
      }
      const activity = activityResult.rows[0];
      const linkedTaskId: string | null = activity.linked_task_id ?? null;

      // Agregar puntos al usuario si existe
      if (userId) {
        await client.query(
          'UPDATE spv_users SET points_balance = points_balance + $1, updated_at = NOW() WHERE id = $2',
          [reward, userId]
        );
      }

      // Registrar en historial
      await client.query(
        'INSERT INTO spv_history (user_id, description, type, amount, status, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          userId,
          `Voto en ${activity.name}`,
          'vote',
          reward,
          'success',
          JSON.stringify({ operationId, externalDomain: externalDomain ?? null, externalReference: externalReference ?? null, valueUnit: 'SVP_POINTS' }),
        ]
      );

      // === TRAZABILIDAD: propagar progreso a la tarea vinculada ===
      let impact: null | {
        taskId: string;
        taskTitle: string;
        taskProgress: number;
        taskStatus: string;
        strategicId: string | null;
        strategicTitle: string | null;
        strategicProgress: number | null;
      } = null;

      if (linkedTaskId) {
        // Cada voto suma 10% de progreso a la tarea (tope 100)
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

          // Recalcular progreso del item estrategico como promedio de sus tareas
          if (task.strategic_item_id) {
            const stratResult = await client.query(
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
            if (stratResult.rows.length > 0) {
              strategicProgress = stratResult.rows[0].progress;
              strategicTitle = stratResult.rows[0].title;
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

      await client.query('COMMIT');
      res.json({ ok: true, message: 'Voto registrado', operationId, valueUnit: 'SVP_POINTS', impact });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[spvMvp] Error registering vote:', err);
      res.status(500).json({ ok: false, error: 'Error registering vote' });
    } finally {
      client.release();
    }
  });

  // POST /spv/transfer - Transferir puntos entre usuarios
  router.post('/spv/transfer', async (req, res) => {
    const { fromUserId, toUsername, amount } = req.body;
    try {
      // Buscar usuario destino por username
      const toUserResult = await pool.query(
        'SELECT id, name FROM spv_users WHERE username = $1',
        [toUsername]
      );

      if (toUserResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Usuario destino no encontrado' });
      }

      const toUser = toUserResult.rows[0];

      // Verificar balance del emisor (si tiene ID)
      if (fromUserId) {
        const fromUserResult = await pool.query(
          'SELECT points_balance FROM spv_users WHERE id = $1',
          [fromUserId]
        );
        if (fromUserResult.rows.length > 0 && fromUserResult.rows[0].points_balance < amount) {
          return res.status(400).json({ ok: false, error: 'Puntos insuficientes' });
        }

        // Deducir del emisor
        await pool.query(
          'UPDATE spv_users SET points_balance = points_balance - $1, updated_at = NOW() WHERE id = $2',
          [amount, fromUserId]
        );
      }

      // Acreditar al receptor
      await pool.query(
        'UPDATE spv_users SET points_balance = points_balance + $1, updated_at = NOW() WHERE id = $2',
        [amount, toUser.id]
      );

      // Registrar en historial
      await pool.query(
        'INSERT INTO spv_history (user_id, description, type, amount, status) VALUES ($1, $2, $3, $4, $5)',
        [toUser.id, `Transferencia recibida de ${amount} pts`, 'transfer', amount, 'success']
      );

      // Registrar transacción
      await pool.query(
        'INSERT INTO spv_transactions (from_user_id, to_user_id, amount, type, status, description) VALUES ($1, $2, $3, $4, $5, $6)',
        [fromUserId, toUser.id, amount, 'transfer', 'success', `Transferencia de puntos`]
      );

      res.json({ ok: true, message: `Transferidos ${amount} pts a ${toUser.name}` });
    } catch (err) {
      console.error('[spvMvp] Error transferring points:', err);
      res.status(500).json({ ok: false, error: 'Error en transferencia' });
    }
  });

  // POST /spv/activities - Crear nueva actividad
  router.post('/spv/activities', async (req, res) => {
    const { name, description, type, pointsReward } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO spv_activities (name, description, type, points_reward) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, description || '', type || 'local', pointsReward || 10]
      );
      res.json({ ok: true, data: result.rows[0] });
    } catch (err) {
      console.error('[spvMvp] Error creating activity:', err);
      res.status(500).json({ ok: false, error: 'Error creating activity' });
    }
  });

  // PUT /spv/activities/:id - Actualizar actividad
  router.put('/spv/activities/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, type, pointsReward, isActive } = req.body;
    try {
      const result = await pool.query(
        `UPDATE spv_activities SET 
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          type = COALESCE($3, type),
          points_reward = COALESCE($4, points_reward),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
        WHERE id = $6 RETURNING *`,
        [name, description, type, pointsReward, isActive, id]
      );
      res.json({ ok: true, data: result.rows[0] });
    } catch (err) {
      console.error('[spvMvp] Error updating activity:', err);
      res.status(500).json({ ok: false, error: 'Error updating activity' });
    }
  });

  // DELETE /spv/activities/:id - Eliminar actividad
  router.delete('/spv/activities/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('UPDATE spv_activities SET is_active = false WHERE id = $1', [id]);
      res.json({ ok: true, message: 'Actividad eliminada' });
    } catch (err) {
      console.error('[spvMvp] Error deleting activity:', err);
      res.status(500).json({ ok: false, error: 'Error deleting activity' });
    }
  });

  // DELETE /spv/history/:id - Eliminar entrada de historial
  router.delete('/spv/history/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM spv_history WHERE id = $1', [id]);
      res.json({ ok: true, message: 'Entrada eliminada' });
    } catch (err) {
      console.error('[spvMvp] Error deleting history:', err);
      res.status(500).json({ ok: false, error: 'Error deleting history entry' });
    }
  });

  // PUT /spv/history/:id - Actualizar entrada de historial
  router.put('/spv/history/:id', async (req, res) => {
    const { id } = req.params;
    const { description } = req.body;
    try {
      const result = await pool.query(
        'UPDATE spv_history SET description = $1 WHERE id = $2 RETURNING *',
        [description, id]
      );
      res.json({ ok: true, data: result.rows[0] });
    } catch (err) {
      console.error('[spvMvp] Error updating history:', err);
      res.status(500).json({ ok: false, error: 'Error updating history entry' });
    }
  });

  return router;
}
