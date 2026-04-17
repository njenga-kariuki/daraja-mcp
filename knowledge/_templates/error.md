<!--
TEMPLATE — COPY THIS FILE INTO knowledge/errors/<your-slug>.md, THEN DELETE THIS COMMENT BLOCK.

Use this template for either (a) a specific Daraja error code, or (b) a symptom-based
decision tree ("STK reached phone but fails"). Pick the shape that fits.

The H1 should be unambiguous about what this doc diagnoses.
The first paragraph is the summary — keep it one short paragraph.
Keep the "Related" section at the bottom so the slash command's scrub can cross-check.
-->

# <Error Code or Symptom — one-line title>

**Symptom:** <What the developer actually observes: error message, ResultCode, silent behaviour, UX regression.>

**What happened:** <One or two sentences on the root cause, in plain language.>

---

## Root cause

<Technical explanation of why this happens. Link to the underlying concept doc (OAuth, callbacks, SecurityCredential, etc.) if it helps.>

## Fix

<What the developer should do right now to resolve it. Include code if applicable. Be concrete: "change X to Y", not "consider reviewing".>

```ts
// Optional code sample — use @daraja-kit/sdk, never raw fetch.
```

## Prevention

<How to avoid this next time. Logging, defaults, validation, config hygiene. One or two bullets.>

## Related

- [<related doc title>](<../category/filename.md>)
