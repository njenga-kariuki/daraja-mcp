/**
 * LangChain adapter for the Daraja Agent Toolkit.
 *
 * ```typescript
 * import { DarajaLangChainToolkit } from '@daraja-kit/agent-toolkit/langchain';
 * import { ChatOpenAI } from '@langchain/openai';
 * import { createReactAgent } from '@langchain/langgraph/prebuilt';
 *
 * const toolkit = new DarajaLangChainToolkit({
 *   consumerKey: process.env.DARAJA_CONSUMER_KEY,
 *   consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
 * });
 *
 * const agent = createReactAgent({
 *   llm: new ChatOpenAI({ model: 'gpt-4o' }),
 *   tools: toolkit.getTools(),
 * });
 * ```
 */
import { DarajaAgentToolkit, type DarajaToolkitConfig } from '../core.js';

/**
 * Minimal interface matching LangChain's StructuredToolInterface.
 * This avoids a hard dependency on @langchain/core at compile time.
 */
export interface LangChainTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  invoke: (input: Record<string, unknown>) => Promise<string>;
}

export class DarajaLangChainToolkit extends DarajaAgentToolkit {
  constructor(config: DarajaToolkitConfig = {}) {
    super(config);
  }

  /**
   * Get tools as LangChain-compatible structured tools.
   *
   * Each tool has a `name`, `description`, `schema` (JSON Schema),
   * and an `invoke` method that returns a JSON string.
   */
  getTools(): LangChainTool[] {
    return this.getToolDefinitions().map((tool) => ({
      name: tool.name,
      description: tool.description,
      schema: tool.parameters,
      invoke: async (input: Record<string, unknown>) => {
        const result = await tool.execute(input);
        return JSON.stringify(result);
      },
    }));
  }
}

export { type DarajaToolkitConfig } from '../core.js';
