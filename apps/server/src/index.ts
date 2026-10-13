import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { closePool, getPool } from './db.js';
import { PgRepository } from './repo.pg.js';
import { seedRegistryInto } from './seed.js';
import { migrate } from './migrate.js';

const config = loadConfig();
const repo = new PgRepository(getPool());

// In the container the built Angular app sits beside dist/ as public/.
const staticRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const app = buildApp({
  repo,
  logger: true,
  staticRoot,
  trustProxy: config.trustProxy,
  env: config.env,
});

async function main(): Promise<void> {
  /* Was eine Migration oder der Seed entfernen würde, wird vorher gezählt;
     ohne Freigabe bricht der Start hier ab (T-076). */
  const verlust = { log: (m: string) => app.log.warn(m) };
  const applied = await migrate(getPool(), verlust);
  if (applied.length) app.log.info({ applied }, 'Migrationen angewandt');
  await seedRegistryInto(repo, verlust);
  await app.listen({ port: config.port, host: config.host });
  /* Den Bestand einmal lesen, bevor jemand fragt: die erste Anfrage nach
     einem Neustart wartete sonst auf das Lesen aller Artikel (24 157 aus
     5e.tools). Danach hält ihn der Zwischenspeicher am Repository. */
  const t0 = Date.now();
  void repo
    .listEntities()
    .then((l) => app.log.info({ artikel: l.length, ms: Date.now() - t0 }, 'Bestand gelesen'))
    .catch((error: unknown) => app.log.warn({ err: error }, 'Bestand nicht vorgelesen'));
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(closePool).then(() => process.exit(0));
  });
}

main().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
