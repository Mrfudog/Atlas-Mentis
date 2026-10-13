/**
 * Forward-only migrations. Each file runs once, inside a transaction, and is
 * recorded — so `main` and `preprod` can never disagree about what has run.
 *
 * Eine Migration, die entfernt, nennt im Kopf ihre Prüfabfragen
 * (`-- verlust: select count(*) from …`). Sie laufen in derselben
 * Transaktion vor der Migration; zählen sie etwas und ist die Migration
 * nicht über `ATLAS_ALLOW_DATA_LOSS` freigegeben, bricht der Start ab und
 * nichts ist geändert (T-076, `verlust.ts`).
 */

import type { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, getPool } from './db.js';
import { DatenverlustError, pruefabfragen, pruefeVerlust, type VerlustOptionen } from './verlust.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export async function migrate(
  pool: Pool = getPool(),
  verlust: VerlustOptionen = {},
  dir: string = migrationsDir,
): Promise<string[]> {
  await pool.query(`
    create table if not exists schema_migrations (
      name text primary key,
      run_at timestamptz not null default now()
    )
  `);

  const { rows } = await pool.query<{ name: string }>('select name from schema_migrations');
  const done = new Set(rows.map((r) => r.name));

  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      const betroffen = [];
      for (const abfrage of pruefabfragen(sql)) {
        const { rows: r } = await client.query<Record<string, unknown>>(abfrage);
        betroffen.push({ was: abfrage, anzahl: Number(Object.values(r[0] ?? {})[0] ?? 0) });
      }
      pruefeVerlust(file, betroffen, verlust);
      await client.query(sql);
      await client.query('insert into schema_migrations(name) values ($1)', [file]);
      await client.query('commit');
      applied.push(file);
    } catch (error) {
      await client.query('rollback');
      if (error instanceof DatenverlustError) throw error;
      throw new Error(`Migration ${file} fehlgeschlagen: ${(error as Error).message}`);
    } finally {
      client.release();
    }
  }
  return applied;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  migrate()
    .then((applied) => {
      console.log(applied.length ? `Angewandt: ${applied.join(', ')}` : 'Nichts anzuwenden.');
      return closePool();
    })
    .catch(async (error) => {
      console.error(error);
      await closePool();
      process.exit(1);
    });
}
