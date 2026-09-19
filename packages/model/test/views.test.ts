import { describe, expect, it } from 'vitest';
import {
  attachedDerived,
  componentVisible,
  resolveView,
  showBlock,
  showField,
  viewKeys,
} from '../src/views.js';
import type { ComponentDef, Registry, ViewDef } from '../src/types.js';

const statblockInfo: ComponentDef = {
  name: 'StatblockInfo',
  engine: 'Calculation',
  schema: {
    type: 'object',
    properties: {
      ac: { type: 'number', title: 'Rüstungsklasse' },
      tp: { type: 'number', title: 'Trefferpunkte' },
      str: { type: 'number', title: 'STÄ' },
      strMod: { type: 'number', derived: 'mod(str)', of: 'str', format: 'signed' },
      initiative: { type: 'number', derived: 'mod(dex)', format: 'signed' },
    },
  },
};

const kampf: ViewDef = {
  label: 'Kampf',
  order: 3,
  felder: ['StatblockInfo.ac', 'StatblockInfo.tp'],
  bloecke: ['tactics'],
};

describe('showField', () => {
  it('takes a single field when named with a dot', () => {
    expect(showField(kampf, 'StatblockInfo', 'ac')).toBe(true);
    expect(showField(kampf, 'StatblockInfo', 'str')).toBe(false);
  });

  it('takes every field when the bare component is named', () => {
    const werte: ViewDef = { label: 'Werte', felder: ['StatblockInfo'], bloecke: [] };
    expect(showField(werte, 'StatblockInfo', 'ac')).toBe(true);
    expect(showField(werte, 'StatblockInfo', 'str')).toBe(true);
    expect(showField(werte, 'CreatureInfo', 'rolle')).toBe(false);
  });

  it('honours the two keywords', () => {
    expect(showField({ label: 'A', felder: 'alle', bloecke: 'alle' }, 'X', 'y')).toBe(true);
    expect(showField({ label: 'B', felder: 'keine', bloecke: 'alle' }, 'X', 'y')).toBe(false);
  });
});

describe('componentVisible', () => {
  it('is false when no property of the component survives', () => {
    const bild: ViewDef = { label: 'Bild', felder: 'keine', bloecke: [] };
    expect(componentVisible(kampf, 'StatblockInfo', statblockInfo.schema)).toBe(true);
    expect(componentVisible(bild, 'StatblockInfo', statblockInfo.schema)).toBe(false);
  });
});

describe('showBlock', () => {
  it('filters by block type', () => {
    expect(showBlock(kampf, 'tactics')).toBe(true);
    expect(showBlock(kampf, 'secret')).toBe(false);
  });

  it('a player view must not leak secrets', () => {
    const spieler: ViewDef = {
      label: 'Spieler',
      felder: 'keine',
      bloecke: ['paragraph', 'readaloud', 'lore'],
    };
    expect(showBlock(spieler, 'secret')).toBe(false);
    expect(showBlock(spieler, 'readaloud')).toBe(true);
  });
});

describe('attachedDerived', () => {
  it('rides a derived value in its base field unless the view names it', () => {
    const voll: ViewDef = { label: 'Voll', felder: 'alle', bloecke: 'alle' };
    // felder: 'alle' shows strMod in its own right, so nothing is attached.
    expect(attachedDerived(voll, 'StatblockInfo', statblockInfo)).toEqual({});

    const nurStr: ViewDef = { label: 'X', felder: ['StatblockInfo.str'], bloecke: [] };
    expect(attachedDerived(nurStr, 'StatblockInfo', statblockInfo)).toEqual({ str: ['strMod'] });
  });

  it('never attaches a derived value that has no base field', () => {
    const nurInit: ViewDef = { label: 'X', felder: ['StatblockInfo.initiative'], bloecke: [] };
    expect(attachedDerived(nurInit, 'StatblockInfo', statblockInfo)).toEqual({});
  });
});

describe('view ordering', () => {
  const registry: Pick<Registry, 'views'> = {
    views: {
      voll: { label: 'Voll', order: 2, felder: 'alle', bloecke: 'alle' },
      schnell: { label: 'Schnell', order: 1, felder: 'keine', bloecke: ['paragraph'] },
      kampf,
    },
  };

  it('sorts by order', () => {
    expect(viewKeys(registry)).toEqual(['schnell', 'voll', 'kampf']);
  });

  it('falls back to the first view for an unknown key', () => {
    expect(resolveView(registry, 'gibtsnicht').label).toBe('Schnell');
    expect(resolveView({ views: {} }, 'egal').label).toBe('Voll');
  });
});
