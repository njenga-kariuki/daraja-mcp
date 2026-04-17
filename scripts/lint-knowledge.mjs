#!/usr/bin/env node
// Lint the knowledge base against the H1 / relative-links / no-stray-files conventions
// documented in knowledge/README.md. Used by the /daraja-augment-knowledge slash
// command before it opens a PR, and by CI before publish.
//
// Rules:
//   1. First non-empty line of every .md file must start with "# " (single H1 as title)
//   2. All relative markdown links (*.md) must resolve to an existing file
//   3. No .md files outside the known category directories + root
//
// Excludes: knowledge/_templates/ (templates may contain placeholder links),
//           llms.txt and llms-full.txt (generated artifacts).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_ROOT = path.resolve(__dirname, '..', 'knowledge');
const ALLOWED_CATEGORIES = new Set(['capabilities', 'concepts', 'errors', 'patterns']);
const EXCLUDED_DIRS = new Set(['_templates']);
const EXCLUDED_FILES = new Set(['llms.txt', 'llms-full.txt']);

const errors = [];

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      results.push(...walk(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      if (EXCLUDED_FILES.has(entry.name)) continue;
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

function checkLocation(filePath) {
  const rel = path.relative(KNOWLEDGE_ROOT, filePath);
  const parts = rel.split(path.sep);
  if (parts.length === 1) return;
  const topDir = parts[0];
  if (!ALLOWED_CATEGORIES.has(topDir)) {
    errors.push(
      `${rel}: stray file — must live in capabilities/, concepts/, errors/, patterns/, or directly under knowledge/`,
    );
  }
}

function checkH1(filePath, content) {
  const rel = path.relative(KNOWLEDGE_ROOT, filePath);
  const firstNonEmpty = content.split('\n').find((line) => line.trim().length > 0);
  if (!firstNonEmpty || !/^# [^#]/.test(firstNonEmpty)) {
    errors.push(`${rel}: first non-empty line must be an H1 (e.g., "# My Title")`);
  }
}

function stripCode(content) {
  // Replace fenced code blocks with blank lines (preserving line count so
  // errors that report line numbers stay accurate) and strip inline code
  // spans. Link-like syntax inside code is example text, not a real link.
  const noFenced = content.replace(/```[\s\S]*?```/g, (block) =>
    '\n'.repeat(block.split('\n').length - 1),
  );
  return noFenced.replace(/`[^`\n]*`/g, '');
}

function checkLinks(filePath, content) {
  const rel = path.relative(KNOWLEDGE_ROOT, filePath);
  const dir = path.dirname(filePath);
  const stripped = stripCode(content);
  const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = linkRe.exec(stripped)) !== null) {
    const target = m[1].trim();
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const withoutAnchor = target.split('#')[0];
    if (!withoutAnchor) continue;
    if (!withoutAnchor.endsWith('.md')) continue;
    const resolved = path.resolve(dir, withoutAnchor);
    if (!fs.existsSync(resolved)) {
      errors.push(`${rel}: broken relative link → ${target}`);
    }
  }
}

const files = walk(KNOWLEDGE_ROOT);
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  checkLocation(file);
  checkH1(file, content);
  checkLinks(file, content);
}

if (errors.length > 0) {
  console.error(`lint-knowledge: ${errors.length} issue(s) found\n`);
  for (const err of errors) console.error(`  • ${err}`);
  console.error(`\nSee knowledge/README.md for conventions.`);
  process.exit(1);
}

console.log(`lint-knowledge: ${files.length} file(s) checked, all pass.`);
