import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Ein Laden verkauft und kauft nach Collections (T-425, REQ-439, E-175):
   `sells` auf eine Collection bietet ihre Mitglieder an, gesiebt je
   Betrachter; `buys` sagt, was er ankauft und zu welchem Satz, und was er
   nicht nennt, kauft er nicht. Erfundene Artikel. */

const PW = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] as string[] } });
const art = (id: string, typ: string, name: string, nr: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: { ...ident(name, nr), ...(extra.components ?? {}) }, relations: extra.relations ?? [],
});

const bestand = (): Entity[] => [
  art('k', 'Campaign', 'Run', 'campaign-0001'),
  art('waffen', 'Collection', 'Weapons', 'collection-0001', { components: { Collection: { types: ['Weapon'] } } }),
  art('dolch', 'Weapon', 'Dagger', 'weapon-0001', { components: { Item: { copperPrice: 200 } } }),
  art('schwert', 'Weapon', 'Longsword', 'weapon-0002', { components: { Item: { copperPrice: 1500 } } }),
  art('klinge', 'Weapon', 'Sunblade', 'weapon-0003', { components: { Item: { copperPrice: 50000 }, Visibility: { audience: 'gm' } } }),
  art('seil', 'Item', 'Rope', 'item-0001', { components: { Item: { copperPrice: 100 } } }),
  art('schmiede', 'Shop', 'The Anvil', 'shop-0001', {
    components: { Shop: { buyRate: 20 } },
    relations: [
      { id: 's~1', type: 'sells', to: 'waffen', props: { mod: '-10%' } },
      { id: 's~2', type: 'sells', to: 'dolch', props: { qty: 2, price: 150 } },
      { id: 'b~1', type: 'buys', to: 'waffen', props: { rate: 40 } },
    ],
  }),
  art('f', 'PlayerCharacter', 'Ash', 'pc-0001', { relations: [{ id: 'f~1', type: 'carries', to: 'inv-f' }] }),
  art('inv-f', 'Inventory', 'Ash’s pack', 'inventory-0001', {
    components: { Inventory: { copper: 5000 } },
    relations: [
      { id: 'h1', type: 'holds', to: 'schwert', props: { qty: 1, tier: 'pack' } },
      { id: 'h2', type: 'holds', to: 'seil', props: { qty: 1, tier: 'pack' } },
    ],
  }),
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

type Ware = { item: string; name: string; edge: string; via?: string; viaName?: string; price?: number; qty?: number };
const laden = async (wer: string) =>
  (await app.inject({ method: 'GET', url: '/api/entities/schmiede', headers: { cookie: await anmelden(wer) } })).json().refs.shop;

describe('sells auf eine Collection (REQ-439)', () => {
  it('bietet die Mitglieder an — die einzelne Kante schlägt die Collection —, gesiebt je Betrachter', async () => {
    const gm = await laden('leitung');
    expect(gm.table.map((w: Ware) => [w.name, w.edge, w.viaName, w.price])).toEqual([
      ['Longsword', 's~1', 'Weapons', 1350],
      ['Sunblade', 's~1', 'Weapons', 45000],
      ['Dagger', 's~2', undefined, 150],
    ]);
    const sp = await laden('spiel');
    expect(sp.table.map((w: Ware) => w.name)).toEqual(['Longsword', 'Dagger']);
    expect(sp.mine[0].wares.map((w: Ware) => w.name)).toEqual(['Longsword', 'Dagger']);
  });

  it('kauft eine Ware der Collection über Kante und Gegenstand; Verborgenes gibt es nicht', async () => {
    const cookie = await anmelden('spiel');
    const kauf = await app.inject({ method: 'POST', url: '/api/shops/schmiede/buy', headers: { cookie }, payload: { actor: 'f', edge: 's~1', item: 'schwert' } });
    expect(kauf.statusCode).toBe(200);
    const inv = (await repo.getEntity('inv-f'))!;
    expect(inv.components?.['Inventory']?.['copper']).toBe(5000 - 1350);
    /* Eine Collection-Kante zählt keine Menge: der Laden bleibt, wie er ist. */
    expect((await repo.getEntity('schmiede'))!.relations).toEqual(bestand().find((e) => e.id === 'schmiede')!.relations);
    const geheim = await app.inject({ method: 'POST', url: '/api/shops/schmiede/buy', headers: { cookie }, payload: { actor: 'f', edge: 's~1', item: 'klinge' } });
    expect(geheim.statusCode).toBe(409);
    expect(geheim.json().refused).toBe('missing');
  });
});

describe('buys: was der Laden ankauft (E-175 a)', () => {
  it('nennt den Ankaufspreis mit Satz und Herkunft, und was er nicht kauft', async () => {
    const sp = await laden('spiel');
    const zuVerkaufen = sp.mine[0].sellable as { item: string; price?: number; rate?: number; from?: string; viaName?: string; refused?: string }[];
    expect(zuVerkaufen.find((x) => x.item === 'schwert')).toMatchObject({ price: 600, rate: 40, from: 'collection', viaName: 'Weapons' });
    expect(zuVerkaufen.find((x) => x.item === 'seil')).toMatchObject({ refused: 'notBought' });
    expect(zuVerkaufen.find((x) => x.item === 'seil')?.price).toBeUndefined();
  });

  it('verkauft zum Satz der Collection und lehnt das Seil ab, mit einem Hinweis, was zu tun ist', async () => {
    const cookie = await anmelden('spiel');
    const ok = await app.inject({ method: 'POST', url: '/api/shops/schmiede/sell', headers: { cookie }, payload: { actor: 'f', inventory: 'inv-f', edge: 'h1' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ unit: 600, total: 600 });
    const nein = await app.inject({ method: 'POST', url: '/api/shops/schmiede/sell', headers: { cookie }, payload: { actor: 'f', inventory: 'inv-f', edge: 'h2' } });
    expect(nein.statusCode).toBe(409);
    expect(nein.json()).toMatchObject({ refused: 'notBought' });
    expect(nein.json().error).toMatch(/anderen Laden/);
    const [ev] = await repo.listEvents({ name: 'shop.sold', limit: 5 });
    expect(ev?.payload).toMatchObject({ item: 'schwert', unit: 600, rule: { rate: 40, from: 'collection', via: 'waffen' } });
  });

  it('ohne buys-Kante kauft der Laden alles zu seinem Satz — wie bisher die Hälfte, wenn er keinen nennt', async () => {
    const s = (await repo.getEntity('schmiede'))!;
    await repo.putEntity({ ...s, components: { ...s.components, Shop: {} }, relations: (s.relations ?? []).filter((r) => r.type !== 'buys') });
    const sp = await laden('spiel');
    const seil = (sp.mine[0].sellable as { item: string; price?: number; rate?: number; from?: string }[]).find((x) => x.item === 'seil');
    expect(seil).toMatchObject({ price: 50, rate: 50, from: 'shop' });
  });
});
