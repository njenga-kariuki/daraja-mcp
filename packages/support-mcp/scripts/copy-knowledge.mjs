#!/usr/bin/env node
// Copies /knowledge into packages/support-mcp/knowledge so the published npm
// tarball ships with the full knowledge base bundled. Runs as a prebuild step.

import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = resolve(__dirname, '..', '..', '..', 'knowledge');
const target = resolve(__dirname, '..', 'knowledge');

if (!existsSync(source)) {
  console.error(`[copy-knowledge] source not found: ${source}`);
  process.exit(1);
}

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
}
mkdirSync(target, { recursive: true });

cpSync(source, target, { recursive: true });
console.log(`[copy-knowledge] copied ${source} → ${target}`);
