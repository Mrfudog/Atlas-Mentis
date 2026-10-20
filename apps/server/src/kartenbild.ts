/**
 * **Das Kartenbild unter dem Nebel, am Server beschnitten** (T-312, E-041,
 * REQ-139).
 *
 * Bis T-312 ging das Kartenbild ganz hinaus und wurde im Browser zugedeckt
 * — wer die Entwicklerwerkzeuge öffnete, sah die Karte. Jetzt gilt für
 * Spielende an einer Karte mit Nebel, **bis alles aufgedeckt ist**
 * (`fullyRevealed`):
 *
 * - **Die Blätter zeigen auf eine eigene Adresse** (`kartenbildAdressen`,
 *   nach `redactMap` im Sieb): `Image.image` und `Map.sheets[].image`
 *   werden zu `/api/maps/:id/image?sheet=<blatt>&fog=<stand>`. Die Asset-Id
 *   geht nicht mehr hinaus.
 * - **Die Route liefert nur das Aufgedeckte** (`GET /api/maps/:id/image`):
 *   das Bild mit der Maske des Aufgedeckten (`revealMaskSvg`), der Rest
 *   durchsichtig — gerechnet aus den Formen, die *dieser* Betrachter sieht
 *   (`revealFor`, Nebel je Figur), also aus der gesiebten Karte.
 * - **Das Original bleibt zurück**: `/api/assets/:id` gibt es einem
 *   Spielenden nicht, solange es unter einem Nebel liegt, den er sieht
 *   (`zurueckgehalten`) — auch nicht als Vorschau.
 *
 * **Der Nebelstand ist ein Hash** aus Bildversion, Blatt und den sichtbaren
 * Formen. Spielende einer Gruppe teilen ihn (gleiche Formen, gleicher
 * Hash), also rechnet der Server ein Bild je Stand einmal
 * (Zwischenspeicher im Speicher, `MAP_CROP_CACHE_MB`), und der Browser darf
 * es behalten. Gebündelt wird beim Aufdecken selbst: die Karte speichert
 * einen Pinselstrich beim Loslassen, nicht je Bewegung — der Beamer lädt
 * ein neues Bild je Strich, nicht je Pixel.
 *
 * Ein Bild, das nur als Adresse woanders liegt (`https://…`), kann der
 * Server nicht beschneiden; es bleibt, wie es ist (docs/Karten.md).
 */

import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import {
  BASE_SHEET,
  GROUND_FLOOR,
  floorView,
  mapFloors,
  withFloorView,
  MAP_COMPONENT,
  assetVersion,
  fogOn,
  fullyRevealed,
  isMap,
  mapSheets,
  primaryInterface,
  revealMaskSvg,
  revealShapes,
  typeChain,
  type Entity,
} from '@nw/model';
import type { Repository } from './repo.js';
import { THUMB_PX, validKey, type AssetStore } from './assets.js';

const PREFIX = '/api/maps/';

/** Die Adresse eines beschnittenen Blattes — der Stand gehört dazu, sonst behielte der Browser den alten. */
export function kartenbildAdresse(mapId: string, sheet: string, fog: string): string {
  return `${PREFIX}${encodeURIComponent(mapId)}/image?sheet=${encodeURIComponent(sheet)}&fog=${fog}`;
}

/** Ist dieser Wert eine solche Adresse (und keine Asset-Id)? */
export function istKartenbildAdresse(v: unknown): boolean {
  return typeof v === 'string' && v.startsWith(PREFIX);
}

/** Der Nebelstand eines Blattes: was sich ändert, wenn das Bild sich ändern muss. */
export function nebelStand(map: Entity, sheet: string, version: string): string {
  return createHash('sha256')
    .update(JSON.stringify([version, sheet, revealShapes(map)]))
    .digest('hex')
    .slice(0, 16);
}

/**
 * Tauscht an einer **gesiebten** Karte (nach `redactMap`, nie für die
 * Leitung) die Bilder der Blätter gegen beschnittene Adressen, solange
 * nicht alles aufgedeckt ist. Adressen nach aussen bleiben, wie sie sind.
 */
export function kartenbildAdressen(map: Entity, version: (assetId: string) => string): Entity {
  if (!isMap(map)) return map;
  /* **Je Ebene** (T-307): jede hat ihren Nebel und ihre Bilder. */
  let e = map;
  for (const f of mapFloors(map)) {
    const v = floorView(e, f.id);
    if (!fullyRevealed(v)) e = withFloorView(e, f.id, ebenenAdressen(v, f.id, version));
  }
  return e;
}

/** Der Schlüssel eines Blattes über alle Ebenen: an der ersten das Blatt, sonst `ebene~blatt`. */
export function blattSchluessel(floor: string, sheet: string): string {
  return floor === GROUND_FLOOR ? sheet : `${floor}~${sheet}`;
}

/** Ebene und Blatt aus dem Schlüssel. */
export function ausSchluessel(key: string): { floor: string; sheet: string } {
  const i = key.indexOf('~');
  return i < 0 ? { floor: GROUND_FLOOR, sheet: key } : { floor: key.slice(0, i), sheet: key.slice(i + 1) };
}

/** Alle Blätter aller Ebenen, mit Schlüssel und der Ebene, unter deren Nebel sie liegen. */
export function alleBlaetter(map: Entity): Array<{ key: string; image: string; view: Entity }> {
  return mapFloors(map).flatMap((f) => {
    const view = floorView(map, f.id);
    return mapSheets(view).map((s) => ({ key: blattSchluessel(f.id, s.id), image: s.image, view }));
  });
}

function ebenenAdressen(map: Entity, floor: string, version: (assetId: string) => string): Entity {
  const tausch = (blatt: string, wert: unknown): unknown => {
    const id = blattSchluessel(floor, blatt);
    return typeof wert === 'string' && wert.trim() && !/^https?:\/\//i.test(wert.trim())
      ? kartenbildAdresse(map.id, id, nebelStand(map, id, version(wert.trim())))
      : wert;
  };
  const components = { ...map.components };
  const bild = components['Image'] as Record<string, unknown> | undefined;
  if (bild && 'image' in bild) components['Image'] = { ...bild, image: tausch(BASE_SHEET, bild['image']) };
  const karte = components[MAP_COMPONENT] as Record<string, unknown> | undefined;
  if (karte && Array.isArray(karte['sheets'])) {
    const ids = mapSheets(map).slice(1).map((s) => s.id);
    components[MAP_COMPONENT] = {
      ...karte,
      sheets: (karte['sheets'] as unknown[]).map((s, i) =>
        s && typeof s === 'object' ? { ...(s as Record<string, unknown>), image: tausch(ids[i] ?? `sheet-${i + 1}`, (s as { image?: unknown }).image) } : s,
      ),
    };
  }
  return { ...map, components };
}

/** Trägt die Karte irgendwo eine beschnittene Adresse? Dann ist sie für diesen Betrachter unter Nebel. */
export function traegtBeschnitt(map: Entity): boolean {
  return alleBlaetter(map).some((b) => istKartenbildAdresse(b.image));
}

/**
 * **Das Bild mit der Maske** — durchsichtig, was nicht aufgedeckt ist. WebP
 * bis zur Grenze des Formats (16 383 px), darüber PNG.
 */
export async function beschneiden(data: Buffer, map: Entity, vorschau = false): Promise<{ data: Buffer; mime: string }> {
  const meta = await sharp(data).metadata();
  const w = meta.width ?? 0;
  const h = meta.pageHeight ?? meta.height ?? 0;
  if (!w || !h) throw new Error('Das Kartenbild hat keine Grösse.');
  const maske = Buffer.from(revealMaskSvg(revealShapes(map), w, h));
  let bild = sharp(data, { pages: 1 })
    .ensureAlpha()
    .composite([{ input: maske, blend: 'dest-in' }]);
  if (vorschau) {
    bild = sharp(await bild.png().toBuffer()).resize({ width: THUMB_PX, height: THUMB_PX, fit: 'inside', withoutEnlargement: true });
    return { data: await bild.webp({ quality: 80 }).toBuffer(), mime: 'image/webp' };
  }
  if (w > 16383 || h > 16383) return { data: await bild.png().toBuffer(), mime: 'image/png' };
  return { data: await bild.webp({ quality: 85, alphaQuality: 100 }).toBuffer(), mime: 'image/webp' };
}

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
  stempel: string;
}

export interface KartenbildDeps {
  repo: Repository;
  store: AssetStore;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  /** Höchstens so viele Bytes beschnittener Bilder im Speicher. */
  cacheBytes?: number;
}

export interface Kartenbild {
  /** Liegt dieses Asset für den Fragenden unter Nebel? Dann bekommt er die Datei nicht. */
  zurueckgehalten: (request: FastifyRequest, assetId: string) => Promise<boolean>;
}

export function registerKartenbild(app: FastifyInstance, deps: KartenbildDeps): Kartenbild {
  const { repo, store, roh, sieve, geltend } = deps;
  const grenze = deps.cacheBytes ?? Number(process.env['MAP_CROP_CACHE_MB'] ?? 256) * 1024 * 1024;

  /* Der Zwischenspeicher: je Datei, Blatt, Nebelstand und Grösse ein Bild,
     das älteste geht zuerst. Laufende Rechnungen teilen sich (`laeuft`) —
     sechs Spielende, die gleichzeitig die Karte öffnen, rechnen einmal. */
  const fertig = new Map<string, { data: Buffer; mime: string }>();
  let belegt = 0;
  const laeuft = new Map<string, Promise<{ data: Buffer; mime: string }>>();
  function merke(key: string, bild: { data: Buffer; mime: string }): void {
    if (bild.data.length > grenze) return;
    fertig.set(key, bild);
    belegt += bild.data.length;
    for (const [k, v] of fertig) {
      if (belegt <= grenze) break;
      fertig.delete(k);
      belegt -= v.data.length;
    }
  }

  /* Welche Assets an einer Karte unter Nebel liegen — ungesiebt, je
     Stempel einmal. Nur für diese fragt `zurueckgehalten` das Sieb. */
  let index: { stempel: string; lauf: Promise<Map<string, Entity[]>> } | null = null;
  async function unterNebel(): Promise<Map<string, Entity[]>> {
    const stand = await roh();
    if (index?.stempel !== stand.stempel) {
      const lauf = (async () => {
        const raus = new Map<string, Entity[]>();
        for (const e of stand.alle) {
          if (!isMap(e)) continue;
          const k = await geltend(e, stand.map);
          if (!fogOn(k)) continue;
          for (const s of alleBlaetter(k)) {
            if (!s.image || /^https?:\/\//i.test(s.image) || fullyRevealed(s.view)) continue;
            raus.set(s.image, [...(raus.get(s.image) ?? []), k]);
          }
        }
        return raus;
      })();
      index = { stempel: stand.stempel, lauf };
      lauf.catch(() => {
        if (index?.lauf === lauf) index = null;
      });
    }
    return index.lauf;
  }

  async function zurueckgehalten(request: FastifyRequest, assetId: string): Promise<boolean> {
    const karten = (await unterNebel()).get(assetId);
    if (!karten?.length) return false;
    const stand = await roh();
    return (await sieve(request, karten, stand.map)).some(traegtBeschnitt);
  }

  app.get<{ Params: { id: string }; Querystring: { sheet?: string; fog?: string; size?: string } }>(
    '/api/maps/:id/image',
    async (request, reply) => {
      const nichts = () => reply.code(404).send({ error: 'Nicht gefunden' });
      const stand = await roh();
      const da = stand.map.get(request.params.id);
      if (!da || !isMap(da)) return nichts();
      const karte = await geltend(da, stand.map);
      const [gesiebt] = await sieve(request, [karte], stand.map);
      if (!gesiebt) return nichts();
      const blatt = request.query.sheet || BASE_SHEET;
      /* Welches Blatt der Betrachter hat (ein Blatt der Leitung hat er
         nicht), und woher das Bild kommt — aus der ungesiebten Karte. */
      const hatBlatt = alleBlaetter(gesiebt).find((s) => s.key === blatt && s.image);
      const hat = hatBlatt ? { image: hatBlatt.image } : undefined;
      /* Der Nebel ist der der Ebene, auf der das Blatt liegt (T-307). */
      const ebeneGesiebt = hatBlatt?.view ?? gesiebt;
      const quelle = alleBlaetter(karte).find((s) => s.key === blatt)?.image ?? '';
      if (!hat || !quelle || /^https?:\/\//i.test(quelle)) return nichts();
      const asset = stand.map.get(quelle);
      const registry = await repo.getRegistry();
      if (!asset || !typeChain(registry, primaryInterface(asset)).includes('Asset')) return nichts();
      const [bildGesehen] = await sieve(request, [await geltend(asset, stand.map)], stand.map);
      if (!bildGesehen) return nichts();
      const ref = String((asset.components?.['Asset'] as { ref?: unknown } | undefined)?.ref ?? '');
      if (!validKey(ref)) return nichts();

      const version = assetVersion(asset);
      /* Für die Leitung, oder wenn alles aufgedeckt ist, bekommt der
         Betrachter keine beschnittene Adresse — fragt er trotzdem hier,
         bekommt er das ganze Bild (gerechnet ist da nichts). */
      const beschnitten = istKartenbildAdresse(hat.image);
      const stempel = beschnitten ? nebelStand(ebeneGesiebt, blatt, version) : 'full';
      const vorschau = request.query.size === 'thumb';
      const etag = `"${version}-${stempel}${vorschau ? '-t' : ''}"`;
      const fest = request.query.fog === stempel;
      void reply
        .header('ETag', etag)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', fest ? 'private, max-age=31536000, immutable' : 'private, no-cache')
        .header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      if (request.headers['if-none-match'] === etag) return reply.code(304).send();

      const key = `${ref}|${blatt}|${stempel}|${vorschau ? 't' : 'f'}`;
      let bild = fertig.get(key);
      if (!bild) {
        let lauf = laeuft.get(key);
        if (!lauf) {
          lauf = (async () => {
            const datei = await store.get(ref);
            if (!datei) throw new KeineDatei();
            const teile: Buffer[] = [];
            for await (const t of datei.body) teile.push(Buffer.from(t as Buffer));
            const daten = Buffer.concat(teile);
            if (beschnitten) return beschneiden(daten, ebeneGesiebt, vorschau);
            if (!vorschau) return { data: daten, mime: String((asset.components?.['Asset'] as { mime?: unknown } | undefined)?.mime ?? 'application/octet-stream') };
            const t = await sharp(daten, { pages: 1 }).resize({ width: THUMB_PX, height: THUMB_PX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
            return { data: t, mime: 'image/webp' };
          })();
          laeuft.set(key, lauf);
          void lauf.finally(() => laeuft.delete(key)).catch(() => undefined);
        }
        try {
          bild = await lauf;
        } catch (err) {
          if (err instanceof KeineDatei) return reply.code(404).send({ error: 'Die Datei fehlt in der Ablage.' });
          throw err;
        }
        if (!fertig.has(key)) merke(key, bild);
      }
      return reply.type(bild.mime).header('Content-Length', bild.data.length).send(bild.data);
    },
  );

  return { zurueckgehalten };
}

class KeineDatei extends Error {}
