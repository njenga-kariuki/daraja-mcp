#!/usr/bin/env node
// Copies tool source files from packages/mcp/src into packages/support-mcp/src
// so the published package has no runtime dependency on the sibling workspace.
// packages/mcp/src/ remains the single source of truth — this script keeps
// the support package in sync at every build.

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mcpSrc = resolve(__dirname, '..', '..', 'mcp', 'src');
const supportSrc = resolve(__dirname, '..', 'src');

// Tool handlers to include in the support tier.
const TOOLS = ['diagnose', 'explain', 'validate', 'preflight', 'test-sandbox'];

// Ensure target dirs exist.
const toolsDir = resolve(supportSrc, 'tools');
if (!existsSync(toolsDir)) mkdirSync(toolsDir, { recursive: true });

// Copy sanitize (used by server for PII masking).
copyFileSync(resolve(mcpSrc, 'sanitize.ts'), resolve(supportSrc, 'sanitize.ts'));
console.log('[sync-sources] sanitize.ts');

// Copy each tool.
for (const tool of TOOLS) {
  const src = resolve(mcpSrc, 'tools', `${tool}.ts`);
  const dest = resolve(toolsDir, `${tool}.ts`);
  copyFileSync(src, dest);
  console.log(`[sync-sources] tools/${tool}.ts`);
}

console.log(`[sync-sources] synced ${TOOLS.length + 1} files from ${mcpSrc} → ${supportSrc}`);
