import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { closePool, getPool } from './db.js';
import { PgRepository } from './repo.pg.js';
import { seedRegistryInto } from './seed.js';
import { migrate } from './migrate.js';
import { FileAssetStore } from './assets.js';
import { DateiSicherung, gegenstelleAus } from './uebernahme.js';

const config = loadConfig();
const repo = new PgRepository(getPool());
const assets = new FileAssetStore(config.assetDir);

// In the container the built Angular app sits beside dist/ as public/.
const staticRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
/* Solange der Bestand nach dem Start gelesen wird, sagt der Server das
   (503 mit der Zahl), statt Anfragen warten zu lassen (T-086). */
let anlauf: { artikel: number } | null = null;
const app = buildApp({
  anlauf: () => anlauf,
  repo,
  logger: true,
  staticRoot,
  trustProxy: config.trustProxy,
  env: config.env,
  assets,
  assetMaxBytes: config.assetMaxBytes,
  /* Die Übernahme dev ↔ prod (T-130): Gegenstelle, Annahme, Sicherung. */
  transferPeer: gegenstelleAus(config.peerUrl ?? undefined, config.peerToken ?? undefined),
  transferAccept: config.transferAccept,
  sicherung: config.backupDir ? new DateiSicherung(config.backupDir) : null,
});

async function main(): Promise<void> {
  /* Was eine Migration oder der Seed entfernen würde, wird vorher gezählt;
     ohne Freigabe bricht der Start hier ab (T-076). */
  const verlust = { log: (m: string) => app.log.warn(m) };
  /* Die Ablage der Bilder muss schreibbar sein (T-114) — sonst jetzt
     scheitern und nicht beim ersten Hochladen am Tisch. */
  await assets.bereit();
  const applied = await migrate(getPool(), verlust);
  if (applied.length) app.log.info({ applied }, 'Migrationen angewandt');
  await seedRegistryInto(repo, verlust);
  await app.listen({ port: config.port, host: config.host });
  /* Den Bestand einmal lesen, bevor jemand fragt: die erste Anfrage nach
     einem Neustart wartete sonst auf das Lesen aller Artikel (24 157 aus
     5e.tools). Danach hält ihn der Zwischenspeicher am Repository. */
  const t0 = Date.now();
  anlauf = { artikel: await repo.countEntities() };
  void repo
    .listEntities()
    .then((l) => app.log.info({ artikel: l.length, ms: Date.now() - t0 }, 'Bestand gelesen'))
    .catch((error: unknown) => app.log.warn({ err: error }, 'Bestand nicht vorgelesen'))
    .finally(() => {
      anlauf = null;
    });
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
