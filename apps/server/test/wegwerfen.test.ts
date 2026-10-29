import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Wegwerfen und Verkaufen direkt am Stück (T-407, REQ-404): die Spielerin
   an der eigenen Figur und an der Gruppe, die Leitung an jeder; die
   Instanz geht mit, Rückgängig legt sie zurück. Erfundene Artikel. */

const PW = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] as string[] } });
const art = (id: string, typ: string, name: string, nr: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: { ...ident(name, nr), ...(extra.components ?? {}) }, relations: extra.relations ?? [],
});

const bestand = (): Entity[] => [
  art('k', 'Campaign', 'Run', 'campaign-0001'),
  art('laterne', 'Item', 'Lantern', 'item-0001', { components: { Item: { copperPrice: 1000 } } }),
  art('st1', 'Item', 'Lantern', 'item-0002', { relations: [{ id: 'st1~i', type: 'instanceOf', to: 'laterne' }] }),
  art('st2', 'Item', 'Lantern', 'item-0003', { relations: [{ id: 'st2~i', type: 'instanceOf', to: 'laterne' }] }),
  art('gasse', 'Place', 'Wick Lane', 'place-0001'),
  art('laden', 'Shop', 'The Wick & Wire', 'shop-0001', { relations: [{ id: 'l~p', type: 'partOf', to: 'gasse' }] }),
  art('ferne', 'Shop', 'Far Bazaar', 'shop-0002', { components: { Shop: { buyRate: 20 } } }),
  art('szene', 'Scene', 'At the lamp shop', 'scene-0001', { relations: [{ id: 'sz~p', type: 'partOf', to: 'gasse' }] }),
  art('s1', 'Session', 'Session 1', 'session-0001', { components: { Session: { activeScene: 'szene' } } }),
  art('gruppe', 'Party', 'The Wicks', 'party-0001', {
    relations: [
      { id: 'g~k', type: 'partyOf', to: 'k' },
      { id: 'g~c', type: 'carries', to: 'inv-g' },
    ],
  }),
  art('inv-g', 'Inventory', 'Party chest', 'inventory-0002', {
    relations: [{ id: 'g1', type: 'holds', to: 'st2', props: { qty: 1 } }],
  }),
  art('f', 'PlayerCharacter', 'Ash', 'pc-0001', {
    relations: [
      { id: 'f~c', type: 'carries', to: 'inv-f' },
      { id: 'f~p', type: 'memberOfParty', to: 'gruppe' },
    ],
  }),
  art('inv-f', 'Inventory', 'Ash’s pack', 'inventory-0001', {
    components: { Inventory: { copper: 100 } },
    relations: [
      { id: 'h1', type: 'holds', to: 'st1', props: { qty: 3, tier: 'pack', gx: 0, gy: 0 } },
      { id: 'h2', type: 'holds', to: 'laterne', props: { qty: 1, reservedFor: 'auftrag' } },
    ],
  }),
  art('fremd', 'PlayerCharacter', 'Bryn', 'pc-0002', { relations: [{ id: 'b~c', type: 'carries', to: 'inv-b' }] }),
  art('inv-b', 'Inventory', 'Bryn’s pack', 'inventory-0003', { relations: [{ id: 'b1', type: 'holds', to: 'laterne', props: { qty: 1 } }] }),
];

let app: ReturnType<typeof buildApp>;
let repo: InMemoryRepository;

async function anmelden(name: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PW } });
  return `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}`;
}

beforeEach(async () => {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), [CAMPAIGN_SETTING]: 'k' } };
  repo = new InMemoryRepository(registry, bestand());
  app = buildApp({ repo });
  await repo.putUser({ id: 'u_l', name: 'leitung', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'gm' } });
  await repo.putUser({ id: 'u_s', name: 'spiel', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: ['f'], roles: { k: 'player' } });
});

const post = async (wer: string, url: string, payload: Record<string, unknown> = {}) =>
  app.inject({ method: 'POST', url, headers: { cookie: await anmelden(wer) }, payload });

describe('Wegwerfen (T-407)', () => {
  it('nimmt einen Teil vom Stapel, protokolliert, und Rückgängig zählt ihn zurück', async () => {
    const r = await post('spiel', '/api/inventories/inv-f/discard', { edge: 'h1', qty: 2 });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ qty: 2, item: { id: 'st1', name: 'Lantern' }, removed: false });
    expect((await repo.getEntity('inv-f'))?.relations?.find((x) => x.id === 'h1')?.props?.['qty']).toBe(1);
    const [ev] = await repo.listEvents({ name: 'inventory.discarded', limit: 5 });
    expect(ev?.payload).toMatchObject({ item: 'st1', qty: 2, by: 'u_s' });
    const u = await post('spiel', `/api/inventories/inv-f/discard/${r.json().undo}/undo`);
    expect(u.statusCode).toBe(200);
    expect((await repo.getEntity('inv-f'))?.relations?.find((x) => x.id === 'h1')?.props?.['qty']).toBe(3);
  });

  it('nimmt den ganzen Stapel mit seiner Instanz — Rückgängig legt beide zurück, einmal', async () => {
    const r = await post('spiel', '/api/inventories/inv-f/discard', { edge: 'h1', qty: 3 });
    expect(r.json()).toMatchObject({ qty: 3, removed: true });
    expect(await repo.getEntity('st1')).toBeFalsy();
    const u = await post('spiel', `/api/inventories/inv-f/discard/${r.json().undo}/undo`);
    expect(u.statusCode).toBe(200);
    expect((await repo.getEntity('st1'))?.relations?.find((x) => x.type === 'instanceOf')?.to).toBe('laterne');
    expect((await repo.getEntity('inv-f'))?.relations?.find((x) => x.id === 'h1')).toMatchObject({ to: 'st1', props: { qty: 3, gx: 0 } });
    expect((await post('spiel', `/api/inventories/inv-f/discard/${r.json().undo}/undo`)).statusCode).toBe(409);
  });

  it('macht nicht rückgängig, wenn sich das Inventar inzwischen geändert hat', async () => {
    const r = await post('spiel', '/api/inventories/inv-f/discard', { edge: 'h1', qty: 1 });
    await post('spiel', '/api/inventories/inv-f/discard', { edge: 'h1', qty: 1 });
    expect((await post('spiel', `/api/inventories/inv-f/discard/${r.json().undo}/undo`)).statusCode).toBe(409);
  });

  it('lehnt Reserviertes mit Grund ab, fremdes Inventar mit 403', async () => {
    const r = await post('spiel', '/api/inventories/inv-f/discard', { edge: 'h2' });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ refused: 'reserved' });
    expect(r.json().error).toMatch(/reserv/i);
    expect((await post('spiel', '/api/inventories/inv-b/discard', { edge: 'b1' })).statusCode).toBe(403);
  });

  it('die Leitung wirft auch aus fremden Inventaren weg; die Spielerin macht ihr Wegwerfen nicht rückgängig', async () => {
    const r = await post('leitung', '/api/inventories/inv-b/discard', { edge: 'b1' });
    expect(r.statusCode).toBe(200);
    /* Ein Grundartikel geht nie mit. */
    expect(await repo.getEntity('laterne')).toBeTruthy();
    expect((await post('spiel', `/api/inventories/inv-b/discard/${r.json().undo}/undo`)).statusCode).toBe(403);
  });
});

describe('Verkaufen am Stück (T-407)', () => {
  it('nennt die Läden mit Ankaufspreis, die am Ort der Szene zuerst', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/inventories/inv-f/sell-offers?edge=h1', headers: { cookie: await anmelden('spiel') } });
    expect(r.statusCode).toBe(200);
    expect(r.json().actor).toBe('f');
    expect(r.json().offers).toEqual([
      expect.objectContaining({ shop: 'laden', name: 'The Wick & Wire', here: true, unit: 500, rate: 50 }),
      expect.objectContaining({ shop: 'ferne', name: 'Far Bazaar', here: false, unit: 200, rate: 20 }),
    ]);
  });

  it('verkauft aus dem Inventar der Gruppe für die Gruppe — die Münzen kommen in die Truhe', async () => {
    const o = await app.inject({ method: 'GET', url: '/api/inventories/inv-g/sell-offers?edge=g1', headers: { cookie: await anmelden('spiel') } });
    expect(o.json().actor).toBe('gruppe');
    const r = await post('spiel', '/api/shops/laden/sell', { actor: 'gruppe', inventory: 'inv-g', edge: 'g1' });
    expect(r.statusCode).toBe(200);
    expect((await repo.getEntity('inv-g'))?.components['Inventory']?.['copper']).toBe(500);
  });

  it('nennt für fremdes Inventar nichts', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/inventories/inv-b/sell-offers?edge=b1', headers: { cookie: await anmelden('spiel') } });
    expect(r.statusCode).toBe(403);
    expect((await post('spiel', '/api/shops/laden/sell', { actor: 'gruppe', inventory: 'inv-b', edge: 'b1' })).statusCode).toBe(403);
  });
});
