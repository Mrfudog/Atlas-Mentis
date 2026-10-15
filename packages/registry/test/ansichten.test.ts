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
const spaeter = ['083_kennzahlen', '084_ansichten_als_elemente'].map(migration);

const zeilen = (text: string) =>
  [...text.matchAll(/\('(\w+)', '(\w+)', '(\{.*?\})'::jsonb\)/g)].map((m) => [m[1]!, m[2]!, JSON.parse(m[3]!)] as const);

describe('Ansichten je Art (T-110)', () => {
  it('Migration 052 und die späteren bringen genau die Zeilen aus ansichten.ts', () => {
    const stand = new Map(zeilen(sql).map(([t, v, w]) => [`${t}.${v}`, [t, v, w]]));
    for (const text of spaeter) for (const [t, v, w] of zeilen(text)) stand.set(`${t}.${v}`, [t, v, w]);
    const imCode = Object.entries(typeViews).flatMap(([t, vs]) => Object.entries(vs).map(([v, w]) => [t, v, w]));
    /* Die Reihenfolge sagt nichts: eine spätere Migration hängt an, der
       Code steht nach Art beisammen. */
    const sortiert = (l: (readonly unknown[])[]) => [...l].sort((a, b) => `${a[0]}.${a[1]}`.localeCompare(`${b[0]}.${b[1]}`));
    expect(sortiert([...stand.values()])).toEqual(sortiert(imCode));
    expect(sql).toContain(`'${JSON.stringify(seedRegistry.views['handout'])}'::jsonb`);
    expect(sql).toContain(`set config = '${JSON.stringify(seedRegistry.views['print'])}'::jsonb`);
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
