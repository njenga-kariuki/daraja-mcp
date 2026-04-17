# Daraja 4.0

> The simplest way to integrate M-Pesa. For humans and AI agents.

Built for the non-technical founder shipping their first app, the engineer on an established integration closing the debug loop inside their IDE, and the AI agent transacting for its owner under scoped authority.

Daraja 4.0 is an AI-native developer experience layer for Safaricom's Daraja (M-Pesa) APIs. It transforms M-Pesa integration from a weeks-long engineering project into a minutes-long conversation.

## 3 Lines to Your First Payment

```typescript
import { createClient } from '@daraja-4/sdk';

const mpesa = createClient();
const payment = await mpesa.collect({ amount: 100, phone: '0712345678' });
```

That's it. No OAuth token management. No callback servers. No RSA encryption. The SDK handles everything.

## What's Inside

| Package | Description |
|---------|-------------|
| `packages/sdk` | @daraja-4/sdk — 6 intent-based methods (collect, send, status, balance, reverse, qr) |
| `packages/mcp` | @daraja-4/mcp — MCP server with 8 AI tools (scaffold, validate, diagnose, explain, test, go-live, setup, preflight) |
| `knowledge/` | 19 markdown docs optimized for both humans and LLMs |
| `templates/` | 3 runnable project templates (donation page, e-commerce, B2C payroll) |
| `demo/` | Interactive dashboard showcasing all capabilities |

## Quick Start (SDK)

1. Get free API credentials at [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Install and configure:
   ```bash
   npm install @daraja-4/sdk
   export DARAJA_CONSUMER_KEY=your_key
   export DARAJA_CONSUMER_SECRET=your_secret
   ```
3. Start collecting payments:
   ```typescript
   import { createClient } from '@daraja-4/sdk';
   const mpesa = createClient();

   // Collect a payment — customer gets a PIN prompt on their phone
   const payment = await mpesa.collect({ amount: 100, phone: '0712345678' });
   console.log(payment.status); // 'completed'
   console.log(payment.receipt); // 'QKJ41HAY4I'
   ```

Works in sandbox mode by default — no real money charged, no approval needed.

## Quick Start (AI Agent)

Add Daraja 4.0 tools to your AI assistant. Create `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "Daraja 4.0": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "DARAJA_CONSUMER_KEY": "your_key",
        "DARAJA_CONSUMER_SECRET": "your_secret"
      }
    }
  }
}
```

Works with Claude Code, Cursor, Claude Desktop, and any MCP-compatible client. No credentials needed for sandbox — `createClient()` works immediately. Your AI assistant gets 8 specialized M-Pesa tools:

| Tool | What It Does |
|------|-------------|
| `daraja_scaffold` | Generate complete M-Pesa projects from natural language |
| `daraja_validate` | Check integration code for common mistakes |
| `daraja_diagnose` | Root-cause any Daraja API error with prevention guidance |
| `daraja_explain` | Plain-language explanations of M-Pesa concepts |
| `daraja_test_sandbox` | Test against the live Daraja sandbox |
| `daraja_go_live` | Production readiness checklist |
| `daraja_setup` | Platform-specific setup guides (Cursor, Claude Code, Lovable, Replit, Windsurf) |
| `daraja_preflight` | Pre-deployment health check (code, callbacks, OAuth) |

20+ Daraja error codes mapped to actionable suggestions with prevention guidance.

## Run the Demo

```bash
npm run demo
# → http://localhost:4000
```

## Templates

| Template | Description | Run It |
|----------|-------------|--------|
| `templates/donation-page/` | Simple M-Pesa donation form | `cd templates/donation-page && npm install && npm start` |
| `templates/ecommerce-checkout/` | Shopping cart with M-Pesa checkout | `cd templates/ecommerce-checkout && npm install && npm start` |
| `templates/b2c-payroll/` | B2C salary disbursement | `cd templates/b2c-payroll && npm install && npm start` |

## Architecture

```
Daraja 4.0/
├── packages/
│   ├── sdk/                 # @daraja-4/sdk (6-method M-Pesa SDK)
│   │   └── src/
│   │       ├── client.ts    # MpesaClient with collect, send, status, balance, reverse, qr
│   │       ├── auth.ts      # OAuth 2.0 token management (auto-cache, auto-refresh)
│   │       ├── errors.ts    # Rich errors with .suggestion field
│   │       ├── phone.ts     # Phone normalization (any Kenyan format)
│   │       ├── security.ts  # STK password + RSA SecurityCredential
│   │       ├── polling.ts   # Auto-polling for STK Push status
│   │       └── methods/     # collect, send, status, balance, reverse, qr
│   │
│   └── mcp/                 # @daraja-4/mcp (MCP server)
│       └── src/
│           ├── server.ts    # MCP server with stdio transport
│           ├── knowledge.ts # Knowledge base search + indexing
│           └── tools/       # scaffold, validate, diagnose, explain, test-sandbox, go-live
│
├── knowledge/               # 17 docs: capabilities, concepts, errors, patterns
├── templates/               # 3 runnable project templates
├── demo/                    # Interactive dashboard + REST API
└── src/                     # Legacy POC (raw Daraja integration, kept for reference)
```

## Going to Production

See [`knowledge/concepts/going-live.md`](knowledge/concepts/going-live.md) for the complete production checklist, or use the `daraja_go_live` MCP tool for automated readiness verification.

## Legacy POC

The `src/` directory contains the original raw Daraja API integration — covering all 9 endpoints with manual OAuth, RSA encryption, and callback handling. It is preserved for reference and serves as the "before" in Daraja 4.0's before/after story.
