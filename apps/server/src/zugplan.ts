/**
 * **Der Zugplan am Tisch** (T-198): eine Spielerin legt auf der Karte
 * ihren Zug zurecht — Bewegung, Aktion, Bonusaktion, Reaktion —, reicht
 * ihn ein, und die Leitung bestätigt ihn. Erst beim Bestätigen wird
 * gewürfelt, am Server und ins Log (T-172), und das Token wandert.
 *
 * - `GET  /api/maps/:id/turn-plan?actor=` — was die Leiste braucht: die
 *   Figuren, für die der Betrachter planen darf, die Kacheln der gewählten
 *   (aus ihrem Statblock gerechnet, D51), die Ziele auf der Karte mit
 *   Trefferchance je Angriff und die Pläne dieser Karte.
 * - `POST /api/maps/:id/turn-plan` `{actor, steps, plan?}` — einreichen
 *   (oder einen eingereichten ersetzen).
 * - `POST /api/maps/:id/turn-plan/:plan/decide` `{decision, note?}` —
 *   die Leitung bestätigt (`confirm`) oder lehnt ab (`reject`).
 * - `POST /api/maps/:id/turn-plan/:plan/react` `{attack}` — die Antwort
 *   auf einen **Gelegenheitsangriff** (Runde 2): verlässt ein Weg die
 *   Reichweite eines Gegners, hält die Ausführung dort an (`reacting`), und
 *   wer reagieren darf — die Leitung für Gegner, Spielende für ihre Figur —
 *   sagt Ja (am Server gewürfelt, die Reaktion verbraucht bis zum eigenen
 *   nächsten Zug) oder Nein. Dann geht der Zug weiter.
 *
 * **Im Kampf zieht niemand frei** (Runde 2): läuft auf einer Karte eine
 * Begegnung, bewegen Spielende Tokens nur über den Plan — `zugSperre`
 * prüft das beim Schreiben der Karte (`PUT /api/entities/:id`); die
 * Leitung zieht weiter frei. Ausserhalb eines Kampfes gilt, was die
 * Kampagne sagt (T-204).
 *
 * **Ein Plan ist Spielgeschehen und kein Inhalt** (wie ein Wurf): er steht
 * im Protokoll (`event_log`, `name: 'turnplan'`, `subject` die Karte), je
 * Änderung ein Eintrag mit derselben Plan-Id; es gilt der jüngste. Keine
 * Migration, kein Artikel, keine Ausfuhr.
 *
 * **Gesiebt wird wie überall:** die Karte gesiebt (`redactMap`), die Ziele
 * nur, die auf der gesiebten Karte stehen, die Kacheln aus Artikeln, die
 * der Betrachter sieht. Die Rüstungsklasse eines Gegners geht nur an die
 * Leitung; Spielende bekommen die Trefferchance — wie in BG3. Planen darf,
 * wer die Figur führt (`app_user_actor`) oder am Tisch leitet; die Leitung
 * plant so auch für einen Gegner.
 */

import { randomUUID, getRandomValues } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  blockingWalls,
  cellAt,
  cellPoint,
  cleanNat,
  cleanStep,
  encounterOnMap,
  gridGeometry,
  initiativeOrder,
  feetBetween,
  mapRulesOf,
  mapSettings,
  movedTokens,
  carriedLights,
  darkvisionFor,
  revealSeenAlong,
  wallsClear,
  fogOn,
  opportunityAttacks,
  PARTICIPATES,
  PARTY_RELATION,
  participantIds,
  REACTION_EVENT,
  currentCampaign,
  diceModifier,
  entityName,
  hitChance,
  isMap,
  markersOf,
  mayMoveAsset,
  mayMoveToken,
  moveMarker,
  floorOfMarker,
  GROUND_FLOOR,
  floorView,
  onFloor,
  passageEnds,
  inPassage,
  passageArea,
  isLastTurn,
  mayUsePassage,
  passageFeet,
  passageNeedsConfirm,
  passageRulesOf,
  tokensInPassage,
  turnOf,
  type Passage,
  naturalD20,
  partiesOf,
  resolvePlay,
  planBudget,
  planText,
  primaryInterface,
  resolveInstance,
  creatureStats,
  entryConditions,
  entryActions,
  commonAction,
  attackRollMode,
  rangeBand,
  damageAtTable,
  damageLines,
  checkBonus,
  type CharacterStats,
  type CommonAction,
  type ParticipantProps,
  type Relation,
  type TimedEntry,
  rollDice,
  speedModes,
  tilesFor,
  TURNPLAN_EVENT,
  plannerAllows,
  plannerReacts,
  plannerTiles,
  turnPlannerOf,
  reactionBack,
  knownNames,
  offersFrom,
  playStack,
  reachExits,
  ruleGraphsOn,
  runRules,
  tableCreature,
  tableDistance,
  tableRuleGraphs,
  type Entity,
  type PlanCost,
  type PlanCursor,
  type Provocation,
  type RuleCreature,
  type RuleGraph,
  type RuleRunResult,
  type RuleTriggerKey,
  type PlanResult,
  type PlanStep,
  type PlanThreat,
  type PlanTile,
  type GridGeometry,
  type MapRules,
  type ReactionSpent,
  type TokenMovers,
  type RollPayload,
  type TurnPlan,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import type { ChangeFeed } from './live.js';
import type { Repository } from './repo.js';
import { leitetTisch, tischSitzung, wurfEintragen } from './wuerfe.js';
import type { InsSpiel } from './spielinstanz.js';
import { durchschicken, geoDerEbene } from './uebergang.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface ZugplanDeps {
  repo: Repository;
  feed: ChangeFeed;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  schreibeGeprueft: (entity: Entity) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
  /** Eine Karte für den Tisch der Sitzung (T-289) — ein Portal auf eine andere Karte nimmt sie ins Spiel (T-326). */
  insSpiel?: InsSpiel;
}

/** So viele Plan-Einträge einer Karte liest die Leiste höchstens. */
const FENSTER = 200;

function zufall(): number {
  return getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

type Card = Record<string, unknown>;

/** Der Statblock einer Kreatur (`belongsTo`), oder sie selbst. */
export function statblockVon(alle: readonly Entity[], e: Entity): Entity | null {
  if (primaryInterface(e) === 'Statblock') return e;
  return alle.find((o) => primaryInterface(o) === 'Statblock' && (o.relations ?? []).some((r) => r.type === 'belongsTo' && r.to === e.id)) ?? null;
}

/**
 * Die Karten des Statblocks als eine (`Statblock` und `Abilities`), wie der
 * Bogen sie liest — **gelesen** (T-275): mit Rüstung, Wirkungen und
 * Zuständen der Kreatur, der er gehört (`creatureStats`).
 */
function werte(map: Map<string, Entity>, sb: Entity | null): Card {
  if (!sb) return {};
  const wem = (sb.relations ?? []).find((r) => r.type === 'belongsTo')?.to;
  const kreatur = (wem ? map.get(wem) : undefined) ?? sb;
  const c = (creatureStats(kreatur, map).statblock ?? resolveInstance(map, sb)).components ?? {};
  return { ...((c['Abilities'] ?? {}) as Card), ...((c['Statblock'] ?? {}) as Card) };
}

/** Das Gehtempo in Fuss; ohne Angabe 30. */
export function tempoVon(stats: Card): number {
  return speedModes(stats['speed']).walk ?? 30;
}

/**
 * **Die Kacheln einer Figur** — die Aktionen ihres Statblocks
 * (`composedOf` auf Artikel mit `Action`-Karte; die Kante darf Zahlen
 * ändern), dazu waffenloser Schlag und die allgemeinen Aktionen. Nur
 * Aktionen, die `sichtbar` sagt.
 */
export function kachelnVon(map: Map<string, Entity>, sb: Entity | null, sichtbar: (id: string) => boolean): PlanTile[] {
  const stats = werte(map, sb);
  const aktionen = sb
    ? (resolveInstance(map, sb).relations ?? [])
        .filter((r) => r.type === 'composedOf' && sichtbar(r.to))
        .flatMap((r) => {
          const a = map.get(r.to);
          const action = a?.components?.['Action'] as Card | undefined;
          if (!a || !action) return [];
          const art = typeof action['actionType'] === 'string' ? map.get(action['actionType']) : undefined;
          return [{ id: a.id, name: entityName(a), actionTypeName: art ? entityName(art) : null, action, edge: (r.props ?? {}) as Card }];
        })
    : [];
  return tilesFor(stats, aktionen);
}

/**
 * Die Rüstungsklasse eines Ziels, gelesen wie am Bogen (T-275): getragene
 * Rüstung, Wirkungen, Zustände — auch die aus der Initiative.
 */
function rkVon(stand: Stand, e: Entity, kampf: Entity | null = null): number | null {
  const ac = creatureStats(e, stand.map, { conditions: zustaendeImKampf(kampf, e.id) }).ac.value;
  return ac !== null && Number.isFinite(ac) && ac > 0 ? ac : null;
}

/** Die Zustände, die die Initiative an `id` führt (`participates.props.conditions`). */
function zustaendeImKampf(kampf: Entity | null, id: string): string[] {
  const k = (kampf?.relations ?? []).find((r) => r.type === PARTICIPATES && r.to === id);
  return k ? entryConditions((k.props as ParticipantProps | undefined)?.conditions) : [];
}

/** Je Plan-Id der jüngste Eintrag, neueste zuerst. */
export async function plaeneDerKarte(repo: Repository, karte: string): Promise<(TurnPlan & { at: string })[]> {
  const roh = await repo.listEvents({ name: TURNPLAN_EVENT, subject: karte, limit: FENSTER });
  const je = new Map<string, TurnPlan & { at: string }>();
  for (const ev of roh) {
    const p = ev.payload as TurnPlan;
    if (p?.plan && !je.has(p.plan)) je.set(p.plan, { ...p, at: ev.at });
  }
  return [...je.values()];
}

/**
 * **Auf welcher Seite eine Figur steht** — für die Frage, wer wen bedroht.
 * Die Seite der Gruppe hat, wer in einer Gruppe ist (`memberOfParty`), eine
 * Gruppe selbst, eine Spielerfigur, und wer an der Begegnung `ally` trägt;
 * alle anderen stehen dagegen. Es gibt keine dritte Seite — wer zwei
 * Lager braucht, braucht erst eine Regel dafür.
 */
export function seiteVon(stand: Stand, kampf: Entity | null, id: string): 'party' | 'foe' {
  const e = stand.map.get(id);
  if (!e) return 'foe';
  const typ = primaryInterface(e);
  if (typ === 'Party' || typ === 'PlayerCharacter') return 'party';
  if ((e.relations ?? []).some((r) => r.type === PARTY_RELATION)) return 'party';
  const kante = (kampf?.relations ?? []).find((r) => r.type === PARTICIPATES && r.to === id);
  return (kante?.props as { ally?: unknown } | undefined)?.ally === true ? 'party' : 'foe';
}

/**
 * **Wen ein Konto ziehen darf, gerechnet** (T-290, E-040): seine Figuren,
 * die Gruppe der laufenden Kampagne samt Mitgliedern (`memberOfParty`) und
 * wer auf der Seite der Gruppe steht — die Tokens dieser Karte nach
 * `seiteVon`, mit dem Kampf, der hier läuft (eine Begegnung im Spiel
 * aufgelöst: ihre Teilnehmer stehen an der Vorlage, T-289). Die Tokens
 * kommen von **der** Karte, die man hineingibt; wo es um Spielende geht,
 * ist das die gesiebte. Die Frage selbst stellt `mayMoveToken`.
 */
export function zieher(stand: Stand, kampagne: Entity | null, karte: Entity, eigene: Iterable<string>): TokenMovers {
  const party = new Set<string>();
  for (const g of kampagne ? partiesOf(stand.map, kampagne.id) : []) {
    party.add(g.id);
    for (const e of stand.alle) if ((e.relations ?? []).some((r) => r.type === PARTY_RELATION && r.to === g.id)) party.add(e.id);
  }
  const gefunden = encounterOnMap(stand.alle, karte.id);
  const kampf = gefunden ? resolvePlay(stand.map, gefunden) : null;
  const allies = new Set<string>();
  for (const m of markersOf(karte)) if (m.kind !== 'scenery' && seiteVon(stand, kampf, m.to) === 'party') allies.add(m.to);
  return { own: new Set(eigene), party, allies };
}

/** Darf das Token gezogen werden — die Leitung immer, sonst nach der Stufe der Kampagne (T-290). */
export function darfZiehen(leitet: boolean, regeln: MapRules, ziel: string, wer: TokenMovers): boolean {
  return leitet || mayMoveToken(regeln.tokenMove, ziel, wer);
}

/** Die Nahkampfreichweite einer Kreatur aus ihren Kacheln; ohne Angriff 5 ft. */
function reichweiteVon(stand: Stand, e: Entity): number {
  const nah = kachelnVon(stand.map, statblockVon(stand.alle, e), () => true).filter((t) => t.group === 'attack' && t.longRange === null && t.range !== null);
  return Math.max(5, ...nah.map((t) => t.range!));
}

/**
 * **Wer die Figur bedroht**: die Tokens der Gegenseite auf dieser Karte mit
 * Statblock, im Kampf nur die Teilnehmer. `karte` ist die Karte, die der
 * Fragende sieht — Spielende bekommen so keinen verborgenen Gegner verraten.
 */
export function bedrohungen(stand: Stand, karte: Entity, figur: string, kampf: Entity | null): { id: string; name: string; rel: string; reach: number }[] {
  const meine = seiteVon(stand, kampf, figur);
  const dabei = kampf ? participantIds(kampf) : null;
  const out: { id: string; name: string; rel: string; reach: number }[] = [];
  const gesehen = new Set<string>();
  for (const m of markersOf(karte)) {
    if (m.kind === 'scenery' || m.to === figur || gesehen.has(m.to)) continue;
    if (dabei && !dabei.has(m.to)) continue;
    const e = stand.map.get(m.to);
    if (!e || !statblockVon(stand.alle, e) || seiteVon(stand, kampf, m.to) === meine) continue;
    gesehen.add(m.to);
    out.push({ id: m.to, name: entityName(e), rel: m.rel.id, reach: reichweiteVon(stand, e) });
  }
  return out;
}

/** Die Bedrohungen mit ihren Feldern, für `opportunityAttacks`. */
function bedrohteFelder(karte: Entity, geo: GridGeometry, b: ReturnType<typeof bedrohungen>): PlanThreat[] {
  const marker = new Map(markersOf(karte).map((m) => [m.rel.id, m]));
  return b.flatMap((t) => {
    const m = marker.get(t.rel);
    return m ? [{ id: t.id, name: t.name, reach: t.reach, cell: cellAt(geo, m) }] : [];
  });
}

/**
 * **Wie weit ein Angriff reicht** (T-351): der Abstand in Fuss von der
 * Stelle, an der die Figur angreift, zum Token des Ziels auf ihrer Ebene —
 * `null` ohne Gitter oder ohne beide Tokens (dann prüft niemand). `davor`
 * sind die Schritte vor dem Angriff: angegriffen wird vom Ende des letzten
 * Wegs. Dieselbe Rechnung wie die Maske (`feetBetween`, 5-10-5).
 */
export function abstandImPlan(karte: Entity, geo: GridGeometry | null, figur: string, ziel: string, davor: readonly PlanStep[] = []): number | null {
  if (!geo) return null;
  const ich = markersOf(karte).find((m) => m.to === figur);
  if (!ich) return null;
  const dort = markersOf(floorView(karte, floorOfMarker(karte, ich.rel.id))).find((m) => m.to === ziel);
  if (!dort) return null;
  const letzter = [...davor].reverse().find((x) => x.kind === 'move' && (x.to || x.path.length));
  const wo = letzter?.kind === 'move' ? (letzter.to ?? cellPoint(geo, letzter.path[letzter.path.length - 1]!)) : ich;
  return feetBetween(geo, wo, dort);
}

/** Wo eine Begegnung steht und welchen Platz `id` in ihrer Reihe hat. */
function kampfStand(stand: Stand, kampf: Entity | null, id: string): { jetzt: { round: number; turn: number } | null; platz: number | null } {
  if (!kampf) return { jetzt: null, platz: null };
  const k = (kampf.components?.['Encounter'] ?? {}) as { round?: unknown; turn?: unknown };
  const runde = Number(k.round);
  const jetzt = runde >= 1 ? { round: runde, turn: Math.max(0, Number(k.turn) || 0) } : null;
  const reihe = initiativeOrder(stand.map, (kampf.relations ?? []).filter((r) => r.type === PARTICIPATES && r.to));
  const i = reihe.findIndex((r) => r.to === id);
  return { jetzt, platz: i >= 0 ? i : null };
}

/**
 * **Hat `id` seine Reaktion?** Verbraucht ist sie bis zum eigenen nächsten
 * Zug: im Kampf nach der Reihe (`reactionBack`), sonst bis ein Zug dieser
 * Figur auf dieser Karte bestätigt ist.
 */
export async function reaktionDa(repo: Repository, stand: Stand, karte: string, id: string, kampf: Entity | null): Promise<boolean> {
  const verbraucht = (await repo.listEvents({ name: REACTION_EVENT, subject: karte, limit: FENSTER })).find((ev) => (ev.payload as ReactionSpent)?.reactor === id);
  if (!verbraucht) return true;
  const p = verbraucht.payload as ReactionSpent;
  if (kampf && p.encounter === kampf.id && p.round != null && p.turn != null) {
    const { jetzt, platz } = kampfStand(stand, kampf, id);
    const zurueck = reactionBack({ round: p.round, turn: p.turn }, jetzt, platz);
    if (zurueck !== null) return zurueck;
  }
  return (await plaeneDerKarte(repo, karte)).some((pl) => pl.actor === id && pl.state === 'confirmed' && pl.at > verbraucht.at);
}

/** Ein Wurf auf Treffen: Summe, Natur, RK und ob er trifft (ohne RK `null`, ausser bei einer Natur). */
export interface TrefferWurf {
  total: number | null;
  crit?: 'crit' | 'fumble';
  hit: boolean | null;
  ac: number | null;
  /** Mit Vorteil oder Nachteil gewürfelt (T-275). */
  mode?: 'adv' | 'dis';
}

/**
 * **Die Kreaturen am Tisch für die Regeln** (REQ-357): jedes Token dieser
 * Karte mit Statblock, im Kampf nur die Teilnehmer — mit Feld, Reichweite,
 * Seite, Reaktion und dem, was es beim Namen kennt. Die Leitung führt aus,
 * also gegen die ganze Karte (wie `bedrohungen`).
 */
export async function tischKreaturen(repo: Repository, stand: Stand, karte: Entity, geo: GridGeometry, kampf: Entity | null): Promise<RuleCreature[]> {
  const dabei = kampf ? participantIds(kampf) : null;
  const out: RuleCreature[] = [];
  const gesehen = new Set<string>();
  for (const m of markersOf(karte)) {
    if (m.kind === 'scenery' || gesehen.has(m.to)) continue;
    if (dabei && !dabei.has(m.to)) continue;
    const e = stand.map.get(m.to);
    const sb = e ? statblockVon(stand.alle, e) : null;
    if (!e || !sb) continue;
    gesehen.add(m.to);
    out.push(
      tableCreature({
        entity: e,
        stats: werte(stand.map, sb),
        cell: cellAt(geo, m),
        reach: reichweiteVon(stand, e),
        reactionFree: await reaktionDa(repo, stand, karte.id, e.id, kampf),
        side: seiteVon(stand, kampf, e.id),
        knows: knownNames(e, resolveInstance(stand.map, sb), stand.map),
      }),
    );
  }
  return out;
}

/**
 * **Freies Ziehen im Kampf** (T-198, Runde 2): läuft auf der Karte eine
 * Begegnung, bewegt, wer nicht leitet, kein Token eines Teilnehmers und
 * kein Spiel-Token — die eigene Figur geht dann über den Zugplan. Gibt den
 * Grund zurück, oder `null`, wenn das Schreiben darf.
 */
export function zugSperre(user: User | null, alle: Entity[], vorher: Entity | undefined, nachher: Entity, kampagne: string | null): string | null {
  if (!user || !vorher || !isMap(vorher) || !isMap(nachher)) return null;
  if (leitetTisch(user, kampagne)) return null;
  const kampf = encounterOnMap(alle, nachher.id);
  if (!kampf) {
    /* **Ausserhalb eines Kampfes sagt es die Kampagne** (T-204): bei
       `moves: 'confirm'` zieht eine Spielerin ihre Figur nicht selbst,
       auch wenn sie die Karte schreiben darf — ihr Zug ist ein Vorschlag
       (`POST /api/maps/:id/move`). */
    const k = kampagne ? alle.find((e) => e.id === kampagne) : undefined;
    if (mapRulesOf(k).moves !== 'confirm') return null;
    if (!movedTokens(vorher, nachher, new Set(user.actorIds ?? [])).some((id) => (user.actorIds ?? []).includes(id))) return null;
    return 'Moves wait for the GM to confirm them.';
  }
  if (!movedTokens(vorher, nachher, participantIds(kampf)).length) return null;
  return 'During an encounter, tokens move through the turn plan.';
}

/**
 * **Den Weg eines Zuges aufdecken** (T-204, REQ-139): entlang der Felder
 * (sonst vom Token zum Ziel), mit `for` auf die Figur — gilt der Nebel je
 * Figur, sieht ihn nur sie (und ihre Gruppe). Hält auf der Karte etwas den
 * Blick, deckt jeder Punkt auf, was man von dort sieht (T-118,
 * `revealAlong`); sonst ein Pinselstrich zwei Felder breit. Im Dunkeln
 * zählen Dunkelsicht und Licht (T-216, `revealSeenAlong`).
 */
export function wegAufdecken(
  karte: Entity,
  figur: string,
  s: { path: { x: number; y: number }[]; to?: { x: number; y: number } },
  von: { x: number; y: number },
  nat: { w: number; h: number },
  bestand: ReadonlyMap<string, Entity>,
): Entity {
  const einst = mapSettings(karte);
  const geo = s.path.length > 1 ? gridGeometry(einst, nat) : null;
  const pts = geo ? s.path.map((c) => cellPoint(geo, c)) : [von, ...(s.to ? [s.to] : [])];
  /* Im Dunkeln (T-216) reicht der Blick so weit wie die Dunkelsicht aus dem
     Statblock der Figur, dazu die Lichter, die sie sieht. */
  return revealSeenAlong(karte, pts, nat, () => `s-${randomUUID()}`, figur, darkvisionFor(bestand, figur), carriedLights(bestand, karte));
}

export function registerZugplan(app: FastifyInstance, deps: ZugplanDeps): void {
  const { repo, feed, viewerOf, roh, sieve, geltend, schreibeGeprueft } = deps;

  /**
   * **Darf es jetzt durch diesen Übergang?** (T-326) Die Regeln des
   * Übergangs, gefragt mit dem Stand des Kampfes auf der Karte: wer am
   * Zug ist, ob es der letzte Zug der Runde ist.
   */
  function durchErlaubt(stand: Stand, karte: Entity, kampagne: Entity | null, ende: Passage, figur: string, leitet: boolean): string | null {
    const kampf = encounterOnMap(stand.alle, karte.id);
    const zug = kampf ? turnOf(stand.map, kampf) : {};
    return mayUsePassage(passageRulesOf(kampagne, ende), {
      gm: leitet,
      combat: !!kampf,
      ownTurn: zug.current?.to === figur,
      lastTurn: !!kampf && isLastTurn(stand.map, kampf),
    });
  }

  /** Durchschicken und schreiben — Quelle, Ziel und bei Bedarf die Sitzung. */
  async function schickeDurch(
    stand: Stand,
    karte: Entity,
    kampagne: Entity | null,
    ende: Passage,
    rels: string[],
    nat: { w: number; h: number } | null,
    sitzungFolgt: boolean,
  ): Promise<{ map: string; floor: string; moved: { rel: string; to: { x: number; y: number } }[] } | { fehler: number; error: string; issues?: unknown }> {
    const d = await durchschicken({ geltend, insSpiel: deps.insSpiel }, { stand, karte, kampagne, ende, rels, nat });
    if ('fehler' in d) return d;
    for (const e of d.andere) {
      const w = await schreibeGeprueft(e);
      if ('issues' in w) return { fehler: 422, error: 'The target map could not be written.', issues: w.issues };
    }
    const w = await schreibeGeprueft(d.quelle);
    if ('issues' in w) return { fehler: 422, error: 'Die Karte liess sich nicht schreiben.', issues: w.issues };
    /* **Die Spielenden wechseln mit** (T-326): schickt die Leitung durch ein
       Portal auf eine andere Karte, zeigt die Sitzung, die diese Karte auf
       dem Tisch hat, danach die Zielkarte. */
    if (sitzungFolgt && d.map !== karte.id) {
      const sitzung = tischSitzung(stand.alle);
      const st = sitzung ? ((sitzung.components?.['Session'] ?? sitzung.components?.['SessionState'] ?? {}) as Record<string, unknown>) : null;
      if (sitzung && st?.['activeMap'] === karte.id) {
        const name = sitzung.components?.['Session'] ? 'Session' : 'SessionState';
        const ws = await schreibeGeprueft({ ...sitzung, components: { ...sitzung.components, [name]: { ...st, activeMap: d.map } } });
        if ('issues' in ws) return { fehler: 422, error: 'The session could not be written.', issues: ws.issues };
      }
    }
    if (d.map !== karte.id) feed.publish({ kind: 'plan', id: d.map });
    return { map: d.map, floor: d.floor, moved: d.moved };
  }

  /** Die gesiebte Karte, die rohe dazu, Kampagne und Rolle — oder ein Fehler. */
  async function lage(request: FastifyRequest, id: string) {
    const user = await viewerOf(request);
    if (!user) return { fehler: 401 as const };
    const stand = await roh();
    const gefunden = stand.map.get(id);
    if (!gefunden || !isMap(gefunden)) return { fehler: 404 as const };
    const roheKarte = await geltend(gefunden, stand.map);
    const [karte] = await sieve(request, [roheKarte], stand.map);
    if (!karte) return { fehler: 404 as const };
    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    const leitet = leitetTisch(user, kampagne?.id ?? null);
    return { user, stand, roheKarte, karte, kampagne, leitet };
  }

  /**
   * Für wen der Betrachter planen darf: **nur für die eigenen Figuren**
   * mit Token hier (T-325, die Leitung 21.10.: „nur den Besitzern des
   * jeweiligen Charakters"), die Leitung für jede Kreatur mit Statblock.
   * Bis T-325 plante eine Spielerin auch, wen `tokenMove` sie ziehen liess
   * (T-290) — dann stand der Zugplan auch bei Spielenden ohne eigene Figur.
   * Ist er an der Kampagne aus (`turnPlanner: 'off'`), plant niemand.
   */
  function figuren(stand: Stand, karte: Entity, user: User, leitet: boolean, kampagne: Entity | null): Entity[] {
    if (turnPlannerOf(kampagne) === 'off') return [];
    const eigene = new Set(user.actorIds ?? []);
    const ids = [...new Set(markersOf(karte).map((m) => m.to))];
    return ids
      .map((i) => stand.map.get(i))
      .filter((e): e is Entity => !!e)
      .filter((e) => eigene.has(e.id) || (leitet && !!statblockVon(stand.alle, e)));
  }

  /**
   * Der Name einer Figur, wie der Betrachter ihn sieht — seit T-290 plant
   * und zieht eine Spielerin auch Figuren, die nicht ihre sind, und deren
   * Deckname (REQ-178) ist ein Feld wie jedes.
   */
  async function nameFuer(request: FastifyRequest, e: Entity, leitet: boolean, bestand: Map<string, Entity>): Promise<string> {
    if (leitet) return entityName(e);
    const [g] = await sieve(request, [e], bestand);
    return g ? entityName(g) : e.id;
  }

  app.get<{ Params: { id: string }; Querystring: { actor?: string; nat?: string } }>('/api/maps/:id/turn-plan', async (request, reply) => {
    const l = await lage(request, request.params.id);
    if ('fehler' in l) return reply.code(l.fehler ?? 404).send({ error: l.fehler === 401 ? 'Nicht angemeldet' : 'Nicht gefunden' });
    const { user, stand, roheKarte, karte, kampagne, leitet } = l;
    const stufe = turnPlannerOf(kampagne);
    const moegliche = figuren(stand, karte, user, leitet, kampagne);
    const nameVon = new Map((leitet || !moegliche.length ? moegliche : await sieve(request, moegliche, stand.map)).map((e) => [e.id, entityName(e)]));
    const figur = moegliche.find((e) => e.id === request.query.actor) ?? moegliche.find((e) => (user.actorIds ?? []).includes(e.id)) ?? moegliche[0] ?? null;
    const kampf = encounterOnMap(stand.alle, roheKarte.id);

    let tiles: PlanTile[] = [];
    let speed = 30;
    if (figur) {
      const sb = statblockVon(stand.alle, figur);
      const aktionsIds = sb ? (resolveInstance(stand.map, sb).relations ?? []).filter((r) => r.type === 'composedOf').map((r) => r.to) : [];
      const da = aktionsIds.flatMap((i) => stand.map.get(i) ?? []);
      const sicht = new Set((da.length ? await sieve(request, da, stand.map) : []).map((e) => e.id));
      tiles = plannerTiles(kachelnVon(stand.map, sb, (i) => sicht.has(i)), stufe);
      speed = tempoVon(werte(stand.map, sb));
    }

    /* Die Ziele: was auf der gesiebten Karte steht, ausser der Figur selbst. */
    const marker = markersOf(karte).filter((m) => m.kind !== 'scenery');
    const zielIds = [...new Set(marker.map((m) => m.to))].filter((i) => i !== figur?.id);
    const zielRoh = zielIds.flatMap((i) => stand.map.get(i) ?? []);
    const ziele = zielRoh.length ? await sieve(request, zielRoh, stand.map) : [];
    const sichtbar = new Set(ziele.map((z) => z.id));
    const angriffe = tiles.filter((t) => t.toHit !== null);
    /* **Vorteil und Nachteil in der Vorschau** (T-351): aus den Wirkungen
       beider (Zustände, Dodge, Help …) und dem Abstand, wo die Tokens jetzt
       stehen; `long` ist die Chance auf langer Reichweite, für die Maske,
       die den Abstand am Ende des geplanten Wegs kennt. */
    const folgenJetzt = neueFolgen(stand, roheKarte.id);
    const ich = figur ? werteAmTisch(folgenJetzt, stand, figur) : null;
    const markerIch = figur ? markersOf(roheKarte).find((m) => m.to === figur.id) : undefined;
    /* Die Bildgrösse sagt das Asset, sonst der Browser (`?nat=1960x700`). */
    const natQ = /^(\d+)x(\d+)$/.exec(request.query.nat ?? '');
    const natJetzt = natQ ? cleanNat({ w: Number(natQ[1]), h: Number(natQ[2]) }) : null;
    const geoJetzt = markerIch ? geoDerEbene(stand, roheKarte, floorOfMarker(roheKarte, markerIch.rel.id), natJetzt) : null;
    const targets = ziele.map((z) => {
      const roh = stand.map.get(z.id)!;
      const ac = rkVon(stand, roh);
      const chances: Record<string, number> = {};
      const long: Record<string, number> = {};
      const modes: Record<string, 'adv' | 'dis'> = {};
      const er = ich ? werteAmTisch(folgenJetzt, stand, roh).totals.grants : {};
      const feet = figur ? abstandImPlan(karte, geoJetzt, figur.id, z.id) : null;
      for (const t of angriffe) {
        /* `chances` ohne lange Reichweite — ob sie gilt, weiss erst die
           Maske am Ende des Wegs; dafür steht `long` daneben. */
        const { mode } = attackRollMode(ich?.totals.grants ?? {}, er, { feet });
        if (mode) modes[t.id] = mode;
        if (ac === null) continue;
        chances[t.id] = Math.round(hitChance(t.toHit!, ac, mode) * 100);
        if (t.longRange !== null) long[t.id] = Math.round(hitChance(t.toHit!, ac, attackRollMode(ich?.totals.grants ?? {}, er, { feet, long: true }).mode) * 100);
      }
      return {
        id: z.id,
        name: entityName(z),
        type: primaryInterface(z),
        chances,
        ...(Object.keys(long).length ? { long } : {}),
        ...(Object.keys(modes).length ? { modes } : {}),
        ...(feet !== null ? { feet } : {}),
        ...(leitet && ac !== null ? { ac } : {}),
      };
    });
    /* Wer die Figur bedroht — auf der gesiebten Karte und nur, wen der
       Betrachter sieht; Namen wie in `targets`. */
    const namen = new Map(targets.map((t) => [t.id, t.name]));
    const threats = figur
      ? bedrohungen(stand, karte, figur.id, kampf)
          .filter((t) => sichtbar.has(t.id))
          .map((t) => ({ ...t, name: namen.get(t.id) ?? t.name }))
      : [];

    /* Die Pläne: die Leitung sieht alle dieser Karte, Spielende ihre
       eigenen — und den, der ihre Figur gerade um eine Reaktion fragt. */
    const eigene = new Set(user.actorIds ?? []);
    /* Ist der Zugplan aus, bleiben der Leitung nur die offenen — die alten
       stünden sonst als Grund für das Werkzeug da. */
    const plans = (await plaeneDerKarte(repo, karte.id))
      .filter((p) => stufe !== 'off' || (leitet && (p.state === 'planned' || p.state === 'reacting')))
      .filter((p) => leitet || p.by?.id === user.id || eigene.has(p.actor) || (p.state === 'reacting' && !!p.pending && eigene.has(p.pending.reactor)))
      .slice(0, 20)
      .map((p) => ({ ...p, ...(p.state === 'reacting' && p.pending ? { canAnswer: darfAntworten(user, leitet, p.pending.reactor) } : {}) }));

    return {
      leitet,
      planner: stufe,
      encounter: kampf ? { id: kampf.id } : null,
      actors: moegliche.map((e) => ({ id: e.id, name: nameVon.get(e.id) ?? e.id, own: eigene.has(e.id), rel: markersOf(karte).find((m) => m.to === e.id)?.rel.id ?? null })),
      actor: figur
        ? {
            id: figur.id,
            name: nameVon.get(figur.id) ?? figur.id,
            speed,
            rel: markersOf(karte).find((m) => m.to === figur.id)?.rel.id ?? null,
            reaction: await reaktionDa(repo, stand, roheKarte.id, figur.id, kampf),
          }
        : null,
      tiles,
      targets,
      threats,
      plans,
      passages: figur ? uebergaengeFuer(stand, roheKarte, karte, kampagne, figur.id, leitet, speed) : [],
    };
  });

  /**
   * **Die Übergänge, die der Plan anbietet** (T-326): auf der Ebene der
   * Figur, wie der Betrachter die Karte sieht, je mit Fläche (ohne eigene
   * das Feld um den Punkt, wenn die Bildgrösse am Asset steht), Kosten und
   * — wenn er es jetzt nicht erlaubt — dem Grund.
   */
  function uebergaengeFuer(stand: Stand, roheKarte: Entity, karte: Entity, kampagne: Entity | null, figur: string, leitet: boolean, tempo: number) {
    const m = markersOf(karte).find((x) => x.to === figur);
    if (!m) return [];
    const ebene = floorOfMarker(karte, m.rel.id);
    const geo = geoDerEbene(stand, roheKarte, ebene, null);
    return passageEnds(floorView(karte, ebene), ebene).map((e) => {
      const r = passageRulesOf(kampagne, e);
      return {
        via: e.relId,
        name: e.note || e.kind,
        at: e.at,
        area: passageArea(e, geo),
        feet: passageFeet(r, tempo, geo?.cellFeet ?? 5),
        cost: r.action === 'none' ? ('free' as const) : r.action,
        blocked: durchErlaubt(stand, roheKarte, kampagne, e, figur, leitet),
        from: { x: m.x, y: m.y },
      };
    });
  }

  /**
   * Ein Übergang im Plan: steht die Figur nach den Schritten davor in
   * seiner Fläche, kennt der Betrachter ihn, erlaubt er es jetzt? Dann
   * Name und Kosten nach seinen Regeln, sonst der Grund.
   */
  function passageImPlan(
    stand: Stand,
    roheKarte: Entity,
    karte: Entity,
    kampagne: Entity | null,
    figur: string,
    davor: readonly PlanStep[],
    via: string,
    nat: { w: number; h: number } | null,
    leitet: boolean,
    tempo: number,
  ): { name: string; feet: number; cost: PlanCost } | string {
    const m = markersOf(roheKarte).find((x) => x.to === figur);
    if (!m) return 'The character has no token here.';
    const ebene = floorOfMarker(roheKarte, m.rel.id);
    const geo = geoDerEbene(stand, roheKarte, ebene, nat);
    const letzter = [...davor].reverse().find((x) => x.kind === 'move');
    const wo = letzter?.kind === 'move' && letzter.to ? letzter.to : { x: m.x, y: m.y };
    const ende = passageEnds(floorView(karte, ebene), ebene).find((e) => e.relId === via);
    if (!ende || !inPassage(ende, wo, geo)) return 'The character does not stand in that passage.';
    const nein = durchErlaubt(stand, roheKarte, kampagne, ende, figur, leitet);
    if (nein) return nein;
    const r = passageRulesOf(kampagne, ende);
    return {
      name: ende.note || ende.kind,
      feet: passageFeet(r, tempo, geo?.cellFeet ?? 5),
      cost: r.action === 'none' ? 'free' : r.action,
    };
  }

  /**
   * Der erste Angriff des Plans, dessen Ziel ausser Reichweite steht, als
   * Satz, der sagt, was zu tun ist — sonst `null`.
   */
  function ausserReichweite(stand: Stand, roheKarte: Entity, karte: Entity, figur: Entity, steps: readonly PlanStep[], nat: { w: number; h: number } | null): string | null {
    const m = markersOf(roheKarte).find((x) => x.to === figur.id);
    if (!m) return null;
    const geo = geoDerEbene(stand, roheKarte, floorOfMarker(roheKarte, m.rel.id), nat);
    if (!geo) return null;
    const kacheln = new Map(kachelnVon(stand.map, statblockVon(stand.alle, figur), () => true).map((t) => [t.id, t]));
    for (const [i, s] of steps.entries()) {
      if (s.kind !== 'act' || !s.target) continue;
      const t = kacheln.get(s.tile);
      if (!t) continue;
      const feet = abstandImPlan(karte, geo, figur.id, s.target, steps.slice(0, i));
      if (rangeBand(t, feet) !== 'out') continue;
      const reicht = `${t.range} ft${t.longRange ? `, long ${t.longRange} ft` : ''}`;
      return `${s.targetName ?? 'The target'} is ${feet} ft away — out of range for ${t.name} (${reicht}). Move closer first or pick another target.`;
    }
    return null;
  }

  /** Antworten darf die Leitung für jeden, Spielende für ihre Figur. */
  function darfAntworten(user: User, leitet: boolean, reactor: string): boolean {
    return leitet || (user.actorIds ?? []).includes(reactor);
  }

  app.post<{ Params: { id: string }; Body: { actor?: unknown; steps?: unknown; plan?: unknown; nat?: unknown } | null }>(
    '/api/maps/:id/turn-plan',
    async (request, reply) => {
      const l = await lage(request, request.params.id);
      if ('fehler' in l) return reply.code(l.fehler ?? 404).send({ error: l.fehler === 401 ? 'Nicht angemeldet' : 'Nicht gefunden' });
      const { user, stand, roheKarte, karte, kampagne, leitet } = l;
      const b = request.body ?? {};
      const figur = figuren(stand, karte, user, leitet, kampagne).find((e) => e.id === b.actor);
      if (!figur) return reply.code(403).send({ error: 'Planen darf, wer die Figur führt oder am Tisch leitet — und sie braucht ein Token auf dieser Karte.' });
      const steps = (Array.isArray(b.steps) ? b.steps : []).slice(0, 30).map(cleanStep).filter((s): s is PlanStep => !!s);
      if (!steps.length) return reply.code(422).send({ error: 'Ein Plan braucht mindestens einen Schritt.' });
      /* Die Stufe der Kampagne (T-325): was sie nicht anbietet, nimmt sie auch nicht an. */
      if (steps.some((s) => !plannerAllows(s, turnPlannerOf(kampagne)))) return reply.code(422).send({ error: 'This campaign’s turn planner does not take that step.' });
      const tempo = tempoVon(werte(stand.map, statblockVon(stand.alle, figur)));
      const kampf = encounterOnMap(stand.alle, roheKarte.id);
      const reactionSpent = !(await reaktionDa(repo, stand, roheKarte.id, figur.id, kampf));
      /* **Übergänge im Plan** (T-326): der Server setzt die Kosten aus den
         Regeln des Übergangs, prüft, dass die Figur an der Stelle des Plans
         in der Fläche steht, und ob der Übergang es ihr jetzt erlaubt. */
      for (const [i, s] of steps.entries()) {
        if (s.kind !== 'passage') continue;
        const pruef = passageImPlan(stand, roheKarte, karte, kampagne, figur.id, steps.slice(0, i), s.via, cleanNat(b.nat), leitet, tempo);
        if (typeof pruef === 'string') return reply.code(422).send({ error: pruef });
        steps[i] = { ...s, name: pruef.name, feet: pruef.feet, cost: pruef.cost };
        /* Nach einem Übergang steht die Figur woanders — der Plan endet dort. */
        steps.splice(i + 1);
        break;
      }
      const { problems } = planBudget(steps, tempo, { reactionSpent });
      if (problems.length) return reply.code(422).send({ error: problems.join(' ') });
      /* **Reichweite am Server** (T-351): ausser Reichweite nimmt der Plan
         nicht an — gemessen vom Ende des Wegs davor, auf der Karte, die der
         Einreichende sieht. Ohne Gitter oder Token prüft niemand. */
      const weit = ausserReichweite(stand, roheKarte, karte, figur, steps, cleanNat(b.nat));
      if (weit) return reply.code(422).send({ error: weit });

      let planId = typeof b.plan === 'string' && b.plan ? b.plan : '';
      if (planId) {
        const alt = (await plaeneDerKarte(repo, karte.id)).find((p) => p.plan === planId);
        if (!alt || alt.actor !== figur.id || alt.state !== 'planned') planId = '';
      }
      const nat = cleanNat(b.nat);
      const plan: TurnPlan = {
        plan: planId || `tp-${randomUUID().slice(0, 12)}`,
        map: karte.id,
        actor: figur.id,
        actorName: await nameFuer(request, figur, leitet, stand.map),
        by: { id: user.id, name: user.name },
        steps,
        state: 'planned',
        campaign: kampagne?.id ?? null,
        session: tischSitzung(stand.alle)?.id ?? null,
        ...(nat ? { nat } : {}),
      };
      await repo.appendEvent(TURNPLAN_EVENT, karte.id, plan);
      feed.publish({ kind: 'plan', id: karte.id });
      return { ...plan, text: planText(steps) };
    },
  );

  /**
   * **Ein Token ziehen** (T-204, T-290, `POST /api/maps/:id/move`
   * `{rel, to, nat?, path?, feet?}`): ausserhalb eines Kampfes, auch wenn
   * die Karte nicht schreibt, wer zieht — welche Tokens, sagt
   * `Campaign.tokenMove` (`darfZiehen`). Geschrieben wird nur die Stelle
   * dieses einen Tokens, an der Karte, die man offen hat (auch einer
   * Karteninstanz, T-289). Die Kampagne sagt, wie
   * (`mapRulesOf`): `free` zieht sofort, `confirm` legt einen Vorschlag als
   * Zugplan mit einem Schritt an — die Leitung bestätigt ihn wie jeden
   * (`decide`). Aufgedeckt wird, wenn die Regel es sagt, beim Ziehen
   * bzw. beim Bestätigen. Im Kampf gilt der Zugplan (423).
   */
  app.post<{ Params: { id: string }; Body: { rel?: unknown; to?: unknown; nat?: unknown; path?: unknown; feet?: unknown; via?: unknown } | null }>(
    '/api/maps/:id/move',
    async (request, reply) => {
      const l = await lage(request, request.params.id);
      if ('fehler' in l) return reply.code(l.fehler ?? 404).send({ error: l.fehler === 401 ? 'Nicht angemeldet' : 'Nicht gefunden' });
      const { user, stand, roheKarte, karte, kampagne, leitet } = l;
      const b = request.body ?? {};
      const marker = markersOf(roheKarte).find((m) => m.rel.id === b.rel);
      if (!marker || !markersOf(karte).some((m) => m.rel.id === marker.rel.id)) return reply.code(404).send({ error: 'Das Token gibt es hier nicht.' });
      /* **Wer zieht, sagt die Kampagne** (T-290, `tokenMove`) — gefragt an
         der gesiebten Karte: wer ein Token nicht sieht, zieht es nicht. */
      const regeln = mapRulesOf(kampagne, roheKarte);
      /* **Ein Asset ist fix, bis es `movable` sagt** (T-306): in Play
         schiebt es auch die Leitung nicht — sie verschiebt es in der
         Bearbeitung. Ein verschiebbares schieben Spielende nach
         `mayMoveAsset`, auch im Kampf (eine Kiste hat keinen Zug). */
      /* Ein freies Licht (T-320) setzt die Leitung in der Bearbeitung. */
      if ((marker.kind === 'light' || marker.kind === 'passage') && !leitet) return reply.code(403).send({ error: 'Only the GM moves this.' });
      const asset = marker.kind === 'scenery';
      if (asset && !marker.movable) return reply.code(403).send({ error: 'This asset is fixed. Move it while editing the map.' });
      if (asset ? !leitet && !mayMoveAsset(regeln) : !darfZiehen(leitet, regeln, marker.to, zieher(stand, kampagne, karte, user.actorIds ?? [])))
        return reply.code(403).send({ error: asset ? 'This campaign does not let you move that asset.' : 'This campaign does not let you move that token.' });
      /* **Je Ebene** (T-307): Gitter, Sperren und Nebel sind die der Ebene,
         auf der das Token steht. */
      const ebene = floorOfMarker(roheKarte, marker.rel.id);
      const roheEbene = floorView(roheKarte, ebene);

      /* **Durchgehen** (T-307, T-326): das Token steht in der Fläche eines
         Übergangs und wechselt auf dessen Ziel — dieselbe Karte oder durch
         ein Portal auf eine andere. Wer es ziehen darf, darf es
         durchgehen lassen, wenn der Übergang es Spielenden erlaubt
         (`passageRulesOf`); bestätigt die Leitung, wird es ein Zugplan mit
         einem Schritt. Im Kampf geht es über den Zugplan, der die Kosten
         gegen den Zug rechnet. */
      if (typeof b.via === 'string' && b.via) {
        if (asset) return reply.code(422).send({ error: 'An asset does not take a passage.' });
        const nat = cleanNat(b.nat);
        const geo = geoDerEbene(stand, roheKarte, ebene, nat);
        const ende = passageEnds(roheEbene, ebene).find((e) => e.relId === b.via && inPassage(e, marker, geo));
        /* Spielende kennen nur Übergänge, die ihre Karte trägt. */
        if (!ende || (!leitet && !passageEnds(floorView(karte, ebene), ebene).some((e) => e.relId === ende.relId))) return reply.code(404).send({ error: 'There is no passage here.' });
        const nein = durchErlaubt(stand, roheKarte, kampagne, ende, marker.to, leitet);
        if (nein && !leitet) return reply.code(403).send({ error: nein });
        if (!leitet && encounterOnMap(stand.alle, roheKarte.id)) return reply.code(423).send({ error: 'During an encounter, take the passage in your turn plan.' });
        if (!leitet && passageNeedsConfirm(passageRulesOf(kampagne, ende), regeln.moves)) {
          const figur = stand.map.get(marker.to);
          const plan: TurnPlan = {
            plan: `tp-${randomUUID().slice(0, 12)}`,
            map: roheKarte.id,
            actor: marker.to,
            actorName: figur ? await nameFuer(request, figur, leitet, stand.map) : marker.to,
            by: { id: user.id, name: user.name },
            steps: [{ id: 's1', kind: 'passage', via: ende.relId, name: ende.kind, feet: 0, cost: 'free' }],
            state: 'planned',
            campaign: kampagne?.id ?? null,
            session: tischSitzung(stand.alle)?.id ?? null,
            ...(nat ? { nat } : {}),
          };
          await repo.appendEvent(TURNPLAN_EVENT, roheKarte.id, plan);
          feed.publish({ kind: 'plan', id: roheKarte.id });
          return reply.code(202).send({ proposal: { ...plan, text: planText(plan.steps) } });
        }
        const r = await schickeDurch(stand, roheKarte, kampagne, ende, [marker.rel.id], nat, false);
        if ('fehler' in r) return reply.code(r.fehler).send({ error: r.error, ...(r.issues ? { issues: r.issues } : {}) });
        return { moved: marker.rel.id, map: r.map, floor: r.floor, to: r.moved[0]?.to };
      }
      if (!asset && !leitet && encounterOnMap(stand.alle, roheKarte.id)) return reply.code(423).send({ error: 'During an encounter, tokens move through the turn plan.' });

      const roh = (b.to ?? {}) as { x?: unknown; y?: unknown };
      const tx = Number(roh.x);
      const ty = Number(roh.y);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return reply.code(422).send({ error: 'to: {x, y} in Anteilen der Karte' });
      const to = { x: Math.min(1, Math.max(0, tx)), y: Math.min(1, Math.max(0, ty)) };
      const nat = cleanNat(b.nat);
      const figur = stand.map.get(marker.to);
      /* Ohne Felder vom Browser: die Gerade, in Fuss gemessen, wenn die Karte ein Gitter hat. */
      const einst = mapSettings(roheEbene);
      const geo = nat ? gridGeometry(einst, nat) : null;
      const gerade = geo ? Math.round(feetBetween(geo, marker, to)) : 0;
      const schritt = cleanStep({ id: 's1', kind: 'move', path: b.path, feet: b.feet, to }, 0) ?? { id: 's1', kind: 'move' as const, path: [], feet: gerade, to };
      if (schritt.kind !== 'move') return reply.code(422).send({ error: 'Kein Zug' });
      /* **Was den Schritt hält, hält ihn** (T-118): eine Wand, eine
         geschlossene Tür, ein Fenster, ein Abgrund zwischen Token und Ziel.
         Geprüft wird der Weg, den der Zug nimmt — die Felder, sonst die
         Gerade. Die Leitung zieht weiter durch alles. */
      if (!leitet) {
        const ar = nat && nat.w > 0 ? nat.h / nat.w : 1;
        /* Assets, die den Schritt halten, halten ihn auch (T-306) — das gezogene nicht sich selbst. */
        const sperren = blockingWalls(roheEbene, nat, marker.rel.id);
        const punkte = geo && schritt.path.length > 1 ? schritt.path.map((c) => cellPoint(geo, c)) : [{ x: marker.x, y: marker.y }, to];
        for (let i = 1; i < punkte.length; i++) {
          if (!wallsClear(sperren, punkte[i - 1]!, punkte[i]!, ar, 'move')) return reply.code(422).send({ error: 'A wall is in the way.' });
        }
      }

      if (!asset && !leitet && regeln.moves === 'confirm') {
        /* Ein offener Vorschlag derselben Figur, der nur zieht, wird ersetzt —
           ein Zugplan mit Aktionen bleibt, wie er ist. */
        const alt = (await plaeneDerKarte(repo, roheKarte.id)).find(
          (p) => p.actor === marker.to && p.state === 'planned' && p.steps.every((x) => x.kind === 'move'),
        );
        const plan: TurnPlan = {
          plan: alt?.plan ?? `tp-${randomUUID().slice(0, 12)}`,
          map: roheKarte.id,
          actor: marker.to,
          actorName: figur ? await nameFuer(request, figur, leitet, stand.map) : marker.to,
          by: { id: user.id, name: user.name },
          steps: [schritt],
          state: 'planned',
          campaign: kampagne?.id ?? null,
          session: tischSitzung(stand.alle)?.id ?? null,
          ...(nat ? { nat } : {}),
        };
        await repo.appendEvent(TURNPLAN_EVENT, roheKarte.id, plan);
        feed.publish({ kind: 'plan', id: roheKarte.id });
        return reply.code(202).send({ proposal: { ...plan, text: planText(plan.steps) } });
      }

      let neu = moveMarker(roheKarte, marker.rel.id, to);
      if (!asset && regeln.revealOnMove && fogOn(roheKarte) && nat) neu = onFloor(neu, ebene, (v) => wegAufdecken(v, marker.to, schritt, marker, nat, stand.map));
      const r = await schreibeGeprueft(neu);
      if ('issues' in r) return reply.code(422).send({ error: 'Die Karte liess sich nicht schreiben.', issues: r.issues });
      return { moved: marker.rel.id, to };
    },
  );

  /**
   * **Alle durchschicken** (T-326, `POST /api/maps/:id/passage`
   * `{via, floor, nat?}`): die Leitung schickt jedes Token, das in der
   * Fläche eines Übergangs steht, auf dessen Ziel — Figuren und das
   * Gruppen-Token. Durch ein Portal auf eine andere Karte wechselt die
   * Sitzung mit, wenn sie diese Karte zeigt. Ist der Übergang den
   * Spielenden vorbehalten (`trigger: 'players'`), schickt sie niemanden.
   */
  app.post<{ Params: { id: string }; Body: { via?: unknown; floor?: unknown; nat?: unknown } | null }>(
    '/api/maps/:id/passage',
    async (request, reply) => {
      const l = await lage(request, request.params.id);
      if ('fehler' in l) return reply.code(l.fehler ?? 404).send({ error: l.fehler === 401 ? 'Nicht angemeldet' : 'Nicht gefunden' });
      const { stand, roheKarte, kampagne, leitet } = l;
      if (!leitet) return reply.code(403).send({ error: 'Only the GM sends everyone through.' });
      const b = request.body ?? {};
      const ebene = typeof b.floor === 'string' && b.floor ? b.floor : GROUND_FLOOR;
      const nat = cleanNat(b.nat);
      const ende = passageEnds(floorView(roheKarte, ebene), ebene).find((e) => e.relId === b.via);
      if (!ende) return reply.code(404).send({ error: 'There is no passage here.' });
      const nein = mayUsePassage(passageRulesOf(kampagne, ende), { gm: true, combat: false, ownTurn: false, lastTurn: false });
      if (nein) return reply.code(403).send({ error: nein });
      const geo = geoDerEbene(stand, roheKarte, ebene, nat);
      const wer = tokensInPassage(floorView(roheKarte, ebene), ende, geo).map((m) => m.rel.id);
      if (!wer.length) return reply.code(422).send({ error: 'Nobody stands in this passage.' });
      const r = await schickeDurch(stand, roheKarte, kampagne, ende, wer, nat, true);
      if ('fehler' in r) return reply.code(r.fehler).send({ error: r.error, ...(r.issues ? { issues: r.issues } : {}) });
      return r;
    },
  );

  /** Ein Wurf am Server ins Log (T-172), für `wer`, geworfen von `von`. */
  async function wurf(
    wer: Entity,
    von: { id: string; name: string },
    expr: string,
    label: string,
    kampagne: Entity | null,
    hidden: boolean,
    stand: Stand,
  ): Promise<{ total: number; crit?: 'crit' | 'fumble' | undefined; nat?: number } | null> {
    const w = rollDice(expr, zufall);
    if (!w) return null;
    const nat = naturalD20(w);
    const payload: RollPayload = {
      expr: w.expr,
      total: w.total,
      rolls: w.rolls,
      modifier: diceModifier(w),
      ...(nat ? { nat: nat.nat } : {}),
      ...(nat?.crit ? { crit: nat.crit } : {}),
      label: label.slice(0, 120),
      by: von,
      actor: { id: wer.id, name: entityName(wer) },
      campaign: kampagne?.id ?? null,
      session: tischSitzung(stand.alle)?.id ?? null,
      ...(hidden ? { hidden: true as const } : {}),
    };
    await wurfEintragen({ repo, feed }, wer, payload);
    return { total: w.total, crit: nat?.crit, ...(nat ? { nat: nat.nat } : {}) };
  }

  /**
   * **Was ein Zug am Tisch ändert** (T-275): die Begegnung (Trefferpunkte
   * und Einträge der Teilnehmer) und Figuren (`Vitals`), gesammelt und am
   * Ende — oder vor einer Reaktion — geschrieben, durch `validateEntity`.
   * Der Bestand wird nicht angefasst: gelesen wird über `aktuell`.
   */
  interface Folgen {
    kampf: Entity | null;
    geaendert: Map<string, Entity>;
  }
  const neueFolgen = (stand: Stand, karte: string): Folgen => ({ kampf: encounterOnMap(stand.alle, karte), geaendert: new Map() });
  const aktuell = (f: Folgen, stand: Stand, id: string): Entity | undefined => f.geaendert.get(id) ?? stand.map.get(id);
  const teilnahme = (f: Folgen, id: string): Relation | undefined =>
    (f.kampf?.relations ?? []).find((r) => r.type === PARTICIPATES && r.to === id);
  const eintraegeVon = (f: Folgen, id: string): TimedEntry[] => ((teilnahme(f, id)?.props ?? {}) as ParticipantProps).conditions ?? [];
  /** Die Werte am Tisch: gelesen wie am Bogen, mit Zuständen und Aktionen aus der Initiative. */
  const werteAmTisch = (f: Folgen, stand: Stand, e: Entity): CharacterStats => {
    const ein = eintraegeVon(f, e.id);
    return creatureStats(aktuell(f, stand, e.id) ?? e, stand.map, { conditions: entryConditions(ein), actions: entryActions(ein) });
  };
  /** Die Kante eines Teilnehmers ändern; die Begegnung gilt dann als geändert. */
  const teilnehmerAendern = (f: Folgen, id: string, patch: (p: ParticipantProps) => ParticipantProps): boolean => {
    const k = teilnahme(f, id);
    if (!f.kampf || !k) return false;
    f.kampf = { ...f.kampf, relations: (f.kampf.relations ?? []).map((r) => (r === k ? { ...r, props: patch({ ...((r.props ?? {}) as ParticipantProps) }) as Relation['props'] } : r)) };
    f.geaendert.set(f.kampf.id, f.kampf);
    return true;
  };
  const folgenSchreiben = async (f: Folgen): Promise<{ fehler: number; error: string; issues?: unknown } | null> => {
    for (const e of f.geaendert.values()) {
      const r = await schreibeGeprueft(e);
      if ('issues' in r) return { fehler: 422, error: `${entityName(e)} liess sich nicht schreiben.`, issues: r.issues };
    }
    f.geaendert.clear();
    return null;
  };

  /**
   * Der Wurf auf Treffen mit einer Kachel gegen die RK des Ziels — die
   * gelesene RK (T-275), mit **Vorteil oder Nachteil** aus den Wirkungen
   * beider (`attack` am Angreifer, `attacked` am Ziel: Dodge, Help, Hide,
   * Zustände; `attacked.near`/`.far` nach `weite.feet`) und auf langer
   * Reichweite (`weite.long`, T-351), und der **Krit-Schwelle** des Angreifers. Ein Eintrag, der
   * beim Angriff verbraucht ist (Help, Hide), geht danach weg.
   */
  async function trefferWurf(
    t: PlanTile,
    wer: Entity,
    ziel: Entity,
    von: { id: string; name: string },
    kampagne: Entity | null,
    hidden: boolean,
    stand: Stand,
    vorne = '',
    f: Folgen = neueFolgen(stand, ''),
    weite: { feet?: number | null; long?: boolean } = {},
  ): Promise<TrefferWurf> {
    const sw = werteAmTisch(f, stand, wer);
    const sz = werteAmTisch(f, stand, ziel);
    /* Abstand und lange Reichweite (T-351): Prone nach Nähe, lang mit Nachteil. */
    const { mode: modus, why } = attackRollMode(sw.totals.grants, sz.totals.grants, weite);
    const w20 = modus === 'adv' ? '2d20kh1' : modus === 'dis' ? '2d20kl1' : '1d20';
    const wie = modus ? ` (${modus === 'adv' ? 'advantage' : 'disadvantage'}${why.includes('long range') ? ', long range' : ''})` : why.includes('long range') ? ' (long range)' : '';
    const w = await wurf(wer, von, `${w20}${t.toHit! < 0 ? t.toHit : `+${t.toHit}`}`, `${vorne}${t.name} → ${entityName(ziel)}: attack${wie}`, kampagne, hidden, stand);
    const ac = sz.ac.value !== null && sz.ac.value > 0 ? sz.ac.value : null;
    const schwelle = sw.critThreshold.value ?? 20;
    const crit = w?.crit ?? (w?.nat !== undefined && w.nat >= schwelle ? 'crit' : undefined);
    const treffer = !!w && crit !== 'fumble' && (crit === 'crit' || (ac !== null && w.total >= ac));
    /* Verbraucht: was bis zum nächsten eigenen Angriff galt. */
    if (eintraegeVon(f, wer.id).some((e) => commonAction(e.action)?.rule?.spent === 'attack')) {
      teilnehmerAendern(f, wer.id, (p) => ({ ...p, conditions: (p.conditions ?? []).filter((e) => commonAction(e.action)?.rule?.spent !== 'attack') }));
    }
    return { total: w?.total ?? null, ...(crit ? { crit } : {}), hit: ac !== null || crit ? treffer : null, ac, ...(modus ? { mode: modus } : {}) };
  }

  /**
   * **Schaden abziehen** (T-275, Punkt 2): nach der Abwehr des Ziels
   * (`damageAtTable`, dieselbe Rechnung wie der Tracker, T-355), von der
   * Teilnehmerkante in der Begegnung und — bei einer Spielerfigur oder
   * ausserhalb einer Begegnung — von `Vitals`. Konzentriert sich das
   * Ziel, würfelt der Server den KON-Rettungswurf gegen den SG ins Log
   * (E-128); misslingt er, endet die Konzentration.
   */
  async function schadenAnwenden(
    f: Folgen,
    stand: Stand,
    ziel: Entity,
    gewuerfelt: number,
    art: string,
    von: { id: string; name: string },
    kampagne: Entity | null,
    hidden: boolean,
  ): Promise<string> {
    const st = werteAmTisch(f, stand, ziel);
    const jetzt = aktuell(f, stand, ziel.id) ?? ziel;
    const v = (jetzt.components?.['Vitals'] ?? {}) as Record<string, unknown>;
    const k = teilnahme(f, ziel.id);
    const d = damageAtTable({ stats: st, vitals: v, edge: k ? ((k.props ?? {}) as ParticipantProps) : null, pc: primaryInterface(ziel) === 'PlayerCharacter', rolled: gewuerfelt, type: art });
    if (d.vitals) f.geaendert.set(ziel.id, { ...jetzt, components: { ...jetzt.components, Vitals: d.vitals } });
    if (d.edgeHp !== null) teilnehmerAendern(f, ziel.id, (p) => ({ ...p, hp: d.edgeHp!, involved: true }));
    const teile = damageLines(entityName(ziel), d);
    /* Die Konzentrationsprobe (PHB): SG 10 oder der halbe Schaden. */
    if (d.concentration) {
      const probe = d.concentration;
      const auf = probe.spell;
      const zauber = stand.map.get(auf);
      const r = await wurf(ziel, von, `1d20${probe.bonus === null ? '' : probe.bonus < 0 ? probe.bonus : `+${probe.bonus}`}`, `${entityName(ziel)}: concentration save, DC ${probe.dc}`, kampagne, hidden, stand);
      if (r) {
        const haelt = r.total >= probe.dc;
        teile.push(`concentration save ${r.total} vs DC ${probe.dc} — ${haelt ? 'kept' : `lost${zauber ? ` (${entityName(zauber)})` : ''}`}`);
        if (!haelt) {
          const nun = f.geaendert.get(ziel.id) ?? jetzt;
          const vv = { ...((nun.components?.['Vitals'] ?? {}) as Record<string, unknown>) };
          delete vv['concentration'];
          f.geaendert.set(ziel.id, { ...nun, components: { ...nun.components, Vitals: vv } });
        }
      }
    }
    return teile.join('; ');
  }

  /**
   * **Eine allgemeine Aktion wirkt** (T-275, Punkt 3): ihr Eintrag in der
   * Initiative (Dodge an sich, Help am Verbündeten, Hide nach der Probe),
   * mit der Dauer aus dem Katalog — der Anker ist der Handelnde, also
   * „bis zum Anfang deines nächsten Zugs" auch am Ziel. Ohne Begegnung
   * zählt nichts; das sagt der Text.
   */
  async function aktionWirkt(
    f: Folgen,
    stand: Stand,
    a: CommonAction,
    figur: Entity,
    ziel: Entity | undefined,
    von: { id: string; name: string },
    kampagne: Entity | null,
    hidden: boolean,
  ): Promise<string> {
    const teile: string[] = [];
    if (a.check) {
      const st = werteAmTisch(f, stand, figur);
      const c = (st.statblock?.components ?? {}) as Record<string, Record<string, unknown> | undefined>;
      const bonus = checkBonus(
        { proficient: c['Proficiencies']?.['proficient'], expertise: c['Proficiencies']?.['expertise'], prof: c['Statblock']?.['prof'], bonuses: c['Statblock']?.['bonuses'], score: st.abilities[a.check.ability as keyof CharacterStats['abilities']]?.value },
        a.check.skill,
      );
      const r = await wurf(figur, von, `1d20${bonus === null ? '' : bonus < 0 ? bonus : `+${bonus}`}`, `${a.name}: ${a.check.skill} check`, kampagne, hidden, stand);
      if (r) teile.push(`${a.check.skill} ${r.total}`);
    }
    const regel = a.rule;
    if (regel) {
      const wer = regel.on === 'target' ? ziel : figur;
      const anker = teilnahme(f, figur.id)?.id;
      const eintrag: TimedEntry = {
        text: regel.label,
        action: a.key,
        ...(regel.rounds ? { rounds: regel.rounds } : {}),
        ...(regel.at ? { at: regel.at } : {}),
        ...(anker && wer && wer.id !== figur.id ? { anchor: anker } : {}),
        source: entityName(figur),
      };
      if (!wer) teile.push('no one to help');
      else if (teilnehmerAendern(f, wer.id, (p) => ({ ...p, conditions: [...(p.conditions ?? []).filter((e) => e.action !== a.key), eintrag] }))) {
        teile.push(`${entityName(wer)}: ${regel.label}`);
      } else teile.push('no encounter — nothing counts down');
    }
    return teile.join('; ');
  }

  /** Der Schaden eines Treffers; kritisch die Würfel zweimal (PHB), der feste Teil einmal. */
  async function schadenWurf(
    t: PlanTile,
    w: TrefferWurf,
    wer: Entity,
    ziel: Entity,
    von: { id: string; name: string },
    kampagne: Entity | null,
    hidden: boolean,
    stand: Stand,
    vorne = '',
  ): Promise<number | null> {
    if (!w.hit || !t.damage) return null;
    const ausdruck = w.crit === 'crit' && /d/.test(t.damage) ? `${t.damage.replace(/\s*[+-]\s*\d+\s*$/, '')}+${t.damage}` : t.damage;
    const dmg = await wurf(wer, von, ausdruck, `${vorne}${t.name} → ${entityName(ziel)}: damage${t.damageType ? ` (${t.damageType})` : ''}`, kampagne, hidden, stand);
    return dmg?.total ?? null;
  }

  /** Was von einem Angriff im Ergebnis steht — mit dem, was der Schaden am Tisch tat. */
  function angriffErgebnis(t: PlanTile, ziel: Entity, w: TrefferWurf, schaden: number | null | undefined, vorne = '', folge = ''): Omit<PlanResult, 'step'> {
    const wie = w.ac === null ? `rolled ${w.total ?? '—'} (no AC known)` : w.hit ? (w.crit === 'crit' ? 'critical hit' : 'hit') : 'miss';
    const s = schaden ?? undefined;
    return {
      text: `${vorne}${t.name} → ${entityName(ziel)}: ${wie}${w.mode ? ` with ${w.mode === 'adv' ? 'advantage' : 'disadvantage'}` : ''}${s !== undefined ? `, ${s}${t.damageType ? ` ${t.damageType}` : ''} damage` : ''}${folge ? ` (${folge})` : ''}`,
      ...(w.ac !== null ? { hit: !!w.hit } : {}),
      ...(s !== undefined ? { damage: s } : {}),
    };
  }

  /** Ein Angriff mit einer Kachel: Wurf, Treffer gegen die RK, Schaden, abgezogen — und was davon im Ergebnis steht. */
  async function angriff(
    t: PlanTile,
    wer: Entity,
    ziel: Entity,
    von: { id: string; name: string },
    kampagne: Entity | null,
    hidden: boolean,
    stand: Stand,
    vorne = '',
    f: Folgen = neueFolgen(stand, ''),
    weite: { feet?: number | null; long?: boolean } = {},
  ): Promise<Omit<PlanResult, 'step'>> {
    const w = await trefferWurf(t, wer, ziel, von, kampagne, hidden, stand, vorne, f, weite);
    const schaden = await schadenWurf(t, w, wer, ziel, von, kampagne, hidden, stand, vorne);
    const folge = schaden !== null ? await schadenAnwenden(f, stand, ziel, schaden, t.damageType, von, kampagne, hidden) : '';
    return angriffErgebnis(t, ziel, w, schaden, vorne, folge);
  }

  /**
   * **Die Regeln am Tisch** (REQ-357): die Graphen der Regelartikel, die im
   * Stapel der Kampagne stehen — `null`, wenn die Kampagne sie nicht laufen
   * lässt (`ruleGraphsOn`). Dann gilt der eingebaute Gelegenheitsangriff.
   */
  async function regelnAmTisch(stand: Stand, kampagne: Entity | null): Promise<RuleGraph[] | null> {
    if (!ruleGraphsOn(kampagne)) return null;
    const stapel = playStack(stand.map, kampagne, await repo.getRegistry());
    const artikel = stand.alle.filter((e) => primaryInterface(e) === 'Rule' && stapel.inPlay(e));
    const systemKey = (id: string) => {
      const k = stand.map.get(id)?.components?.['Rule']?.['key'];
      return typeof k === 'string' ? k : undefined;
    };
    return tableRuleGraphs(artikel, systemKey);
  }

  /**
   * **Einen bestätigten Zug ausführen** — ab `plan.done`, bis er fertig ist
   * oder ein Gelegenheitsangriff eine Antwort braucht. Dann steht das Token
   * auf dem Feld, das es gerade verlassen will, und der Plan auf
   * `reacting`. Die Kacheln **jetzt** gerechnet, nicht aus dem Plan: der
   * Plan hält, was gewählt wurde, die Zahlen gehören dem Statblock (D8, D51).
   */
  async function ausfuehren(
    stand: Stand,
    roheKarte: Entity,
    kampagne: Entity | null,
    plan: TurnPlan,
    von: { id: string; name: string },
    vorher?: Folgen,
  ): Promise<{ plan: TurnPlan } | { fehler: number; error: string; issues?: unknown }> {
    const figur = stand.map.get(plan.actor);
    if (!figur) return { fehler: 409, error: 'Die Figur gibt es nicht mehr.' };
    const kacheln = new Map(kachelnVon(stand.map, statblockVon(stand.alle, figur), () => true).map((t) => [t.id, t]));
    const hidden =
      (kampagne?.components?.['Campaign'] as { playerRolls?: unknown } | undefined)?.playerRolls === 'gm' && plan.by.id !== von.id;
    const kampf = encounterOnMap(stand.alle, roheKarte.id);
    /* Was der Zug an Begegnung und Figuren ändert (T-275), geschrieben mit der Karte. */
    const folgen = vorher ?? neueFolgen(stand, roheKarte.id);
    const relDa = markersOf(roheKarte).find((m) => m.to === figur.id)?.rel.id;
    const ebene = relDa ? floorOfMarker(roheKarte, relDa) : GROUND_FLOOR;
    const roheEbene = floorView(roheKarte, ebene);
    const geo = plan.nat ? gridGeometry(mapSettings(roheEbene), plan.nat) : null;
    /* Für die Reichweite (T-351) auch ohne Bildgrösse vom Browser: die des Assets. */
    const geoWeite = geoDerEbene(stand, roheKarte, ebene, plan.nat ?? null);
    /* **Der Graph führt** (REQ-357): laufen die Regeln der Kampagne am
       Tisch, fragt der Zug sie und nicht den eingebauten Gelegenheitsangriff. */
    /* Ohne die volle Stufe (T-325) fragt ein Zug niemanden um eine Reaktion. */
    const reagiert = plannerReacts(turnPlannerOf(kampagne));
    const regeln = reagiert ? await regelnAmTisch(stand, kampagne) : null;
    /* Die Leitung führt aus: gegen die ganze Karte, auch verborgene Gegner. */
    const provs =
      geo && !regeln && reagiert ? opportunityAttacks(plan.steps, bedrohteFelder(roheEbene, geo, bedrohungen(stand, roheEbene, figur.id, kampf)), geo.cellFeet) : [];
    const tisch = regeln && geo ? await tischKreaturen(repo, stand, roheEbene, geo, kampf) : [];
    const selbst = tisch.find((c) => c.id === figur.id);
    const exits = regeln && selbst ? reachExits(plan.steps, tisch.filter((c) => c.id !== figur.id).map((c) => ({ id: c.id, cell: { x: c.x, y: c.y }, reach: c.values['reach'] ?? 5 })), geo?.cellFeet) : [];
    const namen = new Map(tisch.map((c) => [c.id, c.name]));
    const gefragt = new Set(plan.asked ?? []);
    const results: PlanResult[] = [...(plan.results ?? [])];
    /** Wo die Figur vor Schritt `i` steht und ob sie Disengage gewählt hat. */
    const vor = (i: number): { cell: { x: number; y: number }; disengaged: boolean } => {
      let cell = selbst ? { x: selbst.x, y: selbst.y } : { x: 0, y: 0 };
      let disengaged = false;
      for (const x of plan.steps.slice(0, i)) {
        if (x.kind === 'move' && x.path.length) cell = x.path[x.path.length - 1]!;
        if (x.kind === 'act' && x.tile === 'std:disengage') disengaged = true;
      }
      return { cell, disengaged };
    };
    /** Ein Lauf der Regeln für ein Ereignis des Zugs, mit der Figur dort, wo sie gerade steht. */
    const lauf = (on: RuleTriggerKey, wo: { cell: { x: number; y: number }; disengaged: boolean }, extra: { target?: string; amount?: number } = {}, selves?: string[]): RuleRunResult =>
      runRules(
        regeln ?? [],
        { on, actor: figur.id, ...extra },
        tisch.map((c) => (c.id === figur.id ? { ...c, x: wo.cell.x, y: wo.cell.y, values: { ...c.values, disengaged: wo.disengaged ? 1 : 0 } } : c)),
        { distance: tableDistance, ...(selves ? { selves } : {}) },
      );
    /** Hinweise ins Ergebnis, das erste neue Angebot zurück — jedes einmal je Zug. */
    const frage = (run: RuleRunResult, key: string, step: string, index: number, target?: string): Provocation | null => {
      const { offers, notes } = offersFrom(run, { key, actor: figur.id, ...(target ? { target } : {}) }, namen);
      for (const n of notes) {
        const k = `note:${key}:${n}`;
        if (gefragt.has(k)) continue;
        gefragt.add(k);
        results.push({ step, text: n });
      }
      const o = offers.find((x) => !gefragt.has(x.key));
      if (!o) return null;
      gefragt.add(o.key);
      return {
        step,
        index,
        reactor: o.reactor,
        reactorName: o.reactorName,
        rule: o.rule,
        ruleName: o.ruleName,
        offer: o.offer,
        ...(o.against ? { against: o.against } : {}),
        ...(o.strike ? { strike: true } : {}),
      };
    };
    let karte = roheKarte;
    const aufdecken = fogOn(roheKarte) && mapRulesOf(kampagne, roheKarte).revealOnMove;
    const rel = markersOf(karte).find((m) => m.to === figur.id)?.rel.id;
    const schreiben = async () => {
      const ff = await folgenSchreiben(folgen);
      if (ff) return ff;
      if (karte === roheKarte) return null;
      const r = await schreibeGeprueft(karte);
      return 'issues' in r ? { fehler: 422, error: 'Die Karte liess sich nicht schreiben.', issues: r.issues } : null;
    };
    const { pending: _p, done: _d, cursor: _c, ...rest } = plan;
    const halt = async (pending: Provocation, i: number, cursor?: PlanCursor): Promise<{ plan: TurnPlan } | { fehler: number; error: string; issues?: unknown }> => {
      const f = await schreiben();
      if (f) return f;
      return { plan: { ...rest, state: 'reacting', pending, done: i, asked: [...gefragt], results, ...(cursor ? { cursor } : {}) } };
    };

    for (let i = plan.done ?? 0; i < plan.steps.length; i++) {
      const s = plan.steps[i]!;
      if (s.kind === 'move') {
        for (const x of exits.filter((e) => e.step === s.id)) {
          const p = frage(lauf('leavesReach', { cell: x.from, disengaged: x.disengaged }, {}, [x.holder]), `${s.id}:leavesReach`, s.id, x.index);
          if (!p) continue;
          if (rel && geo) karte = moveMarker(karte, rel, cellPoint(geo, s.path[x.index]!));
          return halt(p, i);
        }
        for (const p of provs.filter((x) => x.step === s.id && !gefragt.has(x.reactor))) {
          gefragt.add(p.reactor);
          if (!(await reaktionDa(repo, stand, roheKarte.id, p.reactor, kampf))) continue;
          if (rel && geo) karte = moveMarker(karte, rel, cellPoint(geo, s.path[p.index]!));
          const f = await schreiben();
          if (f) return f;
          return { plan: { ...rest, state: 'reacting', pending: p, done: i, asked: [...gefragt], results } };
        }
        if (rel && s.to) {
          const von = markersOf(karte).find((m) => m.rel.id === rel);
          karte = moveMarker(karte, rel, s.to);
          /* **Aufdecken beim Zug** (T-204): der Weg, so wie er ging — die
             Felder, sonst die Gerade —, für die Figur, die ihn ging. */
          if (aufdecken && plan.nat && von) karte = onFloor(karte, ebene, (v) => wegAufdecken(v, figur.id, s, von, plan.nat!, stand.map));
        }
        results.push({ step: s.id, text: `Moved ${s.feet} ft.` });
        continue;
      }
      if (s.kind === 'passage') {
        /* **Durch den Übergang** (T-326) — von der Stelle, an der die Figur
           jetzt steht. Die Kosten rechnete das Einreichen. */
        const m = rel ? markersOf(karte).find((x) => x.rel.id === rel) : undefined;
        const ende = m ? passageEnds(floorView(karte, floorOfMarker(karte, m.rel.id)), floorOfMarker(karte, m.rel.id)).find((e) => e.relId === s.via) : undefined;
        if (!m || !ende) {
          results.push({ step: s.id, text: `${s.name}: the passage is gone.` });
          continue;
        }
        const f = await schreiben();
        if (f) return f;
        const d = await schickeDurch(stand, karte, kampagne, ende, [m.rel.id], plan.nat ?? null, false);
        if ('fehler' in d) return { fehler: d.fehler, error: d.error, ...(d.issues ? { issues: d.issues } : {}) };
        results.push({ step: s.id, text: `Went through the ${s.name}${s.feet ? ` (${s.feet} ft)` : ''}.` });
        return { plan: { ...rest, state: 'confirmed', asked: [...gefragt], results } };
      }
      const t = kacheln.get(s.tile);
      const ziel = s.target ? stand.map.get(s.target) : undefined;
      /* Eine allgemeine Aktion, die eine Zahl ändert (T-275): Dodge, Help, Hide, Ready. */
      const allgemein = s.tile.startsWith('std:') ? commonAction(s.tile) : undefined;
      if (allgemein && (allgemein.rule || allgemein.check)) {
        const was = await aktionWirkt(folgen, stand, allgemein, figur, ziel, plan.by, kampagne, hidden);
        results.push({ step: s.id, text: `${s.name}${s.targetName ? ` → ${s.targetName}` : ''}${was ? `: ${was}` : ''}` });
        continue;
      }
      if (!t || t.toHit === null || !ziel) {
        results.push({ step: s.id, text: `${s.name}${s.targetName ? ` → ${s.targetName}` : ''}` });
        continue;
      }
      /* **Reichweite beim Ausführen** (T-351): gemessen, wo die Tokens jetzt
         stehen — das Ziel kann seit dem Einreichen gegangen sein. Ausser
         Reichweite wird nicht gewürfelt; lang würfelt mit Nachteil. */
      const feet = abstandImPlan(karte, geoWeite, figur.id, ziel.id);
      const band = rangeBand(t, feet);
      if (band === 'out') {
        results.push({ step: s.id, text: `${t.name} → ${entityName(ziel)}: out of range (${feet} ft), no roll.` });
        continue;
      }
      const weite = { feet, long: band === 'long' };
      if (!regeln) {
        results.push({ step: s.id, ...(await angriff(t, figur, ziel, plan.by, kampagne, hidden, stand, '', folgen, weite)) });
        continue;
      }
      /* **Ein Angriff mit Regeln** (REQ-357): angegriffen → Wurf → getroffen
         oder verfehlt → Schaden; nach jedem Schritt dürfen Regeln fragen.
         Was gewürfelt ist, steht im `cursor` und wird nicht wiederholt. */
      const wo = vor(i);
      let cur: PlanCursor = plan.cursor?.step === s.id ? plan.cursor : { step: s.id };
      let p = frage(lauf('attacked', wo, { target: ziel.id }), `${s.id}:attacked`, s.id, 0, ziel.id);
      if (p) return halt(p, i, cur);
      const w = cur.roll ?? (await trefferWurf(t, figur, ziel, plan.by, kampagne, hidden, stand, '', folgen, weite));
      cur = { ...cur, roll: w };
      if (w.hit !== null) {
        const on = w.hit ? 'hit' : 'missed';
        p = frage(lauf(on, wo, { target: ziel.id }), `${s.id}:${on}`, s.id, 0, ziel.id);
        if (p) return halt(p, i, cur);
      }
      const schaden = cur.damage !== undefined ? cur.damage : await schadenWurf(t, w, figur, ziel, plan.by, kampagne, hidden, stand);
      cur = { ...cur, damage: schaden };
      if (schaden !== null && schaden !== undefined) {
        p = frage(lauf('damaged', wo, { target: ziel.id, amount: schaden }), `${s.id}:damaged`, s.id, 0, ziel.id);
        if (p) return halt(p, i, cur);
      }
      /* Abgezogen wird einmal, wenn der Schritt fertig ist — nach jeder Frage der Regeln. */
      const folge = schaden !== null && schaden !== undefined ? await schadenAnwenden(folgen, stand, ziel, schaden, t.damageType, plan.by, kampagne, hidden) : '';
      results.push({ step: s.id, ...angriffErgebnis(t, ziel, w, schaden, '', folge) });
    }
    const f = await schreiben();
    if (f) return f;
    return { plan: { ...rest, state: 'confirmed', asked: [...gefragt], results } };
  }

  app.post<{ Params: { id: string; plan: string }; Body: { decision?: unknown; note?: unknown } | null }>(
    '/api/maps/:id/turn-plan/:plan/decide',
    async (request, reply) => {
      const l = await lage(request, request.params.id);
      if ('fehler' in l) return reply.code(l.fehler ?? 404).send({ error: l.fehler === 401 ? 'Nicht angemeldet' : 'Nicht gefunden' });
      const { user, stand, roheKarte, kampagne, leitet } = l;
      if (!leitet) return reply.code(403).send({ error: 'Bestätigen darf die Leitung.' });
      const plan = (await plaeneDerKarte(repo, roheKarte.id)).find((p) => p.plan === request.params.plan);
      if (!plan) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (plan.state !== 'planned') return reply.code(409).send({ error: 'Dieser Plan ist schon entschieden.' });
      const b = request.body ?? {};
      const note = typeof b.note === 'string' ? b.note.trim().slice(0, 300) : '';
      const { at: _at, ...ohneZeit } = plan;
      const entschieden = { id: user.id, name: user.name };

      if (b.decision === 'reject') {
        const neu: TurnPlan = { ...ohneZeit, state: 'rejected', decidedBy: entschieden, ...(note ? { note } : {}) };
        await repo.appendEvent(TURNPLAN_EVENT, roheKarte.id, neu);
        feed.publish({ kind: 'plan', id: roheKarte.id });
        return neu;
      }
      if (b.decision !== 'confirm') return reply.code(422).send({ error: 'decision: confirm oder reject' });

      const r = await ausfuehren(stand, roheKarte, kampagne, { ...ohneZeit, decidedBy: entschieden, ...(note ? { note } : {}) }, entschieden);
      if ('fehler' in r) return reply.code(r.fehler).send({ error: r.error, ...(r.issues ? { issues: r.issues } : {}) });
      await repo.appendEvent(TURNPLAN_EVENT, roheKarte.id, r.plan);
      feed.publish({ kind: 'plan', id: roheKarte.id });
      return r.plan;
    },
  );

  /**
   * **Die Antwort auf einen Gelegenheitsangriff.** Ja: der Reagierende
   * schlägt mit seinem besten Nahkampfangriff zu (am Server gewürfelt),
   * und seine Reaktion ist bis zum eigenen nächsten Zug weg. Nein: der
   * Zug geht weiter, die Reaktion bleibt.
   */
  app.post<{ Params: { id: string; plan: string }; Body: { attack?: unknown } | null }>(
    '/api/maps/:id/turn-plan/:plan/react',
    async (request, reply) => {
      const l = await lage(request, request.params.id);
      if ('fehler' in l) return reply.code(l.fehler ?? 404).send({ error: l.fehler === 401 ? 'Nicht angemeldet' : 'Nicht gefunden' });
      const { user, stand, roheKarte, kampagne, leitet } = l;
      const plan = (await plaeneDerKarte(repo, roheKarte.id)).find((p) => p.plan === request.params.plan);
      if (!plan) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (plan.state !== 'reacting' || !plan.pending) return reply.code(409).send({ error: 'Dieser Zug wartet auf keine Reaktion.' });
      const p = plan.pending;
      if (!darfAntworten(user, leitet, p.reactor)) return reply.code(403).send({ error: 'Antworten darf die Leitung oder wer die Figur führt.' });
      const reagiert = stand.map.get(p.reactor);
      const figur = stand.map.get(plan.actor);
      if (!reagiert || !figur) return reply.code(409).send({ error: 'Die Figur gibt es nicht mehr.' });
      const { at: _at, ...ohneZeit } = plan;
      const results: PlanResult[] = [...(plan.results ?? [])];
      const von = { id: user.id, name: user.name };
      const folgen = neueFolgen(stand, roheKarte.id);

      /* Ein Angebot einer Regel (REQ-357) nennt, gegen wen; sonst ist es der Ziehende. */
      const gegen = (p.against ? stand.map.get(p.against) : undefined) ?? figur;
      const wort = p.rule ? (p.offer ?? p.ruleName ?? 'Reaction') : 'Opportunity attack';
      if (request.body?.attack === true) {
        if (!p.rule || p.strike) {
          /* Der beste Nahkampfangriff: die höchste Trefferzahl, die nicht weit trägt. */
          const nah = kachelnVon(stand.map, statblockVon(stand.alle, reagiert), () => true)
            .filter((t) => t.group === 'attack' && t.toHit !== null && t.longRange === null)
            .sort((a, b) => b.toHit! - a.toHit! || (b.average ?? 0) - (a.average ?? 0));
          const t = nah[0];
          if (t) results.push({ step: p.step, ...(await angriff(t, reagiert, gegen, von, kampagne, false, stand, `${wort}: `, folgen)) });
          else results.push({ step: p.step, text: `${wort}: ${p.reactorName} has no melee attack.` });
        } else {
          /* Was die Reaktion bewirkt, setzt bis Schritt 3 die Leitung — hier steht, dass sie genommen wurde. */
          results.push({ step: p.step, text: `${p.reactorName} uses ${wort}${gegen.id !== reagiert.id ? ` against ${entityName(gegen)}` : ''}.` });
        }
        const kampf = encounterOnMap(stand.alle, roheKarte.id);
        const { jetzt } = kampfStand(stand, kampf, p.reactor);
        const spent: ReactionSpent = {
          reactor: p.reactor,
          plan: plan.plan,
          map: roheKarte.id,
          encounter: kampf?.id ?? null,
          round: jetzt?.round ?? null,
          turn: jetzt?.turn ?? null,
        };
        await repo.appendEvent(REACTION_EVENT, roheKarte.id, spent);
      } else {
        results.push({ step: p.step, text: p.rule ? `${p.reactorName} does not use ${wort}.` : `${p.reactorName} lets ${plan.actorName} go.` });
      }

      const r = await ausfuehren(stand, roheKarte, kampagne, { ...ohneZeit, results }, plan.decidedBy ?? von, folgen);
      if ('fehler' in r) return reply.code(r.fehler).send({ error: r.error, ...(r.issues ? { issues: r.issues } : {}) });
      await repo.appendEvent(TURNPLAN_EVENT, roheKarte.id, r.plan);
      feed.publish({ kind: 'plan', id: roheKarte.id });
      return r.plan;
    },
  );
}
