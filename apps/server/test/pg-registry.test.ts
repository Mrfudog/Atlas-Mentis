/**
 * Was das Register in Postgres verliert, merkt niemand.
 *
 * `area` stand an der Schnittstellenzeile, aber weder in der Tabelle noch im
 * INSERT — im Speicher stimmte alles, der Seed brachte die Bereiche bei jedem
 * Start mit, und erst wer das Register über den Server speicherte, fand jede
 * Artikelart unter „alle" wieder.
 *
 * Deshalb hier keine Prüfung gegen eine Datenbank, sondern gegen den
 * Quelltext: **jedes Feld, das die Startzeilen tatsächlich benutzen, muss im
 * INSERT vorkommen.** Eine Prüfung mit laufendem Postgres wäre gründlicher
 * und liefe hier nie.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';

const hier = join(import.meta.dirname, '..');
const pgQuelle = readFileSync(join(hier, 'src', 'repo.pg.ts'), 'utf8');
const ddl = readdirSync(join(hier, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(hier, 'migrations', f), 'utf8'))
  .join('\n');

/** `blockTypes` heisst in der Tabelle `block_types`. */
const spalte = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

describe('the registry survives a round trip through Postgres', () => {
  const benutzt = new Set<string>();
  for (const def of Object.values(seedRegistry.interfaces)) {
    for (const [k, v] of Object.entries(def)) {
      if (v === undefined || (Array.isArray(v) && v.length === 0)) continue;
      benutzt.add(k);
    }
  }

  it('writes every field the seed rows actually carry', () => {
    const insert = /insert into interface_def\(([^)]*)\)/.exec(pgQuelle)?.[1] ?? '';
    const fehlt = [...benutzt].filter((k) => !insert.split(',').includes(spalte(k)));
    expect(fehlt).toEqual([]);
  });

  it('has a column for each of them', () => {
    const fehlt = [...benutzt].filter((k) => !new RegExp(`\\b${spalte(k)}\\b`).test(ddl));
    expect(fehlt).toEqual([]);
  });

  it('reads them back', () => {
    const fehlt = [...benutzt].filter((k) => !new RegExp(`r\\['${spalte(k)}'\\]`).test(pgQuelle));
    expect(fehlt).toEqual([]);
  });
});
