import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Geben (T-150): Beute, Geschenke, „Add an item" — das Stück entsteht als
   Instanz des Gegenstands. Erfundene Artikel, kein Buchinhalt. */

const PW = 'nebel-wacht-am-tor';
const art = (id: string, typ: string, name: string, nr: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: { Identity: { name, id: nr, aliases: [] }, ...(extra.components ?? {}) }, relations: extra.relations ?? [],
});

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), [CAMPAIGN_SETTING]: 'k' } };
  const repo = new InMemoryRepository(registry, [
    art('fackel', 'Item', 'Torch', 'item-0001'),
    art('dolch', 'Weapon', 'Dagger', 'weapon-0001'),
    art('geheim', 'Item', 'Cursed idol', 'item-0002', { components: { Visibility: { audience: 'gm' } } }),
    art('k', 'Campaign', 'Run', 'campaign-0001'),
    art('f', 'Creature', 'Ash', 'creature-0001', { relations: [{ id: 'f~c', type: 'carries', to: 'inv-f', props: {} }] }),
    art('fremd', 'Creature', 'Bryn', 'creature-0002', { relations: [{ id: 'b~c', type: 'carries', to: 'inv-b', props: {} }] }),
    art('inv-f', 'Inventory', 'Ash’s pack', 'inventory-0001'),
    art('inv-b', 'Inventory', 'Bryn’s pack', 'inventory-0002'),
  ]);
  const app = buildApp({ repo });
  await repo.putUser({ id: 'u_l', name: 'leitung', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'gm' } });
  await repo.putUser({ id: 'u_s', name: 'spielerin', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: ['f'], roles: { k: 'player' } });
  const anmelden = async (name: string) => {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PW } });
    return `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}`;
  };
  const cookie = { l: await anmelden('leitung'), s: await anmelden('spielerin') };
  const geben = (wer: 'l' | 's', inv: string, item: string, qty = 1) =>
    app.inject({ method: 'POST', url: `/api/inventories/${inv}/give`, payload: { item, qty }, headers: { cookie: cookie[wer] } });
  const holds = async (inv: string) => ((await repo.getEntity(inv))?.relations ?? []).filter((r) => r.type === 'holds');
  return { repo, app, geben, holds };
}

describe('Geben (T-150)', () => {
  it('die Leitung gibt: ein Stück als Instanz, ein zweites desselben stapelt', async () => {
    const { repo, geben, holds } = await aufbau();
    const r = await geben('l', 'inv-f', 'dolch', 2);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ created: true, qty: 2 });
    const [h] = await holds('inv-f');
    expect(h?.to).not.toBe('dolch');
    const stueck = await repo.getEntity(h!.to);
    expect(stueck?.interfaces).toEqual(['Weapon']);
    expect(stueck?.components?.['Identity']).toMatchObject({ name: 'Dagger', id: 'weapon-0002' });
    expect(stueck?.relations?.find((x) => x.type === 'instanceOf')?.to).toBe('dolch');

    const zwei = await geben('l', 'inv-f', 'dolch', 1);
    expect(zwei.json()).toMatchObject({ created: false, piece: h!.to });
    expect((await holds('inv-f'))[0]?.props?.['qty']).toBe(3);
    expect((await repo.listEvents({ name: 'inventory.given' })).length).toBe(2);
  });

  it('ein Stück steht in keiner Liste', async () => {
    const { app, geben, holds } = await aufbau();
    await geben('l', 'inv-f', 'fackel');
    const stueck = (await holds('inv-f'))[0]!.to;
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'leitung', password: PW } });
    const cookie = `nw_session=${login.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}`;
    const liste = await app.inject({ method: 'GET', url: '/api/list?type=Item', headers: { cookie } });
    const ids = (liste.json() as { rows: { id: string }[] }).rows.map((r) => r.id);
    expect(ids).toContain('fackel');
    expect(ids).not.toContain(stueck);
  });

  it('die Spielerin legt in ihr eigenes Inventar, nicht in ein fremdes', async () => {
    const { repo, geben } = await aufbau();
    const r = await geben('s', 'inv-f', 'fackel');
    expect(r.statusCode, r.body).toBe(200);
    expect(await repo.authorsOf(r.json().piece)).toContain('u_s');
    expect((await geben('s', 'inv-b', 'fackel')).statusCode).toBe(403);
  });

  it('was sie nicht sieht, kann sie nicht nehmen', async () => {
    const { geben } = await aufbau();
    expect((await geben('s', 'inv-f', 'geheim')).statusCode).toBe(404);
    expect((await geben('l', 'inv-f', 'gibts-nicht')).statusCode).toBe(404);
    expect((await geben('l', 'fackel', 'dolch')).statusCode).toBe(404);
  });
});
