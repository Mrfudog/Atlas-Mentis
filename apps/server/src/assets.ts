/**
 * **Die Ablage der Bilder** (T-114, REQ-021, E-032).
 *
 * Wie `Repository` eine Schnittstelle: Routen sprechen mit `AssetStore`,
 * nie mit dem Dateisystem. Die erste Umsetzung ist eine Dateiablage in
 * einem Volume (`ASSET_DIR`, E-032 a); ein späterer Wechsel auf eine andere
 * Ablage heisst Dateien umkopieren und hier eine Klasse dazu — an den
 * Artikeln ändert sich nichts, denn sie zeigen auf die **Asset-Id**, nie
 * auf eine Adresse oder einen Schlüssel.
 *
 * **Der Schlüssel ist der Inhalt** (`<sha256>.<endung>`): dieselbe Datei
 * zweimal hochgeladen liegt einmal da, eine gespeicherte Datei ändert sich
 * nie, und darum darf der Browser sie für immer behalten, solange er nach
 * der Version fragt (`?v=`). Die Vorschau heisst `<sha256>.thumb.webp`.
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat, statfs, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';

export interface StoredAsset {
  body: Readable;
  bytes: number;
}

export interface AssetStore {
  /** Legt die Datei unter `key` ab; liegt sie schon da, bleibt sie. */
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<StoredAsset | null>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** Alle Schlüssel — für Zählung und Aufräumen, nicht für Routen. */
  keys(): Promise<string[]>;
  /** Wie viel liegt und wie viel noch frei ist (T-211) — `free`/`total`
   *  sind die des Datenträgers, `null`, wo die Ablage keinen kennt. */
  usage(): Promise<AssetUsage>;
}

export interface AssetUsage {
  files: number;
  bytes: number;
  free: number | null;
  total: number | null;
}

/* Nur so sieht ein Schlüssel aus. Ein `ref` steht in einem Artikel, den
   jemand bearbeiten kann; ohne diese Prüfung wäre `../../.env` ein Bild. */
const KEY = /^[a-f0-9]{64}(\.[a-z0-9]{2,5})?(\.thumb\.webp)?$/;

export function validKey(key: string): boolean {
  return KEY.test(key);
}

function pruefe(key: string): void {
  if (!validKey(key)) throw new Error(`Kein gültiger Ablageschlüssel: ${key}`);
}

/** Die Dateiablage in einem Verzeichnis (E-032 a, `backend: app`). */
export class FileAssetStore implements AssetStore {
  constructor(private readonly dir: string) {}

  /* Je zwei Zeichen ein Unterverzeichnis: zehntausend Dateien in einem
     Verzeichnis liest niemand gern, auch `ls` nicht. */
  private pfad(key: string): string {
    pruefe(key);
    return join(this.dir, key.slice(0, 2), key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const ziel = this.pfad(key);
    if (await this.has(key)) return;
    await mkdir(join(this.dir, key.slice(0, 2)), { recursive: true });
    /* Erst ganz schreiben, dann umbenennen: eine halbe Datei unter dem
       richtigen Namen gälte für immer als die richtige. */
    const tmp = `${ziel}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, ziel);
  }

  async get(key: string): Promise<StoredAsset | null> {
    if (!validKey(key)) return null;
    const p = this.pfad(key);
    try {
      const s = await stat(p);
      return { body: createReadStream(p), bytes: s.size };
    } catch {
      return null;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!validKey(key)) return false;
    try {
      await stat(this.pfad(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    if (!validKey(key)) return;
    await rm(this.pfad(key), { force: true });
  }

  async keys(): Promise<string[]> {
    const raus: string[] = [];
    let teile: string[];
    try {
      teile = await readdir(this.dir);
    } catch {
      return raus;
    }
    for (const t of teile) {
      if (!/^[a-f0-9]{2}$/.test(t)) continue;
      for (const f of await readdir(join(this.dir, t))) if (validKey(f)) raus.push(f);
    }
    return raus.sort();
  }

  /* Vor einem grossen Lauf (T-211) muss man wissen, ob er Platz hat — und
     von aussen sieht man den Datenträger der Umgebung nicht. */
  async usage(): Promise<AssetUsage> {
    let bytes = 0;
    const keys = await this.keys();
    for (const k of keys) bytes += (await stat(this.pfad(k))).size;
    let free: number | null = null;
    let total: number | null = null;
    try {
      const fs = await statfs(this.dir);
      free = fs.bavail * fs.bsize;
      total = fs.blocks * fs.bsize;
    } catch {
      /* kein Verzeichnis: dann gibt es auch nichts zu zählen */
    }
    return { files: keys.length, bytes, free, total };
  }

  /** Beim Start: das Verzeichnis gibt es und es ist schreibbar — sonst
   *  sagt der Server es jetzt und nicht beim ersten Hochladen. */
  async bereit(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const probe = join(this.dir, `.probe-${process.pid}`);
    await writeFile(probe, '');
    await rm(probe, { force: true });
  }
}

/** Für Tests: dieselbe Schnittstelle im Speicher. */
export class InMemoryAssetStore implements AssetStore {
  readonly files = new Map<string, Buffer>();

  async put(key: string, data: Buffer): Promise<void> {
    pruefe(key);
    if (!this.files.has(key)) this.files.set(key, Buffer.from(data));
  }

  async get(key: string): Promise<StoredAsset | null> {
    const d = this.files.get(key);
    return d ? { body: Readable.from([d]), bytes: d.length } : null;
  }

  async has(key: string): Promise<boolean> {
    return this.files.has(key);
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.files.keys()].sort();
  }

  async usage(): Promise<AssetUsage> {
    let bytes = 0;
    for (const d of this.files.values()) bytes += d.length;
    return { files: this.files.size, bytes, free: null, total: null };
  }
}

// ---------------------------------------------------------------- Bilder

/** Die Bildarten, die angenommen werden. **Kein SVG:** das ist ein
 *  Dokument mit Skripten, kein Bild, und es käme von derselben Adresse wie
 *  die Seite. */
const FORMATE: Record<string, { mime: string; ext: string }> = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' },
  gif: { mime: 'image/gif', ext: 'gif' },
  avif: { mime: 'image/avif', ext: 'avif' },
};

export const ASSET_MIMES = Object.values(FORMATE).map((f) => f.mime);

/** Die Kantenlänge der Vorschau: eine Listenzeile, eine Karte, ein Popup. */
export const THUMB_PX = 480;

export interface Aufbereitet {
  /** `<sha256>.<endung>` — der Schlüssel des Originals und `AssetInfo.ref`. */
  ref: string;
  thumb: string;
  data: Buffer;
  thumbData: Buffer;
  mime: string;
  width: number;
  height: number;
  bytes: number;
}

export class KeinBild extends Error {}

/**
 * Prüft, was hochgeladen wurde, am **Inhalt** und nicht an dem, was der
 * Browser darüber sagt, und bereitet es auf: Vorschau, Masse, Schlüssel.
 *
 * **Fotos verlieren ihre Metadaten.** Ein Bild vom Telefon trägt im EXIF,
 * wo es aufgenommen wurde — am Tisch hiesse das: bei der Leitung zu Hause.
 * Was EXIF trägt, wird gedreht, wie es aufgenommen wurde, und ohne neu
 * geschrieben; alles andere bleibt Byte für Byte, wie es kam.
 */
export async function aufbereiten(roh: Buffer): Promise<Aufbereitet> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(roh, { animated: true }).metadata();
  } catch {
    throw new KeinBild('Das ist kein Bild, das hier gelesen wird (JPEG, PNG, WebP, GIF, AVIF).');
  }
  const format = meta.format === 'heif' && meta.compression === 'av1' ? 'avif' : meta.format;
  const art = format ? FORMATE[format] : undefined;
  if (!art) {
    throw new KeinBild(`Diese Bildart wird nicht angenommen: ${meta.format ?? 'unbekannt'} (JPEG, PNG, WebP, GIF, AVIF).`);
  }
  let data = roh;
  if (meta.exif && format !== 'gif') {
    const neu = sharp(roh).rotate();
    data = await (format === 'jpeg' ? neu.jpeg({ quality: 92, mozjpeg: true }) : neu.toFormat(format as keyof sharp.FormatEnum)).toBuffer();
  }
  const fertig = await sharp(data).metadata();
  const width = fertig.width ?? 0;
  /* Ein GIF mit Bildern untereinander meldet die Höhe aller; gemeint ist eins. */
  const height = fertig.pageHeight ?? fertig.height ?? 0;
  const hash = createHash('sha256').update(data).digest('hex');
  const thumbData = await sharp(data)
    .rotate()
    .resize({ width: THUMB_PX, height: THUMB_PX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return {
    ref: `${hash}.${art.ext}`,
    thumb: thumbKey(`${hash}.${art.ext}`),
    data,
    thumbData,
    mime: art.mime,
    width,
    height,
    bytes: data.length,
  };
}

/** Der Schlüssel der Vorschau zu einem Original. */
export function thumbKey(ref: string): string {
  return `${ref}.thumb.webp`;
}

/** Der Hash im Schlüssel — die Version, nach der der Browser fragt. */
export function versionOf(ref: string): string {
  return ref.split('.')[0] ?? ref;
}

/** Medientyp nach Endung, für ein Asset, dessen Karte keinen nennt. */
export function mimeOf(ref: string): string {
  const ext = ref.split('.')[1] ?? '';
  return Object.values(FORMATE).find((f) => f.ext === ext)?.mime ?? 'application/octet-stream';
}
