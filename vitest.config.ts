import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

/* Zwei Projekte, weil sie Verschiedenes brauchen: das Modell und der Server
   laufen in Node, die Oberfläche braucht ein DOM und Angulars aufgesetzte
   Prüfumgebung. Eine gemeinsame Aufsetzdatei für beide wäre der Weg, auf
   dem ein Node-Test plötzlich von einem Browser-Stub abhängt. */
const alias = {
  '@nw/model': p('./packages/model/src/index.ts'),
  '@nw/registry': p('./packages/registry/src/index.ts'),
  '@nw/import': p('./packages/import/src/index.ts'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['packages/*/test/**/*.test.ts', 'apps/server/test/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/test/**/*.test.ts'],
          setupFiles: ['./apps/web/test/setup.ts'],
        },
      },
    ],
  },
});
