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

/* Ein ganzer Registerteil kann ebenso still verlorengehen wie ein Feld: er
   steht im Seed, im Speicher stimmt alles, und erst wer über den Server
   speichert, hat ihn nicht mehr. */
describe('every registry part has a table, and is written and read', () => {
  const teile: Record<string, string> = {
    interfaces: 'interface_def',
    relations: 'relation_def',
    views: 'view_def',
    units: 'unit_def',
    vars: 'var_def',
  };

  it('knows a table for each one', () => {
    const fehlt = Object.entries(teile)
      .filter(([teil, tabelle]) =>
        Object.keys(seedRegistry[teil as keyof typeof seedRegistry] ?? {}).length &&
        !new RegExp(`create table if not exists ${tabelle}\\b`).test(ddl))
      .map(([teil]) => teil);
    expect(fehlt).toEqual([]);
  });

  it('writes and reads each one', () => {
    const fehlt = Object.entries(teile)
      .filter(([, tabelle]) =>
        !new RegExp(`insert into ${tabelle}\\(`).test(pgQuelle) ||
        !new RegExp(`from ${tabelle}\\b`).test(pgQuelle))
      .map(([teil]) => teil);
    expect(fehlt).toEqual([]);
  });

  /* Und die Felder einer Einheit: `base` zu verlieren macht jede Umrechnung
     zu einer Division durch undefined. */
  it('keeps every field a unit row carries', () => {
    const benutzt = new Set<string>();
    for (const u of Object.values(seedRegistry.units)) {
      for (const [k, v] of Object.entries(u)) {
        if (v === undefined || (Array.isArray(v) && !v.length)) continue;
        benutzt.add(k);
      }
    }
    const insert = /insert into unit_def\(([^)]*)\)/.exec(pgQuelle)?.[1] ?? '';
    expect([...benutzt].filter((k) => !insert.split(',').includes(k))).toEqual([]);
    expect([...benutzt].filter((k) => !new RegExp(`r\\['${k}'\\]`).test(pgQuelle))).toEqual([]);
  });
});
