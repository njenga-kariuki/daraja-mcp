interface GoLiveInput {
  code?: string;
  has_shortcode?: boolean;
  has_go_live_letter?: boolean;
}

interface ChecklistItem {
  item: string;
  status: 'done' | 'pending' | 'blocking';
  detail: string;
}

interface GoLiveOutput {
  checklist: ChecklistItem[];
  ready: boolean;
  summary: string;
}

export const goLiveSchema = {
  name: 'daraja_go_live',
  description:
    'Get a production readiness checklist for your M-Pesa integration. ' +
    'Evaluates what you have and tells you exactly what is left.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      code: {
        type: 'string',
        description: 'Your integration code (optional, for analysis).',
      },
      has_shortcode: {
        type: 'boolean',
        description: 'Whether you have a production M-Pesa shortcode/till number.',
      },
      has_go_live_letter: {
        type: 'boolean',
        description: 'Whether you have received go-live approval from Safaricom.',
      },
    },
  },
};

export function handleGoLive(input: GoLiveInput): GoLiveOutput {
  const checklist: ChecklistItem[] = [];

  // 1. Production shortcode
  checklist.push({
    item: 'Production M-Pesa shortcode or till number',
    status: input.has_shortcode ? 'done' : 'blocking',
    detail: input.has_shortcode
      ? 'You have a production shortcode.'
      : 'Apply for an M-Pesa Paybill or Till number through Safaricom. This is a business registration process.',
  });

  // 2. Daraja production app
  checklist.push({
    item: 'Daraja production app created',
    status: 'pending',
    detail:
      'Go to developer.safaricom.co.ke → My Apps → Add a New App. Select production APIs. ' +
      'Note: a production app is automatically created during the Go Live process.',
  });

  // 3. Go-live letter
  checklist.push({
    item: 'Go-live approval from Safaricom',
    status: input.has_go_live_letter ? 'done' : 'blocking',
    detail: input.has_go_live_letter
      ? 'Go-live approval received.'
      : 'Submit a go-live request letter on company letterhead to m-pesabusiness@safaricom.co.ke. ' +
        'Include: company name, registration number, shortcode, APIs needed, callback URLs, and contact info. ' +
        'Approval typically takes 1-3 business days.',
  });

  // 4. Production credentials
  checklist.push({
    item: 'Production consumer key and secret',
    status: input.has_go_live_letter ? 'pending' : 'blocking',
    detail:
      'Safaricom sends production credentials after go-live approval. ' +
      'Update DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET with production values.',
  });

  // 5. Production passkey
  checklist.push({
    item: 'Production passkey (for STK Push)',
    status: 'pending',
    detail:
      'Safaricom emails the production passkey after go-live approval. ' +
      'Update MPESA_PASSKEY or pass it to createClient({ passkey: "..." }).',
  });

  // 6. Production certificate
  checklist.push({
    item: 'Production certificate (for B2C/Status/Balance/Reversal)',
    status: 'pending',
    detail:
      'Download ProductionCertificate.cer from the Daraja portal. ' +
      'Update certPath to point to the production certificate.',
  });

  // 7. HTTPS callback URLs
  checklist.push({
    item: 'Public HTTPS callback URLs',
    status: 'pending',
    detail:
      'Deploy your server to a hosting provider (Railway, Render, Cloud Run, etc.). ' +
      'Ensure callback URLs use HTTPS with a valid SSL certificate. No IP addresses.',
  });

  // 8. Environment config
  checklist.push({
    item: 'Environment set to production',
    status: 'pending',
    detail:
      'Set env: "production" in createClient() or DARAJA_ENV=production. ' +
      'This switches from sandbox.safaricom.co.ke to api.safaricom.co.ke.',
  });

  // 9. Code analysis
  if (input.code) {
    const issues: string[] = [];
    if (input.code.includes('sandbox')) issues.push('Code references "sandbox" — update for production');
    if (input.code.includes('174379')) issues.push('Sandbox shortcode 174379 found — replace with production shortcode');
    if (input.code.includes('Safaricom999') || input.code.includes('testapi'))
      issues.push('Sandbox credentials found in code — use production credentials');
    if (input.code.includes('example.com') || input.code.includes('ngrok'))
      issues.push('Non-production callback URL found — use your production domain');

    if (issues.length > 0) {
      checklist.push({
        item: 'Code updated for production',
        status: 'pending',
        detail: 'Issues found:\n- ' + issues.join('\n- '),
      });
    } else {
      checklist.push({
        item: 'Code updated for production',
        status: 'done',
        detail: 'No sandbox-specific code detected.',
      });
    }
  }

  // 10. Error handling
  checklist.push({
    item: 'Error handling and retry logic',
    status: 'pending',
    detail:
      'Ensure your production code: handles all MpesaError types, retries on transient failures, ' +
      'stores transaction IDs for reconciliation, and has idempotency keys to prevent duplicate charges.',
  });

  const blocking = checklist.filter((c) => c.status === 'blocking').length;
  const pending = checklist.filter((c) => c.status === 'pending').length;
  const ready = blocking === 0 && pending === 0;

  return {
    checklist,
    ready,
    summary: ready
      ? 'All items complete. You are ready to go live.'
      : `${blocking} blocking item(s), ${pending} pending item(s). Resolve blocking items first.`,
  };
}
