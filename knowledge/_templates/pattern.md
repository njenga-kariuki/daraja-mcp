<!--
TEMPLATE — COPY THIS FILE INTO knowledge/patterns/<your-slug>.md, THEN DELETE THIS COMMENT BLOCK.

Use this template for end-to-end integration patterns: donation page, checkout, B2C
disbursement, subscription billing, etc. A pattern is a runnable example with enough
context to adapt, not a snippet.

Code must use @daraja-kit/sdk. Include validation, error handling with .suggestion,
and callback verification when applicable. Environment variables, never hardcoded creds.
-->

# Pattern: <Name>

<One short paragraph: what this pattern does, who would use it, and the M-Pesa API it
depends on.>

## User Flow

1. <Step from the end-user's point of view.>
2. <Next step.>
3. <Terminal state — success or failure handled explicitly.>

## Complete Code

### Server

```ts
// Full server code. Include imports, validation, SDK calls, error handling,
// callback verification (verifyCallback from the SDK) if relevant.
```

### Client

```html
<!-- Full client code if the pattern has a UI. -->
```

## Setup

```bash
npm install @daraja-kit/sdk
export DARAJA_CONSUMER_KEY=<your_key>
export DARAJA_CONSUMER_SECRET=<your_secret>
```

## Edge Cases

- <Pitfall specific to this pattern (e.g., idempotency for retries, amount validation).>
- <Another pitfall.>

## Related

- [<related capability or concept>](<../category/filename.md>)
