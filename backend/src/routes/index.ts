import type { Express } from 'express';
import type { Pool } from 'pg';
import { createVotesRouter } from './votes.routes';
import { createPointsRouter } from './points.routes';
import { createAiPlanningRouter } from './aiPlanning.routes';
import { createInventoryRouter } from './inventory.routes';
import { createEventsRouter } from './events.routes';
import { createAchievementsRouter } from './achievements.routes';
import { createOutboxRouter } from './outbox.routes';
import { createPolicyRouter } from './policy.routes';
import { createMonitorRouter } from './monitor.routes';

export function registerApiRoutes(app: Express, pool: Pool) {
  const routeFactories = [
    () => createVotesRouter({ pool }),
    () => createPointsRouter({ pool }),
    () => createInventoryRouter({ pool }),
    () => createEventsRouter({ pool }),
    () => createAchievementsRouter({ pool }),
    () => createOutboxRouter({ pool }),
    () => createPolicyRouter({ pool }),
    () => createMonitorRouter({ pool }),
    () => createAiPlanningRouter(),
  ];

  // Keep /api for compatibility and expose /api/v1 as a stable integration contract.
  ['/api', '/api/v1'].forEach((prefix) => {
    routeFactories.forEach((factory) => {
      app.use(prefix, factory());
    });
  });
}