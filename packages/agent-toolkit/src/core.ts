/**
 * DarajaAgentToolkit — the framework-agnostic core.
 *
 * Wraps @daraja-kit/sdk into a unified interface that framework
 * adapters consume via getToolDefinitions().
 *
 * ```typescript
 * import { DarajaAgentToolkit } from '@daraja-kit/agent-toolkit';
 *
 * const toolkit = new DarajaAgentToolkit({
 *   consumerKey: process.env.DARAJA_CONSUMER_KEY,
 *   consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
 * });
 *
 * const tools = toolkit.getToolDefinitions();
 * ```
 */
import { createClient, type MpesaConfig, type MpesaClient } from '@daraja-kit/sdk';
import { TOOL_SCHEMAS, type ToolName, type ToolDefinition } from './tool-definitions.js';

export interface DarajaToolkitConfig extends MpesaConfig {
  /** Subset of tools to expose. Default: all tools. */
  tools?: ToolName[];
}

export class DarajaAgentToolkit {
  private readonly client: MpesaClient;
  private readonly enabledTools: Set<ToolName>;

  constructor(config: DarajaToolkitConfig = {}) {
    const { tools, ...mpesaConfig } = config;
    this.client = createClient(mpesaConfig);
    this.enabledTools = new Set(tools ?? (Object.keys(TOOL_SCHEMAS) as ToolName[]));
  }

  /** Get all enabled tool definitions with bound executor functions. */
  getToolDefinitions(): ToolDefinition[] {
    const executors = this.buildExecutors();
    return (Object.keys(TOOL_SCHEMAS) as ToolName[])
      .filter((name) => this.enabledTools.has(name))
      .map((name) => ({
        ...TOOL_SCHEMAS[name],
        execute: executors[name],
      }));
  }

  private buildExecutors(): Record<ToolName, (params: Record<string, unknown>) => Promise<unknown>> {
    return {
      mpesa_collect_payment: async (params) =>
        this.client.collect({
          amount: params.amount as number,
          phone: params.phone as string,
          reference: params.reference as string | undefined,
          description: params.description as string | undefined,
        }),

      mpesa_send_money: async (params) =>
        this.client.send({
          amount: params.amount as number,
          phone: params.phone as string,
          callbackUrl: params.callbackUrl as string,
          type: params.type as 'salary' | 'business' | 'promotion' | undefined,
          remarks: params.remarks as string | undefined,
        }),

      mpesa_check_status: async (params) =>
        this.client.status({
          transactionId: params.transactionId as string,
          callbackUrl: params.callbackUrl as string,
        }),

      mpesa_check_balance: async (params) =>
        this.client.balance({
          callbackUrl: params.callbackUrl as string,
        }),

      mpesa_reverse_transaction: async (params) =>
        this.client.reverse({
          transactionId: params.transactionId as string,
          amount: params.amount as number,
          callbackUrl: params.callbackUrl as string,
        }),

      mpesa_generate_qr: async (params) =>
        this.client.qr({
          amount: params.amount as number,
          merchantName: params.merchantName as string | undefined,
          reference: params.reference as string | undefined,
          type: params.type as 'paybill' | 'buygoods' | 'send_money' | 'withdraw' | 'send_to_business' | undefined,
        }),
    };
  }
}
