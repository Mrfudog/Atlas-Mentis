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
const app = buildApp({ repo, logger: true, staticRoot });

async function main(): Promise<void> {
  const applied = await migrate();
  if (applied.length) app.log.info({ applied }, 'Migrationen angewandt');
  await seedRegistryInto(repo);
  await app.listen({ port: config.port, host: config.host });
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
