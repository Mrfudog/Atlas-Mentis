/**
 * **Womit gefertigt wird** (REQ-184, T-122): Werkzeug, Attribut und SG
 * einer Handwerksprobe.
 *
 * Das Rezept nennt die Vorgabe seiner Quelle (`Recipe.tool`, `.ability`,
 * `.dc`). Eine Kampagne, eine Gruppe oder eine Figur darf davon abweichen —
 * Weisheit statt Intelligenz für alles, was mit dem Kräuterset gemacht
 * wird, oder eine Figur, die ihre Tränke mit Geschick braut. Die Abweichung
 * ist eine **Kante** `craftsWith` vom Träger zum Rezept oder zum Werkzeug,
 * und sie trägt nur, was sie ändert. Eine Kopie des Rezepts wäre eine
 * zweite Fassung, die die Korrektur am Original nicht mehr erreicht.
 *
 * Gelesen wird vom Allgemeinen zum Besonderen, und das Spätere schlägt das
 * Frühere: Kampagne, Gruppe, Figur — je Träger erst die Kante am Werkzeug,
 * dann die am Rezept. Eine Kante am Werkzeug gilt für jedes Rezept, das
 * **von sich aus** dieses Werkzeug nennt; was eine Kante am Rezept als
 * Werkzeug einsetzt, zieht keine Werkzeugkante nach sich (sonst hinge das
 * Ergebnis von der Reihenfolge der Kanten ab).
 */

import { entityName } from './entity.js';
import type { Entity, EntityId } from './types.js';

export const CRAFTS_WITH = 'craftsWith';
export const RECIPE_COMPONENT = 'Recipe';

/** Vorgaben, wenn das Rezept nichts sagt — dieselben wie im Register. */
const ABILITY_DEFAULT = 'int';
const DC_DEFAULT = 12;

/** Wer einen Wert gesetzt hat. `recipe`: die Vorgabe der Quelle. */
export interface CraftSource {
  by: 'recipe' | 'campaign' | 'party' | 'actor';
  /** Der Träger der Kante; fehlt bei `recipe`. */
  holder?: EntityId;
  /** Woran die Kante hängt: das Rezept selbst oder sein Werkzeug. */
  on?: 'recipe' | 'tool';
}

export interface CraftCheck {
  /** Name eines Werkzeug-Artikels (E-020), oder leer. */
  tool: string;
  ability: string;
  dc: number;
  source: { tool: CraftSource; ability: CraftSource; dc: CraftSource };
}

export interface CraftContext {
  get(id: EntityId): Entity | undefined;
  campaign?: Entity | null;
  /** Die Figur, die fertigt. Ihre Gruppen liest die Rechnung selbst (`memberOfParty`). */
  actor?: Entity | null;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const zahl = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Die Gruppen einer Figur — ein Schritt weit, wie beim Wissen. */
function gruppenVon(actor: Entity): EntityId[] {
  return (actor.relations ?? []).filter((r) => r.type === 'memberOfParty').map((r) => r.to);
}

/**
 * Werkzeug, Attribut und SG, mit denen `actor` dieses Rezept fertigt —
 * und je Wert, wer ihn gesetzt hat. Ohne Kontext die Vorgabe der Quelle.
 */
export function craftCheck(recipe: Entity, ctx: CraftContext): CraftCheck {
  const karte = recipe.components?.[RECIPE_COMPONENT] ?? {};
  const eigenesWerkzeug = text(karte['tool']);
  const quelle: CraftSource = { by: 'recipe' };
  const out: CraftCheck = {
    tool: eigenesWerkzeug,
    ability: text(karte['ability']) || ABILITY_DEFAULT,
    dc: zahl(karte['dc']) ?? DC_DEFAULT,
    source: { tool: quelle, ability: quelle, dc: quelle },
  };

  const traeger: { e: Entity; by: CraftSource['by'] }[] = [];
  if (ctx.campaign) traeger.push({ e: ctx.campaign, by: 'campaign' });
  if (ctx.actor) {
    for (const id of gruppenVon(ctx.actor)) {
      const g = ctx.get(id);
      if (g) traeger.push({ e: g, by: 'party' });
    }
    traeger.push({ e: ctx.actor, by: 'actor' });
  }

  const werkzeugName = eigenesWerkzeug.toLowerCase();
  for (const { e, by } of traeger) {
    const kanten = (e.relations ?? []).filter((r) => r.type === CRAFTS_WITH);
    const amWerkzeug = werkzeugName
      ? kanten.filter((r) => r.to !== recipe.id && entityName(ctx.get(r.to)).toLowerCase() === werkzeugName)
      : [];
    const amRezept = kanten.filter((r) => r.to === recipe.id);
    for (const [on, liste] of [['tool', amWerkzeug], ['recipe', amRezept]] as const) {
      for (const r of liste) {
        const p = r.props ?? {};
        const von: CraftSource = { by, holder: e.id, on };
        /* Das Werkzeug tauscht nur eine Kante am Rezept: eine am Werkzeug,
           die das Werkzeug ersetzt, wäre eine Regel über ein anderes. */
        if (on === 'recipe' && text(p['tool'])) {
          out.tool = text(p['tool']);
          out.source.tool = von;
        }
        if (text(p['ability'])) {
          out.ability = text(p['ability']);
          out.source.ability = von;
        }
        const dc = zahl(p['dc']);
        if (dc !== null) {
          out.dc = dc;
          out.source.dc = von;
        }
      }
    }
  }
  return out;
}

// ------------------------------------------------------------ Fertigungsauftrag (T-128)

/**
 * **Der Fertigungsauftrag** (T-128, REQ-184) ist eine **Instanz des
 * Rezepts** (`CraftingOrder` erbt von `Recipe`, `instanceOf` aufs Rezept):
 * er liest Werkzeug, SG, Tage, Proben, Material und Ertrag beim Rezept und
 * speichert nur, was abweicht — die Leitung darf diesem einen Auftrag
 * einen anderen SG geben, ohne das Rezept zu kopieren. Eigen sind ihm der
 * Fortschritt, der Ausgang und die Proben (`CraftingOrder.*`). Wer fertigt,
 * sagt die Kante `crafting` vom Fertigenden zum Auftrag.
 *
 * Das Material bleibt im Inventar und wird **reserviert**
 * (`holds.props.reservedFor` = der Auftrag, T-127): bei Erfolg verbraucht,
 * beim Abbruch freigegeben, beim Misserfolg nach der Regel der Kampagne.
 */
export const ORDER_COMPONENT = 'CraftingOrder';
export const CRAFTING_RELATION = 'crafting';

/**
 * **Die Regeln des Handwerks am Tisch** (T-128, T-165), als Felder der
 * Kampagne (`Campaign.craftFailure` …) — und **nur dort**: was ein
 * Misserfolg kostet, entscheidet der Tisch und nicht das Rezept. Was die
 * Quelle am Rezept vorgibt, steht dort als Text (`Recipe.onFailure`) und
 * gilt nicht. Wandern mit T-132 in ein Regelmodul; wer sie liest, liest
 * über `craftRulesOf` und nicht die Karte.
 *
 * - `failure`: was eine misslungene Probe tut. `noProgress` zählt nur
 *   nichts, `progressLost` setzt den Fortschritt auf null, die drei
 *   Verlustregeln beenden den Auftrag mit diesem Verlust, `custom` hält an
 *   und lässt die Leitung entscheiden.
 * - `critSuccess`: `double` zählt eine natürliche 20 doppelt.
 * - `critFailure`: was eine natürliche 1 tut — `asFailure` wie jede
 *   misslungene Probe, sonst ein eigener Ausgang.
 * - `confirm`: `gm` heisst, eine Probe der Spielenden gilt erst, wenn die
 *   Leitung sie bestätigt; `player` lässt sie gleich gelten.
 */
export const CRAFT_FAILURE = ['noProgress', 'progressLost', 'materialsLost', 'halfLost', 'nothingLost', 'custom'] as const;
export const CRAFT_CRIT_SUCCESS = ['asSuccess', 'double'] as const;
export const CRAFT_CRIT_FAILURE = ['asFailure', 'progressLost', 'materialsLost'] as const;
export const CRAFT_CONFIRM = ['gm', 'player'] as const;

export type CraftFailure = (typeof CRAFT_FAILURE)[number];

export interface CraftRules {
  failure: CraftFailure;
  critSuccess: (typeof CRAFT_CRIT_SUCCESS)[number];
  critFailure: (typeof CRAFT_CRIT_FAILURE)[number];
  confirm: (typeof CRAFT_CONFIRM)[number];
}

const einer = <T extends string>(liste: readonly T[], v: unknown, vorgabe: T): T =>
  typeof v === 'string' && (liste as readonly string[]).includes(v) ? (v as T) : vorgabe;

/**
 * Die Regeln einer Kampagne, mit den Vorgaben, wo nichts steht. Die
 * Vorgabe des Misserfolgs ist die halbe Materialmenge — dieselbe, die bis
 * T-165 über das Rezept galt, wenn es nichts sagte. Ein altes `recipe`
 * fällt darauf zurück (Migration 072 schreibt es um).
 */
export function craftRulesOf(campaign: Entity | null | undefined): CraftRules {
  const k = campaign?.components?.['Campaign'] ?? {};
  return {
    failure: einer(CRAFT_FAILURE, k['craftFailure'], 'halfLost'),
    critSuccess: einer(CRAFT_CRIT_SUCCESS, k['craftCritSuccess'], 'asSuccess'),
    critFailure: einer(CRAFT_CRIT_FAILURE, k['craftCritFailure'], 'asFailure'),
    confirm: einer(CRAFT_CONFIRM, k['craftConfirm'], 'gm'),
  };
}

/** Was eine Verlustregel (oder ein Ausgang) in Worten tut. */
const FAILURE_TEXT: Record<CraftFailure, string> = {
  noProgress: 'the check simply does not count',
  progressLost: 'all progress so far is lost',
  materialsLost: 'the work fails and the materials are lost',
  halfLost: 'the work fails and half the materials are lost',
  nothingLost: 'the work fails, the materials come back',
  custom: 'the work stops and the GM decides',
};

/**
 * **Die Regeln in Sätzen** (T-165): je Regel einer, so wie sie am Rezept
 * und am Auftrag im Kasten „Campaign rules" stehen. Ein Satz je Regel, weil
 * man am Tisch die eine sucht, die gerade gilt.
 */
export function craftRuleSentences(r: CraftRules): string[] {
  const nat1 = r.critFailure === 'asFailure' ? 'counts as a failed check' : FAILURE_TEXT[r.critFailure];
  return [
    `On a failed check: ${FAILURE_TEXT[r.failure]}.`,
    `On a natural 20: ${r.critSuccess === 'double' ? 'the check counts twice' : 'an ordinary success'}.`,
    `On a natural 1: ${nat1}.`,
    r.confirm === 'gm' ? 'Checks by players count once the GM accepts them.' : 'Checks by players count at once.',
  ];
}

/**
 * **Woran der Fortschritt zählt:** nennt das Rezept Proben (`checks`,
 * Kibbles), zählt jede gelungene Probe eins, und fertig ist es nach so
 * vielen; sonst zählen Arbeitstage (`days`), und am Ende entscheidet eine
 * Probe (wie bisher: „ohne Angabe eine Probe am Ende"). Gelesen am
 * **aufgelösten** Auftrag — eine Abweichung am Auftrag gilt.
 */
export function orderNeed(recipeOrOrder: Entity): { unit: 'checks' | 'days'; needed: number } {
  const r = recipeOrOrder.components?.[RECIPE_COMPONENT] ?? {};
  const checks = zahl(r['checks']);
  if (checks !== null && checks >= 1) return { unit: 'checks', needed: Math.trunc(checks) };
  const days = zahl(r['days']);
  return { unit: 'days', needed: Math.max(1, Math.trunc(days ?? 1)) };
}

export type RollResult = 'critSuccess' | 'success' | 'failure' | 'critFailure';
export const ROLL_RESULTS: readonly RollResult[] = ['critSuccess', 'success', 'failure', 'critFailure'];

/** Eine Probe gegen den SG; die natürliche 20 und 1 nur, wenn sie genannt ist. */
export function rollResult(total: number, dc: number, nat?: number | null): RollResult {
  if (nat === 20) return 'critSuccess';
  if (nat === 1) return 'critFailure';
  return total >= dc ? 'success' : 'failure';
}

export type OrderOutcome = 'open' | 'succeeded' | 'failed' | 'aborted';
/** Was vom gebundenen Material zurückkommt: `all` alles, `half` die abgerundete Hälfte, `none` nichts. */
export type Return = 'all' | 'half' | 'none';

export interface OrderState {
  progress: number;
  outcome: OrderOutcome;
}

export interface RollEffect extends OrderState {
  /** Gesetzt, wenn der Auftrag damit endet und Material abgerechnet wird. */
  settle: 'success' | Return | null;
  /** In Worten, für die Zeile im Verlauf. */
  note: string;
}

/** Was eine Verlustregel zurückgibt. */
export function returnOf(rule: 'materialsLost' | 'halfLost' | 'nothingLost'): Return {
  return rule === 'nothingLost' ? 'all' : rule === 'halfLost' ? 'half' : 'none';
}

/**
 * **Was eine Probe am Auftrag tut** (T-128). Bei Proben (`checks`) zählt
 * jede gelungene; bei Tagen ist es die Probe am Ende. Ein offener Auftrag
 * bleibt offen, wo die Regel nichts beendet. `progressLost` setzt bei
 * Tagen die Tage zurück — wer weiterarbeitet, arbeitet sie neu.
 */
export function applyRoll(
  state: OrderState,
  result: RollResult,
  need: { unit: 'checks' | 'days'; needed: number },
  rules: CraftRules,
): RollEffect {
  const offen = (progress: number, note: string): RollEffect => ({ progress, outcome: 'open', settle: null, note });
  if (result === 'success' || result === 'critSuccess') {
    if (need.unit === 'days') return { progress: state.progress, outcome: 'succeeded', settle: 'success', note: 'Success — the work is done.' };
    const schritt = result === 'critSuccess' && rules.critSuccess === 'double' ? 2 : 1;
    const progress = Math.min(need.needed, state.progress + schritt);
    if (progress >= need.needed) return { progress, outcome: 'succeeded', settle: 'success', note: 'Success — the work is done.' };
    return offen(progress, schritt === 2 ? 'Critical success — counts twice.' : 'Success — one step further.');
  }
  /* Die natürliche 1 mit eigener Regel; sonst wie jede misslungene Probe. */
  const regel: CraftFailure =
    result === 'critFailure' && rules.critFailure !== 'asFailure' ? rules.critFailure : rules.failure;
  const wer = result === 'critFailure' ? 'Natural 1' : 'Failure';
  switch (regel) {
    case 'noProgress':
      return offen(state.progress, `${wer} — no progress.`);
    case 'progressLost':
      return offen(0, `${wer} — progress lost.`);
    case 'custom':
      return offen(state.progress, `${wer} — the GM decides.`);
    default:
      return {
        progress: state.progress,
        outcome: 'failed',
        settle: returnOf(regel),
        note:
          regel === 'nothingLost'
            ? `${wer} — the work fails, materials come back.`
            : regel === 'halfLost'
              ? `${wer} — the work fails, half the materials are lost.`
              : `${wer} — the work fails, materials lost.`,
      };
  }
}

// ------------------------------------------------------------ Proben als Kreise (T-165)

/**
 * **Eine Probe am Auftrag ist ein Kreis** (T-165): leer, ✓ oder ✗ —
 * angeklickt, nicht eingetippt. Die Kreise stehen am Auftrag
 * (`CraftingOrder.checks`, je Kreis ein Eintrag, leer ist `null`), und
 * **was sie bewirken, wird gerechnet** (`tallyChecks`, D8): Fortschritt,
 * Ausgang und was vom Material verloren ginge folgen beim Lesen aus den
 * Kreisen und den Regeln der Kampagne. Darum nimmt ein Zurückklicken eine
 * Regel zurück, solange der Auftrag läuft — endgültig abgerechnet wird
 * erst beim Abschluss (`finish`) oder Abbruch.
 *
 * Ein Wurf setzt denselben Kreis, mit Summe, natürlicher Zahl und SG daran
 * (die natürliche 20 und 1 als `critSuccess`/`critFailure`).
 */
export interface OrderCheck {
  mark: RollResult;
  /** Wer gesetzt hat (Name des Kontos). */
  by?: string;
  at?: string;
  total?: number;
  nat?: number;
  dc?: number;
  /** Gesetzt von Spielenden unter `craftConfirm: 'gm'` — zählt erst angenommen. */
  pending?: boolean;
}

/** Der Klick: leer → ✓ → ✗ → leer. Ein Wurf (nat 20/1) geht wie sein Zeichen weiter. */
export function nextMark(m: RollResult | null | undefined): 'success' | 'failure' | null {
  if (!m) return 'success';
  if (m === 'success' || m === 'critSuccess') return 'failure';
  return null;
}

/** Die Kreise eines Auftrags, wie sie in der Karte stehen; Unsinn wird leer. */
export function orderChecks(card: Record<string, unknown> | undefined): (OrderCheck | null)[] {
  const roh = card?.['checks'];
  if (!Array.isArray(roh)) return [];
  return roh.map((c) =>
    c && typeof c === 'object' && ROLL_RESULTS.includes((c as OrderCheck).mark) ? (c as OrderCheck) : null,
  );
}

/** Ein Kreis, wie die Seite ihn zeichnet. */
export interface CheckCircle {
  index: number;
  mark: RollResult | null;
  check: OrderCheck | null;
  /** Wartet auf die Leitung — zählt noch nicht. */
  pending: boolean;
  /** Nach dem Ende gesetzt (der Auftrag war schon entschieden) — zählt nicht. */
  ignored: boolean;
  /** Darf jetzt gesetzt werden (bei Tagen erst, wenn sie gearbeitet sind). */
  open: boolean;
}

export interface OrderTally {
  /** Gelungene Proben, oder gearbeitete Tage seit dem letzten Verlust. */
  progress: number;
  /** `open`, oder wie der Auftrag beim Abschluss ausgeht. */
  outcome: 'open' | 'succeeded' | 'failed';
  /** Wie beim Abschluss abgerechnet wird; `null`, solange er läuft. */
  settle: 'success' | Return | null;
  circles: CheckCircle[];
  /** Der Verlauf: was jede zählende Probe ausgelöst hat. */
  lines: { index: number; note: string }[];
  /** Wie viele Kreise auf die Leitung warten. */
  waiting: number;
  /** Bei Tagen: wie viele Tage noch zu arbeiten sind, bevor die Probe kommt. */
  daysLeft: number;
}

/**
 * **Was die Kreise bewirken** (T-165): der Reihe nach durch `applyRoll`,
 * bis eine Probe den Auftrag entscheidet. `worked` sind bei Tagen die
 * gearbeiteten Tage insgesamt; ein Verlust des Fortschritts verlangt sie
 * von vorn (die Tage danach zählen weiter). Danach stehen so viele leere
 * Kreise da, wie noch gelungene Proben fehlen (bei Tagen einer).
 */
export function tallyChecks(
  checks: readonly (OrderCheck | null)[],
  need: { unit: 'checks' | 'days'; needed: number },
  rules: CraftRules,
  worked = 0,
): OrderTally {
  let progress = 0;
  /* Bei Tagen: die Tage früherer Anläufe, die ein Verlust gekostet hat. */
  let tageWeg = 0;
  let outcome: OrderTally['outcome'] = 'open';
  let settle: OrderTally['settle'] = null;
  const lines: OrderTally['lines'] = [];
  const circles: CheckCircle[] = [];
  let waiting = 0;
  const tage = () => Math.max(0, worked - tageWeg);
  const tageDa = () => need.unit !== 'days' || tage() >= need.needed;

  checks.forEach((c, index) => {
    const entschieden = outcome !== 'open';
    if (!c) {
      circles.push({ index, mark: null, check: null, pending: false, ignored: false, open: !entschieden && tageDa() });
      return;
    }
    const pending = !!c.pending && rules.confirm === 'gm';
    /* Bei Tagen zählt eine Probe erst, wenn die Tage gearbeitet sind. */
    const zuFrueh = !entschieden && !tageDa();
    circles.push({ index, mark: c.mark, check: c, pending, ignored: entschieden || zuFrueh, open: !entschieden });
    if (entschieden || zuFrueh) return;
    if (pending) {
      waiting++;
      return;
    }
    const st = need.unit === 'days' ? { progress: tage(), outcome: 'open' as const } : { progress, outcome: 'open' as const };
    const w = applyRoll(st, c.mark, need, rules);
    lines.push({ index, note: w.note });
    if (need.unit === 'days') {
      /* Fortschritt verloren: die Tage dieses Anlaufs sind weg, der nächste braucht neue. */
      if (w.progress === 0 && w.outcome === 'open') tageWeg += need.needed;
    } else progress = w.progress;
    if (w.outcome !== 'open') {
      outcome = w.outcome === 'succeeded' ? 'succeeded' : 'failed';
      settle = w.settle;
    }
  });

  /* Die leeren Kreise am Ende: so viele, wie noch fehlen (gezählt ohne die
     wartenden und die leeren Lücken davor). */
  if (outcome === 'open') {
    const luecken = circles.filter((k) => !k.mark).length;
    const fehlt = need.unit === 'checks' ? need.needed - progress - waiting - luecken : 1 - waiting - luecken;
    for (let i = 0; i < fehlt; i++) {
      circles.push({ index: circles.length, mark: null, check: null, pending: false, ignored: false, open: tageDa() });
    }
  }
  return {
    progress: need.unit === 'days' ? Math.min(need.needed, tage()) : progress,
    outcome,
    settle,
    circles,
    lines,
    waiting,
    daysLeft: need.unit === 'days' ? Math.max(0, need.needed - tage()) : 0,
  };
}

/**
 * Einen Kreis setzen: gibt die neue Liste zurück, leere Kreise am Ende
 * fallen weg (sie stehen ohnehin da, solange etwas fehlt).
 */
export function setCheck(checks: readonly (OrderCheck | null)[], index: number, value: OrderCheck | null): (OrderCheck | null)[] {
  const neu = [...checks];
  while (neu.length <= index) neu.push(null);
  neu[index] = value;
  while (neu.length && neu[neu.length - 1] === null) neu.pop();
  return neu;
}

/** Ein reserviertes Stück, wie es die Abrechnung braucht. */
export interface ReservedPiece {
  inventory: EntityId;
  edge: string;
  item: EntityId;
  qty: number;
}

/**
 * **Die Abrechnung** (T-128): je reserviertes Stück, wie viel zurück ins
 * Inventar geht (`keep`, ohne Reservierung) — der Rest ist verbraucht.
 * Was das Rezept nicht verbraucht (`needs.props.consumed: false`, ein
 * Mörser), kommt immer zurück; das Übrige bei Erfolg nie, beim Abbruch
 * ganz und beim Misserfolg nach der Regel (die Hälfte abgerundet, D55).
 */
export function settlePieces(
  pieces: readonly ReservedPiece[],
  consumed: (item: EntityId) => boolean,
  how: 'success' | Return,
): { piece: ReservedPiece; keep: number }[] {
  return pieces.map((piece) => {
    if (!consumed(piece.item)) return { piece, keep: piece.qty };
    const keep = how === 'success' || how === 'none' ? 0 : how === 'all' ? piece.qty : Math.floor(piece.qty / 2);
    return { piece, keep };
  });
}

export type ReserveRefusal = 'missing' | 'reserved' | 'short';

/**
 * **Ein Stück für einen Auftrag reservieren** (T-128): `qty` vom Stapel
 * hinter `edgeId`. Ist der Stapel grösser, wird er geteilt — reserviert
 * ist genau, was der Auftrag braucht, der Rest bleibt frei. Gibt das
 * Inventar neu zurück; das alte bleibt unberührt.
 */
export function reserveIn(
  inventory: Entity,
  edgeId: string,
  qty: number,
  orderId: EntityId,
  newId: string,
): { inventory: Entity; edge: string } | { refused: ReserveRefusal } {
  const kante = (inventory.relations ?? []).find((r) => r.id === edgeId && r.type === 'holds');
  if (!kante) return { refused: 'missing' };
  if (typeof kante.props?.['reservedFor'] === 'string' && kante.props['reservedFor']) return { refused: 'reserved' };
  const alle = Math.max(1, Number(kante.props?.['qty']) || 1);
  const n = Math.max(1, Math.trunc(qty));
  if (n > alle) return { refused: 'short' };
  if (n === alle) {
    const relations = (inventory.relations ?? []).map((r) =>
      r === kante ? { ...r, props: { ...(r.props ?? {}), reservedFor: orderId } } : r,
    );
    return { inventory: { ...inventory, relations }, edge: kante.id };
  }
  /* Geteilt: der reservierte Teil liegt lose im Fach (ohne Lage), der Rest bleibt, wo er war. */
  const props: Record<string, unknown> = { ...(kante.props ?? {}), qty: n, reservedFor: orderId };
  for (const k of ['gx', 'gy', 'rot', 'slot']) delete props[k];
  const relations = [
    ...(inventory.relations ?? []).map((r) => (r === kante ? { ...r, props: { ...(r.props ?? {}), qty: alle - n } } : r)),
    { id: newId, type: 'holds', to: kante.to, props },
  ];
  return { inventory: { ...inventory, relations }, edge: newId };
}

/** Die für `orderId` reservierten Stücke eines Inventars. */
export function reservedPieces(inventory: Entity, orderId: EntityId): ReservedPiece[] {
  return (inventory.relations ?? [])
    .filter((r) => r.type === 'holds' && r.props?.['reservedFor'] === orderId)
    .map((r) => ({ inventory: inventory.id, edge: r.id, item: r.to, qty: Math.max(1, Number(r.props?.['qty']) || 1) }));
}

/**
 * Ein Inventar nach der Abrechnung: was zurückgeht, verliert die
 * Reservierung, was verbraucht ist, fällt weg (oder der Stapel schrumpft).
 */
export function applySettlement(inventory: Entity, keep: ReadonlyMap<string, number>): Entity {
  const relations = (inventory.relations ?? []).flatMap((r) => {
    if (!keep.has(r.id)) return [r];
    const n = keep.get(r.id) ?? 0;
    if (n <= 0) return [];
    const props: Record<string, unknown> = { ...(r.props ?? {}), qty: n };
    delete props['reservedFor'];
    return [{ ...r, props }];
  });
  return { ...inventory, relations };
}

/**
 * **Hat die Figur das Rezept gelernt?** (REQ-218, T-122) — gelernt heisst
 * zugeteilt: eine Information am Rezept, die das ganze Rezept meint (ohne
 * Felder oder mit `Recipe`), und die sie (selbst, über Gruppe oder
 * Fraktion) kennt. Teilwissen ist nicht gelernt.
 */
export function recipeLearned(
  entities: Map<EntityId, Entity>,
  recipe: Entity,
  knowsInfo: (info: Entity) => boolean,
): boolean {
  return (recipe.relations ?? [])
    .filter((r) => r.type === 'knowledge')
    .map((r) => entities.get(r.to))
    .some((info) => {
      if (!info) return false;
      const felder = info.components?.['Information']?.['fields'];
      const ganz = !Array.isArray(felder) || felder.length === 0 || felder.includes(RECIPE_COMPONENT);
      return ganz && knowsInfo(info);
    });
}
