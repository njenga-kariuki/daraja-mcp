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
import { getLlmsTxt, searchKnowledge } from './knowledge.js';

export interface AuthContext {
  consumerKey: string;
  consumerSecret: string;
}

const TOOLS = [explainSchema, diagnoseSchema, validateSchema, scaffoldSchema, testSandboxSchema, goLiveSchema, setupSchema, preflightSchema];

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
    })),
  }));

  // ── Call Tool ───────────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

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
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
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
