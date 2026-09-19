import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@nw/model': p('./packages/model/src/index.ts'),
      '@nw/registry': p('./packages/registry/src/index.ts'),
      '@nw/import': p('./packages/import/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/*/test/**/*.test.ts', 'apps/server/test/**/*.test.ts'],
  },
});
