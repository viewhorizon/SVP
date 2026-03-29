import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { Pool } from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { registerApiRoutes } from './routes';
import { startOutboxWorker } from './services/outboxWorker';

const app = express();
app.set('trust proxy', true);

app.use((req: Request, res: Response, next: NextFunction) => {
  const incomingRequestId = String(req.header('x-request-id') ?? '').trim();
  const requestId = incomingRequestId || randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    // Log estructurado minimo para observabilidad y trazabilidad de requestId.
    // eslint-disable-next-line no-console
    console.info(
      JSON.stringify({
        level: 'info',
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      })
    );
  });

  next();
});

app.use(
  express.json({
    verify: (req, _res, buffer) => {
      (req as Request).rawBody = Buffer.from(buffer);
    },
  })
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

registerApiRoutes(app, pool);
startOutboxWorker(pool);

const openApiPath = path.resolve(process.cwd(), 'backend/openapi.yaml');
if (fs.existsSync(openApiPath)) {
  const openApiDocument = YAML.load(openApiPath);
  app.get('/openapi.yaml', (_req, res) => {
    res.type('text/yaml').send(fs.readFileSync(openApiPath, 'utf8'));
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'spv-api' });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`SPV API running on port ${port}`);
});