/**
 * Die Ansichten je Art (T-110 Schritt 7) stehen zweimal: in
 * `ansichten.ts` für eine leere Datenbank und in Migration 052 für eine
 * bestehende. Zweimal dasselbe hält, solange jemand daran denkt — also
 * prüft es dieser Test.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyAdjust, isAdjust, layoutFor, RegistrySchema } from '@nw/model';
import { seedRegistry, typeViews } from '../src/index.js';

const migration = (n: string) => readFileSync(new URL(`../../../apps/server/migrations/${n}.sql`, import.meta.url), 'utf8');
const sql = migration('052_ansichten_je_art');
/* Migrationen, die eine Zeile aus 052 später nachziehen — die letzte gilt. */
const spaeter = ['083_kennzahlen', '084_ansichten_als_elemente', '094_quelleninhalt', '123_ansichten_je_art_und_stufe', '137_struktur'].map(migration);
/* Die Suche liest quick, quick neu geordnet (T-346): andere Form, eigene Prüfung. */
const zusammen = migration('127_quick_statt_search');

const zeilen = (text: string) =>
  [...text.matchAll(/\('(\w+)', '(\w+)', '(\{.*?\})'::jsonb\)/g)].map((m) => [m[1]!, m[2]!, JSON.parse(m[3]!)] as const);

describe('Ansichten je Art (T-110)', () => {
  it('Migration 052 und die späteren bringen genau die Zeilen aus ansichten.ts', () => {
    const stand = new Map(zeilen(sql).map(([t, v, w]) => [`${t}.${v}`, [t, v, w]]));
    for (const text of spaeter) for (const [t, v, w] of zeilen(text)) stand.set(`${t}.${v}`, [t, v, w]);
    /* 127 (T-346): quick mit altem und neuem Wert, search fällt weg. */
    for (const m of zusammen.matchAll(/\('(\w+)', '([[{].*?)'::jsonb, '([[{].*?)'::jsonb\)/g)) {
      const alt = stand.get(`${m[1]}.quick`);
      if (!alt) continue;
      expect(alt[2], `${m[1]}.quick`).toEqual(JSON.parse(m[2]!));
      stand.set(`${m[1]}.quick`, [m[1]!, 'quick', JSON.parse(m[3]!)]);
    }
    for (const m of zusammen.slice(zusammen.indexOf("- 'search'")).matchAll(/\('(\w+)', '([[{][^']*)'::jsonb\)/g)) {
      expect(stand.get(`${m[1]}.search`)?.[2], `${m[1]}.search`).toEqual(JSON.parse(m[2]!));
      stand.delete(`${m[1]}.search`);
    }
    const imCode = Object.entries(typeViews).flatMap(([t, vs]) => Object.entries(vs).map(([v, w]) => [t, v, w]));
    /* Die Reihenfolge sagt nichts: eine spätere Migration hängt an, der
       Code steht nach Art beisammen. */
    const sortiert = (l: (readonly unknown[])[]) => [...l].sort((a, b) => `${a[0]}.${a[1]}`.localeCompare(`${b[0]}.${b[1]}`));
    expect(sortiert([...stand.values()])).toEqual(sortiert(imCode));
    /* Den Zettel legt 052 an; 123 gibt ihm sein Feldelement (T-234). */
    expect(migration('123_ansichten_je_art_und_stufe')).toContain(`set config = '${JSON.stringify(seedRegistry.views['handout'])}'::jsonb`);
    expect(sql).toContain("values ('handout', 'Handout', 5,");
    expect(sql).toContain(`set config = '${JSON.stringify(seedRegistry.views['print'])}'::jsonb`);
    expect(zusammen).toContain(`set config = '${JSON.stringify(seedRegistry.views['quick'])}'::jsonb`);
  });

  it('jede Anpassung nennt Elemente, die es gibt, und Felder, die die Art trägt', () => {
    for (const [t, vs] of Object.entries(typeViews)) {
      for (const [v, w] of Object.entries(vs)) {
        expect(isAdjust(w), `${t}.${v}`).toBe(true);
        if (!isAdjust(w)) continue;
        const ids = (seedRegistry.views[v]?.layout ?? []).map((e) => e.id);
        for (const id of Object.keys(w.adjust.add ?? {})) expect(ids, `${t}.${v}: ${id}`).toContain(id);
        const { layout } = layoutFor(seedRegistry, v, t);
        expect(layout.length).toBeGreaterThan(0);
        for (const e of Object.values(w.adjust.add ?? {}).flat()) {
          const [typ, feld] = e.split('.');
          expect(seedRegistry.interfaces[typ!], e).toBeDefined();
          if (feld) expect(seedRegistry.interfaces[typ!]?.schema?.properties[feld], e).toBeDefined();
        }
        expect(applyAdjust(seedRegistry.views[v]?.layout ?? [], w.adjust).length).toBeGreaterThan(0);
      }
    }
  });

  it('das Register mit ihnen besteht die Prüfung', () => {
    expect(RegistrySchema.safeParse(seedRegistry).success).toBe(true);
  });
});
