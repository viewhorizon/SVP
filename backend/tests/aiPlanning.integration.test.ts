import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAiPlanningRouter } from '../src/routes/aiPlanning.routes';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', createAiPlanningRouter());
  return app;
}

describe('AI Planning API integration', () => {
  it('analyzes explicit task list and returns SMART/FODA structure', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/api/ai/planning/analyze')
      .set('Content-Type', 'application/json')
      .send({
        tasks: [
          {
            title: 'Fortaleza tecnica del backend',
            description: 'Implementar validacion y observabilidad en 4h',
            category: 'backend',
            estimated: '4h',
            priority: 'high',
          },
          {
            title: 'Debilidad de cobertura de pruebas',
            description: 'Agregar pruebas de integracion en 3h',
            category: 'testing',
            estimated: '3h',
            priority: 'medium',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.smart).toBeTruthy();
    expect(response.body.foda).toBeTruthy();
    expect(Array.isArray(response.body.suggestions)).toBe(true);
    expect(response.body.smart.coverage).toBeGreaterThan(0);
  });

  it('builds task suggestions from uploaded document text', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/api/ai/planning/analyze')
      .set('Content-Type', 'application/json')
      .send({
        document: [
          '- Definir contrato API para conversion SPV y LiveOps',
          '- Implementar endpoint para compra de items globales',
          '- Preparar pruebas de webhook con firma HMAC',
        ].join('\n'),
      });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.backlog)).toBe(true);
    expect(Array.isArray(response.body.sprintlog)).toBe(true);
    expect((response.body.backlog?.length ?? 0) + (response.body.sprintlog?.length ?? 0)).toBeGreaterThan(0);
  });
});