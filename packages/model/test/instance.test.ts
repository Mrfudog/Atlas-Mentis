import { describe, expect, it } from 'vitest';
import {
  detachInstance,
  inheritedFields,
  instancesOf,
  isInstance,
  resolveInstance,
  templateChain,
  thinInstance,
} from '../src/instance.js';
import type { Entity, EntityId } from '../src/types.js';

/* Eine Vorlage „Wache", zwei Wachen daraus. Wache 2 hat eigene
   Trefferpunkte; Wache 1 nichts Eigenes ausser Namen und Kreatur. */
const vorlage: Entity = {
  id: 'sb_wache',
  name: 'Wache',
  interfaces: ['Statblock'],
  components: {
    Identity: { name: 'Wache', id: 'statblock-0001', aliases: [] },
    Visibility: { audience: 'gm' },
    Statblock: { ac: 16, hp: 11, speed: '30' },
    Abilities: { str: 13, dex: 12 },
  },
  relations: [
    { id: 'c1', type: 'composedOf', to: 'r_speer', props: { vars: { DMG: '1d6+1' } } },
    { id: 'c2', type: 'composedOf', to: 'r_schild' },
    { id: 'l1', type: 'inLayer', to: 'ly_nebel' },
  ],
};
const wache = (id: string, eigen: Entity['components'], mehr: Entity['relations'] = []): Entity => ({
  id,
  name: id,
  interfaces: ['Statblock'],
  components: { Identity: { name: id, id: `statblock-${id}`, aliases: [] }, ...eigen },
  relations: [
    { id: `${id}_i`, type: 'instanceOf', to: 'sb_wache' },
    { id: `${id}_b`, type: 'belongsTo', to: `n_${id}` },
    ...(mehr ?? []),
  ],
});
const w1 = wache('w1', {});
const w2 = wache('w2', { Statblock: { hp: 18 } });

function welt(...e: Entity[]): Map<EntityId, Entity> {
  return new Map(e.map((x) => [x.id, x]));
}

describe('an instance reads its template', () => {
  const alle = welt(vorlage, w1, w2);

  it('takes every field it does not set itself', () => {
    const r = resolveInstance(alle, w1);
    expect(r.components['Statblock']).toEqual({ ac: 16, hp: 11, speed: '30' });
    expect(r.components['Abilities']).toEqual({ str: 13, dex: 12 });
  });

  it('keeps what it sets, field by field', () => {
    const r = resolveInstance(alle, w2);
    expect(r.components['Statblock']).toEqual({ ac: 16, hp: 18, speed: '30' });
  });

  /* Die Vorlage korrigiert: Wache 1 folgt, Wache 2 behält ihre 18. */
  it('passes a corrected template on, except where the instance differs', () => {
    const neu = { ...vorlage, components: { ...vorlage.components,
      Statblock: { ac: 17, hp: 12, speed: '30' } } };
    const nachher = welt(neu, w1, w2);
    expect(resolveInstance(nachher, w1).components['Statblock']).toMatchObject({ ac: 17, hp: 12 });
    expect(resolveInstance(nachher, w2).components['Statblock']).toMatchObject({ ac: 17, hp: 18 });
  });

  it('keeps its own name and does not inherit who may see it', () => {
    const r = resolveInstance(alle, w1);
    expect(r.components['Identity']).toEqual({ name: 'w1', id: 'statblock-w1', aliases: [] });
    expect(r.components['Visibility']).toBeUndefined();
  });

  it('brings the actions along, but not where the template lives', () => {
    const r = resolveInstance(alle, w1);
    expect(r.relations?.filter((x) => x.type === 'composedOf').map((x) => x.to))
      .toEqual(['r_speer', 'r_schild']);
    expect(r.relations?.some((x) => x.type === 'inLayer')).toBe(false);
    expect(r.relations?.filter((x) => x.type === 'belongsTo').map((x) => x.to)).toEqual(['n_w1']);
  });

  it('uses its own actions instead of the template’s once it has any', () => {
    const w3 = wache('w3', {}, [{ id: 'x1', type: 'composedOf', to: 'r_bogen' }]);
    const r = resolveInstance(welt(vorlage, w3), w3);
    expect(r.relations?.filter((x) => x.type === 'composedOf').map((x) => x.to)).toEqual(['r_bogen']);
  });

  it('does not touch the stored article', () => {
    resolveInstance(alle, w2);
    expect(w2.components).toEqual({
      Identity: { name: 'w2', id: 'statblock-w2', aliases: [] },
      Statblock: { hp: 18 },
    });
  });

  it('says which fields came from the template', () => {
    expect(inheritedFields(alle, w2)).toContain('Statblock.ac');
    expect(inheritedFields(alle, w2)).not.toContain('Statblock.hp');
    expect(inheritedFields(alle, vorlage)).toEqual([]);
  });

  it('leaves an article without a template as it is', () => {
    expect(resolveInstance(alle, vorlage)).toBe(vorlage);
    expect(isInstance(vorlage)).toBe(false);
    expect(isInstance(w1)).toBe(true);
    expect(instancesOf(alle, vorlage).map((x) => x.id)).toEqual(['w1', 'w2']);
  });
});

describe('a template may itself be an instance', () => {
  const hauptmann = wache('hauptmann', { Statblock: { ac: 18 } });
  const unter: Entity = {
    ...wache('u1', {}),
    relations: [{ id: 'u1_i', type: 'instanceOf', to: 'hauptmann' }],
  };

  it('reads up the chain, nearest first', () => {
    const alle = welt(vorlage, hauptmann, unter);
    expect(templateChain(alle, unter).map((x) => x.id)).toEqual(['hauptmann', 'sb_wache']);
    expect(resolveInstance(alle, unter).components['Statblock']).toMatchObject({ ac: 18, hp: 11 });
  });

  it('stops at a circle instead of running forever', () => {
    const a: Entity = { id: 'a', name: 'a', interfaces: ['Statblock'], components: {},
      relations: [{ id: 'ai', type: 'instanceOf', to: 'b' }] };
    const b: Entity = { id: 'b', name: 'b', interfaces: ['Statblock'], components: {},
      relations: [{ id: 'bi', type: 'instanceOf', to: 'a' }] };
    expect(templateChain(welt(a, b), a).map((x) => x.id)).toEqual(['b']);
  });
});

describe('what an instance stores', () => {
  const alle = welt(vorlage, w1, w2);

  /* Die Maske schickt den aufgelösten Artikel zurück. Gespeichert wird,
     was jemand geändert hat — sonst stünde nach dem ersten Speichern jeder
     Wert der Vorlage fest an der Wache, und keine Korrektur käme mehr an. */
  it('keeps only what differs from the template', () => {
    const r = resolveInstance(alle, w2);
    r.components['Statblock'] = { ...r.components['Statblock'], speed: '40' };
    const t = thinInstance(alle, r);
    expect(t.components['Statblock']).toEqual({ hp: 18, speed: '40' });
    expect(t.components['Abilities']).toBeUndefined();
    expect(t.components['Identity']).toEqual(w2.components['Identity']);
  });

  it('follows the template again when its value is typed back in', () => {
    const r = resolveInstance(alle, w2);
    r.components['Statblock'] = { ...r.components['Statblock'], hp: 11 };
    expect(thinInstance(alle, r).components['Statblock']).toBeUndefined();
  });

  it('stores no inherited edge, and keeps its own', () => {
    const t = thinInstance(alle, resolveInstance(alle, w1));
    expect(t.relations?.map((x) => x.type).sort()).toEqual(['belongsTo', 'instanceOf']);
  });

  /* Wache 2 legt den Schild ab. Kante für Kante verglichen bliebe der
     Speer als „gleich wie die Vorlage" übrig, fiele weg — und mit ihm die
     Streichung: beim Lesen käme der Schild zurück. */
  it('keeps a changed list of actions whole, under ids of its own', () => {
    const r = resolveInstance(alle, w2);
    r.relations = (r.relations ?? []).filter((x) => x.to !== 'r_schild');
    const t = thinInstance(alle, r);
    const aktionen = t.relations?.filter((x) => x.type === 'composedOf') ?? [];
    expect(aktionen.map((x) => x.to)).toEqual(['r_speer']);
    expect(aktionen[0]?.id).not.toBe('c1');
    const wieder = resolveInstance(welt(vorlage, t), t);
    expect(wieder.relations?.filter((x) => x.type === 'composedOf').map((x) => x.to))
      .toEqual(['r_speer']);
  });

  it('carries everything over before its template goes', () => {
    const los = detachInstance(alle, w2);
    expect(isInstance(los)).toBe(false);
    expect(los.components['Statblock']).toEqual({ ac: 16, hp: 18, speed: '30' });
    expect(los.relations?.filter((x) => x.type === 'composedOf')).toHaveLength(2);
  });
});
