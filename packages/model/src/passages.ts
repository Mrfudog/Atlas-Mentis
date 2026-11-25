/**
 * **Übergänge als Fläche** (T-326, aufbauend auf T-307/E-108) — eine Treppe,
 * eine Leiter, ein Portal deckt mehrere Felder, und wer darin steht, gilt
 * als am Übergang: er sieht ins Ziel (wenn `sight: 'through'`), und er geht
 * durch, wenn die Regeln es erlauben.
 *
 * **Bestehende Übergänge bleiben, wie sie sind:** ohne `area` ist ein Ende
 * das eine Feld um seinen Punkt (`passageArea`), ohne Gitter der Punkt.
 * Gezeichnet wird ein solcher Übergang weiter als Punkt.
 *
 * **Wer, wann, was es kostet** (`passageRulesOf`): Vorgabe an der Kampagne
 * (`Campaign.passageTrigger`, `passageWhen`, `passageMove`, `passageAction`,
 * `passageConfirm`), je Übergang überschreibbar (`props.rules`). Geprüft
 * wird am Server (`mayUsePassage`); die Maske bietet nur an.
 *
 * Kein Framework, kein DOM.
 */

import type { Pt } from './sight.js';
import type { Entity, Relation } from './types.js';
import { cellAt, cellCentre, markersOf, type GridGeometry, type MapMarker } from './map.js';
import { floorOfRelation, inPoly, onPassage, PASSAGE_EXACT, polyBox, type Passage, type Poly } from './floors.js';

// ------------------------------------------------------------------ Fläche

/** Die Ecken eines Feldes, in Anteilen der Karte. Hex: das Sechseck. */
export function cellPoly(geo: GridGeometry, c: { x: number; y: number }): Poly {
  const m = cellCentre(geo, c);
  if (geo.shape === 'square') {
    const hx = geo.size / 2 / geo.w;
    const hy = geo.size / 2 / geo.h;
    return [
      [m.x - hx, m.y - hy],
      [m.x + hx, m.y - hy],
      [m.x + hx, m.y + hy],
      [m.x - hx, m.y + hy],
    ];
  }
  const r = geo.rowHeight / 2;
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return [m.x + (r * Math.cos(a)) / geo.w, m.y + (r * Math.sin(a)) / geo.h] as [number, number];
  });
}

/**
 * **Die Fläche eines Endes**: das gespeicherte Vieleck, sonst das Feld um
 * den Punkt (1×1, wie vor T-326), ohne Gitter `null` — dann zählt nur der
 * Punkt selbst.
 */
export function passageArea(end: Pick<Passage, 'area' | 'at'>, geo: GridGeometry | null): Poly | null {
  if (end.area) return end.area;
  return geo ? cellPoly(geo, cellAt(geo, end.at)) : null;
}

/** Die Fläche am Ziel eines Endes, ebenso. */
export function passageTargetArea(end: Pick<Passage, 'toArea' | 'toAt'>, geo: GridGeometry | null): Poly | null {
  return passageArea({ area: end.toArea, at: end.toAt }, geo);
}

/**
 * **Steht der Punkt am Übergang?** In der Fläche, oder — ohne Fläche und
 * ohne Gitter — genau auf dem Punkt. Ein Token, das auf einem Feld steht,
 * steht in dessen Mitte; darum reicht die Mitte.
 */
export function inPassage(end: Pick<Passage, 'area' | 'at'>, p: Pt, geo: GridGeometry | null): boolean {
  if (onPassage(end, p, PASSAGE_EXACT, 1)) return true;
  const a = passageArea(end, geo);
  return !!a && inPoly(a, p);
}

/** Die Tokens (Figuren, Gruppe) dieser Ebene, die am Übergang stehen. */
export function tokensInPassage(map: Entity, end: Passage, geo: GridGeometry | null): MapMarker[] {
  return markersOf(map).filter(
    (m) => (m.kind === 'play' || m.kind === 'party') && floorOfRelation(m.rel) === end.floor && inPassage(end, m, geo),
  );
}

/** Das nächste Ende, an dem der Punkt steht — gezogen auf die Fläche (T-326). */
export function passageUnder(ends: readonly Passage[], p: Pt, geo: GridGeometry | null): Passage | null {
  let best: Passage | null = null;
  let d = Infinity;
  for (const e of ends) {
    if (!inPassage(e, p, geo)) continue;
    const a = Math.hypot(p.x - e.at.x, p.y - e.at.y);
    if (a < d) {
      best = e;
      d = a;
    }
  }
  return best;
}

/**
 * **Wohin die Tokens kommen** (T-326): je Token ein Punkt in der
 * Zielfläche, die freien Felder zuerst, das nächste am Zielpunkt zuerst.
 * Reichen die freien nicht, kommen belegte dazu — niemand bleibt stehen,
 * weil die Treppe oben voll ist; die Leitung räumt dann auf. Ohne Gitter
 * oder ohne Zielfläche: alle auf den Zielpunkt.
 */
export function landingSpots(
  end: Pick<Passage, 'toArea' | 'toAt'>,
  geo: GridGeometry | null,
  occupied: readonly Pt[],
  n: number,
): Pt[] {
  if (n <= 0) return [];
  const flaeche = passageTargetArea(end, geo);
  if (!geo || !flaeche) return Array.from({ length: n }, () => end.toAt);
  const box = polyBox(flaeche);
  const a = cellAt(geo, { x: box.x, y: box.y });
  const b = cellAt(geo, { x: box.x + box.w, y: box.y + box.h });
  const felder: Array<{ c: { x: number; y: number }; p: Pt }> = [];
  for (let y = Math.min(a.y, b.y) - 1; y <= Math.max(a.y, b.y) + 1; y++) {
    for (let x = Math.min(a.x, b.x) - 2; x <= Math.max(a.x, b.x) + 2; x++) {
      const p = cellCentre(geo, { x, y });
      if (inPoly(flaeche, p)) felder.push({ c: { x, y }, p });
    }
  }
  if (!felder.length) return Array.from({ length: n }, () => end.toAt);
  const ziel = cellAt(geo, end.toAt);
  const belegt = new Set(occupied.map((p) => { const c = cellAt(geo, p); return `${c.x},${c.y}`; }));
  const nah = (f: { c: { x: number; y: number } }) => Math.hypot(f.c.x - ziel.x, f.c.y - ziel.y);
  const frei = felder.filter((f) => !belegt.has(`${f.c.x},${f.c.y}`)).sort((p, q) => nah(p) - nah(q));
  const voll = felder.filter((f) => belegt.has(`${f.c.x},${f.c.y}`)).sort((p, q) => nah(p) - nah(q));
  const reihe = [...frei, ...voll];
  return Array.from({ length: n }, (_, i) => reihe[i % reihe.length]!.p);
}

// ------------------------------------------------------------------ Regeln

/** Wer auslöst: nur die Leitung, Spielende an ihrer Figur am Übergang, oder beide. */
export type PassageTrigger = 'gm' | 'players' | 'both';
export const PASSAGE_TRIGGERS: readonly PassageTrigger[] = ['gm', 'players', 'both'];
/** Wann Spielende durchgehen (im Kampf): jederzeit, im eigenen Zug, oder im letzten Zug der Runde. */
export type PassageWhen = 'any' | 'turn' | 'roundEnd';
export const PASSAGE_WHENS: readonly PassageWhen[] = ['any', 'turn', 'roundEnd'];
/** Was es an Bewegung kostet: nichts, ein Feld, das halbe oder das ganze Tempo. */
export type PassageMove = 'none' | 'square' | 'half' | 'all';
export const PASSAGE_MOVES: readonly PassageMove[] = ['none', 'square', 'half', 'all'];
/** Was es an Aktion kostet. */
export type PassageAction = 'none' | 'action' | 'bonus';
export const PASSAGE_ACTIONS: readonly PassageAction[] = ['none', 'action', 'bonus'];
/** Bestätigt die Leitung? Wie Züge (`Campaign.moves`), immer, oder nie. */
export type PassageConfirm = 'moves' | 'always' | 'never';
export const PASSAGE_CONFIRMS: readonly PassageConfirm[] = ['moves', 'always', 'never'];

export interface PassageRules {
  trigger: PassageTrigger;
  when: PassageWhen;
  move: PassageMove;
  /** Fuss, wenn der Übergang eine eigene Zahl nennt (`rules.feet`) — sie schlägt `move`. */
  feet: number | null;
  action: PassageAction;
  confirm: PassageConfirm;
}

function wahl<T extends string>(liste: readonly T[], v: unknown): T | undefined {
  return liste.includes(v as T) ? (v as T) : undefined;
}

/**
 * **Die Regeln eines Übergangs**: was er selbst sagt (`props.rules`), sonst
 * die Kampagne, sonst die Vorgabe — beide lösen aus, jederzeit, kostenlos,
 * bestätigt wie ein Zug. Das ist, was vor T-326 galt.
 */
export function passageRulesOf(campaign: Entity | null | undefined, passage?: Pick<Passage, 'rules'> | null): PassageRules {
  const k = (campaign?.components?.['Campaign'] ?? {}) as Record<string, unknown>;
  const eigen = (passage?.rules ?? {}) as Record<string, unknown>;
  const fuss = typeof eigen['feet'] === 'number' && Number.isFinite(eigen['feet']) && eigen['feet'] >= 0 ? Math.round(eigen['feet']) : null;
  return {
    trigger: wahl(PASSAGE_TRIGGERS, eigen['trigger']) ?? wahl(PASSAGE_TRIGGERS, k['passageTrigger']) ?? 'both',
    when: wahl(PASSAGE_WHENS, eigen['when']) ?? wahl(PASSAGE_WHENS, k['passageWhen']) ?? 'any',
    move: wahl(PASSAGE_MOVES, eigen['move']) ?? wahl(PASSAGE_MOVES, k['passageMove']) ?? 'none',
    feet: fuss,
    action: wahl(PASSAGE_ACTIONS, eigen['action']) ?? wahl(PASSAGE_ACTIONS, k['passageAction']) ?? 'none',
    confirm: wahl(PASSAGE_CONFIRMS, eigen['confirm']) ?? wahl(PASSAGE_CONFIRMS, k['passageConfirm']) ?? 'moves',
  };
}

/** Was der Übergang **an Bewegung** kostet, in Fuss, bei diesem Tempo und dieser Feldgrösse. */
export function passageFeet(rules: Pick<PassageRules, 'move' | 'feet'>, speed: number, cellFeet = 5): number {
  if (rules.feet !== null) return rules.feet;
  switch (rules.move) {
    case 'square':
      return cellFeet;
    case 'half':
      return Math.floor(Math.max(0, speed) / 2);
    case 'all':
      return Math.max(0, speed);
    default:
      return 0;
  }
}

/** Die Kosten als Satz: „10 ft and a bonus action", „free". */
export function passageCostText(rules: PassageRules, speed: number | null, cellFeet = 5): string {
  const teile: string[] = [];
  if (rules.feet !== null) {
    if (rules.feet > 0) teile.push(`${rules.feet} ft`);
  } else if (rules.move === 'square') teile.push(`${cellFeet} ft`);
  else if (rules.move === 'half') teile.push(speed !== null ? `${Math.floor(speed / 2)} ft` : 'half your speed');
  else if (rules.move === 'all') teile.push(speed !== null ? `${speed} ft` : 'all your movement');
  if (rules.action === 'action') teile.push('an action');
  if (rules.action === 'bonus') teile.push('a bonus action');
  return teile.length ? teile.join(' and ') : 'free';
}

/** Wie der Tisch gerade steht, wenn jemand durchgehen will. */
export interface PassageMoment {
  /** Die Leitung fragt. */
  gm: boolean;
  /** Ein Kampf läuft auf der Karte. */
  combat: boolean;
  /** Im Kampf: die Figur ist am Zug. */
  ownTurn: boolean;
  /** Im Kampf: der laufende Zug ist der letzte der Runde. */
  lastTurn: boolean;
}

/**
 * **Darf hier jemand durchgehen?** `null`: ja; sonst der Grund, englisch,
 * wie ihn die Maske zeigt. Die Leitung darf immer, ausser der Übergang ist
 * den Spielenden vorbehalten (`trigger: 'players'`) — dann zieht sie die
 * Tokens von Hand. Ausserhalb eines Kampfes gibt es keinen Zug, also hält
 * `when` dort nichts.
 */
export function mayUsePassage(rules: PassageRules, at: PassageMoment): string | null {
  if (at.gm) return rules.trigger === 'players' ? 'Only players use this passage.' : null;
  if (rules.trigger === 'gm') return 'Only the GM sends tokens through this passage.';
  if (!at.combat) return null;
  if (rules.when === 'turn' && !at.ownTurn) return 'Only on your own turn.';
  if (rules.when === 'roundEnd' && !at.lastTurn) return 'Only in the last turn of the round.';
  return null;
}

/** Muss die Leitung bestätigen? `moves`: wie ein Zug nach `Campaign.moves`. */
export function passageNeedsConfirm(rules: Pick<PassageRules, 'confirm'>, moves: 'free' | 'confirm'): boolean {
  return rules.confirm === 'always' || (rules.confirm === 'moves' && moves === 'confirm');
}

/** Die Markerkante eines Endes, um ihre Fläche zu setzen. */
export function withPassageArea(map: Entity, relId: string, side: 'area' | 'toArea', area: Poly | null): Entity {
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  return {
    ...map,
    relations: (map.relations ?? []).map((r: Relation) => {
      if (r.id !== relId) return r;
      const props = { ...((r.props ?? {}) as Record<string, unknown>) };
      if (area) props[side] = area.map(([x, y]) => [r4(x), r4(y)]);
      else delete props[side];
      return { ...r, props };
    }),
  };
}
