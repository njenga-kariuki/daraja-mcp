import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  clean: true,
  // Bundle @daraja-kit/sdk and axios so the published package has only one
  // runtime dependency (@modelcontextprotocol/sdk). Everything else is inlined.
  // Bundle @daraja-kit/sdk (workspace, not on npm) but keep axios external —
  // axios has CJS transitive deps (combined-stream, form-data) that can't be
  // bundled into a pure ESM file. axios becomes a real runtime dep instead.
  noExternal: ['@daraja-kit/sdk'],
  platform: 'node',
});
