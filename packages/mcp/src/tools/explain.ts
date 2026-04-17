import { searchKnowledge, getLlmsTxt } from '../knowledge.js';

const CONTRIBUTION_TIP =
  'Spotted an inaccuracy or a gap in this explanation? In a Claude Code session on this repo, run `/daraja-augment-knowledge` with the correction — the slash command handles scrub, validation, and PR submission.';

interface ExplainInput {
  topic: string;
  depth?: 'brief' | 'detailed';
}

export interface SourceDoc {
  path: string;
  sourceUrl: string;
  editUrl: string;
}

interface ExplainOutput {
  explanation: string;
  relatedTopics: string[];
  sources: SourceDoc[];
  contributionTip: string;
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
        description: 'What to explain. Examples: "STK Push", "callbacks", "security", "going live".',
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
      contributionTip: CONTRIBUTION_TIP,
    };
  }

  const depth = input.depth ?? 'detailed';
  const primary = results[0];
  const content = depth === 'brief' ? extractSummary(primary.content) : primary.content;

  return {
    explanation: content,
    relatedTopics: results.slice(1, 4).map((r) => r.filename.replace('.md', '')),
    sources: results.slice(0, 3).map((r) => ({
      path: `${r.category}/${r.filename}`,
      sourceUrl: r.sourceUrl,
      editUrl: r.editUrl,
    })),
    contributionTip: CONTRIBUTION_TIP,
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
