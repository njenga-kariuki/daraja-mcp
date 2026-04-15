import { describe, it, expect } from 'vitest';
import { handleValidate } from '../tools/validate.js';

describe('validate — security checks', () => {
  describe('unbounded batch loop', () => {
    it('flags for-loop over payments without size guard', () => {
      const code = `
        app.post('/api/send/batch', async (req, res) => {
          const { payments } = req.body;
          for (const p of payments) {
            await mpesa.send({ amount: p.amount, phone: p.phone });
          }
        });
      `;
      const result = handleValidate({ code });
      const batchIssue = result.issues.find((i) => i.message.includes('Unbounded batch'));
      expect(batchIssue).toBeDefined();
      expect(batchIssue!.severity).toBe('error');
    });

    it('does NOT flag when size guard exists', () => {
      const code = `
        app.post('/api/send/batch', async (req, res) => {
          const { payments } = req.body;
          if (payments.length > 100) throw new Error('too many');
          for (const p of payments) {
            await mpesa.send({ amount: p.amount, phone: p.phone });
          }
        });
      `;
      const result = handleValidate({ code });
      const batchIssue = result.issues.find((i) => i.message.includes('Unbounded batch'));
      expect(batchIssue).toBeUndefined();
    });
  });

  describe('missing amount bounds', () => {
    it('flags when req.body.amount passed without validation', () => {
      const code = `
        const amount = Math.round(Number(req.body.amount));
        await mpesa.collect({ amount, phone });
      `;
      const result = handleValidate({ code });
      const amountIssue = result.issues.find((i) => i.message.includes('amount'));
      expect(amountIssue).toBeDefined();
    });

    it('does NOT flag when amount bounds check exists', () => {
      const code = `
        const amount = Math.round(Number(req.body.amount));
        if (amount < 1 || amount > 150000) return res.status(400).json({ error: 'bad amount' });
        await mpesa.collect({ amount, phone });
      `;
      const result = handleValidate({ code });
      const amountIssue = result.issues.find((i) => i.message.includes('User-supplied amount'));
      expect(amountIssue).toBeUndefined();
    });
  });

  describe('callback without IP check', () => {
    it('flags callback handler without IP verification', () => {
      const code = `
        app.post('/api/callback', (req, res) => {
          console.log(req.body);
          res.json({ ResultCode: 0 });
        });
      `;
      const result = handleValidate({ code });
      const ipIssue = result.issues.find((i) => i.message.includes('IP verification'));
      expect(ipIssue).toBeDefined();
      expect(ipIssue!.severity).toBe('warning');
    });

    it('does NOT flag when verifyCallback is used', () => {
      const code = `
        app.post('/api/callback', (req, res) => {
          const result = verifyCallback(req.body, { ip: req.ip });
          if (!result.valid) return res.status(403).end();
          res.json({ ResultCode: 0 });
        });
      `;
      const result = handleValidate({ code });
      const ipIssue = result.issues.find((i) => i.message.includes('IP verification'));
      expect(ipIssue).toBeUndefined();
    });

    it('does NOT flag when there is no callback endpoint', () => {
      const code = `
        app.post('/api/donate', async (req, res) => {
          const result = await mpesa.collect({ amount: 100, phone: '0712345678' });
          res.json(result);
        });
      `;
      const result = handleValidate({ code });
      const ipIssue = result.issues.find((i) => i.message.includes('IP verification'));
      expect(ipIssue).toBeUndefined();
    });
  });

  describe('callback without idempotency', () => {
    it('flags callback handler without deduplication', () => {
      const code = `
        app.post('/api/callback', (req, res) => {
          console.log(req.body);
          res.json({ ResultCode: 0 });
        });
      `;
      const result = handleValidate({ code });
      const dedupIssue = result.issues.find((i) => i.message.includes('duplicate'));
      expect(dedupIssue).toBeDefined();
      expect(dedupIssue!.severity).toBe('info');
    });

    it('does NOT flag when verifyCallback is used', () => {
      const code = `
        app.post('/api/callback', (req, res) => {
          const result = verifyCallback(req.body, { ip: req.ip });
          res.json({ ResultCode: 0 });
        });
      `;
      const result = handleValidate({ code });
      const dedupIssue = result.issues.find((i) => i.message.includes('duplicate'));
      expect(dedupIssue).toBeUndefined();
    });
  });
});

describe('validate — scaffold roundtrip (scaffold output scores 100)', () => {
  it('donation page server.js passes validation', async () => {
    const { handleScaffold } = await import('../tools/scaffold.js');
    const scaffold = handleScaffold({ intent: 'donation page' });
    const serverJs = scaffold.files.find((f) => f.path === 'server.js')!;
    const result = handleValidate({ code: serverJs.content });

    // Filter out info-level issues (acceptable)
    const errors = result.issues.filter((i) => i.severity === 'error');
    const warnings = result.issues.filter((i) => i.severity === 'warning');

    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('b2c payroll server.js passes validation', async () => {
    const { handleScaffold } = await import('../tools/scaffold.js');
    const scaffold = handleScaffold({ intent: 'employee payroll' });
    const serverJs = scaffold.files.find((f) => f.path === 'server.js')!;
    const result = handleValidate({ code: serverJs.content });

    const errors = result.issues.filter((i) => i.severity === 'error');
    const warnings = result.issues.filter((i) => i.severity === 'warning');

    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('ecommerce checkout server.js passes validation', async () => {
    const { handleScaffold } = await import('../tools/scaffold.js');
    const scaffold = handleScaffold({ intent: 'ecommerce store' });
    const serverJs = scaffold.files.find((f) => f.path === 'server.js')!;
    const result = handleValidate({ code: serverJs.content });

    const errors = result.issues.filter((i) => i.severity === 'error');
    const warnings = result.issues.filter((i) => i.severity === 'warning');

    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
