/**
 * Hilfe je Seite (T-205): jede Route hat einen Hilfetext oder steht mit
 * Grund in der Ausnahmeliste, und die Zuordnung von Adresse zu Text und
 * zu den Einträgen von What's new trifft die richtige Seite.
 */

import { describe, expect, it } from 'vitest';
import { HILFE, OHNE_HILFE, hilfeFuer, neuesFuer, passt, routeVon } from '../src/app/kern/hilfe';
import type { NeuEintrag } from '../src/app/kern/neues';
import { routes } from '../src/app/app.routes';

/** Routen mit einer Seite — Umleitungen und `**` zeigen keine. */
const seiten = routes
  .filter((r) => r.path !== undefined && r.path !== '**' && !r.redirectTo)
  .map((r) => r.path as string);

describe('help.json', () => {
  it('covers every page or names why not', () => {
    const mitHilfe = new Set(HILFE.flatMap((s) => s.routes));
    for (const p of seiten) {
      expect(mitHilfe.has(p) || p in OHNE_HILFE, `route ${p}`).toBe(true);
    }
  });

  it('names only routes that exist, each once', () => {
    const alle = HILFE.flatMap((s) => s.routes);
    expect(new Set(alle).size).toBe(alle.length);
    for (const r of [...alle, ...Object.keys(OHNE_HILFE)]) expect(seiten, r).toContain(r);
    for (const r of Object.keys(OHNE_HILFE)) expect(alle, r).not.toContain(r);
  });

  it('has a title and short paragraphs', () => {
    for (const s of HILFE) {
      expect(s.title.trim(), s.routes[0]).not.toBe('');
      expect(s.sections.length, s.title).toBeGreaterThan(0);
      for (const a of s.sections) {
        expect(a.text.length, s.title).toBeGreaterThan(0);
        for (const t of a.text) expect(t.length, `${s.title}: ${t}`).toBeLessThanOrEqual(400);
      }
    }
  });
});

describe('help for an address', () => {
  it('matches a route with parameters, and not a longer path', () => {
    expect(passt('read/:layer', '/read/abc?at=3')).toBe(true);
    expect(passt('artikel/:id', '/artikel/x/print')).toBe(false);
    expect(routeVon('/artikel/x/print')).toBe('artikel/:id/print');
  });

  it('prefers a fixed segment over a parameter', () => {
    expect(routeVon('/characters/new')).toBe('characters/new');
  });

  it('finds the map help on Play, with fog and line of sight', () => {
    const h = hilfeFuer('/play?map=k1');
    const texte = h?.sections.map((a) => a.heading) ?? [];
    expect(texte).toContain('Fog of war');
    expect(texte).toContain('Line of sight');
  });

  it('lists the What’s new entries that link to the same page', () => {
    const e = (id: string, link?: string): NeuEintrag => ({ id, date: '2026-10-15', title: id, text: id, area: 'x', link });
    const liste = [e('a', '/play'), e('b', '/world'), e('c'), e('d', '/artikel/q1')];
    expect(neuesFuer('/play', liste).map((x) => x.id)).toEqual(['a']);
    expect(neuesFuer('/world?view=g', liste).map((x) => x.id)).toEqual(['b']);
    expect(neuesFuer('/artikel/zz', liste).map((x) => x.id)).toEqual(['d']);
    expect(neuesFuer('/login', liste)).toEqual([]);
  });
});
