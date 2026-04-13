import { searchKnowledge, getLlmsTxt } from '../knowledge.js';

interface ExplainInput {
  topic: string;
  depth?: 'brief' | 'detailed';
}

interface ExplainOutput {
  explanation: string;
  relatedTopics: string[];
  sources: string[];
}

export const explainSchema = {
  name: 'daraja_explain',
  description:
    'Get a plain-language explanation of any Daraja/M-Pesa concept, API, flow, or field. ' +
    'Optimized for developers new to M-Pesa. ' +
    'Examples: "STK Push flow", "SecurityCredential", "callbacks", "going live", "shortcode vs till number".',
  inputSchema: {
    type: 'object' as const,
    properties: {
      topic: {
        type: 'string',
        description: 'What to explain.',
      },
      depth: {
        type: 'string',
        enum: ['brief', 'detailed'],
        description: 'How much detail. Default: detailed.',
      },
    },
    required: ['topic'],
  },
};

export function handleExplain(input: ExplainInput): ExplainOutput {
  const results = searchKnowledge(input.topic);

  if (results.length === 0) {
    return {
      explanation:
        `No knowledge found for "${input.topic}". ` +
        'Try broader terms like "payments", "authentication", "callbacks", or "errors".',
      relatedTopics: ['collect-payments', 'authentication', 'callbacks', 'error-codes'],
      sources: [],
    };
  }

  const depth = input.depth ?? 'detailed';
  const primary = results[0];
  const content = depth === 'brief' ? extractSummary(primary.content) : primary.content;

  return {
    explanation: content,
    relatedTopics: results.slice(1, 4).map((r) => r.filename.replace('.md', '')),
    sources: results.slice(0, 3).map((r) => `${r.category}/${r.filename}`),
  };
}

function extractSummary(content: string): string {
  // Return first 2 non-empty, non-heading paragraphs.
  const lines = content.split('\n');
  const paragraphs: string[] = [];
  let current = '';

  for (const line of lines) {
    if (line.startsWith('#') && current) {
      paragraphs.push(current.trim());
      current = '';
      if (paragraphs.length >= 2) break;
    } else if (line.trim() === '' && current) {
      paragraphs.push(current.trim());
      current = '';
      if (paragraphs.length >= 2) break;
    } else if (!line.startsWith('#')) {
      current += line + '\n';
    }
  }
  if (current.trim() && paragraphs.length < 2) paragraphs.push(current.trim());

  return paragraphs.join('\n\n') || content.slice(0, 500);
}
