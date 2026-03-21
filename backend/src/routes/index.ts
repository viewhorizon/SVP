import type { Express } from 'express';
import type { Pool } from 'pg';
import { createVotesRouter } from './votes.routes';
import { createPointsRouter } from './points.routes';

export function registerApiRoutes(app: Express, pool: Pool) {
  app.use('/api', createVotesRouter({ pool }));
  app.use('/api', createPointsRouter({ pool }));
}
