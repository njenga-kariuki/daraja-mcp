import { appendFeedback, type FeedbackEntry } from '../feedback-store.js';

interface FeedbackInput {
  category: 'bug' | 'feature' | 'docs' | 'experience' | 'other';
  message: string;
  context?: {
    lastTool?: string;
    lastError?: string;
  };
}

interface FeedbackOutput {
  ok: true;
  reference: string;
  message: string;
}

const VALID_CATEGORIES: FeedbackInput['category'][] = ['bug', 'feature', 'docs', 'experience', 'other'];
const MAX_MESSAGE_LENGTH = 2000;

export const feedbackSchema = {
  name: 'daraja_feedback',
  description:
    'Submit feedback about the Daraja 4.0 toolkit — bug reports, feature requests, documentation gaps, or general experience. ' +
    'User-initiated and opt-in. Messages are PII-sanitized (phone numbers and credentials masked) before they are stored. ' +
    'Use this to tell the Daraja team what is not working, what is missing, or what could be better. ' +
    'Examples: "The diagnose tool did not catch this error", "Please add support for M-Pesa Global", "The callback docs were confusing".',
  inputSchema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        enum: VALID_CATEGORIES,
        description:
          'Type of feedback. bug=something is broken, feature=missing capability, docs=unclear or wrong documentation, experience=general UX feedback, other=anything else.',
      },
      message: {
        type: 'string',
        description: 'The feedback content. Plain text, up to 2000 characters.',
        maxLength: MAX_MESSAGE_LENGTH,
      },
      context: {
        type: 'object',
        description: 'Optional context linking the feedback to a specific tool or error.',
        properties: {
          lastTool: {
            type: 'string',
            description: 'Name of the most recent Daraja tool invocation this feedback is about.',
          },
          lastError: {
            type: 'string',
            description: 'Error message or code this feedback relates to, if any.',
          },
        },
      },
    },
    required: ['category', 'message'],
  },
};

export function handleFeedback(input: FeedbackInput): FeedbackOutput {
  if (!input || typeof input.message !== 'string' || input.message.trim().length === 0) {
    throw new Error('message is required and must be a non-empty string');
  }
  if (input.message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`message exceeds ${MAX_MESSAGE_LENGTH} character limit`);
  }
  if (!VALID_CATEGORIES.includes(input.category)) {
    throw new Error(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  const entry: FeedbackEntry = appendFeedback({
    category: input.category,
    message: input.message,
    context: input.context,
    source: 'mcp',
  });

  return {
    ok: true,
    reference: entry.reference,
    message: `Thanks — your feedback was recorded as ${entry.reference}. The Daraja team reviews submissions to improve the toolkit.`,
  };
}
