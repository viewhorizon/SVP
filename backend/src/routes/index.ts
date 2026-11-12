import type { Express } from 'express';
import type { Pool } from 'pg';
import { createVotesRouter } from './svp/votes.routes';
import { createPointsRouter } from './points.routes';
import { createAiPlanningRouter } from './aiPlanning.routes';
import { createInventoryRouter } from './inventory.routes';
import { createEventsRouter } from './events.routes';
import { createAchievementsRouter } from './achievements.routes';
import { createOutboxRouter } from './outbox.routes';
import { createPolicyRouter } from './policy.routes';
import { createMonitorRouter } from './monitor.routes';
// Sprint 3 routes
import { createDeadLetterRouter } from './deadLetter.routes';
import { createAlertsRouter } from './alerts.routes';
import { createLoadTestRouter } from './loadTest.routes';
import { createReconciliationRouter } from './reconciliation.routes';
// MVP routes
import { createSpvMvpRouter } from './spvMvp.routes';

export function registerApiRoutes(app: Express, pool: Pool) {
  const routeFactories = [
    () => createPointsRouter({ pool }),
    () => createInventoryRouter({ pool }),
    () => createEventsRouter({ pool }),
    () => createAchievementsRouter({ pool }),
    () => createOutboxRouter({ pool }),
    () => createPolicyRouter({ pool }),
    () => createMonitorRouter({ pool }),
    () => createAiPlanningRouter(),
    // Sprint 3
    () => createDeadLetterRouter({ pool }),
    () => createAlertsRouter({ pool }),
    () => createLoadTestRouter(),
    () => createReconciliationRouter({ pool }),
    // MVP
    () => createSpvMvpRouter({ pool }),
  ];

  // Non-vote APIs remain under /api and /api/v1.
  ['/api', '/api/v1'].forEach((prefix) => {
    routeFactories.forEach((factory) => {
      app.use(prefix, factory());
    });
  });

  // The canonical vote contract lives only under /api/svp/votes.
  ['/api/svp', '/api/v1/svp'].forEach((prefix) => {
    app.use(prefix, createVotesRouter({ pool }));
  });
}
