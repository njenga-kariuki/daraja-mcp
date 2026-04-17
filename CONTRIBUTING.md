# Contributing to the M-Pesa Support Assistant

The M-Pesa Support Assistant (`@daraja-mcp/support`) is only as good as its knowledge base. Every error code, decision tree, SOP, and integration pattern the assistant retrieves lives as a plain markdown file in [`knowledge/`](knowledge/). This guide is for the people who own that knowledge — Safaricom support engineers, documentation authors, and the dev-platform team keeping the base current.

**You do not need to be a developer to contribute.** You do not need to know Git, markdown templates, or the npm publish pipeline. You describe what you want to change; an AI-assisted slash command handles the rest.

## The Authoring Flow

Whether you're **adding** a new error doc, **editing** a sentence in an existing one, **revising** a pattern that's gone stale, or **deprecating** an obsolete doc, the flow is the same.

### 1. Open this repo in Claude Code

Clone the repo if you haven't already:

```bash
git clone https://github.com/njenga-kariuki/daraja-kit.git
cd daraja-kit
```

Open the directory in [Claude Code](https://claude.com/claude-code).

### 2. Run `/daraja-augment-knowledge`

In the Claude Code prompt, type:

```
/daraja-augment-knowledge
```

Paste your content, or describe what you want to change. The slash command will:

1. **Classify** the operation — Add / Edit / Revise / Deprecate — and ask you to confirm
2. **Scrub** against existing knowledge — flags overlap (suggesting you switch to Edit or Revise) and contradictions
3. **Normalize** your content into the knowledge-base format (H1, summary, standard sections)
4. **Validate** — runs the lint script and a live retrieval test so you know the assistant will actually surface your doc
5. **Show you the proposal** — the full diff, overlap analysis, and validation results — for explicit confirmation

### 3. Confirm and approve

Review what the slash command proposes. Ask for revisions in plain language ("make the Fix section shorter", "rename to X", "this conflicts with callbacks.md — reconcile"). When you approve, the slash command creates a branch, commits the change, pushes it, and opens a draft pull request on GitHub with the validation results attached.

A maintainer (assigned via `CODEOWNERS`) reviews the PR. On merge to `master`, your change auto-publishes to `@daraja-mcp/support@beta` — `npx -y @daraja-mcp/support@beta` users receive the update within roughly five minutes.

---

## No Claude Code? File a Knowledge-Gap Issue

If you cannot use Claude Code — you just want to flag that the assistant got something wrong or missed a case — open a [Knowledge Gap issue](.github/ISSUE_TEMPLATE/knowledge-gap.yml). Structured fields will walk you through:

- What developer question did the assistant fail to address?
- What the assistant actually said
- What the correct answer should be
- Optional: paste your draft content

A maintainer will convert it into a `/daraja-augment-knowledge` invocation on your behalf.

---

## For Developers: Code Contributions

If you're contributing code to the SDK, MCP server, templates, or demo — not knowledge — the standard open-source flow applies:

1. Fork the repo and create a feature branch
2. Run `npm install` at the repo root
3. Run `npm test` before opening a PR — all 228+ tests should pass
4. If your change touches `knowledge/`, run `npm run lint:knowledge` too
5. Open a PR with a clear description of what changed and why

Code tests live in `packages/sdk/test/` and `packages/mcp/src/__tests__/`. Knowledge changes should go through `/daraja-augment-knowledge` even for developer-contributors — the slash command's scrub and validation steps raise the floor for everyone.

## Questions

- **Something about the knowledge base convention is unclear:** see [`knowledge/README.md`](knowledge/README.md).
- **Something about the SDK or MCP server is unclear:** see [`README.md`](README.md) and the per-package READMEs in `packages/`.
- **You've found an issue with the assistant but aren't sure if it's a bug or a knowledge gap:** file a [Knowledge Gap issue](.github/ISSUE_TEMPLATE/knowledge-gap.yml) — maintainers will route it correctly.
