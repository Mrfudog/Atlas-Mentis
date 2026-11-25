/**
 * Facetten Teil 2 (T-180): Voraussetzungen und Wirkungen als Facette,
 * „usable by <Figur>" und dieselben Facetten in der übergreifenden Suche.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const art = (
  id: string,
  type: string,
  name: string,
  karte: Record<string, unknown> = {},
  relations: Entity['relations'] = [],
  extra: Entity['components'] = {},
): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name, id: `${type.toLowerCase()}-${id}` }, ...(Object.keys(karte).length ? { [type]: karte } : {}), ...extra },
  relations,
});

const talent = (id: string, name: string, prerequisite?: string) => art(id, 'Feat', name, prerequisite ? { prerequisite } : {});

const bestand = (figurSichtbar: 'public' | 'gm' = 'public'): Entity[] => [
  art('wiz', 'Class', 'Wizard', {}, [], { ClassCasting: { casterProgression: 'full' } }),
  art('ftr', 'Class', 'Fighter'),
  art('clr', 'Class', 'Cleric'),
  art('pal', 'Class', 'Paladin'),
  art('elf', 'Ancestry', 'Elf'),
  art('mira', 'PlayerCharacter', 'Mira', {}, [
    { id: 'mira~k', type: 'hasClass', to: 'wiz', props: { level: 4 } },
    { id: 'mira~a', type: 'hasAncestry', to: 'elf', props: {} },
  ], { Visibility: { audience: figurSichtbar } }),
  art('sb', 'Statblock', 'Mira (stats)', {}, [{ id: 'sb~b', type: 'belongsTo', to: 'mira', props: {} }], {
    Abilities: { str: 8, int: 16, wis: 12 },
    Proficiencies: { proficient: ['light'] },
  }),
  talent('f1', 'Tough'),
  talent('f2', 'Heavy Armor Master', 'proficiency with heavy armor'),
  talent('f3', 'Elven Accuracy', 'Elf or Half-Elf'),
  talent('f4', 'Grappler', 'STR 13'),
  talent('f5', 'War Caster', 'the ability to cast at least one spell'),
  talent('f6', 'Squire of the Moons', 'Dragonlance campaign'),
  talent('f7', 'Ritual Caster', 'level 4, INT 13, WIS 13'),
  talent('f8', 'Boon of Fate', 'level 19'),
  art('i1', 'Item', 'Ring of Fire Resistance', { attunement: true }, [], {
    Effects: { effects: [{ id: 'resist-fire', target: 'resist', op: 'grant', value: 'fire' }] },
  }),
  art('i2', 'Item', 'Holy Symbol of Ages', { attunement: true, attunementNote: 'by a cleric or paladin' }),
  art('i3', 'Item', 'Ring of Protection', { attunement: true, bonusAc: 1 }),
];

async function makeApp(entities: Entity[]) {
  const repo = new InMemoryRepository(seedRegistry, entities);
  const app = buildApp({ repo });
  const konto = async (name: string, isAdmin: boolean) => {
    await repo.putUser({ id: `u_${name}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin });
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const keks = res.cookies.find((c) => c.name === 'nw_session');
    return { cookie: `nw_session=${keks?.value ?? ''}` };
  };
  const gm = await konto('Leitung', true);
  const spieler = await konto('Spieler', false);
  const get = (url: string, headers = gm) => app.inject({ method: 'GET', url, headers }).then((r) => r.json());
  return { get, spieler };
}

const namen = (r: { rows: { name: string }[] }) => r.rows.map((z) => z.name);

describe('requirements as a facet (T-180)', () => {
  it('reads the prerequisite sentence into checkable conditions', async () => {
    const { get } = await makeApp(bestand());
    const r = await get('/api/list?type=Feat');
    const f = r.facets.fields.find((x: { ref: string }) => x.ref === 'Feat.prerequisite');
    expect(f.of).toBe('requirement');
    const labels = f.options.map((o: { label: string }) => o.label);
    expect(labels).toEqual(expect.arrayContaining(['None', 'Level 4+', 'STR 13+', 'INT 13+', 'Spellcasting', 'Proficiency: heavy', 'Ancestry: Elf', 'Other (text only)']));
    const caster = await get('/api/list?type=Feat&f=Feat.prerequisite:spellcasting');
    expect(namen(caster)).toEqual(['War Caster']);
  });

  it('keeps what a character meets, drops what it cannot, marks what is unknown', async () => {
    const { get } = await makeApp(bestand());
    const r = await get('/api/list?type=Feat&usable=mira');
    expect(namen(r)).toEqual(['Elven Accuracy', 'Ritual Caster', 'Squire of the Moons', 'Tough', 'War Caster']);
    expect(r.rows.find((z: { name: string }) => z.name === 'Squire of the Moons').usable).toBe('unknown');
    expect(r.rows.find((z: { name: string }) => z.name === 'Tough').usable).toBeUndefined();
    expect(r.facets.usable).toEqual({ id: 'mira', name: 'Mira', hidden: 3, unknown: 1 });
    /* Am Gegenstand: Einstimmung „by a cleric or paladin". */
    const g = await get('/api/list?type=Item&usable=mira');
    expect(namen(g)).toEqual(['Ring of Fire Resistance', 'Ring of Protection']);
  });

  it('ignores a character the viewer cannot see', async () => {
    const { get, spieler } = await makeApp(bestand('gm'));
    const r = await get('/api/list?type=Feat&usable=mira', spieler);
    expect(r.facets.usable).toBeUndefined();
    expect(r.total).toBe(8);
  });
});

describe('effects as a facet (T-180)', () => {
  it('lists target and kind, old bonus fields included', async () => {
    const { get } = await makeApp(bestand());
    const r = await get('/api/list?type=Item');
    const f = r.facets.fields.find((x: { ref: string }) => x.ref === 'Effects.effects');
    expect(f.options).toEqual(
      expect.arrayContaining([
        { value: 'resist:fire', count: 1, label: 'Resistance: fire' },
        { value: 'add:ac', count: 1, label: 'Bonus: AC' },
      ]),
    );
    expect(namen(await get('/api/list?type=Item&f=Effects.effects:add:ac'))).toEqual(['Ring of Protection']);
  });
});

describe('facets in the global search (T-180)', () => {
  it('filters with the facets of the chosen type and returns them', async () => {
    const { get } = await makeApp(bestand());
    const r = await get('/api/search?q=a&type=Feat&f=Feat.prerequisite:spellcasting');
    expect(namen(r)).toEqual(['War Caster']);
    expect(r.facets.fields.some((x: { ref: string }) => x.ref === 'Feat.prerequisite')).toBe(true);
    const u = await get('/api/search?q=r&type=Feat&usable=mira');
    expect(u.facets.usable).toMatchObject({ id: 'mira' });
    expect(namen(u)).not.toContain('Grappler');
  });
});

describe('spell lists and usable by (T-212)', () => {
  const zauber = (id: string, name: string, level: number) => art(id, 'Spell', name, { level });
  const mitListen = (): Entity[] =>
    bestand().map((e) =>
      e.id === 'wiz'
        ? { ...e, components: { ...e.components, Class: { casterProgression: 'full' } }, relations: [
            { id: 'wiz~l1', type: 'spellList', to: 'sp1', props: {} },
            { id: 'wiz~l2', type: 'spellList', to: 'sp2', props: {} },
            { id: 'wiz~l3', type: 'spellList', to: 'sp3', props: {} },
          ] }
        : e.id === 'clr'
          ? { ...e, relations: [{ id: 'clr~l1', type: 'spellList', to: 'sp4', props: {} }] }
          : e,
    ).concat([zauber('sp1', 'Fire Bolt', 0), zauber('sp2', 'Misty Step', 2), zauber('sp3', 'Fireball', 3), zauber('sp4', 'Bless', 1), zauber('sp5', 'Wish (no list)', 9)]);

  it('keeps the spells on the lists of the character’s classes, up to the level it casts', async () => {
    const { get } = await makeApp(mitListen());
    /* Ein Magier der Stufe 4 wirkt Grad 2 — Fireball nicht, Bless steht auf keiner seiner Listen. */
    const r = await get('/api/list?type=Spell&usable=mira');
    expect(namen(r).sort()).toEqual(['Fire Bolt', 'Misty Step', 'Wish (no list)']);
    expect(r.facets.usable).toMatchObject({ hidden: 2 });
  });

  it('filters by the class spell list, first among the spell facets', async () => {
    const { get } = await makeApp(mitListen());
    const r = await get('/api/list?type=Spell');
    expect(r.facets.fields[0]).toMatchObject({ ref: 'in.spellList', label: 'Class spell list' });
    const nurKleriker = await get('/api/list?type=Spell&f=in.spellList:clr');
    expect(namen(nurKleriker)).toEqual(['Bless']);
  });
});
