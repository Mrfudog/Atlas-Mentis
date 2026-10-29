import { describe, expect, it } from 'vitest';
import { mechanicSelection, type Entity } from '../src/index.js';

/* Modulrahmen nach E-100 (T-132 Schritt 2): ein Regelsystem ist das Modul,
   eine Regelmechanik das System darin. Erfundene Ebenen, keine Regeltexte. */

type Rel = NonNullable<Entity['relations']>[number];
const ebene = (id: string, art: string, relations: Rel[] = [], kind = 'pack'): Entity => ({
  id,
  name: id,
  interfaces: [art],
  components: { Layer: { kind, order: 10 } },
  relations,
});
const k = (von: string, type: string, to: string, props: Record<string, unknown> = {}): Rel => ({ id: `${von}~${type}-${to}`, type, to, props });

const inv = ebene('inv', 'RuleSystem', [], 'group');
const weight = ebene('weight', 'RuleMechanic', [k('weight', 'partOf', 'inv')]);
const slots = ebene('slots', 'RuleMechanic', [k('slots', 'partOf', 'inv')]);
const grid = ebene('grid', 'RuleMechanic', [k('grid', 'partOf', 'inv'), k('grid', 'compatibleWith', 'weight')]);
const shapes = ebene('shapes', 'RuleMechanic', [
  k('shapes', 'partOf', 'inv'),
  k('shapes', 'extendsMechanic', 'grid'),
  k('shapes', 'extendsMechanic', 'slots'),
]);
const craft = ebene('craft', 'RuleSystem', [], 'group');
const dnd = ebene('dnd', 'RuleMechanic', [k('dnd', 'partOf', 'craft')]);
const kibbles = ebene('kibbles', 'RuleMechanic', [k('kibbles', 'partOf', 'craft'), k('kibbles', 'excludesMechanic', 'dnd')]);
const basil = ebene('basil', 'RuleMechanic', [k('basil', 'partOf', 'craft'), k('basil', 'extendsMechanic', 'kibbles', { mode: 'overrides' })]);
const buch = ebene('book', 'Layer');
const alle = new Map([inv, weight, slots, grid, shapes, craft, dnd, kibbles, basil, buch].map((e) => [e.id, e]));

/** Eine Kampagne, die die genannten Ebenen von unten nach oben aufschaltet. */
const kampagne = (...ids: string[]): Entity => ({
  id: 'c',
  interfaces: ['Campaign'],
  components: {},
  relations: ids.map((id, i) => k('c', 'activates', id, { order: i + 1 })),
});
const gilt = (c: Entity, system: string) =>
  mechanicSelection(alle, c).systems.find((s) => s.system.id === system)?.applies.map((m) => m.id).sort();
const zustand = (c: Entity, id: string) => mechanicSelection(alle, c).mechanics.find((m) => m.mechanic.id === id);

describe('mechanicSelection (E-100)', () => {
  it('ohne Kampagne oder ohne Mechanik im Stapel: nichts', () => {
    expect(mechanicSelection(alle, null)).toEqual({ systems: [], mechanics: [] });
    expect(mechanicSelection(alle, kampagne('book')).mechanics).toEqual([]);
  });

  it('was kompatibel ist, gilt zusammen', () => {
    expect(gilt(kampagne('weight', 'grid'), 'inv')).toEqual(['grid', 'weight']);
  });

  it('zwei Mechaniken ohne Verbindung im selben Modul: die höhere gilt, die tiefere ist verdrängt (E-094)', () => {
    const c = kampagne('weight', 'slots');
    expect(gilt(c, 'inv')).toEqual(['slots']);
    expect(zustand(c, 'weight')).toMatchObject({ status: 'displaced', reason: 'incompatible', by: ['slots'] });
  });

  it('eine Erweiterung gilt mit ihrer Grundlage und liest deren Verträglichkeiten mit', () => {
    expect(gilt(kampagne('weight', 'grid', 'shapes'), 'inv')).toEqual(['grid', 'shapes', 'weight']);
    expect(gilt(kampagne('slots', 'shapes'), 'inv')).toEqual(['shapes', 'slots']);
  });

  it('eine Erweiterung ohne Grundlage gilt nicht', () => {
    const c = kampagne('weight', 'shapes');
    expect(gilt(c, 'inv')).toEqual(['weight']);
    expect(zustand(c, 'shapes')).toMatchObject({ status: 'missingBase', by: ['grid', 'slots'] });
  });

  it('alle vier aufgeschaltet: je Modul eines samt Erweiterungen', () => {
    // Von oben gelesen gewinnt, was zuerst kommt (E-091: die Rangfolge entscheidet).
    const c = kampagne('weight', 'grid', 'slots', 'shapes');
    expect(gilt(c, 'inv')).toEqual(['shapes', 'slots']);
    expect(zustand(c, 'grid')).toMatchObject({ status: 'displaced', by: ['slots'] });
  });

  it('ein Ausschluss wirkt in beide Richtungen und sagt es', () => {
    expect(gilt(kampagne('dnd', 'kibbles'), 'craft')).toEqual(['kibbles']);
    expect(zustand(kampagne('dnd', 'kibbles'), 'dnd')).toMatchObject({ status: 'displaced', reason: 'excluded', by: ['kibbles'] });
    expect(gilt(kampagne('kibbles', 'dnd'), 'craft')).toEqual(['dnd']);
  });

  it('eine Überschreibung ist eine Erweiterung, die bei Gleichstand gewinnt', () => {
    const c = kampagne('kibbles', 'basil');
    expect(gilt(c, 'craft')).toEqual(['basil', 'kibbles']);
    expect(zustand(c, 'basil')).toMatchObject({ status: 'applies', overrides: ['kibbles'] });
    expect(zustand(kampagne('dnd', 'basil'), 'basil')).toMatchObject({ status: 'missingBase', by: ['kibbles'] });
  });

  it('fällt eine Erweiterung weg, gilt wieder, was nur sie verdrängt hatte', () => {
    // Basil (oben, ohne Kibbles) gilt nicht — also verdrängt es D&D auch nicht.
    expect(gilt(kampagne('dnd', 'basil'), 'craft')).toEqual(['dnd']);
  });

  it('Module stehen getrennt: Inventar und Handwerk verdrängen einander nicht', () => {
    const c = kampagne('weight', 'kibbles');
    expect(gilt(c, 'inv')).toEqual(['weight']);
    expect(gilt(c, 'craft')).toEqual(['kibbles']);
  });
});
