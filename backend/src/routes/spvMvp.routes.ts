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

  // GET /spv/activities - Lista todas las actividades
  router.get('/spv/activities', async (_req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, name, description, type, votes_count, points_reward, is_active, created_at FROM spv_activities WHERE is_active = true ORDER BY votes_count DESC'
      );
      res.json({ ok: true, data: result.rows });
    } catch (err) {
      console.error('[spvMvp] Error fetching activities:', err);
      res.status(500).json({ ok: false, error: 'Error fetching activities' });
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

  // POST /spv/vote - Registrar un voto
  router.post('/spv/vote', async (req, res) => {
    const { activityId, userId, points } = req.body;
    try {
      // Incrementar votos en la actividad
      await pool.query(
        'UPDATE spv_activities SET votes_count = votes_count + 1, updated_at = NOW() WHERE id = $1',
        [activityId]
      );

      // Agregar puntos al usuario si existe
      if (userId) {
        await pool.query(
          'UPDATE spv_users SET points_balance = points_balance + $1, updated_at = NOW() WHERE id = $2',
          [points || 10, userId]
        );
      }

      // Registrar en historial
      await pool.query(
        'INSERT INTO spv_history (user_id, description, type, amount, status) VALUES ($1, $2, $3, $4, $5)',
        [userId, `Voto en actividad`, 'vote', points || 10, 'success']
      );

      res.json({ ok: true, message: 'Voto registrado' });
    } catch (err) {
      console.error('[spvMvp] Error registering vote:', err);
      res.status(500).json({ ok: false, error: 'Error registering vote' });
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
