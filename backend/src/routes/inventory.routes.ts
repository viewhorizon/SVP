import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { appendLedgerEntry, getBalance } from '../db/pointsRepository';
import { withTransaction } from '../db/withTransaction';
import { requireAuth, type AuthenticatedRequest } from '../middleware/requireAuth';
import { validateBody, validateQuery } from '../middleware/validate';
import { appendInventoryLedgerEvent, signInventoryLedgerReport, verifyInventoryLedgerIntegrity } from '../services/inventoryLedger';
import { getSecret } from '../services/secrets';
import {
  inventoryCatalogQuerySchema,
  inventoryLifecycleDestroySchema,
  inventoryLifecycleTransferSchema,
  inventoryLifecycleTransformSchema,
  inventoryLedgerVerifyQuerySchema,
  inventoryPurchaseSchema,
} from '../validation/schemas';

type CreateInventoryRouterOptions = {
  pool: Pool;
};

const readIdempotencyKey = (headers: { [key: string]: unknown }) => {
  const raw = headers['idempotency-key'] ?? headers['x-idempotency-key'];
  const value = String(raw ?? '').trim();
  return value.length > 0 ? value : null;
};

const mapDbError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes('relation') && message.includes('does not exist')) {
    return `${fallback}. Faltan tablas de inventario; ejecutar backend/sql/20260320_inventory_liveops_inventory.sql`;
  }
  if (message.includes('inventory_ledger_events')) {
    return `${fallback}. Falta hash-chain de inventario; ejecutar backend/sql/20260324_inventory_ledger_hash_chain.sql`;
  }
  return message;
};

const normalizeInventoryParkId = (scope: string, parkId?: string | null) => {
  if (scope === 'global') return null;
  const normalized = String(parkId ?? '').trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveCatalogPointsValue = async (client: PoolClient, itemId: string) => {
  const result = await client.query<{ price_spv: string; metadata: Record<string, unknown> | null }>(
    `SELECT price_spv, metadata FROM inventory_catalog WHERE item_id = $1 LIMIT 1`,
    [itemId]
  );

  if (!result.rowCount) return 0;
  const row = result.rows[0];
  const metadata = row.metadata ?? {};
  const fromMetadata = Number((metadata as Record<string, unknown>).points_equivalent ?? NaN);
  if (Number.isFinite(fromMetadata) && fromMetadata >= 0) {
    return Math.round(fromMetadata);
  }

  const fromPrice = Number(row.price_spv ?? 0);
  return Number.isFinite(fromPrice) && fromPrice >= 0 ? Math.round(fromPrice) : 0;
};

export function createInventoryRouter({ pool }: CreateInventoryRouterOptions) {
  const router = Router();

  router.get('/inventory/ledger/verify', requireAuth, validateQuery(inventoryLedgerVerifyQuerySchema), async (req: AuthenticatedRequest, res) => {
    const query = res.locals.validatedQuery as { userId?: string; limit?: number; sign?: boolean };
    const userId = query.userId ?? req.user!.uid;
    const limit = query.limit ?? 2000;
    const shouldSign = query.sign ?? true;

    try {
      const report = await withTransaction(pool, (client) => verifyInventoryLedgerIntegrity(client, { userId, limit }));
      const responsePayload: Record<string, unknown> = {
        userId,
        ...report,
      };

      if (shouldSign) {
        const signingSecret = getSecret('LEDGER_AUDIT_SIGNING_SECRET');
        if (signingSecret) {
          const signedAt = new Date().toISOString();
          responsePayload.auditSignature = {
            ...signInventoryLedgerReport({ userId, signedAt, report }, signingSecret),
            signedAt,
          };
        } else {
          responsePayload.auditSignature = {
            disabled: true,
            reason: 'LEDGER_AUDIT_SIGNING_SECRET no configurado',
          };
        }
      }

      return res.json(responsePayload);
    } catch (error) {
      const message = mapDbError(error, 'Error verificando integridad del inventory ledger');
      return res.status(500).json({ error: message });
    }
  });

  router.get('/inventory/catalog', requireAuth, validateQuery(inventoryCatalogQuerySchema), async (_req: AuthenticatedRequest, res) => {
    const query = res.locals.validatedQuery as { scope?: 'global' | 'local'; parkId?: string };
    const scope = query.scope ?? null;
    const parkId = (query.parkId ?? '').trim() || null;

    try {
      const result = await withTransaction(pool, async (client) => {
        const sql = `
          SELECT
            item_id,
            scope,
            park_id,
            sku,
            name,
            description,
            price_spv,
            stock,
            metadata,
            is_active,
            updated_at
          FROM inventory_catalog
          WHERE is_active = TRUE
            AND ($1::text IS NULL OR scope = $1)
            AND ($2::text IS NULL OR park_id = $2 OR scope = 'global')
          ORDER BY scope ASC, name ASC
          LIMIT 300
        `;

        const rows = await client.query(sql, [scope, parkId]);
        return rows.rows.map((row) => ({
          itemId: row.item_id,
          scope: row.scope,
          parkId: row.park_id,
          sku: row.sku,
          name: row.name,
          description: row.description,
          priceSpv: Number(row.price_spv),
          stock: row.stock === null ? null : Number(row.stock),
          metadata: row.metadata ?? {},
          isActive: row.is_active,
          updatedAt: row.updated_at,
        }));
      });

      return res.json({ items: result });
    } catch (error) {
      const message = mapDbError(error, 'Error consultando catalogo');
      return res.status(500).json({ error: message });
    }
  });

  router.get('/inventory/me', requireAuth, validateQuery(inventoryCatalogQuerySchema), async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const query = res.locals.validatedQuery as { scope?: 'global' | 'local'; parkId?: string };
    const scope = query.scope ?? null;
    const parkId = (query.parkId ?? '').trim() || null;

    try {
      const items = await withTransaction(pool, async (client) => {
        const sql = `
          SELECT
            ui.user_id,
            ui.item_id,
            ui.quantity,
            ui.scope,
            ui.park_id,
            ui.metadata,
            ui.updated_at,
            ic.name,
            ic.description,
            ic.sku
          FROM user_inventory ui
          LEFT JOIN inventory_catalog ic ON ic.item_id = ui.item_id
          WHERE ui.user_id = $1
            AND ($2::text IS NULL OR ui.scope = $2)
            AND ($3::text IS NULL OR ui.park_id = $3 OR ui.scope = 'global')
          ORDER BY ui.updated_at DESC
          LIMIT 500
        `;
        const result = await client.query(sql, [userId, scope, parkId]);
        return result.rows.map((row) => ({
          userId: row.user_id,
          itemId: row.item_id,
          quantity: Number(row.quantity),
          scope: row.scope,
          parkId: row.park_id,
          name: row.name ?? null,
          description: row.description ?? null,
          sku: row.sku ?? null,
          metadata: row.metadata ?? {},
          updatedAt: row.updated_at,
        }));
      });

      return res.json({ userId, items });
    } catch (error) {
      const message = mapDbError(error, 'Error consultando inventario del usuario');
      return res.status(500).json({ error: message });
    }
  });

  router.post('/inventory/purchase', requireAuth, validateBody(inventoryPurchaseSchema), async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const body = res.locals.validatedBody as {
      itemId: string;
      quantity: number;
      parkId?: string;
      requestId?: string;
    };
    const itemId = body.itemId;
    const quantity = body.quantity ?? 1;
    const requestId = body.requestId ?? readIdempotencyKey(req.headers) ?? randomUUID();

    if (body.toUserId === fromUserId) {
      return res.status(400).json({ error: 'toUserId debe ser diferente del usuario origen' });
    }
    const parkId = (body.parkId ?? '').trim() || null;
    const eventId = randomUUID();

    try {
      const payload = await withTransaction(pool, async (client) => {
        const itemResult = await client.query(
          `SELECT item_id, scope, park_id, price_spv, stock, is_active
           FROM inventory_catalog
           WHERE item_id = $1
           FOR UPDATE`,
          [itemId]
        );

        if (!itemResult.rowCount) {
          throw new Error('Item no encontrado');
        }

        const item = itemResult.rows[0];
        if (!item.is_active) {
          throw new Error('Item inactivo');
        }
        if (item.scope === 'local') {
          const itemParkId = String(item.park_id ?? '').trim();
          if (!parkId || (itemParkId && itemParkId !== parkId)) {
            throw new Error('Item local no disponible para ese parkId');
          }
        }

        const stock = item.stock === null ? null : Number(item.stock);
        if (stock !== null && stock < quantity) {
          throw new Error('Stock insuficiente para el item solicitado');
        }

        const priceSpv = Number(item.price_spv);
        const totalCost = priceSpv * quantity;

        const ledgerEntry = await appendLedgerEntry(client, {
          userId,
          requestId,
          eventId,
          operationType: 'POINTS_CONVERTED_TO_ITEM',
          direction: 'DEBIT',
          amount: totalCost,
          metadata: {
            domain_event: 'SHOP_PURCHASE',
            item_id: itemId,
            quantity,
            park_id: parkId,
            actor_user_id: userId,
          },
        });

        const transactionId = randomUUID();
        if (!ledgerEntry.idempotent) {
          const inventoryParkId = item.scope === 'global' ? null : parkId;
          const updateOwned = await client.query(
            `UPDATE user_inventory
             SET quantity = quantity + $3,
                 metadata = metadata || $6::jsonb,
                 updated_at = NOW()
             WHERE user_id = $1
               AND item_id = $2
               AND scope = $4
               AND ((park_id IS NULL AND $5::text IS NULL) OR park_id = $5::text)`,
            [
              userId,
              itemId,
              quantity,
              item.scope,
              inventoryParkId,
              JSON.stringify({ source: 'shop_purchase', requestId }),
            ]
          );

          if (!updateOwned.rowCount) {
            await client.query(
              `INSERT INTO user_inventory (
                 user_id,
                 item_id,
                 quantity,
                 scope,
                 park_id,
                 metadata
               ) VALUES ($1,$2,$3,$4,$5,$6)`,
              [
                userId,
                itemId,
                quantity,
                item.scope,
                inventoryParkId,
                JSON.stringify({ source: 'shop_purchase', requestId }),
              ]
            );
          }

          if (stock !== null) {
            await client.query(`UPDATE inventory_catalog SET stock = stock - $2 WHERE item_id = $1`, [itemId, quantity]);
          }

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
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11,$12,NOW())`,
            [
              transactionId,
              userId,
              'POINTS_TO_ITEM',
              'SVP',
              'INVENTORY',
              item.scope === 'global' ? null : parkId,
              totalCost,
              quantity,
              'SVP_POINTS',
              'ITEM',
              'COMPLETED',
              'ITEM_GRANTED',
            ]
          );

          await appendInventoryLedgerEvent(client, {
            userId,
            requestId,
            eventType: 'PURCHASE',
            entityId: itemId,
            deltaPoints: -totalCost,
            deltaItems: quantity,
            payload: {
              scope: item.scope,
              parkId: item.scope === 'global' ? null : parkId,
              unit: 'SVP_POINTS',
            },
          });
        }

        const [balance, ownedResult] = await Promise.all([
          getBalance(client, userId),
          client.query(
            `SELECT quantity
             FROM user_inventory
             WHERE user_id = $1
               AND item_id = $2
               AND scope = $3
               AND COALESCE(park_id, 'GLOBAL') = COALESCE($4, 'GLOBAL')
             LIMIT 1`,
            [userId, itemId, item.scope, item.scope === 'global' ? null : parkId]
          ),
        ]);

        return {
          userId,
          itemId,
          scope: item.scope,
          parkId: item.scope === 'global' ? null : parkId,
          quantity,
          totalCost,
          requestId,
          idempotent: ledgerEntry.idempotent,
          ownedQuantity: Number(ownedResult.rows[0]?.quantity ?? quantity),
          balance,
        };
      });

      return res.status(payload.idempotent ? 200 : 201).json(payload);
    } catch (error) {
      const message = mapDbError(error, 'Error al comprar item');
      if (message === 'Saldo insuficiente' || message.includes('Stock insuficiente')) {
        return res.status(409).json({ error: message });
      }
      if (message.includes('Item no encontrado') || message.includes('Item inactivo') || message.includes('parkId')) {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  router.post('/inventory/lifecycle/transfer', requireAuth, validateBody(inventoryLifecycleTransferSchema), async (req: AuthenticatedRequest, res) => {
    const fromUserId = req.user!.uid;
    const body = res.locals.validatedBody as {
      itemId: string;
      toUserId: string;
      quantity: number;
      parkId?: string;
      transferPoints: boolean;
      pointsValuePerItem?: number;
      requestId?: string;
    };
    const requestId = body.requestId ?? readIdempotencyKey(req.headers) ?? randomUUID();

    try {
      const payload = await withTransaction(pool, async (client) => {
        const sourceResult = await client.query(
          `SELECT scope, quantity, park_id
           FROM user_inventory
           WHERE user_id = $1 AND item_id = $2
             AND COALESCE(park_id, 'GLOBAL') = COALESCE($3, 'GLOBAL')
           FOR UPDATE`,
          [fromUserId, body.itemId, body.parkId ?? null]
        );

        if (!sourceResult.rowCount) {
          throw new Error('No existe el item origen en inventario');
        }

        const source = sourceResult.rows[0];
        const available = Number(source.quantity ?? 0);
        if (available < body.quantity) {
          throw new Error('Cantidad insuficiente para transferencia');
        }

        const scope = String(source.scope);
        const normalizedParkId = normalizeInventoryParkId(scope, source.park_id ?? body.parkId ?? null);

        await client.query(
          `UPDATE user_inventory
           SET quantity = quantity - $4,
               metadata = metadata || $5::jsonb,
               updated_at = NOW()
           WHERE user_id = $1 AND item_id = $2 AND scope = $3
             AND COALESCE(park_id, 'GLOBAL') = COALESCE($6, 'GLOBAL')`,
          [fromUserId, body.itemId, scope, body.quantity, JSON.stringify({ action: 'transfer_out', requestId }), normalizedParkId]
        );

        const targetUpdate = await client.query(
          `UPDATE user_inventory
           SET quantity = quantity + $4,
               metadata = metadata || $5::jsonb,
               updated_at = NOW()
           WHERE user_id = $1 AND item_id = $2 AND scope = $3
             AND COALESCE(park_id, 'GLOBAL') = COALESCE($6, 'GLOBAL')`,
          [body.toUserId, body.itemId, scope, body.quantity, JSON.stringify({ action: 'transfer_in', requestId, fromUserId }), normalizedParkId]
        );

        if (!targetUpdate.rowCount) {
          await client.query(
            `INSERT INTO user_inventory (user_id, item_id, quantity, scope, park_id, metadata)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
            [body.toUserId, body.itemId, body.quantity, scope, normalizedParkId, JSON.stringify({ action: 'transfer_in', requestId, fromUserId })]
          );
        }

        const catalogPointsPerItem = await resolveCatalogPointsValue(client, body.itemId);
        const pointsValuePerItem = Math.max(0, Number(body.pointsValuePerItem ?? catalogPointsPerItem));
        const pointsTransferred = body.transferPoints ? pointsValuePerItem * body.quantity : 0;

        if (pointsTransferred > 0) {
          await appendLedgerEntry(client, {
            userId: fromUserId,
            requestId,
            operationType: 'POINTS_TRANSFERRED_OUT',
            direction: 'DEBIT',
            amount: pointsTransferred,
            relatedUserId: body.toUserId,
            metadata: {
              domain_event: 'INVENTORY_TRANSFER',
              item_id: body.itemId,
              quantity: body.quantity,
              points_per_item: pointsValuePerItem,
            },
          });

          await appendLedgerEntry(client, {
            userId: body.toUserId,
            requestId: `${requestId}:in`,
            operationType: 'POINTS_TRANSFERRED_IN',
            direction: 'CREDIT',
            amount: pointsTransferred,
            relatedUserId: fromUserId,
            metadata: {
              domain_event: 'INVENTORY_TRANSFER',
              item_id: body.itemId,
              quantity: body.quantity,
              points_per_item: pointsValuePerItem,
            },
          });
        }

        await appendInventoryLedgerEvent(client, {
          userId: fromUserId,
          requestId,
          eventType: 'TRANSFER',
          entityId: body.itemId,
          deltaPoints: -pointsTransferred,
          deltaItems: -body.quantity,
          payload: {
            direction: 'out',
            toUserId: body.toUserId,
            scope,
            parkId: normalizedParkId,
            pointsTransferred,
            pointsValuePerItem,
          },
        });

        await appendInventoryLedgerEvent(client, {
          userId: body.toUserId,
          requestId: `${requestId}:to`,
          eventType: 'TRANSFER',
          entityId: body.itemId,
          deltaPoints: pointsTransferred,
          deltaItems: body.quantity,
          payload: {
            direction: 'in',
            fromUserId,
            scope,
            parkId: normalizedParkId,
            pointsTransferred,
            pointsValuePerItem,
          },
        });

        return {
          requestId,
          fromUserId,
          toUserId: body.toUserId,
          itemId: body.itemId,
          quantity: body.quantity,
          scope,
          parkId: normalizedParkId,
          pointsTransferred,
          pointsValuePerItem,
        };
      });

      return res.status(201).json(payload);
    } catch (error) {
      const message = mapDbError(error, 'Error en transferencia de inventario');
      if (message.includes('insuficiente') || message.includes('origen')) {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  router.post('/inventory/lifecycle/destroy', requireAuth, validateBody(inventoryLifecycleDestroySchema), async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const body = res.locals.validatedBody as {
      itemId: string;
      quantity: number;
      parkId?: string;
      pointsValuePerItem?: number;
      requestId?: string;
    };
    const requestId = body.requestId ?? readIdempotencyKey(req.headers) ?? randomUUID();

    try {
      const payload = await withTransaction(pool, async (client) => {
        const owned = await client.query(
          `SELECT scope, quantity, park_id
           FROM user_inventory
           WHERE user_id = $1 AND item_id = $2
             AND COALESCE(park_id, 'GLOBAL') = COALESCE($3, 'GLOBAL')
           FOR UPDATE`,
          [userId, body.itemId, body.parkId ?? null]
        );

        if (!owned.rowCount) {
          throw new Error('No existe el item en inventario');
        }

        const row = owned.rows[0];
        const currentQty = Number(row.quantity ?? 0);
        if (currentQty < body.quantity) {
          throw new Error('Cantidad insuficiente para destruir');
        }

        const scope = String(row.scope);
        const normalizedParkId = normalizeInventoryParkId(scope, row.park_id ?? body.parkId ?? null);
        const catalogPointsPerItem = await resolveCatalogPointsValue(client, body.itemId);
        const pointsValuePerItem = Math.max(0, Number(body.pointsValuePerItem ?? catalogPointsPerItem));
        const pointsDelta = pointsValuePerItem * body.quantity;

        await client.query(
          `UPDATE user_inventory
           SET quantity = quantity - $4,
               metadata = metadata || $5::jsonb,
               updated_at = NOW()
           WHERE user_id = $1 AND item_id = $2 AND scope = $3
             AND COALESCE(park_id, 'GLOBAL') = COALESCE($6, 'GLOBAL')`,
          [userId, body.itemId, scope, body.quantity, JSON.stringify({ action: 'destroy', requestId }), normalizedParkId]
        );

        if (pointsDelta > 0) {
          await appendLedgerEntry(client, {
            userId,
            requestId,
            operationType: 'POINTS_GRANTED',
            direction: 'CREDIT',
            amount: pointsDelta,
            metadata: {
              domain_event: 'INVENTORY_DESTROY',
              item_id: body.itemId,
              quantity: body.quantity,
              points_per_item: pointsValuePerItem,
            },
          });
        }

        await appendInventoryLedgerEvent(client, {
          userId,
          requestId,
          eventType: 'DESTROY',
          entityId: body.itemId,
          deltaPoints: pointsDelta,
          deltaItems: -body.quantity,
          payload: {
            scope,
            parkId: normalizedParkId,
            pointsValuePerItem,
          },
        });

        return {
          requestId,
          userId,
          itemId: body.itemId,
          quantity: body.quantity,
          scope,
          parkId: normalizedParkId,
          pointsDelta,
          pointsValuePerItem,
        };
      });

      return res.status(201).json(payload);
    } catch (error) {
      const message = mapDbError(error, 'Error en destruccion de item');
      if (message.includes('insuficiente') || message.includes('No existe')) {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  router.post('/inventory/lifecycle/transform', requireAuth, validateBody(inventoryLifecycleTransformSchema), async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.uid;
    const body = res.locals.validatedBody as {
      fromItemId: string;
      toItemId: string;
      quantity: number;
      parkId?: string;
      pointsDelta?: number;
      requestId?: string;
    };
    const requestId = body.requestId ?? readIdempotencyKey(req.headers) ?? randomUUID();

    try {
      const payload = await withTransaction(pool, async (client) => {
        const source = await client.query(
          `SELECT scope, quantity, park_id
           FROM user_inventory
           WHERE user_id = $1 AND item_id = $2
             AND COALESCE(park_id, 'GLOBAL') = COALESCE($3, 'GLOBAL')
           FOR UPDATE`,
          [userId, body.fromItemId, body.parkId ?? null]
        );

        if (!source.rowCount) {
          throw new Error('No existe item origen para transformacion');
        }

        const sourceRow = source.rows[0];
        const sourceQty = Number(sourceRow.quantity ?? 0);
        if (sourceQty < body.quantity) {
          throw new Error('Cantidad insuficiente para transformacion');
        }

        const scope = String(sourceRow.scope);
        const normalizedParkId = normalizeInventoryParkId(scope, sourceRow.park_id ?? body.parkId ?? null);
        const [fromPointsValue, toPointsValue] = await Promise.all([
          resolveCatalogPointsValue(client, body.fromItemId),
          resolveCatalogPointsValue(client, body.toItemId),
        ]);
        const inferredDelta = (toPointsValue - fromPointsValue) * body.quantity;
        const pointsDelta = Number.isFinite(body.pointsDelta) ? Number(body.pointsDelta) : inferredDelta;

        await client.query(
          `UPDATE user_inventory
           SET quantity = quantity - $4,
               metadata = metadata || $5::jsonb,
               updated_at = NOW()
           WHERE user_id = $1 AND item_id = $2 AND scope = $3
             AND COALESCE(park_id, 'GLOBAL') = COALESCE($6, 'GLOBAL')`,
          [userId, body.fromItemId, scope, body.quantity, JSON.stringify({ action: 'transform_from', requestId, toItemId: body.toItemId }), normalizedParkId]
        );

        const targetItemUpdate = await client.query(
          `UPDATE user_inventory
           SET quantity = quantity + $4,
               metadata = metadata || $5::jsonb,
               updated_at = NOW()
           WHERE user_id = $1 AND item_id = $2 AND scope = $3
             AND COALESCE(park_id, 'GLOBAL') = COALESCE($6, 'GLOBAL')`,
          [userId, body.toItemId, scope, body.quantity, JSON.stringify({ action: 'transform_to', requestId, fromItemId: body.fromItemId }), normalizedParkId]
        );

        if (!targetItemUpdate.rowCount) {
          await client.query(
            `INSERT INTO user_inventory (user_id, item_id, quantity, scope, park_id, metadata)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
            [userId, body.toItemId, body.quantity, scope, normalizedParkId, JSON.stringify({ action: 'transform_to', requestId, fromItemId: body.fromItemId })]
          );
        }

        if (pointsDelta > 0) {
          await appendLedgerEntry(client, {
            userId,
            requestId,
            operationType: 'POINTS_GRANTED',
            direction: 'CREDIT',
            amount: pointsDelta,
            metadata: {
              domain_event: 'INVENTORY_TRANSFORM',
              from_item_id: body.fromItemId,
              to_item_id: body.toItemId,
              quantity: body.quantity,
            },
          });
        } else if (pointsDelta < 0) {
          await appendLedgerEntry(client, {
            userId,
            requestId,
            operationType: 'POINTS_DEBITED',
            direction: 'DEBIT',
            amount: Math.abs(pointsDelta),
            metadata: {
              domain_event: 'INVENTORY_TRANSFORM',
              from_item_id: body.fromItemId,
              to_item_id: body.toItemId,
              quantity: body.quantity,
            },
          });
        }

        await appendInventoryLedgerEvent(client, {
          userId,
          requestId,
          eventType: 'TRANSFORM',
          entityId: body.fromItemId,
          deltaPoints: pointsDelta,
          deltaItems: -body.quantity,
          payload: {
            transformedTo: body.toItemId,
            scope,
            parkId: normalizedParkId,
            pointsDelta,
            fromPointsValue,
            toPointsValue,
          },
        });

        await appendInventoryLedgerEvent(client, {
          userId,
          requestId: `${requestId}:result`,
          eventType: 'TRANSFORM',
          entityId: body.toItemId,
          deltaPoints: 0,
          deltaItems: body.quantity,
          payload: {
            transformedFrom: body.fromItemId,
            scope,
            parkId: normalizedParkId,
            pointsDelta,
            fromPointsValue,
            toPointsValue,
          },
        });

        return {
          requestId,
          userId,
          fromItemId: body.fromItemId,
          toItemId: body.toItemId,
          quantity: body.quantity,
          scope,
          parkId: normalizedParkId,
          pointsDelta,
          fromPointsValue,
          toPointsValue,
          valuationMode: Number.isFinite(body.pointsDelta) ? 'explicit' : 'catalog',
        };
      });

      return res.status(201).json(payload);
    } catch (error) {
      const message = mapDbError(error, 'Error en transformacion de item');
      if (message.includes('insuficiente') || message.includes('origen')) {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  return router;
}