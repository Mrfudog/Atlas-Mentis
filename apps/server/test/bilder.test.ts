/**
 * Bilder hochladen, ablegen, ausliefern (T-114, REQ-021).
 *
 * Geprüft wird, was am Tisch wehtäte: dass ein Bild eines verborgenen NSC
 * nicht an Spielende geht, dass ein SVG oder ein Text kein Bild ist, dass
 * ein `ref` in einem Artikel kein Weg ins Dateisystem ist, und dass eine
 * Datei geht, wenn ihr letztes Asset geht.
 */

import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { FileAssetStore, InMemoryAssetStore, aufbereiten, validKey } from '../src/assets.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ebene = (id: string): Entity => ({
  id,
  interfaces: ['Layer'],
  name: id,
  components: { Identity: { name: id, id: `layer-${id}`, aliases: [] } },
  relations: [],
});
const runde: Entity = {
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
  relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
};
const nsc = (id: string, name: string, extra: Record<string, unknown> = {}): Entity => ({
  id,
  interfaces: ['Creature'],
  name,
  components: { Identity: { name, id: `creature-${id}`, aliases: [] }, ...extra },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} }],
});

async function png(w = 800, h = 600, farbe = { r: 120, g: 30, b: 60 }): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: farbe } }).png().toBuffer();
}

/** Ein multipart-Körper von Hand: Felder zuerst, die Datei zuletzt. */
function formular(felder: Record<string, string>, datei?: { name: string; type: string; data: Buffer }) {
  const grenze = `----atlas${randomUUID()}`;
  const teile: Buffer[] = [];
  for (const [k, v] of Object.entries(felder)) {
    teile.push(Buffer.from(`--${grenze}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  if (datei) {
    teile.push(
      Buffer.from(
        `--${grenze}\r\nContent-Disposition: form-data; name="file"; filename="${datei.name}"\r\nContent-Type: ${datei.type}\r\n\r\n`,
      ),
    );
    teile.push(datei.data, Buffer.from('\r\n'));
  }
  teile.push(Buffer.from(`--${grenze}--\r\n`));
  return { payload: Buffer.concat(teile), headers: { 'content-type': `multipart/form-data; boundary=${grenze}` } };
}

async function aufbau(opts: { maxBytes?: number } = {}) {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [
      ebene('ly_nebel'),
      runde,
      nsc('c_offen', 'Volo'),
      nsc('c_geheim', 'Der Fremde', { Visibility: { audience: 'gm' } }),
    ],
  );
  const store = new InMemoryAssetStore();
  const app = buildApp({ repo, assets: store, ...(opts.maxBytes ? { assetMaxBytes: opts.maxBytes } : {}) });
  const konto = async (name: string, opts2: { admin?: boolean; roles?: Record<string, 'gm' | 'co-gm' | 'player' | 'spectator'> }) =>
    repo.putUser({
      id: `u_${name.toLowerCase()}`,
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: opts2.admin ?? false,
      actorIds: [],
      roles: opts2.roles ?? {},
    });
  await konto('Mira', { roles: { camp_nebel: 'gm' } });
  await konto('Sela', { roles: { camp_nebel: 'player' } });
  await konto('Gast', { roles: { camp_nebel: 'spectator' } });
  await konto('Admin', { admin: true });
  const kekse = new Map<string, string>();
  const keks = async (name: string): Promise<string> => {
    const da = kekse.get(name);
    if (da) return da;
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = res.cookies.find((x) => x.name === 'nw_session');
    if (!c) throw new Error(`keine Sitzung für ${name}`);
    kekse.set(name, `nw_session=${c.value}`);
    return `nw_session=${c.value}`;
  };
  const hoch = async (name: string, felder: Record<string, string>, datei?: { name: string; type: string; data: Buffer }) => {
    const f = formular(felder, datei);
    return app.inject({ method: 'POST', url: '/api/assets', payload: f.payload, headers: { ...f.headers, cookie: await keks(name) } });
  };
  const hole = async (name: string, url: string, headers: Record<string, string> = {}) =>
    app.inject({ method: 'GET', url, headers: { ...headers, cookie: await keks(name) } });
  const als = async (name: string, method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie: await keks(name) }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  return { repo, store, app, hoch, hole, als };
}

type Hochgeladen = Entity & { url: string; thumb: string };
const info = (e: Entity) => e.components?.['Asset'] as { ref: string; mime: string; width: number; height: number; bytes: number; backend: string };

describe('uploading an image creates an Asset article and a file', () => {
  it('stores the file under its hash, with a preview, and serves both to the GM', async () => {
    const { hoch, hole, store } = await aufbau();
    const res = await hoch('Mira', { name: 'Volos Porträt' }, { name: 'volo.png', type: 'image/png', data: await png() });
    expect(res.statusCode).toBe(201);
    const a = res.json() as Hochgeladen;
    expect(a.interfaces).toEqual(['Asset']);
    expect(a.name).toBe('Volos Porträt');
    expect(info(a)).toMatchObject({ backend: 'app', mime: 'image/png', width: 800, height: 600 });
    expect(info(a).ref).toMatch(/^[a-f0-9]{64}\.png$/);
    expect(await store.keys()).toEqual([info(a).ref, `${info(a).ref}.thumb.webp`]);

    const ganz = await hole('Mira', a.url);
    expect(ganz.statusCode).toBe(200);
    expect(ganz.headers['content-type']).toBe('image/png');
    expect(ganz.headers['cache-control']).toBe('private, max-age=31536000, immutable');
    expect(ganz.headers['x-content-type-options']).toBe('nosniff');
    const vorschau = await hole('Mira', a.thumb);
    expect(vorschau.headers['content-type']).toBe('image/webp');
    const m = await sharp(vorschau.rawPayload).metadata();
    expect(m.width).toBe(480);
    /* Ohne Version fragt der Browser nach — und bekommt 304. */
    const ohne = await hole('Mira', `/api/assets/${a.id}`);
    expect(ohne.headers['cache-control']).toBe('private, no-cache');
    const nochmal = await hole('Mira', `/api/assets/${a.id}`, { 'if-none-match': String(ohne.headers['etag']) });
    expect(nochmal.statusCode).toBe(304);
  });

  it('names the asset after the file when no name is given', async () => {
    const { hoch } = await aufbau();
    const res = await hoch('Mira', {}, { name: 'karte_der-kueste.png', type: 'image/png', data: await png(40, 40) });
    expect((res.json() as Entity).name).toBe('karte der kueste');
  });

  it('keeps class and origin a loader names (T-144)', async () => {
    const { hoch } = await aufbau();
    const res = await hoch('Mira', { name: 'Goblin (token)', kind: 'token', publication: 'MM', anchor: '5etools-img:bestiary/tokens/MM/Goblin.webp' }, { name: 'Goblin.png', type: 'image/png', data: await png(40, 40) });
    expect(res.statusCode).toBe(201);
    const a = res.json() as Entity;
    expect(a.components['Asset']).toMatchObject({ kind: 'token' });
    expect(a.components['Source']).toEqual({ publication: 'MM', anchor: '5etools-img:bestiary/tokens/MM/Goblin.webp' });
  });

  it('refuses what is not an image — by content, not by what the browser claims', async () => {
    const { hoch, store } = await aufbau();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const a = await hoch('Mira', {}, { name: 'x.svg', type: 'image/svg+xml', data: svg });
    expect(a.statusCode).toBe(415);
    const b = await hoch('Mira', {}, { name: 'x.png', type: 'image/png', data: Buffer.from('kein bild') });
    expect(b.statusCode).toBe(415);
    const c = await hoch('Mira', {});
    expect(c.statusCode).toBe(400);
    expect(await store.keys()).toEqual([]);
  });

  it('refuses a file over the limit', async () => {
    const { hoch } = await aufbau({ maxBytes: 1000 });
    const res = await hoch('Mira', {}, { name: 'gross.png', type: 'image/png', data: await png(400, 400, { r: 1, g: 2, b: 3 }) });
    expect(res.statusCode).toBe(413);
  });

  it('lets only those upload who may create, and never a spectator', async () => {
    const { hoch, store } = await aufbau();
    const gast = await hoch('Gast', {}, { name: 'a.png', type: 'image/png', data: await png(20, 20) });
    expect(gast.statusCode).toBe(403);
    const sela = await hoch('Sela', {}, { name: 'a.png', type: 'image/png', data: await png(20, 20) });
    expect(sela.statusCode).toBe(201);
    /* Eine Spielerin legt unfertig an (REQ-237) — das Bild auch. */
    expect(((sela.json() as Entity).components?.['Status'] as { status?: string }).status).toBe('idea');
    expect((await store.keys()).length).toBe(2);
  });
});

describe('an image is only served to whom its article is visible', () => {
  it('takes over the visibility of the article it was uploaded from', async () => {
    const { hoch, hole } = await aufbau();
    const res = await hoch('Mira', { for: 'c_geheim' }, { name: 'fremder.png', type: 'image/png', data: await png() });
    expect(res.statusCode).toBe(201);
    const a = res.json() as Hochgeladen;
    expect(a.components?.['Visibility']).toMatchObject({ audience: 'gm' });
    expect((await hole('Mira', a.url)).statusCode).toBe(200);
    /* Wer den Artikel nicht sieht, erfährt nicht einmal, dass es ihn gibt. */
    expect((await hole('Sela', a.url)).statusCode).toBe(404);
    expect((await hole('Sela', a.thumb)).statusCode).toBe(404);
    expect((await hole('Sela', `/api/entities/${a.id}`)).statusCode).toBe(404);
  });

  it('serves an open image to players', async () => {
    const { hoch, hole } = await aufbau();
    const a = (await hoch('Mira', { for: 'c_offen' }, { name: 'volo.png', type: 'image/png', data: await png() })).json() as Hochgeladen;
    expect((await hole('Sela', a.url)).statusCode).toBe(200);
  });

  it('lets a player upload from an article without a status, unfinished', async () => {
    const { hoch } = await aufbau();
    const res = await hoch('Sela', { for: 'c_offen' }, { name: 'x.png', type: 'image/png', data: await png(20, 20) });
    expect(res.statusCode).toBe(201);
    expect(((res.json() as Entity).components?.['Status'] as { status?: string }).status).toBe('idea');
  });

  it('shows the portrait of a player character to the other players (E-014 d)', async () => {
    const { hoch, hole, repo } = await aufbau();
    await repo.putEntity({
      id: 'pc_sela',
      interfaces: ['PlayerCharacter'],
      name: 'Rook',
      components: { Identity: { name: 'Rook', id: 'pc-0001', aliases: [] }, Status: { status: 'ready' } },
      relations: [{ id: 'pc~l', type: 'inLayer', to: 'ly_nebel', props: {} }],
    });
    const sela = (await repo.getUser('u_sela'))!;
    await repo.putUser({ ...sela, actorIds: ['pc_sela'] });
    await repo.putUser({
      id: 'u_tom',
      name: 'Tom',
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: false,
      actorIds: [],
      roles: { camp_nebel: 'player' },
    });
    const res = await hoch('Sela', { for: 'pc_sela' }, { name: 'rook.png', type: 'image/png', data: await png(20, 20) });
    expect(res.statusCode).toBe(201);
    const a = res.json() as Hochgeladen;
    expect((a.components?.['Status'] as { status?: string }).status).toBe('ready');
    expect((await hole('Tom', a.url)).statusCode).toBe(200);
  });

  it('does not let a player upload from an article she cannot see', async () => {
    const { hoch } = await aufbau();
    const res = await hoch('Sela', { for: 'c_geheim' }, { name: 'x.png', type: 'image/png', data: await png(20, 20) });
    expect(res.statusCode).toBe(404);
  });

  it('answers 404 for an article that is not an asset, and when not signed in', async () => {
    const { hole, app } = await aufbau();
    expect((await hole('Mira', '/api/assets/c_offen')).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/assets/c_offen' })).statusCode).toBe(401);
  });
});

describe('the stored reference is not a way into the file system', () => {
  it('ignores a ref that is not a hash key', async () => {
    const { hoch, hole, als } = await aufbau();
    const a = (await hoch('Mira', {}, { name: 'x.png', type: 'image/png', data: await png(20, 20) })).json() as Hochgeladen;
    const roh = (await als('Mira', 'GET', `/api/entities/${a.id}`)).json() as Entity & { revision?: number };
    const { refs: _refs, ...ohne } = roh as Entity & { refs?: unknown };
    const geaendert = {
      ...ohne,
      components: { ...roh.components, Asset: { ...info(roh), ref: '../../../.env' } },
    };
    const put = await als('Mira', 'PUT', `/api/entities/${a.id}`, geaendert);
    expect(put.statusCode).toBe(200);
    expect((await hole('Mira', `/api/assets/${a.id}`)).statusCode).toBe(404);
    expect(validKey('../../../.env')).toBe(false);
    expect(validKey(`${'a'.repeat(64)}.png`)).toBe(true);
  });

  it('redirects an external asset to its address', async () => {
    const { repo, hole } = await aufbau();
    await repo.putEntity({
      id: 'e_extern',
      interfaces: ['Asset'],
      name: 'Fremd',
      components: {
        Identity: { name: 'Fremd', id: 'asset-0001', aliases: [] },
        Asset: { backend: 'external', ref: 'https://example.org/karte.jpg' },
      },
      relations: [],
    });
    const res = await hole('Mira', '/api/assets/e_extern');
    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toBe('https://example.org/karte.jpg');
  });
});

describe('a file goes with its last asset', () => {
  it('keeps a file two assets share until both are gone', async () => {
    const { hoch, als, store } = await aufbau();
    const bild = await png(50, 50);
    const a = (await hoch('Mira', { name: 'A' }, { name: 'a.png', type: 'image/png', data: bild })).json() as Hochgeladen;
    const b = (await hoch('Mira', { name: 'B' }, { name: 'b.png', type: 'image/png', data: bild })).json() as Hochgeladen;
    expect(info(a).ref).toBe(info(b).ref);
    expect((await store.keys()).length).toBe(2);
    expect((await als('Mira', 'DELETE', `/api/entities/${a.id}`)).statusCode).toBe(200);
    expect((await store.keys()).length).toBe(2);
    expect((await als('Mira', 'DELETE', `/api/entities/${b.id}`)).statusCode).toBe(200);
    expect(await store.keys()).toEqual([]);
  });
});

describe('preparing an image', () => {
  it('strips EXIF from a photo and turns it upright', async () => {
    const foto = await sharp({ create: { width: 60, height: 40, channels: 3, background: { r: 9, g: 9, b: 9 } } })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'Zuhause' } } })
      .toBuffer();
    expect((await sharp(foto).metadata()).exif).toBeDefined();
    const b = await aufbereiten(foto);
    const m = await sharp(b.data).metadata();
    expect(m.exif).toBeUndefined();
    /* Gedreht: aus 60×40 mit Orientierung 6 wird 40×60. */
    expect([b.width, b.height]).toEqual([40, 60]);
    expect(b.mime).toBe('image/jpeg');
  });
});

describe('the storage of the asset store (T-211)', () => {
  it('tells the admin how much lies there, and nobody else', async () => {
    const { hoch, als } = await aufbau();
    await hoch('Mira', { name: 'Volo' }, { name: 'volo.png', type: 'image/png', data: await png() });
    const res = await als('Admin', 'GET', '/api/assets/storage');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ files: 2, free: null, total: null });
    expect(res.json().bytes).toBeGreaterThan(0);
    expect((await als('Mira', 'GET', '/api/assets/storage')).statusCode).toBe(403);
  });
});

describe('FileAssetStore', () => {
  const dirs: string[] = [];
  afterAll(async () => {
    for (const d of dirs) await rm(d, { recursive: true, force: true });
  });

  it('writes under a two-letter folder, lists, reads and deletes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'atlas-bilder-'));
    dirs.push(dir);
    const s = new FileAssetStore(join(dir, 'bilder'));
    await s.bereit();
    const key = `${'ab'.repeat(32)}.png`;
    await s.put(key, Buffer.from('x'));
    expect(await readdir(join(dir, 'bilder', 'ab'))).toEqual([key]);
    expect(await s.keys()).toEqual([key]);
    const got = await s.get(key);
    expect(got?.bytes).toBe(1);
    got?.body.destroy();
    const u = await s.usage();
    expect(u).toMatchObject({ files: 1, bytes: 1 });
    expect(u.free).toBeGreaterThan(0);
    expect(u.total).toBeGreaterThanOrEqual(u.free ?? 0);
    await expect(s.put('../boese', Buffer.from('x'))).rejects.toThrow();
    expect(await s.get('../boese')).toBeNull();
    await s.delete(key);
    expect(await s.keys()).toEqual([]);
  });
});

describe('the export names the image files', () => {
  it('lists each stored file of an exported asset', async () => {
    const { hoch, als } = await aufbau();
    const a = (await hoch('Mira', {}, { name: 'x.png', type: 'image/png', data: await png(20, 20) })).json() as Hochgeladen;
    const res = await als('Mira', 'GET', '/api/export?campaign=camp_nebel');
    expect(res.statusCode).toBe(200);
    const datei = res.json() as { files: { asset: string; ref: string; mime: string; bytes: number }[] };
    expect(datei.files).toEqual([{ asset: a.id, ref: info(a).ref, mime: 'image/png', bytes: info(a).bytes }]);
  });
});

describe('the list shows a preview image (overview, T-114)', () => {
  it('names the asset of a row, but only if the viewer sees it', async () => {
    const { hoch, repo, als } = await aufbau();
    const offen = (await hoch('Mira', { for: 'c_offen' }, { name: 'volo.png', type: 'image/png', data: await png(30, 30) })).json() as Hochgeladen;
    const geheim = (await hoch('Mira', { for: 'c_geheim' }, { name: 'f.png', type: 'image/png', data: await png(31, 30) })).json() as Hochgeladen;
    const volo = (await repo.getEntity('c_offen'))!;
    await repo.putEntity({ ...volo, components: { ...volo.components, Image: { image: offen.id } } });
    const fremd = (await repo.getEntity('c_geheim'))!;
    await repo.putEntity({ ...fremd, components: { ...fremd.components, Image: { image: geheim.id } } });
    const zeilen = async (wer: string) =>
      ((await als(wer, 'GET', '/api/list?type=Creature&limit=50')).json() as { rows: { id: string; image?: string }[] }).rows;
    const mira = await zeilen('Mira');
    expect(mira.find((z) => z.id === 'c_offen')?.image).toBe(offen.id);
    expect(mira.find((z) => z.id === 'c_geheim')?.image).toBe(geheim.id);
    const sela = await zeilen('Sela');
    expect(sela.find((z) => z.id === 'c_offen')?.image).toBe(offen.id);
    expect(sela.some((z) => z.id === 'c_geheim')).toBe(false);
    /* Das Asset selbst steht mit sich als Bild in der Liste. */
    const assets = ((await als('Mira', 'GET', '/api/list?type=Asset&limit=50')).json() as { rows: { id: string; image?: string }[] }).rows;
    expect(assets.find((z) => z.id === offen.id)?.image).toBe(offen.id);
  });

  it('gives an open creature no preview when its image is hidden from the viewer', async () => {
    const { hoch, repo, als } = await aufbau();
    const geheim = (await hoch('Mira', { for: 'c_geheim' }, { name: 'f.png', type: 'image/png', data: await png(32, 30) })).json() as Hochgeladen;
    const volo = (await repo.getEntity('c_offen'))!;
    await repo.putEntity({ ...volo, components: { ...volo.components, Image: { image: geheim.id } } });
    const sela = ((await als('Sela', 'GET', '/api/list?type=Creature&limit=50')).json() as { rows: { id: string; image?: string }[] }).rows;
    expect(sela.find((z) => z.id === 'c_offen')).toBeDefined();
    expect(sela.find((z) => z.id === 'c_offen')?.image).toBeUndefined();
  });
});
