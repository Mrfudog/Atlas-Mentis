import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { InMemoryAssetStore } from '../src/assets.js';
import { SpeicherSicherung, gegenstelleAus } from '../src/uebernahme.js';

/* Übernahme dev ↔ prod (T-130): zwei Installationen, jede mit eigenem
   Bestand, eigenen Konten und eigener Sicherung. dev spricht prod über
   dieselbe Gegenstelle an wie im Betrieb — nur geht ihr fetch nicht ins
   Netz, sondern in die App von prod. */

const PW = 'nebel-wacht-am-tor';
const regel = (peg: string, nr: string, name: string, text: string, rel: Entity['relations'] = []): Entity => ({
  id: peg,
  interfaces: ['Rule'],
  name,
  components: { Identity: { name, id: nr, aliases: [] }, Description: { description: text } },
  relations: rel,
});

function grundbestand(): Entity[] {
  return [regel('r_water', 'rule-0001', 'Water', 'Swimming costs double.'), regel('r_fire', 'rule-0002', 'Fire', 'Burns.')];
}

let prodRepo: InMemoryRepository;
let devRepo: InMemoryRepository;
let prod: ReturnType<typeof buildApp>;
let dev: ReturnType<typeof buildApp>;
let prodSicherung: SpeicherSicherung;
let devSicherung: SpeicherSicherung;
let prodAssets: InMemoryAssetStore;
let devAssets: InMemoryAssetStore;
let admin: Record<string, string>;
let prodAdmin: Record<string, string>;

async function anmelden(app: ReturnType<typeof buildApp>, repo: InMemoryRepository, name: string, isAdmin = true) {
  await repo.putUser({ id: `u_${name}`, name, passwordHash: await hashPassword(PW), isAdmin, actorIds: [], roles: {} });
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PW } });
  return { cookie: `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}` };
}

/** Ein fetch, das in eine App spricht statt ins Netz. */
function fetchIn(app: ReturnType<typeof buildApp>): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const r = await app.inject({
      method: (init?.method ?? 'GET') as 'GET' | 'POST',
      url: url.pathname + url.search,
      headers: (init?.headers ?? {}) as Record<string, string>,
      ...(init?.body ? { payload: String(init.body) } : {}),
    });
    return new Response(r.statusCode === 204 ? null : r.rawPayload, { status: r.statusCode });
  }) as typeof fetch;
}

async function aufbauen(opts: { accept?: boolean; scope?: 'read' | 'write' } = {}) {
  prodRepo = new InMemoryRepository(seedRegistry, grundbestand());
  devRepo = new InMemoryRepository(seedRegistry, grundbestand());
  prodSicherung = new SpeicherSicherung();
  devSicherung = new SpeicherSicherung();
  prodAssets = new InMemoryAssetStore();
  devAssets = new InMemoryAssetStore();
  prod = buildApp({ repo: prodRepo, env: 'prod', transferAccept: opts.accept ?? true, sicherung: prodSicherung, assets: prodAssets });
  prodAdmin = await anmelden(prod, prodRepo, 'basil');
  const t = await prod.inject({ method: 'POST', url: '/api/tokens', headers: prodAdmin, payload: { name: 'dev', scope: opts.scope ?? 'write' } });
  const token = t.json().token as string;
  dev = buildApp({
    repo: devRepo,
    env: 'dev',
    transferPeer: gegenstelleAus('https://prod.test', token, fetchIn(prod)),
    sicherung: devSicherung,
    assets: devAssets,
  });
  admin = await anmelden(dev, devRepo, 'basil');
}

const vorschau = async (payload: object) => {
  const r = await dev.inject({ method: 'POST', url: '/api/transfer/preview', headers: admin, payload });
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as { items: { id: string; status: string; sourceKey: string; targetKey: string; fields: { key: string; state: string }[] }[] };
};
const laufen = async (payload: object, v: Awaited<ReturnType<typeof vorschau>>, extra: object = {}) =>
  dev.inject({
    method: 'POST',
    url: '/api/transfer/run',
    headers: admin,
    payload: {
      ...payload,
      apply: v.items.map((i) => i.id),
      expect: Object.fromEntries(v.items.map((i) => [i.id, [i.sourceKey, i.targetKey]])),
      ...extra,
    },
  });

beforeEach(async () => {
  await aufbauen();
});

describe('push dev → prod', () => {
  it('prod gives the number, dev follows and repoints its links', async () => {
    /* Auf prod gibt es rule-0003 schon (anderer Artikel); dev legt seine rule-0003 an. */
    await prodRepo.putEntity(regel('r_prod', 'rule-0003', 'Ice', 'Slippery.'));
    await devRepo.putEntity(regel('r_dev', 'rule-0003', 'Wind', 'Blows.'));
    await devRepo.putEntity(regel('r_link', 'rule-0004', 'Storm', 'See [[rule-0003|Wind]].'));
    const auftrag = { direction: 'push', select: { ids: ['r_dev', 'r_link'] } };
    const v = await vorschau(auftrag);
    expect(v.items.map((i) => [i.id, i.status])).toEqual([
      ['r_dev', 'new'],
      ['r_link', 'new'],
    ]);
    const r = await laufen(auftrag, v);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().numbers).toEqual({ r_dev: 'rule-0005' });
    const aufProd = await prodRepo.getEntity('r_dev');
    expect(aufProd?.components['Identity']?.['id']).toBe('rule-0005');
    /* Der Verweis im mitgeschickten Artikel zeigt auf prod schon auf die neue Nummer … */
    expect((await prodRepo.getEntity('r_link'))?.components['Description']?.['description']).toBe('See [[rule-0005|Wind]].');
    /* … und dev zieht nach. */
    expect((await devRepo.getEntity('r_dev'))?.components['Identity']?.['id']).toBe('rule-0005');
    expect((await devRepo.getEntity('r_link'))?.components['Description']?.['description']).toBe('See [[rule-0005|Wind]].');
    /* Danach stehen beide gleich. */
    const nochmal = await vorschau(auftrag);
    expect(nochmal.items.map((i) => i.status)).toEqual(['unchanged', 'unchanged']);
  });

  it('shows a conflict field by field and writes nothing until it is solved', async () => {
    const auftrag = { direction: 'push', select: { ids: ['r_water'] } };
    /* Erste Übernahme ohne Unterschied: legt die Basis. */
    expect((await laufen(auftrag, await vorschau(auftrag))).statusCode).toBe(200);
    await devRepo.putEntity(regel('r_water', 'rule-0001', 'Water', 'Swimming costs triple.'));
    const p = (await prodRepo.getEntity('r_water'))!;
    await prodRepo.putEntity({ ...p, components: { ...p.components, Description: { description: 'Swimming is free.' } } });
    const v = await vorschau(auftrag);
    expect(v.items[0]?.status).toBe('conflict');
    expect(v.items[0]?.fields).toEqual([
      { key: 'Description.description', kind: 'field', base: 'Swimming costs double.', source: 'Swimming costs triple.', target: 'Swimming is free.', state: 'conflict' },
    ]);
    const ohne = await laufen(auftrag, v);
    expect(ohne.statusCode).toBe(422);
    expect(ohne.json().unresolved).toEqual([{ id: 'r_water', keys: ['Description.description'] }]);
    expect((await prodRepo.getEntity('r_water'))?.components['Description']?.['description']).toBe('Swimming is free.');
    const mit = await laufen(auftrag, v, { choices: { r_water: { 'Description.description': { value: 'Swimming costs double, unless you have a swim speed.' } } } });
    expect(mit.statusCode, mit.body).toBe(200);
    for (const repo of [prodRepo, devRepo]) {
      expect((await repo.getEntity('r_water'))?.components['Description']?.['description']).toBe('Swimming costs double, unless you have a swim speed.');
    }
  });

  it('keeps a change that only prod made', async () => {
    const auftrag = { direction: 'push', select: { ids: ['r_fire'] } };
    await laufen(auftrag, await vorschau(auftrag));
    const p = (await prodRepo.getEntity('r_fire'))!;
    await prodRepo.putEntity({ ...p, components: { ...p.components, Description: { description: 'Burns hot.' } } });
    const v = await vorschau(auftrag);
    expect(v.items[0]?.status).toBe('target-ahead');
    expect((await laufen(auftrag, v)).statusCode).toBe(200);
    expect((await prodRepo.getEntity('r_fire'))?.components['Description']?.['description']).toBe('Burns hot.');
    /* dev zieht beim Schieben nach — prod ist der Master. */
    expect((await devRepo.getEntity('r_fire'))?.components['Description']?.['description']).toBe('Burns hot.');
  });

  it('refuses when anything moved since the preview', async () => {
    const auftrag = { direction: 'push', select: { ids: ['r_fire'] } };
    await devRepo.putEntity(regel('r_fire', 'rule-0002', 'Fire', 'Burns a lot.'));
    const v = await vorschau(auftrag);
    const p = (await prodRepo.getEntity('r_fire'))!;
    await prodRepo.putEntity({ ...p, name: 'Fire', components: { ...p.components, Description: { description: 'Changed meanwhile.' } } });
    const r = await laufen(auftrag, v);
    expect(r.statusCode).toBe(409);
    expect((await prodRepo.getEntity('r_fire'))?.components['Description']?.['description']).toBe('Changed meanwhile.');
  });

  it('backs up, logs and undoes on both sides', async () => {
    await devRepo.putEntity(regel('r_fire', 'rule-0002', 'Fire', 'Burns a lot.'));
    await devRepo.putEntity(regel('r_new', 'rule-0010', 'Earth', 'Solid.'));
    const auftrag = { direction: 'push', select: { ids: ['r_fire', 'r_new'] } };
    const v = await vorschau(auftrag);
    const r = await laufen(auftrag, v, { choices: { r_fire: { 'Description.description': 'source' } } });
    expect(r.statusCode, r.body).toBe(200);
    expect([...prodSicherung.dateien.keys()][0]).toMatch(/vor-uebernahme-von-dev\.json$/);
    const liste = await dev.inject({ method: 'GET', url: '/api/transfer', headers: admin });
    expect(liste.json().runs[0]).toMatchObject({ direction: 'push', by: { name: 'basil' }, undone: false });
    expect(liste.json().peerState).toMatchObject({ env: 'prod', accept: true });
    const undo = await dev.inject({ method: 'POST', url: `/api/transfer/${r.json().id as string}/undo`, headers: admin, payload: {} });
    expect(undo.statusCode, undo.body).toBe(200);
    expect(await prodRepo.getEntity('r_new')).toBeUndefined();
    expect((await prodRepo.getEntity('r_fire'))?.components['Description']?.['description']).toBe('Burns.');
    /* Die Basis ist zurück: dieselbe Vorschau zeigt wieder dasselbe. */
    const wieder = await vorschau(auftrag);
    expect(wieder.items.map((i) => i.status)).toEqual(v.items.map((i) => i.status));
  });

  it('brings dependencies on request, images with their files', async () => {
    const ref = `${'ab'.repeat(32)}.png`;
    await devAssets.put(ref, Buffer.from('bild'));
    await devRepo.putEntity({
      id: 'e_bild',
      interfaces: ['Asset'],
      name: 'Map',
      components: { Identity: { name: 'Map', id: 'asset-0001', aliases: [] }, Asset: { backend: 'app', ref, mime: 'image/png' } },
      relations: [],
    });
    /* Ein Feld, das die Peg-Id nennt, ist ein Verweis — wie ein Bildfeld. */
    await devRepo.putEntity(regel('r_bild', 'rule-0008', 'Map rule', 'e_bild'));
    const ohne = await vorschau({ direction: 'push', select: { ids: ['r_bild'] } });
    expect(ohne.items.map((i) => i.id)).toEqual(['r_bild']);
    const auftrag = { direction: 'push', select: { ids: ['r_bild'] }, dependencies: true };
    const v = await vorschau(auftrag);
    expect(v.items.map((i) => i.id).sort()).toEqual(['e_bild', 'r_bild']);
    expect((await laufen(auftrag, v)).statusCode).toBe(200);
    expect(await prodAssets.has(ref)).toBe(true);
    expect(await prodRepo.getEntity('e_bild')).toBeDefined();
  });

  it('takes registry rows', async () => {
    const reg = await devRepo.getRegistry();
    await devRepo.putRegistryPart('views', { ...reg.views, handout2: { ...reg.views['quick']!, label: 'Handout 2' } } as typeof reg.views);
    const auftrag = { direction: 'push', registry: ['views:handout2'] };
    const v = await vorschau(auftrag);
    expect(v.items).toMatchObject([{ id: 'registry:views:handout2', status: 'new' }]);
    expect((await laufen(auftrag, v)).statusCode).toBe(200);
    expect((await prodRepo.getRegistry()).views['handout2']).toMatchObject({ label: 'Handout 2' });
  });

  it('prod has to accept, and only the administration triggers', async () => {
    await aufbauen({ accept: false });
    await devRepo.putEntity(regel('r_new', 'rule-0010', 'Earth', 'Solid.'));
    const auftrag = { direction: 'push', select: { ids: ['r_new'] } };
    const r = await laufen(auftrag, await vorschau(auftrag));
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toMatch(/ATLAS_TRANSFER_ACCEPT/);
    const spieler = await anmelden(dev, devRepo, 'mira', false);
    expect((await dev.inject({ method: 'POST', url: '/api/transfer/preview', headers: spieler, payload: auftrag })).statusCode).toBe(403);
    /* Auf prod löst niemand aus. */
    expect((await prod.inject({ method: 'POST', url: '/api/transfer/preview', headers: prodAdmin, payload: auftrag })).statusCode).toBe(403);
  });
});

describe('pull prod → dev', () => {
  it('brings articles, dev yields a number prod uses', async () => {
    await prodRepo.putEntity(regel('r_prod', 'rule-0003', 'Ice', 'Slippery.'));
    await devRepo.putEntity(regel('r_dev', 'rule-0003', 'Wind', 'Blows.'));
    await devRepo.putEntity(regel('r_link', 'rule-0004', 'Storm', 'See [[rule-0003|Wind]].'));
    const auftrag = { direction: 'pull', select: { ids: ['r_prod'] } };
    const v = await vorschau(auftrag);
    expect(v.items.map((i) => [i.id, i.status])).toEqual([['r_prod', 'new']]);
    const r = await laufen(auftrag, v);
    expect(r.statusCode, r.body).toBe(200);
    expect((await devRepo.getEntity('r_prod'))?.components['Identity']?.['id']).toBe('rule-0003');
    expect((await devRepo.getEntity('r_dev'))?.components['Identity']?.['id']).toBe('rule-0005');
    expect((await devRepo.getEntity('r_link'))?.components['Description']?.['description']).toBe('See [[rule-0005|Wind]].');
    expect([...devSicherung.dateien.keys()][0]).toMatch(/vor-uebernahme-von-prod\.test\.json$/);
  });

  it('takes the number prod gave an article dev already has', async () => {
    const p = (await prodRepo.getEntity('r_water'))!;
    await prodRepo.putEntity({ ...p, components: { ...p.components, Identity: { ...p.components['Identity'], id: 'rule-0009' } } });
    await devRepo.putEntity(regel('r_link', 'rule-0004', 'Pool', 'See [[rule-0001|Water]].'));
    const auftrag = { direction: 'pull', select: { ids: ['r_water'] } };
    const v = await vorschau(auftrag);
    expect(v.items[0]?.status).toBe('unchanged');
    expect((await laufen(auftrag, v)).statusCode).toBe(200);
    expect((await devRepo.getEntity('r_water'))?.components['Identity']?.['id']).toBe('rule-0009');
    expect((await devRepo.getEntity('r_link'))?.components['Description']?.['description']).toBe('See [[rule-0009|Water]].');
  });

  it('works with a read token on prod', async () => {
    await aufbauen({ scope: 'read' });
    await prodRepo.putEntity(regel('r_prod', 'rule-0003', 'Ice', 'Slippery.'));
    const auftrag = { direction: 'pull', select: { ids: ['r_prod'] } };
    expect((await laufen(auftrag, await vorschau(auftrag))).statusCode).toBe(200);
    await devRepo.putEntity(regel('r_x', 'rule-0009', 'X', 'x'));
    const push = { direction: 'push', select: { ids: ['r_x'] } };
    expect((await laufen(push, await vorschau(push))).statusCode).toBe(403);
  });
});

describe('clone prod → dev', () => {
  it('replaces everything on dev after a backup, keeps the accounts', async () => {
    await devRepo.putEntity(regel('r_only_dev', 'rule-0007', 'Gone', 'Will not survive.'));
    await prodRepo.putEntity(regel('r_prod', 'rule-0003', 'Ice', 'Slippery.'));
    const probe = await dev.inject({ method: 'POST', url: '/api/transfer/clone', headers: admin, payload: { dryRun: true } });
    expect(probe.statusCode, probe.body).toBe(200);
    expect(probe.json()).toMatchObject({ dryRun: true, here: 3, incoming: 3 });
    expect((await dev.inject({ method: 'POST', url: '/api/transfer/clone', headers: admin, payload: {} })).statusCode).toBe(409);
    const r = await dev.inject({ method: 'POST', url: '/api/transfer/clone', headers: admin, payload: { confirm: 'OVERWRITE' } });
    expect(r.statusCode, r.body).toBe(200);
    expect(await devRepo.getEntity('r_only_dev')).toBeUndefined();
    expect(await devRepo.getEntity('r_prod')).toBeDefined();
    expect(await devRepo.findUserByName('basil')).toBeDefined();
    const sicherung = [...devSicherung.dateien.values()][0] as { entities: Entity[] };
    expect(sicherung.entities.map((e) => e.id)).toContain('r_only_dev');
    /* Danach ist alles gleich. */
    const v = await vorschau({ direction: 'pull', select: { types: ['Rule'] } });
    expect(v.items.every((i) => i.status === 'unchanged')).toBe(true);
  });
});
