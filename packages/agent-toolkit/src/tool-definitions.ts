/**
 * Framework-agnostic tool definitions for the Daraja Agent Toolkit.
 *
 * Each tool maps to an SDK method with a JSON Schema describing its parameters.
 * Framework adapters convert these into their respective formats.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export const TOOL_SCHEMAS = {
  mpesa_collect_payment: {
    name: 'mpesa_collect_payment',
    description:
      'Accept an M-Pesa payment via STK Push. Sends a payment prompt to the customer\'s phone. ' +
      'Auto-polls for the result — no callback URL needed. Returns payment status (completed, failed, cancelled).',
    parameters: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Amount in KES (whole number, minimum 1).',
        },
        phone: {
          type: 'string',
          description: 'Customer phone number (any Kenyan format: 0712345678, +254712345678, 254712345678).',
        },
        reference: {
          type: 'string',
          description: 'Account reference shown to customer. Max 12 characters. Default: "Payment".',
        },
        description: {
          type: 'string',
          description: 'Transaction description. Max 13 characters. Default: "Payment".',
        },
      },
      required: ['amount', 'phone'],
    },
  },

  mpesa_send_money: {
    name: 'mpesa_send_money',
    description:
      'Send money from business to customer (B2C). Requires a callback URL — results delivered asynchronously. ' +
      'Use for salary payments, disbursements, or refunds.',
    parameters: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Amount in KES (whole number).',
        },
        phone: {
          type: 'string',
          description: 'Recipient phone number (any Kenyan format).',
        },
        callbackUrl: {
          type: 'string',
          description: 'HTTPS URL where Daraja sends the result.',
        },
        type: {
          type: 'string',
          enum: ['salary', 'business', 'promotion'],
          description: 'Payment type. Default: "business".',
        },
        remarks: {
          type: 'string',
          description: 'Transaction remarks.',
        },
      },
      required: ['amount', 'phone', 'callbackUrl'],
    },
  },

  mpesa_check_status: {
    name: 'mpesa_check_status',
    description: 'Check the status of an M-Pesa transaction. Requires a callback URL for async results.',
    parameters: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          description: 'M-Pesa transaction ID to query.',
        },
        callbackUrl: {
          type: 'string',
          description: 'HTTPS URL where Daraja sends the result.',
        },
      },
      required: ['transactionId', 'callbackUrl'],
    },
  },

  mpesa_check_balance: {
    name: 'mpesa_check_balance',
    description: 'Check the M-Pesa account balance. Requires a callback URL for async results.',
    parameters: {
      type: 'object',
      properties: {
        callbackUrl: {
          type: 'string',
          description: 'HTTPS URL where Daraja sends the result.',
        },
      },
      required: ['callbackUrl'],
    },
  },

  mpesa_reverse_transaction: {
    name: 'mpesa_reverse_transaction',
    description: 'Reverse/refund an M-Pesa transaction. Requires a callback URL for async results.',
    parameters: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          description: 'M-Pesa transaction ID to reverse.',
        },
        amount: {
          type: 'number',
          description: 'Amount to reverse in KES.',
        },
        callbackUrl: {
          type: 'string',
          description: 'HTTPS URL where Daraja sends the result.',
        },
      },
      required: ['transactionId', 'amount', 'callbackUrl'],
    },
  },

  mpesa_generate_qr: {
    name: 'mpesa_generate_qr',
    description: 'Generate a QR code for M-Pesa payment. No callback needed. Returns a base64-encoded PNG.',
    parameters: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Amount in KES.',
        },
        merchantName: {
          type: 'string',
          description: 'Merchant or business name.',
        },
        reference: {
          type: 'string',
          description: 'Reference or invoice number. Default: "Payment".',
        },
        type: {
          type: 'string',
          enum: ['paybill', 'buygoods', 'send_money', 'withdraw', 'send_to_business'],
          description: 'Transaction type. Default: "paybill".',
        },
      },
      required: ['amount'],
    },
  },
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;
export const TOOL_NAMES = Object.keys(TOOL_SCHEMAS) as ToolName[];
