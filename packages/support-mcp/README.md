# `@daraja-mcp/support`

> The 24/7 M-Pesa Support Assistant. In your IDE. As good as a senior Safaricom engineer.

*Beta release under `--tag beta`. Early, but public — integrations built against this API should pin to a specific `-beta.N` version.*

---

## Paste any Daraja error. Ship the fix in minutes.

Stuck on a 1032? A silent callback? A SecurityCredential that "just won't work"? Every Daraja developer has lost an afternoon to this. Now it takes 30 seconds.

Add one MCP server to Claude Code, Cursor, or any MCP-compatible IDE. Your AI assistant gets a senior Safaricom support engineer on standby — the full error catalog, decision trees for every common symptom, working code for every fix, and sandbox verification so you know the fix holds before you redeploy.

---

## Install

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "daraja-support": {
      "command": "npx",
      "args": ["-y", "@daraja-mcp/support@beta"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "daraja-support": {
      "command": "npx",
      "args": ["-y", "@daraja-mcp/support@beta"]
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "daraja-support": {
      "command": "npx",
      "args": ["-y", "@daraja-mcp/support@beta"]
    }
  }
}
```

### Any MCP client

```bash
npx -y @daraja-mcp/support@beta
```

Communicates over stdio. Restart your IDE after adding the config.

---

## Ask

Once installed, ask your assistant anything:

> "I'm getting ResultCode 1032 on STK Push. What's happening?"
>
> "Explain the difference between ResponseCode and ResultCode."
>
> "Here's my callback JSON — what went wrong?" (paste the full body)
>
> "Does this snippet have any security issues?" (paste code)
>
> "Is my integration production-ready?" (runs preflight)

The assistant picks the right tool (`diagnose`, `explain`, `validate`, `preflight`, `test_sandbox`) and returns a structured answer.

---

## What you get

| Tool | Purpose | Trust |
|---|---|---|
| `daraja_diagnose` | Root-cause any error — 27+ codes, STK callback JSON parsing, log-line extraction, method-aware, ranked hypotheses for ambiguous codes | Offline, no creds |
| `daraja_explain` | Plain-language explanation of any M-Pesa concept, API, or flow | Offline, no creds |
| `daraja_validate` | Severity-partitioned code lint — returns `blockers`, `warnings`, `nits`, `canDeploy` | Offline, no creds |
| `daraja_preflight` | Probe callback URL + test OAuth credentials before deploy | Sandbox only |
| `daraja_test_sandbox` | Fire real sandbox calls to verify a fix end-to-end | Sandbox only, destructive-hint (client prompts) |

---

## Trust & safety

- **Read-only for knowledge.** `diagnose`, `explain`, `validate` never touch your credentials and work offline after install.
- **Sandbox-only for verification.** `preflight` and `test_sandbox` only hit `sandbox.safaricom.co.ke` — never production. Sandbox hostname is pinned.
- **Zero-config.** No consumer key, no secret, no setup. Shared sandbox credentials ship bundled.
- **PII masked.** Phone numbers (`254708***149`), shortcodes, request IDs redacted before any log line.
- **Structured audit trail.** Every tool call emits `{timestamp, tool, sanitized args, status, duration_ms}` to stderr. Pipe to your SIEM.
- **Destructive-tool confirmation.** `test_sandbox` is annotated `destructiveHint: true` so MCP clients auto-prompt before execution.
- **No file writes.** The package emits content to stdout/stderr only. Never writes to disk.
- **Minimal dep tree.** One runtime dependency (`@modelcontextprotocol/sdk`). `@daraja-kit/sdk` and `axios` are bundled into `dist/` — no sprawling `node_modules`.

---

## Knowledge coverage

- **All 20+ Daraja error codes** with root cause, fix, prevention, and working code examples
- **10 decision trees** for symptoms you can't google: silent callbacks, pending STK, SecurityCredential fails, OAuth 401/403, USSD-session collision, phone unreachable, duplicate transaction, sandbox flakiness
- **7 HTTP-level errors** (400, 401, 403, 404, 429, 500, 503) with Daraja-specific causes
- **5 concept deep-dives** — OAuth, callbacks, environments, SecurityCredential, going-live checklist
- **11 symptom-specific docs** — callback malformed, callback pending, STK-PIN-fails, B2C-not-received, initiator mismatch, iOS eSIM timeouts, sandbox-vs-prod divergence, ResultCode-vs-ResponseCode, idempotency, callback-vs-polling races, top-20 index
- **7 pattern guides** — donation, e-commerce, B2C disbursement, subscription billing, callback testing, resilience

---

## Need more than support?

The full [Daraja 4.0 agent toolkit](https://github.com/safaricom/daraja-poc) ships three more tools for greenfield work:

- `daraja_scaffold` — generate complete M-Pesa projects from natural language
- `daraja_setup` — platform-specific setup guides (Claude Code, Cursor, Lovable, Replit, Windsurf)
- `daraja_go_live` — production readiness checklist

Install the full toolkit as `@daraja-kit/mcp` (when available). This support tier is deliberately narrower — smaller blast radius, stronger trust guarantees, focused on developers who need to fix a broken integration fast.

---

## License

MIT. See [LICENSE](../../LICENSE).

## Links

- [Full Daraja 4.0 repo](https://github.com/safaricom/daraja-poc)
- [Safaricom Daraja portal](https://developer.safaricom.co.ke)
- [Changelog](CHANGELOG.md)
