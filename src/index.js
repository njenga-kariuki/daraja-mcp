import express from 'express';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import apiRouter from './routes/api.js';
import callbackRouter, { getRecentEvents } from './routes/callbacks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/healthz', (_req, res) =>
  res.json({ ok: true, env: config.env, baseUrl: config.baseUrl }),
);

app.get('/events', (_req, res) => res.json(getRecentEvents()));

app.use('/api', apiRouter);
app.use('/callbacks', callbackRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, _req, res, _next) => {
  logger.error('Unhandled', err);
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(config.port, () => {
  logger.info(`Daraja POC listening on http://localhost:${config.port}`);
  logger.info(`Environment: ${config.env}  (${config.baseUrl})`);
  logger.info(`Public callback base: ${config.publicBaseUrl}`);
});
