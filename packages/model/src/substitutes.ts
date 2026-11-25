/**
 * **Welches Stück passt zu welchem Bestandteil** (T-197): Materialien
 * werden erst beim Start eines Auftrags gewählt, und dabei darf ein Rezept
 * mehr annehmen als den einen Gegenstand, den es nennt.
 *
 * - Ein **Gegenstand** (`needs` → Item) nimmt Stücke dieses Gegenstands —
 *   gezählt nach dem Grundartikel (T-150), wie bisher.
 * - Eine **Materialgruppe** (`needs` → MaterialGroup) nimmt jedes Stück,
 *   dessen Eigenschaften passen: Materialart, Seltenheit, Marken, oder es
 *   steht beim Namen in der Gruppe.
 * - Eine **Ersatzregel** (`Substitution`), die die Kampagne spielt
 *   (`allowsSubstitution`), lässt Stücke anderer Materialarten einspringen
 *   — „Pflanzen statt Reagenzien" —, wahlweise in gleicher Seltenheit und
 *   mit mehr Stücken je Original (`ratio`).
 *
 * Gerechnet wird aus den Feldern der Artikel, nie aus einer Liste der
 * passenden Stücke: die stünde neben den Stücken und veraltete beim
 * nächsten Fund. Was nicht passt, sagt **warum** — wer am Tisch ein Stück
 * nicht wählen kann, will den Grund wissen und nicht raten.
 */

import { entityName } from './entity.js';
import type { Entity, EntityId } from './types.js';

export const MATERIAL_GROUP = 'MaterialGroup';
export const SUBSTITUTION = 'Substitution';
export const ALLOWS_SUBSTITUTION = 'allowsSubstitution';

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const klein = (v: unknown): string => text(v).toLowerCase();
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.map(klein).filter(Boolean) : []);

/**
 * Seltenheiten ohne Rang: „varies" und „unknown" sagen nicht, wie selten
 * etwas ist, und gelten darum weder als über noch als unter einer Grenze.
 * Die Reihenfolge der übrigen kommt aus dem Register (`Item.rarity`).
 */
const OHNE_RANG = new Set(['varies', 'unknown']);

/** Was an einem Stück zählt, gelesen aus seinem Grundartikel. */
export interface MaterialProfile {
  id: EntityId;
  name: string;
  materialType: string;
  rarity: string;
  tags: string[];
}

export function materialProfile(e: Entity): MaterialProfile {
  return {
    id: e.id,
    name: entityName(e),
    materialType: klein(e.components?.['Material']?.['materialType']),
    rarity: klein(e.components?.['Item']?.['rarity']),
    tags: liste(e.components?.['Tags']?.['tags']),
  };
}

/** Eine Materialgruppe, wie die Rechnung sie liest. */
export interface MaterialGroupSpec {
  materialTypes: string[];
  rarityMin: string;
  rarityMax: string;
  tags: string[];
  items: string[];
}

export function materialGroupOf(e: Entity): MaterialGroupSpec {
  const k = e.components?.[MATERIAL_GROUP] ?? {};
  return {
    materialTypes: liste(k['materialTypes']),
    rarityMin: klein(k['rarityMin']),
    rarityMax: klein(k['rarityMax']),
    tags: liste(k['tags']),
    items: liste(k['items']),
  };
}

export type SubstitutionRarity = 'same' | 'atLeast' | 'any';

/** Eine Ersatzregel, wie die Rechnung sie liest. */
export interface SubstitutionRule {
  id: EntityId;
  name: string;
  replaces: string[];
  with: string[];
  withTags: string[];
  rarity: SubstitutionRarity;
  ratio: number;
}

export function substitutionOf(e: Entity): SubstitutionRule {
  const k = e.components?.[SUBSTITUTION] ?? {};
  const r = k['rarity'];
  const ratio = Number(k['ratio']);
  return {
    id: e.id,
    name: entityName(e),
    replaces: liste(k['replaces']),
    with: liste(k['with']),
    withTags: liste(k['withTags']),
    rarity: r === 'atLeast' || r === 'any' ? r : 'same',
    ratio: Number.isFinite(ratio) && ratio >= 1 ? Math.trunc(ratio) : 1,
  };
}

/**
 * **Die Ersatzregeln einer Kampagne**: die Ziele ihrer Kanten
 * `allowsSubstitution`, die es gibt. Keine Kante, keine Ersatzregel — eine
 * Vorgabe gibt es hier nicht, denn ohne Regel gilt das Rezept.
 */
export function substitutionsOf(campaign: Entity | null | undefined, get: (id: EntityId) => Entity | undefined): SubstitutionRule[] {
  const raus: SubstitutionRule[] = [];
  for (const r of campaign?.relations ?? []) {
    if (r.type !== ALLOWS_SUBSTITUTION) continue;
    const e = get(r.to);
    if (e) raus.push(substitutionOf(e));
  }
  return raus;
}

/** Was eine Ersatzregel tut, in einem Satz — für „Rules & options" und die Materialwahl. */
export function substitutionText(s: SubstitutionRule): string {
  const fuer = s.replaces.length ? s.replaces.join(' or ') : 'nothing yet';
  const mit = [...s.with, ...s.withTags.map((t) => `anything tagged ${t}`)];
  const wie = mit.length ? mit.join(' or ') : 'nothing yet';
  const selten = s.rarity === 'same' ? ' of the same rarity' : s.rarity === 'atLeast' ? ' of the same rarity or rarer' : '';
  const menge = s.ratio > 1 ? `${s.ratio} pieces of ` : '';
  return `${menge}${wie}${selten} may stand in for one ${fuer}.`;
}

export interface FitContext {
  /** Die Seltenheiten in ihrer Reihenfolge (`Item.rarity` im Register). */
  rarities: readonly string[];
  /** Die Ersatzregeln der Kampagne (`substitutionsOf`). */
  substitutions: readonly SubstitutionRule[];
}

export type MaterialFit =
  | { ok: true; via?: { id: EntityId; name: string }; ratio: number }
  | { ok: false; reason: string };

function rang(rarities: readonly string[], r: string): number | null {
  if (!r || OHNE_RANG.has(r)) return null;
  const i = rarities.findIndex((x) => x.toLowerCase() === r);
  return i < 0 ? null : i;
}

/** Warum ein Stück die Seltenheitsgrenzen nicht hält, oder `null`. */
function seltenheitGrund(p: MaterialProfile, min: string, max: string, rarities: readonly string[]): string | null {
  if (!min && !max) return null;
  const ist = rang(rarities, p.rarity);
  const r = p.rarity || 'no rarity';
  if (ist === null) return `rarity ${r} cannot be compared`;
  const unten = min ? rang(rarities, min) : null;
  const oben = max ? rang(rarities, max) : null;
  if (unten !== null && ist < unten) return `rarity ${r}, below ${min}`;
  if (oben !== null && ist > oben) return `rarity ${r}, above ${max}`;
  return null;
}

/** Warum ein Stück nicht in die Gruppe passt, oder `null`. */
function gruppenGrund(g: MaterialGroupSpec, p: MaterialProfile, rarities: readonly string[]): string | null {
  if (g.items.includes(p.name.toLowerCase())) return null;
  const gruende: string[] = [];
  if (g.materialTypes.length && !g.materialTypes.includes(p.materialType)) {
    gruende.push(p.materialType ? `material type ${p.materialType}, not ${g.materialTypes.join(' or ')}` : `no material type (needs ${g.materialTypes.join(' or ')})`);
  }
  const s = seltenheitGrund(p, g.rarityMin, g.rarityMax, rarities);
  if (s) gruende.push(s);
  if (g.tags.length && !g.tags.some((t) => p.tags.includes(t))) gruende.push(`not tagged ${g.tags.join(' or ')}`);
  /* Eine Gruppe, die nichts einschränkt, nennt aber Gegenstände: dann nur diese. */
  if (!g.materialTypes.length && !g.rarityMin && !g.rarityMax && !g.tags.length && g.items.length) gruende.push('not one of the items listed');
  return gruende.length ? gruende.join('; ') : null;
}

/** Was eine Ersatzregel am Original prüft: seine Materialarten und seine Seltenheit (bzw. Untergrenze). */
interface Original {
  materialTypes: string[];
  rarity: string;
  /** Bei einer Gruppe: die Obergrenze, die auch ein Ersatz halten muss. */
  rarityMax: string;
}

function originalVon(target: Entity, gruppe: boolean): Original {
  if (gruppe) {
    const g = materialGroupOf(target);
    return { materialTypes: g.materialTypes, rarity: g.rarityMin, rarityMax: g.rarityMax };
  }
  const p = materialProfile(target);
  return { materialTypes: p.materialType ? [p.materialType] : [], rarity: p.rarity, rarityMax: '' };
}

/** Warum eine Ersatzregel dieses Stück nicht einspringen lässt, oder `null`. */
function ersatzGrund(s: SubstitutionRule, o: Original, p: MaterialProfile, rarities: readonly string[]): string | null {
  const art = s.with.includes(p.materialType) || s.withTags.some((t) => p.tags.includes(t));
  if (!art) return null;
  if (s.rarity === 'any' || !o.rarity) return seltenheitGrund(p, '', o.rarityMax, rarities);
  if (s.rarity === 'same') {
    if (p.rarity === o.rarity) return null;
    return `rarity ${p.rarity || 'none'}, needs ${o.rarity}`;
  }
  return seltenheitGrund(p, o.rarity, o.rarityMax, rarities);
}

/**
 * **Passt dieses Stück zu diesem Bestandteil?** `target` ist das Ziel der
 * `needs`-Kante (Gegenstand oder Materialgruppe), `piece` der Grundartikel
 * des Stücks (`baseArticle`). Zuerst das Rezept selbst, dann die
 * Ersatzregeln der Kampagne in ihrer Reihenfolge — die erste, die passt,
 * gilt. Passt nichts, steht der Grund da: zuerst, warum das Rezept es
 * nicht nimmt, dann, woran eine zutreffende Ersatzregel scheitert.
 */
export function materialFit(target: Entity, piece: Entity, ctx: FitContext, isGroup = target.interfaces?.includes(MATERIAL_GROUP) ?? false): MaterialFit {
  const p = materialProfile(piece);
  let grund: string;
  if (isGroup) {
    /* Von Hand in die Gruppe gelegt oder herausgenommen (`inCollection`, REQ-438):
       die einzelne Kante schlägt die Regel, wie überall bei Collections. */
    const hand = (piece.relations ?? []).find((r) => r.type === 'inCollection' && r.to === target.id);
    if (hand && hand.props?.['exclude'] !== true) return { ok: true, ratio: 1 };
    const g = hand ? `taken out of ${entityName(target) || 'the group'}` : gruppenGrund(materialGroupOf(target), p, ctx.rarities);
    if (!g) return { ok: true, ratio: 1 };
    grund = g;
  } else {
    if (piece.id === target.id) return { ok: true, ratio: 1 };
    grund = `not ${entityName(target) || 'the item the recipe names'}`;
  }
  const o = originalVon(target, isGroup);
  const zusatz: string[] = [];
  for (const s of ctx.substitutions) {
    if (!s.replaces.some((t) => o.materialTypes.includes(t))) continue;
    const art = s.with.includes(p.materialType) || s.withTags.some((t) => p.tags.includes(t));
    if (!art) continue;
    const g = ersatzGrund(s, o, p, ctx.rarities);
    if (!g) return { ok: true, via: { id: s.id, name: s.name }, ratio: s.ratio };
    zusatz.push(`as ${s.name}: ${g}`);
  }
  return { ok: false, reason: [grund, ...zusatz].join('; ') };
}

// ------------------------------------------------------------ Deckung

/** Ein Bestandteil des Rezepts, wie die Materialwahl ihn braucht. */
export interface NeedLine {
  /** Die Id der `needs`-Kante — unter ihr wird reserviert (`holds.props.forNeed`). */
  key: string;
  name: string;
  qty: number;
  consumed: boolean;
}

/** Ein gewähltes Stück, schon geprüft: wie viel, und wie viele davon ein Original ersetzen. */
export interface ChosenPiece {
  need: string;
  qty: number;
  ratio: number;
}

export interface NeedCoverage {
  key: string;
  /** Gedeckt, in Einheiten des Rezepts (Ersatz zählt `qty / ratio`). */
  covered: number;
  short: number;
  over: boolean;
}

/**
 * **Wie weit die Wahl deckt, was das Rezept braucht.** Ein Ersatz mit
 * `ratio` 2 deckt mit zwei Stücken ein Original. Mehr als gebraucht ist
 * zu viel — reserviert wird genau, was der Auftrag braucht.
 */
export function coverage(needs: readonly NeedLine[], chosen: readonly ChosenPiece[]): NeedCoverage[] {
  return needs.map((n) => {
    const covered = chosen.filter((c) => c.need === n.key).reduce((s, c) => s + c.qty / c.ratio, 0);
    return { key: n.key, covered, short: Math.max(0, n.qty - covered), over: covered > n.qty + 1e-9 };
  });
}
