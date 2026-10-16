import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GLOSSARY_SORTS, RULE_OPTIONS, RULE_SORTS, appTermId } from '@nw/model';
import { APP_TERMS, interfaces } from '../src/index';

/* T-242, T-225: das Handbuch und das Glossar halten Schritt mit dem Code —
   **erzwungen**, nicht erhofft. Wer eine Art anlegt, eine Regeloption
   dazunimmt oder ein Wort in docs/Begriffe.md aufnimmt, bekommt hier einen
   roten Test mit dem Namen dessen, was fehlt. */
const wurzel = resolve(__dirname, '..', '..', '..');

describe('Glossar der App (T-242)', () => {
  it('erklärt jede anlegbare Art in genau einem Eintrag', () => {
    const anlegbar = Object.values(interfaces).filter((i) => !i.abstract).map((i) => i.name);
    const erklaert = APP_TERMS.flatMap((t) => t.types ?? []);
    const fehlt = anlegbar.filter((n) => !erklaert.includes(n));
    const doppelt = erklaert.filter((n, i) => erklaert.indexOf(n) !== i);
    const unbekannt = erklaert.filter((n) => !interfaces[n]);
    expect({ fehlt, doppelt, unbekannt }).toEqual({ fehlt: [], doppelt: [], unbekannt: [] });
  });

  it('hat einen Eintrag für jedes der neun Wörter aus docs/Begriffe.md', () => {
    const text = readFileSync(resolve(wurzel, 'docs/Begriffe.md'), 'utf8');
    const tabelle = text.split('## Die neun Wörter')[1]!.split('\n## ')[0]!;
    const woerter = [...tabelle.matchAll(/^\| \*\*[^*]+\*\* \| ([^|]+?) \|/gm)].map((m) => m[1]!.trim());
    expect(woerter.length).toBeGreaterThanOrEqual(9);
    const namen = new Set(APP_TERMS.map((t) => t.term));
    expect(woerter.filter((w) => !namen.has(w))).toEqual([]);
  });

  it('hat jeden Begriff einmal, mit Definition, Sorte und deutscher Übersetzung', () => {
    const ids = APP_TERMS.map((t) => appTermId(t.term));
    expect(ids.filter((n, i) => ids.indexOf(n) !== i)).toEqual([]);
    const sorten = new Set<string>(GLOSSARY_SORTS.map((s) => s.key));
    const maengel = APP_TERMS.filter((t) => !t.definition.trim() || !sorten.has(t.sort) || !t.translations?.['de']).map((t) => t.term);
    expect(maengel).toEqual([]);
  });

  it('kennt jede Sorte, die ein Glossarartikel tragen darf', () => {
    const werte = interfaces['GlossaryTerm']!.schema!.properties['sort']!.enum!;
    const sorten = new Set<string>(GLOSSARY_SORTS.map((s) => s.key));
    expect(werte.filter((w) => !sorten.has(w))).toEqual([]);
  });

  it('verweist nur auf Abschnitte des Handbuchs, die es gibt', () => {
    const handbuch = JSON.parse(readFileSync(resolve(wurzel, 'apps/web/src/handbook.json'), 'utf8')) as { chapters: { id: string }[] };
    const kapitel = new Set(handbuch.chapters.map((k) => k.id));
    const kaputt = APP_TERMS.filter((t) => t.see?.startsWith('/handbook#') && !kapitel.has(t.see.slice('/handbook#'.length))).map((t) => t.term);
    expect(kaputt).toEqual([]);
  });
});

describe('Regeln & Optionen im Handbuch (T-225)', () => {
  it('sagt zu jeder Sorte, Option und Variante, was sie bewirkt', () => {
    const stumm = [
      ...RULE_SORTS.filter((s) => !s.does.trim()).map((s) => `sort ${s.key}`),
      ...RULE_OPTIONS.filter((o) => !o.does.trim()).map((o) => `option ${o.key}`),
      ...RULE_OPTIONS.flatMap((o) => (o.variants ?? []).filter((v) => !v.does.trim()).map((v) => `variant ${o.key}.${v.key}`)),
    ];
    expect(stumm).toEqual([]);
  });
});
