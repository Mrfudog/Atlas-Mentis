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
    expect(createLayout(seedRegistry, 'create', 'Deity')).toEqual({ fields: [], prose: [], designed: false });
    expect(createLayout(seedRegistry, 'createFull', 'Deity')).toEqual({ fields: [], prose: [], designed: false });
  });

  it('gestaltet eine Art ihre Maske, gilt sie für sie und ihre Untertypen', () => {
    const r = mit((x) => {
      x.interfaces['Creature']!.views = { ...x.interfaces['Creature']!.views, create: [{ id: 'c', el: 'fields', fields: ['Description.description'] }] };
    });
    expect(createLayout(r, 'create', 'Creature')).toEqual({ fields: ['Description.description'], prose: [], designed: true });
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
    expect(createLayout(r, 'create', 'Creature')).toEqual({ fields: [], prose: [], designed: false });
  });

  it('nennt die Pflichtfelder, die eine Maske nicht fragt — ohne Name, Nummer und Felder mit Vorgabe', () => {
    /* Action verlangt `actionType` ohne Vorgabe (REQ-432 Beispiel). */
    expect(createMissingRequired(seedRegistry, 'Action', [{ id: 'x', el: 'fields', fields: [] }])).toEqual(['Action.actionType']);
    expect(createMissingRequired(seedRegistry, 'Action', [{ id: 'x', el: 'fields', fields: ['Action.actionType'] }])).toEqual([]);
    expect(createMissingRequired(seedRegistry, 'Action', [{ id: 's', el: 'section', children: [{ id: 'x', el: 'fields', fields: 'all' }] }])).toEqual([]);
  });
});

/* T-462, REQ-461: mehrere Masken je Art — Ansichten in der Gruppe `createFull`
   mit Geltung; gewählt beim Anlegen und im Bearbeiten, Vorgabe je Kontext. */
import { createFormFor, createForms, createPlaceOf } from '../src/viewScope.js';

describe('Erfassungsansichten einer Art (T-462)', () => {
  it('Roleplay und Fight stehen im Register, in der Gruppe createFull, und gelten für Kreaturen', () => {
    expect(createForms(seedRegistry, 'Creature').map((f) => f.key)).toEqual(['roleplay', 'fight']);
    expect(createForms(seedRegistry, 'PlayerCharacter').map((f) => f.key)).toEqual(['roleplay', 'fight']);
    expect(createForms(seedRegistry, 'Statblock').map((f) => f.key)).toEqual(['fight']);
    expect(createForms(seedRegistry, 'Item')).toEqual([]);
    expect(createPlaceOf(seedRegistry, 'roleplay')).toBe('createFull');
    expect(createPlaceOf(seedRegistry, 'createFull')).toBe('createFull');
    expect(createPlaceOf(seedRegistry, 'handout')).toBeNull();
  });

  it('die Vorgabe folgt dem Kontext (defaultIn), sonst der ersten Maske', () => {
    expect(createFormFor(seedRegistry, 'Creature', ['world'])).toBe('roleplay');
    expect(createFormFor(seedRegistry, 'Creature', ['play'])).toBe('fight');
    expect(createFormFor(seedRegistry, 'Creature', ['Encounter'])).toBe('fight');
    expect(createFormFor(seedRegistry, 'Creature', [])).toBe('roleplay');
    expect(createFormFor(seedRegistry, 'Statblock', ['world'])).toBe('fight');
    expect(createFormFor(seedRegistry, 'Item', ['world'])).toBeNull();
  });

  it('eine Maske fragt auch Prosafelder, in ihrer Reihenfolge', () => {
    const rp = createLayout(seedRegistry, 'roleplay', 'Creature');
    expect(rp.designed).toBe(true);
    expect(rp.prose.slice(0, 4)).toEqual(['Creature.appearance', 'Creature.personality', 'Creature.background', 'Creature.keyInfo']);
    expect(rp.prose).toContain('Secrets.secret');
    expect(rp.fields).toContain('Creature.agenda');
    /* Dieselben Felder, nur anders angeordnet: Fight fragt den Stand, nicht das Aussehen. */
    const fi = createLayout(seedRegistry, 'fight', 'Creature');
    expect(fi.fields).toContain('Vitals.hp');
    expect(fi.prose).not.toContain('Creature.appearance');
    /* Am Statblock fragt Fight die Zahlen; was die Kreatur hat, nicht. */
    const sb = createLayout(seedRegistry, 'fight', 'Statblock');
    expect(sb.fields.slice(0, 3)).toEqual(['Statblock.size', 'Statblock.ac', 'Statblock.hp']);
    expect(sb.prose).toContain('Tactics.tactics');
    expect(sb.fields).not.toContain('Vitals.hp');
  });

  it('eine Maske ohne Zeile ist keine Maske, auch mit Schlüssel einer Gruppe', () => {
    expect(createLayout(seedRegistry, 'nirgends', 'Creature')).toEqual({ fields: [], prose: [], designed: false });
  });
});
