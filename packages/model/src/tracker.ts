/**
 * **Der Initiative-Tracker** (T-022, REQ-115, REQ-128, REQ-211–213,
 * REQ-226): ein eigenes System des Kampfes, das die Kampagne einstellt und
 * abschaltet. Kein Framework, keine Darstellung — der Server rechnet hier
 * die Züge und siebt, die Oberfläche zeichnet, was ankommt.
 *
 * Die Teilnehmer bleiben `participates`-Kanten an der Begegnung (D53),
 * `Encounter.round` und `Encounter.turn` sagen, wo der Kampf steht. Ein
 * Zugwechsel zählt die Einträge mit Dauer herunter (`tickEntries`): erst
 * das Ende des laufenden Zuges, dann der Anfang des nächsten. Dieselbe
 * Zählung nutzt die Regelwirkung (T-275); wie ein Zustand rechnet (RK,
 * Schaden), steht nicht hier.
 */
import { commonAction } from './actions.js';
import { damageAtTable, type TableDamage } from './damage.js';
import { creatureStats } from './stats.js';
import { bookSections, type BookSection } from './book.js';
import { entityName, primaryInterface } from './entity.js';
import {
  PARTICIPATES,
  initiativeOrder,
  inParty,
  participantStats,
  statblockFor,
  tickEntries,
  type FightState,
  type ParticipantProps,
  type PlayerViewRules,
  type TimedEntry,
  type TurnPoint,
  expiresAt,
  isNote,
  hpWord,
  entryActions,
  entryConditions,
} from './initiative.js';
import { resolveInstance } from './instance.js';
import type { Entity, EntityId, Registry, Relation } from './types.js';

type Lookup = ReadonlyMap<EntityId, Entity>;

/** Die Spalten des Trackers (`Campaign.initColumns`). */
export const TRACKER_COLUMNS = ['init', 'ac', 'hp', 'effects', 'actions'] as const;
export type TrackerColumn = (typeof TRACKER_COLUMNS)[number];

/** Die Knöpfe je Zeile für die Leitung (`Campaign.initQuickActions`). */
export const QUICK_ACTIONS = ['damage', 'heal', 'effect', 'delay', 'reroll', 'remove'] as const;
export type QuickAction = (typeof QUICK_ACTIONS)[number];

/**
 * **Die Initiative als Regelsystem** (T-334, E-100): ein System sagt, wie
 * Züge laufen und welche Knöpfe die Leitung je Zeile bekommt. Heute gibt
 * es eins, „D&D 5e (standard)" — ohne Verzögern, denn dafür steht keine
 * Regel im Grundregelwerk; die Hausregel kommt als eigenes System (T-336),
 * `delayTurn` bleibt dafür stehen. Gewählt wird es über `Campaign.combat`:
 * `on` ist dieses System, `off` kein Tracker — so sehen bestehende
 * Kampagnen nichts anders.
 */
export interface InitiativeSystemDef {
  key: 'dnd5e';
  label: string;
  /** Die Knöpfe je Zeile, die dieses System kennt. */
  quickActions: readonly QuickAction[];
}

export const INITIATIVE_SYSTEMS: readonly InitiativeSystemDef[] = [
  { key: 'dnd5e', label: 'D&D 5e (standard)', quickActions: ['damage', 'heal', 'effect', 'reroll', 'remove'] },
];

/**
 * **Die Einstellung der Kampagne** (Rules & options › Combat › Initiative). Was
 * fehlt, gilt wie vor T-022: Deckname, Gesundheit als Wort, alle offenen
 * Einträge.
 */
export interface InitiativeRules extends Required<PlayerViewRules> {
  /** Das Initiative-System: aus heisst kein Tracker, weder für die Leitung noch für Spielende. */
  combat: 'on' | 'off';
  /** Das System, wenn eins läuft (T-334). */
  system: InitiativeSystemDef['key'] | null;
  /** Die Aktionen der Gegner (die Regeln am Statblock): nur die Leitung, oder auch Spielende, sobald der Zug kam. */
  enemyActions: 'hidden' | 'shown';
  columns: TrackerColumn[];
  quickActions: QuickAction[];
}

export const DEFAULT_INITIATIVE_RULES: InitiativeRules = {
  combat: 'on',
  system: 'dnd5e',
  names: 'cover',
  health: 'coarse',
  effects: 'all',
  enemyActions: 'hidden',
  columns: ['init', 'ac', 'hp', 'effects'],
  quickActions: ['damage', 'heal', 'effect', 'remove'],
};

/** Das System einer Einstellung — `null`, wenn der Tracker aus ist. */
export function initiativeSystemOf(rules: Pick<InitiativeRules, 'combat'>): InitiativeSystemDef | null {
  return rules.combat === 'on' ? INITIATIVE_SYSTEMS[0]! : null;
}

const eines = <T extends string>(wert: unknown, erlaubt: readonly T[], sonst: T): T =>
  typeof wert === 'string' && (erlaubt as readonly string[]).includes(wert) ? (wert as T) : sonst;
const liste = <T extends string>(wert: unknown, erlaubt: readonly T[], sonst: T[]): T[] =>
  Array.isArray(wert) ? erlaubt.filter((x) => wert.includes(x)) : [...sonst];

/** Die Initiative-Regeln einer Kampagne (`Campaign.combat`, `init*`). */
export function initiativeRulesOf(campaign: Entity | null | undefined): InitiativeRules {
  const c = (campaign?.components?.['Campaign'] ?? {}) as Record<string, unknown>;
  const d = DEFAULT_INITIATIVE_RULES;
  const combat = eines(c['combat'], ['on', 'off'], d.combat);
  const system = initiativeSystemOf({ combat });
  /* Was das System nicht kennt, bietet es nicht an — auch wenn es an der Kampagne steht (Delay, T-334). */
  const knoepfe = liste(c['initQuickActions'], QUICK_ACTIONS, d.quickActions).filter((q) => !system || system.quickActions.includes(q));
  return {
    combat,
    system: system?.key ?? null,
    names: eines(c['initNames'], ['cover', 'real'], d.names),
    health: eines(c['initHealth'], ['none', 'coarse', 'exact'], d.health),
    effects: eines(c['initEffects'], ['all', 'party', 'none'], d.effects),
    enemyActions: eines(c['initActions'], ['hidden', 'shown'], d.enemyActions),
    columns: liste(c['initColumns'], TRACKER_COLUMNS, d.columns),
    quickActions: knoepfe,
  };
}

/* ------------------------------------------------------------ Züge */

const karteVon = (e: Entity): Record<string, unknown> => (e.components?.['Encounter'] ?? {}) as Record<string, unknown>;

/** Runde und Zug einer Begegnung. */
export function fightOf(encounter: Entity): Required<FightState> {
  const k = karteVon(encounter);
  return { round: Number(k['round']) || 0, turn: Number(k['turn']) || 0 };
}

function mitKampf(encounter: Entity, relations: Relation[], fight: Partial<FightState> & { phase?: string }): Entity {
  return {
    ...encounter,
    relations,
    components: { ...encounter.components, Encounter: { ...karteVon(encounter), ...fight } },
  };
}

const propsVon = (r: Relation): ParticipantProps => (r.props ?? {}) as ParticipantProps;

/**
 * Nach einer Änderung an der Reihe (Initiative, Teilnehmer dazu oder weg)
 * bleibt dran, wer dran war: `turn` ist ein Index, also wird er neu
 * gesucht. Ist der weg, rückt der nächste an seine Stelle.
 */
function behalteZug(entities: Lookup, vorher: Entity, relations: Relation[]): Entity {
  const { round, turn } = fightOf(vorher);
  const alt = initiativeOrder(entities, vorher.relations ?? []);
  const neu = initiativeOrder(entities, relations);
  const dran = alt[turn]?.id;
  let idx = dran ? neu.findIndex((r) => r.id === dran) : -1;
  if (idx < 0) idx = Math.min(turn, Math.max(0, neu.length - 1));
  return mitKampf(vorher, relations, round > 0 ? { turn: idx } : {});
}

/**
 * **Der nächste Zug**: das Ende des laufenden zählt herunter, dann der
 * Anfang des nächsten; nach dem letzten beginnt die nächste Runde. Vor
 * Runde 1 beginnt der Kampf mit dem ersten in der Reihe.
 */
export function nextTurn(entities: Lookup, encounter: Entity): Entity {
  let rel = [...(encounter.relations ?? [])];
  const order = initiativeOrder(entities, rel);
  if (!order.length) return encounter;
  let { round, turn } = fightOf(encounter);
  if (round > 0) {
    const jetzt = order[turn];
    if (jetzt) rel = tickEntries(rel, jetzt.id, 'end');
    turn += 1;
    if (turn >= order.length) {
      turn = 0;
      round += 1;
    }
  } else {
    round = 1;
    turn = 0;
  }
  /* Die Reihe neu, denn ein abgelaufener Eintrag ändert sie nicht — die
     Kanten-Ids bleiben, der Index gilt weiter. */
  const naechster = initiativeOrder(entities, rel)[turn];
  if (naechster) rel = tickEntries(rel, naechster.id, 'start');
  return mitKampf(encounter, rel, { round, turn, phase: 'running' });
}

/**
 * **Der vorige Zug** — zum Berichtigen, wenn jemand zu früh weitergetippt
 * hat. Er zählt nichts zurück: was abgelaufen ist, ist weg, und das ist
 * ehrlicher als ein Zurückrechnen, das bei Einträgen ohne Gedächtnis
 * raten müsste.
 */
export function previousTurn(entities: Lookup, encounter: Entity): Entity {
  const order = initiativeOrder(entities, encounter.relations ?? []);
  let { round, turn } = fightOf(encounter);
  if (round < 1 || !order.length) return encounter;
  if (turn > 0) turn -= 1;
  else if (round > 1) {
    round -= 1;
    turn = order.length - 1;
  } else return encounter;
  return mitKampf(encounter, [...(encounter.relations ?? [])], { round, turn });
}

/**
 * **Den Zug frei setzen** (T-334): wer jetzt dran ist — eine Zeile
 * („Make current"), der nächste ohne Zug („Skip") oder der erste der Reihe
 * („Back to top"). **Gezählt wird dabei nichts:** Effekte laufen nur beim
 * regulären Zugwechsel (`nextTurn`) ab. Ein Überspringen ist eine
 * Berichtigung am Tisch und kein Zug; wer übersprungen wurde, hatte
 * keinen, also endet auch nichts an seinem Ende. Nach dem letzten
 * beginnt beim Überspringen die nächste Runde, „Back to top" bleibt in
 * der Runde.
 */
export function setTurn(entities: Lookup, encounter: Entity, wohin: { edge: string } | 'skip' | 'top'): Entity {
  const rel = encounter.relations ?? [];
  const order = initiativeOrder(entities, rel);
  let { round, turn } = fightOf(encounter);
  if (round < 1 || !order.length) return encounter;
  if (wohin === 'top') turn = 0;
  else if (wohin === 'skip') {
    turn += 1;
    if (turn >= order.length) {
      turn = 0;
      round += 1;
    }
  } else {
    const idx = order.findIndex((r) => r.id === wohin.edge);
    if (idx < 0) return encounter;
    turn = idx;
  }
  return mitKampf(encounter, [...rel], { round, turn });
}

/**
 * **Verzögern** (REQ-128): wer dran ist, rückt einen Platz nach hinten,
 * und der nächste ist dran. Gespeichert wird nur die Initiative — eine
 * Zahl zwischen den beiden, hinter die er rückt —, kein eigener Stand:
 * „verzögert" ist ein Ort in der Reihe und keine Marke. Stehen die beiden
 * dahinter gleich, rückt er hinter beide.
 */
export function delayTurn(entities: Lookup, encounter: Entity): Entity {
  const rel = encounter.relations ?? [];
  const order = initiativeOrder(entities, rel);
  const { round, turn } = fightOf(encounter);
  const jetzt = order[turn];
  const naechster = order[turn + 1];
  if (round < 1 || !jetzt || !naechster) return encounter;
  const init = (r: Relation | undefined) => Number(propsVon(r ?? ({} as Relation)).init);
  const n = Number.isFinite(init(naechster)) ? init(naechster) : 0;
  const danach = order[turn + 2];
  const a = danach && Number.isFinite(init(danach)) ? init(danach) : n - 1;
  const neuInit = a < n ? (n + a) / 2 : n - 0.5;
  const neu = rel.map((r) => (r.id === jetzt.id ? { ...r, props: { ...propsVon(r), init: neuInit } } : r));
  /* Der Index bleibt — an ihm steht jetzt der nächste, und sein Zug fängt an. */
  const raus = initiativeOrder(entities, neu)[turn];
  return mitKampf(encounter, raus ? tickEntries(neu, raus.id, 'start') : neu, {});
}

/** Der Wurf eines Teilnehmers: W20 plus Geschicklichkeit des Statblocks (wie `startEncounter`). */
export function initiativeMod(entities: Lookup, to: EntityId): number {
  const t = entities.get(to);
  const sb = t ? statblockFor(entities, t) : null;
  const dex = Number(((sb ? resolveInstance(entities, sb).components?.['Abilities'] : undefined) as { dex?: unknown } | undefined)?.dex);
  return Number.isFinite(dex) ? Math.floor((dex - 10) / 2) : 0;
}

/** Was der Tracker an einer Begegnung ändert (`POST /api/encounters/:id/tracker`). */
export type TrackerOp =
  | { op: 'next' }
  | { op: 'previous' }
  | { op: 'skip' }
  | { op: 'top' }
  | { op: 'turn'; edge: string }
  | { op: 'delay' }
  | { op: 'end' }
  | { op: 'init'; edge: string; value?: number; reroll?: boolean }
  | { op: 'hp'; edge: string; delta?: number; value?: number }
  /* Schaden mit Art (T-355): nach der Abwehr, wie im Zugplan (`trackerDamage`). */
  | { op: 'damage'; edge: string; amount: number; type?: string }
  | { op: 'effect'; edge: string; entry: TimedEntry }
  | { op: 'removeEffect'; edge: string; index: number }
  | { op: 'flags'; edge: string; revealed?: boolean; identified?: boolean; ally?: boolean }
  /* `count` (T-333): so viele Kämpfer auf einmal — je einer eine eigene
     Kante, denn Trefferpunkte und Zustände stehen an der Kante. */
  | { op: 'add'; to: EntityId; init?: number; ally?: boolean; label?: string; count?: number }
  | { op: 'remove'; edge: string };

/** Wie viele Kämpfer „Add" höchstens auf einmal anlegt (T-333). */
export const MAX_ADD = 20;

export interface TrackerDeps {
  /** 1 bis 20. */
  d20: () => number;
  /** Eine neue Kanten-Id. */
  newId: () => string;
}

/** Ein Eintrag, wie er gespeichert wird: nur, was er sagt. */
function sauberEintrag(e: TimedEntry): TimedEntry | null {
  const raus: TimedEntry = {};
  if (typeof e.rule === 'string' && e.rule) raus.rule = e.rule;
  else if (typeof e.text === 'string' && e.text.trim()) raus.text = e.text.trim();
  else return null;
  const n = Number(e.rounds);
  if (e.rounds != null && Number.isFinite(n) && n > 0) raus.rounds = Math.floor(n);
  if (typeof e.anchor === 'string' && e.anchor) raus.anchor = e.anchor;
  if (e.at === 'start' || e.at === 'end') raus.at = e.at;
  if (typeof e.action === 'string' && commonAction(e.action)?.rule) raus.action = commonAction(e.action)!.key;
  if (typeof e.source === 'string' && e.source.trim()) raus.source = e.source.trim();
  if (e.hidden) raus.hidden = true;
  return raus;
}

/**
 * **Schaden im Tracker** (T-355): derselbe Abzug wie im Zugplan
 * (`damageAtTable`) — nach der Abwehr des Teilnehmers, mit den Zuständen
 * und Aktionen seiner Einträge gelesen. Gibt die Begegnung mit dem neuen
 * Stand an der Kante zurück, die Figur mit neuen `Vitals` (eine
 * Spielerfigur, E-128), die Rechnung und den Tischnamen. Die fällige
 * Konzentrationsprobe würfelt der Aufrufer (`damage.concentration`).
 */
export function trackerDamage(
  entities: Lookup,
  encounter: Entity,
  op: { edge: string; amount: unknown; type?: unknown },
): { encounter: Entity; creature: Entity | null; damage: TableDamage; name: string } | { error: string } {
  const rel = encounter.relations ?? [];
  const kante = rel.find((r) => r.id === op.edge && r.type === PARTICIPATES);
  if (!kante) return { error: 'No such combatant in this encounter.' };
  const betrag = Number(op.amount);
  if (op.amount === null || op.amount === '' || !Number.isFinite(betrag) || betrag < 0) return { error: 'Damage must be a number.' };
  const ziel = entities.get(kante.to);
  if (!ziel) return { error: 'No such creature.' };
  const p = propsVon(kante);
  const stats = creatureStats(ziel, entities, { conditions: entryConditions(p.conditions), actions: entryActions(p.conditions) });
  const vitals = (ziel.components?.['Vitals'] ?? {}) as Record<string, unknown>;
  const art = typeof op.type === 'string' ? op.type.trim().slice(0, 40) : '';
  const damage = damageAtTable({ stats, vitals, edge: p, pc: primaryInterface(ziel) === 'PlayerCharacter', rolled: Math.trunc(betrag), type: art });
  const relations = damage.edgeHp === null ? rel : rel.map((r) => (r === kante ? { ...r, props: { ...p, hp: damage.edgeHp! } as Relation['props'] } : r));
  const creature = damage.vitals ? { ...ziel, components: { ...ziel.components, Vitals: damage.vitals } } : null;
  return { encounter: mitKampf(encounter, relations, {}), creature, damage, name: p.label || entityName(ziel) };
}

/**
 * **Eine Änderung am Tracker** — gibt die Begegnung mit der Änderung
 * zurück, oder einen Grund, warum nicht. Geschrieben wird sie vom Aufrufer,
 * durch `validateEntity`.
 */
export function applyTrackerOp(
  entities: Lookup,
  encounter: Entity,
  op: TrackerOp,
  deps: TrackerDeps,
): { encounter: Entity } | { error: string } {
  const rel = encounter.relations ?? [];
  const kante = 'edge' in op ? rel.find((r) => r.id === op.edge && r.type === PARTICIPATES) : undefined;
  if ('edge' in op && !kante) return { error: 'No such combatant in this encounter.' };
  const setze = (patch: (p: ParticipantProps) => ParticipantProps): Relation[] =>
    rel.map((r) => (r === kante ? { ...r, props: patch(propsVon(r)) as Relation['props'] } : r));
  switch (op.op) {
    case 'next':
      return { encounter: nextTurn(entities, encounter) };
    case 'previous':
      return { encounter: previousTurn(entities, encounter) };
    case 'skip':
    case 'top':
      return { encounter: setTurn(entities, encounter, op.op) };
    case 'turn':
      return { encounter: setTurn(entities, encounter, { edge: op.edge }) };
    case 'delay':
      return { encounter: delayTurn(entities, encounter) };
    case 'end':
      return { encounter: mitKampf(encounter, [...rel], { phase: 'done' }) };
    case 'init': {
      const wert = op.reroll ? deps.d20() + initiativeMod(entities, kante!.to) : Number(op.value);
      if (!Number.isFinite(wert)) return { error: 'Initiative must be a number.' };
      return { encounter: behalteZug(entities, encounter, setze((p) => ({ ...p, init: wert }))) };
    }
    case 'hp': {
      const p = propsVon(kante!);
      const max = participantStats(entities, kante!).hpMax;
      const basis = Number.isFinite(Number(p.hp)) && p.hp != null ? Number(p.hp) : (max ?? 0);
      let hp = op.value != null ? Number(op.value) : basis + Number(op.delta ?? 0);
      if (!Number.isFinite(hp)) return { error: 'Hit points must be a number.' };
      /* Heilen hört am Maximum auf; Schaden darf unter null — „wie tief" sagt der Tisch. */
      if (op.value == null && Number(op.delta) > 0 && max != null) hp = Math.min(hp, Math.max(max, basis));
      return { encounter: mitKampf(encounter, setze((x) => ({ ...x, hp })), {}) };
    }
    case 'damage': {
      const r = trackerDamage(entities, encounter, op);
      return 'error' in r ? r : { encounter: r.encounter };
    }
    case 'effect': {
      const e = sauberEintrag(op.entry ?? {});
      if (!e) return { error: 'An effect is a condition or a note.' };
      if (e.anchor && !rel.some((r) => r.id === e.anchor && r.type === PARTICIPATES)) return { error: 'The effect counts on a combatant who is not in this encounter.' };
      return { encounter: mitKampf(encounter, setze((p) => ({ ...p, conditions: [...(p.conditions ?? []), e] })), {}) };
    }
    case 'removeEffect': {
      const liste = propsVon(kante!).conditions ?? [];
      if (!(op.index >= 0 && op.index < liste.length)) return { error: 'No such effect.' };
      return { encounter: mitKampf(encounter, setze((p) => ({ ...p, conditions: liste.filter((_, i) => i !== op.index) })), {}) };
    }
    case 'flags': {
      const patch: Partial<ParticipantProps> = {};
      for (const k of ['revealed', 'identified', 'ally'] as const) if (typeof op[k] === 'boolean') patch[k] = op[k];
      return { encounter: behalteZug(entities, encounter, setze((p) => ({ ...p, ...patch }))) };
    }
    case 'add': {
      if (!entities.get(op.to)) return { error: 'No such creature.' };
      const anzahl = op.count == null ? 1 : Number(op.count);
      if (!Number.isInteger(anzahl) || anzahl < 1 || anzahl > MAX_ADD) return { error: `Add between 1 and ${MAX_ADD} at once.` };
      const init = Number(op.init);
      const name = op.label?.trim() || entityName(entities.get(op.to));
      /* Durchgezählt wird nach dem höchsten „Name n“, der schon dasteht —
         zwei Wölfe und noch zwei sind Wolf 1 bis 4, nicht zweimal Wolf 1. */
      const muster = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
      const schon = Math.max(0, ...rel.filter((r) => r.type === PARTICIPATES).map((r) => Number(muster.exec(String(propsVon(r).label ?? ''))?.[1] ?? 0)));
      const neu: Relation[] = [];
      for (let i = 1; i <= anzahl; i++) {
        const props: ParticipantProps = {};
        props.init = op.init != null && Number.isFinite(init) ? init : deps.d20() + initiativeMod(entities, op.to);
        if (op.ally) props.ally = true;
        if (anzahl > 1) props.label = `${name} ${schon + i}`;
        else if (op.label?.trim()) props.label = op.label.trim();
        neu.push({ id: deps.newId(), type: PARTICIPATES, to: op.to, props } as Relation);
      }
      return { encounter: behalteZug(entities, encounter, [...rel, ...neu]) };
    }
    case 'remove': {
      /* Einträge, die an seinem Zug zählten, verlieren ihren Anker: sie zählen dann am eigenen Zug. */
      const neu = rel
        .filter((r) => r !== kante)
        .map((r) => {
          const c = propsVon(r).conditions;
          if (r.type !== PARTICIPATES || !c?.some((x) => x.anchor === kante!.id)) return r;
          return { ...r, props: { ...propsVon(r), conditions: c.map(({ anchor, ...x }) => (anchor === kante!.id ? x : { ...x, anchor })) } } as Relation;
        });
      return { encounter: behalteZug(entities, encounter, neu) };
    }
  }
}

/* ------------------------------------------------------------ Ansicht */

export interface TrackerEffect {
  /** Stelle in `conditions` — die Leitung entfernt damit. */
  index: number;
  name: string;
  /** Der Artikel des Zustands, wenn es einer ist. */
  rule?: EntityId;
  note: boolean;
  rounds?: number;
  /** Wann er abläuft: Runde, an wessen Zug, Anfang oder Ende. */
  expires?: { round: number; who: string; at: TurnPoint };
  source?: string;
  hidden?: boolean;
}

export interface TrackerRow {
  edge: string;
  /** Der Artikel — leer, wo die Spielenden ihn nicht kennen. */
  to: EntityId | '';
  name: string;
  init: number | null;
  party: boolean;
  ally: boolean;
  current: boolean;
  /** Führt der Betrachter diese Figur? Dann beendet er ihren Zug selbst (vom Server gesetzt). */
  own?: boolean;
  /** Nur, wo die Spalte steht und der Betrachter es sehen darf. */
  ac?: number;
  hp?: number;
  hpMax?: number;
  hpState?: 'unhurt' | 'bloodied' | 'down';
  effects: TrackerEffect[];
  /** Die Regeln am Statblock (`composedOf`), Namen. */
  actions?: string[];
  /**
   * **Was er kann, aufgeklappt** (T-334): die Abschnitte des Statblocks wie
   * im Buch (`bookSections`: Merkmale, Aktionen, Bonusaktionen, Reaktionen
   * …) und seine Zauber, mit Würfen im Text. Für Spielende nur, was sie
   * sehen dürfen — am Server gesiebt.
   */
  options?: TrackerOptions;
  /** Nur für die Leitung. */
  revealed?: boolean;
  identified?: boolean;
  note?: string;
}

/** Die Optionen eines Teilnehmers: Abschnitte des Statblocks und Zauber. */
export interface TrackerOptions {
  sections: BookSection[];
  spells: { id: EntityId; name: string; level: number | null }[];
}

export interface TrackerView {
  id: EntityId;
  name: string;
  round: number;
  /** Zug x von y — nur für die Leitung: Spielenden verriete die Zahl, wer noch kommt (D58). */
  turn?: number;
  turns?: number;
  phase: string;
  /** Leitet der Betrachter? Dann ist die Reihe ganz und die Knöpfe stehen. */
  gm: boolean;
  rules: InitiativeRules;
  rows: TrackerRow[];
  /** Die Karte, auf der gekämpft wird (`onMap`) — nur für die Leitung, für „Prepare on map“ (T-333). */
  map?: EntityId;
}

/** Die Namen der Regeln am Statblock eines Teilnehmers — gelesen aus dem, was der Betrachter sieht. */
export function participantActions(entities: Lookup, to: EntityId): string[] {
  const t = entities.get(to);
  const sb = t ? statblockFor(entities, t) : null;
  if (!sb) return [];
  const rel = resolveInstance(entities, sb).relations ?? [];
  return rel.filter((r) => r.type === 'composedOf').flatMap((r) => {
    const z = entities.get(r.to);
    return z ? [entityName(z)] : [];
  });
}

/**
 * **Die Reihe, wie der Betrachter sie sieht.** Für die Leitung aus der
 * rohen Begegnung; für Spielende aus der **schon gesiebten** (`redactEntity`
 * mit `PlayerViewRules`) — hier wird nichts zurückgehalten, was nicht schon
 * weg ist, nur gezeichnet. Die Spalten der Kampagne gelten für beide.
 */
export function trackerView(
  entities: Lookup,
  encounter: Entity,
  rules: InitiativeRules,
  gm: boolean,
  /** Die Aktionen je Teilnehmerkante; ohne: aus `entities`. Spielende kennen den Artikel eines Unerkannten nicht, der Server schon. */
  actionsOf?: (edge: string) => string[],
  /** Die Optionen je Teilnehmerkante (T-334), schon gesiebt; ohne: keine. */
  optionsOf?: (edge: string) => TrackerOptions | null,
): TrackerView {
  const rel = encounter.relations ?? [];
  const order = initiativeOrder(entities, rel);
  const fight = fightOf(encounter);
  const spalte = new Set(rules.columns);
  const dranId = gm && fight.round > 0 ? order[fight.turn]?.id : undefined;
  const ids = order.map((r) => r.id);
  const nameVon = (r: Relation): string => {
    const p = propsVon(r);
    if (p.label) return p.label;
    return r.to ? entityName(entities.get(r.to)) : 'Unknown creature';
  };
  const namen = new Map(order.map((r) => [r.id, nameVon(r)]));
  const rows = order.map((r): TrackerRow => {
    const p = propsVon(r);
    const party = !!r.to && inParty(entities, r.to);
    const row: TrackerRow = {
      edge: r.id,
      to: r.to ?? '',
      name: namen.get(r.id)!,
      init: p.init != null && Number.isFinite(Number(p.init)) ? Number(p.init) : null,
      party,
      ally: !!p.ally,
      current: gm ? r.id === dranId : !!p.current,
      effects: [],
    };
    if (spalte.has('ac') && (gm || party) && r.to) {
      const ac = participantStats(entities, r).ac;
      if (ac != null) row.ac = ac;
    }
    if (spalte.has('hp')) {
      const max = gm && r.to ? participantStats(entities, r).hpMax : p.hpMax;
      /* Ohne Stand ist er unverletzt (T-334, D8): gelesen, nicht gespeichert. */
      const hp = p.hp != null ? Number(p.hp) : gm && max != null ? Number(max) : undefined;
      if (gm || hp != null) {
        if (hp != null) row.hp = hp;
        if (max != null) row.hpMax = Number(max);
      }
      if (gm && !party) row.hpState = hpWord(p.hp, max);
      else if (p.hpState) row.hpState = p.hpState;
    }
    if (spalte.has('effects')) {
      row.effects = (p.conditions ?? []).map((c, index): TrackerEffect => {
        const ab = expiresAt(c, r.id, ids, fight.round, fight.turn);
        const ziel = c.rule ? entities.get(c.rule) : undefined;
        return {
          index,
          name: isNote(c) ? (c.text ?? '') : ziel ? entityName(ziel) : (c.name ?? c.rule ?? '?'),
          ...(c.rule && ziel ? { rule: c.rule } : {}),
          note: isNote(c),
          ...(c.rounds != null ? { rounds: Number(c.rounds) } : {}),
          ...(ab && gm ? { expires: { round: ab.round, who: namen.get(ab.anchor) ?? '?', at: ab.at } } : {}),
          ...(c.source ? { source: c.source } : {}),
          ...(c.hidden ? { hidden: true } : {}),
        };
      });
    }
    /* Die Aktionen: die Leitung immer; Spielende die der Gegner nur, wenn
       die Kampagne es sagt — und einer steht für sie erst da, wenn sein Zug
       kam (D58, schon gesiebt). */
    if (spalte.has('actions') && (gm || party || rules.enemyActions === 'shown')) {
      const a = actionsOf ? actionsOf(r.id) : r.to ? participantActions(entities, r.to) : [];
      if (a.length) row.actions = a;
    }
    if (gm || party || rules.enemyActions === 'shown') {
      const o = optionsOf?.(r.id);
      if (o && (o.sections.length || o.spells.length)) row.options = o;
    }
    if (gm) {
      row.revealed = !!p.revealed;
      row.identified = !!p.identified;
      if (p.note) row.note = p.note;
    }
    return row;
  });
  const karte = (encounter.relations ?? []).find((r) => r.type === 'onMap')?.to;
  return {
    id: encounter.id,
    name: entityName(encounter),
    round: fight.round,
    ...(gm && fight.round > 0 && order.length ? { turn: Math.min(fight.turn, order.length - 1) + 1, turns: order.length } : {}),
    phase: String(karteVon(encounter)['phase'] ?? 'planned'),
    gm,
    rules,
    rows,
    ...(gm && karte ? { map: karte } : {}),
  };
}

/**
 * **Die Optionen eines Teilnehmers** (T-334): die Abschnitte seines
 * Statblocks (der Instanz, mit der Vorlage darunter) wie im Buch, und die
 * Zauber, die er wirkt (`casts` am Statblock und an der Figur). `entities`
 * ist, was der Betrachter sieht — für Spielende gesiebt; ein Teil, der
 * dort fehlt, fällt weg, statt als „fehlt" dazustehen.
 */
export function participantOptions(
  registry: Pick<Registry, 'interfaces' | 'relations' | 'units' | 'settings'> & { vars?: Record<string, string> },
  entities: Lookup,
  to: EntityId,
): TrackerOptions | null {
  const t = entities.get(to);
  const sb = t ? statblockFor(entities, t) : null;
  if (!t) return null;
  const voll = sb ? resolveInstance(entities, sb) : null;
  const sections = voll
    ? bookSections(registry, voll, {
        part: (id) => entities.get(id),
        nameOf: (id) => {
          const e = entities.get(id);
          return e ? entityName(e) : undefined;
        },
        campaign: registry.vars,
      })
        .map((s) => ({ ...s, entries: s.entries.filter((e) => !e.missing) }))
        .filter((s) => s.entries.length)
    : [];
  const gesehen = new Set<string>();
  const spells: TrackerOptions['spells'] = [];
  for (const quelle of [voll, t]) {
    for (const r of quelle?.relations ?? []) {
      if (r.type !== 'casts' || gesehen.has(r.to)) continue;
      const z = entities.get(r.to);
      if (!z) continue;
      gesehen.add(r.to);
      const lvl = Number((z.components?.['Spell'] as { level?: unknown } | undefined)?.level);
      spells.push({ id: z.id, name: entityName(z), level: Number.isFinite(lvl) ? lvl : null });
    }
  }
  spells.sort((a, b) => (a.level ?? 99) - (b.level ?? 99) || a.name.localeCompare(b.name));
  return { sections, spells };
}

/** Ist das eine Begegnung? */
export const isEncounter = (e: Entity | undefined): boolean => !!e && primaryInterface(e) === 'Encounter';
