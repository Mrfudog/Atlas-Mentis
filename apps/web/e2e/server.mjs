/**
 * Startet den gebauten Server für die E2E-Prüfungen (T-356).
 *
 * Genau wie im Abbild (Dockerfile): die gebaute Oberfläche liegt als
 * `public/` neben `dist/`, und Fastify liefert beides aus. Kein
 * `ng serve` — geprüft wird, was ausgerollt wird.
 *
 * Gebraucht wird `DATABASE_URL` auf eine **eigene** Postgres (CI-Dienst oder
 * lokal); Migrationen und Seed macht der Server beim Start selbst.
 */
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';

const wurzel = fileURLToPath(new URL('../../..', import.meta.url));
const web = join(wurzel, 'apps/web/dist/web/browser');
const oeffentlich = join(wurzel, 'apps/server/public');
const server = join(wurzel, 'apps/server/dist/index.js');

for (const [pfad, bau] of [
  [web, 'pnpm --filter web build'],
  [server, 'pnpm --filter @nw/server build'],
]) {
  if (!existsSync(pfad)) {
    console.error(`${pfad} fehlt — zuerst \`${bau}\`.`);
    process.exit(1);
  }
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL fehlt — die E2E-Prüfungen brauchen eine eigene Postgres.');
  process.exit(1);
}

rmSync(oeffentlich, { recursive: true, force: true });
cpSync(web, oeffentlich, { recursive: true });

const bilder = mkdtempSync(join(tmpdir(), 'atlas-e2e-bilder-'));
const kind = spawn(process.execPath, [server], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: process.env.E2E_PORT ?? '8091',
    HOST: '127.0.0.1',
    ASSET_DIR: bilder,
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => kind.kill(signal));
kind.on('exit', (code) => process.exit(code ?? 0));
