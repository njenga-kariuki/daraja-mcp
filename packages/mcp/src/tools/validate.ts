interface ValidateInput {
  code: string;
  filename?: string;
}

interface Issue {
  severity: 'error' | 'warning' | 'info';
  line?: number;
  message: string;
  fix: string;
}

interface ValidateOutput {
  issues: Issue[];
  score: number;
}

export const validateSchema = {
  name: 'daraja_validate',
  description:
    'Validate code that uses the Daraja/M-Pesa APIs or @daraja-kit/sdk for common mistakes: ' +
    'wrong phone formats, missing auth, hardcoded credentials, incorrect callback URLs, ' +
    'wrong field lengths, missing error handling.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      code: { type: 'string', description: 'The source code to validate.' },
      filename: { type: 'string', description: 'Filename for context.' },
    },
    required: ['code'],
  },
};

const CHECKS: Array<{
  pattern: RegExp;
  severity: Issue['severity'];
  message: string;
  fix: string;
}> = [
  // Hardcoded credentials
  {
    pattern: /(?:consumer[_-]?key|consumer[_-]?secret)\s*[:=]\s*['"][A-Za-z0-9]{10,}['"]/i,
    severity: 'error',
    message: 'Hardcoded consumer key/secret detected',
    fix: 'Use environment variables: process.env.DARAJA_CONSUMER_KEY and process.env.DARAJA_CONSUMER_SECRET',
  },
  {
    pattern: /passkey\s*[:=]\s*['"]bfb279f9aa.*?['"]/i,
    severity: 'warning',
    message: 'Sandbox passkey hardcoded — will break in production',
    fix: 'Use environment variables or the SDK sandbox defaults (createClient() auto-loads sandbox credentials)',
  },
  // Phone format issues
  {
    pattern: /(?:phone|msisdn)\s*[:=]\s*['"]07\d{8}['"]/,
    severity: 'warning',
    message: 'Phone number in 07XX format may not work with Daraja directly',
    fix: 'The SDK normalizes phone numbers automatically. If calling Daraja directly, use 254XXXXXXXXX format.',
  },
  // Missing error handling
  {
    pattern: /\.collect\s*\(|\.send\s*\(|stkpush/i,
    severity: 'info',
    message: 'Ensure M-Pesa calls have try/catch error handling',
    fix: 'Wrap M-Pesa calls in try/catch. The SDK throws MpesaError with a .suggestion field for each failure.',
  },
  // Callback URL issues
  {
    pattern: /https?:\/\/localhost/,
    severity: 'error',
    message: 'localhost callback URL — Daraja cannot reach this',
    fix: 'Use ngrok for local dev: npx ngrok http 3000. Use the https URL from ngrok as your callback URL.',
  },
  {
    pattern: /http:\/\/(?!localhost)/,
    severity: 'error',
    message: 'HTTP callback URL — Daraja requires HTTPS',
    fix: 'Callback URLs must use HTTPS with a valid SSL certificate.',
  },
  // Field length issues
  {
    pattern: /AccountReference\s*[:=]\s*['"].{13,}['"]/,
    severity: 'error',
    message: 'AccountReference exceeds 12 character limit',
    fix: 'Truncate AccountReference to 12 characters. The SDK does this automatically.',
  },
  {
    pattern: /TransactionDesc\s*[:=]\s*['"].{14,}['"]/,
    severity: 'warning',
    message: 'TransactionDesc may exceed limit — keep under 13 chars in request (182 total with whitespace)',
    fix: 'Keep TransactionDesc short. Exceeding 182 chars total causes silent failures (error 1025/9999).',
  },
  // Security issues
  {
    pattern: /Safaricom999/,
    severity: 'warning',
    message: 'Sandbox initiator password in code — remove before production',
    fix: 'Use the SDK sandbox defaults or environment variables. Never commit production credentials.',
  },
  // Missing callback ACK
  {
    pattern: /\/callback/i,
    severity: 'info',
    message: 'Callback endpoint detected — ensure it returns { ResultCode: 0, ResultDesc: "Accepted" }',
    fix: 'Daraja expects a JSON ACK from your callback. Failing to respond correctly may cause retries or missed events.',
  },
];

// ── Context-aware security checks ─────────────────────────────────────
// These only fire when a prerequisite pattern is found in the code.

const SECURITY_CHECKS: Array<{
  guard: RegExp;
  absent: RegExp;
  severity: Issue['severity'];
  message: string;
  fix: string;
}> = [
  // Unbounded batch loop — fires when code loops over a payments/recipients array
  {
    guard: /for\s*\(.*(?:payments|recipients|batch)\b/i,
    absent: /\.length\s*>\s*\d+|\.slice\s*\(/,
    severity: 'error',
    message: 'Unbounded batch loop — no size limit on payment array',
    fix: 'Add a batch size guard: if (payments.length > 100) throw new Error("Max 100 payments per batch"). Prevents accidental mass disbursement.',
  },
  // Missing amount bounds — fires when amount comes from user input (req.body)
  {
    guard: /req\.body\.amount|req\.body\)?\s*;\s*.*amount/,
    absent: /amount\s*[<>]\s*\d|amount\s*>=?\s*1|amount\s*<=?\s*150/,
    severity: 'warning',
    message: 'User-supplied amount passed without bounds checking',
    fix: 'Add server-side validation: if (amount < 1 || amount > 150000) return res.status(400).json({ error: "Amount must be 1-150,000 KES" })',
  },
  // Callback without IP verification — fires when callback POST handler exists
  {
    guard: /(?:app|router)\s*\.post\s*\(\s*['"].*callback/i,
    absent: /(?:req\.ip|x-forwarded|allowedIPs|verifyCallback|safaricom.*ip)/i,
    severity: 'warning',
    message: 'Callback endpoint has no IP verification — anyone can POST fake callbacks',
    fix: 'Use verifyCallback() from @daraja-kit/sdk to validate the request source. Daraja callbacks come from Safaricom IPs only.',
  },
  // Callback without idempotency — fires when callback handler exists
  {
    guard: /(?:app|router)\s*\.post\s*\(\s*['"].*callback/i,
    absent: /ConversationID|processedIds|idempoten|duplicate|verifyCallback/i,
    severity: 'info',
    message: 'Callback handler does not track processed transactions — duplicates may be processed twice',
    fix: 'Track ConversationID or TransactionID to prevent duplicate processing. verifyCallback() from @daraja-kit/sdk includes built-in idempotency.',
  },
];

export function handleValidate(input: ValidateInput): ValidateOutput {
  const issues: Issue[] = [];
  const lines = input.code.split('\n');

  for (const check of CHECKS) {
    // Check whole code first.
    if (check.pattern.test(input.code)) {
      // Find the line number.
      let lineNum: number | undefined;
      for (let i = 0; i < lines.length; i++) {
        if (check.pattern.test(lines[i])) {
          lineNum = i + 1;
          break;
        }
      }
      issues.push({
        severity: check.severity,
        line: lineNum,
        message: check.message,
        fix: check.fix,
      });
    }
  }

  // Context-aware security checks: only flag when the relevant pattern exists.
  for (const check of SECURITY_CHECKS) {
    if (check.guard.test(input.code) && !check.absent.test(input.code)) {
      // Find the line matching the guard pattern.
      let lineNum: number | undefined;
      for (let i = 0; i < lines.length; i++) {
        if (check.guard.test(lines[i])) {
          lineNum = i + 1;
          break;
        }
      }
      issues.push({
        severity: check.severity,
        line: lineNum,
        message: check.message,
        fix: check.fix,
      });
    }
  }

  // Score: start at 100, deduct for issues.
  const deductions = { error: 20, warning: 10, info: 2 };
  const score = Math.max(
    0,
    100 - issues.reduce((s, i) => s + deductions[i.severity], 0),
  );

  return { issues, score };
}
