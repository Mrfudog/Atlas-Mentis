/**
 * Die übergreifende Suche (T-138): Treffer nach Nähe, Filter nach Art,
 * Ebene und Herausgeber, und was ein Spieler nicht sieht, findet er nicht.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { naehe } from '../src/liste.js';

const PASSWORT = 'nebel-wacht-am-tor';

const art = (
  id: string,
  type: string,
  name: string,
  nr: string,
  relations: Entity['relations'] = [],
  extra: Entity['components'] = {},
): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name, id: nr }, ...extra },
  relations,
});
const in_ = (id: string, l: string) => [{ id: `${id}~l`, type: 'inLayer', to: l, props: {} }];

const bestand: Entity[] = [
  art('pg', 'Layer', 'Wizards', 'layer-0001', [], { Layer: { kind: 'group', groupBy: 'publisher' } }),
  art('l1', 'Layer', 'Player Handbook', 'layer-0002', [{ id: 'l1~p', type: 'partOf', to: 'pg', props: {} }], { Layer: { kind: 'book' } }),
  art('l2', 'Layer', 'Hausregeln', 'layer-0003', [], { Layer: { kind: 'book' } }),
  art('s1', 'Spell', 'Fireball', 'spell-0001', in_('s1', 'l1')),
  art('s2', 'Spell', 'Fire', 'spell-0002', in_('s2', 'l2')),
  art('s3', 'Spell', 'Wall of Fire', 'spell-0003', in_('s3', 'l1')),
  art('s4', 'Spell', 'Bonfire', 'spell-0004', in_('s4', 'l2')),
  art('s5', 'Spell', 'Flammenkugel', 'spell-0005', in_('s5', 'l2'), {
    Identity: { name: 'Flammenkugel', id: 'spell-0005', aliases: ['Fire orb'] },
  }),
  art('i1', 'Item', 'Fire Opal', 'item-0001', in_('i1', 'l2')),
  art('g1', 'Spell', 'Fire of the Forbidden', 'spell-0006', in_('g1', 'l2'), { Visibility: { audience: 'gm' } }),
];

async function makeApp() {
  const repo = new InMemoryRepository(seedRegistry, bestand);
  const app = buildApp({ repo });
  const konto = async (name: string, isAdmin: boolean) => {
    await repo.putUser({ id: `u_${name}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin });
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    return { cookie: `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}` };
  };
  const gm = await konto('Leitung', true);
  const spieler = await konto('Spieler', false);
  const get = (url: string, headers = gm) => app.inject({ method: 'GET', url, headers });
  return { get, gm, spieler };
}

const namen = (r: { rows: { name: string }[] }) => r.rows.map((z) => z.name);

describe('the closeness of a hit (T-138)', () => {
  it('ranks exact over start over word start over alias over contains', () => {
    expect(naehe('fire', 'fire', 'fire')).toBe(0);
    expect(naehe('fireball', 'fireball', 'fire')).toBe(1);
    expect(naehe('wall of fire', 'wall of fire', 'fire')).toBe(2);
    expect(naehe('flammenkugel', 'flammenkugel\nfire orb', 'fire')).toBe(3);
    expect(naehe('bonfire', 'bonfire', 'fire')).toBe(4);
  });
});

describe('GET /api/search', () => {
  it('lists the closest first, each with its type, layer and publisher', async () => {
    const { get } = await makeApp();
    const r = (await get('/api/search?q=Fire')).json();
    expect(namen(r)).toEqual(['Fire', 'Fire of the Forbidden', 'Fire Opal', 'Fireball', 'Wall of Fire', 'Flammenkugel', 'Bonfire']);
    const ball = r.rows.find((z: { name: string }) => z.name === 'Fireball');
    expect(ball).toMatchObject({ type: 'Spell', typeLabel: 'Spell', area: 'rules', layers: ['Player Handbook'], publishers: ['Wizards'] });
    expect(r.facets.types.map((t: { type: string; count: number }) => [t.type, t.count])).toEqual([
      ['Item', 1],
      ['Spell', 6],
    ]);
    expect(r.facets.publishers.map((p: { name: string }) => p.name)).toContain('Wizards');
  });

  it('filters by type, layer and publisher', async () => {
    const { get } = await makeApp();
    expect(namen((await get('/api/search?q=fire&type=Item')).json())).toEqual(['Fire Opal']);
    expect(namen((await get('/api/search?q=fire&layer=l1')).json())).toEqual(['Fireball', 'Wall of Fire']);
    const v = (await get('/api/search?q=fire&publisher=Wizards')).json();
    expect(namen(v)).toEqual(['Fireball', 'Wall of Fire']);
    /* Die anderen Herausgeber bleiben in der Leiste. */
    expect(v.facets.publishers.length).toBeGreaterThan(1);
    expect(namen((await get('/api/search?q=fire&publisher=Nobody')).json())).toEqual([]);
  });

  it('answers empty without a query, and pages', async () => {
    const { get } = await makeApp();
    expect((await get('/api/search?q=')).json()).toMatchObject({ total: 0, rows: [] });
    const blatt = (await get('/api/search?q=fire&limit=2&offset=2')).json();
    expect(blatt.total).toBe(7);
    expect(namen(blatt)).toEqual(['Fire Opal', 'Fireball']);
  });

  it('does not find for a player what the player may not see', async () => {
    const { get, spieler } = await makeApp();
    const r = (await get('/api/search?q=forbidden', spieler)).json();
    expect(r.total).toBe(0);
    expect(namen((await get('/api/search?q=fire', spieler)).json())).not.toContain('Fire of the Forbidden');
  });
});
