import { describe, expect, it } from 'vitest';
import { compatibleMechanics, groupMembers, isGroupLayer, isLayer, mechanicsOf, resolvedStack, type Entity } from '../src/index.js';

/* Regelsystem und Regelmechanik als Ebenen (E-166). Erfundene Ebenen. */

const ebene = (id: string, art: string, karte: Record<string, unknown> = {}, relations: Entity['relations'] = []): Entity => ({
  id,
  interfaces: [art],
  components: { Layer: { kind: 'pack', order: 10, ...karte } },
  relations,
});
const teil = (id: string, von: string) => ({ id: `${von}~p`, type: 'partOf', to: id, props: {} });
const passt = (id: string, an: string) => ({ id: `${an}~c-${id}`, type: 'compatibleWith', to: id, props: {} });

const inventar = ebene('inv', 'RuleSystem', { kind: 'group' });
const gewicht = ebene('weight', 'RuleMechanic', {}, [teil('inv', 'weight')]);
const raster = ebene('grid', 'RuleMechanic', {}, [teil('inv', 'grid'), passt('weight', 'grid')]);
const slots = ebene('slots', 'RuleMechanic', {}, [teil('inv', 'slots')]);
const formen = ebene('shapes', 'RuleMechanic', {}, [teil('inv', 'shapes'), passt('grid', 'shapes'), passt('slots', 'shapes')]);
const buch = ebene('book', 'Layer');
const alle = new Map([inventar, gewicht, raster, slots, formen, buch].map((e) => [e.id, e]));

describe('isLayer', () => {
  it('kennt Ebene, Regelsystem und Regelmechanik', () => {
    expect([buch, inventar, raster].map(isLayer)).toEqual([true, true, true]);
    expect(isLayer({ id: 'x', interfaces: ['Item'], components: {} })).toBe(false);
    expect(isLayer(undefined)).toBe(false);
  });
  it('ein Regelsystem als Gruppe ist eine Gruppe', () => {
    expect(isGroupLayer(inventar)).toBe(true);
    expect(isGroupLayer(raster)).toBe(false);
  });
});

describe('Mechaniken eines Regelsystems', () => {
  it('stehen als Mitglieder der Gruppe', () => {
    expect(groupMembers(alle).get('inv')?.sort()).toEqual(['grid', 'shapes', 'slots', 'weight']);
    expect(mechanicsOf(alle, 'inv').map((e) => e.id).sort()).toEqual(['grid', 'shapes', 'slots', 'weight']);
  });
  it('kommen mit, wenn die Kampagne das Regelsystem aufschaltet', () => {
    const kampagne: Entity = { id: 'c', interfaces: ['Campaign'], components: {}, relations: [{ id: 'a', type: 'activates', to: 'inv', props: { order: 10 } }] };
    expect(resolvedStack(alle, kampagne).map((l) => l.id).sort()).toEqual(['grid', 'inv', 'shapes', 'slots', 'weight']);
  });
});

describe('compatibleMechanics', () => {
  it('liest die Kante in beide Richtungen', () => {
    expect(compatibleMechanics(alle, 'grid').sort()).toEqual(['shapes', 'weight']);
    expect(compatibleMechanics(alle, 'weight')).toEqual(['grid']);
    expect(compatibleMechanics(alle, 'slots')).toEqual(['shapes']);
  });
  it('ohne Kante keine', () => {
    expect(compatibleMechanics(alle, 'book')).toEqual([]);
    expect(compatibleMechanics(alle, 'gibt-es-nicht')).toEqual([]);
  });
});
