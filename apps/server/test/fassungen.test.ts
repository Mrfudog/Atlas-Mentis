/**
 * Fassungen an den Feldern, Vergleichsebenen, Übernehmen als Überschreibung
 * und das Kompendium mit gruppierten Fassungen (T-092, E-021 d).
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
type Rolle = 'gm' | 'co-gm' | 'player' | 'spectator';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const ebene = (id: string, name: string, n: number, kind: string, order: number): Entity => ({
  id,
  name,
  interfaces: ['Layer'],
  components: { ...ident(name, `layer-00${n}`), Layer: { kind, order } },
  relations: [],
});
const zauber = (id: string, name: string, n: number, buch: string, ly: string, range: number, variantOf?: string): Entity => ({
  id,
  name,
  interfaces: ['Spell'],
  components: { ...ident(name, `spell-000${n}`), Source: { publication: buch }, Spell: { level: 3, range } },
  relations: [
    { id: `${id}_in`, type: 'inLayer', to: ly, props: {} },
    ...(variantOf ? [{ id: `${id}_v`, type: 'variantOf', to: variantOf, props: {} }] : []),
  ],
});

const BESTAND: Entity[] = [
  ebene('e5_book_phb', "Player's Handbook", 1, 'book', 0),
  ebene('e5_book_xphb', "Player's Handbook (2024)", 2, 'book', 0),
  ebene('e5_book_xge', "Xanathar's Guide", 3, 'book', 0),
  ebene('ly_camp', 'Nebelwacht', 4, 'campaign', 50),
  {
    id: 'camp',
    name: 'Aus Nebel wacht',
    interfaces: ['Campaign'],
    components: ident('Aus Nebel wacht', 'campaign-0001'),
    relations: [
      { id: 'ac1', type: 'activates', to: 'e5_book_phb', props: { order: 10 } },
      { id: 'ac2', type: 'activates', to: 'e5_book_xge', props: { order: 20 } },
      { id: 'ac3', type: 'activates', to: 'ly_camp', props: { order: 30 } },
    ],
  },
  zauber('f14', 'Fireball', 1, 'PHB', 'e5_book_phb', 150),
  zauber('fx', 'Fireball (XGE)', 2, 'XGE', 'e5_book_xge', 120, 'f14'),
  zauber('f24', 'Fireball', 3, 'XPHB', 'e5_book_xphb', 150, 'f14'),
  zauber('m14', 'Magic Missile', 4, 'PHB', 'e5_book_phb', 120),
];

async function aufbau() {
  const repo = new InMemoryRepository(seedRegistry, BESTAND);
  const app = buildApp({ repo });
  const konto = async (name: string, opts: { admin?: boolean; roles?: Record<string, Rolle> } = {}) =>
    repo.putUser({
      id: randomUUID(),
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: opts.admin ?? false,
      actorIds: [],
      roles: opts.roles ?? {},
    });
  await konto('Admin', { admin: true });
  await konto('Basil', { roles: { camp: 'gm' } });
  await konto('Mira', { roles: { camp: 'co-gm' } });
  await konto('Sela', { roles: { camp: 'player' } });
  const kekse = new Map<string, string>();
  const keks = async (name: string) => {
    if (kekse.has(name)) return kekse.get(name)!;
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
    kekse.set(name, c);
    return c;
  };
  const rufe = async (name: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      headers: { cookie: await keks(name) },
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
  return { repo, rufe };
}

type Fassungen = {
  layers: { id: string; short: string; compare: boolean; play: boolean }[];
  versions: { entity: Entity; layers: string[]; play: boolean; compare: boolean; adoptable: boolean; adoptedAs?: string }[];
};
const ids = (f: Fassungen) => f.versions.map((v) => v.entity.id).sort();

describe('compare layers of a campaign (T-092)', () => {
  it('are set by the GM, seen by the co-GM, and do not bring anything into play', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Mira', 'PUT', '/api/campaigns/camp/compare', { layers: ['e5_book_xphb'] })).statusCode).toBe(403);
    const res = await rufe('Basil', 'PUT', '/api/campaigns/camp/compare', { layers: ['e5_book_xphb'] });
    expect(res.json()).toEqual({ ok: true, layers: ['e5_book_xphb'] });
    const ebenen = (await rufe('Mira', 'GET', '/api/campaigns/camp/layers')).json();
    expect(ebenen.compareFor).toBe('gm');
    expect(ebenen.layers.find((l: { id: string }) => l.id === 'e5_book_xphb')).toMatchObject({ active: false, compare: true });
    /* Die Liste bleibt, wie sie war: Fireball einmal aus dem PHB, einmal aus XGE. */
    const liste = (await rufe('Basil', 'GET', '/api/list?type=Spell')).json();
    expect(liste.rows.map((r: { id: string }) => r.id).sort()).toEqual(['f14', 'fx', 'm14']);
    /* Den Stapel neu schreiben lässt den Vergleich stehen. */
    await rufe('Basil', 'PUT', '/api/campaigns/camp/layers', { layers: ['e5_book_phb', 'e5_book_xge', 'ly_camp'] });
    expect((await rufe('Basil', 'GET', '/api/campaigns/camp/layers')).json().layers.find((l: { id: string }) => l.id === 'e5_book_xphb').compare).toBe(true);
  });
});

describe('the versions of an article (T-092)', () => {
  it('come from play and — for the GM — from compare layers', async () => {
    const { rufe } = await aufbau();
    expect(ids((await rufe('Basil', 'GET', '/api/entities/f14/versions')).json())).toEqual(['fx']);
    await rufe('Basil', 'PUT', '/api/campaigns/camp/compare', { layers: ['e5_book_xphb'] });
    const gm = (await rufe('Basil', 'GET', '/api/entities/f14/versions')).json() as Fassungen;
    expect(ids(gm)).toEqual(['f24', 'fx']);
    const v24 = gm.versions.find((v) => v.entity.id === 'f24')!;
    expect(v24).toMatchObject({ compare: true, play: false, adoptable: true, layers: ['e5_book_xphb'] });
    expect(gm.versions.find((v) => v.entity.id === 'fx')).toMatchObject({ compare: false, play: true, adoptable: false });
    expect(gm.layers.find((l) => l.id === 'e5_book_xphb')).toMatchObject({ short: 'XPHB', compare: true, play: false });
    /* Die Fassung lässt sich öffnen, mit dem Hinweis. */
    const offen = (await rufe('Basil', 'GET', '/api/entities/f24')).json();
    expect(offen.refs.compare).toBe(true);
    expect((await rufe('Basil', 'GET', '/api/entities/f24/backlinks')).statusCode).toBe(200);
  });

  it('keeps compare layers from players unless the campaign allows it', async () => {
    const { rufe } = await aufbau();
    await rufe('Basil', 'PUT', '/api/campaigns/camp/compare', { layers: ['e5_book_xphb'] });
    expect(ids((await rufe('Sela', 'GET', '/api/entities/f14/versions')).json())).toEqual(['fx']);
    expect((await rufe('Sela', 'GET', '/api/entities/f24')).statusCode).toBe(404);
    await rufe('Basil', 'PUT', '/api/campaigns/camp/compare', { players: true });
    expect((await rufe('Basil', 'GET', '/api/campaigns/camp/layers')).json().compareFor).toBe('players');
    const sela = (await rufe('Sela', 'GET', '/api/entities/f14/versions')).json() as Fassungen;
    expect(ids(sela)).toEqual(['f24', 'fx']);
    expect(sela.versions.every((v) => !v.adoptable)).toBe(true);
    expect((await rufe('Sela', 'GET', '/api/entities/f24')).statusCode).toBe(200);
  });
});

describe('taking a version over as an override (T-092)', () => {
  it('copies it into the campaign layer, overriding what was in play, and undoes it', async () => {
    const { rufe, repo } = await aufbau();
    await rufe('Basil', 'PUT', '/api/campaigns/camp/compare', { layers: ['e5_book_xphb'] });
    expect((await rufe('Sela', 'POST', '/api/campaigns/camp/adopt', { version: 'f24', over: 'f14' })).statusCode).toBe(403);
    expect((await rufe('Basil', 'POST', '/api/campaigns/camp/adopt', { version: 'fx', over: 'f14' })).statusCode).toBe(409);
    const res = await rufe('Basil', 'POST', '/api/campaigns/camp/adopt', { version: 'f24', over: 'f14' });
    expect(res.statusCode).toBe(201);
    const kopie = res.json() as Entity;
    expect(kopie.name).toBe('Fireball');
    expect(kopie.relations?.map((r) => [r.type, r.to])).toEqual([
      ['inLayer', 'ly_camp'],
      ['overrides', 'f14'],
      ['variantOf', 'f24'],
    ]);
    /* Was in der Liste steht: die Kopie statt der 2014-Fassung. */
    const liste = (await rufe('Basil', 'GET', '/api/list?type=Spell')).json();
    expect(liste.rows.map((r: { id: string }) => r.id).sort()).toEqual([kopie.id, 'fx', 'm14'].sort());
    /* An der Kopie: die 2024-Fassung ist übernommen. */
    const f = (await rufe('Basil', 'GET', `/api/entities/${kopie.id}/versions`)).json() as Fassungen;
    expect(f.versions.find((v) => v.entity.id === 'f24')).toMatchObject({ adoptedAs: kopie.id, adoptable: false });
    expect(ids(f)).toEqual(['f14', 'f24', 'fx']);
    /* Rückgängig. */
    expect((await rufe('Basil', 'DELETE', '/api/campaigns/camp/adopt/f14')).statusCode).toBe(404);
    const weg = await rufe('Basil', 'DELETE', `/api/campaigns/camp/adopt/${kopie.id}`);
    expect(weg.json()).toEqual({ ok: true, over: 'f14' });
    expect(await repo.getEntity(kopie.id)).toBeUndefined();
  });
});

describe('the compendium groups versions (T-092)', () => {
  it('shows one row per thing, headed by the version from the top play layer', async () => {
    const { rufe } = await aufbau();
    const l = (await rufe('Basil', 'GET', '/api/list?type=Spell&versions=1')).json();
    expect(l.total).toBe(2);
    const fb = l.rows.find((r: { name: string }) => r.name.startsWith('Fireball'));
    /* XGE liegt höher im Stapel als das PHB. */
    expect(fb.id).toBe('fx');
    expect(fb.versions).toEqual([{ id: 'f14', name: 'Fireball', layers: ["Player's Handbook"], source: 'PHB' }]);
    /* Ohne `versions` wie bisher. */
    expect((await rufe('Basil', 'GET', '/api/list?type=Spell')).json().total).toBe(3);
  });
});

describe('preferences per account (T-092)', () => {
  it('are kept per account and written by everyone for themselves', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Sela', 'GET', '/api/me/prefs')).json()).toEqual({});
    expect((await rufe('Sela', 'PUT', '/api/me/prefs/versions', { value: { on: true, off: ['e5_book_xge'] } })).statusCode).toBe(200);
    expect((await rufe('Sela', 'GET', '/api/me/prefs')).json()).toEqual({ versions: { on: true, off: ['e5_book_xge'] } });
    expect((await rufe('Basil', 'GET', '/api/me/prefs')).json()).toEqual({});
    expect((await rufe('Sela', 'PUT', '/api/me/prefs/Bad Key', { value: 1 })).statusCode).toBe(400);
    await rufe('Sela', 'PUT', '/api/me/prefs/versions', { value: null });
    expect((await rufe('Sela', 'GET', '/api/me/prefs')).json()).toEqual({});
  });
});
