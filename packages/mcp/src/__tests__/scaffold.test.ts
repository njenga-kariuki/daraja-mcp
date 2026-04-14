import { describe, it, expect } from 'vitest';
import { handleScaffold } from '../tools/scaffold.js';

const TEMPLATE_INTENTS = [
  { intent: 'donation page', expectedTemplate: 'donation-page' },
  { intent: 'ecommerce store', expectedTemplate: 'ecommerce-checkout' },
  { intent: 'employee payroll', expectedTemplate: 'b2c-payroll' },
  { intent: 'qr payment kiosk', expectedTemplate: 'qr-payment' },
  { intent: 'subscription billing', expectedTemplate: 'subscription' },
];

describe('handleScaffold — structured nextSteps', () => {
  for (const { intent, expectedTemplate } of TEMPLATE_INTENTS) {
    describe(`template: "${intent}"`, () => {
      const result = handleScaffold({ intent });

      it('returns the expected template', () => {
        expect(result.template).toBe(expectedTemplate);
      });

      it('generates files', () => {
        expect(result.files.length).toBeGreaterThan(0);
        expect(result.files.some((f) => f.path === 'package.json')).toBe(true);
        expect(result.files.some((f) => f.path === 'server.js')).toBe(true);
      });

      it('has nextSteps array with at least 3 steps', () => {
        expect(Array.isArray(result.nextSteps)).toBe(true);
        expect(result.nextSteps.length).toBeGreaterThanOrEqual(3);
      });

      it('each step has step number, action, and detail', () => {
        for (const step of result.nextSteps) {
          expect(step.step).toBeTypeOf('number');
          expect(step.action).toBeTypeOf('string');
          expect(step.detail).toBeTypeOf('string');
          expect(step.detail.length).toBeGreaterThan(5);
        }
      });

      it('includes npm install command in steps', () => {
        const hasInstall = result.nextSteps.some(
          (s) => s.command === 'npm install' || s.detail.includes('npm install'),
        );
        expect(hasInstall).toBe(true);
      });

      it('references test phone number 254708374149', () => {
        const hasTestPhone = result.nextSteps.some((s) => s.detail.includes('254708374149'));
        expect(hasTestPhone).toBe(true);
      });

      it('has zeroConfigNote', () => {
        expect(result.zeroConfigNote).toBeTypeOf('string');
        expect(result.zeroConfigNote.length).toBeGreaterThan(10);
        expect(result.zeroConfigNote).toContain('254708374149');
      });

      it('still has instructions string (backward compat)', () => {
        expect(result.instructions).toBeTypeOf('string');
        expect(result.instructions).toContain('npm install');
      });
    });
  }
});

describe('handleScaffold — B2C payroll includes callback setup step', () => {
  it('has a setup_callback step for B2C template', () => {
    const result = handleScaffold({ intent: 'employee payroll' });
    const callbackStep = result.nextSteps.find((s) => s.action === 'setup_callback');
    expect(callbackStep).toBeTruthy();
    expect(callbackStep!.command).toContain('ngrok');
  });

  it('does NOT have a setup_callback step for donation template', () => {
    const result = handleScaffold({ intent: 'donation page' });
    const callbackStep = result.nextSteps.find((s) => s.action === 'setup_callback');
    expect(callbackStep).toBeUndefined();
  });
});
