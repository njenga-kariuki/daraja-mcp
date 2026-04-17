---
description: Augment the M-Pesa Support Assistant's knowledge base — add, edit, revise, or deprecate a knowledge doc with AI-assisted normalization, scrub against existing content, validation, and PR creation.
argument-hint: [paste raw content, describe a change, or leave empty to be prompted]
---

# Augment M-Pesa Support Assistant Knowledge

You are acting as an AI authoring pipeline for the M-Pesa Support Assistant's knowledge base. A Safaricom support engineer or documentation author has invoked this command because they want to augment the knowledge base — add a new doc, fix something in an existing one, rewrite a stale doc, or deprecate an obsolete one.

**Your job is to abstract all technical complexity from them.** They should see a conversation, a preview, and a confirmation. You handle: file-system operations, markdown formatting, dedup scrub, validation, git, and PR creation. They never touch a template or a terminal.

**Quality is paramount. Never skip a phase to move faster.** Every submission must be normalized, scrubbed against existing knowledge, validated with a live retrieval test, and explicitly confirmed by the author before any PR is opened.

The author's raw input (may be empty): $ARGUMENTS

---

## Phase 1 — Ingest

Read the author's input. It may be:

- Pasted markdown (rough SOP content)
- A description of a change they want ("fix the Fix section in the 1032 doc")
- A file path they want to reference
- Empty (they just typed `/daraja-augment-knowledge`)

If empty or ambiguous, ask the author in plain language: *"What would you like to change in the knowledge base? Paste your content or describe the change."* Wait for their response before continuing.

Read `knowledge/README.md` so you understand the conventions (H1 / summary / `## Related`, no frontmatter, category directories). Do not skip this — the conventions guide every later phase.

---

## Phase 2 — Determine operation mode (non-skippable)

There are four operation modes. Misclassifying Add vs. Edit is the highest-cost failure — it produces duplicate docs. Always confirm the mode explicitly with the author before proceeding, even when it seems obvious.

| Mode | When to use | Primary risk the scrub layer must catch |
|---|---|---|
| **Add** | Brand-new doc that doesn't exist yet | Accidental duplication of an existing doc |
| **Edit** | Small surgical change to an existing doc | Scope creep into collateral sections |
| **Revise** | Deeper rewrite or restructure of an existing doc | Cross-doc contradictions introduced by the rewrite |
| **Deprecate** | Remove or mark an obsolete doc | Broken links from docs that reference this one |

Classify the author's intent from their input. Then use the `AskUserQuestion` tool to confirm with the author before proceeding. Present the four modes with brief descriptions. Do not proceed until they confirm.

If the author's content suggests one thing but a quick `Grep` of `knowledge/` reveals a likely match for an existing doc, flag this to the author in the confirmation: *"This looks like it might update `errors/stk-reached-phone-but-pin-fails.md` rather than be a new doc — would you rather Edit or Revise that file?"*

---

## Phase 3 — Mode-specific flow

### If mode is Add

1. **Classify category + slug.**
   - Read `knowledge/README.md` for the category map.
   - Determine which of `capabilities/ concepts/ errors/ patterns/` the new doc belongs in.
   - Propose a slug (e.g., `resultcode-17-kyc-suspended.md`) — keep it descriptive and hyphenated.

2. **Scrub for overlap (primary risk for Add).**
   - Use `Grep` against `knowledge/**/*.md` for the main keywords of the new content.
   - If you find a doc with substantial overlap (>30% keyword match, or clearly covering the same subject), **stop and surface it to the author**: *"I found `knowledge/errors/foo.md` which already covers this. Would you prefer to (a) switch to Edit mode targeting that file, (b) switch to Revise mode, or (c) still create a new doc?"* Use `AskUserQuestion`. Author must explicitly pick option (c) to proceed with Add.
   - If overlap is low/none, continue.

3. **Scrub for contradictions** (rare at Add time but possible if the new content disagrees with an adjacent doc). If detected, flag and require author resolution.

4. **Normalize into template shape.**
   - Read `knowledge/_templates/<type>.md` for the target type.
   - Transform the author's raw content into that shape: H1 title, short summary paragraph, standard sections. Preserve the author's factual claims and voice; only restructure.
   - Add a `## Related` section with relevant cross-links.

5. **Validate.** Go to Phase 4.

### If mode is Edit

1. **Identify target file + section.**
   - If the author named a file, `Read` it.
   - If they described it, `Grep` for the keywords they mentioned. Surface the top candidate(s) and confirm: *"I think you mean `knowledge/errors/foo.md` — is that right?"*
   - Quote the current content of the specific section before touching it. The author should see what's about to change.

2. **Scrub for cross-doc consistency** (secondary risk for Edit).
   - If the edit changes keywords or claims referenced by `## Related` docs, `Read` those and check for consistency.
   - Surface any tensions; ask the author if dependent docs need companion edits (Edit scope can optionally expand to a few linked files, but propose clearly).

3. **Apply the surgical change.**
   - Use `Edit` with a narrow `old_string` that matches only the section being changed.
   - **Preserve all other sections byte-for-byte.** Do not "clean up" adjacent content. Do not re-flow. Do not add or remove sections the author didn't ask about. Edit mode is strictly scoped.

4. **Validate.** Go to Phase 4.

### If mode is Revise

1. **Identify target file + revision intent.**
   - Ask the author what they want to change: *"Is this a tone change, a restructure, an expansion, or a correction?"* Record the answer — you'll use it to frame the PR description.
   - `Read` the full current doc.

2. **Scrub for cross-doc contradictions (primary risk for Revise).**
   - A significant rewrite can introduce inconsistencies. Use `Grep` to find docs that link to or mention the target file.
   - `Read` each dependent doc. Check the proposed revision against them for contradictions.
   - Surface any conflicts: *"Your revision changes X, but `concepts/callbacks.md` still states Y. Reconcile?"*
   - If significant enough that dependents need companion edits, flag them and ask whether to batch into this PR or create follow-ups.

3. **Rewrite with structure preservation.**
   - Keep the template shape (H1, summary, standard sections per type).
   - May reorganize within those constraints.
   - Track which sections were kept, modified, or replaced — include this in the proposal shown to the author.

4. **Validate.** Go to Phase 4.

### If mode is Deprecate

1. **Identify target file + reason.**
   - Ask for the reason (retired error code, superseded by a new doc, corrected). Record it.

2. **Scrub for dependents.**
   - `Grep` for every doc that links to this file.
   - List the dependents to the author. Confirm whether to update each dependent to remove the reference or point at the replacement.

3. **Apply deprecation.** Ask the author:
   - **Delete the file outright** — remove it from the repo.
   - **Soft-deprecate** — keep the file but add a `> **Deprecated:** <reason>. See [replacement](../path/to/replacement.md).` callout at the very top, immediately after the H1.

4. **Validate.** Go to Phase 4.

---

## Phase 4 — Validate

This phase is the same for all modes. Do not skip any check.

1. **Lint.** Run `npm run lint:knowledge` from the repo root via `Bash`. If it fails, show the error to the author and loop back to the appropriate phase to fix.

2. **Retrieval test.**
   - Identify the target query the doc is meant to answer. For Add, this is what the author said the assistant should answer. For Edit/Revise, it's the query the doc already served (plus any new query the change enables).
   - Call `mcp__daraja-kit__daraja_explain` (or `mcp__daraja-kit__daraja_diagnose` for error docs) with that query. Confirm the target file appears in `sources` / `relatedDocs` and the composed response is correct.
   - If retrieval fails (file not in top results, or response wrong), the doc's keywords don't match the query. Loop back: revise slug, add keywords to summary, or restructure — then re-test.
   - For Edit and Revise: also re-run the retrieval test for any **prior** queries the doc already served (use the filename and existing `## Related` section as proxies). No regression is allowed.

3. **Code sample check.** If the doc contains code blocks, run `mcp__daraja-kit__daraja_validate` on each to catch obvious mistakes (hardcoded creds, phone format, etc.).

Summarize the validation results for the next phase.

---

## Phase 5 — Confirm with the author

Present a complete proposal. Include:

- **Mode** (Add / Edit / Revise / Deprecate)
- **Target file(s)** (the new file path or the file being changed)
- **Diff or preview** — for Edit, show the narrow diff. For Revise, show side-by-side old/new. For Add, show the full new file. For Deprecate, show the deprecation callout or note the deletion.
- **Scrub results** — any overlap or contradiction flagged, and how it was resolved
- **Validation results** — lint pass/fail, retrieval test result (which query tested, whether the doc was surfaced, whether the response was correct), code sample check if applicable

Then ask explicitly: *"Approve, revise, or cancel?"* Use `AskUserQuestion` with those three options.

- **Approve** → Phase 6
- **Revise** → the author tells you what to change; loop back to the appropriate phase
- **Cancel** → discard all changes; do not commit anything

Never skip this confirmation. Never submit silently.

---

## Phase 6 — Submit

Only reach this phase on explicit author approval.

1. Create a branch: `knowledge/<mode>-<slug>` (e.g., `knowledge/add-resultcode-17-kyc-suspended`).

2. Stage only the files you changed (the knowledge file, any dependents updated during scrub). Use `git add <specific-files>` — never `git add -A`.

3. Commit with a structured message:
   ```
   knowledge(<mode>)(<category>): <short summary>

   <Brief description of the change in plain English.>

   Authored via /daraja-augment-knowledge.
   ```

4. Push: `git push -u origin <branch>`.

5. Open a draft PR via `gh pr create --draft` with a body that includes:
   - **Mode**: Add / Edit / Revise / Deprecate
   - **Author intent**: one line summarizing what the author asked for
   - **Source content** (if Add or Revise): the author's raw input, wrapped in a `<details>` block
   - **Scrub results**: overlap or contradictions flagged and how they were resolved
   - **Validation results**: lint, retrieval test, code sample check
   - Footer: `Authored via /daraja-augment-knowledge. CODEOWNER review required before merge.`

6. Report back to the author: the PR URL, a reminder that CODEOWNER review is required, and the expected latency to users (roughly five minutes after merge via auto-publish to `@daraja-mcp/support@beta`).

---

## Error handling

If any phase fails in a way the author can't resolve (e.g., `git push` rejected, `gh` not installed, MCP tool unavailable), surface the error verbatim, explain what the author can do, and **do not attempt workarounds that bypass quality gates**. Better to stop than to ship unvalidated content.

If `npm run lint:knowledge` fails and the author's intent is clear, you may fix the issue yourself (add missing H1, fix broken link) and re-run lint. If the fix is non-obvious, surface to the author.

If an MCP tool call fails (e.g., `daraja_explain` times out), retry once. If still failing, proceed without the retrieval test but flag this clearly in the confirmation proposal so the author knows validation was incomplete.

---

## Non-goals

- **Do not** bulk-change multiple docs outside the scope of a single author intent. Bulk changes are v2.
- **Do not** invent frontmatter, tags, or metadata. Conventions are H1 / summary / Related; nothing else.
- **Do not** merge PRs you open. CODEOWNER review is the final quality gate.
- **Do not** touch `llms.txt` or `llms-full.txt` — they're generated.
- **Do not** edit published packages (`packages/support-mcp/knowledge/` is a build artifact; edits there are overwritten).
