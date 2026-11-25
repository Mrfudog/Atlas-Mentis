/**
 * Abenteuer als Ebene (T-082, REQ-240, E-018): die Kampagnenseite zeigt
 * ein aufgeschaltetes Abenteuer unter den Abenteuern und seine Kapitel in
 * der Geschichte der Kampagne; „Adapt" legt eine Fassung in der Ebene der
 * Kampagne an, die das Original ersetzt, und Verweise aufs Original führen
 * dann zu ihr. Das Original bleibt unberührt.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ident = (name: string, id: string) => ({
  Identity: { name, id, aliases: [] },
  Status: { status: 'ready' },
});
const in_ = (id: string, ly: string) => ({ id: `${id}~inLayer`, type: 'inLayer', to: ly, props: {} });
const teil = (id: string, to: string) => ({ id: `${id}~partOf`, type: 'partOf', to, props: {} });
/* Ein Kapitel und ein eigener Arc sind ein `Arc` (E-026); nur das Abenteuer bleibt eine Story mit `kind`. */
const geschichte = (id: string, name: string, nr: string, kind: string, ly: string, von?: string): Entity => ({
  id,
  name,
  interfaces: [kind === 'arc' ? 'Arc' : 'Story'],
  components: { ...ident(name, nr), ...(kind === 'arc' ? {} : { Story: { kind } }), Visibility: { audience: 'gm' } },
  relations: [in_(id, ly), ...(von ? [teil(id, von)] : [])],
});

const BESTAND: Entity[] = [
  { id: 'e5_book_tst', name: 'The Sunken Test', interfaces: ['Layer'], components: { ...ident('The Sunken Test', 'layer-0001'), Layer: { kind: 'adventure', order: 0 }, Tags: { tags: ['adventure'] } }, relations: [] },
  { id: 'ly_a', name: 'Runde A', interfaces: ['Layer'], components: { ...ident('Runde A', 'layer-0002'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  {
    id: 'camp_a', name: 'Aus Nebel wacht', interfaces: ['Campaign'], components: ident('Aus Nebel wacht', 'campaign-0001'),
    relations: [
      { id: 'camp_a~ac1', type: 'activates', to: 'e5_book_tst', props: { order: 10 } },
      { id: 'camp_a~ac2', type: 'activates', to: 'ly_a', props: { order: 20 } },
    ],
  },
  geschichte('st_tst', 'The Sunken Test', 'story-0001', 'adventure', 'e5_book_tst'),
  geschichte('st_k2', 'Chapter 2: Deep', 'arc-0002', 'arc', 'e5_book_tst', 'st_tst'),
  geschichte('st_k1', 'Chapter 1: Reeds', 'arc-0001', 'arc', 'e5_book_tst', 'st_tst'),
  {
    id: 'sc_mund', name: '1. Mouth', interfaces: ['Scene'],
    components: {
      ...ident('1. Mouth', 'scene-0001'), Visibility: { audience: 'gm' },
      Prose: { paragraph: [{ id: 'text', value: 'Wet. See [[scene-0002|2]].' }] },
    },
    relations: [in_('sc_mund', 'e5_book_tst'), teil('sc_mund', 'st_k1')],
  },
  {
    id: 'sc_bau', name: '2. Den', interfaces: ['Scene'],
    components: { ...ident('2. Den', 'scene-0002'), Visibility: { audience: 'gm' }, Prose: { paragraph: [{ id: 'text', value: 'Dry.' }] } },
    relations: [in_('sc_bau', 'e5_book_tst'), teil('sc_bau', 'st_k1')],
  },
  geschichte('st_eigen', 'Session zero', 'arc-0003', 'arc', 'ly_a', 'camp_a'),
  {
    id: 'mp_mund', name: 'Mouth', interfaces: ['Map'],
    components: { ...ident('Mouth', 'map-0001'), Visibility: { audience: 'gm' } },
    relations: [in_('mp_mund', 'e5_book_tst'), { id: 'mp_mund~mapOf', type: 'mapOf', to: 'sc_mund', props: {} }],
  },
];

async function aufbau() {
  const repo = new InMemoryRepository(seedRegistry, BESTAND.map((e) => structuredClone(e)));
  const app = buildApp({ repo });
  for (const [name, admin, roles] of [
    ['Admin', true, {}],
    ['Basil', false, { camp_a: 'gm' }],
    ['Sela', false, { camp_a: 'player' }],
  ] as const) {
    await repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: admin, actorIds: [], roles: { ...roles } });
  }
  const kekse = new Map<string, string>();
  const rufe = async (name: string, method: 'GET' | 'POST', url: string, payload?: object) => {
    if (!kekse.has(name)) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      kekse.set(name, `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return app.inject({ method, url, headers: { cookie: kekse.get(name)! }, ...(payload ? { payload } : {}) });
  };
  return { repo, rufe };
}

describe('an adventure is a layer of its own (T-082)', () => {
  it('stands under the adventures on the campaign page', async () => {
    const { rufe } = await aufbau();
    const l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    expect(l.layers.find((x: { id: string }) => x.id === 'e5_book_tst')).toMatchObject({ kind: 'adventure', active: true });
  });

  it('shows its chapters in the story of the campaign, in order, next to its own', async () => {
    const { rufe } = await aufbau();
    const s = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/story')).json();
    expect(s.own.map((x: { id: string }) => x.id)).toEqual(['st_eigen']);
    expect(s.adventures).toHaveLength(1);
    expect(s.adventures[0]).toMatchObject({ id: 'st_tst', layer: 'e5_book_tst' });
    expect(s.adventures[0].chapters.map((x: { name: string }) => x.name)).toEqual(['Chapter 1: Reeds', 'Chapter 2: Deep']);
    expect((await rufe('Sela', 'GET', '/api/campaigns/camp_a/story')).statusCode).toBe(403);
  });
});

describe('adapting over the template (E-018 a)', () => {
  it('makes a version in the campaign layer that replaces the original, and only once', async () => {
    const { repo, rufe } = await aufbau();
    const r = await rufe('Admin', 'POST', '/api/entities/st_k1/adapt');
    expect(r.statusCode).toBe(201);
    const { id } = r.json();
    const fassung = (await repo.getEntity(id))!;
    expect(fassung.relations?.map((k) => [k.type, k.to])).toEqual([
      ['partOf', 'st_tst'],
      ['inLayer', 'ly_a'],
      ['overrides', 'st_k1'],
    ]);
    expect((fassung.components['Identity'] as { id: string }).id).toBe('arc-0004');
    /* Das Original bleibt, wie es war. */
    expect((await repo.getEntity('st_k1'))!.relations?.map((k) => k.type)).toEqual(['inLayer', 'partOf']);
    /* Ein zweites Mal gibt dieselbe Fassung zurück. */
    const nochmal = await rufe('Admin', 'POST', '/api/entities/st_k1/adapt');
    expect(nochmal.statusCode).toBe(200);
    expect(nochmal.json()).toEqual({ id, created: false });
    /* Die Geschichte zeigt die Fassung an der Stelle des Originals. */
    const s = (await rufe('Admin', 'GET', '/api/campaigns/camp_a/story')).json();
    expect(s.adventures[0].chapters.map((x: { id: string; adapted: boolean }) => [x.id, x.adapted])).toEqual([
      [id, true],
      ['st_k2', false],
    ]);
  });

  it('leads references to the original to the version, and its backlinks come along', async () => {
    const { rufe } = await aufbau();
    const { id } = (await rufe('Admin', 'POST', '/api/entities/sc_bau/adapt')).json();
    /* Die Seite bietet „Adapt" an, wo die Route es annähme — nicht an der Fassung. */
    expect((await rufe('Admin', 'GET', '/api/entities/sc_mund')).json().refs.adaptable).toBe(true);
    expect((await rufe('Admin', 'GET', `/api/entities/${id}`)).json().refs.adaptable).toBeUndefined();
    /* Die Leitung passt in die Ebene ihrer Kampagne an (T-098), eine Spielerin ohne eigene Ebene nicht. */
    expect((await rufe('Basil', 'GET', '/api/entities/sc_mund')).json().refs.adaptTo).toEqual([{ id: 'ly_a', name: 'Runde A' }]);
    expect((await rufe('Sela', 'GET', '/api/entities/sc_mund')).json().refs?.adaptable).toBeUndefined();
    /* Das Original öffnen heisst, die Fassung zu bekommen. */
    expect((await rufe('Admin', 'GET', '/api/entities/sc_bau')).json().id).toBe(id);
    /* `[[scene-0002|2]]` in der Nachbarszene führt zur Fassung. */
    const mund = (await rufe('Admin', 'GET', '/api/entities/sc_mund')).json();
    expect(mund.refs.links['scene-0002'].map((x: { id: string }) => x.id)).toEqual([id]);
    /* Ein angepasstes Kapitel behält seine Szenen. */
    const { id: kap } = (await rufe('Admin', 'POST', '/api/entities/st_k1/adapt')).json();
    const rueck = (await rufe('Admin', 'GET', `/api/entities/${kap}/backlinks`)).json();
    expect(rueck.map((b: { from: { id: string } }) => b.from.id).sort()).toEqual(['sc_mund', id].sort());
    const szene = (await rufe('Admin', 'GET', '/api/entities/sc_mund')).json();
    expect(szene.refs.names['st_k1']).toBe('Chapter 1: Reeds');
  });

  it('refuses what already is the campaign’s, and who may not', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Admin', 'POST', '/api/entities/st_eigen/adapt')).statusCode).toBe(409);
    /* Was eine Spielerin nicht sieht (`audience: 'gm'`), gibt es für sie nicht. */
    expect((await rufe('Sela', 'POST', '/api/entities/st_k1/adapt')).statusCode).toBe(404);
    /* Die Leitung schreibt die Ebene ihrer Kampagne (T-098): dort liegt die Fassung schon zum Bearbeiten. */
    expect((await rufe('Basil', 'POST', '/api/entities/st_eigen/adapt')).statusCode).toBe(403);
    expect((await rufe('Admin', 'POST', '/api/entities/gibt-es-nicht/adapt')).statusCode).toBe(404);
  });
});

describe('taking a part of an adventure into the campaign (E-026)', () => {
  it('offers the campaign and its own arcs, to the gm and the admin, not to a player', async () => {
    const { rufe } = await aufbau();
    const ziele = (await rufe('Basil', 'GET', '/api/entities/st_k1')).json().refs.takeInto;
    expect(ziele.map((z: { id: string }) => z.id)).toEqual(['camp_a', 'st_eigen']);
    expect((await rufe('Admin', 'GET', '/api/entities/sc_mund')).json().refs.takeInto).toHaveLength(2);
    expect((await rufe('Sela', 'GET', '/api/entities/st_k1')).json().refs?.takeInto).toBeUndefined();
    /* Ein eigener Arc liegt schon in der Kampagne — nichts zu übernehmen. */
    expect((await rufe('Basil', 'GET', '/api/entities/st_eigen')).json().refs?.takeInto).toBeUndefined();
    /* Leitungstext sieht sie nicht — also gibt es ihn für sie nicht. */
    expect((await rufe('Sela', 'POST', '/api/entities/st_k1/take', { into: 'camp_a' })).statusCode).toBe(404);
  });

  it('takes a whole chapter with its scenes and maps, and hangs it into the campaign', async () => {
    const { repo, rufe } = await aufbau();
    const r = await rufe('Basil', 'POST', '/api/entities/st_k1/take', { into: 'camp_a' });
    expect(r.statusCode).toBe(201);
    const { id, created, taken } = r.json();
    expect([created, taken]).toEqual([4, 4]);
    const alle = await repo.listEntities();
    const fassungVon = (orig: string) => alle.find((e) => (e.relations ?? []).some((k) => k.type === 'overrides' && k.to === orig))!;
    const kap = (await repo.getEntity(id))!;
    expect(kap.interfaces).toEqual(['Arc']);
    expect(kap.relations?.filter((k) => k.type === 'partOf').map((k) => k.to)).toEqual(['camp_a']);
    /* Die Szenen hängen an der Fassung des Kapitels, die Karte an der Fassung ihrer Szene. */
    for (const s of ['sc_mund', 'sc_bau']) {
      const f = fassungVon(s);
      expect(f.relations?.find((k) => k.type === 'partOf')?.to).toBe(id);
      expect(f.relations?.find((k) => k.type === 'inLayer')?.to).toBe('ly_a');
    }
    expect(fassungVon('mp_mund').relations?.find((k) => k.type === 'mapOf')?.to).toBe(fassungVon('sc_mund').id);
    /* Die Originale bleiben. */
    expect((await repo.getEntity('st_k1'))!.relations?.find((k) => k.type === 'partOf')?.to).toBe('st_tst');
    /* Die Geschichte zeigt das Kapitel bei den eigenen und als angepasst beim Abenteuer. */
    const s = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/story')).json();
    expect(s.own.map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining([id, 'st_eigen']));
    expect(s.adventures[0].chapters[0]).toMatchObject({ id, adapted: true });
  });

  it('takes a single scene into an own arc, and taking again makes nothing twice', async () => {
    const { repo, rufe } = await aufbau();
    const erst = (await rufe('Basil', 'POST', '/api/entities/sc_mund/take', { into: 'st_eigen' })).json();
    expect(erst.created).toBe(2);
    expect((await repo.getEntity(erst.id))!.relations?.find((k) => k.type === 'partOf')?.to).toBe('st_eigen');
    const vorher = (await repo.listEntities()).length;
    const nochmal = (await rufe('Basil', 'POST', '/api/entities/sc_mund/take', { into: 'camp_a' })).json();
    expect(nochmal).toMatchObject({ id: erst.id, created: 0 });
    expect((await repo.listEntities()).length).toBe(vorher);
    /* Ohne Ziel fragt der Server, wohin. */
    const frage = await rufe('Basil', 'POST', '/api/entities/sc_bau/take', {});
    expect(frage.statusCode).toBe(409);
    expect(frage.json().into.map((z: { id: string }) => z.id)).toEqual(['camp_a', 'st_eigen']);
  });
});
