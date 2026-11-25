/**
 * **Eine offene Stelle** (T-162): „two martial weapons of your choice",
 * „an artisan's tools", „one musical instrument". Ein Satz, der keinen
 * Gegenstand nennt, sondern eine Sorte davon — die Figur wählt, welchen.
 *
 * Gelesen wird der Satz, nicht ein Feld: Klassen und Hintergründe aus
 * 5e.tools tragen diese Stellen nur als Text (`one weapon martial of your
 * choice`), und eine von Hand angelegte Klasse schreibt sie, wie man sie
 * spricht. Beide Formen verstehen wir; was keine Sorte nennt („set of
 * weighted dice"), ist keine offene Stelle und bleibt Text.
 *
 * Was eine Stelle annimmt, steht hier und nirgends sonst — die Auswahl im
 * Assistenten fragt die Liste damit, und `startingBundle` prüft am Server
 * dieselbe Regel (`slotAccepts`), bevor ein Gegenstand ins Inventar kommt.
 */

import type { Entity } from './types.js';

export interface ItemSlot {
  /** Wie viele Stücke („two martial weapons" sind zwei). */
  count: number;
  /** Der Satz, wie er dasteht. */
  text: string;
  /** Die Art: `Weapon` (mit Kategorie) oder `Item` (mit Gegenstandstyp). */
  type: 'Weapon' | 'Item';
  /** `Weapon.category`. */
  category?: 'simple' | 'martial';
  /** `Item.itemType`, einer davon (`melee weapon`, `artisan tools`, `instrument` …). */
  itemTypes?: string[];
}

const ZAHL: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/* Die Sorten, die ein Satz nennen darf — beide Wortstellungen: die
   gesprochene („artisan's tools") und die des Importers („tool artisan"). */
const SORTEN: { re: RegExp; itemType: string }[] = [
  { re: /\bartisan'?s?\s+tools?\b|\btools?\s+artisan\b/, itemType: 'artisan tools' },
  { re: /\bmusical\s+instruments?\b|\binstruments?\s+musical\b/, itemType: 'instrument' },
  { re: /\bgaming\s+sets?\b|\bsets?\s+gaming\b/, itemType: 'gaming set' },
  { re: /\b(?:arcane|druidic|holy)\s+focus\b|\bspellcasting\s+focus\b|\bfocus\s+spellcasting\b/, itemType: 'spellcasting focus' },
];
const WAFFE = /\b(simple|martial)\s+(?:(melee|ranged)\s+)?weapons?\b|\bweapons?\s+(simple|martial)(?:\s+(melee|ranged))?\b/;

/** Klein, Verweise als ihr Text, `anyArtisansTool` als Wörter. */
function normal(text: string): string {
  return String(text ?? '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, id: string, anzeige?: string) => anzeige || id)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[’`]/g, "'");
}

/** Die Zahl vor der Sorte: das letzte Zahlwort davor, sonst eins. */
function zahlVor(text: string, bis: number): number {
  let n = 1;
  for (const m of text.slice(0, bis).matchAll(/\b(\d+|an?|one|two|three|four|five|six)\b/g)) {
    n = ZAHL[m[1]!] ?? Number(m[1]);
  }
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * **Die offene Stelle in einem Satz**, oder keine. Nennt der Satz mehrere
 * Gegenstandssorten („artisan's tools or a musical instrument"), nimmt die
 * Stelle jede davon.
 */
export function itemSlotIn(text: string): ItemSlot | undefined {
  const t = normal(text);
  const w = WAFFE.exec(t);
  if (w) {
    const category = (w[1] ?? w[3]) as 'simple' | 'martial';
    const reichweite = w[2] ?? w[4];
    return {
      count: zahlVor(t, w.index),
      text: String(text).trim(),
      type: 'Weapon',
      category,
      ...(reichweite ? { itemTypes: [`${reichweite} weapon`] } : {}),
    };
  }
  const treffer = SORTEN.map((s) => ({ s, m: s.re.exec(t) })).filter((x) => x.m);
  if (!treffer.length) return undefined;
  const erste = Math.min(...treffer.map((x) => x.m!.index));
  return {
    count: zahlVor(t, erste),
    text: String(text).trim(),
    type: 'Item',
    itemTypes: [...new Set(treffer.map((x) => x.s.itemType))],
  };
}

/** Ein gewöhnlicher Gegenstand: ohne Seltenheit oder `none`/`mundane`. */
function gewoehnlich(item: Entity): boolean {
  const r = String(item.components?.['Item']?.['rarity'] ?? '').toLowerCase();
  return !r || r === 'none' || r === 'mundane' || r === 'unknown';
}

/**
 * **Nimmt die Stelle diesen Gegenstand?** Die Art (eine Waffe trägt die
 * Karte `Weapon`), die Kategorie, der Gegenstandstyp — und gewöhnlich muss
 * er sein: „a martial weapon" ist keine +3-Axt.
 */
export function slotAccepts(slot: ItemSlot, item: Entity | undefined): boolean {
  if (!item || !gewoehnlich(item)) return false;
  if (slot.type === 'Weapon') {
    const w = item.components?.['Weapon'];
    if (!w) return false;
    if (slot.category && String(w['category'] ?? '').toLowerCase() !== slot.category) return false;
  }
  if (slot.itemTypes?.length) {
    const typ = String(item.components?.['Item']?.['itemType'] ?? '').toLowerCase();
    if (!slot.itemTypes.includes(typ)) return false;
  }
  return true;
}

/**
 * **Wie man die Liste danach fragt** (`GET /api/list`): die Art und die
 * Feldfilter, die eine Listenspalte dieser Art sind. Was die Liste nicht
 * filtern kann (Nahkampf oder Fernkampf an einer Waffe), prüft danach
 * `slotAccepts` am ganzen Artikel.
 */
export function slotQuery(slot: ItemSlot): { type: string; f: string[] } {
  if (slot.type === 'Weapon') return { type: 'Weapon', f: slot.category ? [`Weapon.category:${slot.category}`] : [] };
  return { type: 'Item', f: slot.itemTypes?.length ? [`Item.itemType:${slot.itemTypes.join('|')}`] : [] };
}
