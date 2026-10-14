import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDGE_READERS, NOT_EDGE_WORDS, edgeEffectText, edgeEffects } from '@nw/model';
import { seedRegistry } from '@nw/registry';

/**
 * **Register und Auswerter beisammen** (T-111). Die Wirkung einer Kante
 * steht nicht im Register, sondern wird aus `EDGE_READERS` gerechnet — und
 * das Verzeichnis wird hier gegen den Quelltext gehalten: was eine Datei an
 * Kantenarten nennt, muss eingetragen sein, und was eingetragen ist, muss
 * dort stehen.
 */

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const QUELLEN = ['packages/model/src', 'apps/server/src', 'apps/web/src'];
const arten = new Set(Object.keys(seedRegistry.relations));

function dateien(dir: string, raus: string[] = []): string[] {
  for (const f of fs.readdirSync(path.join(wurzel, dir), { withFileTypes: true })) {
    const p = `${dir}/${f.name}`;
    if (f.isDirectory()) dateien(p, raus);
    else if (f.name.endsWith('.ts') && !/\.(test|spec)\.ts$/.test(f.name)) raus.push(p);
  }
  return raus;
}

/* Kommentare zählen nicht: dort steht `inLayer` als Erklärung, nicht als Lesen. */
const ohneKommentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/* Das Verzeichnis selbst nennt sie alle — es ist der Eintrag, nicht ein Leser. */
const alle = QUELLEN.flatMap((d) => dateien(d)).filter((f) => f !== 'packages/model/src/edges.ts');
const text = new Map(alle.map((f) => [f, ohneKommentar(fs.readFileSync(path.join(wurzel, f), 'utf8'))]));

/* Konstanten wie `LAYER_RELATION = 'inLayer'` — wer sie benutzt, liest die Kante. */
const konstanten = new Map<string, string>();
for (const s of text.values()) {
  for (const m of s.matchAll(/\bconst ([A-Z][A-Z0-9_]*)\s*=\s*['"](\w+)['"]/g)) {
    if (arten.has(m[2]!)) konstanten.set(m[1]!, m[2]!);
  }
}

function genannt(s: string): Set<string> {
  const raus = new Set<string>();
  for (const m of s.matchAll(/['"](\w+)['"]/g)) if (arten.has(m[1]!)) raus.add(m[1]!);
  for (const [k, v] of konstanten) if (new RegExp(`\\b${k}\\b`).test(s)) raus.add(v);
  return raus;
}

describe('edge readers (T-111)', () => {
  it('lists, per file, exactly the edge kinds the code there names', () => {
    const eingetragen = new Map<string, Set<string>>();
    for (const r of EDGE_READERS) {
      for (const [f, l] of Object.entries(r.uses)) {
        const s = eingetragen.get(f) ?? new Set<string>();
        for (const t of l) s.add(t);
        eingetragen.set(f, s);
      }
    }
    const abweichungen: string[] = [];
    for (const [f, s] of text) {
      const nicht = new Set(NOT_EDGE_WORDS[f] ?? []);
      const ist = [...genannt(s)].filter((t) => !nicht.has(t)).sort();
      const soll = [...(eingetragen.get(f) ?? [])].sort();
      if (ist.join() !== soll.join()) abweichungen.push(`${f}: code names [${ist}], readers list [${soll}]`);
    }
    for (const f of eingetragen.keys()) if (!text.has(f)) abweichungen.push(`${f}: no such file`);
    expect(abweichungen).toEqual([]);
  });

  it('names only edge kinds the registry has', () => {
    for (const r of EDGE_READERS) for (const l of Object.values(r.uses)) for (const t of l) expect(arten, `${r.key}: ${t}`).toContain(t);
  });

  it('gives every edge kind a meaning and a computed effect', () => {
    for (const [type, def] of Object.entries(seedRegistry.relations)) {
      expect(def.means, type).toBeTruthy();
      const e = edgeEffects(seedRegistry, type);
      expect(edgeEffectText(e), type).toBeTruthy();
      /* Was ein Auswerter liest, verspricht nichts mehr — es tut es. */
      if (def.intended) expect(e.evaluated, `${type} is read, drop intended`).toBe(false);
    }
  });

  it('reads the effect from the code and the row, not from a claim', () => {
    const inLayer = edgeEffects(seedRegistry, 'inLayer');
    expect(inLayer.readers.map((r) => r.key)).toContain('stack');
    const hasClass = edgeEffects(seedRegistry, 'hasClass');
    expect(hasClass.shape.some((s) => s.text.includes('sum(hasClass.level)'))).toBe(true);
    const belongsTo = edgeEffects(seedRegistry, 'belongsTo');
    expect(belongsTo.shape.some((s) => s.text.includes('as its own'))).toBe(true);
    const composedOf = edgeEffects(seedRegistry, 'composedOf');
    expect(composedOf.shape[0]?.text).toContain('Actions & traits');
  });

  it('marks a promising edge nobody reads as not evaluated yet', () => {
    const affects = edgeEffects(seedRegistry, 'affects');
    expect(affects.evaluated).toBe(false);
    expect(affects.intended).toBeTruthy();
    expect(edgeEffectText(affects)).toMatch(/^Not evaluated yet/);
    expect(edgeEffectText(edgeEffects(seedRegistry, 'livesIn'))).toMatch(/^Display only/);
  });

  it('falls back to the labels for an edge kind without a meaning', () => {
    const reg = { interfaces: seedRegistry.interfaces, relations: { owesFavour: { type: 'owesFavour', label: 'owes a favour to', inverseLabel: 'is owed by', from: ['Creature'], to: ['*'] } } };
    expect(edgeEffects(reg, 'owesFavour').means).toContain('owes a favour to');
  });
});
