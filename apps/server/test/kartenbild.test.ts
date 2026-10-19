/**
 * Das Kartenbild unter dem Nebel, am Server beschnitten (T-312, E-041).
 *
 * Geprüft wird, was am Tisch wehtäte: dass im beschnittenen Bild kein
 * Pixel aus dem Verdeckten steckt, dass das Original nicht an der Karte
 * vorbei zu holen ist, und dass das volle Bild erst kommt, wenn alles
 * aufgedeckt ist.
 */

import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { revealAll, revealMaskSvg, fullyRevealed, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { InMemoryAssetStore } from '../src/assets.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ebene: Entity = {
  id: 'ly_nebel',
  interfaces: ['Layer'],
  name: 'ly_nebel',
  components: { Identity: { name: 'ly_nebel', id: 'layer-0001', aliases: [] } },
  relations: [],
};
const runde: Entity = {
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
  relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
};

function formular(datei: Buffer) {
  const grenze = `----atlas${randomUUID()}`;
  const payload = Buffer.concat([
    Buffer.from(`--${grenze}\r\nContent-Disposition: form-data; name="name"\r\n\r\nGruft\r\n`),
    Buffer.from(`--${grenze}\r\nContent-Disposition: form-data; name="file"; filename="gruft.png"\r\nContent-Type: image/png\r\n\r\n`),
    datei,
    Buffer.from(`\r\n--${grenze}--\r\n`),
  ]);
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${grenze}` } };
}

async function aufbau() {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [ebene, runde],
  );
  const app = buildApp({ repo, assets: new InMemoryAssetStore() });
  for (const [name, role] of [['Mira', 'gm'], ['Sela', 'player']] as const) {
    await repo.putUser({ id: `u_${name.toLowerCase()}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles: { camp_nebel: role } });
  }
  const kekse = new Map<string, string>();
  const keks = async (name: string): Promise<string> => {
    if (!kekse.has(name)) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      kekse.set(name, `nw_session=${res.cookies.find((x) => x.name === 'nw_session')!.value}`);
    }
    return kekse.get(name)!;
  };
  const hole = async (name: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie: await keks(name) } });

  /* Ein Bild, links rot und rechts blau: was rechts liegt, ist das Geheimnis. */
  const bild = await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } } })
    .composite([{ input: { create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } } }, left: 0, top: 0 }])
    .png()
    .toBuffer();
  const f = formular(bild);
  const hoch = await app.inject({ method: 'POST', url: '/api/assets', payload: f.payload, headers: { ...f.headers, cookie: await keks('Mira') } });
  expect(hoch.statusCode).toBe(201);
  const asset = (hoch.json() as { id: string }).id;
  /* Am Tisch ist das Bild fertig — ein Entwurf ginge ohnehin nicht an Spielende. */
  const a = (await repo.getEntity(asset))!;
  await repo.putEntity({ ...a, components: { ...a.components, Status: { status: 'ready' } } });
  const karte: Entity = {
    id: 'map_gruft',
    interfaces: ['Map'],
    name: 'Gruft',
    components: {
      Identity: { name: 'Gruft', id: 'map-0001', aliases: [] },
      Image: { image: asset },
      Map: { fog: true, reveal: [{ id: 'r1', kind: 'rect', x: 0, y: 0, w: 0.5, h: 1 }] },
    },
    relations: [{ id: 'l1', type: 'inLayer', to: 'ly_nebel', props: {} }],
  };
  await repo.putEntity(karte);
  return { repo, app, hole, keks, asset, karte };
}

const bildVon = (e: Entity): string => String((e.components?.['Image'] as { image?: unknown }).image);

async function pixel(data: Buffer, x: number, y: number): Promise<number[]> {
  const { data: px, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!];
}

describe('the map image under the fog (T-312)', () => {
  it('gives players a cropped address and only the revealed pixels', async () => {
    const { app, hole, asset } = await aufbau();
    const gm = (await hole('Mira', '/api/entities/map_gruft')).json() as Entity;
    expect(bildVon(gm)).toBe(asset);

    const sp = (await hole('Sela', '/api/entities/map_gruft')).json() as Entity;
    const url = bildVon(sp);
    expect(url).toMatch(/^\/api\/maps\/map_gruft\/image\?sheet=__base&fog=[a-f0-9]{16}$/);
    expect(JSON.stringify(sp)).not.toContain(asset);

    const res = await hole('Sela', url);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
    const daten = res.rawPayload;
    const meta = await sharp(daten).metadata();
    expect([meta.width, meta.height]).toEqual([200, 100]);
    /* Links aufgedeckt: rot. Rechts verdeckt: kein Blau, durchsichtig. */
    const links = await pixel(daten, 20, 50);
    expect(links[0]).toBeGreaterThan(200);
    expect(links[3]).toBe(255);
    const { data: px, info } = await sharp(daten).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < info.height; y++) {
      for (let x = 110; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        expect(px[i + 3]).toBe(0);
      }
    }
    await app.close();
  });

  it('holds back the original asset from players while the fog is on', async () => {
    const { app, hole, asset } = await aufbau();
    expect((await hole('Mira', `/api/assets/${asset}`)).statusCode).toBe(200);
    expect((await hole('Sela', `/api/assets/${asset}`)).statusCode).toBe(404);
    expect((await hole('Sela', `/api/assets/${asset}?size=thumb`)).statusCode).toBe(404);
    await app.close();
  });

  it('changes the address when more is revealed, and sends the full image only when all is revealed', async () => {
    const { app, repo, hole, asset, karte } = await aufbau();
    const vorher = bildVon((await hole('Sela', '/api/entities/map_gruft')).json() as Entity);
    const mehr = { ...karte, components: { ...karte.components, Map: { fog: true, reveal: [{ id: 'r1', kind: 'rect', x: 0, y: 0, w: 0.7, h: 1 }] } } };
    await repo.putEntity({ ...mehr, revision: (await repo.getEntity('map_gruft'))!.revision });
    const nachher = bildVon((await hole('Sela', '/api/entities/map_gruft')).json() as Entity);
    expect(nachher).not.toBe(vorher);
    /* Der alte Stand ist nicht mehr fest: wer ihn fragt, bekommt den neuen, ohne ihn zu behalten. */
    expect((await hole('Sela', vorher)).headers['cache-control']).toContain('no-cache');

    const alles = revealAll(karte, 'all');
    await repo.putEntity({ ...alles, revision: (await repo.getEntity('map_gruft'))!.revision });
    expect(fullyRevealed(alles)).toBe(true);
    expect(bildVon((await hole('Sela', '/api/entities/map_gruft')).json() as Entity)).toBe(asset);
    expect((await hole('Sela', `/api/assets/${asset}`)).statusCode).toBe(200);
    await app.close();
  });

  it('refuses a cropped address written back as the image', async () => {
    const { app, hole, keks } = await aufbau();
    const sp = (await hole('Sela', '/api/entities/map_gruft')).json() as Entity;
    const res = await app.inject({
      method: 'PUT',
      url: '/api/entities/map_gruft',
      headers: { cookie: await keks('Mira') },
      payload: sp as object,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('the reveal mask (T-312)', () => {
  it('draws rect, circle with aspect, stroke and clipped polygon in pixels', () => {
    const svg = revealMaskSvg(
      [
        { id: 'a', kind: 'rect', x: 0, y: 0, w: 0.5, h: 1 },
        { id: 'b', kind: 'circle', x: 0.5, y: 0.5, r: 0.1, ar: 0.5 },
        { id: 'c', kind: 'path', pts: [[0.1, 0.1], [0.2, 0.2]], r: 0.02, ar: 0.5 },
        { id: 'd', kind: 'poly', pts: [[0, 0], [1, 0], [1, 1]], within: [[0, 0], [0.5, 0], [0.5, 0.5]] },
      ],
      200,
      100,
    );
    expect(svg).toContain('<rect x="0" y="0" width="100" height="100"/>');
    expect(svg).toContain('scale(200 200)');
    expect(svg).toContain('clip-path="url(#c3)"');
  });
});
