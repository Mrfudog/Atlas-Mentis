/**
 * Enhancements an einem Stück (T-300, E-107): die Leitung hängt „+1 Weapon"
 * an das Dolch-Stück einer Figur; Name und Preis kommen gerechnet heraus,
 * gespeichert wird nur die Kante, und Spielende hängen nichts an, solange
 * die Kampagne es nicht erlaubt.
 */

import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity, Relation } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const imLayer = (id: string): Relation => ({ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} });
const art = (id: string, type: string, name: string, extra: Record<string, unknown> = {}, relations: Relation[] = []): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name, id: `${type.toLowerCase()}-${id}`, aliases: [] }, ...extra },
  relations: [imLayer(id), ...relations],
});

function bestand(itemPricing?: string, enhancementsBy?: string): Entity[] {
  return [
    { id: 'ly_nebel', interfaces: ['Layer'], name: 'Nebel', components: { Identity: { name: 'Nebel', id: 'layer-1', aliases: [] } }, relations: [] },
    {
      id: 'camp_nebel',
      interfaces: ['Campaign'],
      name: 'Nebelwacht',
      components: {
        Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] },
        ...(itemPricing || enhancementsBy ? { Campaign: { ...(itemPricing ? { itemPricing } : {}), ...(enhancementsBy ? { enhancementsBy } : {}) } } : {}),
      },
      relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
    },
    art('dagger', 'Weapon', 'Dagger', { Item: { itemType: 'melee weapon', copperPrice: 200 }, Weapon: { category: 'simple', damage: '1d4' } }),
    /* Seit T-324 (E-163) Regelartikel der Art Enhancement. */
    art('plus1', 'Enhancement', '+1 Weapon', { ItemFeature: { appliesTo: ['weapon'], namePrefix: '+1 ', priceAdd: 100000 }, Enhancement: { rarity: 'uncommon', bonusWeapon: 1 } }),
    art('silvered', 'Enhancement', 'Silvered Weapon', { ItemFeature: { appliesTo: ['weapon'], namePrefix: 'Silvered ', priceAdd: 10000 } }),
    art('adamant', 'Enhancement', 'Adamantine Armor', { ItemFeature: { appliesTo: ['armor'], nameSuffix: ' (adamantine)' } }),
    art('pc_1', 'PlayerCharacter', 'Rook', {}, [{ id: 'pc_1~c', type: 'carries', to: 'inv_1', props: {} }]),
    art('inv_1', 'Inventory', 'Rooks Gepäck', {}, [{ id: 'inv_1~h', type: 'holds', to: 'st_1', props: { qty: 1 } }]),
    {
      ...art('st_1', 'Weapon', 'Dagger', { Status: { status: 'ready' } }),
      relations: [imLayer('st_1'), { id: 'st_1~i', type: 'instanceOf', to: 'dagger', props: {} }],
    },
  ];
}

async function aufbau(itemPricing?: string, enhancementsBy?: string) {
  const repo = new InMemoryRepository({ ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } }, bestand(itemPricing, enhancementsBy));
  const app = buildApp({ repo });
  for (const [name, role, actors] of [
    ['Mira', 'gm', []],
    ['Sela', 'player', ['pc_1']],
  ] as const) {
    await repo.putUser({ id: `u_${name.toLowerCase()}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [...actors], roles: { camp_nebel: role } });
  }
  const kekse = new Map<string, string>();
  const keks = async (name: string) => {
    let k = kekse.get(name);
    if (!k) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      k = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')!.value}`;
      kekse.set(name, k);
    }
    return k;
  };
  const rufe = async (name: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie: await keks(name) }, ...(payload ? { payload: payload as Record<string, unknown> } : {}) });
  return { repo, rufe };
}

describe('Enhancements an einem Stück (T-300)', () => {
  it('die Leitung hängt +1 und versilbert an; Name und Preis kommen gerechnet, gespeichert ist nur die Kante', async () => {
    const { repo, rufe } = await aufbau();
    const r1 = await rufe('Mira', 'POST', '/api/entities/st_1/enhancements', { enhancement: 'plus1' });
    expect(r1.statusCode, r1.body).toBe(201);
    expect((await rufe('Mira', 'POST', '/api/entities/st_1/enhancements', { enhancement: 'silvered' })).statusCode).toBe(201);
    const roh = (await repo.getEntity('st_1'))!;
    expect(roh.relations.filter((r) => r.type === 'enchantedWith').map((r) => r.to)).toEqual(['plus1', 'silvered']);
    expect(roh.components['Item']).toBeUndefined();
    const gelesen = (await rufe('Sela', 'GET', '/api/entities/st_1')).json() as Entity;
    expect(gelesen.enhanced).toMatchObject({ name: '+1 Silvered Dagger', price: 110200, rarity: 'uncommon', bonusWeapon: 1 });
    /* Das Inventar nennt das Stück beim gerechneten Namen. */
    const inv = (await rufe('Sela', 'GET', '/api/entities/inv_1')).json() as { refs?: { names?: Record<string, string> } };
    expect(inv.refs?.names?.['st_1']).toBe('+1 Silvered Dagger');
    expect((await rufe('Mira', 'DELETE', '/api/entities/st_1/enhancements/silvered')).statusCode).toBe(200);
    expect(((await rufe('Mira', 'GET', '/api/entities/st_1')).json() as Entity).enhanced?.name).toBe('+1 Dagger');
  });

  it('prüft gegen appliesTo und hängt nichts an den Grundgegenstand', async () => {
    const { rufe } = await aufbau();
    const falsch = await rufe('Mira', 'POST', '/api/entities/st_1/enhancements', { enhancement: 'adamant' });
    expect(falsch.statusCode).toBe(400);
    expect(falsch.json().error).toMatch(/applies to armor/);
    expect((await rufe('Mira', 'POST', '/api/entities/dagger/enhancements', { enhancement: 'plus1' })).statusCode).toBe(400);
    /* Auch der gewöhnliche Schreibweg prüft. */
    const roh = (await rufe('Mira', 'GET', '/api/entities/st_1')).json() as Entity & { revision?: number };
    const { refs: _r, fromTemplate: _f, ...st } = roh as Entity & { refs?: unknown };
    const mit = { ...st, relations: [...st.relations, { id: 'st_1~x', type: 'enchantedWith', to: 'adamant', props: {} }] };
    const put = await rufe('Mira', 'PUT', '/api/entities/st_1', mit);
    expect(put.statusCode, put.body).toBe(400);
  });

  it('Spielende hängen nichts an — weder über die Route noch über das Schreiben —, bis die Kampagne es erlaubt', async () => {
    const { repo, rufe } = await aufbau();
    expect((await rufe('Sela', 'POST', '/api/entities/st_1/enhancements', { enhancement: 'plus1' })).statusCode).toBe(403);
    const st = (await repo.getEntity('st_1'))!;
    const mit = { ...st, relations: [...st.relations, { id: 'st_1~x', type: 'enchantedWith', to: 'plus1', props: {} }] };
    expect((await rufe('Sela', 'PUT', '/api/entities/st_1', mit)).statusCode).toBe(403);

    const erlaubt = await aufbau(undefined, 'players');
    expect((await erlaubt.rufe('Sela', 'POST', '/api/entities/st_1/enhancements', { enhancement: 'plus1' })).statusCode).toBe(201);
  });

  it('folgt der Preisregel der Kampagne', async () => {
    const base = await aufbau('base');
    await base.rufe('Mira', 'POST', '/api/entities/st_1/enhancements', { enhancement: 'plus1' });
    expect(((await base.rufe('Mira', 'GET', '/api/entities/st_1')).json() as Entity).enhanced?.price).toBe(200);
    const keiner = await aufbau('none');
    await keiner.rufe('Mira', 'POST', '/api/entities/st_1/enhancements', { enhancement: 'plus1' });
    expect(((await keiner.rufe('Mira', 'GET', '/api/entities/st_1')).json() as Entity).enhanced?.price).toBeUndefined();
  });
});
