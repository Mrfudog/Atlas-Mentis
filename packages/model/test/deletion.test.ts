import { describe, expect, it } from 'vitest';
import { deleteSummary, pickDeletable, type Entity } from '../src/index.js';

const art = (id: string, typ: string, ebenen: string[] = []): Entity => ({
  id,
  interfaces: [typ],
  name: `Name ${id}`,
  components: { Identity: { name: `Name ${id}` } },
  relations: ebenen.map((l, i) => ({ id: `${id}~inLayer-${i}`, type: 'inLayer', to: l })),
});

const bestand = new Map(
  [
    art('img-1', 'Asset', ['meine']),
    art('img-2', 'Asset', ['meine']),
    art('img-3', 'Asset', ['regelwerk']),
    art('img-4', 'Asset', ['meine', 'regelwerk']),
    art('img-5', 'Asset'),
    art('meine', 'Layer'),
    art('kamp', 'Campaign', ['meine']),
    { ...art('img-6', 'Asset'), relations: [{ id: 'x', type: 'inLayer', to: 'meine', props: { mode: 'removes' } }] },
  ].map((e) => [e.id, e]),
);
const alles = () => true;

describe('pickDeletable (T-381)', () => {
  it('löscht, was in der Schreibebene liegt, und wählt den Rest ab', () => {
    const r = pickDeletable(bestand, ['img-1', 'img-3', 'img-2'], { layer: 'meine', mayWrite: alles });
    expect(r.ids).toEqual(['img-1', 'img-2']);
    expect(r.deselected).toEqual([{ id: 'img-3', name: 'Name img-3', reason: 'other-layer', layers: ['regelwerk'] }]);
  });

  it('nimmt doppelte Ids einmal', () => {
    expect(pickDeletable(bestand, ['img-1', 'img-1'], { layer: 'meine', mayWrite: alles }).ids).toEqual(['img-1']);
  });

  it('fragt nach der Ebene das Schreibrecht: geteilt mit dem Regelwerk heisst not-writable', () => {
    const r = pickDeletable(bestand, ['img-4'], { layer: 'meine', mayWrite: (id) => id !== 'img-4' });
    expect(r.ids).toEqual([]);
    expect(r.deselected[0]?.reason).toBe('not-writable');
  });

  it('ohne Ebene nur mit unlayered (Verwaltung ohne gewählte Schreibebene)', () => {
    expect(pickDeletable(bestand, ['img-5'], { layer: 'meine', mayWrite: alles }).deselected[0]?.reason).toBe('other-layer');
    expect(pickDeletable(bestand, ['img-5', 'img-1'], { layer: null, unlayered: true, mayWrite: alles }).ids).toEqual(['img-5']);
  });

  it('ohne Schreibebene löscht ein Konto nichts', () => {
    const r = pickDeletable(bestand, ['img-1', 'img-5'], { layer: null, mayWrite: alles });
    expect(r.ids).toEqual([]);
    expect(r.deselected.map((d) => d.reason)).toEqual(['other-layer', 'other-layer']);
  });

  it('eine herausnehmende Ebenenkante bringt den Artikel nicht in die Ebene', () => {
    expect(pickDeletable(bestand, ['img-6'], { layer: 'meine', mayWrite: alles }).ids).toEqual([]);
  });

  it('Ebenen und Kampagnen gehen hier nie', () => {
    const r = pickDeletable(bestand, ['meine', 'kamp'], { layer: 'meine', unlayered: true, mayWrite: alles });
    expect(r.ids).toEqual([]);
    expect(r.deselected.map((d) => d.reason)).toEqual(['protected', 'protected']);
  });

  it('Unbekanntes und Unsichtbares heisst not-found, ohne Namen', () => {
    const r = pickDeletable(bestand, ['gibts-nicht', 'img-3'], { layer: 'meine', mayWrite: alles, visible: (id) => id !== 'img-3' });
    expect(r.deselected).toEqual([
      { id: 'gibts-nicht', name: 'gibts-nicht', reason: 'not-found' },
      { id: 'img-3', name: 'img-3', reason: 'not-found' },
    ]);
  });

  it('leere Auswahl gibt leere Antwort', () => {
    expect(pickDeletable(bestand, [], { layer: 'meine', mayWrite: alles })).toEqual({ ids: [], deselected: [] });
  });
});

describe('deleteSummary', () => {
  it('nennt gelöscht und abgewählt', () => {
    expect(deleteSummary(3, [
      { id: 'a', name: 'a', reason: 'other-layer' },
      { id: 'b', name: 'b', reason: 'other-layer' },
    ])).toBe('3 deleted, 2 from other layers deselected');
  });
  it('nennt die übrigen Gründe getrennt', () => {
    expect(deleteSummary(0, [
      { id: 'a', name: 'a', reason: 'not-writable' },
      { id: 'b', name: 'b', reason: 'protected' },
      { id: 'c', name: 'c', reason: 'not-found' },
    ])).toBe('0 deleted, 2 you cannot delete deselected, 1 no longer there');
  });
  it('ohne Abgewählte nur die Zahl', () => {
    expect(deleteSummary(1, [])).toBe('1 deleted');
  });
});
