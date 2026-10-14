/**
 * Bilder verwalten (T-119): Klasse, Marken, „unbenutzt", wo verwendet,
 * ersetzen als Fassung oder als Quelle.
 *
 * Geprüft wird, was am Tisch wehtäte: dass „wo verwendet" und „unbenutzt"
 * keinen verborgenen Artikel verraten, dass eine neue Fassung die
 * Verwender beim alten Bild lässt, dass „Quelle ersetzen" dieselbe Id
 * behält und die alte Datei nicht löscht, und dass nur ersetzt, wer den
 * Artikel schreibt.
 */

import { randomUUID } from 'node:crypto';



import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { InMemoryAssetStore } from '../src/assets.js';

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
type Hochgeladen = Entity & { url: string; thumb: string };
const ref = (e: Entity) => (e.components?.['Asset'] as { ref: string }).ref;

/** Ein Bild an einen Artikel hängen, wie die Maske es täte (`Image.image`). */
async function zeige(repo: InMemoryRepository, id: string, asset: string): Promise<void> {
  const e = (await repo.getEntity(id))!;
  await repo.putEntity({ ...e, components: { ...(e.components ?? {}), Image: { image: asset } } });
}

describe('classes and tags filter the gallery', () => {
  it('filters by class and by every chosen tag, and counts the tags', async () => {
    const { hoch, hole, als } = await aufbau();
    const karte = (await hoch('Mira', { kind: 'map', name: 'Küste' }, { name: 'k.png', type: 'image/png', data: await png(30, 30) })).json() as Hochgeladen;
    const token = (await hoch('Mira', { kind: 'token', name: 'Wache' }, { name: 't.png', type: 'image/png', data: await png(31, 31) })).json() as Hochgeladen;
    const bild = (await hoch('Mira', { name: 'Wappen' }, { name: 'w.png', type: 'image/png', data: await png(32, 32) })).json() as Hochgeladen;
    expect((karte.components?.['Asset'] as { kind: string }).kind).toBe('map');
    expect((bild.components?.['Asset'] as { kind: string }).kind).toBe('image');

    const nurKarten = (await hole('Mira', '/api/list?type=Asset&f=Asset.kind:map')).json() as { rows: { id: string }[]; facets: { fields: { ref: string; options: { value: string; count: number }[] }[] } };
    expect(nurKarten.rows.map((r) => r.id)).toEqual([karte.id]);
    /* Die Facette zählt ohne ihren eigenen Filter: alle drei Klassen stehen da. */
    expect(nurKarten.facets.fields.find((f) => f.ref === 'Asset.kind')?.options.map((o) => o.value).sort()).toEqual(['image', 'map', 'token']);

    for (const [a, tags] of [[token, ['wache', 'stadt']], [bild, ['stadt']]] as const) {
      const e = (await als('Mira', 'GET', `/api/entities/${a.id}`)).json() as Entity;
      const res = await als('Mira', 'PUT', `/api/entities/${a.id}`, { ...e, refs: undefined, components: { ...e.components, Tags: { tags } } });
      expect(res.statusCode).toBe(200);
    }
    const stadt = (await hole('Mira', '/api/list?type=Asset&tag=stadt')).json() as { rows: { id: string }[]; facets: { tags: { tag: string; count: number }[] } };
    expect(stadt.rows.map((r) => r.id).sort()).toEqual([token.id, bild.id].sort());
    expect(stadt.facets.tags).toEqual([{ tag: 'stadt', count: 2 }, { tag: 'wache', count: 1 }]);
    const beide = (await hole('Mira', '/api/list?type=Asset&tag=stadt,wache')).json() as { rows: { id: string }[] };
    expect(beide.rows.map((r) => r.id)).toEqual([token.id]);
  });

  it('refuses a class that is not in the list', async () => {
    const { hoch } = await aufbau();
    const res = await hoch('Mira', { kind: 'wallpaper' }, { name: 'x.png', type: 'image/png', data: await png(20, 20) });
    expect(res.statusCode).toBe(422);
  });
});

describe('where an image is used — only what the viewer may see', () => {
  it('lists the users the viewer sees, and "unused" counts only those', async () => {
    const { repo, hoch, hole } = await aufbau();
    /* Aus einem offenen Artikel heraus: fertig und in der Ebene der Runde. */
    const a = (await hoch('Mira', { name: 'Offenes Bild', for: 'c_offen' }, { name: 'a.png', type: 'image/png', data: await png(40, 40) })).json() as Hochgeladen;
    const b = (await hoch('Mira', { name: 'Leeres Bild', for: 'c_offen' }, { name: 'b.png', type: 'image/png', data: await png(41, 41) })).json() as Hochgeladen;
    await zeige(repo, 'c_geheim', a.id);

    const gm = (await hole('Mira', `/api/assets/${a.id}/uses`)).json() as { uses: { id: string; name: string; via: string }[] };
    expect(gm.uses).toEqual([{ id: 'c_geheim', name: 'Der Fremde', type: 'Creature', via: 'Image.image' }]);
    /* Die Spielerin sieht das Bild, aber nicht den NSC, der es trägt. */
    const sela = (await hole('Sela', `/api/assets/${a.id}/uses`)).json() as { uses: unknown[] };
    expect(sela.uses).toEqual([]);

    const unbenutzt = async (wer: string) =>
      ((await hole(wer, '/api/list?type=Asset&unused=1')).json() as { rows: { id: string }[] }).rows.map((r) => r.id).sort();
    expect(await unbenutzt('Mira')).toEqual([b.id]);
    expect(await unbenutzt('Sela')).toEqual([a.id, b.id].sort());

    await zeige(repo, 'c_offen', a.id);
    const jetzt = (await hole('Sela', `/api/assets/${a.id}/uses`)).json() as { uses: { id: string }[] };
    expect(jetzt.uses.map((u) => u.id)).toEqual(['c_offen']);
    expect(await unbenutzt('Sela')).toEqual([b.id]);
  });

  it('counts an image on a map sheet, deep in a list', async () => {
    const { repo, hoch, hole } = await aufbau();
    const a = (await hoch('Mira', { kind: 'map' }, { name: 'a.png', type: 'image/png', data: await png(40, 40) })).json() as Hochgeladen;
    await repo.putEntity({
      id: 'm_kueste',
      interfaces: ['Map'],
      name: 'Küste',
      components: { Identity: { name: 'Küste', id: 'map-0001', aliases: [] }, Map: { sheets: [{ id: 's1', name: 'Snow', image: a.id }] } },
      relations: [{ id: 'm~l', type: 'inLayer', to: 'ly_nebel', props: {} }],
    });
    const gm = (await hole('Mira', `/api/assets/${a.id}/uses`)).json() as { uses: { id: string; via: string }[] };
    expect(gm.uses).toEqual([expect.objectContaining({ id: 'm_kueste', via: 'Map.sheets' })]);
  });

  it('does not tell a player that a hidden image exists', async () => {
    const { hoch, hole } = await aufbau();
    const a = (await hoch('Mira', { for: 'c_geheim' }, { name: 'a.png', type: 'image/png', data: await png(40, 40) })).json() as Hochgeladen;
    expect((await hole('Sela', `/api/assets/${a.id}/uses`)).statusCode).toBe(404);
  });
});

describe('replacing an image', () => {
  it('as a new version: a second asset with variantOf, the users keep the old one', async () => {
    const { repo, hoch, hole, als } = await aufbau();
    const alt = (await hoch('Mira', { kind: 'token', name: 'Wache' }, { name: 'a.png', type: 'image/png', data: await png(40, 40) })).json() as Hochgeladen;
    const e = (await als('Mira', 'GET', `/api/entities/${alt.id}`)).json() as Entity;
    await als('Mira', 'PUT', `/api/entities/${alt.id}`, { ...e, refs: undefined, components: { ...e.components, Tags: { tags: ['stadt'] }, Source: { publication: 'Eigenes' } } });
    await zeige(repo, 'c_offen', alt.id);

    const res = await hoch('Mira', { variantOf: alt.id }, { name: 'b.png', type: 'image/png', data: await png(42, 42, { r: 1, g: 200, b: 9 }) });
    expect(res.statusCode).toBe(201);
    const neu = res.json() as Hochgeladen;
    expect(neu.id).not.toBe(alt.id);
    expect(neu.name).toBe('Wache (new version)');
    expect(neu.relations?.find((r) => r.type === 'variantOf')?.to).toBe(alt.id);
    expect(neu.components?.['Asset']).toMatchObject({ kind: 'token' });
    expect(neu.components?.['Tags']).toEqual({ tags: ['stadt'] });
    expect(neu.components?.['Source']).toMatchObject({ publication: 'Eigenes' });
    expect(ref(neu)).not.toBe(ref(alt));
    /* Die Verwender bleiben beim alten Bild. */
    expect(((await repo.getEntity('c_offen'))!.components?.['Image'] as { image: string }).image).toBe(alt.id);
    const uses = (await hole('Mira', `/api/assets/${alt.id}/uses`)).json() as { variants: { id: string }[] };
    expect(uses.variants.map((v) => v.id)).toEqual([neu.id]);
    const andersrum = (await hole('Mira', `/api/assets/${neu.id}/uses`)).json() as { variantOf: { id: string } | null };
    expect(andersrum.variantOf?.id).toBe(alt.id);
  });

  it('as the source: same article, new file, the old file stays', async () => {
    const { app, repo, store, hoch, hole } = await aufbau();
    const alt = (await hoch('Mira', { name: 'Küste' }, { name: 'a.png', type: 'image/png', data: await png(40, 40) })).json() as Hochgeladen;
    await zeige(repo, 'c_offen', alt.id);
    const vorher = (await repo.getEntity(alt.id))!;
    const f = formular({ revision: String(vorher.revision) }, { name: 'b.png', type: 'image/png', data: await png(64, 32, { r: 9, g: 9, b: 200 }) });
    const keks = (await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Mira', password: PASSWORT } })).cookies.find((c) => c.name === 'nw_session')!;
    const res = await app.inject({ method: 'PUT', url: `/api/assets/${alt.id}/file`, payload: f.payload, headers: { ...f.headers, cookie: `nw_session=${keks.value}` } });
    expect(res.statusCode).toBe(200);
    const neu = res.json() as Hochgeladen;
    expect(neu.id).toBe(alt.id);
    expect(neu.components?.['Asset']).toMatchObject({ width: 64, height: 32 });
    expect(ref(neu)).not.toBe(ref(alt));
    expect(neu.url).not.toBe(alt.url);
    /* Die alte Datei bleibt bis zur nächsten Sicherung liegen. */
    expect(await store.has(ref(alt))).toBe(true);
    expect((await hole('Mira', neu.url)).statusCode).toBe(200);
    /* Wer das Bild zeigt, zeigt jetzt das neue — er hält die Id, nicht die Datei. */
    expect(((await repo.getEntity('c_offen'))!.components?.['Image'] as { image: string }).image).toBe(alt.id);

    /* Ein zweites Ersetzen gegen die alte Revision: 409, und die Datei geht wieder. */
    const g = formular({ revision: String(vorher.revision) }, { name: 'c.png', type: 'image/png', data: await png(65, 33, { r: 9, g: 100, b: 2 }) });
    const vorKeys = (await store.keys()).length;
    const zwei = await app.inject({ method: 'PUT', url: `/api/assets/${alt.id}/file`, payload: g.payload, headers: { ...g.headers, cookie: `nw_session=${keks.value}` } });
    expect(zwei.statusCode).toBe(409);
    expect((await store.keys()).length).toBe(vorKeys);
  });

  it('lets only those replace who write the article', async () => {
    const { app, hoch } = await aufbau();
    const alt = (await hoch('Mira', { name: 'Küste', for: 'c_offen' }, { name: 'a.png', type: 'image/png', data: await png(40, 40) })).json() as Hochgeladen;
    const f = formular({}, { name: 'b.png', type: 'image/png', data: await png(64, 32) });
    const keks = (await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Sela', password: PASSWORT } })).cookies.find((c) => c.name === 'nw_session')!;
    const res = await app.inject({ method: 'PUT', url: `/api/assets/${alt.id}/file`, payload: f.payload, headers: { ...f.headers, cookie: `nw_session=${keks.value}` } });
    expect(res.statusCode).toBe(403);
  });
});
