import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Die Waren eines Ladens (T-129): der Server rechnet `shopWares` am Tisch
   und für jede eigene Figur und schickt es als `refs.shop` mit — gesiebt:
   eine verborgene Ware fehlt, ein verborgener Geber bleibt ohne Namen.
   Erfundene Artikel. */

const PW = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] as string[] } });
const art = (id: string, typ: string, name: string, nr: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: { ...ident(name, nr), ...(extra.components ?? {}) }, relations: extra.relations ?? [],
});

const bestand = (): Entity[] => [
  art('k', 'Campaign', 'Run', 'campaign-0001'),
  art('laterne', 'Item', 'Lantern', 'item-0001', { components: { Item: { copperPrice: 1000 } } }),
  art('geheim', 'Item', 'Smuggled lens', 'item-0002', { components: { Item: { copperPrice: 5000 }, Visibility: { audience: 'gm' } } }),
  art('gilde', 'Faction', 'Lamplighters', 'faction-0001', {
    components: { Faction: { ranks: ['Wick', 'Flame'] }, Visibility: { audience: 'gm' } },
    relations: [
      { id: 'g~1', type: 'controls', to: 'laden' },
      { id: 'g~2', type: 'discount', to: 'gilde', props: { mod: '-10%', rank: 'Flame' } },
    ],
  }),
  art('laden', 'Shop', 'The Wick & Wire', 'shop-0001', {
    components: { Shop: { priceMod: '-1 gp' } },
    relations: [
      { id: 'l~1', type: 'sells', to: 'laterne', props: { qty: 3 } },
      { id: 'l~2', type: 'sells', to: 'geheim', props: { qty: 1 } },
    ],
  }),
  art('f', 'PlayerCharacter', 'Ash', 'pc-0001', {
    relations: [
      { id: 'f~1', type: 'memberOf', to: 'gilde', props: { rank: 'Flame' } },
      { id: 'f~2', type: 'carries', to: 'inv-f' },
    ],
  }),
  art('inv-f', 'Inventory', 'Ash’s pack', 'inventory-0001', {
    components: { Inventory: { copper: 2000 } },
    relations: [
      { id: 'h1', type: 'holds', to: 'laterne', props: { qty: 1, tier: 'pack' } },
      { id: 'h2', type: 'holds', to: 'laterne', props: { qty: 1, tier: 'pack', reservedFor: 'auftrag' } },
    ],
  }),
  art('fremd', 'PlayerCharacter', 'Bryn', 'pc-0002'),
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
  await repo.putUser({ id: 'u_l', name: 'leitung', passwordHash: await hashPassword(PW), isAdmin: true, actorIds: ['f'], roles: {} });
  await repo.putUser({ id: 'u_s', name: 'spiel', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: ['f'], roles: { k: 'player' } });
});

describe('refs.shop (T-129)', () => {
  it('nennt Waren und Preise am Tisch und je eigener Figur, mit Herkunft', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/entities/laden', headers: { cookie: await anmelden('leitung') } });
    expect(r.statusCode).toBe(200);
    const shop = r.json().refs.shop;
    expect(shop.table.map((w: { name: string; price: number }) => [w.name, w.price])).toEqual([['Lantern', 900], ['Smuggled lens', 4900]]);
    const [ash] = shop.mine;
    expect(ash).toMatchObject({ id: 'f', name: 'Ash' });
    // 10 gp − 1 gp − 10 % (Gilde, ab Flame) = 8 gp
    expect(ash.wares[0]).toMatchObject({ qty: 3, price: 800 });
    expect(ash.wares[0].steps[1]).toMatchObject({ by: 'discount', giverName: 'Lamplighters', rank: 'Flame', delta: -100 });
  });

  it('zeigt Spielenden keine verborgene Ware und keinen verborgenen Geber — der Rabatt gilt trotzdem', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/entities/laden', headers: { cookie: await anmelden('spiel') } });
    const shop = r.json().refs.shop;
    expect(shop.table.map((w: { name: string }) => w.name)).toEqual(['Lantern']);
    const step = shop.mine[0].wares[0].steps[1];
    expect(step).toMatchObject({ by: 'discount', delta: -100 });
    expect(step.giverName).toBeUndefined();
  });

  it('fehlt an allem, was kein Laden ist', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/entities/laterne', headers: { cookie: await anmelden('leitung') } });
    expect(r.json().refs.shop).toBeUndefined();
  });
});

describe('Kaufen und Verkaufen (T-133)', () => {
  const kaufen = async (wer: string, body: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/shops/laden/buy', headers: { cookie: await anmelden(wer) }, payload: body });
  const verkaufen = async (wer: string, body: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/shops/laden/sell', headers: { cookie: await anmelden(wer) }, payload: body });

  it('nennt an der eigenen Figur Geld und was sie verkaufen kann — ohne Reserviertes', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/entities/laden', headers: { cookie: await anmelden('spiel') } });
    const [ash] = r.json().refs.shop.mine;
    expect(ash).toMatchObject({ inventory: 'inv-f', purse: 2000 });
    expect(ash.sellable).toEqual([{ inventory: 'inv-f', edge: 'h1', item: 'laterne', name: 'Lantern', qty: 1, price: 500 }]);
  });

  it('kauft zum Preis des Servers: Menge sinkt, Stück ins Inventar, Münzen ab, Protokoll', async () => {
    const r = await kaufen('spiel', { actor: 'f', edge: 'l~1', qty: 2, price: 1 });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ qty: 2, unit: 800, total: 1600, copper: 400 });
    const laden = await repo.getEntity('laden');
    expect(laden?.relations?.find((x) => x.id === 'l~1')?.props?.['qty']).toBe(1);
    const inv = await repo.getEntity('inv-f');
    expect(inv?.components['Inventory']?.['copper']).toBe(400);
    expect(inv?.relations?.find((x) => x.id === 'h1')?.props?.['qty']).toBe(3);
    const [ev] = await repo.listEvents({ name: 'shop.bought', limit: 5 });
    expect(ev?.payload).toMatchObject({ actor: 'f', item: 'laterne', qty: 2, unit: 800, total: 1600, by: 'u_s' });
    expect((ev?.payload as { steps: unknown[] }).steps).toHaveLength(2);
  });

  it('lehnt ab: zu wenig Geld, mehr als da, ausverkauft, fremde Figur, verborgene Ware', async () => {
    expect((await kaufen('spiel', { actor: 'f', edge: 'l~1', qty: 3 })).json().refused).toBe('tooPoor');
    expect((await kaufen('spiel', { actor: 'f', edge: 'l~1', qty: 4 })).json().refused).toBe('tooFew');
    expect((await kaufen('spiel', { actor: 'fremd', edge: 'l~1' })).statusCode).toBe(403);
    expect((await kaufen('spiel', { actor: 'f', edge: 'l~2' })).json().refused).toBe('missing');
    const leer = await repo.getEntity('laden');
    await repo.putEntity({ ...leer!, relations: leer!.relations!.map((x) => (x.id === 'l~1' ? { ...x, props: { qty: 0 } } : x)) });
    expect((await kaufen('spiel', { actor: 'f', edge: 'l~1' })).json().refused).toBe('soldOut');
    expect((await repo.getEntity('inv-f'))?.components['Inventory']?.['copper']).toBe(2000);
  });

  it('verkauft zur Hälfte des Listenpreises, füllt die gezählte Ware auf, Reserviertes nicht', async () => {
    const r = await verkaufen('spiel', { actor: 'f', inventory: 'inv-f', edge: 'h1' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ qty: 1, unit: 500, total: 500, copper: 2500 });
    expect((await repo.getEntity('laden'))?.relations?.find((x) => x.id === 'l~1')?.props?.['qty']).toBe(4);
    expect((await repo.getEntity('inv-f'))?.relations?.some((x) => x.id === 'h1')).toBe(false);
    expect((await verkaufen('spiel', { actor: 'f', inventory: 'inv-f', edge: 'h2' })).json().refused).toBe('reserved');
    const [ev] = await repo.listEvents({ name: 'shop.sold', limit: 5 });
    expect(ev?.payload).toMatchObject({ actor: 'f', item: 'laterne', total: 500, rule: 'half' });
  });

  it('verkauft nicht aus fremdem Inventar', async () => {
    const r = await verkaufen('spiel', { actor: 'f', inventory: 'inv-x', edge: 'h1' });
    expect(r.statusCode).toBe(403);
  });
});
