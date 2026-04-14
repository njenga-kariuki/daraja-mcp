/**
 * OpenAI Agents SDK adapter for the Daraja Agent Toolkit.
 *
 * ```typescript
 * import { DarajaOpenAIToolkit } from '@daraja-kit/agent-toolkit/openai';
 * import OpenAI from 'openai';
 *
 * const toolkit = new DarajaOpenAIToolkit({
 *   consumerKey: process.env.DARAJA_CONSUMER_KEY,
 *   consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
 * });
 *
 * const openai = new OpenAI();
 * const response = await openai.responses.create({
 *   model: 'gpt-4o',
 *   tools: toolkit.getTools(),
 *   input: 'Collect KES 100 from 0712345678',
 * });
 * ```
 */
import { DarajaAgentToolkit, type DarajaToolkitConfig } from '../core.js';
import type { ToolDefinition } from '../tool-definitions.js';

/** OpenAI function tool format. */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Map of tool name → executor for handling tool calls. */
export type ToolExecutors = Record<string, (args: Record<string, unknown>) => Promise<unknown>>;

export class DarajaOpenAIToolkit extends DarajaAgentToolkit {
  constructor(config: DarajaToolkitConfig = {}) {
    super(config);
  }

  /** Get tools in OpenAI function-calling format. */
  getTools(): OpenAITool[] {
    return this.getToolDefinitions().map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /** Get a map of tool name → executor for handling tool call responses. */
  getToolExecutors(): ToolExecutors {
    const executors: ToolExecutors = {};
    for (const tool of this.getToolDefinitions()) {
      executors[tool.name] = tool.execute;
    }
    return executors;
  }

  /**
   * Execute a tool call from an OpenAI response.
   *
   * ```typescript
   * const result = await toolkit.handleToolCall(
   *   toolCall.function.name,
   *   JSON.parse(toolCall.function.arguments),
   * );
   * ```
   */
  async handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
    const executors = this.getToolExecutors();
    const executor = executors[name];
    if (!executor) {
      throw new Error(`Unknown tool: ${name}. Available: ${Object.keys(executors).join(', ')}`);
    }
    return executor(args);
  }
}

export { type DarajaToolkitConfig } from '../core.js';
