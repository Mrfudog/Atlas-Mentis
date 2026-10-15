/**
 * **Bilder verwalten** (T-119): Klasse, Verwendung, Ersetzen.
 *
 * Ein Bild ist ein Asset-Artikel (T-114). Wer es zeigt, hält seine Id —
 * in einem Feld mit `format: 'asset'` (`Image.image`, `Statblock.token`,
 * `Board.background`), in einem Kartenblatt (`Map.sheets[].image`) oder
 * über eine Kante. **Wo ein Bild verwendet wird, ist eine Rückfrage**, wie
 * jede Gegenrichtung (K): gespeichert wird nur der Verweis beim Verwender.
 */

import { ownFields, typeChain } from './entity.js';
import type { Entity, LinkTarget, Registry } from './types.js';

export const ASSET_TYPE = 'Asset';

/** Die Klassen eines Bildes, wie sie in der Zeile stehen (`Asset.kind`); `image` ohne Angabe. */
export function assetKind(e: Entity): string {
  const k = (e.components?.[ASSET_TYPE] as { kind?: unknown } | undefined)?.kind;
  return typeof k === 'string' && k ? k : 'image';
}

/** Ist dieser Artikel ein Bild (Art `Asset` oder ein Untertyp)? */
export function isAsset(registry: Pick<Registry, 'interfaces'>, e: Entity): boolean {
  return typeChain(registry, e.interfaces?.[0] ?? '').includes(ASSET_TYPE);
}

/**
 * **Welche Klasse ein Feld anbietet** (T-119): aus `target.where`, wenn es
 * nach `Asset.kind` fragt. Ein Vorschlag — die Maske zeigt diese Klasse
 * zuerst und die übrigen auf Wunsch.
 */
export function offeredAssetKind(target: LinkTarget | undefined): string | null {
  const w = target?.where;
  if (!w || w.component !== ASSET_TYPE || w.property !== 'kind') return null;
  return typeof w.value === 'string' && w.value ? w.value : null;
}

export interface AssetUse {
  /** Der Artikel, der das Bild zeigt. */
  id: string;
  /** Wo: `Karte.feld` (auch `Map.sheets`) oder die Kantenart. */
  via: string;
}

/**
 * **Wo jedes Bild verwendet wird** — einmal über den Bestand: je Asset die
 * Artikel, die seine Id in einer Karte halten (in jeder Tiefe, so zählen
 * die Kartenblätter mit) oder mit einer Kante auf es zeigen. Gesucht wird
 * nach dem **ganzen Wert**: eine Id in einem Satz ist ein Verweis
 * (`[[…]]`) und kein Bild. Ein Asset, das auf sich selbst zeigt, und
 * `variantOf` zwischen Fassungen eines Bildes zählen nicht — eine Fassung
 * zeigt das Bild nicht, sie stammt davon ab.
 *
 * Ungesiebt: wer fragt, siebt die Verwender danach selbst. Sonst verriete
 * „wird verwendet" einen Artikel, den man nicht sehen darf.
 */
export function assetUses(entities: Iterable<Entity>, assetIds: ReadonlySet<string>): Map<string, AssetUse[]> {
  const raus = new Map<string, AssetUse[]>();
  const merke = (asset: string, use: AssetUse): void => {
    const liste = raus.get(asset) ?? raus.set(asset, []).get(asset)!;
    if (!liste.some((u) => u.id === use.id && u.via === use.via)) liste.push(use);
  };
  const suche = (wert: unknown, e: Entity, via: string, tiefe: number): void => {
    if (typeof wert === 'string') {
      if (wert !== e.id && assetIds.has(wert)) merke(wert, { id: e.id, via });
    } else if (Array.isArray(wert)) {
      for (const w of wert) suche(w, e, via, tiefe + 1);
    } else if (wert && typeof wert === 'object' && tiefe < 6) {
      for (const w of Object.values(wert)) suche(w, e, via, tiefe + 1);
    }
  };
  for (const e of entities) {
    for (const [karte, felder] of Object.entries(e.components ?? {})) {
      if (!felder || typeof felder !== 'object') continue;
      for (const [k, w] of Object.entries(felder)) suche(w, e, `${karte}.${k}`, 0);
    }
    for (const r of e.relations ?? []) {
      if (r.type === 'variantOf' || r.type === 'inLayer' || r.to === e.id || !assetIds.has(r.to)) continue;
      merke(r.to, { id: e.id, via: r.type });
    }
  }
  return raus;
}

// ---------------------------------------------------------------- Metadaten (T-201)

/** Was man über eine Bilddatei wissen will, wie es am Asset steht. */
export interface AssetMeta {
  mime?: string;
  width?: number;
  height?: number;
  bytes?: number;
  /** `app`, `nas` oder `external` — eine Adresse hat keine Grösse, die wir kennen. */
  backend: string;
}

const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);

/**
 * **Die Masse eines Bildes** (T-201) — gelesen aus der Karte `Asset`, wo
 * sie beim Hochladen hineingeschrieben wurden. Die Datei ist die Quelle:
 * gespeichert wird, was sie sagt, und nicht bei jedem Lesen neu
 * gerechnet; das Seitenverhältnis dagegen ist eine Rechnung aus zwei
 * gespeicherten Zahlen (D8) und steht darum nirgends.
 */
export function assetMeta(e: Entity): AssetMeta {
  const a = (e.components?.[ASSET_TYPE] ?? {}) as Record<string, unknown>;
  const mime = typeof a['mime'] === 'string' && a['mime'] ? a['mime'] : undefined;
  const width = zahl(a['width']);
  const height = zahl(a['height']);
  const bytes = zahl(a['bytes']);
  return {
    ...(mime ? { mime } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(bytes ? { bytes } : {}),
    backend: typeof a['backend'] === 'string' && a['backend'] ? a['backend'] : 'app',
  };
}

const ggt = (a: number, b: number): number => (b ? ggt(b, a % b) : a);

/** Verhältnisse, unter denen man ein Bild kennt — „16:9" sagt mehr als „1.78:1". */
const BEKANNT: [number, number][] = [
  [1, 1], [4, 3], [3, 2], [16, 10], [16, 9], [21, 9], [2, 1], [5, 4], [3, 1],
];

/**
 * **Das Seitenverhältnis** (T-201): gekürzt, wenn es kurz aufgeht
 * (`1920×1080` → `16:9`), sonst das nächste bekannte innerhalb eines
 * Prozents, sonst auf zwei Stellen (`1.37:1`). Hochformat steht hochkant
 * da (`9:16`): es ist ein anderes Bild, und eine Karte im Hochformat sucht
 * man anders.
 */
export function aspectRatio(width: number | undefined, height: number | undefined): string | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const w = Math.round(width);
  const h = Math.round(height);
  const t = ggt(w, h);
  if (w / t <= 32 && h / t <= 32) return `${w / t}:${h / t}`;
  const quer = w >= h;
  const r = quer ? w / h : h / w;
  for (const [a, b] of BEKANNT) {
    if (Math.abs(a / b - r) / r <= 0.01) return quer ? `${a}:${b}` : `${b}:${a}`;
  }
  const kurz = (Math.round(r * 100) / 100).toString();
  return quer ? `${kurz}:1` : `1:${kurz}`;
}

/** Bytes für Menschen: `1.9 MB`, `640 KB`, `512 B`. */
export function formatBytes(bytes: number | undefined): string | null {
  if (!bytes || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Das Format aus dem Medientyp: `image/jpeg` → `JPEG`. */
export function imageFormat(mime: string | undefined): string | null {
  if (!mime) return null;
  const m = /^image\/(.+)$/i.exec(mime.trim());
  const f = (m?.[1] ?? mime).replace(/^x-/, '').replace(/\+xml$/, '');
  return f ? f.toUpperCase() : null;
}

/** Eine Zeile über die Datei: `3035×2223 px · 4:3 · 1.8 MB · JPEG` — was fehlt, fällt weg. */
export function describeAsset(m: Partial<AssetMeta>): string {
  const teile = [
    m.width && m.height ? `${m.width}×${m.height} px` : null,
    aspectRatio(m.width, m.height),
    formatBytes(m.bytes),
    imageFormat(m.mime),
  ].filter((x): x is string => !!x);
  return teile.join(' · ');
}

/**
 * **Masse aus dem Kopf einer Bilddatei** (T-201) — PNG, JPEG, WebP, GIF;
 * ohne Bibliothek, weil der Kopf reicht: so kann ein Nachtrag die Masse
 * eines Bildes lesen, von dem er nur die ersten Kilobyte holt (eine
 * Adresse, `backend: 'external'`). `null`, wenn der Kopf nichts Bekanntes
 * sagt oder abgeschnitten ist — lieber kein Wert als ein falscher.
 */
export function imageHeader(b: Uint8Array): { mime: string; width: number; height: number } | null {
  const u16 = (i: number) => (b[i]! << 8) | b[i + 1]!;
  const le16 = (i: number) => b[i]! | (b[i + 1]! << 8);
  const u32 = (i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
  const le24 = (i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  const ok = (w: number, h: number) => w > 0 && h > 0;
  // PNG: Signatur, dann IHDR mit Breite und Höhe.
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG' && ascii(12, 4) === 'IHDR') {
    const w = u32(16);
    const h = u32(20);
    return ok(w, h) ? { mime: 'image/png', width: w, height: h } : null;
  }
  // GIF: logischer Bildschirm.
  if (b.length >= 10 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) {
    const w = le16(6);
    const h = le16(8);
    return ok(w, h) ? { mime: 'image/gif', width: w, height: h } : null;
  }
  // WebP: RIFF-Behälter, darin VP8, VP8L oder VP8X.
  if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const art = ascii(12, 4);
    let w = 0;
    let h = 0;
    if (art === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      w = le16(26) & 0x3fff;
      h = le16(28) & 0x3fff;
    } else if (art === 'VP8L' && b[20] === 0x2f) {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      w = (bits & 0x3fff) + 1;
      h = ((bits >>> 14) & 0x3fff) + 1;
    } else if (art === 'VP8X') {
      w = le24(24) + 1;
      h = le24(27) + 1;
    }
    return ok(w, h) ? { mime: 'image/webp', width: w, height: h } : null;
  }
  // JPEG: die Abschnitte bis zum ersten SOF (ausser DHT, JPG, DAC).
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1]!;
      if (m === 0xff) {
        i += 1;
        continue;
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = u16(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        const h = u16(i + 5);
        const w = u16(i + 7);
        return ok(w, h) ? { mime: 'image/jpeg', width: w, height: h } : null;
      }
      if (len < 2) return null;
      i += 2 + len;
    }
  }
  return null;
}

// ---------------------------------------------------------------- Bild als Karte (T-201, T-202)

/** Feldgrössen, in denen Kartenbilder üblich gezeichnet werden — zuerst die häufigen. */
const RASTER_PX = [70, 100, 140, 50, 72, 128, 64, 200, 96, 120, 256, 60, 75, 80, 150, 160];

/**
 * **Ein Gitter, das die Auflösung nahelegt** (T-201): ein Vorschlag, den
 * die Leitung im Kartenzeichner nachzieht. Nennt der Name die Felder
 * („Crypt 30x20"), gilt das, wenn Breite und Höhe dazu passen; sonst die
 * erste übliche Feldgrösse, die in beiden Richtungen aufgeht, mit
 * mindestens acht Feldern je Seite. Geht nichts auf, bleibt die Karte
 * ohne Gitter — ein falsches Gitter ist schlimmer als keins.
 */
export function suggestGrid(width: number | undefined, height: number | undefined, name = ''): { gridShape: 'square'; gridSize: number } | null {
  if (!width || !height) return null;
  const n = /(\d{1,3})\s*[x×]\s*(\d{1,3})/i.exec(name);
  if (n) {
    const sx = width / Number(n[1]);
    const sy = height / Number(n[2]);
    if (sx >= 16 && Math.abs(sx - sy) <= 1) return { gridShape: 'square', gridSize: Math.round(sx) };
  }
  for (const px of RASTER_PX) {
    if (width % px === 0 && height % px === 0 && width / px >= 8 && height / px >= 8) return { gridShape: 'square', gridSize: px };
  }
  return null;
}

/**
 * **Eine Karte aus einem Bild** (T-201, T-202 tut dasselbe beim Wählen in
 * der Sitzung): Name und Felder eines neuen `Map`-Artikels, dessen Bild
 * das Asset ist. Mit Gitter (aus `suggestGrid`) ist es eine Kampfkarte,
 * ohne eine Gegend. Angelegt wird, wo angelegt wird — hier steht nur, was
 * hineingehört, damit beide Wege dieselbe Karte bauen.
 */
export function mapFromImage(asset: Entity, name?: string): { type: 'Map'; name: string; fields: Record<string, unknown> } {
  const meta = assetMeta(asset);
  const ident = (asset.components?.['Identity'] ?? {}) as { name?: unknown };
  const titel = (name ?? '').trim() || (asset.name ?? '').trim() || (typeof ident.name === 'string' ? ident.name.trim() : '') || 'Map';
  const gitter = suggestGrid(meta.width, meta.height, titel);
  const fields: Record<string, unknown> = { 'Image.image': asset.id };
  const alt = ((asset.components?.['Image'] ?? {}) as { alt?: unknown }).alt;
  if (typeof alt === 'string' && alt.trim()) fields['Image.alt'] = alt.trim();
  if (gitter) {
    fields['Map.gridShape'] = gitter.gridShape;
    fields['Map.gridSize'] = gitter.gridSize;
    fields['Map.kind'] = 'battle';
  }
  return { type: 'Map', name: titel, fields };
}

// ---------------------------------------------------------------- Adressen statt Assets (T-201)

export interface ImageAddress {
  /** Die Karte und das Feld (`Image.image`). */
  field: string;
  url: string;
}

/**
 * **Bilder, die nur als Adresse dastehen** (T-201): ein Feld mit
 * `format: 'asset'`, in dem statt einer Asset-Id eine `http(s)`-Adresse
 * steht — so legt der 5e.tools-Einleser die Karten der Abenteuer an.
 * Die Galerie zeigt nur Assets; ein solches Bild ist darum für sie nicht
 * da, bis ein Asset-Artikel (`backend: 'external'`) es führt.
 */
export function imageAddresses(registry: Pick<Registry, 'interfaces'>, e: Entity): ImageAddress[] {
  const raus: ImageAddress[] = [];
  for (const [karte, werte] of Object.entries(e.components ?? {})) {
    if (!werte || typeof werte !== 'object' || !registry.interfaces[karte]) continue;
    const felder = ownFields(registry, karte);
    for (const [k, w] of Object.entries(werte as Record<string, unknown>)) {
      if (felder[k]?.format !== 'asset' || typeof w !== 'string') continue;
      const url = w.trim();
      if (/^https?:\/\//i.test(url)) raus.push({ field: `${karte}.${k}`, url });
    }
  }
  return raus;
}
