/**
 * **Erfassungsmasken am Server** (T-425, REQ-432, E-169): die Ortsansichten
 * `create` und `createFull` kommen mit dem Register, und die Verwaltung kann
 * sie an einer Art gestalten; jede Rolle liest dieselbe Maske.
 */
import { describe, expect, it } from 'vitest';
import { createLayout, createSteps, hasBuilder, type Entity, type Registry } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const id = (name: string, nr: string) => ({ Identity: { name, id: nr, aliases: [] }, Status: { status: 'ready' } });
const ARTIKEL = (): Entity[] => [
  { id: 'ly_a', name: 'Runde A', interfaces: ['Layer'], components: { ...id('Runde A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'camp_a', name: 'Nebel', interfaces: ['Campaign'], components: id('Nebel', 'campaign-0001'), relations: [{ id: 'camp_a~ac', type: 'activates', to: 'ly_a', props: { order: 10 } }] },
];
const konten = { Vera: { admin: true }, Mira: { roles: { camp_a: 'gm' as const } }, Sela: { roles: { camp_a: 'player' as const } } };

describe('Erfassungsmasken (T-425, E-169)', () => {
  it('das Register bringt create und createFull, ungestaltet', async () => {
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten });
    for (const wer of ['Mira', 'Sela']) {
      const r = await t.json<Registry>(wer, 'GET', '/api/registry');
      expect(r.views['create']?.label).toBe('Create');
      expect(r.views['createFull']?.label).toBe('Create (full)');
      expect(createLayout(r, 'createFull', 'Deity').designed).toBe(false);
    }
  });

  it('die Verwaltung gestaltet die Maske einer Art, und das Register gibt sie zurück', async () => {
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten });
    const r = await t.json<Registry>('Vera', 'GET', '/api/registry');
    const deity = r.interfaces['Deity']!;
    const ifs = { ...r.interfaces, Deity: { ...deity, views: { ...(deity.views ?? {}), createFull: [{ id: 'cf-d', el: 'fields', fields: ['Deity.symbol'] }] } } };
    const res = await t.als('Vera', 'PUT', '/api/registry/interfaces', { payload: ifs });
    expect(res.statusCode, res.body).toBe(200);
    const danach = await t.json<Registry>('Sela', 'GET', '/api/registry');
    expect(createLayout(danach, 'createFull', 'Deity')).toEqual({ fields: ['Deity.symbol'], designed: true });
  });

  it('ein Ablauf mit Steps lässt sich speichern, und die Spielerfigur führt in den Assistenten (REQ-440, E-169, E-176)', async () => {
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten });
    const r = await t.json<Registry>('Vera', 'GET', '/api/registry');
    expect(hasBuilder(r, 'create', 'PlayerCharacter')).toBe(true);
    const deity = r.interfaces['Deity']!;
    const ablauf = [{ id: 'st', el: 'steps', children: [{ id: 's1', el: 'section', text: 'Basics', children: [{ id: 'f1', el: 'fields', fields: ['Deity.symbol'] }] }] }];
    const ifs = { ...r.interfaces, Deity: { ...deity, views: { ...(deity.views ?? {}), createFull: ablauf } } };
    const res = await t.als('Vera', 'PUT', '/api/registry/interfaces', { payload: ifs });
    expect(res.statusCode, res.body).toBe(200);
    const danach = await t.json<Registry>('Mira', 'GET', '/api/registry');
    expect(createSteps(danach, 'createFull', 'Deity')).toEqual([{ id: 's1', title: 'Basics', fields: ['Deity.symbol'] }]);
  });
});
