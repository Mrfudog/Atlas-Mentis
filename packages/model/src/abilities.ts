/**
 * **Attributsverfahren als Daten** (REQ-238, E-016 a): wie Spielende zu
 * ihren sechs Werten kommen, steht in Artikeln der Art `AbilityMethod`,
 * die die Leitung selbst anlegt — eine feste Reihe, ein Punktekauf mit
 * Kostentabelle oder ein Würfelausdruck, je Figur oder **einmal für die
 * Gruppe** (der Gruppenpool). Die Kampagne nennt die erlaubten über
 * `allowsMethod`; nennt sie keines, gelten Standardreihe und Punktekauf.
 *
 * Gewürfelt wird am Server, damit jeder Wurf im Protokoll steht; hier
 * liegt nur, was beide Seiten gleich rechnen müssen.
 */

import { rollDice, rollText } from './dice.js';
import type { Entity, EntityId } from './types.js';

export type AbilityMethodKind = 'array' | 'pointBuy' | 'roll';

export interface AbilityMethod {
  /** Die Artikel-Id, bei den Vorgaben ein fester Schlüssel. */
  id: string;
  name: string;
  method: AbilityMethodKind;
  /** Die feste Reihe (`array`). */
  scores?: number[];
  /** Das Budget (`pointBuy`). */
  budget?: number;
  /** Was ein Wert kostet (`pointBuy`); welche Werte es gibt, sagen die Schlüssel. */
  costs?: Record<string, number>;
  /** Der Ausdruck je Wert (`roll`), etwa `4d6kh3`. */
  dice?: string;
  /** Wie viele Werte gewürfelt werden. */
  count: number;
  /** Für wen gewürfelt wird: je Figur oder einmal für die Gruppe. */
  scope: 'character' | 'party';
  /** Eine Vorgabe aus dem Code, kein Artikel. */
  builtIn?: true;
}

/**
 * **Die Vorgabe, wenn die Kampagne nichts nennt** (E-016 a): Standardreihe
 * und Punktekauf nach den Grundregeln. Wer anderes will, legt einen
 * Artikel an und nennt ihn an der Kampagne.
 */
export const DEFAULT_ABILITY_METHODS: readonly AbilityMethod[] = [
  { id: 'standard-array', name: 'Standard array', method: 'array', scores: [15, 14, 13, 12, 10, 8], count: 6, scope: 'character', builtIn: true },
  {
    id: 'point-buy',
    name: 'Point buy',
    method: 'pointBuy',
    budget: 27,
    costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
    count: 6,
    scope: 'character',
    builtIn: true,
  },
];

const zahlen = (v: unknown): number[] =>
  Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : [];

/** Ein Artikel `AbilityMethod`, gelesen — `undefined`, wenn er keiner ist. */
export function abilityMethodOf(e: Entity | undefined): AbilityMethod | undefined {
  const k = e?.components?.['AbilityMethod'];
  if (!e || !k) return undefined;
  const method = k['method'];
  if (method !== 'array' && method !== 'pointBuy' && method !== 'roll') return undefined;
  const costs: Record<string, number> = {};
  if (k['costs'] && typeof k['costs'] === 'object') {
    for (const [w, c] of Object.entries(k['costs'] as Record<string, unknown>)) {
      if (Number.isFinite(Number(w)) && Number.isFinite(Number(c))) costs[String(Number(w))] = Number(c);
    }
  }
  const scores = zahlen(k['scores']);
  const count = Number(k['count']);
  return {
    id: e.id,
    name: e.name ?? String(e.components?.['Identity']?.['name'] ?? e.id),
    method,
    ...(scores.length ? { scores } : {}),
    ...(Number.isFinite(Number(k['budget'])) && k['budget'] !== undefined ? { budget: Number(k['budget']) } : {}),
    ...(Object.keys(costs).length ? { costs } : {}),
    ...(typeof k['dice'] === 'string' && k['dice'] ? { dice: k['dice'] } : {}),
    count: Number.isFinite(count) && count >= 1 ? Math.floor(count) : method === 'array' ? scores.length || 6 : 6,
    scope: k['scope'] === 'party' ? 'party' : 'character',
  };
}

/**
 * **Was die Kampagne erlaubt**: die Ziele ihrer Kanten `allowsMethod`, die
 * es gibt und die ein Verfahren sind. Ohne eine einzige: die Vorgabe.
 */
export function allowedMethods(campaign: Entity | undefined, byId: ReadonlyMap<EntityId, Entity>): AbilityMethod[] {
  const raus: AbilityMethod[] = [];
  for (const r of campaign?.relations ?? []) {
    if (r.type !== 'allowsMethod') continue;
    const m = abilityMethodOf(byId.get(r.to));
    if (m && !raus.some((x) => x.id === m.id)) raus.push(m);
  }
  return raus.length ? raus : DEFAULT_ABILITY_METHODS.map((m) => ({ ...m }));
}

/** Was eine Verteilung im Punktekauf kostet; `null`, wenn ein Wert keinen Preis hat. */
export function pointBuySpent(scores: readonly number[], m: AbilityMethod): number | null {
  let summe = 0;
  for (const s of scores) {
    const c = m.costs?.[String(s)];
    if (c === undefined) return null;
    summe += c;
  }
  return summe;
}

/** Die Werte, die ein Punktekauf zulässt, aufsteigend. */
export function pointBuyRange(m: AbilityMethod): number[] {
  return Object.keys(m.costs ?? {})
    .map(Number)
    .sort((a, z) => a - z);
}

/** Ein Satz gewürfelter Werte samt den Würfen, wie das Protokoll sie nennt. */
export interface RolledScores {
  values: number[];
  rolls: string[];
}

/** `count` Mal den Ausdruck würfeln; `null`, wenn er keiner ist. */
export function rollAbilityScores(m: AbilityMethod, random: () => number = Math.random): RolledScores | null {
  if (m.method !== 'roll' || !m.dice) return null;
  const values: number[] = [];
  const rolls: string[] = [];
  for (let i = 0; i < m.count; i++) {
    const r = rollDice(m.dice, random);
    if (!r) return null;
    values.push(r.total);
    rolls.push(rollText(r));
  }
  return { values, rolls };
}

/** Der gewürfelte Pool einer Gruppe für dieses Verfahren (die Kante `abilityPool`). */
export function partyPool(party: Entity | undefined, methodId: string): (RolledScores & { at?: string }) | undefined {
  const r = (party?.relations ?? []).find((x) => x.type === 'abilityPool' && x.to === methodId);
  if (!r) return undefined;
  const values = zahlen(r.props?.['values']);
  if (!values.length) return undefined;
  const rolls = Array.isArray(r.props?.['rolls']) ? (r.props['rolls'] as unknown[]).map(String) : [];
  const at = typeof r.props?.['at'] === 'string' ? (r.props['at'] as string) : undefined;
  return { values, rolls, ...(at ? { at } : {}) };
}

/**
 * **Was an einer Verteilung nicht stimmt**, oder `null`. `scores` hält je
 * Attribut einen Wert; `pool` sind die Werte, die zu verteilen sind (die
 * feste Reihe, der eigene Wurf oder der Gruppenpool) — jeder genau einmal.
 */
export function assignmentProblem(
  scores: Readonly<Record<string, number | undefined>>,
  abilities: readonly string[],
  m: AbilityMethod,
  pool?: readonly number[],
): string | null {
  const werte = abilities.map((a) => scores[a]);
  if (werte.some((w) => w === undefined || !Number.isFinite(w))) return 'Give every ability a score.';
  const gesetzt = werte as number[];
  if (m.method === 'pointBuy') {
    const kosten = pointBuySpent(gesetzt, m);
    if (kosten === null) return 'A score is outside the point-buy table.';
    if (m.budget !== undefined && kosten > m.budget) return `That costs ${kosten} of ${m.budget} points.`;
    return null;
  }
  const vorrat = [...(m.method === 'array' ? (m.scores ?? []) : (pool ?? []))];
  if (!vorrat.length) return m.method === 'roll' ? 'Roll first.' : 'This method names no scores.';
  for (const w of gesetzt) {
    const i = vorrat.indexOf(w);
    if (i < 0) return 'Use each score exactly once.';
    vorrat.splice(i, 1);
  }
  return null;
}
