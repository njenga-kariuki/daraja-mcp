# Pattern: B2C Disbursement

Send money to multiple recipients in batch. Used for salary payments, refunds, promotional payouts, and any scenario where you need to disburse funds to a list of people.

## Use Cases

- **Salary payments:** Pay employees monthly.
- **Refunds:** Batch-process refunds for cancelled orders.
- **Promotional payouts:** Send rewards, bonuses, or cashback to customers.
- **Supplier payments:** Pay individual suppliers or freelancers.
- **Dividends:** Distribute earnings to stakeholders.

## The Approach

1. Prepare a list of recipients (from CSV, database, or API).
2. Verify business float is sufficient for the total payout.
3. Iterate through the list, calling `mpesa.send()` for each recipient.
4. Track each disbursement's status via callbacks.
5. Generate a report of successes and failures.
6. Retry failed disbursements.

## Complete Code

### Disbursement Processor (disburse.ts)

```typescript
import { createClient } from '@daraja-kit/sdk';
import fs from 'fs';

const mpesa = createClient({
  consumerKey: process.env.DARAJA_CONSUMER_KEY!,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET!,
});

const CALLBACK_BASE = process.env.MPESA_CALLBACK_BASE_URL!;

// --- Types ---
interface Recipient {
  name: string;
  phone: string;
  amount: number;
  reference?: string;
}

interface DisbursementResult {
  name: string;
  phone: string;
  amount: number;
  status: 'sent' | 'failed';
  conversationId?: string;
  error?: string;
}

// --- Parse CSV ---
function parseCSV(filePath: string): Recipient[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return {
      name: values[headers.indexOf('name')] || 'Unknown',
      phone: values[headers.indexOf('phone')],
      amount: parseInt(values[headers.indexOf('amount')], 10),
      reference: values[headers.indexOf('reference')] || undefined,
    };
  });
}

// --- Process Disbursements ---
async function processDisbursements(recipients: Recipient[]): Promise<DisbursementResult[]> {
  const results: DisbursementResult[] = [];

  // Calculate total
  const total = recipients.reduce((sum, r) => sum + r.amount, 0);
  console.log(`Processing ${recipients.length} disbursements. Total: KES ${total.toLocaleString()}`);

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    console.log(`[${i + 1}/${recipients.length}] Sending KES ${recipient.amount} to ${recipient.name} (${recipient.phone})`);

    // Normalize phone
    const phone = recipient.phone
      .replace(/\s+/g, '')
      .replace(/^0/, '254')
      .replace(/^\+/, '');

    try {
      const result = await mpesa.send({
        amount: recipient.amount,
        phone,
        type: 'business',
        remarks: recipient.reference || `Disbursement to ${recipient.name}`,
        callbackUrl: `${CALLBACK_BASE}/api/disbursement/callback`,
      });

      results.push({
        name: recipient.name,
        phone,
        amount: recipient.amount,
        status: 'sent',
        conversationId: result.conversationId,
      });

      console.log(`  Sent. ConversationID: ${result.conversationId}`);
    } catch (error: any) {
      results.push({
        name: recipient.name,
        phone,
        amount: recipient.amount,
        status: 'failed',
        error: error.message || 'Unknown error',
      });

      console.error(`  Failed: ${error.message}`);
    }

    // Small delay between requests to avoid rate limiting
    if (i < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

// --- Generate Report ---
function generateReport(results: DisbursementResult[]): void {
  const sent = results.filter(r => r.status === 'sent');
  const failed = results.filter(r => r.status === 'failed');
  const totalSent = sent.reduce((sum, r) => sum + r.amount, 0);

  console.log('\n--- Disbursement Report ---');
  console.log(`Total recipients: ${results.length}`);
  console.log(`Sent: ${sent.length} (KES ${totalSent.toLocaleString()})`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed disbursements:');
    for (const f of failed) {
      console.log(`  ${f.name} (${f.phone}): KES ${f.amount} - ${f.error}`);
    }
  }

  // Write results to file
  const reportPath = `disbursement-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nFull report written to: ${reportPath}`);
}

// --- Main ---
async function main() {
  // Option 1: Load recipients from CSV
  // CSV format: name,phone,amount,reference
  // John Doe,0712345678,5000,Salary Jan
  // Jane Smith,0723456789,7500,Salary Jan

  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npx tsx disburse.ts <recipients.csv>');
    process.exit(1);
  }

  const recipients = parseCSV(csvPath);
  console.log(`Loaded ${recipients.length} recipients from ${csvPath}`);

  const results = await processDisbursements(recipients);
  generateReport(results);
}

main().catch(console.error);
```

### Callback Server (server.ts)

```typescript
import express from 'express';

const app = express();
app.use(express.json());

// --- Track Disbursement Results ---
// In production, use a database
const disbursementResults = new Map<string, any>();

app.post('/api/disbursement/callback', (req, res) => {
  const { Result } = req.body;
  const conversationId = Result.ConversationID;

  if (Result.ResultCode === 0) {
    const params = Result.ResultParameters.ResultParameter;
    const receipt = params.find((p: any) => p.Key === 'TransactionReceipt')?.Value;
    const amount = params.find((p: any) => p.Key === 'TransactionAmount')?.Value;
    const recipient = params.find((p: any) => p.Key === 'ReceiverPartyPublicName')?.Value;

    console.log(`Disbursement confirmed: KES ${amount} to ${recipient}. Receipt: ${receipt}`);

    disbursementResults.set(conversationId, {
      status: 'confirmed',
      receipt,
      amount,
      recipient,
      completedAt: new Date(),
    });
  } else {
    console.error(`Disbursement failed: ${Result.ResultCode} - ${Result.ResultDesc}`);

    disbursementResults.set(conversationId, {
      status: 'failed',
      resultCode: Result.ResultCode,
      resultDesc: Result.ResultDesc,
      completedAt: new Date(),
    });
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// --- Check Disbursement Status ---
app.get('/api/disbursement/:conversationId', (req, res) => {
  const result = disbursementResults.get(req.params.conversationId);
  if (!result) {
    return res.json({ status: 'pending', message: 'Waiting for callback.' });
  }
  return res.json(result);
});

// --- Get All Results ---
app.get('/api/disbursements', (_req, res) => {
  const all = Array.from(disbursementResults.entries()).map(([id, data]) => ({
    conversationId: id,
    ...data,
  }));
  return res.json(all);
});

app.listen(3000, () => console.log('Disbursement callback server running on port 3000'));
```

### Sample CSV (recipients.csv)

```csv
name,phone,amount,reference
John Doe,0712345678,5000,Salary Jan 2026
Jane Smith,0723456789,7500,Salary Jan 2026
Bob Wilson,0734567890,4000,Salary Jan 2026
Alice Njeri,0745678901,6000,Salary Jan 2026
```

### Running the Disbursement

```bash
# Terminal 1: Start the callback server
npx tsx server.ts

# Terminal 2: Start ngrok
ngrok http 3000
# Copy the HTTPS URL to MPESA_CALLBACK_BASE_URL

# Terminal 3: Run the disbursement
MPESA_CALLBACK_BASE_URL=https://abc123.ngrok-free.app npx tsx disburse.ts recipients.csv
```

## Status Tracking Flow

```
CSV loaded
  |
  v
mpesa.send() called -----> "sent" (accepted by Daraja)
  |                            |
  |                            v
  |                    Callback received?
  |                    /              \
  |                  Yes               No (timeout)
  |                  |                  |
  |            ResultCode 0?      Queue for status check
  |            /          \         via mpesa.status()
  |          Yes           No
  |          |              |
  |     "confirmed"    "failed"
  |                        |
  |                   Retry eligible?
  |                   /          \
  |                 Yes           No
  |                  |             |
  |            Retry send     Mark as failed
  |                           in final report
```

## Reconciliation

After all callbacks arrive (or after a reasonable timeout), reconcile:

```typescript
async function reconcile(
  results: DisbursementResult[],
  callbackResults: Map<string, any>
): Promise<void> {
  for (const result of results) {
    if (result.status !== 'sent' || !result.conversationId) continue;

    const callback = callbackResults.get(result.conversationId);

    if (!callback) {
      console.log(`No callback yet for ${result.name} (${result.conversationId}). Checking status...`);

      // Use Transaction Status API to check
      try {
        await mpesa.status({
          transactionId: result.conversationId,
          callbackUrl: `${CALLBACK_BASE}/api/disbursement/callback`,
        });
      } catch (err) {
        console.error(`Status check failed for ${result.conversationId}`);
      }
    } else if (callback.status === 'failed') {
      console.log(`Disbursement to ${result.name} failed: ${callback.resultDesc}`);
      // TODO: Queue for retry or escalate
    }
  }
}
```

## Production Considerations

1. **Pre-check balance.** Call `mpesa.balance()` before starting the batch to ensure sufficient float.
2. **Rate limiting.** Daraja has rate limits. Add 1-2 second delays between sends. For large batches (100+), consider spreading across time.
3. **Database tracking.** Store every disbursement attempt with: recipient, amount, conversationId, status, callback result, timestamp.
4. **Idempotency.** Track which recipients have been paid in the current batch. If the script crashes and restarts, skip already-sent recipients.
5. **Retry strategy.** For failed disbursements, retry up to 3 times with increasing delays. Some failures (wrong number) should not be retried.
6. **Audit trail.** Keep a complete log of all disbursements for financial auditing and compliance.
7. **Approval workflow.** For large batches, require manager approval before processing.
8. **Notifications.** Notify the operator (Slack, email) when batch processing completes, especially if there are failures.
