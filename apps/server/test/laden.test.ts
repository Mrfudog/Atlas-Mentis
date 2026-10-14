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
  art('f', 'PlayerCharacter', 'Ash', 'pc-0001', { relations: [{ id: 'f~1', type: 'memberOf', to: 'gilde', props: { rank: 'Flame' } }] }),
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

describe('refs.shop liest die geltende Fassung (T-139)', () => {
  it('nimmt den Preis aus einer aufgeschalteten Überschreibung, mit Herkunft — abgeschaltet gilt das Original', async () => {
    const ring = art('ring', 'Item', 'Ring of Warmth', 'item-0003', { components: { Item: { rarity: 'uncommon' } } });
    const schaetzung = art('ring-ai', 'Item', 'Ring of Warmth', 'item-0004', {
      components: { Item: { rarity: 'uncommon', copperPrice: 40000, priceNote: 'estimated: uncommon' } },
      relations: [
        { id: 'ra~1', type: 'inLayer', to: 'ki' },
        { id: 'ra~2', type: 'overrides', to: 'ring' },
      ],
    });
    const gruppe = art('ki-gruppe', 'Layer', 'AI content', 'layer-0001', { components: { Layer: { kind: 'group', groupBy: 'publisher' } } });
    const ebene = art('ki', 'Layer', 'AI generated prices', 'layer-0002', {
      components: { Layer: { kind: 'pack', order: 50 } },
      relations: [{ id: 'ki~1', type: 'partOf', to: 'ki-gruppe' }],
    });
    const laden = (await repo.getEntity('laden'))!;
    await repo.putEntity({ ...laden, relations: [...(laden.relations ?? []), { id: 'l~3', type: 'sells', to: 'ring' }] });
    for (const e of [ring, schaetzung, gruppe, ebene]) await repo.putEntity(e);
    const k = (await repo.getEntity('k'))!;
    const an = { ...k, relations: [{ id: 'k~1', type: 'activates', to: 'ki-gruppe' }] };
    await repo.putEntity(an);
    const cookie = await anmelden('leitung');

    let w = (await app.inject({ method: 'GET', url: '/api/entities/laden', headers: { cookie } })).json().refs.shop.table;
    expect(w.find((x: { name: string }) => x.name === 'Ring of Warmth')).toMatchObject({
      item: 'ring-ai', list: 40000, listNote: 'estimated: uncommon', price: 39900,
    });

    await repo.putEntity({ ...k, relations: [{ id: 'k~1', type: 'activates', to: 'ki-gruppe', props: { mode: 'off' } }, { id: 'k~2', type: 'activates', to: 'ki', props: { mode: 'off' } }] });
    w = (await app.inject({ method: 'GET', url: '/api/entities/laden', headers: { cookie } })).json().refs.shop.table;
    const ohne = w.find((x: { name: string }) => x.name === 'Ring of Warmth');
    expect(ohne).toMatchObject({ item: 'ring' });
    expect(ohne.list).toBeUndefined();
    expect(ohne.price).toBeUndefined();
  });
});
