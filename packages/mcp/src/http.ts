#!/usr/bin/env node
/**
 * Hosted HTTP entry point for daraja-kit MCP server.
 *
 * Deploy this to Railway/Render/Fly.io and point Lovable/Replit to the URL.
 * Uses stateful Streamable HTTP with session management.
 */
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createServer } from './server.js';
import { handleScaffold } from './tools/scaffold.js';
import { handleValidate } from './tools/validate.js';
import { handleDiagnose } from './tools/diagnose.js';
import { handleExplain } from './tools/explain.js';
import { handleGoLive } from './tools/go-live.js';
import { handleTestSandbox } from './tools/test-sandbox.js';
import { handlePreflight } from './tools/preflight.js';
import { handleSetup } from './tools/setup.js';
import { handleFeedback } from './tools/feedback.js';
import { appendFeedback, listFeedback } from './feedback-store.js';
import { getLlmsTxt } from './knowledge.js';
import { skillsRouter } from './skills/index.js';
import { DarajaOAuthProvider } from './auth/provider.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';

const app = express();

app.use(cors());
app.use(express.json());

// ── OAuth 2.1 authentication (enabled via DARAJA_MCP_AUTH=true) ─────────────
const authEnabled = process.env.DARAJA_MCP_AUTH === 'true';
const oauthProvider = new DarajaOAuthProvider();
const baseUrl = process.env.DARAJA_MCP_BASE_URL || `http://localhost:${Number(process.env.PORT) || 8080}`;

if (authEnabled) {
  app.use(mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: new URL(baseUrl),
    serviceDocumentationUrl: new URL('https://developer.safaricom.co.ke'),
    scopesSupported: ['mcp:tools'],
  }));
}

// Bearer auth middleware — only applied to /mcp endpoints when auth is enabled
const mcpAuth = authEnabled
  ? requireBearerAuth({ verifier: oauthProvider })
  : ((_req: any, _res: any, next: any) => next());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'daraja-kit-mcp', version: '0.1.0' });
});

// ── llms.txt — machine-readable documentation for AI agents ─────────────────
const knowledgeDir = path.resolve(process.cwd(), 'knowledge');

app.get('/llms.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8').send(getLlmsTxt());
});

app.get('/llms-full.txt', (_req, res) => {
  const filePath = path.join(knowledgeDir, 'llms-full.txt');
  if (!fs.existsSync(filePath)) {
    res.status(404).send('llms-full.txt not found');
    return;
  }
  res.type('text/plain; charset=utf-8').send(fs.readFileSync(filePath, 'utf-8'));
});

// ── Agent Skills — installable best-practice instructions ───────────────────
app.use('/.well-known/skills', skillsRouter());

// ── Demo page + tool API routes ──────────────────────────────────────────────
const demoDir = path.resolve(process.cwd(), 'demo');
app.use(express.static(demoDir));

app.post('/api/tools/scaffold', (req, res) => {
  try { res.json(handleScaffold(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/tools/validate', (req, res) => {
  try { res.json(handleValidate(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/tools/diagnose', (req, res) => {
  try { res.json(handleDiagnose(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/tools/explain', (req, res) => {
  try { res.json(handleExplain(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/tools/go-live', (req, res) => {
  try { res.json(handleGoLive(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/tools/preflight', async (req, res) => {
  try { res.json(await handlePreflight(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/tools/setup', async (req, res) => {
  try { res.json(await handleSetup(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/live/test', async (req, res) => {
  try { res.json(await handleTestSandbox(req.body)); }
  catch (err: any) {
    res.json({ success: false, response: { error: err.message, suggestion: err.suggestion ?? 'Check credentials and try again.' }, duration_ms: 0 });
  }
});

// ── Feedback: public submission + token-gated admin read ────────────────────
app.post('/api/tools/feedback', (req, res) => {
  try { res.json(handleFeedback(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});

app.post('/api/feedback', (req, res) => {
  try {
    const { category, message, context } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }
    const entry = appendFeedback({
      category: category ?? 'other',
      message,
      context,
      source: 'http',
    });
    res.json({ ok: true, reference: entry.reference });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

function adminAuthOk(req: express.Request): boolean {
  const expected = process.env.DARAJA_ADMIN_TOKEN;
  if (!expected) return false;
  const header = req.header('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : undefined;
  const query = typeof req.query.token === 'string' ? req.query.token : undefined;
  const provided = bearer ?? query;
  return Boolean(provided) && provided === expected;
}

app.get('/admin/feedback', (req, res) => {
  if (!adminAuthOk(req)) {
    res.status(401).json({ error: 'Unauthorized. Provide DARAJA_ADMIN_TOKEN as Bearer token or ?token= query param.' });
    return;
  }
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  res.json({ count: listFeedback(limit).length, entries: listFeedback(limit) });
});

// MCP server info (JSON fallback for non-browser clients)
app.get('/mcp-info', (_req, res) => {
  res.json({
    name: 'daraja-kit MCP Server',
    description: 'M-Pesa integration agent — scaffold, validate, diagnose, explain, test, and go live.',
    mcp_endpoint: '/mcp',
    tools: [
      'daraja_explain', 'daraja_scaffold', 'daraja_validate',
      'daraja_diagnose', 'daraja_test_sandbox', 'daraja_go_live', 'daraja_setup', 'daraja_preflight',
      'daraja_feedback',
    ],
  });
});

// Session store: transport + server per session, with TTL cleanup
const sessions = new Map<string, {
  transport: StreamableHTTPServerTransport;
  server: Server;
  lastActivity: number;
}>();

// Clean up stale sessions every 5 minutes
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      session.transport.close();
      session.server.close();
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

app.post('/mcp', mcpAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    // Existing session
    const session = sessions.get(sessionId)!;
    session.lastActivity = Date.now();
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  if (sessionId && !sessions.has(sessionId)) {
    res.status(404).json({ error: 'Session not found or expired', jsonrpc: '2.0' });
    return;
  }

  // New session (no session ID header) — must be an initialize request
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createServer();
  await server.connect(transport);

  // handleRequest sets the session ID and sends it in response headers
  await transport.handleRequest(req, res, req.body);

  // Store session AFTER handleRequest so sessionId is populated
  const newSessionId = transport.sessionId;
  if (newSessionId) {
    sessions.set(newSessionId, { transport, server, lastActivity: Date.now() });
  }
});

// GET for SSE streaming (optional, used for server-initiated notifications)
app.get('/mcp', mcpAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: 'Missing or invalid mcp-session-id', jsonrpc: '2.0' });
    return;
  }
  const session = sessions.get(sessionId)!;
  session.lastActivity = Date.now();
  await session.transport.handleRequest(req, res);
});

// DELETE to close a session
app.delete('/mcp', mcpAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(404).json({ error: 'Session not found', jsonrpc: '2.0' });
    return;
  }
  const session = sessions.get(sessionId)!;
  await session.transport.close();
  await session.server.close();
  sessions.delete(sessionId);
  res.status(200).json({ ok: true });
});

const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`daraja-kit MCP server (HTTP) listening on http://0.0.0.0:${PORT}`);
  console.log(`MCP endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.log(`Auth: ${authEnabled ? 'OAuth 2.1 enabled' : 'disabled (set DARAJA_MCP_AUTH=true to enable)'}`);
  console.log(`llms.txt: http://0.0.0.0:${PORT}/llms.txt`);
  console.log(`Skills: http://0.0.0.0:${PORT}/.well-known/skills/index.json`);
});
