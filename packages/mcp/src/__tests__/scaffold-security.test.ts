import { describe, it, expect } from 'vitest';
import { handleScaffold } from '../tools/scaffold.js';

const ALL_TEMPLATES = [
  { intent: 'donation page', template: 'donation-page' },
  { intent: 'ecommerce store', template: 'ecommerce-checkout' },
  { intent: 'employee payroll', template: 'b2c-payroll' },
  { intent: 'qr payment kiosk', template: 'qr-payment' },
  { intent: 'subscription billing', template: 'subscription' },
];

describe('scaffold — security hardening', () => {
  for (const { intent, template } of ALL_TEMPLATES) {
    describe(`template: ${template}`, () => {
      const result = handleScaffold({ intent });
      const serverJs = result.files.find((f) => f.path === 'server.js')!;
      const packageJson = JSON.parse(result.files.find((f) => f.path === 'package.json')!.content);

      it('includes express-rate-limit dependency', () => {
        expect(packageJson.dependencies['express-rate-limit']).toBeDefined();
      });

      it('imports and uses rate limiting', () => {
        expect(serverJs.content).toContain('rateLimit');
        expect(serverJs.content).toContain("import rateLimit from 'express-rate-limit'");
      });

      it('has amount validation (1-150,000 KES)', () => {
        // All templates should validate amounts at the server level
        expect(serverJs.content).toMatch(/amount\s*<\s*1|amount\s*>\s*150000|1.*150.*000/);
      });
    });
  }

  describe('b2c-payroll specific security', () => {
    const result = handleScaffold({ intent: 'employee payroll' });
    const serverJs = result.files.find((f) => f.path === 'server.js')!;

    it('has batch size limit', () => {
      expect(serverJs.content).toMatch(/payments\.length\s*>\s*100/);
    });

    it('uses verifyCallback for callback handler', () => {
      expect(serverJs.content).toContain('verifyCallback');
    });

    it('imports verifyCallback from SDK', () => {
      expect(serverJs.content).toContain("import { createClient, verifyCallback }");
    });
  });

  describe('ecommerce specific security', () => {
    const result = handleScaffold({ intent: 'ecommerce store' });
    const serverJs = result.files.find((f) => f.path === 'server.js')!;

    it('has server-side PRODUCTS catalog', () => {
      expect(serverJs.content).toContain('const PRODUCTS');
    });

    it('uses server-side price lookup (not client-supplied prices)', () => {
      expect(serverJs.content).toContain('PRODUCTS.find');
      expect(serverJs.content).toContain('product?.price');
    });
  });

  describe('subscription specific security', () => {
    const result = handleScaffold({ intent: 'subscription billing' });
    const serverJs = result.files.find((f) => f.path === 'server.js')!;

    it('has batch limit on charge-all endpoint', () => {
      expect(serverJs.content).toMatch(/\.slice\(0,\s*100\)/);
    });
  });
});
