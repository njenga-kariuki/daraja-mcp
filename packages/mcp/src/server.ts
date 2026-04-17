import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { explainSchema, handleExplain } from './tools/explain.js';
import { diagnoseSchema, handleDiagnose } from './tools/diagnose.js';
import { validateSchema, handleValidate } from './tools/validate.js';
import { scaffoldSchema, handleScaffold } from './tools/scaffold.js';
import { testSandboxSchema, handleTestSandbox } from './tools/test-sandbox.js';
import { goLiveSchema, handleGoLive } from './tools/go-live.js';
import { setupSchema, handleSetup } from './tools/setup.js';
import { preflightSchema, handlePreflight } from './tools/preflight.js';
import { feedbackSchema, handleFeedback } from './tools/feedback.js';
import { getLlmsTxt, searchKnowledge } from './knowledge.js';
import { sanitize, sanitizeText } from './sanitize.js';

export interface AuthContext {
  consumerKey: string;
  consumerSecret: string;
}

// ── Tool annotations (MCP spec: readOnlyHint, destructiveHint) ──────────
// MCP-compliant clients auto-prompt for confirmation on destructive tools.

const TOOL_ANNOTATIONS: Record<string, { readOnlyHint?: boolean; destructiveHint?: boolean }> = {
  daraja_explain:      { readOnlyHint: true,  destructiveHint: false },
  daraja_diagnose:     { readOnlyHint: true,  destructiveHint: false },
  daraja_validate:     { readOnlyHint: true,  destructiveHint: false },
  daraja_scaffold:     { readOnlyHint: false, destructiveHint: false },
  daraja_setup:        { readOnlyHint: false, destructiveHint: false },
  daraja_test_sandbox: { readOnlyHint: false, destructiveHint: true  },
  daraja_go_live:      { readOnlyHint: true,  destructiveHint: false },
  daraja_preflight:    { readOnlyHint: false, destructiveHint: false },
  daraja_feedback:     { readOnlyHint: true,  destructiveHint: false },
};

const TOOLS = [explainSchema, diagnoseSchema, validateSchema, scaffoldSchema, testSandboxSchema, goLiveSchema, setupSchema, preflightSchema, feedbackSchema];

/** Emit structured audit log to stderr (MCP convention: stdout = protocol, stderr = logging). */
function emitAudit(
  tool: string,
  args: unknown,
  status: 'success' | 'error',
  durationMs: number,
  errorMessage?: string,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    tool,
    args: sanitize(args),
    status,
    duration_ms: durationMs,
    ...(errorMessage ? { error: sanitizeText(errorMessage) } : {}),
  };
  process.stderr.write(JSON.stringify(entry) + '\n');
}

export function createServer(authContext?: AuthContext): Server {
  const server = new Server(
    { name: 'daraja-mcp', version: '0.1.0' },
    { capabilities: { tools: {}, resources: {} } },
  );

  // ── List Tools ──────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: TOOL_ANNOTATIONS[t.name] ?? {},
    })),
  }));

  // ── Call Tool ───────────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (name) {
        case 'daraja_explain':
          result = handleExplain(args as any);
          break;
        case 'daraja_diagnose':
          result = handleDiagnose(args as any);
          break;
        case 'daraja_validate':
          result = handleValidate(args as any);
          break;
        case 'daraja_scaffold':
          result = handleScaffold(args as any);
          break;
        case 'daraja_test_sandbox':
          result = await handleTestSandbox(args as any, authContext);
          break;
        case 'daraja_go_live':
          result = handleGoLive(args as any);
          break;
        case 'daraja_setup':
          result = await handleSetup(args as any);
          break;
        case 'daraja_preflight':
          result = await handlePreflight(args as any);
          break;
        case 'daraja_feedback':
          result = handleFeedback(args as any);
          break;
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      // ── Audit trail (structured JSON to stderr) ──────────────────────
      emitAudit(name, args, 'success', Date.now() - startTime);

      // ── PII sanitization (mask phone numbers before returning to agent)
      const sanitizedOutput = sanitizeText(JSON.stringify(result, null, 2));

      return {
        content: [{ type: 'text', text: sanitizedOutput }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      emitAudit(name, args, 'error', Date.now() - startTime, message);
      return {
        content: [{ type: 'text', text: `Error: ${sanitizeText(message)}` }],
        isError: true,
      };
    }
  });

  // ── Resources (knowledge base) ─────────────────────────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'daraja://knowledge/llms.txt',
        name: 'Daraja Knowledge Base Index',
        description: 'Complete index of M-Pesa/Daraja documentation for AI agents',
        mimeType: 'text/markdown',
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri === 'daraja://knowledge/llms.txt') {
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'text/markdown',
            text: getLlmsTxt(),
          },
        ],
      };
    }
    throw new Error(`Unknown resource: ${request.params.uri}`);
  });

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
