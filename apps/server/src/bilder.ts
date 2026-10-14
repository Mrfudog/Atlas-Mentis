/**
 * **Bilder hochladen und ausliefern** (T-114, REQ-021).
 *
 * Ein Bild ist ein **Asset-Artikel** (`Asset`, Felder aus `AssetInfo`, gespeichert in der Karte `Asset`) und eine Datei
 * in der Ablage (`AssetStore`). Der Artikel trägt, was man über das Bild
 * wissen will — Name, Marken, Quelle, Sichtbarkeit —, die Datei nur die
 * Bytes. Wer ein Bild zeigt, nennt die Id des Artikels (`Image.image`),
 * nie eine Adresse: so lässt sich die Ablage wechseln (E-032), ohne einen
 * Artikel anzufassen.
 *
 * **Zurückgehalten wird am Server**, auch hier: eine Datei geht nur an
 * den, für den der Asset-Artikel sichtbar ist (`articleVisible` über das
 * Sieb). Wer ihn nicht sieht, bekommt 404, nicht 403 — sonst wüsste er,
 * dass es ihn gibt. Darum ist die Antwort auch `private`: ein Zwischenlager
 * dazwischen darf sie nicht an den Nächsten weitergeben.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { primaryInterface, typeChain, type Entity } from '@nw/model';
import type { Repository } from './repo.js';
import type { User } from './auth.js';
import { KeinBild, aufbereiten, mimeOf, thumbKey, validKey, versionOf, type AssetStore } from './assets.js';

const ASSET_TYPE = 'Asset';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface BilderDeps {
  repo: Repository;
  store: AssetStore;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  anlegen: (
    request: FastifyRequest,
    body: { type: string; name: string; fields: Record<string, unknown>; relations: { type: string; to: string }[] },
    optionen: { fuer?: string; zurueck?: boolean },
  ) => Promise<{ code: number; body: unknown }>;
}

interface AssetInfo {
  backend?: string;
  ref?: string;
  mime?: string;
}

const infoVon = (e: Entity): AssetInfo => (e.components?.['Asset'] ?? {}) as AssetInfo;

/** Die Adresse, unter der der Browser ein Asset holt — mit Version, also für immer gültig. */
export function assetUrl(id: string, ref: string, thumb = false): string {
  return `/api/assets/${encodeURIComponent(id)}?v=${versionOf(ref)}${thumb ? '&size=thumb' : ''}`;
}

export function registerBilder(app: FastifyInstance, deps: BilderDeps): { aufraeumen: (e: Entity) => Promise<void> } {
  const { repo, store, viewerOf, roh, sieve, geltend, anlegen } = deps;

  /** Liegt die Datei unter `ref` noch an einem anderen Asset? Sonst geht sie. */
  async function frei(ref: string, ausser?: string): Promise<void> {
    const genutzt = (await repo.listEntities()).some((e) => e.id !== ausser && infoVon(e).ref === ref);
    if (genutzt) return;
    await store.delete(ref);
    await store.delete(thumbKey(ref));
  }

  /**
   * **Hochladen** (`POST /api/assets`, multipart): ein Feld `file` und
   * davor wahlweise `name`, `for` (der Artikel, aus dem heraus
   * hochgeladen wird), `alt`. Angenommen werden JPEG, PNG, WebP, GIF und
   * AVIF, geprüft am Inhalt; die Grösse begrenzt `ASSET_MAX_MB`.
   *
   * **Aus einem Artikel heraus übernimmt das Bild dessen Sichtbarkeit**
   * (`audience`, `revealedTo`, `hiddenFrom`) und Stand: das Bild eines
   * verborgenen NSC ist nicht öffentlich, und das eines Entwurfs ist auch
   * einer. Angelegt wird mit den Regeln von `POST /api/entities` — wer
   * dort nicht anlegt, lädt hier nichts hoch.
   */
  app.post('/api/assets', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    if (!request.isMultipart()) return reply.code(400).send({ error: 'Erwartet: multipart/form-data mit einem Feld `file`.' });
    let datei: Buffer | null = null;
    let dateiname = '';
    const felder: Record<string, string> = {};
    try {
      for await (const teil of request.parts()) {
        if (teil.type === 'file') {
          if (teil.fieldname !== 'file' || datei) {
            await teil.toBuffer();
            continue;
          }
          datei = await teil.toBuffer();
          dateiname = teil.filename ?? '';
        } else if (typeof teil.value === 'string') {
          felder[teil.fieldname] = teil.value;
        }
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.code(413).send({ error: 'Das Bild ist zu gross.', code: 'too_large' });
      }
      throw error;
    }
    if (!datei?.length) return reply.code(400).send({ error: 'Kein Bild im Feld `file`.' });

    const stand = await roh();
    const fuerId = (felder['for'] ?? '').trim();
    let fuer: Entity | undefined;
    if (fuerId) {
      const da = stand.map.get(fuerId);
      fuer = da ? (await sieve(request, [da], stand.map))[0] : undefined;
      if (!fuer) return reply.code(404).send({ error: 'Den Artikel gibt es nicht.' });
    }

    let bild;
    try {
      bild = await aufbereiten(datei);
    } catch (error) {
      if (error instanceof KeinBild) return reply.code(415).send({ error: error.message, code: 'not_an_image' });
      throw error;
    }
    await store.put(bild.ref, bild.data);
    await store.put(bild.thumb, bild.thumbData);

    const fields: Record<string, unknown> = {
      'Asset.backend': 'app',
      'Asset.ref': bild.ref,
      'Asset.mime': bild.mime,
      'Asset.width': bild.width,
      'Asset.height': bild.height,
      'Asset.bytes': bild.bytes,
    };
    const alt = (felder['alt'] ?? '').trim();
    if (alt) fields['Image.alt'] = alt;
    const relations: { type: string; to: string }[] = [];
    if (fuer) {
      const sicht = (fuer.components?.['Visibility'] ?? {}) as Record<string, unknown>;
      for (const k of ['audience', 'revealedTo', 'hiddenFrom']) {
        const w = sicht[k];
        if (w !== undefined && !(Array.isArray(w) && !w.length)) fields[`Visibility.${k}`] = w;
      }
      /* Ohne Status-Karte zählt ein Artikel als fertig (D72) — sein Bild
         auch; sonst stünde es als `idea` neben einer Figur, die alle sehen.
         Ob man `ready` setzen darf, entscheidet `anlegen`. */
      const stand_ = (fuer.components?.['Status'] as { status?: unknown } | undefined)?.status;
      fields['Status.status'] = typeof stand_ === 'string' ? stand_ : 'ready';
      /* In die Ebene des Artikels, wenn man dort schreibt — sonst wählt `anlegen`. */
      for (const r of stand.map.get(fuer.id)?.relations ?? []) {
        if (r.type === 'inLayer') relations.push({ type: 'inLayer', to: r.to });
      }
    }
    const name =
      (felder['name'] ?? '').trim() ||
      dateiname.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() ||
      (fuer ? `${fuer.name ?? 'Image'} (image)` : 'Image');

    const r = await anlegen(request, { type: ASSET_TYPE, name, fields, relations }, fuerId ? { fuer: fuerId, zurueck: true } : {});
    if (r.code !== 201) {
      await frei(bild.ref);
      return reply.code(r.code).send(r.body);
    }
    const asset = r.body as Entity;
    await repo.appendEvent('asset.uploaded', asset.id, { ref: bild.ref, bytes: bild.bytes, by: user.id });
    return reply.code(201).send({ ...asset, url: assetUrl(asset.id, bild.ref), thumb: assetUrl(asset.id, bild.ref, true) });
  });

  /**
   * **Ausliefern** (`GET /api/assets/:id`, `?size=thumb` für die
   * Vorschau). Mit `?v=<version>` — dem Hash aus `ref` — darf der Browser
   * die Datei für immer behalten, denn unter diesem Schlüssel ändert sie
   * sich nie; ohne fragt er jedes Mal nach (`ETag`, meist 304).
   */
  app.get<{ Params: { id: string }; Querystring: { size?: string; v?: string } }>('/api/assets/:id', async (request, reply) => {
    const stand = await roh();
    const da = stand.map.get(request.params.id);
    const registry = await repo.getRegistry();
    if (!da || !typeChain(registry, primaryInterface(da)).includes(ASSET_TYPE)) {
      return reply.code(404).send({ error: 'Nicht gefunden' });
    }
    const e = await geltend(da, stand.map);
    const [gesehen] = await sieve(request, [e], stand.map);
    if (!gesehen) return reply.code(404).send({ error: 'Nicht gefunden' });
    /* Die Karte des Artikels, nicht der gesiebten Fassung: ob jemand das
       Bild sieht, entscheidet die Sichtbarkeit, nicht das Wissen um `ref`. */
    const info = infoVon(e);
    const ref = info.ref ?? '';
    void reply.header('X-Content-Type-Options', 'nosniff');
    if (info.backend === 'external') {
      if (!/^https?:\/\//i.test(ref)) return reply.code(404).send({ error: 'Keine Adresse' });
      return reply.header('Cache-Control', 'private, no-cache').redirect(ref, 302);
    }
    if (info.backend === 'nas') return reply.code(501).send({ error: 'Die Ablage „nas" gibt es noch nicht (E-032).' });
    if (!validKey(ref)) return reply.code(404).send({ error: 'Keine Datei' });

    const vorschau = request.query.size === 'thumb';
    let key = vorschau ? thumbKey(ref) : ref;
    let datei = await store.get(key);
    if (!datei && vorschau) {
      key = ref;
      datei = await store.get(key);
    }
    if (!datei) return reply.code(404).send({ error: 'Die Datei fehlt in der Ablage.' });
    const etag = `"${versionOf(ref)}${key === ref ? '' : '-t'}"`;
    const fest = request.query.v === versionOf(ref);
    void reply
      .header('ETag', etag)
      .header('Cache-Control', fest ? 'private, max-age=31536000, immutable' : 'private, no-cache')
      .header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    if (request.headers['if-none-match'] === etag) {
      datei.body.destroy();
      return reply.code(304).send();
    }
    return reply
      .type(key === ref ? (info.mime ?? mimeOf(ref)) : 'image/webp')
      .header('Content-Length', datei.bytes)
      .send(datei.body);
  });

  return {
    /** Nach dem Löschen eines Asset-Artikels: die Datei geht, wenn kein anderer sie nennt. */
    aufraeumen: async (e: Entity) => {
      const info = infoVon(e);
      if ((info.backend ?? 'app') !== 'app' || !info.ref || !validKey(info.ref)) return;
      await frei(info.ref, e.id);
    },
  };
}
