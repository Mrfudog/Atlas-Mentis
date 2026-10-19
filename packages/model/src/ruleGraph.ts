/**
 * **Regel-Builder, Versuch** (T-270, zu E-102 a und T-265): eine Regel ist
 * ein Graph aus Knoten — **Auslöser** → **Bedingung** → **Folge** —, wie in
 * n8n oder Node-RED. Der Graph ist Daten; ausgewertet wird er hier, ohne
 * `eval`: Ausdrücke gehen nach dem Einsetzen der Zahlen an `evalArith`.
 *
 * Ein Experiment hinter dem Schalter `experiments.ruleBuilder`: nichts
 * Bestehendes liest diese Datei, und der Probelauf zeigt nur an — er
 * schreibt nichts und ändert keine Initiative.
 *
 * Gerechnet wird je **Selbst**: jede Kreatur der Szene ist einmal `self`,
 * und die Regel fragt, ob sie für diese Kreatur feuert. Hellish Rebuke ist
 * so „ich wurde getroffen und kenne den Zauber“, nicht „irgendwer wurde
 * getroffen“.
 */

import { evalArith } from './calc.js';
import { entityName } from './entity.js';
import type { Entity } from './types.js';

/** Die Auslöser, aus denen ein Knoten wählt (vgl. E-093). */
export const RULE_TRIGGERS = [
  { key: 'attacked', label: 'is attacked' },
  { key: 'hit', label: 'is hit by an attack' },
  { key: 'missed', label: 'is missed by an attack' },
  { key: 'damaged', label: 'takes damage' },
  { key: 'picksUpObject', label: 'picks up an object' },
  { key: 'leavesReach', label: 'leaves reach' },
  { key: 'entersReach', label: 'enters reach' },
  { key: 'castsSpell', label: 'casts a spell' },
  { key: 'turnStart', label: 'starts its turn' },
  { key: 'turnEnd', label: 'ends its turn' },
] as const;
export type RuleTriggerKey = (typeof RULE_TRIGGERS)[number]['key'];

/** Wer in einem Ereignis vorkommt: wer handelt, wen es trifft, für wen gerechnet wird. */
export type RuleRole = 'self' | 'actor' | 'target';
export const RULE_ROLES: readonly RuleRole[] = ['self', 'actor', 'target'];

export const RULE_COMPARATORS = ['<', '<=', '=', '!=', '>=', '>'] as const;
export type RuleComparator = (typeof RULE_COMPARATORS)[number];

/** Was eine Bedingung prüft. */
export type RuleTest =
  /** Zwei Rechnungen vergleichen: `distance <= 60`, `self.reactionFree = 1`. */
  | { kind: 'compare'; left: string; op: RuleComparator; right: string }
  /** Eine Rolle kennt etwas (Zauber, Fähigkeit) beim Namen. */
  | { kind: 'knows'; who: RuleRole; name: string }
  /** Zwei Rollen sind dieselbe Kreatur (oder nicht). */
  | { kind: 'same'; a: RuleRole; b: RuleRole; not?: boolean };

/** Was eine Regel auslöst — im Versuch nur angezeigt. */
export type RuleOutcome =
  | { kind: 'offerReaction'; name: string; to: RuleRole; against: RuleRole }
  | { kind: 'applyEffect'; name: string; to: RuleRole }
  | { kind: 'blockAction'; action: string; reason: string; to: RuleRole }
  | { kind: 'changeValue'; field: string; expr: string; to: RuleRole };

export type RuleNode =
  | { id: string; kind: 'trigger'; x: number; y: number; on: RuleTriggerKey }
  | { id: string; kind: 'condition'; x: number; y: number; test: RuleTest }
  | { id: string; kind: 'outcome'; x: number; y: number; then: RuleOutcome };

/** Eine Verbindung; aus einer Bedingung gehen `yes` und `no`. */
export interface RuleWire {
  from: string;
  to: string;
  port?: 'yes' | 'no';
}

/**
 * **Engines** (T-265): das Rechenwerk, zu dem eine Regel gehört. Im Versuch
 * nur eine Ordnung für die Übersicht; mit E-102 (a) wird daraus, welche
 * Laufzeit die Regel liest.
 */
export const RULE_ENGINES = [
  { key: 'reactions', label: 'Reactions' },
  { key: 'turn', label: 'Turn & actions' },
  { key: 'hands', label: 'Hands & blocking' },
  { key: 'hitPoints', label: 'Hit points & damage' },
  { key: 'spellcasting', label: 'Spellcasting' },
  { key: 'movement', label: 'Movement & reach' },
  { key: 'other', label: 'Other' },
] as const;
export type RuleEngineKey = (typeof RULE_ENGINES)[number]['key'];

export interface RuleGraph {
  id: string;
  name: string;
  /** Das System (`Rule.key` des System-Artikels); ohne Angabe `other`. */
  engine?: string;
  /** Aus heisst: der Probelauf überspringt sie. */
  enabled: boolean;
  nodes: RuleNode[];
  wires: RuleWire[];
}

/** Eine Kreatur im Probelauf: was die Bedingungen über sie wissen. */
export interface RuleCreature {
  id: string;
  name: string;
  /** Was sie kennt — Zauber, Fähigkeiten, beim Namen. */
  knows: string[];
  /** Zahlen, die eine Rechnung lesen darf (`hp`, `reach`, `reactionFree` …). */
  values: Record<string, number>;
  /** Stellung in Fuss — daraus `distance`. */
  x: number;
  y: number;
}

export interface RuleEvent {
  on: RuleTriggerKey;
  actor: string;
  target?: string;
  /** Eine Zahl des Ereignisses — Schaden, Zaubergrad … —, in Rechnungen `amount`. */
  amount?: number;
}

export interface RuleFiring {
  rule: string;
  ruleName: string;
  self: string;
  outcome: RuleOutcome;
  /** Für die Anzeige: die Namen statt der Rollen. */
  text: string;
}

export interface RuleTraceStep {
  node: string;
  /** `true`/`false` bei Bedingungen, `null`: nicht zu entscheiden (fehlender Wert). */
  result: boolean | null;
  note?: string;
}

export interface RuleRun {
  rule: string;
  self: string;
  steps: RuleTraceStep[];
}

export interface RuleRunResult {
  firings: RuleFiring[];
  /** Je Regel und Selbst der Weg durch den Graphen — auch, wo nichts feuerte. */
  runs: RuleRun[];
  /** Was an den Graphen nicht stimmt (fehlender Knoten, Kreis). */
  problems: string[];
}

interface Scope {
  self: RuleCreature;
  actor: RuleCreature | undefined;
  target: RuleCreature | undefined;
  amount?: number;
}

const who = (s: Scope, r: RuleRole): RuleCreature | undefined => s[r];

const dist = (a: RuleCreature | undefined, b: RuleCreature | undefined): number | undefined =>
  a && b ? Math.round(Math.hypot(a.x - b.x, a.y - b.y)) : undefined;

/**
 * Die Namen, die eine Rechnung kennt: `distance` (Selbst zum Handelnden),
 * `distanceToTarget`, und `<rolle>.<wert>` aus den Zahlen der Kreatur.
 */
export function ruleVariables(s: Scope): Record<string, number> {
  const v: Record<string, number> = {};
  if (s.amount !== undefined && Number.isFinite(s.amount)) v['amount'] = s.amount;
  const d = dist(s.self, s.actor);
  if (d !== undefined) v['distance'] = d;
  const dt = dist(s.self, s.target);
  if (dt !== undefined) v['distanceToTarget'] = dt;
  for (const r of RULE_ROLES) {
    const c = who(s, r);
    if (!c) continue;
    for (const [k, n] of Object.entries(c.values)) if (Number.isFinite(n)) v[`${r}.${k}`] = n;
  }
  return v;
}

/**
 * Setzt die Zahlen für die Namen ein und rechnet mit `evalArith`. Ein
 * unbekannter Name gibt `null` — „nicht zu entscheiden“, keine 0.
 */
export function evalRuleExpr(expr: string, vars: Record<string, number>): number | null {
  let fehlt = false;
  const eingesetzt = String(expr).replace(/[A-Za-z_][\w.]*/g, (name) => {
    const n = vars[name];
    if (n === undefined) {
      fehlt = true;
      return '0';
    }
    return `(${n})`;
  });
  if (fehlt) return null;
  return evalArith(eingesetzt);
}

function compare(a: number, op: RuleComparator, b: number): boolean {
  switch (op) {
    case '<': return a < b;
    case '<=': return a <= b;
    case '=': return a === b;
    case '!=': return a !== b;
    case '>=': return a >= b;
    case '>': return a > b;
  }
}

const norm = (s: string) => s.trim().toLowerCase();

export function evalRuleTest(test: RuleTest, s: Scope): boolean | null {
  switch (test.kind) {
    case 'compare': {
      const vars = ruleVariables(s);
      const a = evalRuleExpr(test.left, vars);
      const b = evalRuleExpr(test.right, vars);
      if (a === null || b === null) return null;
      return compare(a, test.op, b);
    }
    case 'knows': {
      const c = who(s, test.who);
      if (!c) return null;
      return c.knows.some((k) => norm(k) === norm(test.name));
    }
    case 'same': {
      const a = who(s, test.a);
      const b = who(s, test.b);
      if (!a || !b) return test.not ? true : false;
      return test.not ? a.id !== b.id : a.id === b.id;
    }
  }
}

/** Ein Satz für einen Knoten — für die Leinwand und die Spur. */
export function describeRuleNode(n: RuleNode): string {
  switch (n.kind) {
    case 'trigger':
      return `When a creature ${RULE_TRIGGERS.find((t) => t.key === n.on)?.label ?? n.on}`;
    case 'condition': {
      const t = n.test;
      if (t.kind === 'compare') return `${t.left} ${t.op} ${t.right}`;
      if (t.kind === 'knows') return `${t.who} knows “${t.name}”`;
      return `${t.a} ${t.not ? 'is not' : 'is'} ${t.b}`;
    }
    case 'outcome': {
      const o = n.then;
      if (o.kind === 'offerReaction') return `Offer reaction “${o.name}” to ${o.to} (target: ${o.against})`;
      if (o.kind === 'applyEffect') return `Apply “${o.name}” to ${o.to}`;
      if (o.kind === 'blockAction') return `Block “${o.action}” for ${o.to}: ${o.reason}`;
      return `Set ${o.to}.${o.field} = ${o.expr}`;
    }
  }
}

function outcomeText(o: RuleOutcome, s: Scope): string {
  const n = (r: RuleRole) => who(s, r)?.name ?? `(${r})`;
  switch (o.kind) {
    case 'offerReaction': return `${n(o.to)} may react with “${o.name}” against ${n(o.against)}`;
    case 'applyEffect': return `${n(o.to)} gets “${o.name}”`;
    case 'blockAction': return `${n(o.to)} cannot ${o.action}: ${o.reason}`;
    case 'changeValue': {
      const v = evalRuleExpr(o.expr, ruleVariables(s));
      return `${n(o.to)}.${o.field} becomes ${v ?? `“${o.expr}” (undecided)`}`;
    }
  }
}

/** Was an einem Graphen nicht stimmt — vor dem Lauf, auch für den Editor. */
export function ruleGraphProblems(g: RuleGraph): string[] {
  const p: string[] = [];
  const ids = new Set(g.nodes.map((n) => n.id));
  if (ids.size !== g.nodes.length) p.push(`${g.name}: two nodes share an id`);
  if (!g.nodes.some((n) => n.kind === 'trigger')) p.push(`${g.name}: no trigger`);
  for (const w of g.wires) {
    if (!ids.has(w.from) || !ids.has(w.to)) p.push(`${g.name}: a wire points at a missing node`);
    const to = g.nodes.find((n) => n.id === w.to);
    if (to?.kind === 'trigger') p.push(`${g.name}: a wire leads into a trigger`);
  }
  return p;
}

/** Grenze gegen Kreise: ein Knoten wird je Lauf höchstens so oft besucht. */
const MAX_STEPS = 200;

/**
 * **Der Probelauf:** welche Regeln bei diesem Ereignis für welche Kreatur
 * feuern und was sie anbieten. Nur Anzeige — es wird nichts gespeichert.
 */
export function runRules(rules: readonly RuleGraph[], event: RuleEvent, creatures: readonly RuleCreature[]): RuleRunResult {
  const byId = new Map(creatures.map((c) => [c.id, c]));
  const out: RuleRunResult = { firings: [], runs: [], problems: [] };
  for (const g of rules) {
    out.problems.push(...ruleGraphProblems(g));
    if (!g.enabled) continue;
    const nodes = new Map(g.nodes.map((n) => [n.id, n]));
    const starts = g.nodes.filter((n) => n.kind === 'trigger' && n.on === event.on);
    if (!starts.length) continue;
    for (const self of creatures) {
      const scope: Scope = { self, actor: byId.get(event.actor), target: event.target ? byId.get(event.target) : undefined, amount: event.amount };
      const run: RuleRun = { rule: g.id, self: self.id, steps: [] };
      const besucht = new Set<string>();
      const queue = starts.map((n) => n.id);
      let schritte = 0;
      while (queue.length && schritte++ < MAX_STEPS) {
        const id = queue.shift() as string;
        if (besucht.has(id)) continue;
        besucht.add(id);
        const n = nodes.get(id);
        if (!n) continue;
        let port: 'yes' | 'no' | undefined;
        if (n.kind === 'trigger') {
          run.steps.push({ node: id, result: true });
        } else if (n.kind === 'condition') {
          const r = evalRuleTest(n.test, scope);
          run.steps.push({ node: id, result: r, ...(r === null ? { note: 'undecided — a value is missing' } : {}) });
          /* Nicht zu entscheiden geht keinen Weg: eine Reaktion anzubieten,
             weil eine Zahl fehlt, wäre die irreführende 0 der Regeln. */
          if (r === null) continue;
          port = r ? 'yes' : 'no';
        } else {
          run.steps.push({ node: id, result: true });
          out.firings.push({ rule: g.id, ruleName: g.name, self: self.id, outcome: n.then, text: outcomeText(n.then, scope) });
        }
        for (const w of g.wires) {
          if (w.from !== id) continue;
          if (n.kind === 'condition' && (w.port ?? 'yes') !== port) continue;
          queue.push(w.to);
        }
      }
      if (run.steps.length > 1 || out.firings.some((f) => f.rule === g.id && f.self === self.id)) out.runs.push(run);
    }
  }
  return out;
}

/** Ob ein unbekannter Wert ein Graph ist — was aus den Einstellungen kommt, ist ungeprüft. */
export function isRuleGraph(v: unknown): v is RuleGraph {
  if (!v || typeof v !== 'object') return false;
  const g = v as Partial<RuleGraph>;
  return (
    typeof g.id === 'string' &&
    typeof g.name === 'string' &&
    Array.isArray(g.nodes) &&
    Array.isArray(g.wires) &&
    g.nodes.every((n) => n && typeof n === 'object' && typeof (n as RuleNode).id === 'string' && ['trigger', 'condition', 'outcome'].includes((n as RuleNode).kind))
  );
}

/* ------------------------------------------------------------ Beispiele */

type Knoten = [id: string, was: RuleTriggerKey | RuleTest | RuleOutcome, spalte: number, reihe: number];
type Draht = [from: string, to: string, port?: 'yes' | 'no'];

const istTest = (v: RuleTest | RuleOutcome): v is RuleTest => v.kind === 'compare' || v.kind === 'knows' || v.kind === 'same';

/** Ein Beispiel aus Knoten im Raster (230 × 140) — damit die Beispiele lesbar bleiben. */
function bau(id: string, name: string, engine: RuleEngineKey, knoten: Knoten[], draehte: Draht[]): RuleGraph {
  return {
    id,
    name,
    engine,
    enabled: true,
    nodes: knoten.map(([nid, was, sp, re]): RuleNode => {
      const x = 20 + sp * 230;
      const y = 30 + re * 130;
      if (typeof was === 'string') return { id: nid, kind: 'trigger', x, y, on: was };
      return istTest(was) ? { id: nid, kind: 'condition', x, y, test: was } : { id: nid, kind: 'outcome', x, y, then: was };
    }),
    wires: draehte.map(([from, to, port]) => (port ? { from, to, port } : { from, to })),
  };
}

const cmp = (left: string, op: RuleComparator, right: string): RuleTest => ({ kind: 'compare', left, op, right });
const kennt = (name: string, who: RuleRole = 'self'): RuleTest => ({ kind: 'knows', who, name });
const ist = (a: RuleRole, b: RuleRole, not = false): RuleTest => ({ kind: 'same', a, b, ...(not ? { not: true } : {}) });
const reaktion = (name: string, against: RuleRole = 'actor'): RuleOutcome => ({ kind: 'offerReaction', name, to: 'self', against });
const effekt = (name: string, to: RuleRole = 'self'): RuleOutcome => ({ kind: 'applyEffect', name, to });

/**
 * **Beispielregeln** zum Ausprobieren, nach Engine. Hellish Rebuke und
 * Snatch Punisher sind die beiden der Aufgabe (Snatch Punisher hier als
 * Hausregel gelesen: wer in Reichweite etwas aufhebt, fängt sich einen
 * Nahkampfangriff ein); die übrigen sind bekannte Fälle mit Ja- und
 * Nein-Zweigen. Eigene Kurzsätze, kein Buchtext.
 */
export function exampleRuleGraphs(): RuleGraph[] {
  return [
    bau('hellish-rebuke', 'Hellish Rebuke', 'reactions',
      [['t', 'hit', 0, 0], ['c1', ist('self', 'target'), 1, 0], ['c2', kennt('Hellish Rebuke'), 2, 0], ['c3', cmp('self.reactionFree', '=', '1'), 3, 0],
       ['c4', cmp('distance', '<=', '60'), 1, 1], ['o', reaktion('Hellish Rebuke'), 2, 1]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'yes'], ['c3', 'c4', 'yes'], ['c4', 'o', 'yes']]),
    bau('snatch-punisher', 'Snatch Punisher', 'reactions',
      [['t', 'picksUpObject', 0, 0], ['c1', ist('self', 'actor', true), 1, 0], ['c2', kennt('Snatch Punisher'), 2, 0], ['c3', cmp('distance', '<=', 'self.reach'), 3, 0],
       ['c4', cmp('self.reactionFree', '=', '1'), 1, 1], ['o', reaktion('Melee attack'), 2, 1]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'yes'], ['c3', 'c4', 'yes'], ['c4', 'o', 'yes']]),
    bau('opportunity-attack', 'Opportunity attack', 'movement',
      [['t', 'leavesReach', 0, 0], ['c1', ist('self', 'actor', true), 1, 0], ['c2', cmp('actor.disengaged', '=', '1'), 2, 0], ['c3', cmp('self.reactionFree', '=', '1'), 3, 0],
       ['c4', cmp('distance', '<=', 'self.reach'), 3, 1], ['o', reaktion('Opportunity attack'), 2, 1], ['o2', effekt('Leaves without provoking (Disengage)', 'actor'), 2, 2]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'no'], ['c2', 'o2', 'yes'], ['c3', 'c4', 'yes'], ['c4', 'o', 'yes']]),
    bau('sentinel', 'Sentinel', 'reactions',
      [['t', 'attacked', 0, 0], ['c1', ist('self', 'actor', true), 1, 0], ['c2', ist('self', 'target', true), 2, 0], ['c3', kennt('Sentinel'), 3, 0],
       ['c4', cmp('distance', '<=', 'self.reach'), 1, 1], ['c5', cmp('self.reactionFree', '=', '1'), 2, 1], ['o', reaktion('Sentinel: melee attack'), 3, 1]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'yes'], ['c3', 'c4', 'yes'], ['c4', 'c5', 'yes'], ['c5', 'o', 'yes']]),
    bau('shield', 'Shield', 'spellcasting',
      [['t', 'hit', 0, 0], ['c1', ist('self', 'target'), 1, 0], ['c2', kennt('Shield'), 2, 0], ['c3', cmp('self.reactionFree', '=', '1'), 3, 0],
       ['c4', cmp('self.slots1', '>=', '1'), 1, 1], ['o', reaktion('Shield (+5 AC until your next turn)'), 2, 1], ['o2', effekt('Shield unavailable: no 1st-level slot'), 2, 2]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'yes'], ['c3', 'c4', 'yes'], ['c4', 'o', 'yes'], ['c4', 'o2', 'no']]),
    bau('counterspell', 'Counterspell', 'spellcasting',
      [['t', 'castsSpell', 0, 0], ['c1', ist('self', 'actor', true), 1, 0], ['c2', kennt('Counterspell'), 2, 0], ['c3', cmp('distance', '<=', '60'), 3, 0],
       ['c4', cmp('self.reactionFree', '=', '1'), 1, 1], ['c5', cmp('self.slots3', '>=', '1'), 2, 1], ['c6', cmp('amount', '<=', '3'), 3, 1],
       ['o', reaktion('Counterspell: the spell fails'), 2, 2], ['o2', reaktion('Counterspell: ability check, DC 10 + spell level'), 3, 2]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'yes'], ['c3', 'c4', 'yes'], ['c4', 'c5', 'yes'], ['c5', 'c6', 'yes'], ['c6', 'o', 'yes'], ['c6', 'o2', 'no']]),
    bau('uncanny-dodge', 'Uncanny Dodge', 'reactions',
      [['t', 'hit', 0, 0], ['c1', ist('self', 'target'), 1, 0], ['c2', kennt('Uncanny Dodge'), 2, 0], ['c3', cmp('self.reactionFree', '=', '1'), 3, 0],
       ['o', reaktion('Uncanny Dodge: halve the damage'), 3, 1]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'yes'], ['c3', 'o', 'yes']]),
    bau('concentration', 'Concentration check', 'hitPoints',
      [['t', 'damaged', 0, 0], ['c1', ist('self', 'target'), 1, 0], ['c2', cmp('self.concentrating', '=', '1'), 2, 0], ['c3', cmp('amount / 2', '>', '10'), 3, 0],
       ['o1', { kind: 'changeValue', field: 'concentrationDC', expr: 'amount / 2', to: 'self' }, 2, 1],
       ['o2', { kind: 'changeValue', field: 'concentrationDC', expr: '10', to: 'self' }, 3, 1], ['o3', effekt('Constitution save to keep concentration'), 1, 1]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'yes'], ['c2', 'o3', 'yes'], ['c3', 'o1', 'yes'], ['c3', 'o2', 'no']]),
    bau('drop-to-zero', 'Dropping to 0 hit points', 'hitPoints',
      [['t', 'damaged', 0, 0], ['c1', ist('self', 'target'), 1, 0], ['c2', cmp('self.hp - amount', '<=', '0'), 2, 0], ['c3', cmp('amount - self.hp', '>=', 'self.maxHp'), 3, 0],
       ['o1', effekt('Dead (massive damage)'), 3, 1], ['o2', effekt('Unconscious, dying'), 2, 1], ['o3', { kind: 'changeValue', field: 'hp', expr: '0', to: 'self' }, 1, 1]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'yes'], ['c2', 'o3', 'yes'], ['c3', 'o1', 'yes'], ['c3', 'o2', 'no']]),
    bau('regeneration', 'Regeneration', 'hitPoints',
      [['t', 'turnStart', 0, 0], ['c1', ist('self', 'actor'), 1, 0], ['c2', kennt('Regeneration'), 2, 0], ['c3', cmp('self.hp', '>', '0'), 3, 0],
       ['c4', cmp('self.fireOrAcid', '=', '0'), 3, 1], ['o1', { kind: 'changeValue', field: 'hp', expr: 'self.hp + 10', to: 'self' }, 2, 1], ['o2', effekt('No regeneration this turn (fire or acid)'), 2, 2]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'yes'], ['c3', 'c4', 'yes'], ['c4', 'o1', 'yes'], ['c4', 'o2', 'no']]),
    bau('somatic-hand', 'Somatic components need a free hand', 'hands',
      [['t', 'castsSpell', 0, 0], ['c1', ist('self', 'actor'), 1, 0], ['c2', cmp('self.freeHands', '<', '1'), 2, 0], ['c3', kennt('War Caster'), 3, 0],
       ['o1', { kind: 'blockAction', action: 'cast a spell with somatic components', reason: 'no free hand', to: 'self' }, 3, 1],
       ['o2', effekt('Somatic components with hands full (War Caster)'), 2, 1]],
      [['t', 'c1'], ['c1', 'c2', 'yes'], ['c2', 'c3', 'yes'], ['c3', 'o1', 'no'], ['c3', 'o2', 'yes']]),
    bau('turn-start', 'Start of turn', 'turn',
      [['t', 'turnStart', 0, 0], ['c1', ist('self', 'actor'), 1, 0], ['o1', { kind: 'changeValue', field: 'reactionFree', expr: '1', to: 'self' }, 2, 0],
       ['c2', cmp('self.prone', '=', '1'), 1, 1], ['o2', effekt('Standing up costs half your speed'), 2, 1],
       ['c3', cmp('self.hp', '<=', '0'), 1, 2], ['o3', effekt('Death saving throw'), 2, 2]],
      [['t', 'c1'], ['c1', 'o1', 'yes'], ['c1', 'c2', 'yes'], ['c2', 'o2', 'yes'], ['c1', 'c3', 'yes'], ['c3', 'o3', 'yes']]),
  ];
}

/* ------------------------------------------------------------ Lesbar */

/**
 * **Die Regel in Worten** (T-270): je Folge ein Satz — „When a creature is
 * hit by an attack, if self is target and self knows “Shield”: offer
 * reaction …". Der Weg vom Auslöser zur Folge sammelt die Bedingungen, ein
 * Nein-Ausgang steht als „not …". Eigene Worte aus dem Graphen, kein
 * Buchtext — der steht im Artikel, auf den die Regel verweist.
 */
export function describeRuleGraph(g: RuleGraph): string {
  const nodes = new Map(g.nodes.map((n) => [n.id, n]));
  const saetze: string[] = [];
  for (const start of g.nodes.filter((n) => n.kind === 'trigger')) {
    /* Tiefensuche über die Drähte; jeder Weg trägt seine Bedingungen. */
    const stapel: { id: string; bed: string[]; besucht: Set<string> }[] = [{ id: start.id, bed: [], besucht: new Set([start.id]) }];
    while (stapel.length) {
      const { id, bed, besucht } = stapel.pop()!;
      const n = nodes.get(id);
      if (!n) continue;
      if (n.kind === 'outcome') {
        const wenn = bed.length ? `, if ${bed.slice(0, -1).join(', ')}${bed.length > 1 ? ' and ' : ''}${bed[bed.length - 1]}` : '';
        saetze.push(`${describeRuleNode(start)}${wenn}: ${describeRuleNode(n).replace(/^./, (c) => c.toLowerCase())}.`);
        continue;
      }
      for (const w of g.wires.filter((x) => x.from === id)) {
        if (besucht.has(w.to)) continue;
        const neu = n.kind === 'condition' ? [...bed, w.port === 'no' ? `not ${describeRuleNode(n)}` : describeRuleNode(n)] : bed;
        stapel.push({ id: w.to, bed: neu, besucht: new Set([...besucht, w.to]) });
      }
    }
  }
  return saetze.reverse().join(' ');
}

/* ------------------------------------------------------------ Begriffe */

/** Welche Spielbegriffe ein Auslöser voraussetzt (Wörter, wie das Glossar sie führt). */
const AUSLOESER_BEGRIFFE: Partial<Record<RuleTriggerKey, string[]>> = {
  attacked: ['attack roll'],
  hit: ['attack roll'],
  missed: ['attack roll'],
  damaged: ['damage roll', 'hit points'],
  leavesReach: ['reach', 'opportunity attack'],
  entersReach: ['reach'],
  castsSpell: ['spell slot'],
  turnStart: ['initiative'],
  turnEnd: ['initiative'],
};

/** Welche Begriffe ein Wert in einer Rechnung meint (`self.reactionFree` → Reaction). */
const WERT_BEGRIFFE: [RegExp, string[]][] = [
  [/^reactionFree$/, ['reaction']],
  [/^(reach|distance|distanceToTarget)$/, ['reach']],
  [/^(hp|maxHp)$/, ['hit points']],
  [/^slots\d$/, ['spell slot']],
  [/^concentrat/, ['concentration']],
  [/^freeHands$/, ['somatic component']],
  [/^disengaged$/, ['disengage']],
  [/^prone$/, ['prone']],
];

/**
 * **Worauf eine Regel aufbaut** (T-270): die Spielbegriffe ihrer Auslöser,
 * der Werte in ihren Bedingungen und ihrer Folgen — Wörter, die der
 * Builder gegen das Glossar hält (Begriff und Aliasse). Was ein Knoten
 * beim Namen nennt („knows Hellish Rebuke"), ist kein Begriff, sondern ein
 * Artikel, und steht nicht hier.
 */
export function ruleGraphWords(g: RuleGraph): string[] {
  const raus = new Set<string>();
  const werte = (expr: string) => {
    for (const roh of String(expr).match(/[A-Za-z_][\w.]*/g) ?? []) {
      const name = roh.split('.').pop() ?? roh;
      for (const [muster, woerter] of WERT_BEGRIFFE) if (muster.test(name)) for (const w of woerter) raus.add(w);
    }
  };
  for (const n of g.nodes) {
    if (n.kind === 'trigger') for (const w of AUSLOESER_BEGRIFFE[n.on] ?? []) raus.add(w);
    else if (n.kind === 'condition' && n.test.kind === 'compare') {
      werte(n.test.left);
      werte(n.test.right);
    } else if (n.kind === 'outcome') {
      if (n.then.kind === 'offerReaction') raus.add('reaction');
      if (n.then.kind === 'changeValue') {
        werte(n.then.field);
        werte(n.then.expr);
      }
    }
  }
  return [...raus].sort();
}

/* ------------------------------------------------------------ Am Artikel (T-270) */

/** Was am Artikel steht: `Rule.graph` — Knoten, Verbindungen, aktiv. */
interface GespeicherterGraph {
  enabled?: boolean;
  nodes?: RuleNode[];
  wires?: RuleWire[];
}

/**
 * **Der Graph eines Regelartikels** (T-270): wie ein Board seine Formen
 * trägt der Artikel seinen Graphen selbst (`Rule.graph`); das System liest
 * die Kante `partOf` auf einen System-Artikel. Ein Artikel ohne Graph gibt
 * einen leeren — der Builder zeigt ihn trotzdem und lässt ihn füllen.
 */
export function graphFromArticle(e: Entity, systemKeyOf: (id: string) => string | undefined): RuleGraph {
  const g = (e.components?.['Rule']?.['graph'] ?? {}) as GespeicherterGraph;
  const system = (e.relations ?? []).filter((r) => r.type === 'partOf').map((r) => systemKeyOf(r.to)).find(Boolean);
  return {
    id: e.id,
    name: entityName(e),
    ...(system ? { engine: system } : {}),
    enabled: g.enabled !== false,
    nodes: Array.isArray(g.nodes) ? g.nodes : [],
    wires: Array.isArray(g.wires) ? g.wires : [],
  };
}

/** Der Artikel mit dem Graphen und dem Namen aus dem Builder; das System setzt, wer die Kante umhängt. */
export function articleWithGraph(e: Entity, g: RuleGraph): Entity {
  const rule = { ...(e.components?.['Rule'] ?? {}) } as Record<string, unknown>;
  if (g.nodes.length || g.wires.length || rule['graph'] !== undefined) rule['graph'] = { enabled: g.enabled, nodes: g.nodes, wires: g.wires };
  return {
    ...e,
    components: { ...e.components, Identity: { ...(e.components?.['Identity'] ?? {}), name: g.name }, Rule: rule },
  };
}
