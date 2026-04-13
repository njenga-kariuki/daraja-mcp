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

  // Score: start at 100, deduct for issues.
  const deductions = { error: 20, warning: 10, info: 2 };
  const score = Math.max(
    0,
    100 - issues.reduce((s, i) => s + deductions[i.severity], 0),
  );

  return { issues, score };
}
