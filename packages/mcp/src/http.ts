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

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'daraja-kit-mcp', version: '0.1.0' });
});

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

// MCP server info (JSON fallback for non-browser clients)
app.get('/mcp-info', (_req, res) => {
  res.json({
    name: 'daraja-kit MCP Server',
    description: 'M-Pesa integration agent — scaffold, validate, diagnose, explain, test, and go live.',
    mcp_endpoint: '/mcp',
    tools: [
      'daraja_explain', 'daraja_scaffold', 'daraja_validate',
      'daraja_diagnose', 'daraja_test_sandbox', 'daraja_go_live', 'daraja_setup', 'daraja_preflight',
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

app.post('/mcp', async (req, res) => {
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
app.get('/mcp', async (req, res) => {
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
app.delete('/mcp', async (req, res) => {
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
});
