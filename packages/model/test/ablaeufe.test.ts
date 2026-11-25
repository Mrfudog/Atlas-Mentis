/**
 * **Abläufe als Ansicht mit Steps** (T-425, REQ-440, E-176): ein Element
 * `steps` in einer Erfassungsmaske macht aus jedem Kind eine Seite. Wo man
 * steht, wird nicht gespeichert, sondern aus dem Befüllten gelesen; ein
 * Element `builder` in `create` heisst: das Anlegen führt in den
 * Charakter-Assistenten (E-169).
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity, LayoutElement, Registry } from '../src/types.js';
import { createSteps, currentStep, hasBuilder } from '../src/steps.js';

const ABLAUF: LayoutElement[] = [
  {
    id: 'st',
    el: 'steps',
    children: [
      { id: 's1', el: 'section', text: 'Basics', children: [{ id: 'f1', el: 'fields', fields: ['Deity.pantheon', 'Deity.title'] }] },
      { id: 's2', el: 'section', text: 'Signs', children: [{ id: 'f2', el: 'fields', fields: ['Deity.symbol'] }] },
      { id: 's3', el: 'section', children: [{ id: 'f3', el: 'fields', fields: ['Deity.plane'] }] },
    ],
  },
];

function mit(f: (r: Registry) => void): Registry {
  const r = structuredClone(seedRegistry) as Registry;
  f(r);
  return r;
}
const deity = (werte: Record<string, unknown> = {}): Entity => ({ id: 'd', name: 'D', interfaces: ['Deity'], components: { Deity: werte }, relations: [] });

describe('createSteps (REQ-440)', () => {
  it('ohne Element steps kein Ablauf', () => {
    expect(createSteps(seedRegistry, 'createFull', 'Deity')).toBeNull();
  });

  it('je Kind eine Seite, mit Titel und den Feldern darin in ihrer Reihenfolge', () => {
    const r = mit((x) => {
      x.interfaces['Deity']!.views = { ...x.interfaces['Deity']!.views, createFull: ABLAUF };
    });
    expect(createSteps(r, 'createFull', 'Deity')).toEqual([
      { id: 's1', title: 'Basics', fields: ['Deity.pantheon', 'Deity.title'] },
      { id: 's2', title: 'Signs', fields: ['Deity.symbol'] },
      { id: 's3', title: 'Step 3', fields: ['Deity.plane'] },
    ]);
  });
});

describe('currentStep (E-176: aus dem Befüllten gelesen)', () => {
  const r = mit((x) => {
    x.interfaces['Deity']!.views = { ...x.interfaces['Deity']!.views, createFull: ABLAUF };
    x.interfaces['Deity']!.schema!.required = ['symbol'];
  });
  const steps = createSteps(r, 'createFull', 'Deity')!;

  it('leer: die erste Seite', () => {
    expect(currentStep(r, steps, deity())).toBe(0);
  });
  it('nach dem letzten berührten Schritt der nächste', () => {
    expect(currentStep(r, steps, deity({ pantheon: 'Sea' }))).toBe(1);
  });
  it('fehlt weiter vorn ein Pflichtfeld, dorthin', () => {
    expect(currentStep(r, steps, deity({ pantheon: 'Sea', plane: 'Water' }))).toBe(1);
  });
  it('alles befüllt: die letzte Seite, nicht darüber hinaus', () => {
    expect(currentStep(r, steps, deity({ pantheon: 'Sea', symbol: 'Shell', plane: 'Water' }))).toBe(2);
  });
  it('ohne Schritte: die erste Seite', () => {
    expect(currentStep(r, [], deity())).toBe(0);
  });
});

describe('hasBuilder (E-169)', () => {
  it('die Spielerfigur führt beim Anlegen in den Assistenten, andere Arten nicht', () => {
    expect(hasBuilder(seedRegistry, 'create', 'PlayerCharacter')).toBe(true);
    expect(hasBuilder(seedRegistry, 'create', 'Creature')).toBe(false);
  });
  it('auch in einem Behälter gefunden', () => {
    const r = mit((x) => {
      x.interfaces['Deity']!.views = { ...x.interfaces['Deity']!.views, create: [{ id: 's', el: 'section', children: [{ id: 'b', el: 'builder' }] }] };
    });
    expect(hasBuilder(r, 'create', 'Deity')).toBe(true);
  });
});
