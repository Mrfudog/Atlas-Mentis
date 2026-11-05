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
    expect(createLayout(danach, 'createFull', 'Deity')).toEqual({ fields: ['Deity.symbol'], prose: [], designed: true });
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

/* T-462, REQ-461: die Masken „Roleplay“ und „Fight“ kommen mit dem Register,
   für jede Rolle gleich; ein Artikel, über beide geschrieben, hält dieselben Felder. */
import { createFormFor, createForms } from '@nw/model';

describe('Erfassungsansichten „Roleplay“ und „Fight“ (T-462)', () => {
  it('das Register bringt beide, für Leitung und Spielerin gleich; am Statblock nur Fight', async () => {
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten });
    for (const wer of ['Mira', 'Sela']) {
      const r = await t.json<Registry>(wer, 'GET', '/api/registry');
      expect(createForms(r, 'Creature').map((f) => f.key)).toEqual(['roleplay', 'fight']);
      expect(createForms(r, 'Statblock').map((f) => f.key)).toEqual(['fight']);
      expect(createFormFor(r, 'Creature', ['world'])).toBe('roleplay');
      expect(createFormFor(r, 'Creature', ['Encounter'])).toBe('fight');
      expect(createLayout(r, 'roleplay', 'Creature').prose).toContain('Creature.appearance');
      expect(createLayout(r, 'fight', 'Creature').fields).toContain('Vitals.hp');
      /* Die Hilfetexte stehen am Feld, nicht im Code. */
      expect(r.interfaces['Creature']?.schema?.properties['personality']?.description).toMatch(/Alexandrian/);
    }
  });

  it('was über Roleplay geschrieben wurde, liest Fight: dieselben Karten, nichts doppelt', async () => {
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten });
    const neu = await t.als('Mira', 'POST', '/api/entities', {
      payload: { type: 'Creature', name: 'Wirtin Ada', fields: { 'Creature.appearance': ['A scar across the brow'], 'Creature.agenda': 'Keep the inn' } },
    });
    expect(neu.statusCode, neu.body).toBe(201);
    const { id } = neu.json<{ id: string }>();
    const e = await t.json<Entity>('Mira', 'GET', `/api/entities/${id}`);
    const karte = e.components['Creature'] as Record<string, unknown>;
    expect(karte['agenda']).toBe('Keep the inn');
    /* Fight schreibt den Stand in `Vitals`; was Roleplay schrieb, bleibt. */
    const res = await t.als('Mira', 'PUT', `/api/entities/${id}`, { payload: { ...e, components: { ...e.components, Vitals: { hp: 12 } } } });
    expect(res.statusCode, res.body).toBe(200);
    const danach = await t.json<Entity>('Mira', 'GET', `/api/entities/${id}`);
    expect((danach.components['Vitals'] as Record<string, unknown>)['hp']).toBe(12);
    expect((danach.components['Creature'] as Record<string, unknown>)['agenda']).toBe('Keep the inn');
  });
});
