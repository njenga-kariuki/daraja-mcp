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
import { preflightSchema, handlePreflight } from './tools/preflight.js';
import { testSandboxSchema, handleTestSandbox } from './tools/test-sandbox.js';
import { getLlmsTxt } from './knowledge.js';
import { sanitize, sanitizeText } from './sanitize.js';

export interface AuthContext {
  consumerKey: string;
  consumerSecret: string;
}

// ── Tool annotations ──────────────────────────────────────────────────────
// The support tier ships 5 tools, organised as two tiers:
//   Core (offline, no creds):     explain, diagnose, validate
//   Verify (sandbox-only):        preflight, test_sandbox
//
// Core tools carry readOnlyHint + idempotentHint — pure functions of inputs.
// test_sandbox is destructive (makes real sandbox API calls) and MCP clients
// auto-prompt for confirmation before invocation.

const TOOL_ANNOTATIONS: Record<
  string,
  { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean }
> = {
  daraja_explain: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  daraja_diagnose: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  daraja_validate: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  daraja_preflight: { readOnlyHint: false, destructiveHint: false },
  daraja_test_sandbox: { readOnlyHint: false, destructiveHint: true },
};

const TOOLS = [
  explainSchema,
  diagnoseSchema,
  validateSchema,
  preflightSchema,
  testSandboxSchema,
];

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
    tier: 'support',
    ...(errorMessage ? { error: sanitizeText(errorMessage) } : {}),
  };
  process.stderr.write(JSON.stringify(entry) + '\n');
}

export function createServer(authContext?: AuthContext): Server {
  const server = new Server(
    { name: '@daraja-mcp/support', version: '0.0.1-beta.1' },
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
          result = handleExplain(args as Parameters<typeof handleExplain>[0]);
          break;
        case 'daraja_diagnose':
          result = handleDiagnose(args as Parameters<typeof handleDiagnose>[0]);
          break;
        case 'daraja_validate':
          result = handleValidate(args as Parameters<typeof handleValidate>[0]);
          break;
        case 'daraja_preflight':
          result = await handlePreflight(args as Parameters<typeof handlePreflight>[0]);
          break;
        case 'daraja_test_sandbox':
          result = await handleTestSandbox(
            args as Parameters<typeof handleTestSandbox>[0],
            authContext,
          );
          break;
        default:
          return {
            content: [
              {
                type: 'text',
                text:
                  `Unknown tool: ${name}. The support tier ships five tools: ` +
                  `daraja_diagnose, daraja_explain, daraja_validate, daraja_preflight, daraja_test_sandbox. ` +
                  `For scaffolding, setup, or go-live checklists, see @daraja-kit/mcp (the full agent toolkit).`,
              },
            ],
            isError: true,
          };
      }

      emitAudit(name, args, 'success', Date.now() - startTime);
      const sanitizedOutput = sanitizeText(JSON.stringify(result, null, 2));
      return { content: [{ type: 'text', text: sanitizedOutput }] };
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
        description:
          'Complete index of M-Pesa/Daraja documentation — 20+ error codes, decision trees, concept deep-dives, patterns.',
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
