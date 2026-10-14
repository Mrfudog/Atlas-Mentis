/**
 * Die Initiative (REQ-211–213, D53). Kein Framework, keine Darstellung:
 * was hier steht, rechnen Server und Prototyp gleich.
 *
 * Ein Teilnehmer ist eine `participates`-Kante an der Begegnung. Ihre
 * Einträge in `props.conditions` sind Zustände (`rule`) oder Notizen
 * (`text`), und beide tragen dieselbe Dauer: `rounds` zählt herunter, wenn
 * der Zug des Ankers (`anchor`, die Id einer Teilnehmerkante) anfängt oder
 * endet (`at`). Ohne Anker der eigene Zug, ohne Zeitpunkt das Ende — so
 * verhielt sich der Bestand vor D53, und er bleibt damit gültig.
 */
import type { Entity, EntityId, Relation } from './types.js';
import { resolveInstance } from './instance.js';

export type TurnPoint = 'start' | 'end';

/** Ein Eintrag mit Dauer: Zustand (`rule`) oder Notiz (`text`). */
export interface TimedEntry {
  /** Id eines Artikels der Art `Condition` (der Schlüssel heisst aus alter Zeit so). */
  rule?: string;
  /** Freier Text — dann ist der Eintrag eine Notiz (REQ-212). */
  text?: string;
  /** Alter Bestand: ein Zustandsname statt einer Id. */
  name?: string;
  /** Wie oft der Anker-Zeitpunkt noch vorbeikommt; leer heisst: bis jemand ihn entfernt. */
  rounds?: number;
  /** Wessen Zug: die Id einer `participates`-Kante derselben Begegnung. */
  anchor?: string;
  at?: TurnPoint;
  /** Wer ihn verhängt hat, als Text. */
  source?: string;
  /** Nicht für Spielende (REQ-213). */
  hidden?: boolean;
}

export interface ParticipantProps {
  label?: string;
  init?: number;
  hp?: number;
  hpMax?: number;
  ally?: boolean;
  conditions?: TimedEntry[];
  note?: string;
  revealed?: boolean;
  involved?: boolean;
  identified?: boolean;
  /** Nur in der Spieleransicht: die Trefferpunkte als Wort. */
  hpState?: HpWord;
  /**
   * Nur in der Spieleransicht: dieser Teilnehmer ist dran (D58). Die
   * Zugnummer der Begegnung zählt die ganze Reihe und verriete, wie viele
   * davor verborgen sind — sie geht darum nicht hinaus, diese Marke schon.
   */
  current?: boolean;
}

/** Wo der Kampf steht — `Encounter.round` und `Encounter.turn`. */
export interface FightState {
  /** 0 = noch nicht begonnen. */
  round?: number;
  /** Index in der ganzen Reihe (`initiativeOrder`). */
  turn?: number;
}

export const PARTICIPATES = 'participates';

/** Wann ein Eintrag herunterzählt. Ohne Angabe: eigener Zug, Ende (Bestand vor D53). */
export function entryTiming(entry: TimedEntry, ownEdgeId: string): { anchor: string; at: TurnPoint } {
  return { anchor: entry.anchor || ownEdgeId, at: entry.at === 'start' ? 'start' : 'end' };
}

export function isNote(entry: TimedEntry): boolean {
  return !entry.rule && !entry.name && typeof entry.text === 'string';
}

/**
 * Ein Zeitpunkt in der Begegnung ist vorbei: der Zug der Kante `edgeId`
 * fängt an oder endet. Jeder Eintrag **irgendeines** Teilnehmers, dessen
 * Anker das ist, zählt um eins herunter; was bei null ankommt, fällt weg.
 * Einträge ohne Dauer bleiben. Zurück kommen neue Kanten — die alten
 * bleiben unberührt, denn eingefrorene Daten aus dem Speicher dürfen nicht
 * beschrieben werden.
 */
export function tickEntries(relations: readonly Relation[], edgeId: string, at: TurnPoint): Relation[] {
  return relations.map((r) => {
    if (r.type !== PARTICIPATES) return r;
    const props = (r.props ?? {}) as ParticipantProps;
    const liste = Array.isArray(props.conditions) ? props.conditions : [];
    let geaendert = false;
    const neu: TimedEntry[] = [];
    for (const c of liste) {
      const t = entryTiming(c, r.id);
      const n = Number(c.rounds);
      if (t.anchor !== edgeId || t.at !== at || c.rounds == null || !Number.isFinite(n)) {
        neu.push(c);
        continue;
      }
      geaendert = true;
      if (n - 1 > 0) neu.push({ ...c, rounds: n - 1 });
    }
    return geaendert ? { ...r, props: { ...props, conditions: neu } } : r;
  });
}

/**
 * Wann ein Eintrag abläuft, bei gegebener Reihenfolge und laufendem Zug —
 * damit die Maske beim Setzen sagt, was „1 Runde" heisst. Gezählt wird
 * jeder Anker-Zeitpunkt **ab jetzt**: der Anfang des laufenden Zuges ist
 * vorbei, sein Ende kommt noch. Wer im eigenen Zug „bis zum Ende deines
 * nächsten Zuges" will, setzt also 2.
 *
 * `order` sind die Kanten-Ids in Zugreihenfolge, `turn` der Index des
 * laufenden Zuges, `round` die laufende Runde (0 = noch nicht begonnen,
 * dann zählt Runde 1 vom Anfang).
 */
export function expiresAt(
  entry: TimedEntry,
  ownEdgeId: string,
  order: readonly string[],
  round: number,
  turn: number,
): { round: number; anchor: string; at: TurnPoint } | null {
  const n = Number(entry.rounds);
  if (entry.rounds == null || !Number.isFinite(n) || n <= 0) return null;
  const t = entryTiming(entry, ownEdgeId);
  const idx = order.indexOf(t.anchor);
  if (idx < 0) return null;
  const r0 = Math.max(1, round || 0);
  const lauf = round > 0 ? turn : -1; /* vor Runde 1 läuft kein Zug */
  /* Kommt der Zeitpunkt in dieser Runde noch? */
  const nochDiese = idx > lauf || (idx === lauf && t.at === 'end');
  const erste = nochDiese ? r0 : r0 + 1;
  return { round: erste + n - 1, anchor: t.anchor, at: t.at };
}

/** Die Trefferpunkte als Wort, für Gegner in der Spieleransicht (REQ-213). */
export type HpWord = 'unhurt' | 'bloodied' | 'down';
export function hpWord(hp: number | undefined, max: number | undefined): HpWord | undefined {
  const h = Number(hp);
  const m = Number(max);
  if (hp == null || !Number.isFinite(h)) return Number.isFinite(m) ? 'unhurt' : undefined;
  if (h <= 0) return 'down';
  if (Number.isFinite(m) && h < m) return 'bloodied';
  return 'unhurt';
}

type Lookup = ReadonlyMap<EntityId, Entity>;

/** Der Statblock einer Kreatur (`belongsTo`), oder sie selbst, wenn sie einer ist. */
function statblockFor(entities: Lookup, e: Entity): Entity | null {
  if (e.interfaces?.[0] === 'Statblock') return e;
  for (const o of entities.values()) {
    if (o.interfaces?.[0] !== 'Statblock') continue;
    if ((o.relations ?? []).some((r) => r.type === 'belongsTo' && r.to === e.id)) return o;
  }
  return null;
}

/**
 * Rüstungsklasse und TP-Maximum vom Statblock — der Instanz, mit der
 * Vorlage darunter (REQ-211). Die Kante hält nur den Stand im Kampf; ein
 * abgeschriebenes Maximum (`props.hpMax`) gilt nur, wo kein Statblock hängt.
 */
export function participantStats(
  entities: Lookup,
  relation: Relation,
): { ac?: number; hpMax?: number } {
  const props = (relation.props ?? {}) as ParticipantProps;
  const t = entities.get(relation.to);
  const sb = t ? statblockFor(entities, t) : null;
  const card = sb ? ((resolveInstance(entities, sb).components ?? {})['Statblock'] ?? {}) : {};
  const ac = Number((card as { ac?: unknown }).ac);
  const hp = Number((card as { hp?: unknown }).hp);
  const alt = Number(props.hpMax);
  return {
    ac: Number.isFinite(ac) ? ac : undefined,
    hpMax: Number.isFinite(hp) ? hp : Number.isFinite(alt) ? alt : undefined,
  };
}

/** Steht der Teilnehmer auf der Seite der Gruppe? Die Gruppe selbst und wer in einer ist. */
export function inParty(entities: Lookup, to: EntityId): boolean {
  const e = entities.get(to);
  if (!e) return false;
  if (e.interfaces?.[0] === 'Party') return true;
  return (e.relations ?? []).some((r) => r.type === 'memberOfParty');
}

/** Der Tischname eines Teilnehmers: die Angabe an der Kante, sonst der Name des Artikels. */
function tableName(entities: Lookup, r: Relation): string {
  const p = (r.props ?? {}) as ParticipantProps;
  if (p.label) return p.label;
  const t = entities.get(r.to);
  const id = ((t?.components ?? {})['Identity'] as { name?: string } | undefined)?.name;
  return id || (t as { name?: string } | undefined)?.name || '(missing)';
}

/**
 * Die Zugreihenfolge, wie die Leitung sie sieht: hohe Initiative zuerst,
 * bei Gleichstand die Verbündeten, dann der Name. `Encounter.turn` ist
 * ein Index in genau diese Reihe — der Prototyp sortiert gleich
 * (`sortFight`). Eine Hausregel, die hier steht, damit sie jedes Mal
 * gleich ausgeht.
 */
export function initiativeOrder(entities: Lookup, relations: readonly Relation[]): Relation[] {
  const init = (r: Relation): number => {
    const n = Number((r.props as ParticipantProps | undefined)?.init);
    return (r.props as ParticipantProps | undefined)?.init != null && Number.isFinite(n) ? n : -99;
  };
  const ally = (r: Relation): boolean => !!(r.props as ParticipantProps | undefined)?.ally;
  return relations
    .filter((r) => r.type === PARTICIPATES)
    .sort((a, b) => {
      const d = init(b) - init(a);
      if (d) return d;
      if (ally(a) !== ally(b)) return ally(a) ? -1 : 1;
      return tableName(entities, a).localeCompare(tableName(entities, b), 'de');
    });
}

/**
 * Ist der Zug dieses Teilnehmers in diesem Kampf schon gekommen (REQ-226,
 * D58)? Ab Runde 2 ja, für jeden; in Runde 1, wenn er in der Reihe nicht
 * nach dem laufenden steht; vor Runde 1 für niemanden.
 */
export function turnHasCome(order: readonly Relation[], edgeId: string, fight: FightState): boolean {
  const runde = Number(fight.round) || 0;
  if (runde >= 2) return true;
  if (runde < 1) return false;
  const idx = order.findIndex((r) => r.id === edgeId);
  return idx >= 0 && idx <= (Number(fight.turn) || 0);
}

/**
 * Was die Spielenden von der Initiative sehen (REQ-213, D53; REQ-226, D58). Wird am
 * Server in `redactEntity` angewandt, nicht erst in der Maske:
 *
 * - die Gruppe und jede Kreatur mit `revealed` oder `involved`, sonst nichts;
 * - **ein Gegner erst, wenn sein Zug gekommen ist** (D58, mit `fight`):
 *   in Runde 1 steht er dort, sobald sein Zug beginnt, und bleibt; vor
 *   Runde 1 steht keiner. Sonst verriete die Reihe, wer noch kommt.
 *   Verbündete (`ally`) und die Gruppe sind keine Gegner und stehen gleich;
 *   ein Zug allein deckt weiterhin nicht auf (D53);
 * - statt der Zugnummer eine Marke `current` am Teilnehmer, der dran ist —
 *   und nur, wenn er gezeigt wird;
 * - ohne `identified` der Deckname des Artikels (`Identity.cover`, REQ-178)
 *   statt des Tischnamens, und kein Verweis auf den Artikel;
 * - Trefferpunkte nur von der Gruppe als Zahl, von allen anderen als Wort;
 * - Einträge mit `hidden` und die Notiz der Leitung an der Kante nie.
 */
export function redactParticipants(
  entities: Lookup,
  relations: readonly Relation[],
  fight?: FightState,
): Relation[] {
  const raus: Relation[] = [];
  const order = fight ? initiativeOrder(entities, relations) : [];
  const runde = Number(fight?.round) || 0;
  const dranId = fight && runde > 0 ? order[Number(fight.turn) || 0]?.id : undefined;
  const zeigt = (r: Relation): boolean => {
    const p = (r.props ?? {}) as ParticipantProps;
    if (inParty(entities, r.to)) return true;
    if (!p.revealed && !p.involved) return false;
    /* REQ-226, D58: ein Gegner steht erst, wenn sein Zug gekommen ist. */
    return !fight || !!p.ally || turnHasCome(order, r.id, fight);
  };
  const deckOf = (r: Relation): string => {
    const t = entities.get(r.to);
    return ((t?.components ?? {})['Identity'] as { cover?: string } | undefined)?.cover || 'Unknown creature';
  };
  /* Drei Goblins unter einem Decknamen sind drei Zeilen, und am Tisch muss
     man sie auseinanderhalten — also gezählt, sobald einer doppelt steht. */
  const wieOft = new Map<string, number>();
  for (const r of relations) {
    if (r.type !== PARTICIPATES || !zeigt(r) || inParty(entities, r.to)) continue;
    if ((r.props as ParticipantProps | undefined)?.identified) continue;
    wieOft.set(deckOf(r), (wieOft.get(deckOf(r)) ?? 0) + 1);
  }
  const decknamen = new Map<string, number>();
  for (const r of relations) {
    if (r.type !== PARTICIPATES) {
      raus.push(r);
      continue;
    }
    const p = (r.props ?? {}) as ParticipantProps;
    const gruppe = inParty(entities, r.to);
    if (!zeigt(r)) continue;
    const conditions = (Array.isArray(p.conditions) ? p.conditions : []).filter((c) => !c.hidden);
    const neu: ParticipantProps = {
      init: p.init,
      ally: p.ally,
      conditions,
      revealed: p.revealed,
      involved: p.involved,
      identified: p.identified,
    };
    if (dranId === r.id) neu.current = true;
    let to = r.to;
    if (gruppe) {
      Object.assign(neu, { label: p.label, hp: p.hp, hpMax: participantStats(entities, r).hpMax, note: p.note });
    } else {
      neu.hpState = hpWord(p.hp, participantStats(entities, r).hpMax);
      if (p.identified) neu.label = p.label;
      else {
        const basis = deckOf(r);
        const k = (decknamen.get(basis) ?? 0) + 1;
        decknamen.set(basis, k);
        neu.label = (wieOft.get(basis) ?? 0) > 1 ? `${basis} ${k}` : basis;
        to = '';
      }
    }
    raus.push({ id: r.id, type: r.type, to, props: neu as Relation['props'] });
  }
  return raus;
}
