/**
 * **Regeln am Tisch** (REQ-357, T-270): die Regelgraphen der laufenden
 * Kampagne hören auf das, was im Zugplan geschieht, und bieten ihre Folgen
 * an. Hier steht, was Server und Oberfläche gleich rechnen: ob die
 * Kampagne die Graphen laufen lässt, wie aus einer Figur eine
 * `RuleCreature` wird, wer beim Gehen eine Reichweite verlässt, und wie aus
 * einem Lauf Angebote und Hinweise werden.
 *
 * **Der Graph führt** (Leitung, 19.10.2026): ist die Option an, fragt der
 * Zugplan nicht mehr `opportunityAttacks`, sondern die Graphen — die
 * Gelegenheitsattacke ist dann die Regel „Opportunity attack“ und keine
 * Zeile Code. Ist sie aus, gilt der Code wie bisher. Nie beide.
 *
 * Kein `eval`, nichts geschrieben: eine Folge ist ein Angebot, das jemand
 * annimmt, oder ein Hinweis im Ergebnis des Zugs.
 */

import { entityName } from "./entity.js";
import type { Cell } from "./movement.js";
import {
  graphFromArticle,
  type RuleCreature,
  type RuleGraph,
  type RuleOutcome,
  type RuleRunResult,
} from "./ruleGraph.js";
import type { Entity } from "./types.js";
import { cellFeet, type PlanStep } from "./zugplan.js";

/** Das Feld der Kampagne (Rules & options › At the table › Rules from graphs). */
export const RULE_GRAPHS_FIELD = "ruleGraphs";

/** Laufen die Regelgraphen dieser Kampagne am Tisch? Vorgabe: nein. */
export function ruleGraphsOn(campaign: Entity | null | undefined): boolean {
  return campaign?.components?.["Campaign"]?.[RULE_GRAPHS_FIELD] === "on";
}

/**
 * **Die Graphen, die am Tisch gelten**: Regelartikel mit Graph, die an
 * sind. Welche im Stapel stehen, entscheidet der Aufrufer (`inPlay`) — hier
 * kommt nur hinein, was er schon gesiebt hat.
 */
export function tableRuleGraphs(
  articles: readonly Entity[],
  systemKeyOf: (id: string) => string | undefined = () => undefined,
): RuleGraph[] {
  return articles
    .filter((e) => {
      const g = e.components?.["Rule"]?.["graph"] as
        { nodes?: unknown; enabled?: unknown } | undefined;
      return (
        !!g &&
        Array.isArray(g.nodes) &&
        g.nodes.length > 0 &&
        g.enabled !== false
      );
    })
    .map((e) => graphFromArticle(e, systemKeyOf));
}

/** Die Kanten, deren Ziele eine Figur „kennt“: Zauber, Wahlen, Aktionen, Herkunft. */
const KENNT = new Set([
  "casts",
  "chose",
  "composedOf",
  "hasAncestry",
  "hasBackground",
  "hasClass",
]);

/**
 * **Was eine Figur beim Namen kennt** — für die Bedingung `knows`: die Ziele
 * ihrer Kanten und der ihres Statblocks (Zauber, Talente, Aktionen,
 * Herkunft) und einen Schritt weiter, was diese gewähren (`grants`). Ein
 * Schritt, nicht mehr: ein Talent, das ein Merkmal gewährt, das wieder
 * etwas gewährt, kennt man am Tisch nicht.
 */
export function knownNames(
  figure: Entity,
  statblock: Entity | null,
  byId: ReadonlyMap<string, Entity>,
): string[] {
  const namen = new Set<string>();
  for (const quelle of [figure, statblock]) {
    for (const r of quelle?.relations ?? []) {
      if (!KENNT.has(r.type)) continue;
      const ziel = byId.get(r.to);
      if (!ziel) continue;
      namen.add(entityName(ziel));
      for (const g of ziel.relations ?? [])
        if (g.type === "grants") {
          const gewaehrt = byId.get(g.to);
          if (gewaehrt) namen.add(entityName(gewaehrt));
        }
    }
  }
  return [...namen].filter(Boolean);
}

/** Was der Zugplan über eine Kreatur weiss, bevor sie zur `RuleCreature` wird. */
export interface TableCreatureInput {
  entity: Entity;
  /** Die Werte des Statblocks (`Statblock` und `Abilities` als eine Karte). */
  stats: Record<string, unknown>;
  cell: Cell;
  reach: number;
  reactionFree: boolean;
  side: string;
  knows: readonly string[];
  /** Hat in diesem Zug schon Disengage gewählt. */
  disengaged?: boolean;
}

const zahl = (v: unknown): number | undefined => {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? Number(v)
        : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/**
 * **Die Kreatur für den Lauf.** Die Werte, die eine Regel lesen darf:
 * `hp`, `maxHp`, `hpTemp`, `ac`, `reach`, `reactionFree`, `disengaged`,
 * `concentrating`, `prone` und `slots1` … `slots9` (Plätze übrig). Was die
 * Figur nicht sagt, fehlt — eine Bedingung darauf ist dann „nicht zu
 * entscheiden“ und bietet nichts an. Die Stellung ist das Feld; den
 * Abstand rechnet `tableDistance` im Raster.
 */
export function tableCreature(i: TableCreatureInput): RuleCreature {
  const vitals = (i.entity.components?.["Vitals"] ?? {}) as Record<
    string,
    unknown
  >;
  const v: Record<string, number> = {
    reach: i.reach,
    reactionFree: i.reactionFree ? 1 : 0,
    disengaged: i.disengaged ? 1 : 0,
  };
  const maxHp = zahl(i.stats["hp"]);
  if (maxHp !== undefined) v["maxHp"] = maxHp;
  const hp = zahl(vitals["hp"]) ?? maxHp;
  if (hp !== undefined) v["hp"] = hp;
  const temp = zahl(vitals["hpTemp"]);
  if (temp !== undefined) v["hpTemp"] = temp;
  const ac = zahl(i.stats["ac"]);
  if (ac !== undefined) v["ac"] = ac;
  const konz = vitals["concentration"];
  v["concentrating"] =
    konz !== undefined && konz !== null && konz !== "" && konz !== false
      ? 1
      : 0;
  const zustaende = Array.isArray(vitals["conditions"])
    ? (vitals["conditions"] as unknown[]).map((c) => String(c).toLowerCase())
    : [];
  v["prone"] = zustaende.some((c) => c.includes("prone")) ? 1 : 0;
  const plaetze = Array.isArray(i.stats["spellSlots"])
    ? (i.stats["spellSlots"] as unknown[])
    : [];
  const genutzt = Array.isArray(vitals["slotsUsed"])
    ? (vitals["slotsUsed"] as unknown[])
    : [];
  for (let g = 1; g <= 9; g++) {
    const n = zahl(plaetze[g - 1]);
    if (n !== undefined)
      v[`slots${g}`] = Math.max(0, n - (zahl(genutzt[g - 1]) ?? 0));
  }
  return {
    id: i.entity.id,
    name: entityName(i.entity),
    knows: [...i.knows],
    values: v,
    x: i.cell.x,
    y: i.cell.y,
    side: i.side,
  };
}

/** Der Abstand am Tisch: Felder im Raster, 5-10-5, in Fuss. */
export function tableDistance(a: RuleCreature, b: RuleCreature): number {
  return cellFeet({ x: a.x, y: a.y }, { x: b.x, y: b.y });
}

/** Wer eine Reichweite hat, die ein Weg verlassen kann. */
export interface ReachHolder {
  id: string;
  cell: Cell;
  reach: number;
}

/**
 * **Wo ein Weg eine Reichweite verlässt** — das Ereignis `leavesReach`, je
 * Kreatur das erste Mal im Plan. Anders als `opportunityAttacks` fragt es
 * nicht, ob Disengage gilt oder wer Gegner ist: das entscheidet die Regel
 * (`actor.disengaged`, `sameSide`). `disengaged` sagt, ob vor diesem Weg
 * Disengage gewählt wurde.
 */
export function reachExits(
  steps: readonly PlanStep[],
  holders: readonly ReachHolder[],
): {
  step: string;
  index: number;
  holder: string;
  from: Cell;
  disengaged: boolean;
}[] {
  const out: {
    step: string;
    index: number;
    holder: string;
    from: Cell;
    disengaged: boolean;
  }[] = [];
  const schon = new Set<string>();
  let disengaged = false;
  for (const s of steps) {
    if (s.kind === "act") {
      if (s.tile === "std:disengage") disengaged = true;
      continue;
    }
    for (let k = 0; k + 1 < s.path.length; k++) {
      const a = s.path[k]!;
      const b = s.path[k + 1]!;
      for (const h of holders) {
        if (schon.has(h.id)) continue;
        if (cellFeet(a, h.cell) <= h.reach && cellFeet(b, h.cell) > h.reach) {
          schon.add(h.id);
          out.push({ step: s.id, index: k, holder: h.id, from: a, disengaged });
        }
      }
    }
  }
  return out;
}

/** Ein Angebot an eine Kreatur: eine Reaktion, die jemand annimmt oder lässt. */
export interface RuleOffer {
  /** Eindeutig je Zug: Schritt, Phase, Kreatur, Regel — jedes Angebot einmal. */
  key: string;
  rule: string;
  ruleName: string;
  reactor: string;
  reactorName: string;
  /** Was angeboten wird („Shield (+5 AC until your next turn)“). */
  offer: string;
  against?: string;
  /** Annehmen heisst: ein Nahkampfangriff gegen `against`. */
  strike?: boolean;
}

/**
 * **Aus einem Lauf werden Angebote und Hinweise.** Eine angebotene Reaktion
 * wird ein Angebot (nach Regel und Kreatur einmal); jede andere Folge —
 * Effekt, Sperre, Wert — ein Satz im Ergebnis des Zugs, mit dem Namen der
 * Regel davor. Geschrieben wird davon nichts: Effekte und Werte setzt die
 * Leitung, bis die Folgen selbst wirken (REQ-357, Schritt 3).
 */
export function offersFrom(
  run: RuleRunResult,
  scope: { key: string; actor: string; target?: string },
  names: ReadonlyMap<string, string>,
): { offers: RuleOffer[]; notes: string[] } {
  const offers: RuleOffer[] = [];
  const notes: string[] = [];
  const rolle = (
    o: RuleOutcome & { kind: "offerReaction" },
    self: string,
  ): string | undefined =>
    o.against === "self"
      ? self
      : o.against === "actor"
        ? scope.actor
        : scope.target;
  for (const f of run.firings) {
    if (f.outcome.kind === "offerReaction") {
      const key = `${scope.key}:${f.self}:${f.rule}`;
      if (offers.some((o) => o.key === key)) continue;
      const gegen = rolle(f.outcome, f.self);
      offers.push({
        key,
        rule: f.rule,
        ruleName: f.ruleName,
        reactor: f.self,
        reactorName: names.get(f.self) ?? f.self,
        offer: f.outcome.name,
        ...(gegen ? { against: gegen } : {}),
        ...(f.outcome.strike ? { strike: true } : {}),
      });
    } else {
      const satz = `${f.ruleName}: ${f.text}`;
      if (!notes.includes(satz)) notes.push(satz);
    }
  }
  return { offers, notes };
}
