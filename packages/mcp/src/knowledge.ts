import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_ROOT = path.resolve(__dirname, '..', '..', '..', 'knowledge');

const GITHUB_REPO = 'njenga-kariuki/daraja-kit';
const GITHUB_BRANCH = 'master';

interface KnowledgeEntry {
  path: string;
  filename: string;
  category: string;
  content: string;
  sourceUrl: string;
  editUrl: string;
}

let cache: KnowledgeEntry[] | null = null;

/** Load and index all knowledge base markdown files. */
function loadKnowledge(): KnowledgeEntry[] {
  if (cache) return cache;

  const entries: KnowledgeEntry[] = [];

  function walk(dir: string, category: string) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full, file);
      } else if (file.endsWith('.md')) {
        const rel = path.relative(KNOWLEDGE_ROOT, full).split(path.sep).join('/');
        entries.push({
          path: full,
          filename: file,
          category,
          content: fs.readFileSync(full, 'utf8'),
          sourceUrl: `https://github.com/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/knowledge/${rel}`,
          editUrl: `https://github.com/${GITHUB_REPO}/edit/${GITHUB_BRANCH}/knowledge/${rel}`,
        });
      }
    }
  }

  walk(KNOWLEDGE_ROOT, 'root');
  cache = entries;
  return entries;
}

/** Search knowledge base for entries matching a query string. */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  const entries = loadKnowledge();
  const terms = query.toLowerCase().split(/\s+/);

  return entries
    .map((entry) => {
      const haystack = (entry.content + ' ' + entry.filename + ' ' + entry.category).toLowerCase();
      const score = terms.reduce((s, term) => s + (haystack.includes(term) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry);
}

/** Get a specific knowledge file by category and name. */
export function getKnowledge(category: string, name: string): string | null {
  const entries = loadKnowledge();
  const match = entries.find(
    (e) => e.category === category && e.filename.replace('.md', '') === name,
  );
  return match?.content ?? null;
}

/** Get the full llms.txt index. */
export function getLlmsTxt(): string {
  const p = path.join(KNOWLEDGE_ROOT, 'llms.txt');
  if (!fs.existsSync(p)) return 'Knowledge base not yet built.';
  return fs.readFileSync(p, 'utf8');
}
