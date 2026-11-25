import { describe, expect, it } from 'vitest';
import type { Entity, Registry } from '../src/index';
import { ICONS, ICON_SOURCES, fieldIcon, iconDef, iconOf, searchIcons, typeIcon } from '../src/index';

/* Icons im Register (T-461, REQ-460): eine Art trägt ihr Icon, Untertypen
   erben es die `extends`-Kette hoch, ein Artikel darf es überschreiben,
   ein Feld trägt seines selbst. Ohne Icon gibt es keines — kein Platzhalter,
   der aussieht wie eine Wahl. */
function reg(): Pick<Registry, 'interfaces'> {
  return {
    interfaces: {
      Identity: { name: 'Identity', abstract: true, schema: { type: 'object', properties: { name: { type: 'string' }, icon: { type: 'string', format: 'icon' } } } },
      Place: { name: 'Place', extends: ['Identity'], icon: 'map-pin', schema: { type: 'object', properties: { kind: { type: 'string', icon: 'tags' } } } },
      Town: { name: 'Town', extends: ['Place'] },
      Harbour: { name: 'Harbour', extends: ['Town'], icon: 'ship' },
      Note: { name: 'Note', extends: ['Identity'] },
    },
  };
}

function artikel(type: string, icon?: string): Entity {
  return { id: 'e1', interfaces: [type], components: { Identity: { name: 'X', id: 'x-1', ...(icon ? { icon } : {}) } } } as Entity;
}

describe('icons of types, fields and articles (T-461)', () => {
  it('a type carries its icon, a subtype inherits it, a nearer one wins', () => {
    const r = reg();
    expect(typeIcon(r, 'Place')).toBe('map-pin');
    expect(typeIcon(r, 'Town')).toBe('map-pin');
    expect(typeIcon(r, 'Harbour')).toBe('ship');
    expect(typeIcon(r, 'Note')).toBeUndefined();
    expect(typeIcon(r, 'Unknown')).toBeUndefined();
    expect(typeIcon(r, undefined)).toBeUndefined();
  });

  it('an article overrides the icon of its type; empty means the type’s', () => {
    const r = reg();
    expect(iconOf(r, artikel('Town'))).toBe('map-pin');
    expect(iconOf(r, artikel('Town', 'globe'))).toBe('globe');
    expect(iconOf(r, artikel('Town', '   '))).toBe('map-pin');
    expect(iconOf(r, artikel('Note'))).toBeUndefined();
    expect(iconOf(r, undefined)).toBeUndefined();
  });

  it('a field carries its own icon', () => {
    const r = reg();
    expect(fieldIcon(r, 'Place', 'kind')).toBe('tags');
    expect(fieldIcon(r, 'Place', 'name')).toBeUndefined();
    expect(fieldIcon(r, 'Nope', 'kind')).toBeUndefined();
  });
});

describe('the icon catalogue', () => {
  it('has unique ids, a path and tags for every icon, and a source with a licence', () => {
    expect(ICONS.length).toBeGreaterThanOrEqual(30);
    const ids = ICONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of ICONS) {
      expect(i.d, i.id).toMatch(/^[Mm]/);
      expect(i.label.trim(), i.id).not.toBe('');
      expect(i.tags.length, i.id).toBeGreaterThan(0);
      expect(ICON_SOURCES[i.source], i.id).toBeDefined();
    }
    for (const q of Object.values(ICON_SOURCES)) {
      expect(q.licence.trim()).not.toBe('');
      expect(q.url).toMatch(/^https:/);
    }
  });

  it('finds an icon by id, label and tag, and nothing for an unknown name', () => {
    expect(iconDef('map-pin')?.label).toBe('Map pin');
    expect(iconDef('nope')).toBeUndefined();
    expect(iconDef(undefined)).toBeUndefined();
    expect(searchIcons('pin').map((i) => i.id)).toContain('map-pin');
    expect(searchIcons('location').map((i) => i.id)).toContain('map-pin');
    expect(searchIcons('Map Pin').map((i) => i.id)[0]).toBe('map-pin');
    expect(searchIcons('')).toHaveLength(ICONS.length);
    expect(searchIcons('zzzz')).toEqual([]);
  });
});
