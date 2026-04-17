# Changelog — `@daraja-mcp/support`

All notable changes to the M-Pesa Support Assistant MCP server.

## `0.0.1-beta.1` — 2026-04-17

Initial public beta.

**Tools**
- `daraja_diagnose` — root-cause any Daraja error. 27+ known codes (including dotted namespaced codes), STK callback JSON parsing, log-line extraction, method-aware diagnosis (`collect` vs `send` etc.), ranked hypotheses for ambiguous codes, decision traces, follow-up hints.
- `daraja_explain` — plain-language explanation of any Daraja/M-Pesa concept, API, flow, or field. Brief or detailed depth. Related-topics discovery.
- `daraja_validate` — lint code for common integration mistakes. Severity-partitioned output (`blockers` / `warnings` / `nits`) with `canDeploy` boolean and risk summary.
- `daraja_preflight` — pre-deployment health check. Probes callback URL reachability and tests OAuth credentials against the Daraja sandbox.
- `daraja_test_sandbox` — fire real sandbox calls (STK, B2C, QR, balance, status, reversal) to verify a fix end-to-end. Destructive-hint flagged; MCP clients auto-prompt for confirmation.

**Knowledge base**
- 20+ Daraja error codes with structured diagnosis
- 10 decision trees in `troubleshooting.md`
- 11 symptom-specific docs (callback malformed, callback pending, STK-PIN-fails, B2C-not-received, initiator mismatch, iOS eSIM timeouts, sandbox-vs-prod divergence, ResultCode-vs-ResponseCode, idempotency, callback-vs-polling races, top-20 index)
- 5 concept deep-dives (OAuth, callbacks, environments, going-live, security)
- 7 pattern guides
- `llms.txt` — 5KB AI-agent entry point

**Trust & safety**
- Core tools (diagnose, explain, validate) work offline and require no credentials
- Verify tools (preflight, test_sandbox) only connect to `sandbox.safaricom.co.ke` — never production
- Phone numbers masked (`254708***149`) and credentials redacted in all outputs and audit logs
- Every tool call emits a structured JSON audit record to stderr
- MCP `readOnlyHint` / `destructiveHint` / `idempotentHint` annotations enforced

**Known limitations**
- First beta — expect rapid iteration
- Knowledge base and ERROR_DB are static per release; new Daraja codes land via `-beta.N` version bumps
- `test_sandbox` uses bundled sandbox credentials by default; provide your own via env vars for isolated testing
