import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { interfaces, relations } from '../src/index';
// @ts-expect-error — ein Skript ohne Typen, wie die übrigen unter scripts/
import { leseAnforderungen } from '../scripts/stories-lib.mjs';

/* T-156: die Dokumentation führt in drei Stufen vom Einstieg bis in den
   Code. Ein Verweis ins Leere bricht genau diesen Weg, und gemerkt wird es
   erst, wenn jemand ihm folgt — also prüft es der Test. */
const wurzel = resolve(__dirname, '..', '..', '..');

const geprueft = [
  'README.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'docs/README.md',
  ...readdirSync(join(wurzel, 'docs/Themen')).map((f) => `docs/Themen/${f}`),
  ...readdirSync(join(wurzel, 'VTT/Epics')).map((f) => `VTT/Epics/${f}`),
];

// Wie GitHub aus einer Überschrift einen Anker macht: klein, Satzzeichen
// weg, Leerzeichen zu Bindestrichen — Umlaute bleiben.
const anker = (titel: string) =>
  titel
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');

const ankerVon = (datei: string) => {
  const text = readFileSync(datei, 'utf8').replace(/```[\s\S]*?```/g, '');
  return new Set([...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => anker(m[1])));
};

const verweise = (text: string) =>
  [...text.replace(/```[\s\S]*?```/g, '').matchAll(/\]\((<[^>]+>|[^)\s]+)\)/g)]
    .map((m) => m[1].replace(/^<|>$/g, ''))
    .filter((v) => !/^[a-z]+:/i.test(v));

describe('Dokumentation (T-156)', () => {
  it('has no link into nothing on the entry, overview and epic pages', () => {
    const kaputt: string[] = [];
    for (const seite of geprueft) {
      const pfad = join(wurzel, seite);
      for (const v of verweise(readFileSync(pfad, 'utf8'))) {
        const [ziel, frag] = v.split('#');
        const datei = ziel ? resolve(dirname(pfad), decodeURIComponent(ziel)) : pfad;
        if (!existsSync(datei)) {
          kaputt.push(`${seite}: ${v} (Datei fehlt)`);
          continue;
        }
        if (frag && statSync(datei).isFile() && datei.endsWith('.md') && !ankerVon(datei).has(decodeURIComponent(frag)))
          kaputt.push(`${seite}: ${v} (Anker fehlt)`);
      }
    }
    expect(kaputt).toEqual([]);
  });

  it('lists every page under docs/ in the inventory of docs/README.md', () => {
    const einstieg = readFileSync(join(wurzel, 'docs/README.md'), 'utf8');
    const genannt = new Set(verweise(einstieg).map((v) => decodeURIComponent(v.split('#')[0])));
    const fehlt = readdirSync(join(wurzel, 'docs'))
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .filter((f) => !genannt.has(f))
      .map((f) => relative(wurzel, join(wurzel, 'docs', f)));
    expect(fehlt, 'neue Seite? in docs/README.md › Bestandsaufnahme eintragen').toEqual([]);
  });

  it('names only kinds, edges, code and pages that exist on the epic notes', () => {
    const { epics } = leseAnforderungen(wurzel);
    const arten = new Set(Object.keys(interfaces));
    const kanten = new Set(Object.keys(relations));
    const fehlt: string[] = [];
    for (const e of epics as { id: string; arten?: string[]; kanten?: string[]; code?: string[]; doku?: string[] }[]) {
      for (const a of e.arten ?? []) if (!arten.has(a)) fehlt.push(`${e.id}: Art ${a}`);
      for (const k of e.kanten ?? []) if (!kanten.has(k)) fehlt.push(`${e.id}: Kante ${k}`);
      for (const p of [...(e.code ?? []), ...(e.doku ?? [])]) if (!existsSync(join(wurzel, p))) fehlt.push(`${e.id}: ${p}`);
      if (!e.code?.length || !e.doku?.length) fehlt.push(`${e.id}: ohne code oder doku`);
    }
    expect(fehlt).toEqual([]);
  });

  it('embeds the SVG of every drawing next to its Excalidraw source', () => {
    const bilder = readdirSync(join(wurzel, 'docs/Bilder'));
    const ohneSvg = bilder
      .filter((f) => f.endsWith('.excalidraw.md'))
      .filter((f) => !bilder.includes(f.replace(/\.md$/, '.svg')));
    expect(ohneSvg).toEqual([]);
  });
});
