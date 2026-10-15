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

/* Dasselbe für die Kantenarten: `asField` hatte keine Spalte, `props` wurde
   geschrieben und nie gelesen (Migration 022). Erst das Register (W5), das
   Kantenarten speichert, hätte beides still gelöscht. */
describe('an edge kind survives a round trip through Postgres', () => {
  const benutzt = new Set<string>();
  for (const def of Object.values(seedRegistry.relations)) {
    for (const [k, v] of Object.entries(def)) {
      if (v === undefined || (Array.isArray(v) && v.length === 0)) continue;
      benutzt.add(k);
    }
  }
  /* So heissen sie in der Tabelle, wo es nicht einfach die Schreibweise ist. */
  const name: Record<string, string> = { from: 'from_ifaces', to: 'to_ifaces' };
  const sp = (k: string) => name[k] ?? spalte(k);

  it('writes, keeps and reads every field the seed edges carry', () => {
    expect(benutzt.has('asField')).toBe(true);
    const insert = /insert into relation_def\(([^)]*)\)/.exec(pgQuelle)?.[1] ?? '';
    /* `facet` schreibt eine eigene Anweisung nach dem Einfügen (T-174) —
       seit T-212 trägt eine Startkante (`spellList`) die Angabe. */
    const nachher = [...pgQuelle.matchAll(/update relation_def set (\w+) = /g)].map((m) => m[1]!);
    expect([...benutzt].filter((k) => !insert.split(',').includes(sp(k)) && !nachher.includes(sp(k)))).toEqual([]);
    expect([...benutzt].filter((k) => !new RegExp(`\\b${sp(k)}\\b`).test(ddl))).toEqual([]);
    expect([...benutzt].filter((k) => !new RegExp(`r\\['${sp(k)}'\\]`).test(pgQuelle))).toEqual([]);
  });
});

describe('Aufzählungen und Einstellungen haben eine Tabelle (Migration 019)', () => {
  it('liest und schreibt enum_def und setting_def', () => {
    expect(ddl).toMatch(/create table if not exists enum_def/);
    expect(ddl).toMatch(/create table if not exists setting_def/);
    expect(pgQuelle).toMatch(/select \* from enum_def/);
    expect(pgQuelle).toMatch(/insert into enum_def\(name,config\)/);
    expect(pgQuelle).toMatch(/select \* from setting_def/);
    expect(pgQuelle).toMatch(/insert into setting_def\(key,value\)/);
  });
});

/* `jsonb` sortiert Schlüssel; die Reihenfolge der Felder ist aber Teil der
   Art (Migration 020). Die letzte Angabe zum Spaltentyp muss `json` sein. */
describe('field order survives Postgres', () => {
  it('stores interface_def.schema as json, not jsonb', () => {
    const angaben = [...ddl.matchAll(/schema\s+(?:type\s+)?(jsonb|json)\b/gi)].map((m) => m[1]);
    expect(angaben.at(-1)?.toLowerCase()).toBe('json');
  });
});

/* Der Zwischenspeicher des Bestands (repo.pg.ts) erkennt fremde Schreiber
   am Stempel aus der Datenbank; ein Schreiben am Server leert ihn sofort.
   Ohne laufendes Postgres hier am Quelltext geprüft — der Durchstich in CI
   liest und schreibt durch ihn. */
describe('entity cache', () => {
  it('asks the database whether anything changed, and drops itself on every write', () => {
    expect(pgQuelle).toMatch(/max\(updated_at\)/);
    const schreiber = ['async putEntity', 'async deleteEntity'];
    for (const s of schreiber) {
      const ab = pgQuelle.indexOf(s);
      expect(ab).toBeGreaterThan(-1);
      expect(pgQuelle.slice(ab, ab + 200)).toContain('this.bestand = null');
    }
  });
  it('carries its own write forward only under a lock, stamp read before and after (T-143)', () => {
    const ab = pgQuelle.indexOf('async putEntity');
    const rumpf = pgQuelle.slice(ab, pgQuelle.indexOf('async deleteEntity'));
    expect(rumpf).toContain('lock table entity in share row exclusive mode');
    expect(rumpf.split('PgRepository.STEMPEL').length - 1).toBe(2);
    expect(rumpf).toContain('this.bestand = { stempel: nachher, liste }');
  });
});
