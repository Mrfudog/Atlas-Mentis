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
import { assetUses, entityName, mapFromImage, primaryInterface, tagsOf, typeChain, type AssetUse, type Entity } from '@nw/model';
import type { Repository } from './repo.js';
import type { User } from './auth.js';
import { KeinBild, aufbereiten, mimeOf, thumbKey, validKey, versionOf, type AssetStore } from './assets.js';

const ASSET_TYPE = 'Asset';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
  stempel: string;
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
  /** Schreiben mit den Regeln von `PUT /api/entities/:id` (T-119: „Quelle ersetzen"). */
  schreiben: (request: FastifyRequest, entity: Entity) => Promise<{ code: number; body: unknown } | { konflikt: number | null }>;
  /** Darf dieses Konto den Artikel schreiben? (dieselbe Frage wie die Wache vor `PUT`) */
  darfSchreiben: (request: FastifyRequest, id: string) => Promise<boolean>;
  /** Darf dieses Konto anlegen? (dieselbe Frage wie die Wache vor `POST /api/entities`) */
  darfAnlegen: (request: FastifyRequest) => Promise<boolean>;
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

/** Ein hochgeladenes Formular: die Datei und die Textfelder davor. */
type Formular = { datei: Buffer; dateiname: string; felder: Record<string, string> } | { code: number; body: unknown };

async function formularLesen(request: FastifyRequest): Promise<Formular> {
  if (!request.isMultipart()) return { code: 400, body: { error: 'Erwartet: multipart/form-data mit einem Feld `file`.' } };
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
    if (code === 'FST_REQ_FILE_TOO_LARGE') return { code: 413, body: { error: 'Das Bild ist zu gross.', code: 'too_large' } };
    throw error;
  }
  if (!datei?.length) return { code: 400, body: { error: 'Kein Bild im Feld `file`.' } };
  return { datei, dateiname, felder };
}

export interface Bilder {
  aufraeumen: (e: Entity) => Promise<void>;
  /** Wo jedes Asset verwendet wird — ungesiebt, je Bestandsstempel einmal gerechnet (T-119). */
  verwendung: () => Promise<Map<string, AssetUse[]>>;
}

export function registerBilder(app: FastifyInstance, deps: BilderDeps): Bilder {
  const { repo, store, viewerOf, roh, sieve, geltend, anlegen, schreiben, darfSchreiben, darfAnlegen } = deps;

  const istAsset = async (e: Entity | undefined): Promise<boolean> =>
    !!e && typeChain(await repo.getRegistry(), primaryInterface(e)).includes(ASSET_TYPE);

  /* **Wo ein Bild verwendet wird** (T-119) — eine Rückfrage über den ganzen
     Bestand, darum je Stempel einmal. Gesiebt wird beim Fragenden. */
  let gezaehlt: { stempel: string; lauf: Promise<Map<string, AssetUse[]>> } | null = null;
  async function verwendung(): Promise<Map<string, AssetUse[]>> {
    const stand = await roh();
    if (gezaehlt?.stempel !== stand.stempel) {
      const lauf = (async () => {
        const registry = await repo.getRegistry();
        const ids = new Set(stand.alle.filter((e) => typeChain(registry, primaryInterface(e)).includes(ASSET_TYPE)).map((e) => e.id));
        return assetUses(stand.alle, ids);
      })();
      gezaehlt = { stempel: stand.stempel, lauf };
      lauf.catch(() => {
        if (gezaehlt?.lauf === lauf) gezaehlt = null;
      });
    }
    return gezaehlt.lauf;
  }

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
   * hochgeladen wird), `alt`, `kind`, `publication` und `anchor` (die
   * Herkunft, `Source`). Angenommen werden JPEG, PNG, WebP, GIF und
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
    const form = await formularLesen(request);
    if ('code' in form) return reply.code(form.code).send(form.body);
    const { datei, dateiname, felder } = form;

    const stand = await roh();
    const fuerId = (felder['for'] ?? '').trim();
    let fuer: Entity | undefined;
    if (fuerId) {
      const da = stand.map.get(fuerId);
      fuer = da ? (await sieve(request, [da], stand.map))[0] : undefined;
      if (!fuer) return reply.code(404).send({ error: 'Den Artikel gibt es nicht.' });
    }
    /* **Eine neue Fassung eines Bildes** (T-119, „Replace › as a new
       version"): ein eigenes Asset mit `variantOf` auf das alte. Beide
       bleiben; wer das alte zeigt, zeigt es weiter, bis man ihn umstellt.
       Die Fassung übernimmt, was man über das Bild schon gesagt hat —
       Klasse, Marken, Quelle, Sichtbarkeit, Ebene —, aber nicht die Datei. */
    const vonId = (felder['variantOf'] ?? '').trim();
    let von: Entity | undefined;
    if (vonId) {
      const da = stand.map.get(vonId);
      von = da && (await istAsset(da)) ? (await sieve(request, [da], stand.map))[0] : undefined;
      if (!von) return reply.code(404).send({ error: 'Das Bild gibt es nicht.' });
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
    const kind = (felder['kind'] ?? '').trim();
    if (kind) fields['Asset.kind'] = kind;
    const alt = (felder['alt'] ?? '').trim();
    if (alt) fields['Image.alt'] = alt;
    /* Woher das Bild stammt (T-144): ein Einleser nennt Buch und Pfad, damit
       ein zweiter Lauf es wiederfindet und man es zurückverfolgen kann. */
    const publication = (felder['publication'] ?? '').trim();
    if (publication) fields['Source.publication'] = publication;
    const anchor = (felder['anchor'] ?? '').trim();
    if (anchor) fields['Source.anchor'] = anchor;
    const relations: { type: string; to: string }[] = [];
    if (von) {
      const roh_ = stand.map.get(von.id)!;
      const k = roh_.components ?? {};
      const asset = (k['Asset'] ?? {}) as Record<string, unknown>;
      if (!kind && typeof asset['kind'] === 'string') fields['Asset.kind'] = asset['kind'];
      for (const karte of ['Visibility', 'Source', 'Image']) {
        for (const [f, w] of Object.entries((k[karte] ?? {}) as Record<string, unknown>)) {
          if (karte === 'Image' && f === 'image') continue;
          if (fields[`${karte}.${f}`] === undefined && w !== undefined && w !== null && w !== '') fields[`${karte}.${f}`] = w;
        }
      }
      const marken = tagsOf(roh_);
      if (marken.length) fields['Tags.tags'] = marken;
      const st = (k['Status'] as { status?: unknown } | undefined)?.status;
      fields['Status.status'] = typeof st === 'string' ? st : 'ready';
      for (const r of roh_.relations ?? []) if (r.type === 'inLayer') relations.push({ type: 'inLayer', to: r.to });
      relations.push({ type: 'variantOf', to: von.id });
    } else if (fuer) {
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
      (von ? `${entityName(von)} (new version)` : '') ||
      dateiname.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() ||
      (fuer ? `${fuer.name ?? 'Image'} (image)` : 'Image');

    const r = await anlegen(
      request,
      { type: ASSET_TYPE, name, fields, relations },
      fuerId ? { fuer: fuerId, zurueck: true } : von ? { zurueck: true } : {},
    );
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

  /**
   * **Quelle ersetzen** (T-119, `PUT /api/assets/:id/file`, multipart wie
   * das Hochladen): derselbe Artikel, eine neue Datei. Alle Verwender
   * zeigen sofort das neue Bild — sie halten die Id des Artikels, nicht die
   * Datei, und die Adresse trägt die Version (`?v=`), also lädt der Browser
   * neu. **Die alte Datei bleibt liegen**: abrufbar über ihre Ablage und in
   * der nächsten Sicherung; das Ereignis `asset.replaced` nennt sie.
   * Geschrieben wird mit den Regeln von `PUT` (`schreiben`), gegen die
   * Revision im Feld `revision` — wer ein Bild ersetzt, das sich seit dem
   * Lesen geändert hat, bekommt 409 wie überall.
   */
  app.put<{ Params: { id: string } }>('/api/assets/:id/file', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const stand = await roh();
    const da = stand.map.get(request.params.id);
    const [gesehen] = da && (await istAsset(da)) ? await sieve(request, [da], stand.map) : [];
    if (!da || !gesehen) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!(await darfSchreiben(request, da.id))) return reply.code(403).send({ error: 'Das gehört dir nicht.' });
    const form = await formularLesen(request);
    if ('code' in form) return reply.code(form.code).send(form.body);
    let bild;
    try {
      bild = await aufbereiten(form.datei);
    } catch (error) {
      if (error instanceof KeinBild) return reply.code(415).send({ error: error.message, code: 'not_an_image' });
      throw error;
    }
    const alt = infoVon(da);
    if (alt.ref === bild.ref) return reply.code(200).send({ ...da, url: assetUrl(da.id, bild.ref), thumb: assetUrl(da.id, bild.ref, true) });
    await store.put(bild.ref, bild.data);
    await store.put(bild.thumb, bild.thumbData);
    const rev = Number(form.felder['revision']);
    const neu: Entity = {
      ...da,
      ...(form.felder['revision'] !== undefined ? { revision: Number.isFinite(rev) ? rev : null } : {}),
      components: {
        ...(da.components ?? {}),
        [ASSET_TYPE]: {
          ...((da.components?.[ASSET_TYPE] ?? {}) as Record<string, unknown>),
          backend: 'app',
          ref: bild.ref,
          mime: bild.mime,
          width: bild.width,
          height: bild.height,
          bytes: bild.bytes,
        },
      },
    } as Entity;
    const r = await schreiben(request, neu);
    if ('konflikt' in r || r.code !== 200) {
      /* Die neue Datei nennt niemand — sie geht wieder. */
      await frei(bild.ref);
      if ('konflikt' in r) return reply.code(409).send({ error: 'Das Bild wurde seit dem Lesen anderswo geändert.', code: 'conflict' });
      return reply.code(r.code).send(r.body);
    }
    await repo.appendEvent('asset.replaced', da.id, { from: alt.ref ?? null, to: bild.ref, bytes: bild.bytes, by: user.id });
    const stored = r.body as Entity;
    return reply.code(200).send({ ...stored, url: assetUrl(da.id, bild.ref), thumb: assetUrl(da.id, bild.ref, true) });
  });

  /**
   * **Wo ein Bild verwendet wird** (T-119, `GET /api/assets/:id/uses`):
   * die Artikel, die es zeigen — **nur die, die dieser Betrachter sieht**.
   * „Wird noch an drei Orten gezeigt" verriete sonst drei Artikel, auch
   * ohne ihre Namen. Dazu die Fassungen (`variantOf`) in beide Richtungen.
   */
  app.get<{ Params: { id: string } }>('/api/assets/:id/uses', async (request, reply) => {
    const stand = await roh();
    const da = stand.map.get(request.params.id);
    const [gesehen] = da && (await istAsset(da)) ? await sieve(request, [da], stand.map) : [];
    if (!da || !gesehen) return reply.code(404).send({ error: 'Nicht gefunden' });
    const uses = (await verwendung()).get(da.id) ?? [];
    const kandidaten = new Map<string, Entity>();
    for (const u of uses) {
      const e = stand.map.get(u.id);
      if (e) kandidaten.set(e.id, e);
    }
    const varianten = stand.alle.filter((e) => e.id !== da.id && (e.relations ?? []).some((r) => r.type === 'variantOf' && r.to === da.id));
    for (const e of varianten) kandidaten.set(e.id, e);
    const original = (da.relations ?? []).find((r) => r.type === 'variantOf')?.to;
    if (original && stand.map.has(original)) kandidaten.set(original, stand.map.get(original)!);
    const sichtbar = new Map((await sieve(request, [...kandidaten.values()], stand.map)).map((e) => [e.id, e]));
    const zeile = (id: string) => {
      const e = sichtbar.get(id)!;
      return { id, name: entityName(e), type: primaryInterface(e) };
    };
    return {
      uses: uses.filter((u) => sichtbar.has(u.id)).map((u) => ({ ...zeile(u.id), via: u.via })),
      variants: varianten.filter((e) => sichtbar.has(e.id)).map((e) => zeile(e.id)),
      variantOf: original && sichtbar.has(original) ? zeile(original) : null,
    };
  });

  /**
   * **Ein Bild als Karte, Token oder Requisite verwenden** (T-201,
   * `POST /api/assets/:id/use`, `{ as, for? }`): setzt die Klasse des
   * Bildes — wenn man es schreibt; ein Bild aus einem geteilten Buch bleibt,
   * wie es ist — und legt an oder hängt an, was dazugehört:
   *
   * - `map`: ein neuer `Map`-Artikel mit dem Bild und einem Gitter aus der
   *   Auflösung (`mapFromImage`, dieselbe Rechnung wie beim Wählen in der
   *   Sitzung, T-202), angelegt mit den Regeln von `POST /api/entities`;
   * - `token`: das Token am Statblock der genannten Kreatur (`for`) —
   *   die Zahlen und das Token wohnen am Statblock; ohne `for` nur die Klasse;
   * - `prop`: nur die Klasse.
   *
   * Die Antwort nennt den Artikel, zu dem „Open" springt.
   */
  app.post<{ Params: { id: string }; Body: { as?: unknown; for?: unknown; name?: unknown } }>('/api/assets/:id/use', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const als = String(request.body?.as ?? '');
    if (!['map', 'token', 'prop'].includes(als)) return reply.code(400).send({ error: 'Erwartet: `as` ist map, token oder prop.' });
    const stand = await roh();
    const da = stand.map.get(request.params.id);
    const [gesehen] = da && (await istAsset(da)) ? await sieve(request, [da], stand.map) : [];
    if (!da || !gesehen) return reply.code(404).send({ error: 'Nicht gefunden' });

    if (als === 'map' && !(await darfAnlegen(request))) return reply.code(403).send({ error: 'Anlegen darfst du hier nicht.' });
    /* Das Ziel zuerst prüfen: wer ein Token an eine Kreatur ohne Statblock
       hängen will, soll nicht nebenbei die Klasse geändert haben. */
    let statblock: Entity | undefined;
    const fuerId = String(request.body?.for ?? '').trim();
    /* Ohne Kreatur ist ein Token nur eine Klasse — so klassifiziert eine Mehrfachauswahl. */
    if (als === 'token' && fuerId) {
      const fuerRoh = stand.map.get(fuerId);
      const [fuer] = fuerRoh ? await sieve(request, [fuerRoh], stand.map) : [];
      if (!fuer) return reply.code(404).send({ error: 'Die Kreatur gibt es nicht.' });
      const registry = await repo.getRegistry();
      statblock = typeChain(registry, primaryInterface(fuer)).includes('Statblock')
        ? fuerRoh
        : stand.alle.find(
            (e) => primaryInterface(e) === 'Statblock' && (e.relations ?? []).some((r) => r.type === 'belongsTo' && r.to === fuer.id),
          );
      if (!statblock) return reply.code(409).send({ error: 'Diese Kreatur hat noch keinen Statblock — das Token wohnt dort.', code: 'no_statblock' });
      if (!(await darfSchreiben(request, statblock.id))) return reply.code(403).send({ error: 'Den Statblock schreibst du nicht.' });
    }

    /* Die Klasse: nur, wenn sie sich ändert und man das Bild schreibt. */
    let klasse = false;
    const info = (da.components?.[ASSET_TYPE] ?? {}) as Record<string, unknown>;
    if ((info['kind'] ?? 'image') !== als && (await darfSchreiben(request, da.id))) {
      const r = await schreiben(request, {
        ...da,
        components: { ...(da.components ?? {}), [ASSET_TYPE]: { ...info, kind: als } },
      } as Entity);
      if ('konflikt' in r) return reply.code(409).send({ error: 'Das Bild wurde gerade anderswo geändert.', code: 'conflict' });
      if (r.code !== 200) return reply.code(r.code).send(r.body);
      klasse = true;
    }

    if (als === 'map') {
      const karte = mapFromImage(gesehen, typeof request.body?.name === 'string' ? request.body.name : undefined);
      const r = await anlegen(request, { ...karte, relations: [] }, {});
      if (r.code !== 201) return reply.code(r.code).send(r.body);
      const neu = r.body as Entity;
      return reply.code(201).send({ kind: klasse, open: { id: neu.id, name: entityName(neu), type: 'Map' } });
    }
    if (als === 'token' && statblock) {
      const karte = (statblock.components?.['Statblock'] ?? {}) as Record<string, unknown>;
      const r = await schreiben(request, {
        ...statblock,
        components: { ...(statblock.components ?? {}), Statblock: { ...karte, token: da.id } },
      } as Entity);
      if ('konflikt' in r) return reply.code(409).send({ error: 'Der Statblock wurde gerade anderswo geändert.', code: 'conflict' });
      if (r.code !== 200) return reply.code(r.code).send(r.body);
      const kreatur = (statblock.relations ?? []).find((x) => x.type === 'belongsTo')?.to ?? statblock.id;
      const ziel = stand.map.get(kreatur) ?? statblock;
      return reply.code(200).send({ kind: klasse, open: { id: ziel.id, name: entityName(ziel), type: primaryInterface(ziel) } });
    }
    return reply.code(200).send({ kind: klasse, open: null });
  });

  return {
    verwendung,
    /** Nach dem Löschen eines Asset-Artikels: die Datei geht, wenn kein anderer sie nennt. */
    aufraeumen: async (e: Entity) => {
      const info = infoVon(e);
      if ((info.backend ?? 'app') !== 'app' || !info.ref || !validKey(info.ref)) return;
      await frei(info.ref, e.id);
    },
  };
}
