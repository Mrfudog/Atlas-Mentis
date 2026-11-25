/**
 * Vorgabeformen des Inventarmoduls (T-394, E-165): Form und Stapel aus
 * Gruppen und Werten je Gegenstand, beim Lesen gerechnet (D8), nie in den
 * Gegenstand geschrieben. Erfundene Gegenstände.
 */

import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string, ly: string) => ({ id: `${id}_in`, type: 'inLayer', to: ly, props: {} });
const ding = (id: string, name: string, n: number, item: Record<string, unknown> = {}, extra: Partial<Entity> = {}): Entity => ({
  id,
  name,
  interfaces: ['Item'],
  components: { ...ident(name, `item-000${n}`), Item: item },
  relations: [im(id, 'ly_buch')],
  ...extra,
});

function bestand(aufgeschaltet: boolean): Entity[] {
  return [
    { id: 'ly_buch', name: 'Book', interfaces: ['Layer'], components: { ...ident('Book', 'layer-0001'), Layer: { kind: 'book', order: 0 } }, relations: [] },
    {
      id: 'ly_formen',
      name: 'Default shapes',
      interfaces: ['Layer'],
      components: {
        ...ident('Default shapes', 'layer-0002'),
        Layer: { kind: 'pack', order: 50 },
        ShapeDefaults: {
          shapeGroups: [
            { id: 'W4', name: 'Versatile blade', rows: ['.#.', '###'], stackSize: 1, ref: 'sword' },
            { id: 'AM', name: 'Ammunition', rows: ['#', '#'], stackSize: 32 },
            { id: 'MT', name: 'Mounts', carryable: false },
          ],
          shapeItems: [
            { id: 'sword', group: 'W4', rows: ['#', '#', '#'] },
            { id: 'sword1', group: 'W4', ref: 'sword' },
            { id: 'arrow', group: 'AM' },
            { id: 'horse', group: 'MT' },
            { id: 'blade', group: 'W4', ref: 'secret' },
          ],
        },
      },
      relations: [],
    },
    {
      id: 'camp',
      name: 'Runde',
      interfaces: ['Campaign'],
      components: ident('Runde', 'campaign-0001'),
      relations: [
        { id: 'a1', type: 'activates', to: 'ly_buch', props: { order: 10 } },
        ...(aufgeschaltet ? [{ id: 'a2', type: 'activates', to: 'ly_formen', props: { order: 20 } }] : []),
      ],
    },
    ding('sword', 'Sword', 1, { weight: 3 }),
    ding('sword1', '+1 Sword', 2, { weight: 3, rarity: 'uncommon' }),
    ding('arrow', 'Arrow', 3, { weight: 0.05 }),
    ding('horse', 'Horse', 4),
    ding('own', 'Own shape', 5, { rows: ['##'], stackSize: 2 }),
    ding('blade', 'Blade', 6),
    { ...ding('secret', 'Secret blade', 7, { rows: ['#'] }), components: { ...ident('Secret blade', 'item-0007'), Item: { rows: ['#'] }, Visibility: { audience: 'gm' } } },
  ];
}

const konten = { Mira: { roles: { camp: 'gm' as const } }, Sela: { roles: { camp: 'player' as const } }, Admin: { admin: true } };
const aufbau = (aufgeschaltet = true) => tisch({ kampagne: 'camp', artikel: bestand(aufgeschaltet), konten });
type Antwort = Entity & { refs?: { shape?: Record<string, unknown> } };

describe('Vorgabeformen (T-394)', () => {
  it('erbt die Form vom Referenzgegenstand, mit Herkunft — für Leitung und Spielerin', async () => {
    const t = await aufbau();
    for (const wer of ['Mira', 'Sela']) {
      const e = await t.json<Antwort>(wer, 'GET', '/api/entities/sword1');
      expect(e.components?.['Item']).toMatchObject({ rows: ['#', '#', '#'], stackSize: 1, weight: 3 });
      expect(e.refs?.shape).toMatchObject({ source: 'reference', ref: 'sword', group: 'W4' });
    }
  });

  it('nimmt die Form der Gruppe und die eigene im Untermodul', async () => {
    const t = await aufbau();
    expect((await t.json<Antwort>('Mira', 'GET', '/api/entities/arrow')).components?.['Item']).toMatchObject({ rows: ['#', '#'], stackSize: 32 });
    expect((await t.json<Antwort>('Mira', 'GET', '/api/entities/sword')).refs?.shape).toMatchObject({ source: 'own' });
  });

  it('lässt die eigene Angabe am Gegenstand vorgehen', async () => {
    const t = await aufbau();
    const e = await t.json<Antwort>('Mira', 'GET', '/api/entities/own');
    expect(e.components?.['Item']).toMatchObject({ rows: ['##'], stackSize: 2 });
    expect(e.refs?.shape).toMatchObject({ source: 'item', stackSource: 'item' });
  });

  it('gibt Getragenes nur, wo die Gruppe trägt', async () => {
    const t = await aufbau();
    const e = await t.json<Antwort>('Mira', 'GET', '/api/entities/horse');
    expect(e.components?.['Item']?.['rows']).toBeUndefined();
    expect(e.refs?.shape).toMatchObject({ source: 'none', group: 'MT' });
  });

  it('nennt einen Referenzgegenstand nicht, den die Spielerin nicht sieht', async () => {
    const t = await aufbau();
    const leitung = await t.json<Antwort>('Mira', 'GET', '/api/entities/blade');
    expect(leitung.refs?.shape).toMatchObject({ source: 'reference', ref: 'secret' });
    const spielerin = await t.json<Antwort>('Sela', 'GET', '/api/entities/blade');
    expect(spielerin.components?.['Item']?.['rows']).toEqual(['#']);
    expect(spielerin.refs?.shape?.['ref']).toBeUndefined();
  });

  it('gilt nur, wenn die Ebene aufgeschaltet ist', async () => {
    const t = await aufbau(false);
    const e = await t.json<Antwort>('Mira', 'GET', '/api/entities/sword1');
    expect(e.components?.['Item']?.['rows']).toBeUndefined();
    expect(e.refs?.shape).toBeUndefined();
  });

  it('kommt auch in der Sammelabfrage mit', async () => {
    const t = await aufbau();
    const liste = await t.json<Entity[]>('Admin', 'GET', '/api/entities?ids=arrow,sword1');
    expect(Object.fromEntries(liste.map((e) => [e.id, e.components?.['Item']?.['rows']]))).toEqual({ arrow: ['#', '#'], sword1: ['#', '#', '#'] });
  });

  it('schreibt Gerechnetes nicht in den Gegenstand, eine Abweichung schon', async () => {
    const t = await aufbau();
    const { refs: _r, ...e } = await t.json<Antwort>('Admin', 'GET', '/api/entities/sword1');
    const zurueck = await t.als('Admin', 'PUT', '/api/entities/sword1', { payload: { ...e, components: { ...e.components, Item: { ...e.components?.['Item'], weight: 4 } } } });
    expect(zurueck.statusCode).toBeLessThan(300);
    const gespeichert = await t.repo.getEntity('sword1');
    expect(gespeichert?.components?.['Item']).toEqual({ weight: 4, rarity: 'uncommon' });

    const { refs: _r2, ...e2 } = await t.json<Antwort>('Admin', 'GET', '/api/entities/sword1');
    const anders = await t.als('Admin', 'PUT', '/api/entities/sword1', { payload: { ...e2, components: { ...e2.components, Item: { ...e2.components?.['Item'], rows: ['####'] } } } });
    expect(anders.statusCode).toBeLessThan(300);
    expect((await t.repo.getEntity('sword1'))?.components?.['Item']).toEqual({ weight: 4, rarity: 'uncommon', rows: ['####'] });
    expect((await t.json<Antwort>('Admin', 'GET', '/api/entities/sword1')).refs?.shape).toMatchObject({ source: 'item' });
  });
});
