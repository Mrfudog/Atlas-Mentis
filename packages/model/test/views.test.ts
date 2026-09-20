import { describe, expect, it } from 'vitest';
import {
  attachedDerived,
  componentVisible,
  resolveView,
  showField,
  viewKeys,
} from '../src/views.js';
import type { ObjectSchema, Registry, ViewDef } from '../src/types.js';

const statblockInfo: ObjectSchema = {
  type: 'object',
  properties: {
    ac: { type: 'number', title: 'Rüstungsklasse' },
    tp: { type: 'number', title: 'Trefferpunkte' },
    str: { type: 'number', title: 'STÄ' },
    strMod: { type: 'number', derived: 'mod(str)', of: 'str', format: 'signed' },
    initiative: { type: 'number', derived: 'mod(dex)', format: 'signed' },
  },
};

const combat: ViewDef = {
  label: 'Combat',
  order: 3,
  fields: ['StatblockInfo.ac', 'StatblockInfo.tp'],
};

describe('showField', () => {
  it('takes a single field when named with a dot', () => {
    expect(showField(combat, 'StatblockInfo', 'ac')).toBe(true);
    expect(showField(combat, 'StatblockInfo', 'str')).toBe(false);
  });

  it('takes every field when the bare component is named', () => {
    const stats: ViewDef = { label: 'Werte', fields: ['StatblockInfo'] };
    expect(showField(stats, 'StatblockInfo', 'ac')).toBe(true);
    expect(showField(stats, 'StatblockInfo', 'str')).toBe(true);
    expect(showField(stats, 'CreatureInfo', 'rolle')).toBe(false);
  });

  it('honours the two keywords', () => {
    expect(showField({ label: 'A', fields: 'all' }, 'X', 'y')).toBe(true);
    expect(showField({ label: 'B', fields: 'none' }, 'X', 'y')).toBe(false);
  });
});

describe('componentVisible', () => {
  it('is false when no property of the component survives', () => {
    const image: ViewDef = { label: 'Image', fields: 'none' };
    expect(componentVisible(combat, 'StatblockInfo', statblockInfo)).toBe(true);
    expect(componentVisible(image, 'StatblockInfo', statblockInfo)).toBe(false);
  });
});

describe('attachedDerived', () => {
  it('rides a derived value in its base field unless the view names it', () => {
    const full: ViewDef = { label: 'Full', fields: 'all' };
    // fields: 'all' shows strMod in its own right, so nothing is attached.
    expect(attachedDerived(full, 'StatblockInfo', statblockInfo)).toEqual({});

    const nurStr: ViewDef = { label: 'X', fields: ['StatblockInfo.str'] };
    expect(attachedDerived(nurStr, 'StatblockInfo', statblockInfo)).toEqual({ str: ['strMod'] });
  });

  it('never attaches a derived value that has no base field', () => {
    const nurInit: ViewDef = { label: 'X', fields: ['StatblockInfo.initiative'] };
    expect(attachedDerived(nurInit, 'StatblockInfo', statblockInfo)).toEqual({});
  });
});

describe('view ordering', () => {
  const registry: Pick<Registry, 'views'> = {
    views: {
      full: { label: 'Full', order: 2, fields: 'all' },
      quick: { label: 'Quick', order: 1, fields: 'none' },
      combat,
    },
  };

  it('sorts by order', () => {
    expect(viewKeys(registry)).toEqual(['quick', 'full', 'combat']);
  });

  it('falls back to the first view for an unknown key', () => {
    expect(resolveView(registry, 'gibtsnicht').label).toBe('Quick');
    expect(resolveView({ views: {} }, 'egal').label).toBe('Full');
  });
});
