import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CHECKS } from '../src/checks.js';
import { RegistrySchema } from '../src/validate.js';
import { forArticle, layoutFor } from '../src/views.js';
import { composeView, contributionFrom, isContribution, isDesignedView, pickView, viewConflicts, viewsFor } from '../src/viewScope.js';
import type { Entity, LayoutElement, Registry, ViewDef } from '../src/types.js';

/**
 * **Schichten** (T-425, E-168, E-173, REQ-434): eine Ansicht setzt sich
 * zusammen — die Anordnung des Typs, darüber Beiträge für alle Artikel,
 * einen Typ, eine Bedingung (Feld, Kante) oder einen Artikel. Ein Beitrag
 * ersetzt nichts, er fügt hinzu, verschiebt, blendet aus. Die Position ist
 * eine Sortierzahl; Gleichstand ordnet die Priorität, dann die genauere
 * Schicht; ändern zwei Beiträge dasselbe Element, gewinnt die genauere.
 */
const sitzung: Entity = { id: 'ses_1', interfaces: ['Session'], name: 'Session 1', components: {} };
const mitKarte: Entity = { ...sitzung, id: 'ses_2', relations: [{ type: 'onMap', to: 'map_1' }] };
const laden: Entity = { id: 'sho_1', interfaces: ['Shop'], name: 'The forge', components: {} };

const beitrag = (patch: Partial<ViewDef>): ViewDef => ({ label: 'Contribution', fields: 'all', group: 'full', adjust: {}, ...patch });
const karte: LayoutElement = { id: 'map-if-linked', el: 'map', pos: 15, when: { relation: 'onMap' } };
const mit = (views: Record<string, ViewDef>): Registry => ({ ...seedRegistry, views: { ...seedRegistry.views, ...views } });
const ids = (l: readonly LayoutElement[]) => l.map((e) => e.id);

describe('composeView (T-425, E-168)', () => {
  it('ohne Beitrag zeichnet jede Ansicht wie bisher', () => {
    for (const typ of ['Session', 'Creature', 'Shop', 'Item', 'Scene']) {
      const e: Entity = { id: 'x', interfaces: [typ], name: 'x', components: {} };
      for (const ort of ['overview', 'quick', 'full', 'print']) {
        const basis = layoutFor(seedRegistry, ort, typ).layout;
        const neu = pickView(e, seedRegistry, ort).layout;
        /* Dieselben Elemente; nur eine ausdrückliche Position (`st-contains`, 65) stellt um. */
        if (basis.some((x) => x.pos !== undefined)) expect(ids(neu).sort()).toEqual(ids(basis).sort());
        else expect(neu).toEqual(basis);
      }
    }
  });

  it('ein Beitrag für alle Artikel setzt die Karte an Position 15 — zwischen das erste und zweite Element jeder Art', () => {
    const r = mit({ karteFallsVerknuepft: beitrag({ adjust: { extra: [karte] } }) });
    const basis = layoutFor(r, 'full', 'Session').layout;
    const neu = pickView(sitzung, r, 'full');
    expect(ids(neu.layout)).toEqual([basis[0]!.id, 'map-if-linked', ...ids(basis.slice(1))]);
    /* Die Bedingung bleibt am Element: an einer Session ohne Karte steht sie nicht. */
    expect(ids(forArticle(neu.layout, sitzung))).not.toContain('map-if-linked');
    expect(ids(forArticle(neu.layout, mitKarte))).toContain('map-if-linked');
    /* Dasselbe an einem Laden — eine Schicht für jede Art. */
    expect(ids(pickView(laden, r, 'full').layout)).toContain('map-if-linked');
    /* Die Herkunft steht dabei. */
    expect(neu.origin['map-if-linked']).toEqual(['karteFallsVerknuepft']);
  });

  it('die Schichten liegen von allgemein nach genau: der Artikel nimmt weg, was alle bekommen', () => {
    const r = mit({
      fuerAlle: beitrag({ adjust: { extra: [karte] } }),
      nurDieseSitzung: beitrag({ applies: { article: 'ses_2' }, adjust: { drop: ['map-if-linked'] } }),
    });
    expect(ids(pickView(mitKarte, r, 'full').layout)).not.toContain('map-if-linked');
    expect(ids(pickView({ ...mitKarte, id: 'ses_3' }, r, 'full').layout)).toContain('map-if-linked');
    const c = composeView(mitKarte, r, 'full');
    expect(c.conflicts).toEqual([{ kind: 'conflict', element: 'map-if-linked', sources: ['fuerAlle', 'nurDieseSitzung'], winner: 'nurDieseSitzung' }]);
  });

  it('bei gleicher Genauigkeit gewinnt die höhere Priorität, unabhängig von der Reihenfolge im Register', () => {
    const r = mit({
      b: beitrag({ applies: { types: ['Session'] }, priority: 5, adjust: { extra: [{ id: 'k', el: 'text', text: 'B', pos: 5 }] } }),
      a: beitrag({ applies: { types: ['Session'] }, adjust: { extra: [{ id: 'k', el: 'text', text: 'A', pos: 5 }] } }),
    });
    const k = pickView(sitzung, r, 'full').layout.find((e) => e.id === 'k');
    expect(k?.text).toBe('B');
  });

  it('gleiche Position ist kein Fehler, sondern Reihenfolge: die genauere Schicht zuerst, und es wird gemeldet', () => {
    const basis = layoutFor(seedRegistry, 'full', 'Shop').layout;
    const r = mit({
      waren: beitrag({ applies: { where: [{ relation: 'sells' }] }, adjust: { extra: [{ id: 'wares-top', el: 'wares', pos: 10 }] } }),
    });
    const verkauft: Entity = { ...laden, relations: [{ type: 'sells', to: 'itm_1' }] };
    const c = composeView(verkauft, r, 'full');
    expect(ids(c.layout).slice(0, 2)).toEqual(['wares-top', basis[0]!.id]);
    expect(c.conflicts).toContainEqual({ kind: 'tie', element: 'wares-top', sources: ['waren', 'type Shop'], position: 10 });
  });

  it('ein Beitrag ist keine Ansicht zum Wählen und wird nicht als gestaltete gezeichnet', () => {
    const def = beitrag({ applies: { types: ['Session'] }, adjust: { extra: [karte] } });
    expect(isContribution(def)).toBe(true);
    expect(isDesignedView(def)).toBe(false);
    expect(viewsFor(sitzung, mit({ x: def })).map((v) => v.key)).not.toContain('x');
    expect(pickView(sitzung, mit({ x: def }), 'full').designed).toBe(false);
  });

  it('die Prüfung behält Beitrag, Priorität und Position', () => {
    const def = beitrag({ priority: 3, applies: { types: ['Session'] }, adjust: { extra: [karte], order: ['se-desc'] } });
    const r = RegistrySchema.parse({ ...seedRegistry, views: { ...seedRegistry.views, x: def } });
    expect(r.views['x']).toMatchObject({ priority: 3, adjust: { extra: [karte], order: ['se-desc'] } });
  });
});

describe('viewConflicts und die Werkbank (T-425, E-173)', () => {
  it('meldet Konflikte und Gleichstände je Ort und Art, mit den Quellen', () => {
    const r = mit({
      fuerAlle: beitrag({ adjust: { extra: [karte] } }),
      nurSitzungen: beitrag({ applies: { types: ['Session'] }, adjust: { drop: ['map-if-linked'] } }),
    });
    const k = viewConflicts(r);
    expect(k).toContainEqual(expect.objectContaining({ group: 'full', type: 'Session', kind: 'conflict', element: 'map-if-linked', sources: ['fuerAlle', 'nurSitzungen'] }));
    expect(viewConflicts(seedRegistry)).toEqual([]);
  });

  it('die Werkbank zeigt sie als Prüfung „View conflicts“ mit dem Weg ins Register', () => {
    const r = mit({
      fuerAlle: beitrag({ adjust: { extra: [karte] } }),
      nurSitzungen: beitrag({ applies: { types: ['Session'] }, adjust: { drop: ['map-if-linked'] } }),
    });
    const pruefung = CHECKS.find((c) => c.key === 'viewConflicts')!;
    const treffer = pruefung.run({ registry: r, entities: [], exists: new Map() });
    expect(treffer.length).toBeGreaterThan(0);
    expect(treffer[0]).toMatchObject({ type: 'view', registry: { tab: 'views', view: 'nurSitzungen' } });
    expect(treffer[0]!.reason).toContain('map-if-linked');
  });
});

describe('Positionen und Beitrag aus dem Entwurf (T-425, E-168)', () => {
  const a: LayoutElement = { id: 'a', el: 'text', text: 'A' };
  const b: LayoutElement = { id: 'b', el: 'text', text: 'B' };
  const c: LayoutElement = { id: 'c', el: 'text', text: 'C' };
  const x: LayoutElement = { id: 'x', el: 'text', text: 'X' };
  /* Ein Register, in dem die Session genau a, b, c zeigt. */
  const basis = (views: Record<string, ViewDef> = {}): Registry => ({
    ...seedRegistry,
    interfaces: { ...seedRegistry.interfaces, Session: { ...seedRegistry.interfaces['Session']!, views: { ...seedRegistry.interfaces['Session']!.views, full: [a, b, c] } } },
    views: { ...seedRegistry.views, ...views },
  });
  const ohnePos = (l: readonly LayoutElement[]) => l.map(({ pos: _p, ...rest }) => rest);

  it('die stillen Positionen kommen aus der Grundlage: was ein Beitrag wegnimmt, verschiebt die anderen nicht', () => {
    const r = basis({
      weg: beitrag({ adjust: { drop: ['a'] } }),
      dazu: beitrag({ applies: { types: ['Session'] }, adjust: { extra: [{ ...x, pos: 15 }] } }),
    });
    const p = pickView(sitzung, r, 'full');
    expect(ids(p.layout)).toEqual(['x', 'b', 'c']);
    expect(p.positions).toEqual({ x: 15, b: 20, c: 30 });
  });

  it('ein Element ohne Position folgt seinem Vorgänger (so wirkt `order` weiter)', () => {
    const r = basis({ y: beitrag({ adjust: { extra: [x], order: ['a', 'x', 'b', 'c'] } }) });
    expect(ids(pickView(sitzung, r, 'full').layout)).toEqual(['a', 'x', 'b', 'c']);
  });

  it('contributionFrom: neu zwischen zwei Ankern, weggenommen, geändert an Ort und Stelle', () => {
    const pos = { a: 10, b: 20, c: 30 };
    const geaendert = { ...c, text: 'C!' };
    const adj = contributionFrom([a, b, c], pos, [a, x, geaendert], ['secret']);
    expect(adj).toEqual({ drop: ['b'], hide: ['secret'], extra: [{ ...x, pos: 20 }, geaendert] });
    const r = basis({ s: beitrag({ adjust: adj }) });
    expect(ohnePos(pickView(sitzung, r, 'full').layout)).toEqual(ohnePos([a, x, geaendert]));
  });

  it('contributionFrom: ein verschobenes Element bekommt eine Position zwischen seine neuen Nachbarn', () => {
    const adj = contributionFrom([a, b, c], { a: 10, b: 20, c: 30 }, [b, a, c]);
    expect(adj).toEqual({ extra: [{ ...a, pos: 25 }] });
    expect(ids(pickView(sitzung, basis({ s: beitrag({ adjust: adj }) }), 'full').layout)).toEqual(['b', 'a', 'c']);
  });

  it('contributionFrom: vorne und hinten, und nichts, wenn nichts anders ist', () => {
    const adj = contributionFrom([a, b], { a: 10, b: 20 }, [x, a, b, { ...x, id: 'z' }]);
    expect(adj.extra?.map((e) => [e.id, e.pos])).toEqual([
      ['x', 5],
      ['z', 30],
    ]);
    expect(contributionFrom([a, b], { a: 10, b: 20 }, [a, b])).toEqual({});
  });
});
