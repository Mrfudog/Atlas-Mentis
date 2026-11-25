/**
 * **Bilder verwalten** (T-119): Klasse, Verwendung, Ersetzen.
 *
 * Ein Bild ist ein Asset-Artikel (T-114). Wer es zeigt, hält seine Id —
 * in einem Feld mit `format: 'asset'` (`Image.image`, `Statblock.token`,
 * `Board.background`), in einem Kartenblatt (`Map.sheets[].image`) oder
 * über eine Kante. **Wo ein Bild verwendet wird, ist eine Rückfrage**, wie
 * jede Gegenrichtung (K): gespeichert wird nur der Verweis beim Verwender.
 */

import { ownFields, primaryInterface, typeChain } from './entity.js';
import { resolveInstance } from './instance.js';
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

/**
 * **Die Version einer Bilddatei** (T-119, T-211): der Hash vor der Endung
 * von `Asset.ref`. Mit ihr in der Adresse (`?v=`) darf der Browser das
 * Bild für immer behalten — ohne fragt er jedes Mal nach. `''`, wenn das
 * Asset keine Datei in der Ablage hat.
 */
export function assetVersion(e: Entity | undefined): string {
  const ref = (e?.components?.[ASSET_TYPE] as { ref?: unknown } | undefined)?.ref;
  return typeof ref === 'string' && ref && !/^https?:\/\//i.test(ref) ? (ref.split('.')[0] ?? '') : '';
}

/** Was ein Artikel als sein Bild zeigt, und woher es kommt. */
export interface ArticleImage {
  /** Asset-Id oder Adresse. */
  id: string;
  /** Der Statblock, von dem eine Kreatur ihr Bild hat (T-211) — fehlt, wenn es das eigene ist. */
  from?: string;
}

const bildIn = (e: Entity, feld: 'Image.image' | 'Statblock.token'): string => {
  const [karte, k] = feld.split('.') as [string, string];
  const w = (e.components?.[karte] as Record<string, unknown> | undefined)?.[k];
  return typeof w === 'string' ? w.trim() : '';
};

/**
 * **Das Bild eines Artikels** (T-114, T-211): an einem Asset das Asset
 * selbst, sonst `Image.image`. **Eine Kreatur ohne eigenes Bild zeigt das
 * ihres Statblocks** — sein `Image.image`, sonst seinen Token, beides auch
 * aus der Vorlage einer Instanz (`resolveInstance`). Gerechnet beim Lesen
 * (D8): gespeichert wird an der Kreatur nichts, und ein eigenes Bild
 * schlägt das geerbte. `statblocks` nennt die Statblöcke, die an ihr
 * hängen (`belongsTo` drüben) — die Gegenrichtung ist eine Abfrage, und
 * wer fragt, weiss, wie er sie am billigsten stellt.
 */
export function articleImage(
  registry: Pick<Registry, 'interfaces'>,
  e: Entity,
  entities: ReadonlyMap<string, Entity>,
  statblocks: (creatureId: string) => Entity[] = () => [],
): ArticleImage | null {
  const kette = typeChain(registry, primaryInterface(e));
  if (kette.includes(ASSET_TYPE) && typeof (e.components?.[ASSET_TYPE] as { ref?: unknown } | undefined)?.ref === 'string') return { id: e.id };
  const eigen = bildIn(e, 'Image.image');
  if (eigen) return { id: eigen };
  if (!kette.includes('Creature')) return null;
  for (const sb of statblocks(e.id)) {
    const gelesen = resolveInstance(entities, sb);
    const w = bildIn(gelesen, 'Image.image') || bildIn(gelesen, 'Statblock.token');
    if (w) return { id: w, from: sb.id };
  }
  return null;
}

/** Der Ausschnitt eines Tokens (T-297): Mitte in Prozent des Bildes, Zoom ab 1. */
export interface TokenFrame {
  x: number;
  y: number;
  zoom: number;
  /** Der Rand um ein ausgeschnittenes Bild (T-301): eine Id aus `TOKEN_RINGS` oder eines eigenen Randes (T-302); ohne oder unbekannt gilt `plain`. */
  ring?: string;
}

/**
 * **Die Ränder eines Tokens** (T-301): um ein Bild, das erst im Kreis zum
 * Token wird — ein fertiges Rundtoken bringt seinen Rand selbst mit.
 * `width` ist ein Bruchteil des Durchmessers, `paint` ein CSS-Hintergrund
 * (Farbe oder Verlauf). Eine Liste in Daten und keine Fallunterscheidung:
 * eigene Ränder (Bild, Farben) kommen später als weitere Einträge dazu,
 * und gespeichert wird nur die Id.
 */
export interface TokenRing {
  id: string;
  label: string;
  width: number;
  paint: string;
  /** Eigene Ränder (T-302): die Farbkombination, aus der `paint` gerechnet ist. */
  colors?: string[];
  /** Eigene Ränder (T-302): ein Rahmenbild — die Id eines Assets, gezeigt im Ring über `paint`. */
  image?: string;
}
export const TOKEN_RINGS: readonly TokenRing[] = [
  { id: 'plain', label: 'Plain', width: 0.035, paint: '#f7f1e3' },
  { id: 'none', label: 'None', width: 0, paint: 'transparent' },
  { id: 'gold', label: 'Gold', width: 0.07, paint: 'linear-gradient(135deg, #fff3b0, #d4a017 30%, #8a6212 55%, #f6e27a 80%, #b8860b)' },
  { id: 'silver', label: 'Silver', width: 0.07, paint: 'linear-gradient(135deg, #ffffff, #b8bec4 30%, #6d747b 55%, #e6e9ec 80%, #9aa1a8)' },
  { id: 'bronze', label: 'Bronze', width: 0.07, paint: 'linear-gradient(135deg, #f3c9a0, #b06a2c 30%, #6b3a14 55%, #e0a46c 80%, #8c4f1e)' },
  { id: 'crimson', label: 'Crimson', width: 0.06, paint: 'linear-gradient(135deg, #e4574a, #8c1c13 50%, #c23a2c)' },
  { id: 'emerald', label: 'Emerald', width: 0.06, paint: 'linear-gradient(135deg, #5fd09a, #146b45 50%, #2fa36d)' },
  { id: 'shadow', label: 'Shadow', width: 0.06, paint: 'linear-gradient(135deg, #5a5a5a, #111 50%, #3a3a3a)' },
];

/** Wie die Id eines Randes aussieht — eine feste oder eine Artikel-Id. Mehr geht nicht in eine CSS-Adresse. */
const RING_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
/** Nur Hex-Farben: der Wert geht als CSS in die Seite, und ein Wort wie `url(…)` holte etwas nach. */
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
/** Die Grenzen eines eigenen Randes: höchstens ein Fünftel des Durchmessers, höchstens acht Farben. */
export const TOKEN_RING_WIDTH_MAX = 0.2;
const RING_COLORS_MAX = 8;

/**
 * **Eine Farbkombination als Rand** (T-302): eine Farbe ist die Farbe,
 * mehrere ein Verlauf schräg über den Ring, gleichmässig verteilt — wie die
 * festen Metallränder, nur ohne deren Glanzstufen.
 */
export function ringPaint(colors: readonly string[]): string {
  if (colors.length === 0) return 'transparent';
  if (colors.length === 1) return colors[0]!;
  const stufe = (i: number) => `${Math.round((i / (colors.length - 1)) * 100)}%`;
  return `linear-gradient(135deg, ${colors.map((c, i) => `${c} ${stufe(i)}`).join(', ')})`;
}

/**
 * **Ein eigener Rand** (T-302) aus Daten, die jemand bearbeiten kann:
 * Farben nur als Hex, das Rahmenbild nur als Id, die Breite gekappt. Ohne
 * Farbe und ohne Bild ist es kein Rand; eine feste Id (`gold`) bleibt fest.
 * Woher die Liste kommt, entscheidet E-205 — die Form gilt so oder so.
 */
export function customRing(v: unknown): TokenRing | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const id = typeof o['id'] === 'string' ? o['id'] : '';
  if (!RING_ID.test(id) || TOKEN_RINGS.some((r) => r.id === id)) return null;
  const colors = (Array.isArray(o['colors']) ? o['colors'] : []).filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, RING_COLORS_MAX);
  const image = typeof o['image'] === 'string' && RING_ID.test(o['image']) ? o['image'] : undefined;
  if (colors.length === 0 && !image) return null;
  const label = typeof o['label'] === 'string' && o['label'].trim() ? o['label'].trim() : id;
  return {
    id,
    label,
    width: zwischen(o['width'], 0, TOKEN_RING_WIDTH_MAX, 0.06),
    ...(colors.length ? { colors } : {}),
    ...(image ? { image } : {}),
    paint: ringPaint(colors),
  };
}

/** Alle Ränder zur Wahl: die festen zuerst, dann die eigenen; eine Id zählt einmal. */
export function tokenRings(custom: readonly TokenRing[] = []): TokenRing[] {
  const alle = [...TOKEN_RINGS];
  for (const r of custom) if (!alle.some((a) => a.id === r.id)) alle.push(r);
  return alle;
}

/** Der Rand nach Id, auch unter den eigenen (T-302); unbekannt oder ohne heisst `plain`. */
export function tokenRing(id: string | undefined, custom: readonly TokenRing[] = []): TokenRing {
  return TOKEN_RINGS.find((r) => r.id === id) ?? custom.find((r) => r.id === id) ?? TOKEN_RINGS[0]!;
}

/** Wie ein Bild als Token gezeigt wird (T-297). */
export interface TokenLook {
  /** Ein fertiges Rundtoken: so zeigen, wie es ist — ohne eigenen Kreis. */
  round: boolean;
  frame: TokenFrame;
  width?: number;
  height?: number;
}

const zwischen = (v: unknown, min: number, max: number, sonst: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : sonst;

/** Die Grenzen des Zooms — darüber wird ein Token ein Pixelbrei. */
export const TOKEN_ZOOM_MAX = 4;

/** Ausschnitt mit Vorgaben und Grenzen: Mitte 50/50, Zoom 1. Unsinn fällt auf die Vorgabe. */
export function tokenFrame(v: unknown): TokenFrame {
  const f = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  /* Eine Id, die nicht in der festen Liste steht, bleibt (T-302): sie nennt einen eigenen Rand. */
  const ring = typeof f['ring'] === 'string' && RING_ID.test(f['ring']) ? f['ring'] : undefined;
  return { x: zwischen(f['x'], 0, 100, 50), y: zwischen(f['y'], 0, 100, 50), zoom: zwischen(f['zoom'], 1, TOKEN_ZOOM_MAX, 1), ...(ring ? { ring } : {}) };
}

/** Wie das Bild `asset` als Token gezeigt wird (T-297) — aus seiner Karte `Asset`. */
export function tokenLook(asset: Entity | undefined): TokenLook {
  const a = (asset?.components?.[ASSET_TYPE] ?? {}) as Record<string, unknown>;
  const zahl = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined);
  const w = zahl(a['width']);
  const h = zahl(a['height']);
  return { round: a['round'] === true, frame: tokenFrame(a['frame']), ...(w ? { width: w } : {}), ...(h ? { height: h } : {}) };
}

/**
 * **Wo das Bild im Kreis liegt** (T-297), in Bruchteilen des Kreises
 * (Durchmesser 1): so gross, dass es den Kreis deckt (wie `cover`), mal
 * Zoom, und so verschoben, dass der gewählte Punkt in der Mitte steht —
 * aber nie so weit, dass am Rand das Leere durchscheint. Ohne Masse gilt
 * ein Quadrat. Karte, Artikel und der Dialog rechnen damit dasselbe.
 */
export function tokenPlacement(look: Pick<TokenLook, 'frame' | 'width' | 'height'>): { left: number; top: number; width: number; height: number } {
  const w = look.width ?? 1;
  const h = look.height ?? 1;
  const s = look.frame.zoom / Math.min(w, h);
  const W = w * s;
  const H = h * s;
  const left = Math.min(0, Math.max(1 - W, 0.5 - (look.frame.x / 100) * W));
  const top = Math.min(0, Math.max(1 - H, 0.5 - (look.frame.y / 100) * H));
  return { left, top, width: W, height: H };
}

/**
 * **Ist das Bild ein fertiges Rundtoken?** (T-297) Gesucht wird der
 * deckende Bereich (ein kleines Wesen hat ein kleines Token mit viel
 * Durchsichtigem drumherum); in dessen Quadrat — von oben links, denn der
 * Schatten fällt nach unten rechts — müssen die Ecken durchsichtig sein
 * **und** ein Ring knapp innerhalb des Randes rundum deckend: der Rahmen,
 * den ein Token mitbringt. Die Ecken allein sagen es nicht: eine
 * freigestellte Figur hat sie auch, aber keinen geschlossenen Ring.
 */
export function looksRound(alphaAt: (x: number, y: number) => number, width: number, height: number): boolean {
  if (width < 16 || height < 16) return false;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alphaAt(x, y) < 200) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return false;
  const d = Math.min(x1 - x0 + 1, y1 - y0 + 1);
  if (d < 16) return false;
  const r = Math.max(1, Math.round(d * 0.06));
  const ecken = [
    [x0 + r, y0 + r],
    [x0 + d - 1 - r, y0 + r],
    [x0 + r, y0 + d - 1 - r],
  ] as const;
  if (!ecken.every(([x, y]) => alphaAt(x, y) < 16)) return false;
  /* 24 Punkte auf einem Kreis bei 90 % des Halbmessers: alle deckend. */
  const cx = x0 + (d - 1) / 2;
  const cy = y0 + (d - 1) / 2;
  const rr = (d / 2) * 0.9;
  for (let i = 0; i < 24; i++) {
    const w = (i / 24) * 2 * Math.PI;
    if (alphaAt(Math.round(cx + rr * Math.cos(w)), Math.round(cy + rr * Math.sin(w))) < 200) return false;
  }
  return true;
}

/** Die Statblöcke, die an dieser Kreatur hängen (`belongsTo` vom Statblock her). */
export function statblocksOf(entities: Iterable<Entity>, creatureId: string): Entity[] {
  const raus: Entity[] = [];
  for (const x of entities) if ((x.relations ?? []).some((r) => r.type === 'belongsTo' && r.to === creatureId)) raus.push(x);
  return raus;
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

/**
 * **Was ein Bild sein darf** (T-369) — dieselben Formate wie der Server
 * (`ASSET_MIMES`), als Medientypen *und* Endungen, weil ein Dateianbieter
 * den Medientyp nicht immer mitgibt.
 *
 * **Der Dateiwähler trägt kein `accept`.** Nennt es nur Bildtypen — ob
 * `image/*` oder einzeln —, öffnet Chrome auf Android die Fotoauswahl des
 * Systems, und Dateien (OneDrive …) sind nicht erreichbar; das war der
 * erste Versuch. Ohne `accept` kommt das Datei-Menü mit Kamera, Fotos und
 * Dateien, und geprüft wird nach der Wahl (`imageFileProblem`). Kein
 * HEIC: der Server liest es nicht, die Meldung sagt, was zu tun ist.
 */
export const IMAGE_FORMATS = [
  { mime: 'image/jpeg', ext: ['.jpg', '.jpeg'] },
  { mime: 'image/png', ext: ['.png'] },
  { mime: 'image/webp', ext: ['.webp'] },
  { mime: 'image/gif', ext: ['.gif'] },
  { mime: 'image/avif', ext: ['.avif'] },
] as const;

/**
 * Warum eine gewählte Datei nicht hochgeht, oder `null`. Gelesen wird
 * der Medientyp und, fehlt er, die Endung — eine Datei aus OneDrive kommt
 * manchmal mit leerem `type`. Die Meldung sagt, was zu tun ist.
 */
export function imageFileProblem(file: { name?: string; type?: string }): string | null {
  const mime = (file.type ?? '').trim().toLowerCase();
  const name = (file.name ?? '').trim().toLowerCase();
  const ext = /\.[a-z0-9]+$/.exec(name)?.[0] ?? '';
  if (IMAGE_FORMATS.some((f) => f.mime === mime || (!mime && (f.ext as readonly string[]).includes(ext)))) return null;
  if (/^image\/hei[cf]/.test(mime) || ext === '.heic' || ext === '.heif')
    return 'HEIC photos cannot be uploaded yet. Choose the photo from your photo library (it is converted to JPEG there) or save it as JPEG or PNG first.';
  return 'This file is not a supported image. Choose a JPEG, PNG, WebP, GIF or AVIF file.';
}
