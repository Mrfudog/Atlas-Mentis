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

const sql = readFileSync(new URL('../../../apps/server/migrations/052_ansichten_je_art.sql', import.meta.url), 'utf8');

describe('Ansichten je Art (T-110)', () => {
  it('Migration 052 bringt genau die Zeilen aus ansichten.ts', () => {
    const inSql = [...sql.matchAll(/\('(\w+)', '(\w+)', '(\{.*?\})'::jsonb\)/g)].map((m) => [m[1], m[2], JSON.parse(m[3]!)]);
    const imCode = Object.entries(typeViews).flatMap(([t, vs]) => Object.entries(vs).map(([v, w]) => [t, v, w]));
    expect(inSql).toEqual(imCode);
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
