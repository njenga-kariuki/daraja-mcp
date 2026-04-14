import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleScaffold } from '../packages/mcp/src/tools/scaffold.js';
import { handleValidate } from '../packages/mcp/src/tools/validate.js';
import { handleDiagnose } from '../packages/mcp/src/tools/diagnose.js';
import { handleExplain } from '../packages/mcp/src/tools/explain.js';
import { handleGoLive } from '../packages/mcp/src/tools/go-live.js';
import { handlePreflight } from '../packages/mcp/src/tools/preflight.js';
import { handleSetup } from '../packages/mcp/src/tools/setup.js';
import { handleTestSandbox } from '../packages/mcp/src/tools/test-sandbox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ── MCP Tool Endpoints (local, no network needed) ─────────────────────────

app.post('/api/tools/scaffold', (req, res) => {
  try {
    const result = handleScaffold(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tools/validate', (req, res) => {
  try {
    const result = handleValidate(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tools/diagnose', (req, res) => {
  try {
    const result = handleDiagnose(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tools/explain', (req, res) => {
  try {
    const result = handleExplain(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tools/go-live', (req, res) => {
  try {
    const result = handleGoLive(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tools/preflight', async (req, res) => {
  try {
    const result = await handlePreflight(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tools/setup', async (req, res) => {
  try {
    const result = await handleSetup(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── Live Sandbox Endpoint (hits real Daraja APIs) ──────────────────────────

app.post('/api/live/test', async (req, res) => {
  try {
    const result = await handleTestSandbox(req.body);
    res.json(result);
  } catch (err: any) {
    res.json({
      success: false,
      response: { error: err.message, suggestion: err.suggestion ?? 'Check credentials and try again.' },
      duration_ms: 0,
    });
  }
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`\n  daraja-kit demo → http://localhost:${PORT}\n`);
  if (!process.env.DARAJA_CONSUMER_KEY) {
    console.log('  ⚠ DARAJA_CONSUMER_KEY not set — live sandbox tests will fail');
    console.log('  Set credentials: export DARAJA_CONSUMER_KEY=... DARAJA_CONSUMER_SECRET=...\n');
  }
});
