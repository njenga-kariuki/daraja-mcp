/**
 * @daraja-kit/agent-toolkit
 *
 * Multi-framework agent toolkit for M-Pesa Daraja integration.
 *
 * Usage with framework adapters:
 *
 * ```typescript
 * // OpenAI Agents SDK
 * import { DarajaOpenAIToolkit } from '@daraja-kit/agent-toolkit/openai';
 *
 * // LangChain
 * import { DarajaLangChainToolkit } from '@daraja-kit/agent-toolkit/langchain';
 *
 * // Vercel AI SDK
 * import { DarajaVercelAIToolkit } from '@daraja-kit/agent-toolkit/vercel-ai';
 * ```
 */
export { DarajaAgentToolkit, type DarajaToolkitConfig } from './core.js';
export { TOOL_SCHEMAS, TOOL_NAMES, type ToolDefinition, type ToolName } from './tool-definitions.js';
