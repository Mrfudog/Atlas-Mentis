/**
 * Spalten wählbar (T-343): `/api/list?cols=` liefert genau die gewählten
 * Spalten — Felder, gerechnete Werte, Kanten und die Angaben jeder Zeile —,
 * gesiebt wie jede Liste; die Leitung setzt eine Wahl als Vorgabe der
 * Kampagne.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { parseListQuery } from '../src/liste.js';

const PW = 'nebel-wacht-am-tor';
const art = (id: string, typ: string, name: string, nr: string, extra: Partial<Entity> = {}): Entity => ({
  id,
  interfaces: [typ],
  name,
  components: { Identity: { name, id: nr, aliases: [] as string[] }, ...(extra.components ?? {}) },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: 'ly-k', props: {} }, ...(extra.relations ?? [])],
});

let app: ReturnType<typeof buildApp>;
let repo: InMemoryRepository;
const cookies: Record<string, string> = {};
const get = (wer: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie: cookies[wer] ?? '' } });
const put = (wer: string, url: string, payload: unknown) =>
  app.inject({ method: 'PUT', url, payload: payload as object, headers: { cookie: cookies[wer] ?? '' } });

beforeEach(async () => {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), [CAMPAIGN_SETTING]: 'k' } };
  repo = new InMemoryRepository(registry, [
    { ...art('ly-k', 'Layer', 'Run layer', 'layer-0001'), relations: [] },
    { ...art('k', 'Campaign', 'Run', 'campaign-0001'), relations: [{ id: 'k~1', type: 'activates', to: 'ly-k', props: {} }] },
    art('seil', 'Item', 'Rope', 'item-0001', {
      components: { Item: { weight: 10, rows: '##\n##', rarity: 'rare' }, Tags: { tags: ['gear'] } },
    }),
    art('fackel', 'Item', 'Torch', 'item-0002', { components: { Item: { weight: 1, rows: '#' } } }),
    art('info', 'Information', 'Weights', 'information-0001', {
      components: { Information: { fields: ['Item.weight', 'Item.rows'], applies: { types: ['Item'], where: [{ field: 'Item.rarity', has: ['rare'] }] } } },
    }),
  ]);
  app = buildApp({ repo });
  await repo.putUser({ id: 'u_l', name: 'leitung', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'gm' } });
  await repo.putUser({ id: 'u_s', name: 'sela', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'player' } });
  for (const n of ['leitung', 'sela']) {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name: n, password: PW } });
    cookies[n] = `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}`;
  }
});

describe('choosable columns (T-343)', () => {
  it('reads the chosen columns from the address and keeps their order', () => {
    expect(parseListQuery({ cols: 'Item.weight,@source,bogus,Item.weight' }).columns).toEqual(['Item.weight', '@source']);
    expect(parseListQuery({ cols: '' }).columns).toEqual([]);
    expect(parseListQuery({}).columns).toBeUndefined();
  });

  it('answers with the chosen fields, derived values and row facts — and sorts by them', async () => {
    /* Als Spielerin: das Gewicht des Seils hält eine Information zurück, die
       sie nicht kennt — so gibt es eine leere Zelle (T-447: die Leitung
       sieht es, unten). */
    const r = (await get('sela', '/api/list?type=Item&cols=Item.width,Item.weight,@tags,@id&sort=-Item.weight')).json();
    expect(r.columns.map((c: { ref: string }) => c.ref)).toEqual(['Item.width', 'Item.weight', '@tags', '@id']);
    expect(r.columns[0]).toMatchObject({ kind: 'number', label: 'Width' });
    /* Leere Zellen stehen hinten, auch absteigend. */
    expect(r.rows.map((z: { name: string }) => z.name)).toEqual(['Torch', 'Rope']);
    const breit = (await get('sela', '/api/list?type=Item&cols=Item.width&sort=Item.width')).json();
    expect(breit.rows.map((z: { name: string }) => z.name)).toEqual(['Torch', 'Rope']);
    expect(r.rows[1].cols).toEqual({ '@tags': ['gear'], '@id': 'item-0001' });
    expect(r.rows[0].cols).toEqual({ 'Item.width': 1, 'Item.weight': 1, '@id': 'item-0002' });
    /* Die Leitung der Kampagne liest den Artikel ungekürzt (T-447, E-204). */
    const gm = (await get('leitung', '/api/list?type=Item&cols=Item.weight&sort=-Item.weight')).json();
    expect(gm.rows.map((z: { name: string; cols: Record<string, unknown> }) => [z.name, z.cols['Item.weight']])).toEqual([['Rope', 10], ['Torch', 1]]);
  });

  it('leaves the overview columns as they were without a choice', async () => {
    const ohne = (await get('leitung', '/api/list?type=Item')).json();
    expect(ohne.columns.some((c: { ref: string }) => c.ref.startsWith('@'))).toBe(false);
  });

  it('never shows a held-back field to a player', async () => {
    const r = (await get('sela', '/api/list?type=Item&cols=Item.weight,Item.rarity,Item.width')).json();
    const seil = r.rows.find((z: { id: string }) => z.id === 'seil');
    expect(seil.cols).toEqual({ 'Item.rarity': 'rare' });
    /* Auch nichts, was aus einem zurückgehaltenen Feld gerechnet wird. */
    expect(r.rows.find((z: { id: string }) => z.id === 'fackel').cols).toEqual({ 'Item.weight': 1, 'Item.width': 1 });
  });

  it('lets the lead set a campaign default, and only the lead', async () => {
    expect((await put('sela', '/api/list-columns', { key: 'world|Item', columns: ['Item.weight'] })).statusCode).toBe(403);
    expect((await put('leitung', '/api/list-columns', { key: 'world|Item', columns: ['Item.weight', 'x y'] })).statusCode).toBe(200);
    expect((await get('sela', '/api/list-columns')).json()).toMatchObject({
      campaign: 'k',
      canManage: false,
      defaults: { 'world|Item': ['Item.weight'] },
    });
    expect((await put('leitung', '/api/list-columns', { key: 'World|Item', columns: [] })).statusCode).toBe(400);
    await put('leitung', '/api/list-columns', { key: 'world|Item', columns: null });
    expect((await get('leitung', '/api/list-columns')).json()).toMatchObject({ canManage: true, defaults: {} });
  });
});
