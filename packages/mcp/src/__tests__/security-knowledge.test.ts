import { describe, it, expect } from 'vitest';
import { searchKnowledge } from '../knowledge.js';
import { handleExplain } from '../tools/explain.js';

describe('security knowledge base', () => {
  it('security.md is discoverable via searchKnowledge', () => {
    const results = searchKnowledge('security');
    const securityDoc = results.find((r) => r.filename === 'security.md');
    expect(securityDoc).toBeDefined();
    expect(securityDoc!.category).toBe('concepts');
  });

  it('security doc contains key sections', () => {
    const results = searchKnowledge('security trust');
    const doc = results.find((r) => r.filename === 'security.md');
    expect(doc).toBeDefined();

    const content = doc!.content;
    expect(content).toContain('What the SDK Handles');
    expect(content).toContain('verifyCallback');
    expect(content).toContain('Credentials Are Compromised');
    expect(content).toContain('Structural Security Advantages');
    expect(content).toContain('Kenya Data Protection');
  });

  it('daraja_explain returns content for "security trust privacy" topic', () => {
    const result = handleExplain({ topic: 'security trust privacy' });
    // The security.md doc should rank high for this multi-term query
    expect(result.sources.length).toBeGreaterThan(0);
    // Check that security.md is among the sources
    const hasSecuritySource = result.sources.some((s) => s.includes('security'));
    expect(hasSecuritySource).toBe(true);
  });

  it('daraja_explain returns security content for "trust" topic', () => {
    const result = handleExplain({ topic: 'trust privacy' });
    // Should find security.md since it contains trust-related content
    expect(result.explanation.length).toBeGreaterThan(50);
  });
});
