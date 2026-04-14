import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/adapters/openai.ts',
    'src/adapters/langchain.ts',
    'src/adapters/vercel-ai.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['openai', '@langchain/core', 'ai', 'zod'],
});
