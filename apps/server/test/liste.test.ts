/**
 * Die Liste am Server (W7): Blättern, Suche, Facetten, Teile von
 * Statblöcken, Verweise beim Ausliefern und das Anlegen.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { asNumber, parseListQuery } from '../src/liste.js';

const PASSWORT = 'nebel-wacht-am-tor';

const art = (
  id: string,
  type: string,
  name: string,
  nr: string,
  karte: Record<string, unknown> = {},
  relations: Entity['relations'] = [],
  extra: Entity['components'] = {},
): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name, id: nr }, ...(Object.keys(karte).length ? { [type]: karte } : {}), ...extra },
  relations,
});

const ebene = art('l1', 'Layer', 'Grundregeln', 'layer-0001');
const aktionsart = art('at1', 'ActionType', 'Action', 'actiontype-0001');
const zauber = [
  art('s1', 'Spell', 'Fireball', 'spell-0001', { level: 3, school: 'evocation' }, [
    { id: 's1~l', type: 'inLayer', to: 'l1', props: {} },
  ]),
  art('s2', 'Spell', 'Fire Bolt', 'spell-0002', { level: 0, school: 'evocation' }),
  art('s3', 'Spell', 'Invisibility', 'spell-0003', { level: 2, school: 'illusion' }, [], {
    Identity: { name: 'Invisibility', id: 'spell-0003', aliases: ['Unsichtbarkeit'] },
  }),
];
const aktionen = [
  art('a1', 'Action', 'Multiattack', 'action-0001', { actionType: 'at1' }),
  art('a2', 'Action', 'Pack Tactics', 'action-0002', { actionType: 'at1' }),
];
const statbloecke = [
  art('b1', 'Statblock', 'Goblin Boss', 'statblock-0001', { cr: '1' }, [
    { id: 'b1~1', type: 'composedOf', to: 'a1', props: {} },
    { id: 'b1~2', type: 'composedOf', to: 'a2', props: {} },
  ]),
  art('b2', 'Statblock', 'Wolf', 'statblock-0002', { cr: '1/4' }, [
    { id: 'b2~1', type: 'composedOf', to: 'a2', props: {} },
  ]),
  art('b3', 'Statblock', 'Rätselwesen', 'statblock-0003', { cr: 'Unknown' }),
];
const geheim = art('g1', 'Spell', 'Verbotener Spruch', 'spell-0004', { level: 9 }, [], {
  Visibility: { audience: 'gm' },
});

async function makeApp(entities: Entity[] = [ebene, aktionsart, ...zauber, ...aktionen, ...statbloecke, geheim]) {
  const repo = new InMemoryRepository(seedRegistry, entities);
  const app = buildApp({ repo });
  const konto = async (name: string, isAdmin: boolean) => {
    await repo.putUser({ id: `u_${name}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin });
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const keks = res.cookies.find((c) => c.name === 'nw_session');
    return { cookie: `nw_session=${keks?.value ?? ''}` };
  };
  const gm = await konto('Leitung', true);
  const spieler = await konto('Spieler', false);
  const get = (url: string, headers = gm) => app.inject({ method: 'GET', url, headers });
  return { app, repo, gm, spieler, get };
}

describe('GET /api/list', () => {
  it('pages through the sieved list, sorted by name, with the type counts', async () => {
    const { get } = await makeApp();
    const res = await get('/api/list?limit=2');
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.rows.map((z: { name: string }) => z.name)).toEqual(['Action', 'Fire Bolt']);
    /* Multiattack gehört nur dem Goblin Boss: ein Teil, ausgeblendet. */
    expect(r.total).toBe(10);
    expect(r.facets.partsHidden).toBe(1);
    const zweites = (await get('/api/list?limit=2&offset=2')).json();
    expect(zweites.rows.map((z: { name: string }) => z.name)).toEqual(['Fireball', 'Goblin Boss']);
    const spell = r.facets.types.find((t: { type: string }) => t.type === 'Spell');
    expect(spell).toMatchObject({ count: 4, area: 'rules', label: 'Spell' });
  });

  it('shows statblock parts on request, and counts the users of shared ones', async () => {
    const { get } = await makeApp();
    const ohne = (await get('/api/list?type=Action')).json();
    expect(ohne.rows.map((z: { name: string }) => z.name)).toEqual(['Pack Tactics']);
    expect(ohne.rows[0].users).toBe(2);
    const mit = (await get('/api/list?type=Action&parts=1')).json();
    expect(mit.rows.map((z: { name: string; users?: number }) => [z.name, z.users])).toEqual([
      ['Multiattack', 1],
      ['Pack Tactics', 2],
    ]);
  });

  it('searches name, alias and number', async () => {
    const { get } = await makeApp();
    const namen = async (q: string) =>
      (await get(`/api/list?q=${encodeURIComponent(q)}`)).json().rows.map((z: { name: string }) => z.name);
    expect(await namen('fire')).toEqual(['Fire Bolt', 'Fireball']);
    expect(await namen('unsichtbar')).toEqual(['Invisibility']);
    expect(await namen('spell-0002')).toEqual(['Fire Bolt']);
  });

  it('gives the columns of the type from its overview, and filters by them', async () => {
    const { get } = await makeApp();
    const r = (await get('/api/list?type=Spell')).json();
    expect(r.columns.map((c: { ref: string }) => c.ref)).toContain('Spell.level');
    expect(r.rows.find((z: { name: string }) => z.name === 'Fireball').cols).toMatchObject({
      'Spell.level': 3,
      'Spell.school': 'evocation',
    });
    const schule = r.facets.fields.find((f: { ref: string }) => f.ref === 'Spell.school');
    expect(schule.kind).toBe('enum');
    expect(schule.options).toEqual([
      { value: 'evocation', count: 2 },
      { value: 'illusion', count: 1 },
    ]);
    const grad = r.facets.fields.find((f: { ref: string }) => f.ref === 'Spell.level');
    expect(grad).toMatchObject({ kind: 'range', min: 0, max: 9 });

    const gefiltert = (await get('/api/list?type=Spell&f=Spell.school:evocation&f=Spell.level:1..9')).json();
    expect(gefiltert.rows.map((z: { name: string }) => z.name)).toEqual(['Fireball']);
    /* Die eigene Facette zählt ohne den eigenen Filter. */
    const s2 = gefiltert.facets.fields.find((f: { ref: string }) => f.ref === 'Spell.school');
    expect(s2.options.map((o: { value: string }) => o.value)).toEqual(['evocation', 'illusion']);
  });

  it('reads the challenge rating as a range, fractions and all', async () => {
    const { get } = await makeApp();
    const r = (await get('/api/list?type=Statblock&f=Statblock.cr:0..0.5&sort=-Statblock.cr')).json();
    expect(r.rows.map((z: { name: string }) => z.name)).toEqual(['Wolf']);
    const alle = (await get('/api/list?type=Statblock&sort=-Statblock.cr')).json();
    expect(alle.rows.map((z: { name: string }) => z.name)).toEqual(['Goblin Boss', 'Wolf', 'Rätselwesen']);
  });

  it('filters by layer, with “no layer” as its own entry', async () => {
    const { get } = await makeApp();
    const r = (await get('/api/list?layer=l1')).json();
    expect(r.rows.map((z: { name: string }) => z.name)).toEqual(['Fireball']);
    expect(r.rows[0].layers).toEqual(['Grundregeln']);
    const ebenen = (await get('/api/list')).json().facets.layers;
    expect(ebenen.map((l: { name: string }) => l.name)).toEqual(['Grundregeln', 'No layer']);
  });

  it('finds subtypes with `of`, for pickers', async () => {
    const { get } = await makeApp();
    const r = (await get('/api/list?of=Rule&q=fire&limit=20')).json();
    expect(r.rows.map((z: { type: string }) => z.type)).toEqual(['Spell', 'Spell']);
  });

  it('sieves per viewer: a player does not see what is for the table lead', async () => {
    const { get, spieler } = await makeApp();
    const gm = (await get('/api/list?type=Spell')).json();
    const sp = (await get('/api/list?type=Spell', spieler)).json();
    expect(gm.total).toBe(4);
    expect(sp.total).toBe(3);
    expect(sp.rows.some((z: { name: string }) => z.name === 'Verbotener Spruch')).toBe(false);
  });

  it('notices a write: the next page is computed from the new state', async () => {
    const { get, app, gm } = await makeApp();
    expect((await get('/api/list?q=nebel')).json().total).toBe(0);
    await app.inject({ method: 'POST', url: '/api/entities', headers: gm, payload: { type: 'Spell', name: 'Nebelpfeil' } });
    expect((await get('/api/list?q=nebel')).json().total).toBe(1);
  });
});

describe('the parts of a query', () => {
  it('reads lists, ranges and value lists from the address', () => {
    const q = parseListQuery({ type: 'Spell,Feat', f: ['Spell.level:1..3', 'Spell.school:evocation|illusion'], limit: '999' });
    expect(q.type).toEqual(['Spell', 'Feat']);
    expect(q.fields).toEqual({ 'Spell.level': { min: 1, max: 3 }, 'Spell.school': { values: ['evocation', 'illusion'] } });
    expect(q.limit).toBe(200);
  });
  it('reads 1/4 as a number', () => {
    expect(asNumber('1/4')).toBe(0.25);
    expect(asNumber('Unknown')).toBeNaN();
    expect(asNumber(3)).toBe(3);
  });
});

describe('an opened article brings its names', () => {
  it('names its edge targets and resolves its [[links]] — only what the viewer may see', async () => {
    const text = art('t1', 'Rule', 'Feuerregel', 'rule-0001', {}, [], {
      Description: { description: 'Siehe [[Fireball]], [[spell-0002|den Bolzen]], [[Verbotener Spruch]] und [[Gibtsnicht]].' },
    });
    const { get, spieler } = await makeApp([ebene, aktionsart, ...zauber, ...aktionen, ...statbloecke, geheim, text]);
    const boss = (await get('/api/entities/b1')).json();
    expect(boss.refs.names).toEqual({ a1: 'Multiattack', a2: 'Pack Tactics' });

    const gm = (await get('/api/entities/t1')).json();
    expect(gm.refs.links['Fireball']).toEqual([{ id: 's1', name: 'Fireball' }]);
    expect(gm.refs.links['spell-0002']).toEqual([{ id: 's2', name: 'Fire Bolt' }]);
    expect(gm.refs.links['Verbotener Spruch']).toEqual([{ id: 'g1', name: 'Verbotener Spruch' }]);
    expect(gm.refs.links['Gibtsnicht']).toEqual([]);

    const sp = (await get('/api/entities/t1', spieler)).json();
    expect(sp.refs.links['Verbotener Spruch']).toEqual([]);
  });

  it('turns [[names]] into numbers on request, and says what stayed open', async () => {
    const { app, gm } = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/links',
      headers: gm,
      payload: { texts: ['[[Fireball]] und [[Gibtsnicht]]', 'ohne'] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ texts: ['[[spell-0001|Fireball]] und [[Gibtsnicht]]', 'ohne'], open: ['Gibtsnicht'] });
  });

  it('lets a player ask for links — it reads, it does not write', async () => {
    const { app, spieler } = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/links', headers: spieler, payload: { texts: ['[[Fireball]]'] } });
    expect(res.statusCode).toBe(200);
  });
});

describe('POST /api/entities', () => {
  it('hands out the id and the number, and fills in the defaults', async () => {
    const { app, gm, get } = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/entities', headers: gm, payload: { type: 'Spell', name: 'Nebelpfeil' } });
    expect(res.statusCode).toBe(201);
    const e = res.json() as Entity;
    expect(e.id).toMatch(/^e_[0-9a-f]{12}$/);
    expect(e.components['Identity']).toEqual({ name: 'Nebelpfeil', id: 'spell-0005' });
    expect(e.components['Spell']?.['duration']).toBe('instant');
    expect((await get(`/api/entities/${e.id}`)).statusCode).toBe(200);
  });

  it('refuses an abstract type, an empty name, and a missing required field', async () => {
    const { app, gm } = await makeApp();
    const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/entities', headers: gm, payload: payload as object });
    expect((await post({ type: 'Identity', name: 'X' })).statusCode).toBe(400);
    expect((await post({ type: 'Spell', name: '  ' })).statusCode).toBe(400);
    const ohneArt = await post({ type: 'Action', name: 'Biss' });
    expect(ohneArt.statusCode).toBe(422);
    expect(ohneArt.json().issues[0]).toMatchObject({ component: 'Action', property: 'actionType' });
    const mitArt = await post({ type: 'Action', name: 'Biss', fields: { 'Action.actionType': 'at1' } });
    expect(mitArt.statusCode).toBe(201);
  });

  it('is for whoever may write — not a player', async () => {
    const { app, spieler } = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/entities', headers: spieler, payload: { type: 'Spell', name: 'Meins' } });
    expect(res.statusCode).toBe(403);
  });
});

describe('leaving layers out', () => {
  it('drops an article only when all its layers are unticked', async () => {
    const { get } = await makeApp();
    const r = (await get(`/api/list?nolayer=${encodeURIComponent('∅')}`)).json();
    expect(r.rows.map((z: { name: string }) => z.name)).toEqual(['Fireball']);
    /* Die Facette zählt ohne die eigene Wahl. */
    expect(r.facets.layers.map((l: { id: string }) => l.id)).toEqual(['l1', '∅']);
  });
});

describe('lists for other pages', () => {
  it('gives names and types for known ids, parts included, and edges on request', async () => {
    const { get } = await makeApp();
    const r = (await get('/api/list?ids=a1,s1&rel=composedOf,inLayer')).json();
    expect(r.rows.map((z: { name: string }) => z.name)).toEqual(['Fireball', 'Multiattack']);
    expect(r.rows[0].rels).toEqual({ composedOf: [], inLayer: ['l1'] });
    const boss = (await get('/api/list?ids=b1&rel=composedOf')).json();
    expect(boss.rows[0].rels.composedOf).toEqual(['a1', 'a2']);
  });

  it('creates an article with its edges', async () => {
    const { app, gm, get } = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/entities',
      headers: gm,
      payload: { type: 'Spell', name: 'Ebenenzauber', relations: [{ type: 'inLayer', to: 'l1' }] },
    });
    expect(res.statusCode).toBe(201);
    const e = res.json() as Entity;
    expect(e.relations).toEqual([{ id: `${e.id}~inLayer-1`, type: 'inLayer', to: 'l1', props: {} }]);
    expect((await get('/api/list?layer=l1&q=ebenen')).json().total).toBe(1);
  });
});
