#!/usr/bin/env node
/**
 * **Register-Abgleich im CI** (T-123).
 *
 * Der Seed schreibt Arten nur in eine leere Datenbank. Eine Änderung an
 * `packages/registry` ohne Migration erreicht darum keine laufende
 * Installation — gemerkt hat man es erst an rohen Ids und fehlenden
 * Spalten auf dev (055–057). Dieser Lauf spielt eine bestehende
 * Installation nach:
 *
 *  1. **frisch:** alle Migrationen, dann der Seed — das Register muss den
 *     Startzeilen gleichen. Das prüft die Normalisierung und dass der Seed
 *     jeden Teil schreibt.
 *  2. **alt:** die Migrationen bis zum Stand des Schnappschusses
 *     (`register-stand.json`), dann dessen Register, dann die übrigen
 *     Migrationen und der Seed wie beim Start — es muss den Startzeilen
 *     gleichen. Wer eine Zeile ändert und keine Migration schreibt, fällt
 *     hier durch, mit der Liste.
 *
 * Eine bewusste Abweichung steht in `AUSNAHMEN`, mit Grund.
 *
 *   DATABASE_URL=postgres://…/postgres node apps/server/scripts/register-abgleich.mjs
 *   node apps/server/scripts/register-abgleich.mjs --schnappschuss   # Stand neu schreiben
 *
 * Den Schnappschuss neu zu schreiben ist nur richtig, wenn der Lauf grün
 * ist — dann ist er ohnehin gleich, und der neue Stand kürzt nur den Weg.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const DIST = join(HIER, '..', 'dist');
const MIGRATIONEN = join(HIER, '..', 'migrations');
const STAND = join(HIER, 'register-stand.json');

/** Bewusste Abweichungen: `teil:Name` oder `teil:Name:pfad` → warum. */
const AUSNAHMEN = {};

const { registerAbweichung, beschreibeAbweichung } = await import('@nw/model');
const { seedRegistry } = await import('@nw/registry');

if (process.argv.includes('--schnappschuss')) {
  const letzte = readdirSync(MIGRATIONEN).filter((f) => f.endsWith('.sql')).sort().at(-1);
  writeFileSync(STAND, `${JSON.stringify({ migration: letzte, registry: seedRegistry }, null, 1)}\n`);
  console.log(`register-stand.json: Startzeilen nach ${letzte}.`);
  process.exit(0);
}

const { migrate } = await import(join(DIST, 'migrate.js'));
const { seedRegistryInto } = await import(join(DIST, 'seed.js'));
const { PgRepository } = await import(join(DIST, 'repo.pg.js'));
const { default: pg } = await import('pg');

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL fehlt.');
  process.exit(2);
}
const verwaltung = new pg.Pool({ connectionString: url });
const leise = { env: {}, log: () => {} };
let fehler = 0;

/** Eine leere Datenbank für einen Lauf; danach wieder weg. */
async function mitDatenbank(name, lauf) {
  await verwaltung.query(`drop database if exists ${name}`);
  await verwaltung.query(`create database ${name}`);
  const u = new URL(url);
  u.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: u.toString() });
  try {
    return await lauf(pool, new PgRepository(pool));
  } finally {
    await pool.end();
    await verwaltung.query(`drop database if exists ${name}`);
  }
}

function urteil(was, registry) {
  const alle = registerAbweichung(registry, seedRegistry);
  const ausnahme = (a) =>
    AUSNAHMEN[`${a.part}:${a.name}${a.path ? `:${a.path}` : ''}`] ?? AUSNAHMEN[`${a.part}:${a.name}`];
  const offen = alle.filter((a) => !ausnahme(a));
  for (const a of alle.filter(ausnahme)) console.log(`  (Ausnahme) ${beschreibeAbweichung(a)} — ${ausnahme(a)}`);
  if (!offen.length) {
    console.log(`✓ ${was}: Register gleich den Startzeilen.`);
    return;
  }
  fehler++;
  console.error(`✗ ${was}: ${offen.length} Abweichung(en) von packages/registry:`);
  for (const a of offen) console.error(`  ${beschreibeAbweichung(a)}`);
}

/* Die Notizen der Migrationen gehören nicht in dieses Protokoll. */
const notice = console.log;
console.log = (...a) => (/^\d{3}_.*\.sql: /.test(String(a[0])) ? undefined : notice(...a));

try {
  await mitDatenbank('register_abgleich_frisch', async (pool, repo) => {
    await migrate(pool, leise);
    await seedRegistryInto(repo, leise);
    urteil('frische Datenbank', await repo.getRegistry());
  });

  const stand = JSON.parse(readFileSync(STAND, 'utf8'));
  await mitDatenbank('register_abgleich_alt', async (pool, repo) => {
    /* Bis zum Stand: nur die Migrationen bis dahin, aus einem eigenen Ordner. */
    const bis = mkdtempSync(join(tmpdir(), 'register-abgleich-'));
    try {
      for (const f of readdirSync(MIGRATIONEN).filter((f) => f.endsWith('.sql') && f <= stand.migration)) {
        symlinkSync(join(MIGRATIONEN, f), join(bis, f));
      }
      await migrate(pool, leise, bis);
    } finally {
      rmSync(bis, { recursive: true, force: true });
    }
    for (const part of ['interfaces', 'relations', 'views', 'units', 'vars', 'enums', 'settings']) {
      if (stand.registry[part]) await repo.putRegistryPart(part, stand.registry[part]);
    }
    const danach = await migrate(pool, leise);
    await seedRegistryInto(repo, leise);
    urteil(`Installation auf ${stand.migration}${danach.length ? ` + ${danach.join(', ')}` : ''}`, await repo.getRegistry());
  });
} catch (e) {
  fehler++;
  console.error(`✗ Register-Abgleich: ${e?.stack ?? e}`);
} finally {
  await verwaltung.end();
}

if (fehler) {
  console.error(
    '\nEine Registeränderung braucht eine Migration, die sie auf bestehenden Datenbanken nachzieht ' +
      '(oder eine Ausnahme in AUSNAHMEN, mit Grund). Siehe CLAUDE.md › Das Register steht einmal.',
  );
  process.exit(1);
}
