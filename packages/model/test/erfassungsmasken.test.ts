import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CREATE_VIEWS, PLACE_VIEWS, createLayout, createMissingRequired } from '../src/views.js';
import type { Registry } from '../src/types.js';

/* T-425, REQ-432, E-169: die Erfassungsmasken `create` und `createFull`. */
const mit = (aendern: (r: Registry) => void): Registry => {
  const r = structuredClone(seedRegistry) as Registry;
  aendern(r);
  return r;
};

describe('Erfassungsmasken', () => {
  it('sind Ortsansichten und stehen im Register', () => {
    for (const k of CREATE_VIEWS) {
      expect(PLACE_VIEWS).toContain(k);
      expect(seedRegistry.views[k]).toBeDefined();
    }
  });

  it('ohne Gestaltung: nicht gestaltet, keine Felder — es gilt das Heutige', () => {
    expect(createLayout(seedRegistry, 'create', 'Deity')).toEqual({ fields: [], designed: false });
    expect(createLayout(seedRegistry, 'createFull', 'Deity')).toEqual({ fields: [], designed: false });
  });

  it('gestaltet eine Art ihre Maske, gilt sie für sie und ihre Untertypen', () => {
    const r = mit((x) => {
      x.interfaces['Creature']!.views = { ...x.interfaces['Creature']!.views, create: [{ id: 'c', el: 'fields', fields: ['Description.description'] }] };
    });
    expect(createLayout(r, 'create', 'Creature')).toEqual({ fields: ['Description.description'], designed: true });
    expect(createLayout(r, 'create', 'PlayerCharacter').designed).toBe(true);
    expect(createLayout(r, 'create', 'Item').designed).toBe(false);
  });

  it('fragt in der Reihenfolge der Maske, nicht in der des Typs', () => {
    const r = mit((x) => {
      x.interfaces['Deity']!.views = { ...x.interfaces['Deity']!.views, createFull: [{ id: 'd', el: 'fields', fields: ['Deity.symbol', 'Deity.pantheon'] }] };
    });
    expect(createLayout(r, 'createFull', 'Deity').fields).toEqual(['Deity.symbol', 'Deity.pantheon']);
  });

  it('eine Ansicht ohne Zeile ist keine Maske', () => {
    const r = mit((x) => {
      delete x.views['create'];
    });
    expect(createLayout(r, 'create', 'Creature')).toEqual({ fields: [], designed: false });
  });

  it('nennt die Pflichtfelder, die eine Maske nicht fragt — ohne Name, Nummer und Felder mit Vorgabe', () => {
    /* Action verlangt `actionType` ohne Vorgabe (REQ-432 Beispiel). */
    expect(createMissingRequired(seedRegistry, 'Action', [{ id: 'x', el: 'fields', fields: [] }])).toEqual(['Action.actionType']);
    expect(createMissingRequired(seedRegistry, 'Action', [{ id: 'x', el: 'fields', fields: ['Action.actionType'] }])).toEqual([]);
    expect(createMissingRequired(seedRegistry, 'Action', [{ id: 's', el: 'section', children: [{ id: 'x', el: 'fields', fields: 'all' }] }])).toEqual([]);
  });
});
