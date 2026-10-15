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

import { abilityMod } from './calc.js';
import { averageOf, attackNumbers, type AttackNumbers } from './attack.js';
import { cellAt, cellCentre, type GridGeometry, type MapMarker } from './map.js';
import { cellKey, cheapestPath, reachable, type Cell, type MoveGrid } from './movement.js';
import type { Pt } from './sight.js';

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
    };

/** Wie ein Plan steht. */
export type PlanState = 'draft' | 'planned' | 'confirmed' | 'rejected';

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
}

export const TURNPLAN_EVENT = 'turnplan';

/** Ein frischer Zug: je eins, und das Tempo. */
export function freshResources(speed: number): TurnResources {
  return { action: 1, bonus: 1, reaction: 1, movement: Math.max(0, speed) };
}

/**
 * **Was eine Aktion kostet**, aus dem Namen ihrer Art (`Action.actionType`
 * nennt einen Artikel: „Action", „Bonus Action", „Reaction",
 * „Legendary Action"). Legendär ist am Tisch kein eigener Zug — für den
 * Plan zählt sie als Aktion, bis die Leitung etwas anderes will.
 */
export function costOf(actionTypeName: string | null | undefined): PlanCost {
  const n = String(actionTypeName ?? '').toLowerCase();
  if (n.includes('bonus')) return 'bonus';
  if (n.includes('reaction')) return 'reaction';
  if (n.includes('free')) return 'free';
  return 'action';
}

/**
 * **Die allgemeinen Aktionen** des Spielerhandbuchs, die jede Kreatur hat.
 * `Dash` gibt das Tempo noch einmal; die übrigen ändern am Plan nichts und
 * stehen da, damit man sie wählen und die Leitung sie lesen kann.
 */
export const COMMON_ACTIONS: readonly PlanTile[] = [
  { id: 'std:dash', name: 'Dash', hint: 'Gain extra movement equal to your speed.' },
  { id: 'std:disengage', name: 'Disengage', hint: 'Your movement does not provoke opportunity attacks.' },
  { id: 'std:dodge', name: 'Dodge', hint: 'Attacks against you have disadvantage until your next turn.' },
  { id: 'std:help', name: 'Help', hint: 'An ally gains advantage on their next check or attack.' },
  { id: 'std:hide', name: 'Hide', hint: 'Make a Dexterity (Stealth) check.' },
].map((t) => ({
  ...t,
  cost: 'action' as const,
  group: 'common' as const,
  targeted: false,
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
export function planBudget(steps: readonly PlanStep[], speed: number): { left: TurnResources; problems: string[] } {
  const left = freshResources(speed);
  const problems: string[] = [];
  for (const s of steps) {
    if (s.kind === 'move') {
      left.movement -= s.feet;
      if (left.movement < 0) problems.push(`Not enough movement for ${s.feet} ft.`);
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
      const vor = s.cost === 'bonus' ? 'Bonus: ' : s.cost === 'reaction' ? 'Reaction: ' : '';
      return `${vor}${s.name}${s.targetName ? ` → ${s.targetName}` : ''}`;
    })
    .join(' → ');
}

// ------------------------------------------------------------ Das Raster

/**
 * Das Bewegungsraster einer Karte für den Plan (nur Quadrate): so viele
 * Spalten und Zeilen, wie das Bild trägt; die Felder der **anderen**
 * Tokens sind besetzt. Wände kennt die Karte der Seite noch nicht
 * (docs/Karten.md) — sie kommen hier dazu, wenn es sie gibt.
 */
export function planGrid(geo: GridGeometry, markers: readonly MapMarker[], selfRel: string): MoveGrid | null {
  if (geo.shape !== 'square') return null;
  const cols = Math.max(1, Math.floor((geo.w - geo.ox) / geo.size));
  const rows = Math.max(1, Math.floor((geo.h - geo.oy) / geo.size));
  const blocked = markers
    .filter((m) => m.rel.id !== selfRel && m.kind !== 'scenery' && !m.hidden)
    .map((m) => cellKey(cellAt(geo, m)));
  return { cols, rows, walls: [], blocked, square: 5 };
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
 * für die Reichweite eines Angriffs. Gezählt wird nach der Regel 5-10-5.
 */
export function feetBetween(geo: GridGeometry, a: Pt, b: Pt): number {
  const ca = cellAt(geo, a);
  const cb = cellAt(geo, b);
  const dx = Math.abs(ca.x - cb.x);
  const dy = Math.abs(ca.y - cb.y);
  return (Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2)) * 5;
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
