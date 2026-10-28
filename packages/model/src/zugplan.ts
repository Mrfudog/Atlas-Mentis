/**
 * **Der Zugplan** (T-198): eine Spielerin legt ihren Zug zurecht, bevor er
 * geschieht — wie in Baldur's Gate 3. Bewegung, Aktion, Bonusaktion und
 * Reaktion sind **Ressourcen**, und eine Zugfolge („Move 20 ft → Attack →
 * Bonus: Second Wind") verbraucht sie. Die Leitung sieht den Plan und
 * bestätigt ihn; erst dann wird gewürfelt, am Server und ins Log (T-172).
 *
 * Ein Plan ist **Spielgeschehen und kein Inhalt**: er steht im Protokoll
 * (`event_log`, `name: 'turnplan'`) wie ein Wurf und in keinem Artikel und
 * keiner Ausfuhr. Was er nennt, sind Ids und Zahlen — die Kacheln rechnet
 * der Server beim Lesen aus dem Statblock (D8, D51), der Plan selbst hält
 * nur, was gewählt wurde.
 *
 * Kein Framework, keine Darstellung: was hier steht, rechnen Server und
 * Oberfläche gleich.
 */

import { COMMON_ACTION_CATALOGUE, turnTypeOf } from './actions.js';
import { abilityMod } from './calc.js';
import { averageOf, attackNumbers, type AttackNumbers } from './attack.js';
import { cellAt, cellCentre, type GridGeometry, type MapMarker } from './map.js';
import { cellKey, cheapestPath, reachable, type Cell, type MoveGrid } from './movement.js';
import type { Pt } from './sight.js';
import { wallBlocks, type MapWall } from './walls.js';

/** Was ein Schritt kostet. `free` kostet nichts (ein Wort, eine Tür öffnen). */
export type PlanCost = 'action' | 'bonus' | 'reaction' | 'free';

/** Was ein Zug hat: je eine Aktion, Bonusaktion, Reaktion und das Tempo in Fuss. */
export interface TurnResources {
  action: number;
  bonus: number;
  reaction: number;
  /** Fuss. */
  movement: number;
}

/** Eine Kachel der Aktionsleiste: eine Aktion des Statblocks oder eine allgemeine. */
export interface PlanTile {
  /** Die Id des Artikels (`composedOf`-Ziel) oder `std:<name>` für die allgemeinen. */
  id: string;
  name: string;
  cost: PlanCost;
  /** Gruppe in der Leiste: `attack`, `action` (eigene ohne Wurf), `common`. */
  group: 'attack' | 'action' | 'common';
  /** Braucht ein Ziel (ein Token auf der Karte). */
  targeted: boolean;
  /** Reichweite in Fuss — Nahkampf die Reichweite, Fernkampf die kurze Entfernung. */
  range: number | null;
  /** Lange Entfernung (mit Nachteil). */
  longRange: number | null;
  toHit: number | null;
  /** `1d6 + 2`, wie gewürfelt. */
  damage: string;
  damageType: string;
  average: number | null;
  /** Ein Satz zur Kachel — was „Dash" tut. */
  hint: string;
}

/** Ein Schritt des Plans. */
export type PlanStep =
  | {
      id: string;
      kind: 'move';
      /** Die Felder, Start eingeschlossen. */
      path: Cell[];
      feet: number;
      /** Wohin das Token kommt, in Anteilen der Karte — der Server kennt
       *  die Bildgrösse nicht und rechnet darum kein Feld in einen Punkt um. */
      to?: Pt;
    }
  | {
      id: string;
      kind: 'act';
      tile: string;
      name: string;
      cost: PlanCost;
      /** Die Id des Artikels, auf dessen Token gezielt wird. */
      target?: string;
      targetName?: string;
    }
  | {
      id: string;
      /**
       * **Durch einen Übergang** (T-326): die Figur steht in der Fläche
       * von `via` und geht hindurch. Was es kostet, sagt der Übergang
       * (`passageRulesOf`) — Fuss vom Tempo, dazu Aktion oder Bonusaktion
       * (`free`: keine). Der Server rechnet die Kosten beim Einreichen neu.
       */
      kind: 'passage';
      via: string;
      name: string;
      feet: number;
      cost: PlanCost;
    };

/**
 * Wie ein Plan steht. `reacting`: bestätigt und halb ausgeführt — er wartet
 * auf die Antwort zu einem Gelegenheitsangriff (`pending`).
 */
export type PlanState = 'draft' | 'planned' | 'reacting' | 'confirmed' | 'rejected';

/**
 * **Ein Gelegenheitsangriff, den ein Weg auslöst** (T-198, Runde 2): beim
 * Schritt von `path[index]` nach `path[index + 1]` verlässt die Figur die
 * Reichweite von `reactor`.
 */
export interface Provocation {
  step: string;
  index: number;
  reactor: string;
  reactorName: string;
  /* Ein Angebot einer Regel (REQ-357, `offersFrom`): welche Regel, was sie
     anbietet und gegen wen; `strike` heisst, Annehmen ist ein
     Nahkampfangriff. Ohne `rule` ist es die eingebaute Gelegenheitsattacke. */
  rule?: string;
  ruleName?: string;
  offer?: string;
  against?: string;
  strike?: boolean;
}

/** Wer reagieren könnte: ein Token der Gegenseite, sein Feld und seine Reichweite in Fuss. */
export interface PlanThreat {
  id: string;
  name: string;
  cell: Cell;
  reach: number;
}

/** Was ein bestätigter Schritt ergab. */
export interface PlanResult {
  step: string;
  text: string;
  hit?: boolean;
  damage?: number;
}

/** Ein Plan, wie er im Protokoll steht (`payload` eines `turnplan`-Eintrags). */
export interface TurnPlan {
  /** Bleibt über Änderungen und Bestätigung gleich. */
  plan: string;
  map: string;
  /** Die Figur, die zieht. */
  actor: string;
  actorName: string;
  /** Wer geplant hat. */
  by: { id: string; name: string };
  steps: PlanStep[];
  state: PlanState;
  /** Wer bestätigt oder abgelehnt hat, mit Grund. */
  decidedBy?: { id: string; name: string };
  note?: string;
  results?: PlanResult[];
  campaign?: string | null;
  session?: string | null;
  /** Die Bildgrösse der Karte beim Planen — ohne sie kennt der Server keine Felder. */
  nat?: { w: number; h: number };
  /** Bei `reacting`: wer gefragt wird, und wo der Zug steht. */
  pending?: Provocation;
  /** Bei `reacting`: so viele Schritte sind schon ausgeführt. */
  done?: number;
  /** Wer in diesem Zug schon gefragt wurde — jeder einmal. Mit Regeln: je Angebot ein Schlüssel. */
  asked?: string[];
  /** Bei `reacting` mitten in einem Angriff (REQ-357): was schon gewürfelt ist. */
  cursor?: PlanCursor;
}

/** Wo ein Angriff stand, als eine Regel dazwischen fragte — damit nichts zweimal gewürfelt wird. */
export interface PlanCursor {
  step: string;
  roll?: { total: number | null; crit?: 'crit' | 'fumble'; hit: boolean | null; ac: number | null };
  damage?: number | null;
}

export const TURNPLAN_EVENT = 'turnplan';

/**
 * Eine verbrauchte Reaktion (`event_log`, `name: 'reaction'`, `subject` die
 * Karte): wer, in welchem Plan, und wo die Begegnung da stand.
 */
export interface ReactionSpent {
  reactor: string;
  plan: string;
  map: string;
  encounter?: string | null;
  round?: number | null;
  turn?: number | null;
}

export const REACTION_EVENT = 'reaction';

/** Ein frischer Zug: je eins, und das Tempo. */
export function freshResources(speed: number): TurnResources {
  return { action: 1, bonus: 1, reaction: 1, movement: Math.max(0, speed) };
}

/**
 * **Was eine Aktion kostet**, aus dem Namen ihrer Art (`Action.actionType`
 * nennt einen Artikel: „Action", „Bonus Action", „Reaction",
 * „Legendary Action"). Derselbe Leser wie am Bogen (`turnTypeOf`, T-275):
 * legendär zählt als Aktion, „Object Interaction" als frei; was keine Art
 * im Zug hat (eine Minute), plant sich als Aktion.
 */
export function costOf(actionTypeName: string | null | undefined): PlanCost {
  const t = turnTypeOf(actionTypeName);
  return t === 'bonus' || t === 'reaction' || t === 'free' ? t : 'action';
}

/**
 * **Die allgemeinen Aktionen im Zugplan** — aus dem einen Katalog
 * (`COMMON_ACTION_CATALOGUE`, T-275), die ein Zug plant. Dash gibt das
 * Tempo noch einmal, Disengage schützt vor Gelegenheitsangriffen; Dodge,
 * Help, Hide und Ready setzen beim Bestätigen ihren Eintrag in der
 * Initiative, und der ändert Vorteil und Nachteil (`ActionRule`).
 */
export const COMMON_ACTIONS: readonly PlanTile[] = COMMON_ACTION_CATALOGUE.filter((a) => a.planned).map((a) => ({
  id: `std:${a.key}`,
  name: a.name,
  hint: a.hint,
  cost: costOf(a.type === 'action' ? 'Action' : a.type),
  group: 'common' as const,
  targeted: !!a.targeted,
  range: null,
  longRange: null,
  toHit: null,
  damage: '',
  damageType: '',
  average: null,
}));

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** „80/320" → [80, 320]; „30" → [30, null]. */
export function rangePair(range: string | null | undefined): [number | null, number | null] {
  const m = /(\d+)(?:\s*\/\s*(\d+))?/.exec(String(range ?? ''));
  return m ? [Number(m[1]), m[2] ? Number(m[2]) : null] : [null, null];
}

/** Wo ein Ziel liegt: in Reichweite, auf langer Reichweite (Nachteil) oder ausser Reichweite. */
export type RangeBand = 'normal' | 'long' | 'out';

/**
 * **In welcher Reichweite ein Ziel liegt** (T-351) — für Maske und Server
 * dieselbe Rechnung: bis `range` normal, bis `longRange` lang (Nachteil),
 * darüber ausser Reichweite. `null`, wenn der Abstand oder die Reichweite
 * der Kachel unbekannt ist — dann prüft niemand, statt falsch abzulehnen.
 */
export function rangeBand(tile: Pick<PlanTile, 'range' | 'longRange'>, feet: number | null | undefined): RangeBand | null {
  if (feet === null || feet === undefined || !Number.isFinite(feet) || tile.range === null) return null;
  if (feet <= tile.range) return 'normal';
  if (tile.longRange !== null && feet <= tile.longRange) return 'long';
  return 'out';
}

/**
 * Eine Kachel aus einem Angriff (`attackNumbers`) oder, ohne Angriff, aus
 * dem Namen und der Art einer Aktion.
 */
export function tileFromAction(
  id: string,
  name: string,
  actionTypeName: string | null | undefined,
  n: AttackNumbers | null,
): PlanTile {
  const cost = costOf(actionTypeName);
  if (!n) {
    return { id, name, cost, group: 'action', targeted: false, range: null, longRange: null, toHit: null, damage: '', damageType: '', average: null, hint: '' };
  }
  const [kurz, lang] = rangePair(n.range);
  /* Eine Wurfwaffe ist beides (Javelin: Nahkampf 5 ft, Wurf 30/120) — dann
     gilt die Entfernung; die Leitung sieht beim Bestätigen, ob es ein Wurf war. */
  const fern = n.kinds.some((k) => k.startsWith('ranged')) && kurz !== null;
  return {
    id,
    name,
    cost,
    group: 'attack',
    targeted: true,
    range: fern ? kurz : (n.reach ?? kurz ?? 5),
    longRange: fern ? lang : null,
    toHit: n.toHit,
    damage: n.damage,
    damageType: n.damageType,
    average: n.average,
    hint: n.note,
  };
}

/**
 * **Der waffenlose Schlag**, den jede Kreatur hat: Übung + STR zum
 * Treffen, 1 + STR Schaden. Ohne Übung am Statblock rechnet er ohne sie —
 * eine Kachel, die fehlt, ist schlimmer als eine, die um zwei daneben liegt.
 */
export function unarmedTile(stats: Record<string, unknown>): PlanTile {
  const str = num(stats['str']);
  const mod = str !== null ? abilityMod(str) : 0;
  const prof = num(stats['prof']) ?? 0;
  const dmg = 1 + mod;
  return {
    id: 'std:unarmed',
    name: 'Unarmed Strike',
    cost: 'action',
    group: 'attack',
    targeted: true,
    range: 5,
    longRange: null,
    toHit: prof + mod,
    damage: String(Math.max(1, dmg)),
    damageType: 'bludgeoning',
    average: Math.max(1, dmg),
    hint: '',
  };
}

/** Kacheln aus den Aktionen eines Statblocks: `[{id, name, actionType, action, edge}]`. */
export function tilesFor(
  stats: Record<string, unknown>,
  actions: readonly { id: string; name: string; actionTypeName?: string | null; action?: Record<string, unknown>; edge?: Record<string, unknown> }[],
): PlanTile[] {
  const eigene = actions.map((a) => tileFromAction(a.id, a.name, a.actionTypeName, attackNumbers(a.action, stats, a.edge ?? {})));
  return [...eigene, unarmedTile(stats), ...COMMON_ACTIONS];
}

/**
 * **Was der Plan übrig lässt.** Jede Aktion verbraucht ihre Ressource,
 * Dash gibt das Tempo noch einmal, jede Bewegung zieht ihre Fuss ab.
 * Was nicht mehr reicht, steht in `problems` — gespeichert werden darf ein
 * solcher Plan nicht, angezeigt schon (rot), damit man sieht, warum.
 */
export function planBudget(
  steps: readonly PlanStep[],
  speed: number,
  /** Die Reaktion ist schon weg (ein Gelegenheitsangriff seit dem eigenen letzten Zug). */
  opts: { reactionSpent?: boolean } = {},
): { left: TurnResources; problems: string[] } {
  const left = freshResources(speed);
  if (opts.reactionSpent) left.reaction = 0;
  const problems: string[] = [];
  for (const s of steps) {
    if (s.kind === 'move') {
      left.movement -= s.feet;
      if (left.movement < 0) problems.push(`Not enough movement for ${s.feet} ft.`);
      continue;
    }
    if (s.kind === 'passage') {
      left.movement -= s.feet;
      if (left.movement < 0) problems.push(`Not enough movement to take ${s.name}.`);
      if (s.cost !== 'free') {
        left[s.cost] -= 1;
        if (left[s.cost] < 0) problems.push(`No ${s.cost === 'bonus' ? 'bonus action' : s.cost} left for ${s.name}.`);
      }
      continue;
    }
    if (s.cost === 'free') continue;
    left[s.cost] -= 1;
    if (left[s.cost] < 0) problems.push(`No ${s.cost === 'bonus' ? 'bonus action' : s.cost} left for ${s.name}.`);
    if (s.tile === 'std:dash') left.movement += Math.max(0, speed);
  }
  return { left, problems };
}

/**
 * **Die Trefferchance** gegen eine Rüstungsklasse, auf einem W20: eine
 * natürliche 20 trifft immer, eine 1 nie. Mit Vorteil zwei Würfe, der
 * bessere zählt; mit Nachteil der schlechtere.
 */
export function hitChance(toHit: number, ac: number, mode?: 'adv' | 'dis'): number {
  let treffer = 0;
  for (let w = 1; w <= 20; w++) {
    if (w === 20 || (w !== 1 && w + toHit >= ac)) treffer += 1;
  }
  const p = treffer / 20;
  if (mode === 'adv') return 1 - (1 - p) ** 2;
  if (mode === 'dis') return p * p;
  return p;
}

/** Erwarteter Schaden: Trefferchance mal Durchschnitt (Kritische nicht gerechnet). */
export function expectedDamage(chance: number, average: number | null): number | null {
  return average === null ? null : Math.round(chance * average * 10) / 10;
}

/** Der Durchschnitt eines Schadensausdrucks, für den Fall ohne Kachel. */
export function damageAverage(expr: string): number | null {
  return averageOf(expr);
}

/**
 * Wie die Zugfolge sich liest: „Move 20 ft → Scimitar → Bonus: Second
 * Wind". Die Kosten stehen dabei, wo sie nicht „Aktion" sind.
 */
export function planText(steps: readonly PlanStep[]): string {
  return steps
    .map((s) => {
      if (s.kind === 'move') return `Move ${s.feet} ft`;
      if (s.kind === 'passage') return `Through ${s.name}`;
      const vor = s.cost === 'bonus' ? 'Bonus: ' : s.cost === 'reaction' ? 'Reaction: ' : '';
      return `${vor}${s.name}${s.targetName ? ` → ${s.targetName}` : ''}`;
    })
    .join(' → ');
}

// ------------------------------------------------------------ Das Raster

/**
 * Das Bewegungsraster einer Karte für den Plan (nur Quadrate): so viele
 * Spalten und Zeilen, wie das Bild trägt; die Felder der **anderen**
 * Tokens sind besetzt, und was den Schritt hält (`Map.walls`, T-118),
 * steht als Wand im Raster.
 */
export function planGrid(geo: GridGeometry, markers: readonly MapMarker[], selfRel: string, walls: readonly MapWall[] = []): MoveGrid | null {
  if (geo.shape !== 'square') return null;
  const cols = Math.max(1, Math.floor((geo.w - geo.ox) / geo.size));
  const rows = Math.max(1, Math.floor((geo.h - geo.oy) / geo.size));
  const blocked = markers
    .filter((m) => m.rel.id !== selfRel && m.kind !== 'scenery' && !m.hidden)
    .map((m) => cellKey(cellAt(geo, m)));
  /* Die Sperren, die den Schritt halten (T-118), in Feldeinheiten. */
  const fx = (x: number) => (x * geo.w - geo.ox) / geo.size;
  const fy = (y: number) => (y * geo.h - geo.oy) / geo.size;
  const segs = walls.filter((w) => wallBlocks(w).move).map((w) => ({ x1: fx(w.x1), y1: fy(w.y1), x2: fx(w.x2), y2: fy(w.y2) }));
  return { cols, rows, walls: segs, blocked, square: geo.cellFeet };
}

/** Das Feld eines Tokens, ins Raster geklemmt. */
export function tokenCell(geo: GridGeometry, grid: MoveGrid, p: Pt): Cell {
  const c = cellAt(geo, p);
  return { x: Math.max(0, Math.min(grid.cols - 1, c.x)), y: Math.max(0, Math.min(grid.rows - 1, c.y)) };
}

/** Wohin das Tempo reicht, als Felder mit ihren Kosten. */
export function planReach(grid: MoveGrid, from: Cell, feet: number): Record<string, number> {
  return reachable(grid, from, feet);
}

/** Der Weg zu einem Feld, wenn er ins Tempo passt — sonst `null`. */
export function planPath(grid: MoveGrid, from: Cell, to: Cell, feet: number): { path: Cell[]; feet: number } | null {
  const r = cheapestPath(grid, from, to);
  if (!r || r.feet > feet) return null;
  return { path: r.cells, feet: r.feet };
}

/** Die Mitte eines Feldes in Anteilen der Karte — wohin das Token gestellt wird. */
export function cellPoint(geo: GridGeometry, c: Cell): Pt {
  return cellCentre(geo, c);
}

/**
 * Wie weit zwei Punkte auseinander sind, in Fuss, nach der Rasterregel —
 * für die Reichweite eines Angriffs. Gezählt wird nach der Regel 5-10-5,
 * je Feld so viele Fuss, wie der Massstab sagt (`cellFeet`, T-321).
 */
export function feetBetween(geo: GridGeometry, a: Pt, b: Pt): number {
  return feetBetweenCells(geo, cellAt(geo, a), cellAt(geo, b));
}

function feetBetweenCells(geo: GridGeometry, ca: Cell, cb: Cell): number {
  const dx = Math.abs(ca.x - cb.x);
  const dy = Math.abs(ca.y - cb.y);
  return (Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2)) * geo.cellFeet;
}

/**
 * **Die Felder, die ein Token belegt** (T-391): `p` ist seine Mitte (D58),
 * `span` seine Breite in Feldern. Auf Hex und für ein Feld oder weniger nur
 * das Feld unter der Mitte.
 */
export function tokenCells(geo: GridGeometry, p: Pt, span = 1): Cell[] {
  const n = Math.round(span);
  if (geo.shape !== 'square' || n <= 1) return [cellAt(geo, p)];
  const mitte = { x: (p.x * geo.w - geo.ox) / geo.size, y: (p.y * geo.h - geo.oy) / geo.size };
  const anker = { x: Math.round(mitte.x - n / 2), y: Math.round(mitte.y - n / 2) };
  const out: Cell[] = [];
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push({ x: anker.x + dx, y: anker.y + dy });
  return out;
}

/**
 * **Wie weit ein Angriff reicht, von Platz zu Platz** (T-391): der kürzeste
 * Abstand zwischen einem Feld des Angreifers und einem Feld des Ziels —
 * ein Drache auf 3 × 3, dessen Rand Kira berührt, steht 5 ft weit, nicht
 * 10 ft bis zu seiner Mitte. Gleiche Rasterregel wie `feetBetween`.
 */
export function feetBetweenTokens(geo: GridGeometry, a: Pt, aSpan: number, b: Pt, bSpan: number): number {
  let best = Infinity;
  for (const ca of tokenCells(geo, a, aSpan)) for (const cb of tokenCells(geo, b, bSpan)) best = Math.min(best, feetBetweenCells(geo, ca, cb));
  return best;
}

/** Wo der Plan das Token zuletzt hinstellt — das Ende der letzten Bewegung. */
export function planEnd(steps: readonly PlanStep[], start: Cell): Cell {
  let at = start;
  for (const s of steps) if (s.kind === 'move' && s.path.length) at = s.path[s.path.length - 1]!;
  return at;
}

/** Ein Schritt aus dem Netz: nur, was ein Plan tragen darf, und gekürzt. */
export function cleanStep(raw: unknown, i: number): PlanStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const id = typeof s['id'] === 'string' && s['id'] ? s['id'].slice(0, 40) : `s${i + 1}`;
  if (s['kind'] === 'move') {
    const path = (Array.isArray(s['path']) ? s['path'] : [])
      .slice(0, 200)
      .map((c) => ({ x: Math.trunc(Number((c as Cell)?.x)), y: Math.trunc(Number((c as Cell)?.y)) }))
      .filter((c) => Number.isFinite(c.x) && Number.isFinite(c.y));
    const feet = num(s['feet']);
    if (path.length < 2 || feet === null || feet < 0) return null;
    /* Je Schritt ein Nachbarfeld: ein Weg mit Sprüngen ist kein Weg. */
    for (let k = 1; k < path.length; k++) {
      if (Math.max(Math.abs(path[k]!.x - path[k - 1]!.x), Math.abs(path[k]!.y - path[k - 1]!.y)) !== 1) return null;
    }
    const to = s['to'] as Pt | undefined;
    const tx = num(to?.x);
    const ty = num(to?.y);
    const ziel = tx !== null && ty !== null ? { to: { x: Math.min(1, Math.max(0, tx)), y: Math.min(1, Math.max(0, ty)) } } : {};
    return { id, kind: 'move', path, feet, ...ziel };
  }
  if (s['kind'] === 'passage' && typeof s['via'] === 'string' && s['via']) {
    const feet = num(s['feet']);
    const cost = (['action', 'bonus', 'reaction', 'free'] as const).find((c) => c === s['cost']) ?? 'free';
    return { id, kind: 'passage', via: s['via'].slice(0, 80), name: String(s['name'] ?? 'passage').slice(0, 120), feet: feet !== null && feet > 0 ? feet : 0, cost };
  }
  if (s['kind'] === 'act' && typeof s['tile'] === 'string' && s['tile']) {
    const cost = (['action', 'bonus', 'reaction', 'free'] as const).find((c) => c === s['cost']) ?? 'action';
    return {
      id,
      kind: 'act',
      tile: s['tile'].slice(0, 80),
      name: String(s['name'] ?? '').slice(0, 120),
      cost,
      ...(typeof s['target'] === 'string' && s['target'] ? { target: s['target'].slice(0, 80) } : {}),
      ...(typeof s['targetName'] === 'string' && s['targetName'] ? { targetName: s['targetName'].slice(0, 120) } : {}),
    };
  }
  return null;
}

/** Die Bildgrösse aus dem Netz: zwei positive Zahlen, sonst nichts. */
export function cleanNat(raw: unknown): { w: number; h: number } | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const w = num(o['w']);
  const h = num(o['h']);
  return w !== null && h !== null && w > 0 && h > 0 && w < 100000 && h < 100000 ? { w, h } : null;
}

// ------------------------------------------------------------ Reaktionen

/** Wie weit zwei Felder auseinander sind, in Fuss (5-10-5); `per` Fuss je Feld (T-321). */
export function cellFeet(a: Cell, b: Cell, per = 5): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2)) * per;
}

/**
 * **Welche Gelegenheitsangriffe ein Plan auslöst** (T-198, Runde 2; PHB:
 * wer die Reichweite einer feindlichen Kreatur verlässt). Gezählt wird
 * jeder Schritt eines Weges, der aus der Reichweite heraus führt; jeder
 * Gegner einmal je Zug — er hat nur eine Reaktion. **Disengage** vor dem
 * Weg hebt es auf, wie im Spielerhandbuch und in BG3; danach gesetzt hilft
 * es dem Weg davor nicht.
 */
export function opportunityAttacks(steps: readonly PlanStep[], threats: readonly PlanThreat[], per = 5): Provocation[] {
  const out: Provocation[] = [];
  const schon = new Set<string>();
  let geloest = false;
  for (const s of steps) {
    /* Hinter einem Übergang (T-326) steht die Figur woanders — die Reichweiten hier gelten nicht mehr. */
    if (s.kind === 'passage') break;
    if (s.kind === 'act') {
      if (s.tile === 'std:disengage') geloest = true;
      continue;
    }
    if (geloest) continue;
    for (let k = 0; k + 1 < s.path.length; k++) {
      const a = s.path[k]!;
      const b = s.path[k + 1]!;
      for (const t of threats) {
        if (schon.has(t.id)) continue;
        if (cellFeet(a, t.cell, per) <= t.reach && cellFeet(b, t.cell, per) > t.reach) {
          schon.add(t.id);
          out.push({ step: s.id, index: k, reactor: t.id, reactorName: t.name });
        }
      }
    }
  }
  return out;
}

/** Wo eine Begegnung steht: Runde und Zug (Index in der Reihe). */
export interface RoundTurn {
  round: number;
  turn: number;
}

/**
 * **Ist die Reaktion wieder da?** Verbraucht bis zum **eigenen nächsten
 * Zug** (PHB): `spent` ist der Stand beim Verbrauch, `now` der jetzige,
 * `own` der Platz des Reagierenden in der Reihe. Kennt die Begegnung
 * einen Stand nicht (kein Kampf, nicht in der Reihe), sagt `null` —
 * dann entscheidet der Aufrufer nach seinem eigenen Zug (`fallback`).
 */
export function reactionBack(spent: RoundTurn | null, now: RoundTurn | null, own: number | null): boolean | null {
  if (!spent || !now || own === null) return null;
  /* Der nächste eigene Zug nach dem Verbrauch. */
  const naechste: RoundTurn = own > spent.turn ? { round: spent.round, turn: own } : { round: spent.round + 1, turn: own };
  return now.round > naechste.round || (now.round === naechste.round && now.turn >= naechste.turn);
}

// ------------------------------------------------------- Stufe der Kampagne

/**
 * **Wie viel der Zugplan kann** (T-325, `Campaign.turnPlanner`): aus, nur
 * Bewegung, Bewegung und Aktionen, oder voll — mit Reaktionen
 * (Gelegenheitsangriff, die Angebote der Regeln, REQ-357). Jede Stufe
 * schliesst die engere ein. Ohne Angabe gilt `full`, wie vor T-325.
 */
export type TurnPlanner = 'off' | 'move' | 'actions' | 'full';
export const TURN_PLANNERS: readonly TurnPlanner[] = ['off', 'move', 'actions', 'full'];

/** Die Stufe des Zugplans einer Kampagne. */
export function turnPlannerOf(campaign: { components?: Record<string, Record<string, unknown> | undefined> } | null | undefined): TurnPlanner {
  const v = campaign?.components?.['Campaign']?.['turnPlanner'];
  return TURN_PLANNERS.includes(v as TurnPlanner) ? (v as TurnPlanner) : 'full';
}

/** Die Kacheln, die eine Stufe anbietet: `move` keine, `actions` keine Reaktion. */
export function plannerTiles(tiles: readonly PlanTile[], mode: TurnPlanner): PlanTile[] {
  if (mode === 'off' || mode === 'move') return [];
  return mode === 'actions' ? tiles.filter((t) => t.cost !== 'reaction') : [...tiles];
}

/** Darf ein Schritt in dieser Stufe stehen? Der Server prüft damit jeden eingereichten Plan. */
export function plannerAllows(step: PlanStep, mode: TurnPlanner): boolean {
  if (mode === 'off') return false;
  if (step.kind === 'move' || step.kind === 'passage') return true;
  if (mode === 'move') return false;
  return mode === 'full' || step.cost !== 'reaction';
}

/** Fragt der Zug in dieser Stufe nach Reaktionen anderer? Nur voll. */
export function plannerReacts(mode: TurnPlanner): boolean {
  return mode === 'full';
}
