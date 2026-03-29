import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { appendLedgerEntry, getBalance } from '../db/pointsRepository';
import { withTransaction } from '../db/withTransaction';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { checkAndStoreWebhookReplayKey } from '../services/webhookReplayGuard';
import { getNumberConfig, getSecret } from '../services/secrets';
import { validateBody, validateParams } from '../middleware/validate';
import {
  liveOpsConvertSchema,
  pointsConvertSchema,
  pointsCreditSchema,
  pointsDebitSchema,
  pointsTransferSchema,
  userIdParamsSchema,
  webhookPointsCreditSchema,
} from '../validation/schemas';

type CreatePointsRouterOptions = {
  pool: Pool;
};

type LiveOpsDirection = 'POINTS_TO_LIVEOPS' | 'LIVEOPS_TO_POINTS';

type LiveOpsRate = {
  rateId: string | null;
  parkId: string | null;
  value: number;
  unitIn: string;
  unitOut: string;
};

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toSafeString = (value: unknown, fallback = '') => String(value ?? fallback).trim();

const readIdempotencyKey = (headers: { [key: string]: unknown }) => {
  const raw = headers['idempotency-key'] ?? headers['x-idempotency-key'];
  const value = String(raw ?? '').trim();
  return value.length > 0 ? value : null;
};

const constantTimeCompare = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

const normalizeSignature = (value: string) => value.replace(/^sha256=/i, '').trim();

async function resolveLiveOpsRate(client: PoolClient, parkId: string, requestedRateId?: string) {
  const rawRows = await client.query<{ data: Record<string, unknown> }>(
    `SELECT to_jsonb(lr) AS data FROM liveops_rates lr LIMIT 200`
  );

  const candidates = rawRows.rows
    .map((row) => row.data ?? {})
    .filter((data) => {
      const activeFlag = data.is_active;
      if (typeof activeFlag === 'boolean' && !activeFlag) return false;

      const dataParkId = String(data.park_id ?? data.parkId ?? '').trim();
      if (dataParkId && parkId && dataParkId !== parkId) return false;

      if (requestedRateId) {
        const dataRateId = String(data.rate_id ?? data.id ?? '').trim();
        if (dataRateId && dataRateId !== requestedRateId) return false;
      }

      return true;
    });

  const selected = candidates[0];
  if (!selected) {
    return null;
  }

  const rateValue =
    toPositiveNumber(selected.rate_value) ??
    toPositiveNumber(selected.rate) ??
    toPositiveNumber(selected.multiplier) ??
    toPositiveNumber(selected.points_per_unit) ??
    1;

  return {
    rateId: toSafeString(selected.rate_id ?? selected.id) || null,
    parkId: toSafeString(selected.park_id ?? selected.parkId ?? parkId) || null,
    value: rateValue,
    unitIn: toSafeString(selected.unit_in ?? selected.unitIn ?? 'SVP_POINTS') || 'SVP_POINTS',
    unitOut: toSafeString(selected.unit_out ?? selected.unitOut ?? 'LIVEOPS_CREDIT') || 'LIVEOPS_CREDIT',
  } as LiveOpsRate;
}

export function createPointsRouter({ pool }: CreatePointsRouterOptions) {
  const router = Router();

  router.get('/points/balance', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;

    try {
      const balance = await withTransaction(pool, (client) => getBalance(client, userId));
      return res.json({
        userId: balance.userId,
        available: balance.availablePoints,
        historical: balance.lifetimePoints,
        updatedAt: balance.updatedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error consultando balance';
      return res.status(500).json({ error: message });
    }
  });

  router.get('/points/balance/:userId', requireAuth, validateParams(userIdParamsSchema), async (_req: AuthenticatedRequest, res) => {
    const params = res.locals.validatedParams as { userId: string };
    const userId = params.userId;

    try {
      const balance = await withTransaction(pool, (client) => getBalance(client, userId));
      return res.json({
        userId: balance.userId,
        available: balance.availablePoints,
        historical: balance.lifetimePoints,
        updatedAt: balance.updatedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error consultando balance';
      return res.status(500).json({ error: message });
    }
  });

  router.post('/points/credit', requireAuth, validateBody(pointsCreditSchema), async (req: AuthenticatedRequest, res) => {
    const body = res.locals.validatedBody as {
      userId?: string;
      amount: number;
      requestId?: string;
      eventId?: string;
      reason?: string;
    };
    const userId = String(body.userId ?? req.user!.uid);
    const amount = body.amount;
    const requestId = body.requestId ?? readIdempotencyKey(req.headers) ?? randomUUID();
    const eventId = body.eventId ?? randomUUID();
    const reason = String(body.reason ?? 'manual_credit');

    try {
      const result = await withTransaction(pool, async (client) => {
        const ledgerEntry = await appendLedgerEntry(client, {
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
        return { userId, amount, requestId, eventId, idempotent: ledgerEntry.idempotent, balance };
      });

      return res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al acreditar puntos';
      return res.status(500).json({ error: message });
    }
  });

  router.post('/points/debit', requireAuth, validateBody(pointsDebitSchema), async (req: AuthenticatedRequest, res) => {
    const body = res.locals.validatedBody as {
      userId?: string;
      amount: number;
      requestId?: string;
      eventId?: string;
      reason?: string;
    };
    const userId = String(body.userId ?? req.user!.uid);
    const amount = body.amount;
    const requestId = body.requestId ?? readIdempotencyKey(req.headers) ?? randomUUID();
    const eventId = body.eventId ?? randomUUID();
    const reason = String(body.reason ?? 'manual_debit');

    try {
      const result = await withTransaction(pool, async (client) => {
        const ledgerEntry = await appendLedgerEntry(client, {
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
        return { userId, amount, requestId, eventId, idempotent: ledgerEntry.idempotent, balance };
      });

      return res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al debitar puntos';
      if (message === 'Saldo insuficiente') {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  router.post('/points/transfer', requireAuth, validateBody(pointsTransferSchema), async (req: AuthenticatedRequest, res) => {
    const fromUserId = req.user!.uid;
    const body = res.locals.validatedBody as { toUserId: string; amount: number; requestId?: string };
    const toUserId = body.toUserId;
    const amount = body.amount;
    const requestId = body.requestId ?? readIdempotencyKey(req.headers) ?? randomUUID();

    if (toUserId === fromUserId) {
      return res.status(400).json({ error: 'No puedes transferirte a ti mismo' });
    }

    try {
      const result = await withTransaction(pool, async (client) => {
        const senderEventId = randomUUID();
        const receiverEventId = randomUUID();

        const senderLedgerEntry = await appendLedgerEntry(client, {
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

        const receiverLedgerEntry = await appendLedgerEntry(client, {
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
          idempotent: senderLedgerEntry.idempotent && receiverLedgerEntry.idempotent,
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

      return res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al transferir puntos';
      if (message === 'Saldo insuficiente') {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  // Nota: este archivo se completó desde la versión remota disponible parcialmente en este entorno.
  router.post('/points/convert', requireAuth, validateBody(pointsConvertSchema), async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const body = res.locals.validatedBody as {
      parkId: string;
      itemId: string;
      amount: number;
      rateId: string;
      requestId?: string;
      eventId?: string;
    };
    const parkId = body.parkId;
    const itemId = body.itemId;
    const amount = body.amount;
    const rateId = body.rateId;
    const requestId = body.requestId ?? readIdempotencyKey(req.headers) ?? randomUUID();
    const eventId = body.eventId ?? randomUUID();

    try {
      const result = await withTransaction(pool, async (client) => {
        const ledgerEntry = await appendLedgerEntry(client, {
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

        const transactionId = ledgerEntry.idempotent ? null : randomUUID();
        if (transactionId) {
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
        }

        const balance = await getBalance(client, userId);
        return {
          requestId,
          eventId,
          transactionId,
          idempotent: ledgerEntry.idempotent,
          userId,
          parkId,
          itemId,
          amount,
          balance,
        };
      });

      return res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al convertir puntos';
      if (message === 'Saldo insuficiente') {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  router.post('/points/liveops/convert', requireAuth, validateBody(liveOpsConvertSchema), async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const body = res.locals.validatedBody as {
      direction?: LiveOpsDirection;
      parkId: string;
      amount: number;
      requestId?: string;
      eventId?: string;
      rateId?: string;
    };
    const direction = (body.direction ?? 'POINTS_TO_LIVEOPS') as LiveOpsDirection;
    const parkId = body.parkId;
    const amount = body.amount;
    const requestId = body.requestId ?? readIdempotencyKey(req.headers) ?? randomUUID();
    const eventId = body.eventId ?? randomUUID();
    const requestedRateId = body.rateId ?? '';

    try {
      const result = await withTransaction(pool, async (client) => {
        const rate = await resolveLiveOpsRate(client, parkId, requestedRateId || undefined);
        if (!rate) {
          throw new Error('No se encontro una tasa activa en liveops_rates para esta conversion');
        }

        const convertedAmount = Math.max(1, Math.floor(amount * rate.value));
        const transactionId = randomUUID();

        if (direction === 'POINTS_TO_LIVEOPS') {
          const ledgerEntry = await appendLedgerEntry(client, {
            userId,
            requestId,
            eventId,
            operationType: 'POINTS_CONVERTED_TO_ITEM',
            direction: 'DEBIT',
            amount,
            metadata: {
              domain_event: 'POINTS_TO_LIVEOPS',
              park_id: parkId,
              rate_id: rate.rateId,
              rate_value: rate.value,
              amount_out: convertedAmount,
            },
          });

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
                 completed_at
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL)`,
              [
                transactionId,
                userId,
                'POINTS_TO_LIVEOPS',
                'SVP',
                'LIVEOPS',
                parkId,
                amount,
                convertedAmount,
                rate.unitIn,
                rate.unitOut,
                rate.rateId,
                'PENDING',
                'SPV_DEBIT_COMPLETED',
              ]
            );
          }

          const balance = await getBalance(client, userId);
          return {
            requestId,
            eventId,
            transactionId: ledgerEntry.idempotent ? null : transactionId,
            idempotent: ledgerEntry.idempotent,
            direction,
            userId,
            parkId,
            amountIn: amount,
            amountOut: convertedAmount,
            unitIn: rate.unitIn,
            unitOut: rate.unitOut,
            rateId: rate.rateId,
            rateValue: rate.value,
            balance,
          };
        }

        const ledgerEntry = await appendLedgerEntry(client, {
          userId,
          requestId,
          eventId,
          operationType: 'POINTS_GRANTED',
          direction: 'CREDIT',
          amount: convertedAmount,
          metadata: {
            domain_event: 'LIVEOPS_TO_POINTS',
            park_id: parkId,
            rate_id: rate.rateId,
            rate_value: rate.value,
            amount_in_liveops: amount,
          },
        });

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
               completed_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`,
            [
              transactionId,
              userId,
              'LIVEOPS_TO_POINTS',
              'LIVEOPS',
              'SVP',
              parkId,
              amount,
              convertedAmount,
              rate.unitOut,
              rate.unitIn,
              rate.rateId,
              'COMPLETED',
              'SPV_CREDIT_COMPLETED',
            ]
          );
        }

        const balance = await getBalance(client, userId);
        return {
          requestId,
          eventId,
          transactionId: ledgerEntry.idempotent ? null : transactionId,
          idempotent: ledgerEntry.idempotent,
          direction,
          userId,
          parkId,
          amountIn: amount,
          amountOut: convertedAmount,
          unitIn: rate.unitOut,
          unitOut: rate.unitIn,
          rateId: rate.rateId,
          rateValue: rate.value,
          balance,
        };
      });

      return res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error en conversion con LiveOps';
      if (message === 'Saldo insuficiente') {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  router.post('/webhooks/points/credit', validateBody(webhookPointsCreditSchema), async (req, res) => {
    const expectedSecret = String(getSecret('WEBHOOK_SHARED_SECRET') ?? '').trim();
    const providedSecret = String(req.header('x-webhook-secret') ?? '').trim();
    const signingSecret = String(getSecret('WEBHOOK_SIGNING_SECRET') ?? '').trim();

    if (signingSecret) {
      const timestamp = String(req.header('x-webhook-timestamp') ?? '').trim();
      const providedSignature = normalizeSignature(String(req.header('x-webhook-signature') ?? ''));
      const toleranceSeconds = getNumberConfig('WEBHOOK_HMAC_TOLERANCE_SECONDS', 300);

      if (!timestamp || !providedSignature) {
        return res.status(401).json({ error: 'Headers de firma webhook faltantes' });
      }

      const timestampMs = Number(timestamp) * 1000;
      if (!Number.isFinite(timestampMs)) {
        return res.status(401).json({ error: 'Timestamp de webhook invalido' });
      }

      const drift = Math.abs(Date.now() - timestampMs);
      if (drift > toleranceSeconds * 1000) {
        return res.status(401).json({ error: 'Timestamp de webhook fuera de tolerancia' });
      }

      const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});
      const expectedSignature = createHmac('sha256', signingSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

      if (!constantTimeCompare(expectedSignature, providedSignature)) {
        return res.status(401).json({ error: 'Firma webhook invalida' });
      }

      const replayAccepted = checkAndStoreWebhookReplayKey(`${timestamp}:${providedSignature}`, toleranceSeconds);
      if (!replayAccepted) {
        return res.status(409).json({ error: 'Webhook replay detectado' });
      }
    }

    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Webhook secret invalido' });
    }

    const body = res.locals.validatedBody as {
      userId: string;
      amount: number;
      sourceSystem?: string;
      requestId?: string;
      eventId?: string;
      metadata?: Record<string, unknown>;
    };
    const userId = body.userId;
    const amount = body.amount;
    const sourceSystem = String(body.sourceSystem ?? 'external').trim() || 'external';
    const requestId = body.requestId ?? body.eventId ?? readIdempotencyKey(req.headers) ?? randomUUID();
    const eventId = body.eventId ?? randomUUID();
    const metadata = body.metadata ?? {};

    try {
      const payload = await withTransaction(pool, async (client) => {
        const ledgerEntry = await appendLedgerEntry(client, {
          userId,
          requestId,
          eventId,
          operationType: 'POINTS_GRANTED',
          direction: 'CREDIT',
          amount,
          metadata: {
            domain_event: 'EXTERNAL_POINTS_CREDIT',
            source_system: sourceSystem,
            webhook: true,
            ...metadata,
          },
        });

        const transactionId = randomUUID();
        let transactionLogged = true;
        if (!ledgerEntry.idempotent) {
          try {
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
               ) VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9,NULL,$10,$11,NOW())`,
              [
                transactionId,
                userId,
                'EXTERNAL_POINTS_CREDIT',
                sourceSystem,
                'SVP',
                amount,
                amount,
                'EXTERNAL_CREDIT',
                'SVP_POINTS',
                'COMPLETED',
                'SPV_CREDIT_COMPLETED',
              ]
            );
          } catch {
            transactionLogged = false;
          }
        }

        const balance = await getBalance(client, userId);
        return {
          userId,
          amount,
          sourceSystem,
          requestId,
          eventId,
          transactionId: ledgerEntry.idempotent ? null : transactionId,
          idempotent: ledgerEntry.idempotent,
          transactionLogged,
          balance,
        };
      });

      return res.status(payload.idempotent ? 200 : 201).json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error acreditando puntos externos';
      return res.status(500).json({ error: message });
    }
  });

  return router;
}