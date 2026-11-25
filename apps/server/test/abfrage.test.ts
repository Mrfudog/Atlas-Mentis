/**
 * Die Abfrage-Kachel (T-340): `GET/POST /api/boards/:board/query/:rel…`.
 * Ziehen ohne Zurücklegen, Siebung für Spielende, Freigeben als Wissen
 * der Gruppe. Erfundene Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });
const geruecht = (id: string, name: string, extra: Record<string, unknown> = {}): Entity => ({
  id,
  name,
  interfaces: ['Quest'],
  components: { ...ident(name, `quest-${id}`), Tags: { tags: ['rumour'] }, ...extra },
  relations: [im(id)],
});

function bestand(): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'pt_a', name: 'Party', interfaces: ['Party'], components: ident('Party', 'party-0001'),
      relations: [{ id: 'pt_a_of', type: 'partyOf', to: 'camp_a', props: {} }, im('pt_a')] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: { ...ident('Rook', 'playercharacter-0001'), PlayerCharacter: { level: 1 } },
      relations: [im('pc_rook'), { id: 'pc_rook_m', type: 'memberOfParty', to: 'pt_a', props: {} }] },
    geruecht('q1', 'The miller lies'),
    geruecht('q2', 'A ghost at the well'),
    geruecht('q3', 'The baron is a wolf', { Visibility: { audience: 'gm' } }),
    geruecht('q4', 'Unwritten', { Status: { status: 'idea' } }),
    { id: 'it_1', name: 'Rope', interfaces: ['Item'], components: ident('Rope', 'item-0001'), relations: [im('it_1')] },
    {
      id: 'brd',
      name: 'Rumours',
      interfaces: ['Board'],
      components: { ...ident('Rumours', 'board-0001'), Board: {} },
      relations: [
        im('brd'),
        { id: 'tile', type: 'placed', to: 'brd', props: { x: 0, y: 0, w: 300, h: 300, title: 'Rumours', display: 'draw', query: { types: ['Quest'], tags: ['rumour'] } } },
        { id: 'geheim', type: 'placed', to: 'brd', props: { x: 400, y: 0, hidden: true, query: { articles: ['it_1'] } } },
      ],
    },
  ];
}

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, bestand());
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>, actorIds: string[] = []) =>
    repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles });
  await konto('Gwen', { camp_a: 'gm' });
  await konto('Sela', { camp_a: 'player' }, ['pc_rook']);
  const cookies = new Map<string, string>();
  const cookie = async (name: string) => {
    if (!cookies.has(name)) {
      const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      cookies.set(name, `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return cookies.get(name)!;
  };
  const get = async (name: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie: await cookie(name) } });
  const post = async (name: string, url: string) => app.inject({ method: 'POST', url, payload: {}, headers: { cookie: await cookie(name) } });
  const put = async (name: string, e: Entity) =>
    app.inject({ method: 'PUT', url: `/api/entities/${e.id}`, payload: e as object, headers: { cookie: await cookie(name) } });
  const kachel = async () => (await repo.getEntity('brd'))!.relations!.find((r) => r.id === 'tile')!;
  return { repo, get, post, put, kachel };
}

const ids = (r: { json: () => { items: { id: string }[] } }) => r.json().items.map((e) => e.id).sort();

describe('Abfrage-Kachel (T-340)', () => {
  it('bringt der Leitung alles, Spielenden nur Sichtbares und keine zurückgehaltene Kachel', async () => {
    const { get } = await aufbau();
    expect(ids(await get('Gwen', '/api/boards/brd/query/tile'))).toEqual(['q1', 'q2', 'q3', 'q4']);
    const s = await get('Sela', '/api/boards/brd/query/tile');
    expect(ids(s)).toEqual(['q1', 'q2']);
    expect(s.json().mayDraw).toBe(false);
    expect((await get('Sela', '/api/boards/brd/query/geheim')).statusCode).toBe(404);
    expect((await get('Gwen', '/api/boards/brd/query/geheim')).json().items.map((e: Entity) => e.id)).toEqual(['it_1']);
  });

  it('zieht ohne Zurücklegen bis leer, setzt zurück, und nur wer das Board schreibt', async () => {
    const { post, get, kachel } = await aufbau();
    expect((await post('Sela', '/api/boards/brd/query/tile/draw')).statusCode).toBe(403);
    const gezogen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await post('Gwen', '/api/boards/brd/query/tile/draw');
      expect(r.statusCode).toBe(200);
      gezogen.push(r.json().drawn);
      expect(r.json().remaining).toBe(3 - i);
    }
    expect([...new Set(gezogen)].sort()).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect((await post('Gwen', '/api/boards/brd/query/tile/draw')).json()).toEqual({ drawn: null, remaining: 0 });
    expect((await kachel()).props?.['drawn']).toEqual(gezogen);
    /* Spielende sehen vom Gezogenen nur, was sie sehen dürfen — auch am Board selbst. */
    expect((await get('Sela', '/api/boards/brd/query/tile')).json().drawn.sort()).toEqual(['q1', 'q2']);
    const brett = (await get('Sela', '/api/entities/brd')).json() as Entity;
    expect(([...((brett.relations ?? []).find((r) => r.id === 'tile')?.props?.['drawn'] as string[])]).sort()).toEqual(['q1', 'q2']);
    expect((await post('Gwen', '/api/boards/brd/query/tile/reset')).statusCode).toBe(200);
    expect((await kachel()).props?.['drawn']).toBeUndefined();
  });

  it('behält beim PUT des Boards den Stand des Ziehens', async () => {
    const { post, put, repo, kachel } = await aufbau();
    const vorher = (await repo.getEntity('brd'))!;
    const d = (await post('Gwen', '/api/boards/brd/query/tile/draw')).json().drawn;
    const neu = (await repo.getEntity('brd'))!;
    /* Die Seite schickt ihren Stand ohne `drawn` und mit verschobener Kachel. */
    const r = await put('Gwen', {
      ...neu,
      relations: neu.relations!.map((x) => (x.id === 'tile' ? { ...x, props: { ...vorher.relations!.find((y) => y.id === 'tile')!.props, x: 80 } } : x)),
    });
    expect(r.statusCode).toBe(200);
    expect((await kachel()).props?.['drawn']).toEqual([d]);
    expect((await kachel()).props?.['x']).toBe(80);
  });

  it('gibt beim Ziehen frei: das Gezogene sieht und weiss die Gruppe', async () => {
    const { repo, post, get } = await aufbau();
    const b = (await repo.getEntity('brd'))!;
    await repo.putEntity({
      ...b,
      relations: b.relations!.map((r) => (r.id === 'tile' ? { ...r, props: { ...r.props, reveal: true, query: { articles: ['q3', 'inf'] } } } : r)),
    });
    await repo.putEntity({ id: 'inf', name: 'Wolf at night', interfaces: ['Information'], components: { ...ident('Wolf at night', 'information-0001'), Information: { fields: [] }, Visibility: { audience: 'gm' } }, relations: [im('inf')] });
    const q3 = (await repo.getEntity('q3'))!;
    await repo.putEntity({ ...q3, relations: [...q3.relations!, { id: 'q3_k', type: 'knowledge', to: 'inf', props: {} }] });
    expect(ids(await get('Sela', '/api/boards/brd/query/tile'))).toEqual([]);
    const a = await post('Gwen', '/api/boards/brd/query/tile/draw');
    const c = await post('Gwen', '/api/boards/brd/query/tile/draw');
    expect([a.json().drawn, c.json().drawn].sort()).toEqual(['inf', 'q3']);
    const q3r = a.json().drawn === 'q3' ? a.json() : c.json();
    expect(q3r.revealed).toMatchObject({ party: 'pt_a', visible: true, skipped: [] });
    expect((await repo.getEntity('q3'))!.components['Visibility']).toMatchObject({ audience: 'gm', revealedTo: ['pt_a'] });
    expect((await repo.getEntity('inf'))!.relations!.some((r) => r.type === 'knownBy' && r.to === 'pt_a')).toBe(true);
    expect(ids(await get('Sela', '/api/boards/brd/query/tile'))).toContain('q3');
  });
});
