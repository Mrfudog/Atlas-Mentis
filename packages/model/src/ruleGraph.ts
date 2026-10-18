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

export interface RuleGraph {
  id: string;
  name: string;
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
      const scope: Scope = { self, actor: byId.get(event.actor), target: event.target ? byId.get(event.target) : undefined };
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

/**
 * Die beiden Beispiele der Aufgabe, fertig gebaut. Snatch Punisher ist hier
 * als Hausregel gelesen: wer in Reichweite einen Gegenstand aufhebt, fängt
 * sich einen Nahkampfangriff ein.
 */
export function exampleRuleGraphs(): RuleGraph[] {
  return [
    {
      id: 'hellish-rebuke',
      name: 'Hellish Rebuke',
      enabled: true,
      nodes: [
        { id: 't', kind: 'trigger', x: 20, y: 40, on: 'hit' },
        { id: 'c1', kind: 'condition', x: 250, y: 40, test: { kind: 'same', a: 'self', b: 'target' } },
        { id: 'c2', kind: 'condition', x: 480, y: 40, test: { kind: 'knows', who: 'self', name: 'Hellish Rebuke' } },
        { id: 'c3', kind: 'condition', x: 710, y: 40, test: { kind: 'compare', left: 'self.reactionFree', op: '=', right: '1' } },
        { id: 'c4', kind: 'condition', x: 250, y: 190, test: { kind: 'compare', left: 'distance', op: '<=', right: '60' } },
        { id: 'o', kind: 'outcome', x: 480, y: 190, then: { kind: 'offerReaction', name: 'Hellish Rebuke', to: 'self', against: 'actor' } },
      ],
      wires: [
        { from: 't', to: 'c1' },
        { from: 'c1', to: 'c2', port: 'yes' },
        { from: 'c2', to: 'c3', port: 'yes' },
        { from: 'c3', to: 'c4', port: 'yes' },
        { from: 'c4', to: 'o', port: 'yes' },
      ],
    },
    {
      id: 'snatch-punisher',
      name: 'Snatch Punisher',
      enabled: true,
      nodes: [
        { id: 't', kind: 'trigger', x: 20, y: 40, on: 'picksUpObject' },
        { id: 'c1', kind: 'condition', x: 250, y: 40, test: { kind: 'same', a: 'self', b: 'actor', not: true } },
        { id: 'c2', kind: 'condition', x: 480, y: 40, test: { kind: 'knows', who: 'self', name: 'Snatch Punisher' } },
        { id: 'c3', kind: 'condition', x: 710, y: 40, test: { kind: 'compare', left: 'distance', op: '<=', right: 'self.reach' } },
        { id: 'c4', kind: 'condition', x: 250, y: 190, test: { kind: 'compare', left: 'self.reactionFree', op: '=', right: '1' } },
        { id: 'o', kind: 'outcome', x: 480, y: 190, then: { kind: 'offerReaction', name: 'Melee attack', to: 'self', against: 'actor' } },
      ],
      wires: [
        { from: 't', to: 'c1' },
        { from: 'c1', to: 'c2', port: 'yes' },
        { from: 'c2', to: 'c3', port: 'yes' },
        { from: 'c3', to: 'c4', port: 'yes' },
        { from: 'c4', to: 'o', port: 'yes' },
      ],
    },
  ];
}
