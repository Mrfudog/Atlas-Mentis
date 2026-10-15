/**
 * **Der Bildplan** (T-144): welches Bild aus 5e.tools an welchen Artikel
 * gehört — gerechnet im selben Lauf wie die Artikel, also mit denselben
 * Peg-Ids, ohne Namen nachzuschlagen.
 *
 * Der Einleser legt **keine Bilder an** (E5 gilt für die Ausfuhrdatei
 * weiter): Bilder sind Dateien, und die gehen nicht durch eine JSON-Datei,
 * sondern über `POST /api/assets` in die Ablage — das macht
 * `scripts/bilder-5etools.mjs` mit diesem Plan und einem Checkout von
 * `5etools-img`. Hier steht nur, **was wohin gehört**:
 *
 *  - der **Token** einer Kreatur (`hasToken`, `token`, `tokenHref`) →
 *    `Statblock.token`, Klasse `token`;
 *  - die Bilder aus dem Begleittext (`…Fluff.images`) → das erste in
 *    `Image.image` des Artikels, wenn seine Art `Image` nimmt, die übrigen
 *    nur als Bild in seiner Ebene (Galerie), Klasse `image`;
 *  - die Karten der Abenteuer, die heute als Adresse dastehen
 *    (`BILD_ADRESSE`) → `Image.image` der `Map`, Klasse `map`.
 *
 * Bilder im Buchtext (Teile der Leseansicht) stehen noch nicht im Plan:
 * dafür muss ein Bild ein Teil zwischen zwei bestehenden werden — Folgeaufgabe.
 */

import type { Entity, Registry } from '@nw/model';
import { typeChain } from '@nw/model';
import { BILD_ADRESSE } from './arten/abenteuer.js';
import type { Knoten } from './copy.js';
import { loeseKopien } from './copy.js';
import type { Datenstand } from './lesen.js';

export type BildKlasse = 'token' | 'map' | 'image';

export interface BildEintrag {
  /** Pfad unter `5etools-img` (ohne `img/`), z. B. `bestiary/tokens/MM/Goblin.webp`. */
  pfad: string;
  klasse: BildKlasse;
  /** Der Artikel, der das Bild zeigt — von ihm erbt das Bild Ebene und Sichtbarkeit. */
  ziel: string;
  /** Wo es eingetragen wird (`Statblock.token`, `Image.image`); ohne: nur in die Galerie. */
  feld?: 'Statblock.token' | 'Image.image';
  /** Ein Wert, der ersetzt werden darf: die Adresse, die heute dasteht (Karten). */
  ersetzt?: string;
  name: string;
  alt?: string;
  /** Das Kürzel der 5e.tools-Quelle. */
  quelle: string;
}

export interface Bildplan {
  format: 'atlas-bilder/1';
  eintraege: BildEintrag[];
}

/** Was 5e.tools bei Token-Namen tut (`Parser.nameToTokenName`): ASCII, ohne Anführungszeichen. */
export function tokenName(name: string): string {
  return name
    .replace(/Æ/g, 'AE')
    .replace(/æ/g, 'ae')
    .replace(/Œ/g, 'OE')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/"/g, '');
}

/** Der Pfad eines internen Verweises (`{type: 'internal', path}`); extern und leer: nichts. */
function internerPfad(href: unknown): string | undefined {
  const h = href as Knoten | undefined;
  if (!h || h['type'] !== 'internal') return undefined;
  const p = String(h['path'] ?? '').replace(/^\/+/, '').replace(/^img\//, '');
  return p || undefined;
}

/**
 * Der Token-Pfad eines Monsters (oder Objekts, Fahrzeugs) wie
 * `Renderer.generic.getTokenUrl`: `token` vor `tokenHref` vor dem
 * gerechneten aus Quelle und Name — der aber nur mit `hasToken`.
 */
export function tokenPfad(e: Knoten, verzeichnis: string): string | undefined {
  const t = e['token'] as Knoten | undefined;
  if (t && t['name'] && t['source']) return `${verzeichnis}/${String(t['source'])}/${tokenName(String(t['name']))}.webp`;
  const href = internerPfad(e['tokenHref']);
  if (href) return href;
  if (!e['hasToken']) return undefined;
  return `${verzeichnis}/${String(e['source'])}/${tokenName(String(e['name']))}.webp`;
}

const TOKEN_VERZEICHNIS: Record<string, string> = { monster: 'bestiary/tokens', object: 'objects/tokens', vehicle: 'vehicles/tokens' };

/** Arten, deren Begleittext unter einer anderen steht: Varianten und Gruppen bei den Gegenständen, Unterarten bei den Völkern. */
const FLUFF_ART: Record<string, string> = { baseitem: 'item', magicvariant: 'item', itemGroup: 'item', subrace: 'race' };

const kl = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** Die Bilder eines Begleittexts, in ihrer Reihenfolge. */
function fluffBilder(f: Knoten | undefined): { pfad: string; titel?: string }[] {
  const raus: { pfad: string; titel?: string }[] = [];
  for (const b of Array.isArray(f?.['images']) ? (f!['images'] as Knoten[]) : []) {
    const pfad = internerPfad(b['href']);
    if (pfad) raus.push({ pfad, ...(b['title'] ? { titel: String(b['title']) } : {}) });
  }
  return raus;
}

/**
 * Rechnet den Plan. `angelegt` sind die Einträge, die in diesem Lauf einen
 * Artikel bekamen (5e.tools-Art, aufgelöster Eintrag, Artikel); `alle` der
 * ganze Bestand des Laufs (für die Karten).
 */
export function bildplan(
  registry: Registry,
  stand: Pick<Datenstand, 'arten'>,
  angelegt: readonly (readonly [string, Knoten, Entity])[],
  alle: readonly Entity[],
): Bildplan {
  const eintraege: BildEintrag[] = [];
  const nimmtBild = new Map<string, boolean>();
  const hatBild = (typ: string): boolean => {
    let ja = nimmtBild.get(typ);
    if (ja === undefined) nimmtBild.set(typ, (ja = typeChain(registry, typ).includes('Image')));
    return ja;
  };

  /* Die Begleittexte je Art, aufgelöst (sie stehen selbst als Kopien da). */
  const fluffe = new Map<string, Map<string, Knoten>>();
  const fluffVon = (art: string, e: Knoten): Knoten | undefined => {
    art = FLUFF_ART[art] ?? art;
    let m = fluffe.get(art);
    if (!m) {
      const roh = stand.arten.get(`${art}Fluff`) ?? [];
      const schl = (x: Knoten) => `${kl(x['name'])}|${kl(x['source'])}`;
      m = new Map(loeseKopien(roh, schl, () => undefined).map((f) => [schl(f), f]));
      fluffe.set(art, m);
    }
    return m.get(`${kl(e['name'])}|${kl(e['source'])}`);
  };

  const gesehen = new Set<string>();
  const merke = (b: BildEintrag): void => {
    const k = `${b.ziel}|${b.pfad}`;
    if (gesehen.has(k)) return;
    gesehen.add(k);
    eintraege.push(b);
  };

  for (const [art, e, ent] of angelegt) {
    const typ = ent.interfaces[0] ?? '';
    const quelle = String(e['source'] ?? '');
    const verzeichnis = TOKEN_VERZEICHNIS[art];
    if (verzeichnis && typ === 'Statblock') {
      const pfad = tokenPfad(e, verzeichnis);
      if (pfad) merke({ pfad, klasse: 'token', ziel: ent.id, feld: 'Statblock.token', name: `${ent.name} (token)`, alt: ent.name, quelle });
    }
    const bilder = fluffBilder(fluffVon(art, e));
    bilder.forEach((b, i) => {
      merke({
        pfad: b.pfad,
        klasse: 'image',
        ziel: ent.id,
        ...(i === 0 && hatBild(typ) ? { feld: 'Image.image' as const } : {}),
        name: b.titel || (bilder.length > 1 ? `${ent.name} (${i + 1})` : ent.name),
        alt: b.titel || ent.name,
        quelle,
      });
    });
  }

  /* Die Karten der Abenteuer: heute eine Adresse in `Image.image`. */
  for (const e of alle) {
    if (e.interfaces[0] !== 'Map') continue;
    const bild = (e.components['Image'] as { image?: unknown; alt?: unknown } | undefined) ?? {};
    const url = typeof bild.image === 'string' ? bild.image : '';
    if (!url.startsWith(BILD_ADRESSE)) continue;
    const pfad = url.slice(BILD_ADRESSE.length).split('/').map((s) => decodeURIComponent(s)).join('/');
    const quelle = String((e.components['Source'] as { publication?: unknown } | undefined)?.publication ?? pfad.split('/')[1] ?? '');
    merke({ pfad, klasse: 'map', ziel: e.id, feld: 'Image.image', ersetzt: url, name: e.name, alt: typeof bild.alt === 'string' ? bild.alt : e.name, quelle });
  }

  return { format: 'atlas-bilder/1', eintraege };
}

/** Zahlen zum Plan, für Bericht und Protokoll. */
export function planZahlen(plan: Bildplan): { dateien: number; eintraege: number; jeKlasse: Record<string, number>; verknuepft: number } {
  const jeKlasse: Record<string, number> = {};
  for (const b of plan.eintraege) jeKlasse[b.klasse] = (jeKlasse[b.klasse] ?? 0) + 1;
  return {
    dateien: new Set(plan.eintraege.map((b) => b.pfad)).size,
    eintraege: plan.eintraege.length,
    jeKlasse,
    verknuepft: plan.eintraege.filter((b) => b.feld).length,
  };
}
