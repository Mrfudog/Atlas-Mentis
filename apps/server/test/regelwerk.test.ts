import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
// @ts-expect-error — ein Node-Skript ohne Typen
import { check, expand } from '../../../scripts/regelwerk/plan.mjs';

/* Der Einleser für Regelwerke (T-122) gegen einen echten Server mit
   Speicher. Das Paket ist erfunden — kein Buchinhalt im Repository. */

const lauf = promisify(execFile);
const SKRIPT = resolve(__dirname, '../../../scripts/regelwerk.mjs');
const PW = 'nebel-wacht-am-tor';

const kit: Entity = {
  id: 'it_kit',
  interfaces: ['Item'],
  name: 'Herbal kit',
  components: { Identity: { name: 'Herbal kit', id: 'item-0001', aliases: [] }, Item: { itemType: 'tool' } },
  relations: [],
};

const paket = {
  format: 'atlas-regelwerk/1',
  layer: { name: 'Test Crafting Book', abbreviation: 'TCB', author: 'Someone', publisher: 'Third party' },
  articles: [
    { key: 'm1', type: 'Material', name: 'Grey moss', fields: { 'Material.materialType': 'reagent' } },
    { key: 'i1', type: 'Item', name: 'Grey salve', fields: { 'Item.itemType': 'potion' } },
    {
      key: 'r1',
      type: 'Recipe',
      name: 'Grey salve',
      fields: { 'Recipe.tool': 'Herbal kit', 'Recipe.dc': 13 },
      relations: [
        { type: 'needs', to: 'm1', props: { qty: 2 } },
        { type: 'yields', to: 'i1' },
      ],
    },
    { key: 'g1', type: 'Rule', name: 'Gathering', fields: {} },
  ],
};

let repo: InMemoryRepository;
let app: ReturnType<typeof buildApp>;
let url = '';
let tokenKlar = '';

beforeEach(async () => {
  repo = new InMemoryRepository(seedRegistry, [kit]);
  app = buildApp({ repo });
  await repo.putUser({ id: 'u_w', name: 'werkbank', passwordHash: await hashPassword(PW), isAdmin: true, actorIds: [], roles: {} });
  const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'werkbank', password: PW } });
  const cookie = `nw_session=${login.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}`;
  const t = await app.inject({ method: 'POST', url: '/api/tokens', headers: { cookie }, payload: { name: 'cli', scope: 'write' } });
  tokenKlar = t.json().token;
  url = await app.listen({ port: 0, host: '127.0.0.1' });
});
afterEach(async () => {
  await app.close();
});

async function einlesen(datei: string, ...mehr: string[]) {
  const env: NodeJS.ProcessEnv = { ...process.env, ATLAS_URL: url, ATLAS_DEV_TOKEN: tokenKlar, NODE_USE_ENV_PROXY: '' };
  for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']) delete env[k];
  return lauf(process.execPath, [SKRIPT, datei, ...mehr], { env });
}

describe('Regelwerk-Paket prüfen (T-122)', () => {
  it('legt je lernbarem Rezept eine Blaupause an', () => {
    const a = expand(paket);
    expect(a.map((x: { key: string }) => x.key)).toEqual(['m1', 'i1', 'r1', 'r1#blueprint', 'g1']);
    expect(a[2].relations).toContainEqual({ type: 'knowledge', to: 'r1#blueprint' });
  });

  it('nennt unbekannte Felder, Kanten und Schlüssel, ohne Text', () => {
    const kaputt = {
      ...paket,
      articles: [
        { key: 'x', type: 'Recipe', name: 'X', fields: { 'Recipe.nope': 1 }, relations: [{ type: 'needs', to: 'fehlt' }, { type: 'placed', to: 'x' }] },
      ],
    };
    const { fehler } = check(kaputt, seedRegistry);
    expect(fehler.join('\n')).toMatch(/Recipe\.nope does not exist/);
    expect(fehler.join('\n')).toMatch(/unknown key fehlt/);
    expect(fehler.join('\n')).toMatch(/placed does not start at this type/);
    expect(check(paket, seedRegistry).fehler).toEqual([]);
  });
});

describe('Regelwerk einlesen über die API (T-122)', () => {
  it('weigert sich, eine Datei aus dem Repository zu lesen', async () => {
    await expect(einlesen(resolve(__dirname, '../../../package.json'))).rejects.toMatchObject({ stderr: expect.stringMatching(/Repository/) });
  });

  it('legt Ebene, Herausgeber, Artikel und Kanten an — und ein zweiter Lauf ändert nichts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'regelwerk-'));
    const datei = join(dir, 'paket.json');
    writeFileSync(datei, JSON.stringify(paket));

    const probe = await einlesen(datei, '--dry-run');
    expect(probe.stdout).toMatch(/Probelauf/);
    expect((await repo.listEntities()).length).toBe(1);

    const erst = await einlesen(datei);
    expect(erst.stdout).toMatch(/Angelegt: 5/);
    const alle = await repo.listEntities();
    const nach = (name: string) => alle.find((e) => e.name === name)!;
    const ebene = nach('Test Crafting Book');
    expect(ebene.components?.['Layer']).toMatchObject({ kind: 'book', abbreviation: 'TCB', author: 'Someone' });
    const gruppe = nach('Third party');
    expect(gruppe.components?.['Layer']).toMatchObject({ kind: 'group', groupBy: 'publisher' });
    expect(ebene.relations).toContainEqual(expect.objectContaining({ type: 'partOf', to: gruppe.id }));

    const rezept = alle.find((e) => e.interfaces[0] === 'Recipe')!;
    expect(rezept.components?.['Recipe']).toMatchObject({ tool: 'Herbal kit', dc: 13 });
    expect(rezept.components?.['Status']).toMatchObject({ status: 'ready' });
    const typen = (rezept.relations ?? []).map((r) => r.type).sort();
    expect(typen).toEqual(['inLayer', 'knowledge', 'needs', 'yields']);
    expect(rezept.relations?.find((r) => r.type === 'needs')?.props).toMatchObject({ qty: 2 });
    const blaupause = alle.find((e) => e.id === rezept.relations?.find((r) => r.type === 'knowledge')?.to)!;
    expect(blaupause.interfaces[0]).toBe('Information');
    // Nicht aufgeschaltet: keine Kampagne nennt die Ebene.
    expect(alle.some((e) => (e.relations ?? []).some((r) => r.type === 'activates' && r.to === ebene.id))).toBe(false);

    const zweit = await einlesen(datei);
    expect(zweit.stdout).toMatch(/Angelegt: 0/);
    expect(zweit.stdout).toMatch(/Geschrieben: 0/);
    expect((await repo.listEntities()).length).toBe(alle.length);
    expect(JSON.parse(readFileSync(`${datei}.state.json`, 'utf8')).layer).toBe(ebene.id);
  }, 30000);
});
