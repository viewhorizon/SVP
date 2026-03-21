import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import { appendLedgerEntry, getBalance } from '../db/pointsRepository';
import { withTransaction } from '../db/withTransaction';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';

type CreatePointsRouterOptions = {
  pool: Pool;
};

export function createPointsRouter({ pool }: CreatePointsRouterOptions) {
  const router = Router();

  router.post('/points/credit', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = String(req.body?.userId ?? req.user!.uid);
    const amount = Number(req.body?.amount);
    const requestId = String(req.body?.requestId ?? randomUUID());
    const eventId = String(req.body?.eventId ?? randomUUID());
    const reason = String(req.body?.reason ?? 'manual_credit');

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount debe ser un número positivo' });
    }

    try {
      const result = await withTransaction(pool, async (client) => {
        await appendLedgerEntry(client, {
          userId,
          requestId,
          eventId,
          operationType: 'POINTS_GRANTED',
          direction: 'CREDIT',
          amount,
          metadata: {
            reason,
            domain_event: 'POINTS_GRANTED',
            actor_user_id: req.user!.uid,
          },
        });

        const balance = await getBalance(client, userId);
        return { userId, amount, requestId, eventId, balance };
      });

      return res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al acreditar puntos';
      return res.status(500).json({ error: message });
    }
  });

  router.post('/points/debit', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = String(req.body?.userId ?? req.user!.uid);
    const amount = Number(req.body?.amount);
    const requestId = String(req.body?.requestId ?? randomUUID());
    const eventId = String(req.body?.eventId ?? randomUUID());
    const reason = String(req.body?.reason ?? 'manual_debit');

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount debe ser un número positivo' });
    }

    try {
      const result = await withTransaction(pool, async (client) => {
        await appendLedgerEntry(client, {
          userId,
          requestId,
          eventId,
          operationType: 'POINTS_DEBITED',
          direction: 'DEBIT',
          amount,
          metadata: {
            reason,
            domain_event: 'POINTS_DEBITED',
            actor_user_id: req.user!.uid,
          },
        });

        const balance = await getBalance(client, userId);
        return { userId, amount, requestId, eventId, balance };
      });

      return res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al debitar puntos';
      if (message === 'Saldo insuficiente') {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  router.post('/points/transfer', requireAuth, async (req: AuthenticatedRequest, res) => {
    const fromUserId = req.user!.uid;
    const toUserId = String(req.body?.toUserId ?? '').trim();
    const amount = Number(req.body?.amount);
    const requestId = String(req.body?.requestId ?? randomUUID());

    if (!toUserId) {
      return res.status(400).json({ error: 'toUserId es requerido' });
    }
    if (toUserId === fromUserId) {
      return res.status(400).json({ error: 'No puedes transferirte a ti mismo' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount debe ser un número positivo' });
    }

    try {
      const result = await withTransaction(pool, async (client) => {
        const senderEventId = randomUUID();
        const receiverEventId = randomUUID();

        await appendLedgerEntry(client, {
          userId: fromUserId,
          requestId,
          eventId: senderEventId,
          operationType: 'POINTS_TRANSFERRED_OUT',
          direction: 'DEBIT',
          amount,
          relatedUserId: toUserId,
          metadata: {
            domain_event: 'POINTS_TRANSFERRED',
            transfer_direction: 'out',
          },
        });

        await appendLedgerEntry(client, {
          userId: toUserId,
          requestId,
          eventId: receiverEventId,
          operationType: 'POINTS_TRANSFERRED_IN',
          direction: 'CREDIT',
          amount,
          relatedUserId: fromUserId,
          metadata: {
            domain_event: 'POINTS_TRANSFERRED',
            transfer_direction: 'in',
          },
        });

        const [fromBalance, toBalance] = await Promise.all([
          getBalance(client, fromUserId),
          getBalance(client, toUserId),
        ]);

        return {
          requestId,
          fromUserId,
          toUserId,
          amount,
          events: [
            { event_id: senderEventId, type: 'POINTS_TRANSFERRED_OUT' },
            { event_id: receiverEventId, type: 'POINTS_TRANSFERRED_IN' },
          ],
          balances: {
            from: fromBalance,
            to: toBalance,
          },
        };
      });

      return res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al transferir puntos';
      if (message === 'Saldo insuficiente') {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  router.post('/points/convert', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const parkId = String(req.body?.parkId ?? '').trim();
    const itemId = String(req.body?.itemId ?? '').trim();
    const amount = Number(req.body?.amount);
    const rateId = String(req.body?.rateId ?? '').trim();
    const requestId = String(req.body?.requestId ?? randomUUID());
    const eventId = String(req.body?.eventId ?? randomUUID());

    if (!parkId || !itemId || !rateId) {
      return res.status(400).json({ error: 'parkId, itemId y rateId son requeridos' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount debe ser un número positivo' });
    }

    try {
      const result = await withTransaction(pool, async (client) => {
        await appendLedgerEntry(client, {
          userId,
          requestId,
          eventId,
          operationType: 'POINTS_CONVERTED_TO_ITEM',
          direction: 'DEBIT',
          amount,
          metadata: {
            domain_event: 'POINTS_CONVERTED_TO_ITEM',
            park_id: parkId,
            item_id: itemId,
            rate_id: rateId,
          },
        });

        const transactionId = randomUUID();
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
             completed_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL)`,
          [
            transactionId,
            userId,
            'POINTS_TO_ITEM',
            'SVP',
            'INVENTORY',
            parkId,
            amount,
            1,
            'SVP_POINTS',
            'ITEM',
            rateId,
            'PENDING',
            'SPV_DEBIT_COMPLETED',
          ]
        );

        const balance = await getBalance(client, userId);
        return {
          requestId,
          eventId,
          transactionId,
          userId,
          parkId,
          itemId,
          amount,
          status: 'PENDING',
          balance,
        };
      });

      return res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error en conversión de puntos';
      if (message === 'Saldo insuficiente') {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  router.get('/points/balance/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = String(req.params.userId);

    // Se permite consultar propio saldo o perfiles autorizados por ACL externa.
    if (userId !== req.user!.uid) {
      return res.status(403).json({ error: 'No autorizado para consultar este balance' });
    }

    try {
      const result = await withTransaction(pool, async (client) => {
        const balance = await getBalance(client, userId);
        return balance;
      });

      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error consultando balance';
      return res.status(500).json({ error: message });
    }
  });

  return router;
}
