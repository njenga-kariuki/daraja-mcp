<!--
TEMPLATE — COPY THIS FILE INTO knowledge/capabilities/<your-slug>.md, THEN DELETE THIS COMMENT BLOCK.

Use this template for SDK method reference docs: collect-payments, send-money,
check-status, account-balance, refunds, qr-payments, business-payments, etc.
One doc per SDK capability.

The shape mirrors API reference norms: What / When / Quick Start / How / Parameters /
Returns / Examples / Related.
-->

# <Capability Name>

## What

<One or two sentences on what this capability does and the M-Pesa feature it wraps.>

## When to Use

<Plain-language triggers. "Use this when you need to ..." — list user-facing verbs so
retrieval surfaces this doc on intent queries, not just API-name queries.>

## Quick Start

```ts
import { createClient } from '@daraja-kit/sdk';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

const result = await mpesa.<method>({ /* args */ });
```

## How It Works

<Numbered steps explaining the call lifecycle and any SDK niceties (auto-polling,
auto-retry, auto-token-refresh, etc.).>

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `<name>` | `<type>` | Yes/No | `<default>` | <description> |

## Returns

```ts
{
  // shape of the result
}
```

## Examples

### <Common use case>

```ts
// Worked example.
```

## Related

- [<related doc>](<../category/filename.md>)
