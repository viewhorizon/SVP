import { createHmac } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createVotesRouter } from '../src/routes/votes.routes';
import { createPointsRouter } from '../src/routes/points.routes';
import { createFakeSpvPool } from './helpers/fakeSpvPool';
import { clearWebhookReplayGuardForTests } from '../src/services/webhookReplayGuard';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const ACTIVITY_A = '33333333-3333-3333-3333-333333333333';

function createTestApp() {
  const app = express();
  app.use(express.json());

  const fakePool = createFakeSpvPool() as unknown as Pool;
  app.use('/api', createVotesRouter({ pool: fakePool }));
  app.use('/api', createPointsRouter({ pool: fakePool }));

  return app;
}

describe('SPV API integration', () => {
  beforeEach(() => {
    clearWebhookReplayGuardForTests();
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SIGNING_SECRET;
    delete process.env.WEBHOOK_HMAC_TOLERANCE_SECONDS;
  });

  it('test-03: vote endpoint updates points balance and daily count', async () => {
    const app = createTestApp();

    const voteResponse = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer dev:${USER_A}`)
      .send({ activityId: ACTIVITY_A, activityScope: 'local', requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });

    expect(voteResponse.status).toBe(201);
    expect(voteResponse.body.pointsGranted).toBeGreaterThan(0);

    const balanceResponse = await request(app)
      .get('/api/points/balance')
      .set('Authorization', `Bearer dev:${USER_A}`);

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.available).toBe(voteResponse.body.balance.availablePoints);
    expect(balanceResponse.body.available).toBe(voteResponse.body.pointsGranted);

    const countResponse = await request(app)
      .get('/api/votes/count')
      .set('Authorization', `Bearer dev:${USER_A}`)
      .query({ activityId: ACTIVITY_A });

    expect(countResponse.status).toBe(200);
    expect(countResponse.body.votesToday).toBe(1);
  });

  it('test-04: e2e vote -> transfer -> balances', async () => {
    const app = createTestApp();

    const voteResponse = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer dev:${USER_A}`)
      .send({ activityId: ACTIVITY_A, activityScope: 'local', requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });

    expect(voteResponse.status).toBe(201);

    const transferResponse = await request(app)
      .post('/api/points/transfer')
      .set('Authorization', `Bearer dev:${USER_A}`)
      .send({ toUserId: USER_B, amount: 2, requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });

    expect(transferResponse.status).toBe(201);
    expect(transferResponse.body.amount).toBe(2);

    const fromBalanceResponse = await request(app)
      .get('/api/points/balance')
      .set('Authorization', `Bearer dev:${USER_A}`);

    const toBalanceResponse = await request(app)
      .get(`/api/points/balance/${USER_B}`)
      .set('Authorization', `Bearer dev:${USER_A}`);

    expect(fromBalanceResponse.status).toBe(200);
    expect(toBalanceResponse.status).toBe(200);
    expect(fromBalanceResponse.body.available).toBe(voteResponse.body.pointsGranted - 2);
    expect(toBalanceResponse.body.available).toBe(2);
  });

  it('idempotency: same requestId on credit does not duplicate balance changes', async () => {
    const app = createTestApp();

    const firstResponse = await request(app)
      .post('/api/points/credit')
      .set('Authorization', `Bearer dev:${USER_A}`)
      .set('Idempotency-Key', 'credit-demo-001')
      .send({ amount: 7 });

    const replayResponse = await request(app)
      .post('/api/points/credit')
      .set('Authorization', `Bearer dev:${USER_A}`)
      .set('Idempotency-Key', 'credit-demo-001')
      .send({ amount: 7 });

    const balanceResponse = await request(app)
      .get('/api/points/balance')
      .set('Authorization', `Bearer dev:${USER_A}`);

    expect(firstResponse.status).toBe(201);
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.body.idempotent).toBe(true);
    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.available).toBe(7);
  });

  it('concurrency: parallel debits cannot overdraw wallet', async () => {
    const app = createTestApp();

    const creditResponse = await request(app)
      .post('/api/points/credit')
      .set('Authorization', `Bearer dev:${USER_A}`)
      .send({ amount: 5, requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });

    expect(creditResponse.status).toBe(201);

    const [debitA, debitB] = await Promise.all([
      request(app)
        .post('/api/points/debit')
        .set('Authorization', `Bearer dev:${USER_A}`)
        .send({ amount: 4, requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }),
      request(app)
        .post('/api/points/debit')
        .set('Authorization', `Bearer dev:${USER_A}`)
        .send({ amount: 4, requestId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }),
    ]);

    const statusSet = [debitA.status, debitB.status].sort();
    expect(statusSet).toEqual([201, 409]);

    const balanceResponse = await request(app)
      .get('/api/points/balance')
      .set('Authorization', `Bearer dev:${USER_A}`);

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.available).toBe(1);
  });

  it('webhook HMAC: rejects invalid signature and accepts valid signature', async () => {
    const app = createTestApp();
    process.env.WEBHOOK_SIGNING_SECRET = 'test-signing-secret';

    const payload = {
      userId: USER_A,
      amount: 9,
      sourceSystem: 'liveops',
      requestId: '99999999-9999-4999-8999-999999999999',
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));

    const invalidResponse = await request(app)
      .post('/api/webhooks/points/credit')
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', 'sha256=invalid')
      .send(payload);

    expect(invalidResponse.status).toBe(401);

    const signature = createHmac('sha256', process.env.WEBHOOK_SIGNING_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const validResponse = await request(app)
      .post('/api/webhooks/points/credit')
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', `sha256=${signature}`)
      .send(payload);

    expect(validResponse.status).toBe(201);
    expect(validResponse.body.idempotent).toBe(false);

    const balanceResponse = await request(app)
      .get('/api/points/balance')
      .set('Authorization', `Bearer dev:${USER_A}`);

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.available).toBe(9);
  });

  it('webhook HMAC: rejects replayed signed payload', async () => {
    const app = createTestApp();
    process.env.WEBHOOK_SIGNING_SECRET = 'test-signing-secret';

    const payload = {
      userId: USER_A,
      amount: 4,
      sourceSystem: 'liveops',
      eventId: 'eeee1111-1111-4111-8111-111111111111',
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', process.env.WEBHOOK_SIGNING_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const firstResponse = await request(app)
      .post('/api/webhooks/points/credit')
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', `sha256=${signature}`)
      .send(payload);

    const replayResponse = await request(app)
      .post('/api/webhooks/points/credit')
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', `sha256=${signature}`)
      .send(payload);

    expect(firstResponse.status).toBe(201);
    expect(replayResponse.status).toBe(409);
  });

  it('webhook HMAC: rejects outdated timestamp', async () => {
    const app = createTestApp();
    process.env.WEBHOOK_SIGNING_SECRET = 'test-signing-secret';
    process.env.WEBHOOK_HMAC_TOLERANCE_SECONDS = '5';

    const payload = {
      userId: USER_A,
      amount: 3,
      sourceSystem: 'liveops',
      requestId: 'aaaa9999-9999-4999-8999-999999999999',
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000) - 60);
    const signature = createHmac('sha256', process.env.WEBHOOK_SIGNING_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await request(app)
      .post('/api/webhooks/points/credit')
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', `sha256=${signature}`)
      .send(payload);

    expect(response.status).toBe(401);
  });
});