import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { sanitizeText } from './sanitize.js';

export interface FeedbackEntry {
  reference: string;
  timestamp: string;
  category: 'bug' | 'feature' | 'docs' | 'experience' | 'other';
  message: string;
  context?: {
    lastTool?: string;
    lastError?: string;
  };
  source: 'mcp' | 'http';
}

const RING_BUFFER_MAX = 200;
const FILE_ROTATE_BYTES = 10 * 1024 * 1024;

const ringBuffer: FeedbackEntry[] = [];

function dataDir(): string {
  return process.env.DARAJA_FEEDBACK_DIR || path.resolve(process.cwd(), 'data');
}

function filePath(): string {
  return path.join(dataDir(), 'feedback.jsonl');
}

function rotateIfNeeded(): void {
  const p = filePath();
  if (!fs.existsSync(p)) return;
  const { size } = fs.statSync(p);
  if (size < FILE_ROTATE_BYTES) return;
  const rotated = path.join(dataDir(), `feedback-${Date.now()}.jsonl`);
  fs.renameSync(p, rotated);
}

export function appendFeedback(
  input: Omit<FeedbackEntry, 'reference' | 'timestamp'>,
): FeedbackEntry {
  const entry: FeedbackEntry = {
    reference: `fb_${randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    category: input.category,
    message: sanitizeText(input.message),
    source: input.source,
    ...(input.context
      ? {
          context: {
            ...(input.context.lastTool ? { lastTool: sanitizeText(input.context.lastTool) } : {}),
            ...(input.context.lastError ? { lastError: sanitizeText(input.context.lastError) } : {}),
          },
        }
      : {}),
  };

  ringBuffer.push(entry);
  if (ringBuffer.length > RING_BUFFER_MAX) ringBuffer.shift();

  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    rotateIfNeeded();
    fs.appendFileSync(filePath(), JSON.stringify(entry) + '\n');
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'feedback_persist_failed',
        reference: entry.reference,
        error: err instanceof Error ? err.message : String(err),
      }) + '\n',
    );
  }

  return entry;
}

export function listFeedback(limit = 50): FeedbackEntry[] {
  const slice = ringBuffer.slice(-Math.max(1, Math.min(limit, RING_BUFFER_MAX)));
  return slice.reverse();
}

export function clearRingBuffer(): void {
  ringBuffer.length = 0;
}
