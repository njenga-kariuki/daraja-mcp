# Knowledge Base

This directory is the source of truth for everything the M-Pesa Support Assistant (`@daraja-mcp/support`) knows. Every decision tree, error catalog entry, concept explanation, and integration pattern the assistant retrieves lives here as a plain markdown file.

**If you are a Safaricom support engineer or documentation author:** you do not need to hand-edit these files. Run `/daraja-augment-knowledge` in Claude Code (with this repo open) and paste your content — the slash command handles classification, normalization, scrub against existing knowledge, validation, and PR creation. See [`../CONTRIBUTING.md`](../CONTRIBUTING.md) for the full walkthrough.

This README documents the conventions so the assistant's retrieval keeps working and the files remain coherent as the knowledge base grows.

## Directory Map

| Directory | What lives here | Example |
|---|---|---|
| `capabilities/` | SDK method references — one file per SDK method | `collect-payments.md`, `send-money.md` |
| `concepts/` | Deep-dive references on M-Pesa mechanisms | `callbacks.md`, `authentication.md`, `going-live.md` |
| `errors/` | Error code docs and symptom-based decision trees | `error-codes.md`, `stk-reached-phone-but-pin-fails.md` |
| `patterns/` | End-to-end integration patterns with runnable code | `donation-page.md`, `subscription-billing.md` |
| `_templates/` | Structural skeletons used by `/daraja-augment-knowledge` | `error.md`, `concept.md`, `pattern.md`, `capability.md` |

### Which Folder Does My Doc Go In?

- **SDK method I'd call (`mpesa.collect`, `mpesa.send`, etc.)?** → `capabilities/`
- **A concept or mechanism to explain (how OAuth works, why callbacks exist)?** → `concepts/`
- **An error code, symptom, or decision tree?** → `errors/`
- **A complete integration example with code?** → `patterns/`

If unsure, `/daraja-augment-knowledge` will propose a category and ask you to confirm.

## Conventions

Every knowledge file follows a simple shape:

1. **First non-empty line is an H1** — `# <Title>`. This is what the retrieval layer uses as the doc's title.
2. **First paragraph is the summary** — one short paragraph that reads standalone. The retrieval layer surfaces this when a query partially matches the file, so it needs enough context on its own.
3. **Optional `## Related` section at the end** — list cross-links to adjacent docs using relative paths (`[Callbacks](../concepts/callbacks.md)`). The slash command's scrub layer uses this section to detect overlap and contradiction.

There is **no frontmatter**. No YAML, no tags, no `last_reviewed` fields. The lint script enforces the three rules above; everything else is the author's judgement.

## Generated Files — Do Not Edit

- `llms.txt` — 5 KB index for LLM ingestion
- `llms-full.txt` — 147 KB complete knowledge export

These are built from the other files. Hand-edits will be overwritten on the next build.

## Local Preview Loop (for direct editors)

The slash command is the recommended path. If you're editing files directly, this loop lets you verify changes in under a minute:

```bash
cd packages/support-mcp
npm run dev
```

Then in a separate terminal, launch the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node packages/support-mcp/dist/index.js
```

Edit a file under `knowledge/`, restart `npm run dev`, and call `daraja_explain` or `daraja_diagnose` with a query that should hit your new or edited doc. The support MCP reads `/knowledge/` directly in dev mode — no rebuild needed beyond restarting the process.

## Validation

Before opening a PR (the slash command does this automatically for you):

```bash
npm run lint:knowledge
```

The lint script checks: every file has an H1, every relative markdown link resolves, no files stray outside the category directories.

## After Your PR Merges

A merge to `master` that touches `knowledge/` triggers an auto-publish to `@daraja-mcp/support@beta`. Within roughly five minutes, `npx -y @daraja-mcp/support@beta` will resolve to a new prerelease version that includes your change. Users running the support MCP receive the update on their next invocation.
