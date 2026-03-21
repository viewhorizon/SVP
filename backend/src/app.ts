import express from 'express';
import { Pool } from 'pg';
import { registerApiRoutes } from './routes';

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

registerApiRoutes(app, pool);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'spv-api' });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`SPV API running on port ${port}`);
});
