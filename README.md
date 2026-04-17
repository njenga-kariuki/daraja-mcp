# Daraja 4.0

> The 24/7 M-Pesa Support Assistant. In your IDE. As good as a senior Safaricom engineer.

*Proof of concept — currently in internal review with the Safaricom Daraja team. Not an official Safaricom product or release.*

---

## Paste any Daraja error. Ship the fix in minutes.

Stuck on a 1032? A silent callback? A SecurityCredential that "just won't work"? Every Daraja developer has lost an afternoon to this. Now it takes 30 seconds.

Add one MCP server to Claude Code, Cursor, or any MCP-compatible IDE. Your AI assistant gets a senior Safaricom support engineer on standby — the full error catalog, decision trees for every common symptom, working code for every fix, and sandbox verification so you know the fix holds before you redeploy.

### Install (Claude Code, Cursor, Claude Desktop)

```json
{ "mcpServers": { "daraja-support": {
  "command": "npx", "args": ["-y", "@daraja-mcp/support@beta"]
}}}
```

Then ask your assistant:

> *"I'm getting ResultCode 1032 on STK Push. What's happening?"*
>
> *"Here's my callback JSON — what went wrong?"* (paste the full body)
>
> *"Is my integration production-ready?"* (runs preflight)

No forums. No tickets. No guesswork.

> **Beta.** `@daraja-mcp/support` is an early release under the `beta` dist-tag. Expect rapid iteration. [Release notes →](packages/support-mcp/CHANGELOG.md)

---

## Developers Asked, We Answered

Scroll the Daraja developer forums for an hour and the same complaints surface every week. OAuth 401s that come and go. A 1032 that nobody can explain is just the user pressing Cancel. Callbacks that never arrive and no way to tell if the problem is your server, your ngrok, or Daraja itself. SecurityCredential errors that turn out to be the wrong certificate for the environment. `ResultCode` vs `ResponseCode` — is `0` success? For which one?

The 24/7 Support Assistant answers all of these in the context where they appear — your IDE, while the code is still on screen. Built from the decision trees Safaricom support engineers already use, grounded in the full Daraja error catalog, available the moment you need it.

---

## What the Support Assistant Covers

- **All 20+ Daraja error codes** with root cause, fix, prevention, and working code examples
- **10 decision trees** for the symptoms you can't google: silent callbacks, pending STK, SecurityCredential fails, OAuth 401/403, USSD-session collision, phone unreachable, duplicate transaction, sandbox flakiness, iOS eSIM timeouts, callback-arrived-but-pending
- **7 HTTP-level errors** (400, 401, 403, 404, 429, 500, 503) with Daraja-specific causes
- **5 concept deep-dives** — OAuth, callbacks, environments, SecurityCredential, going-live checklist
- **11 symptom-specific docs** — callback malformed, callback pending, STK-PIN-fails, B2C-not-received, initiator mismatch, iOS eSIM, sandbox-vs-prod divergence, ResultCode-vs-ResponseCode, idempotency, callback-vs-polling races, top-20 index
- **7 pattern guides** — donation, e-commerce, B2C disbursement, subscription billing, callback testing, resilience
- **`llms.txt`** — 5 KB index plus a 147 KB `llms-full.txt` so any LLM can ingest coherent M-Pesa knowledge

---

## Read-Only, Credential-Free, Offline-Capable

**Read-only for knowledge.** `diagnose`, `explain`, `validate` never touch your credentials and work offline after install.

**Sandbox-only for verification.** `preflight` and `test_sandbox` only hit `sandbox.safaricom.co.ke` — never production. Sandbox hostname is pinned in code.

**Zero-config.** No consumer key, no secret, no setup. Shared sandbox credentials ship bundled.

**PII masked.** Phone numbers (`254708***149`), shortcodes, and request IDs are redacted before any log line.

**Structured audit log.** Every tool call emits `{timestamp, tool, sanitized_args, status, duration_ms}` to stderr — pipe straight to your SIEM.

---

## Try It — Diagnose Any Error in 30 Seconds

```
You: Here's my Daraja error: {"Body":{"stkCallback":{"ResultCode":1032,"ResultDesc":"Request cancelled"}}}

Assistant (via daraja_diagnose):
  errorCode: 1032
  meaning:   Request cancelled by user
  rootCause: The customer either (1) pressed Cancel on the STK prompt, (2) entered
             wrong PIN, or (3) the prompt timed out without response.
  fix:       Show a "Payment cancelled" message and offer a retry button.
  prevention: Do not auto-retry cancelled payments — the customer chose to cancel.
              Track cancel rates; high rates may indicate UX confusion.
  confidence: high
  trace: [normalize_input → extract_code → error_db_hit → kb_search]
  relatedDocs: [errors/troubleshooting.md, concepts/callbacks.md, errors/top-20-index.md]
```

---

## Building New with the SDK

Shipping new M-Pesa code? The support assistant diagnoses. The SDK builds. Both ship in the same repo.

### 3 Lines to Your First Payment

```typescript
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient();
const payment = await mpesa.collect({ amount: 100, phone: '0712345678' });
```

That's it. No OAuth token management. No callback servers. No RSA encryption. The SDK handles everything.

### Quick Start (SDK)

1. Get free API credentials at [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Install and configure:
   ```bash
   npm install @daraja-kit/sdk
   export DARAJA_CONSUMER_KEY=your_key
   export DARAJA_CONSUMER_SECRET=your_secret
   ```
3. Start collecting payments:
   ```typescript
   import { createClient } from '@daraja-kit/sdk';
   const mpesa = createClient();

   // Collect a payment — customer gets a PIN prompt on their phone
   const payment = await mpesa.collect({ amount: 100, phone: '0712345678' });
   console.log(payment.status);  // 'completed'
   console.log(payment.receipt); // 'QKJ41HAY4I'
   ```

Works in sandbox mode by default — no real money charged, no approval needed.

---

## The Full Agent Toolkit

The support tier is one of 8 tools in the full Daraja 4.0 agent toolkit. The other seven are for greenfield building — scaffolding new projects, running live sandbox tests, generating setup guides, checking go-live readiness.

The full toolkit lives in `packages/mcp/` and can be wired as a second MCP server:

```json
{ "mcpServers": { "daraja-kit": {
  "command": "node",
  "args": ["packages/mcp/dist/index.js"],
  "env": {
    "DARAJA_CONSUMER_KEY": "your_key",
    "DARAJA_CONSUMER_SECRET": "your_secret"
  }
}}}
```

| Tool | What It Does | Tier |
|------|-------------|------|
| `daraja_diagnose` | Root-cause any Daraja error with prevention guidance | **Support** |
| `daraja_explain` | Plain-language explanations of M-Pesa concepts | **Support** |
| `daraja_validate` | Lint code for mistakes — severity-partitioned output | **Support** |
| `daraja_preflight` | Pre-deployment health check (code, callbacks, OAuth) | **Support (verify)** |
| `daraja_test_sandbox` | Fire real test calls against the Daraja sandbox | **Support (verify)** |
| `daraja_scaffold` | Generate complete M-Pesa projects from natural language | Full |
| `daraja_setup` | Platform-specific setup guides (Cursor, Claude Code, Lovable, Replit, Windsurf) | Full |
| `daraja_go_live` | Production readiness checklist | Full |

---

## What's Inside

| Package | Description |
|---------|-------------|
| `packages/support-mcp` | **`@daraja-mcp/support`** — the 24/7 M-Pesa Support Assistant MCP server (5 tools, beta) |
| `packages/sdk` | `@daraja-kit/sdk` — 6 intent-based methods (collect, send, status, balance, reverse, qr) |
| `packages/mcp` | `@daraja-kit/mcp` — full agent toolkit MCP server (8 tools) |
| `knowledge/` | 30+ markdown docs optimized for both humans and LLMs |
| `templates/` | 3 runnable project templates (donation page, e-commerce, B2C payroll) |
| `demo/` | Interactive dashboard showcasing all capabilities |

---

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
daraja-poc/
├── packages/
│   ├── support-mcp/         # @daraja-mcp/support — the Support Assistant (beta)
│   │   ├── src/             # bin + server + knowledge resolver + sanitize
│   │   └── knowledge/       # bundled at build time from /knowledge
│   │
│   ├── sdk/                 # @daraja-kit/sdk (6-method M-Pesa SDK)
│   │   └── src/
│   │       ├── client.ts    # MpesaClient with collect, send, status, balance, reverse, qr
│   │       ├── auth.ts      # OAuth 2.0 token management (auto-cache, auto-refresh)
│   │       ├── errors.ts    # Rich errors with .suggestion + .prevention
│   │       ├── phone.ts     # Phone normalization (any Kenyan format)
│   │       ├── security.ts  # STK password + RSA SecurityCredential
│   │       ├── polling.ts   # Auto-polling for STK Push status
│   │       └── methods/     # collect, send, status, balance, reverse, qr
│   │
│   └── mcp/                 # @daraja-kit/mcp (full agent toolkit, 8 tools)
│       └── src/
│           ├── server.ts    # MCP server with stdio transport
│           ├── knowledge.ts # Knowledge base search + indexing
│           └── tools/       # scaffold, validate, diagnose, explain, test-sandbox, go-live, setup, preflight
│
├── knowledge/               # 30+ docs: capabilities, concepts, errors, patterns
├── templates/               # 3 runnable project templates
├── demo/                    # Interactive dashboard + REST API
└── src/                     # Legacy POC (raw Daraja integration, kept for reference)
```

## Going to Production

See [`knowledge/concepts/going-live.md`](knowledge/concepts/going-live.md) for the complete production checklist, or use the `daraja_go_live` MCP tool for automated readiness verification.

## Legacy POC

The `src/` directory contains the original raw Daraja API integration — covering all 9 endpoints with manual OAuth, RSA encryption, and callback handling. It is preserved for reference and serves as the "before" in Daraja 4.0's before/after story.
