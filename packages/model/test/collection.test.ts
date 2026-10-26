import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { collectionGroups, collectionHits, collectionQuery, collectionView } from '../src/collection.js';
import { incomingIndex, pickView } from '../src/viewScope.js';
import { RegistrySchema } from '../src/validate.js';
import type { Entity, LayoutElement } from '../src/types.js';

/**
 * **Collection** (T-425, REQ-430, E-142): was an einem Artikel hängt, in der
 * Ansicht seiner eigenen Art — die Session zeigt ihre Szenen und
 * Begegnungen, gesiebt, sortiert und auf Wunsch nach Art gruppiert.
 */
const id = (name: string, nr: string, sort?: number) => ({
  Identity: { name, id: nr, aliases: [] },
  ...(sort === undefined ? {} : { Time: { sort } }),
});
const teil = (to: string) => ({ type: 'partOf', to });
const session: Entity = { id: 'ses_1', interfaces: ['Session'], name: 'Session 1', components: id('Session 1', 'session-0001') };
const alter: Entity = { id: 'sc_alter', interfaces: ['Scene'], name: 'Der Alte', components: id('Der Alte', 'scene-0002'), relations: [teil('ses_1')] };
const miene: Entity = { id: 'sc_miene', interfaces: ['Scene'], name: 'Die Miene', components: id('Die Miene', 'scene-0010'), relations: [teil('ses_1')] };
const frueh: Entity = { id: 'sc_frueh', interfaces: ['Scene'], name: 'Am Morgen', components: id('Am Morgen', 'scene-0099', 1), relations: [teil('ses_1')] };
const ratten: Entity = { id: 'enc_ratten', interfaces: ['Encounter'], name: 'Rats', components: id('Rats', 'encounter-0001'), relations: [teil('ses_1')] };
const anderswo: Entity = { id: 'sc_anderswo', interfaces: ['Scene'], name: 'Anderswo', components: id('Anderswo', 'scene-0003'), relations: [teil('ses_2')] };
const alle = [session, alter, miene, frueh, ratten, anderswo];
const rueck = incomingIndex(alle);

/* Was der Betrachter sieht: `get` liefert nur, was der Server geschickt hat. */
const ctx = (sichtbar: readonly Entity[] = alle) => {
  const m = new Map(sichtbar.map((e) => [e.id, e]));
  return { get: (x: string) => m.get(x), incoming: (x: string) => rueck.get(x) ?? [] };
};
const el = (patch: Partial<LayoutElement> = {}): LayoutElement => ({
  id: 'se-contains',
  el: 'collection',
  path: [{ relation: 'partOf', dir: 'in' }],
  ...patch,
});

describe('collectionHits (T-425)', () => {
  it('folgt dem Pfad und ordnet nach Zeit, dann nach Nummer', () => {
    const hits = collectionHits(seedRegistry, session, el(), ctx());
    expect(hits.map((h) => h.entity.id)).toEqual(['sc_frueh', 'enc_ratten', 'sc_alter', 'sc_miene']);
  });

  it('nimmt nur die genannten Arten, die extends-Kette hoch', () => {
    const hits = collectionHits(seedRegistry, session, el({ types: ['Encounter'] }), ctx());
    expect(hits.map((h) => h.entity.id)).toEqual(['enc_ratten']);
  });

  it('sortiert nach Name oder Feld, auch absteigend', () => {
    expect(collectionHits(seedRegistry, session, el({ sort: { by: 'name' } }), ctx()).map((h) => h.entity.id)).toEqual([
      'sc_frueh',
      'sc_alter',
      'sc_miene',
      'enc_ratten',
    ]);
    expect(collectionHits(seedRegistry, session, el({ sort: { by: 'name', desc: true } }), ctx())[0]!.entity.id).toBe('enc_ratten');
  });

  it('zeigt nur, was der Betrachter bekommt (der Server hat gesiebt)', () => {
    const hits = collectionHits(seedRegistry, session, el(), ctx([session, alter, ratten]));
    expect(hits.map((h) => h.entity.id)).toEqual(['enc_ratten', 'sc_alter']);
  });

  it('ohne Pfad ist sie leer, nicht der Artikel selbst', () => {
    expect(collectionHits(seedRegistry, session, el({ path: undefined }), ctx())).toEqual([]);
  });
});

describe('collectionGroups (T-425)', () => {
  it('ohne Gruppierung eine Gruppe ohne Überschrift', () => {
    const hits = collectionHits(seedRegistry, session, el(), ctx());
    const g = collectionGroups(seedRegistry, hits, el());
    expect(g).toHaveLength(1);
    expect(g[0]!.label).toBe('');
  });

  it('nach Art: die Gruppen in der Reihenfolge ihres ersten Treffers, beschriftet wie die Art', () => {
    const hits = collectionHits(seedRegistry, session, el({ groupBy: 'type' }), ctx());
    const g = collectionGroups(seedRegistry, hits, el({ groupBy: 'type' }));
    expect(g.map((x) => x.key)).toEqual(['Scene', 'Encounter']);
    expect(g[0]!.label).toBe(seedRegistry.interfaces['Scene']!.label);
    expect(g[0]!.hits.map((h) => h.entity.id)).toEqual(['sc_frueh', 'sc_alter', 'sc_miene']);
  });
});

describe('collectionView (T-425, E-172)', () => {
  it('Kacheln zeigen quick, eine Liste overview', () => {
    expect(collectionView(seedRegistry, el(), 'Scene')).toBe('quick');
    expect(collectionView(seedRegistry, el({ show: 'list' }), 'Scene')).toBe('overview');
  });

  it('die Vorgabe des Elements, je Zielart überschreibbar, die Kette hoch', () => {
    const e = el({ view: 'print', viewByType: { Encounter: 'full' } });
    expect(collectionView(seedRegistry, e, 'Scene')).toBe('print');
    expect(collectionView(seedRegistry, e, 'Encounter')).toBe('full');
  });
});

describe('Register (T-425)', () => {
  it('die Prüfung behält, was eine Collection einstellt', () => {
    const e = el({ show: 'list', types: ['Scene'], view: 'quick', viewByType: { Encounter: 'full' }, sort: { by: 'name', desc: true }, groupBy: 'type' });
    const r = RegistrySchema.parse({ ...seedRegistry, views: { ...seedRegistry.views, probe: { label: 'Probe', fields: 'all', group: 'probe', layout: [e] } } });
    expect(r.views['probe']!.layout).toEqual([e]);
  });

  it('die Session zeigt, was zu ihr gehört, über eine Collection', () => {
    const full = seedRegistry.interfaces['Session']!.views?.['full'];
    const liste = Array.isArray(full) ? full : [];
    const c = liste.find((x) => x.el === 'collection');
    expect(c).toMatchObject({ path: [{ relation: 'partOf', dir: 'in' }], types: ['Scene', 'Encounter'], show: 'tiles' });
    expect(liste.some((x) => x.el === 'parts')).toBe(false);
  });
});

describe('Collection fertig (T-425, Schnitt 3)', () => {
  it('unranked: was mit Rang im Lesefluss steht, bleibt draussen', () => {
    const kapitel: Entity = { ...frueh, id: 'sc_kapitel', relations: [{ type: 'partOf', to: 'ses_1', props: { rank: 1 } }] };
    const r = incomingIndex([...alle, kapitel]);
    const c = { get: (x: string) => [...alle, kapitel].find((e) => e.id === x), incoming: (x: string) => r.get(x) ?? [] };
    expect(collectionHits(seedRegistry, session, el(), c).map((h) => h.entity.id)).toContain('sc_kapitel');
    expect(collectionHits(seedRegistry, session, el({ unranked: true }), c).map((h) => h.entity.id)).not.toContain('sc_kapitel');
  });

  it('Quelle Filter: die gefundenen Artikel, eingeengt, geordnet, ohne den Artikel selbst', () => {
    const f = el({ source: 'filter', path: undefined, types: ['Scene'], sort: { by: 'name' } });
    const hits = collectionHits(seedRegistry, session, f, { ...ctx(), found: [session, ratten, miene, alter] });
    expect(hits.map((h) => h.entity.id)).toEqual(['sc_alter', 'sc_miene']);
  });

  it('collectionQuery: was der Server für einen Filter gefragt wird', () => {
    expect(collectionQuery(el({ source: 'filter', types: ['Scene', 'Encounter'], filter: { tags: ['rumour'], fields: ['Status.status:ready'], q: 'mine' }, limit: 6 }))).toEqual({
      of: ['Scene', 'Encounter'],
      tag: ['rumour'],
      f: ['Status.status:ready'],
      q: 'mine',
      limit: 6,
    });
    expect(collectionQuery(el({ source: 'filter' }))).toEqual({ limit: 24 });
    expect(collectionQuery(el())).toBeNull();
  });

  it('eine Tabelle zeigt ihre Treffer in der Übersicht', () => {
    expect(collectionView(seedRegistry, el({ show: 'table' }), 'Scene')).toBe('overview');
  });

  it('die Prüfung behält Tabelle, Filter, Grenze und unranked', () => {
    const e = el({ show: 'table', source: 'filter', filter: { tags: ['x'], fields: ['Status.status:ready'], q: 'a' }, limit: 5, unranked: true, props: ['rank'], fields: ['Status.status'] });
    const r = RegistrySchema.parse({ ...seedRegistry, views: { ...seedRegistry.views, probe: { label: 'Probe', fields: 'all', group: 'probe', layout: [e] } } });
    expect(r.views['probe']!.layout).toEqual([e]);
  });
});

describe('Vorgaben (T-425, Schnitt 3)', () => {
  const ids = (typ: string) => pickView({ id: 'x', interfaces: [typ], components: {} }, seedRegistry, 'full').layout.map((x) => x.id);
  it('jede Geschichte zeigt, was ohne Rang zu ihr gehört — gleich nach ihren Teilen', () => {
    for (const typ of ['Arc', 'Scene']) {
      const l = ids(typ);
      expect(l).toContain('st-contains');
      expect(l.indexOf('st-contains')).toBe(l.indexOf('l-parts') + 1);
    }
    const c = pickView({ id: 'x', interfaces: ['Arc'], components: {} }, seedRegistry, 'full').layout.find((x) => x.id === 'st-contains');
    expect(c).toMatchObject({ el: 'collection', path: [{ relation: 'partOf', dir: 'in' }], types: ['Story', 'Encounter'], unranked: true });
  });
  it('ein Ort zeigt seine Unterorte und wer dort lebt', () => {
    expect(ids('Place')).toEqual(expect.arrayContaining(['o-within', 'o-residents']));
  });
  it('die Session behält ihre eigene', () => {
    expect(ids('Session')).toContain('se-contains');
    expect(ids('Session')).not.toContain('st-contains');
  });
});
