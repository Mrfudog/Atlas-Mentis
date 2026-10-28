/**
 * **Gegenstands-Eigenschaften — „Enhancements"** (T-300, E-107): „+1 Weapon", „Silvered",
 * „Adamantine Armor" sind keine Gegenstände, die jemand trägt, sondern
 * Regeln, die an einen Gegenstand kommen. Die Figur bekommt also nicht
 * einen Artikel „+1 Dagger" (davon gäbe es tausende), sondern ein **Stück**
 * — eine Instanz von „Dagger" (`instanceOf`, wie jedes Stück im Inventar,
 * T-150) — mit einer Kante `enchantedWith` auf die Eigenschaft. Mehrere
 * sind erlaubt: ein versilberter +1-Dolch hat zwei.
 *
 * **Ein Enhancement ist ein Regelartikel** (T-324, E-163): eine Sorte des
 * Gegenstandsmerkmals (`ItemFeature`), wie die Waffeneigenschaft
 * (`ItemProperty`) die andere ist. Am Merkmal stehen `appliesTo`, die
 * Namensregel (`namePrefix`, `nameSuffix`) und der **Aufpreis**
 * (`priceAdd` in Kupfer, `priceMult` als Faktor auf den Grundpreis), am
 * Enhancement Seltenheit und Boni. Bis T-324 war es ein Gegenstand mit
 * `appliesTo`; Migration 162 hat die eingelesenen umgezogen, und was
 * davon noch als Gegenstand steht, liest sich wie vorher.
 *
 * **Gerechnet, nie gespeichert** (D8): Name, Preis, Seltenheit und Boni des
 * Stücks entstehen beim Lesen (`enhanceItem`) und gehen als `enchanted`
 * neben dem Artikel hinaus, wie `fromTemplate` — beim Schreiben fällt das
 * weg. Stünde der gerechnete Preis in der Karte, hielte `thinInstance` ihn
 * für eine Abweichung, und eine Korrektur am Dolch erreichte das Stück nie
 * mehr.
 *
 * **Warum „Enhancement" und nicht „Item property":** so heisst schon die
 * Sorte `ItemProperty` (Finesse, Heavy, D48); beide zusammen sind
 * „Item features". Ein Wort für zwei Sachen ist so schlecht wie zwei
 * Wörter für eine (docs/Begriffe.md).
 *
 * **Welcher Preis gilt, sagt die Kampagne** (`Campaign.itemPricing`):
 * `combined` rechnet Grundpreis und Aufpreise zusammen, `base` nimmt nur
 * den Grundpreis, `none` rechnet keinen.
 */

import { coinText } from './book.js';
import { tagsOf } from './entity.js';
import { resolveInstance, templateChain } from './instance.js';
import type { Entity, EntityId } from './types.js';

/** Stück → Eigenschaft. Mehrere je Stück, in der Reihenfolge der Kanten. */
export const ENCHANTED_RELATION = 'enchantedWith';

export const ITEM_PRICING = ['combined', 'base', 'none'] as const;
export type ItemPricing = (typeof ITEM_PRICING)[number];

/** Wer Eigenschaften anhängen darf (vorbereitet für das Handwerk, T-300 Punkt 4). */
export const ENHANCEMENTS_BY = ['gm', 'players'] as const;
export type EnhancementsBy = (typeof ENHANCEMENTS_BY)[number];

type Lookup = ReadonlyMap<EntityId, Entity>;
type Card = Record<string, unknown>;

const card = (e: Entity | undefined): Card => (e?.components?.['Item'] ?? {}) as Card;

/** Das Gegenstandsmerkmal (T-324, E-163): Art und ihre beiden Sorten. */
export const ITEM_FEATURE = 'ItemFeature';
export const ENHANCEMENT = 'Enhancement';

/**
 * **Die Werte eines Merkmals**, aus seinen Karten: `ItemFeature`
 * (woran, Namensteile, Aufpreis, Wirkung) und `Enhancement` (Seltenheit,
 * Boni). Ein Enhancement, das noch als Gegenstand steht (vor Migration
 * 161, T-324), trägt sie in `Item`; das gilt, bis es umgezogen ist.
 */
function merkmal(e: Entity | undefined): Card {
  const c = e?.components ?? {};
  return { ...(c['Item'] ?? {}), ...(c[ENHANCEMENT] ?? {}), ...(c[ITEM_FEATURE] ?? {}) } as Card;
}
const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** **Wie diese Kampagne Gegenstandspreise rechnet.** Ohne Angabe: kombiniert. */
export function itemPricingOf(campaign: Entity | null | undefined): ItemPricing {
  const roh = campaign?.components?.['Campaign']?.['itemPricing'];
  return (ITEM_PRICING as readonly string[]).includes(roh as string) ? (roh as ItemPricing) : 'combined';
}

/**
 * **Wer Eigenschaften anhängen darf.** Ohne Angabe nur die Leitung; ob
 * Spielende es beim Handwerk dürfen, entscheidet die Kampagne, sobald das
 * Handwerk es anbietet.
 */
export function enhancementsByOf(campaign: Entity | null | undefined): EnhancementsBy {
  const roh = campaign?.components?.['Campaign']?.['enhancementsBy'];
  return roh === 'players' ? 'players' : 'gm';
}

/**
 * **Ist das ein Enhancement?** Ein Artikel der Art `Enhancement` (T-324);
 * oder, vor Migration 162, ein Gegenstand mit `appliesTo`.
 */
export function isEnhancement(e: Entity | undefined): boolean {
  if (!e) return false;
  if ((e.interfaces ?? []).includes(ENHANCEMENT)) return true;
  const a = card(e)['appliesTo'];
  return Array.isArray(a) && a.length > 0;
}

/** Die Wirkungen, die `ItemFeature.mechanics` kennt (E-163). */
export const ITEM_MECHANICS = ['two-handed', 'versatile', 'light', 'finesse'] as const;

/**
 * **Was ein Merkmal am Bogen bewirkt** — aus seinen Daten
 * (`ItemFeature.mechanics`), nie aus seinem Namen (E-163): eine
 * Hausregel-Eigenschaft „Long Grip" darf zweihändig sein, ohne so zu
 * heissen, und „Versatile" auf Deutsch hiesse nicht mehr so.
 */
export function featureMechanics(feature: Entity | undefined): string[] {
  const m = merkmal(feature)['mechanics'];
  return Array.isArray(m) ? m.filter((x): x is string => typeof x === 'string' && x !== '') : [];
}

/**
 * **Die Eigenschaften eines Gegenstands, wie der Bogen sie braucht**
 * (T-324): die Wirkungen seiner `hasProperty`-Ziele, und der vielseitige
 * Würfel aus der Kante (`hasProperty.props.damage`, „Versatile 1d10" ist
 * die Sache dieses Gegenstands, nicht der Eigenschaft).
 */
export function itemFeaturesOf(
  item: Entity | undefined,
  lookup: (id: EntityId) => Entity | undefined,
): { mechanics: string[]; versatileDamage?: string } {
  const mechanics = new Set<string>();
  let versatileDamage: string | undefined;
  for (const r of item?.relations ?? []) {
    if (r.type !== 'hasProperty') continue;
    const m = featureMechanics(lookup(r.to));
    for (const x of m) mechanics.add(x);
    const d = text(r.props?.['damage']);
    if (d && m.includes('versatile')) versatileDamage = d;
  }
  return { mechanics: [...mechanics], ...(versatileDamage ? { versatileDamage } : {}) };
}

/**
 * Die Eigenschaften, die an diesem Stück hängen — eigene, sonst die seiner
 * Vorlage (ein Stück eines „Silvered Dagger", den die Leitung als Vorlage
 * angelegt hat, ist versilbert). Wie jede Kante nach Art (`resolveInstance`).
 */
export function enhancementsOf(entities: Lookup, item: Entity): Entity[] {
  return (resolveInstance(entities, item).relations ?? [])
    .filter((r) => r.type === ENCHANTED_RELATION)
    .map((r) => entities.get(r.to))
    .filter((e): e is Entity => !!e);
}

/**
 * Die Wörter, an denen eine Eigenschaft erkennt, ob sie passt: Art
 * (`weapon`, `armor`), Gegenstandsart (`melee weapon`), Rüstungsart,
 * Kategorie, Marken (`sword`, `dagger`) und der Name.
 */
function merkmale(base: Entity): { worte: Set<string>; paare: Map<string, Set<string>> } {
  const worte = new Set<string>();
  const paare = new Map<string, Set<string>>();
  const paar = (k: string, v: unknown) => {
    const s = text(v).toLowerCase();
    if (!s) return;
    paare.set(k, (paare.get(k) ?? new Set()).add(s));
  };
  for (const i of base.interfaces ?? []) worte.add(i.toLowerCase());
  const it = card(base);
  const art = text(it['itemType']).toLowerCase();
  if (art) {
    worte.add(art);
    paar('type', art);
    if (art.endsWith('weapon')) worte.add('weapon');
    if (art.endsWith('armor')) worte.add('armor');
  }
  const ar = (base.components?.['Armor'] ?? {}) as Card;
  if (text(ar['armorType'])) {
    worte.add(text(ar['armorType']).toLowerCase());
    paar('armorType', ar['armorType']);
    if (ar['armorType'] === 'shield') worte.add('shield');
    else worte.add('armor');
  }
  const wp = (base.components?.['Weapon'] ?? {}) as Card;
  if (text(wp['category'])) paar('weaponCategory', wp['category']);
  if (text(wp['damageType'])) paar('dmgType', wp['damageType']);
  for (const t of tagsOf(base)) worte.add(t.toLowerCase());
  for (const w of text(card(base)['name'] ?? base.components?.['Identity']?.['name'] ?? base.name).toLowerCase().split(/\W+/)) {
    if (w) worte.add(w);
  }
  return { worte, paare };
}

/**
 * **Passt die Eigenschaft an diesen Grundgegenstand?** `appliesTo` nennt
 * Wörter (`weapon`, `sword`, `melee weapon`) oder Paare (`weaponCategory:martial`);
 * eines genügt. Ein Paar, über das der Gegenstand nichts sagt, hält nicht
 * auf — unbekannt ist nicht „passt nicht", und sonst sperrte ein Feld, das
 * beim Einlesen fehlte, die Leitung aus. Ohne `appliesTo` passt sie überall.
 */
export function enhancementFits(property: Entity, base: Entity): boolean {
  const gilt = (merkmal(property)['appliesTo'] as unknown[] | undefined) ?? [];
  if (!Array.isArray(gilt) || !gilt.length) return true;
  const { worte, paare } = merkmale(base);
  return gilt.some((g) => {
    const s = text(g).toLowerCase().trim();
    if (!s) return false;
    const i = s.indexOf(':');
    if (i < 0) return worte.has(s);
    const k = s.slice(0, i);
    const v = s.slice(i + 1);
    const hat = [...paare.entries()].find(([pk]) => pk.toLowerCase() === k)?.[1];
    return !hat || hat.has(v) || hat.has(v.replace(/^\w+\s*/, ''));
  });
}

const SELTEN = ['none', 'common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'];

/** Was eine Eigenschaft am Preis tut. `undefined`: sie sagt es nicht. */
export function surchargeOf(property: Entity): { add: number; mult: number } | undefined {
  const it = merkmal(property);
  const add = zahl(it['priceAdd']);
  const mult = zahl(it['priceMult']);
  if (add !== undefined || mult !== undefined) return { add: add ?? 0, mult: mult ?? 1 };
  /* Vor Migration 162 (T-324): ein Gegenstand ohne eigene Angabe nimmt
     seinen Preis als Aufpreis. Ein `Enhancement` hat keinen Preis — die
     Migration hat ihn nach `priceAdd` gelegt. */
  const preis = zahl(card(property)['copperPrice']);
  return preis !== undefined ? { add: preis, mult: 1 } : undefined;
}

function aufpreisText(s: { add: number; mult: number }): string {
  const teile: string[] = [];
  if (s.mult !== 1) teile.push(`× ${s.mult}`);
  if (s.add) teile.push(`+ ${coinText(s.add)}`);
  return teile.join(' ') || '+ 0 gp';
}

/** Das Stück, wie es gerechnet wird. Nur gelesen, nie gespeichert. */
export interface EnhancedItem {
  /** Der gerechnete Name; ein eigener Name des Stücks geht vor. */
  name: string;
  /** Der Grundgegenstand (die nächste Vorlage), sonst das Stück selbst. */
  base: EntityId;
  baseName: string;
  /** Die angehängten Eigenschaften, mit Aufpreis und ob sie passen. */
  properties: { id: EntityId; name: string; surcharge?: string; fits: boolean }[];
  /** Der Preis nach `Campaign.itemPricing`, in Kupfer; fehlt bei `none` oder ohne Grundpreis. */
  price?: number;
  /** Woher der Preis kommt: „Dagger 2 gp + +1 Weapon + 1,000 gp". */
  priceNote: string;
  pricing: ItemPricing;
  rarity?: string;
  attunement?: boolean;
  bonusWeapon?: number;
  bonusAc?: number;
  bonusSpellAttack?: number;
  bonusSave?: number;
}

const BONI = ['bonusWeapon', 'bonusAc', 'bonusSpellAttack', 'bonusSave'] as const;

function nameVon(e: Entity): string {
  return text(e.components?.['Identity']?.['name']) || text(e.name) || e.id;
}

/**
 * **Das Stück mit seinen Eigenschaften** — `null`, wenn keine daran hängt.
 *
 * Name: Präfixe und Suffixe der Eigenschaften um den Namen des
 * Grundgegenstands, in der Reihenfolge der Kanten („+1 Silvered Dagger");
 * hat das Stück einen eigenen Namen bekommen, bleibt der. Preis
 * (`combined`): Grundpreis × alle Faktoren + alle Beträge. Sagt eine
 * Eigenschaft nichts zum Preis, gibt es keinen — ein +1-Dolch zum Preis
 * eines Dolchs wäre falsch, nicht ungefähr. Seltenheit: die höchste. Boni:
 * die Summe.
 */
export function enhanceItem(entities: Lookup, item: Entity, pricing: ItemPricing = 'combined'): EnhancedItem | null {
  const props = enhancementsOf(entities, item);
  if (!props.length) return null;
  const voll = resolveInstance(entities, item);
  /* Der Grundgegenstand ist die fernste Vorlage: ein Stück aus der Vorlage
     „Silvered Dagger" heisst nicht „Silvered Silvered Dagger". */
  const kette = templateChain(entities, item);
  const vorlage = kette.length ? kette[kette.length - 1]! : null;
  const basis = vorlage ? resolveInstance(entities, vorlage) : voll;
  const baseName = vorlage ? nameVon(vorlage) : nameVon(item);

  const eigener = text(item.components?.['Identity']?.['name']);
  let name: string;
  if (vorlage && eigener && eigener !== baseName) name = eigener;
  else {
    const vor = props.map((p) => text(merkmal(p)['namePrefix'])).join('');
    const nach = props.map((p) => text(merkmal(p)['nameSuffix'])).join('');
    name = vor || nach ? `${vor}${baseName}${nach}`.replace(/\s+/g, ' ').trim() : `${baseName} (${props.map(nameVon).join(', ')})`;
  }

  /* Ein eigener Preis am Stück geht vor; sonst der des Grundgegenstands. */
  const grund = zahl(card(item)['copperPrice']) ?? zahl(card(basis)['copperPrice']);
  const aufpreise = props.map((p) => surchargeOf(p));
  let price: number | undefined;
  let priceNote: string;
  if (pricing === 'none') priceNote = 'not calculated (campaign setting)';
  else if (grund === undefined) priceNote = `${baseName} has no price`;
  else if (pricing === 'base') {
    price = grund;
    priceNote = `base price of ${baseName} (campaign setting)`;
  } else {
    const fehlt = props.filter((_, i) => !aufpreise[i]);
    if (fehlt.length) priceNote = `no surcharge for ${fehlt.map(nameVon).join(', ')}`;
    else {
      const mult = aufpreise.reduce((m, s) => m * s!.mult, 1);
      const add = aufpreise.reduce((a, s) => a + s!.add, 0);
      price = Math.round(grund * mult + add);
      priceNote = [`${baseName} ${coinText(grund)}`, ...props.map((p, i) => `${nameVon(p)} ${aufpreisText(aufpreise[i]!)}`)].join(' · ');
    }
  }

  const raus: EnhancedItem = {
    name,
    base: vorlage?.id ?? item.id,
    baseName,
    properties: props.map((p, i) => ({
      id: p.id,
      name: nameVon(p),
      ...(aufpreise[i] ? { surcharge: aufpreisText(aufpreise[i]!) } : {}),
      fits: enhancementFits(p, basis),
    })),
    priceNote,
    pricing,
    ...(price !== undefined ? { price } : {}),
  };

  const karten = [card(voll), ...props.map(merkmal)];
  const stufen = karten.map((k) => text(k['rarity'])).filter((r) => SELTEN.includes(r));
  if (stufen.length) raus.rarity = stufen.reduce((a, b) => (SELTEN.indexOf(b) > SELTEN.indexOf(a) ? b : a));
  if (karten.some((k) => k['attunement'] === true)) raus.attunement = true;
  for (const b of BONI) {
    const werte = karten.map((k) => zahl(k[b])).filter((n): n is number => n !== undefined);
    if (werte.length) raus[b] = werte.reduce((a, n) => a + n, 0);
  }
  return raus;
}

/**
 * **Der Preis eines Stücks**, wie Laden und Inventar ihn brauchen: mit
 * Eigenschaften gerechnet, sonst der Listenpreis (auch der der Vorlage).
 */
export function piecePrice(entities: Lookup, item: Entity | undefined, pricing: ItemPricing = 'combined'): number | undefined {
  if (!item) return undefined;
  const e = enhanceItem(entities, item, pricing);
  if (e) return e.price;
  return zahl(card(resolveInstance(entities, item))['copperPrice']);
}

/** Was eine Eigenschaft an diesem Stück verweigert — oder `null`. */
export function enhancementRefusal(entities: Lookup, item: Entity, propertyId: EntityId): string | null {
  const p = entities.get(propertyId);
  if (!p) return 'unknown enhancement';
  if (!isEnhancement(p)) return `${nameVon(p)} is not an enhancement`;
  const kette = templateChain(entities, item);
  if (!kette.length) return 'only a piece (an instance of an item) takes enhancements';
  const vorlage = kette[kette.length - 1]!;
  if (!enhancementFits(p, resolveInstance(entities, vorlage))) {
    return `${nameVon(p)} applies to ${((merkmal(p)['appliesTo'] as string[]) ?? []).join(' or ')}, not to ${nameVon(vorlage)}`;
  }
  if ((item.relations ?? []).some((r) => r.type === ENCHANTED_RELATION && r.to === propertyId)) return `${nameVon(p)} is already on it`;
  return null;
}

/**
 * **Wie ein Stück ausgeliefert wird**: der gelesene Artikel (`readInstance`)
 * und daneben `enhanced`, wenn Enhancements daran hängen. Gerechnet wird am
 * gespeicherten Stück (`raw`), nicht am aufgelösten — sonst hielte die
 * Rechnung den Namen der Vorlage für einen eigenen.
 */
export function withEnhancement(entities: Lookup, read: Entity, raw: Entity, pricing: ItemPricing): Entity {
  if (!(raw.relations ?? []).some((r) => r.type === ENCHANTED_RELATION) && !(read.relations ?? []).some((r) => r.type === ENCHANTED_RELATION)) return read;
  const e = enhanceItem(entities, raw, pricing);
  return e ? { ...read, enhanced: e } : read;
}

/** Der Name eines Stücks, mit Enhancements gerechnet — für Namenslisten am Server. */
export function pieceName(entities: Lookup, item: Entity): string {
  return enhanceItem(entities, item)?.name ?? nameVon(item);
}
