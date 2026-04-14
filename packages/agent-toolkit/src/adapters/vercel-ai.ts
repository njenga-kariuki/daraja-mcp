/**
 * Vercel AI SDK adapter for the Daraja Agent Toolkit.
 *
 * ```typescript
 * import { DarajaVercelAIToolkit } from '@daraja-kit/agent-toolkit/vercel-ai';
 * import { generateText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 *
 * const toolkit = new DarajaVercelAIToolkit({
 *   consumerKey: process.env.DARAJA_CONSUMER_KEY,
 *   consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
 * });
 *
 * const { text } = await generateText({
 *   model: openai('gpt-4o'),
 *   tools: toolkit.getTools(),
 *   prompt: 'Collect KES 100 from 0712345678',
 * });
 * ```
 */
import { DarajaAgentToolkit, type DarajaToolkitConfig } from '../core.js';
import type { ToolDefinition } from '../tool-definitions.js';

/**
 * Vercel AI SDK tool format.
 * Matches the shape expected by `generateText({ tools: ... })`.
 */
export interface VercelAITool {
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export class DarajaVercelAIToolkit extends DarajaAgentToolkit {
  constructor(config: DarajaToolkitConfig = {}) {
    super(config);
  }

  /**
   * Get tools in Vercel AI SDK format.
   *
   * Returns a record of `{ toolName: toolDefinition }` compatible
   * with `generateText({ tools: toolkit.getTools() })`.
   */
  getTools(): Record<string, VercelAITool> {
    const tools: Record<string, VercelAITool> = {};

    for (const tool of this.getToolDefinitions()) {
      const params = tool.parameters as {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
      };

      tools[tool.name] = {
        description: tool.description,
        parameters: {
          type: 'object',
          properties: params.properties,
          required: params.required,
        },
        execute: tool.execute,
      };
    }

    return tools;
  }
}

export { type DarajaToolkitConfig } from '../core.js';
