import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { handleFeedback, feedbackSchema } from '../tools/feedback.js';
import { appendFeedback, listFeedback, clearRingBuffer } from '../feedback-store.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daraja-feedback-test-'));
process.env.DARAJA_FEEDBACK_DIR = tmpDir;

beforeEach(() => {
  clearRingBuffer();
  const file = path.join(tmpDir, 'feedback.jsonl');
  if (fs.existsSync(file)) fs.unlinkSync(file);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DARAJA_FEEDBACK_DIR;
});

describe('feedbackSchema', () => {
  it('exposes required input fields', () => {
    expect(feedbackSchema.name).toBe('daraja_feedback');
    expect(feedbackSchema.inputSchema.required).toEqual(['category', 'message']);
    expect(feedbackSchema.inputSchema.properties.category.enum).toContain('bug');
    expect(feedbackSchema.inputSchema.properties.category.enum).toContain('feature');
  });
});

describe('handleFeedback — input validation', () => {
  it('rejects empty message', () => {
    expect(() => handleFeedback({ category: 'bug', message: '' })).toThrow(/message is required/);
    expect(() => handleFeedback({ category: 'bug', message: '   ' })).toThrow(/message is required/);
  });

  it('rejects invalid category', () => {
    expect(() => handleFeedback({ category: 'invalid' as any, message: 'hello' })).toThrow(/category must be/);
  });

  it('rejects oversized message', () => {
    const huge = 'x'.repeat(3000);
    expect(() => handleFeedback({ category: 'other', message: huge })).toThrow(/2000 character/);
  });

  it('returns a reference ID for valid submissions', () => {
    const result = handleFeedback({ category: 'bug', message: 'Something is broken' });
    expect(result.ok).toBe(true);
    expect(result.reference).toMatch(/^fb_[a-f0-9]{8}$/);
    expect(result.message).toContain(result.reference);
  });

  it('accepts all valid categories', () => {
    for (const category of ['bug', 'feature', 'docs', 'experience', 'other'] as const) {
      const result = handleFeedback({ category, message: `test ${category}` });
      expect(result.ok).toBe(true);
    }
  });
});

describe('handleFeedback — PII sanitization', () => {
  it('masks phone numbers in message before storing', () => {
    handleFeedback({ category: 'bug', message: 'STK to 254708374149 timed out' });
    const entries = listFeedback();
    expect(entries[0].message).toBe('STK to 254708***149 timed out');
    expect(entries[0].message).not.toContain('254708374149');
  });

  it('masks consumer key patterns in message', () => {
    handleFeedback({
      category: 'docs',
      message: 'docs say to paste consumerKey: "aFPNikDVDCxaOgkW2hXjo6VEXnOgVCludG5UGpowlEU8AsIm"',
    });
    const [entry] = listFeedback();
    expect(entry.message).not.toContain('aFPNikDVDCx');
    expect(entry.message).toContain('***');
  });

  it('masks PII in context fields', () => {
    handleFeedback({
      category: 'bug',
      message: 'failed',
      context: { lastTool: 'daraja_test_sandbox', lastError: 'timeout for 254708374149' },
    });
    const [entry] = listFeedback();
    expect(entry.context?.lastError).toBe('timeout for 254708***149');
    expect(entry.context?.lastTool).toBe('daraja_test_sandbox');
  });
});

describe('feedback persistence', () => {
  it('appends to JSONL file', () => {
    handleFeedback({ category: 'feature', message: 'add M-Pesa Global' });
    const file = path.join(tmpDir, 'feedback.jsonl');
    expect(fs.existsSync(file)).toBe(true);
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.category).toBe('feature');
    expect(parsed.message).toBe('add M-Pesa Global');
    expect(parsed.source).toBe('mcp');
  });

  it('records source as "http" when called via appendFeedback directly', () => {
    appendFeedback({ category: 'bug', message: 'http test', source: 'http' });
    const [entry] = listFeedback();
    expect(entry.source).toBe('http');
  });

  it('caps in-memory ring buffer at 200 entries', () => {
    for (let i = 0; i < 250; i++) {
      appendFeedback({ category: 'other', message: `msg ${i}`, source: 'mcp' });
    }
    const all = listFeedback(200);
    expect(all).toHaveLength(200);
    expect(all[0].message).toBe('msg 249');
    expect(all[199].message).toBe('msg 50');
  });

  it('listFeedback returns newest first', () => {
    handleFeedback({ category: 'bug', message: 'first' });
    handleFeedback({ category: 'bug', message: 'second' });
    const entries = listFeedback();
    expect(entries[0].message).toBe('second');
    expect(entries[1].message).toBe('first');
  });
});
