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
  goThrough,
  onFloor,
  onPassage,
  passageEnds,
  PASSAGE_EXACT,
  naturalD20,
  partiesOf,
  resolvePlay,
  planBudget,
  planText,
  primaryInterface,
  resolveInstance,
  rollDice,
  speedModes,
  tilesFor,
  TURNPLAN_EVENT,
  reactionBack,
  type Entity,
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

/** Die Karten des Statblocks als eine (`Statblock` und `Abilities`), wie der Bogen sie liest. */
function werte(map: Map<string, Entity>, sb: Entity | null): Card {
  if (!sb) return {};
  const c = resolveInstance(map, sb).components ?? {};
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

/** Die Rüstungsklasse eines Ziels, vom Statblock. */
function rkVon(stand: Stand, e: Entity): number | null {
  const ac = Number(werte(stand.map, statblockVon(stand.alle, e))['ac']);
  return Number.isFinite(ac) && ac > 0 ? ac : null;
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
   * Für wen der Betrachter planen darf: eigene Figuren mit Token hier; die
   * Leitung für jede Kreatur mit Statblock. **Wen die Kampagne ziehen
   * lässt** (T-290, `tokenMove`), dafür plant auch eine Spielerin — im Kampf
   * zieht sie Gruppe und Verbündete so über den Plan; bestätigt wird er
   * ohnehin. `none` nimmt den Plan der eigenen Figur nicht: ein Zug im Kampf
   * ist mehr als Bewegung, und die Leitung bestätigt ihn.
   */
  function figuren(stand: Stand, karte: Entity, user: User, leitet: boolean, kampagne: Entity | null): Entity[] {
    const eigene = new Set(user.actorIds ?? []);
    const wer = zieher(stand, kampagne, karte, eigene);
    const regeln = mapRulesOf(kampagne);
    const ids = [...new Set(markersOf(karte).map((m) => m.to))];
    return ids
      .map((i) => stand.map.get(i))
      .filter((e): e is Entity => !!e)
      .filter((e) => eigene.has(e.id) || ((leitet || mayMoveToken(regeln.tokenMove, e.id, wer)) && !!statblockVon(stand.alle, e)));
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

  app.get<{ Params: { id: string }; Querystring: { actor?: string } }>('/api/maps/:id/turn-plan', async (request, reply) => {
    const l = await lage(request, request.params.id);
    if ('fehler' in l) return reply.code(l.fehler ?? 404).send({ error: l.fehler === 401 ? 'Nicht angemeldet' : 'Nicht gefunden' });
    const { user, stand, roheKarte, karte, kampagne, leitet } = l;
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
      tiles = kachelnVon(stand.map, sb, (i) => sicht.has(i));
      speed = tempoVon(werte(stand.map, sb));
    }

    /* Die Ziele: was auf der gesiebten Karte steht, ausser der Figur selbst. */
    const marker = markersOf(karte).filter((m) => m.kind !== 'scenery');
    const zielIds = [...new Set(marker.map((m) => m.to))].filter((i) => i !== figur?.id);
    const zielRoh = zielIds.flatMap((i) => stand.map.get(i) ?? []);
    const ziele = zielRoh.length ? await sieve(request, zielRoh, stand.map) : [];
    const sichtbar = new Set(ziele.map((z) => z.id));
    const angriffe = tiles.filter((t) => t.toHit !== null);
    const targets = ziele.map((z) => {
      const ac = rkVon(stand, stand.map.get(z.id)!);
      const chances: Record<string, number> = {};
      if (ac !== null) for (const t of angriffe) chances[t.id] = Math.round(hitChance(t.toHit!, ac) * 100);
      return { id: z.id, name: entityName(z), type: primaryInterface(z), chances, ...(leitet && ac !== null ? { ac } : {}) };
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
    const plans = (await plaeneDerKarte(repo, karte.id))
      .filter((p) => leitet || p.by?.id === user.id || eigene.has(p.actor) || (p.state === 'reacting' && !!p.pending && eigene.has(p.pending.reactor)))
      .slice(0, 20)
      .map((p) => ({ ...p, ...(p.state === 'reacting' && p.pending ? { canAnswer: darfAntworten(user, leitet, p.pending.reactor) } : {}) }));

    return {
      leitet,
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
    };
  });

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
      const tempo = tempoVon(werte(stand.map, statblockVon(stand.alle, figur)));
      const kampf = encounterOnMap(stand.alle, roheKarte.id);
      const reactionSpent = !(await reaktionDa(repo, stand, roheKarte.id, figur.id, kampf));
      const { problems } = planBudget(steps, tempo, { reactionSpent });
      if (problems.length) return reply.code(422).send({ error: problems.join(' ') });

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
      const asset = marker.kind === 'scenery';
      if (asset && !marker.movable) return reply.code(403).send({ error: 'This asset is fixed. Move it while editing the map.' });
      if (asset ? !leitet && !mayMoveAsset(regeln) : !darfZiehen(leitet, regeln, marker.to, zieher(stand, kampagne, karte, user.actorIds ?? [])))
        return reply.code(403).send({ error: asset ? 'This campaign does not let you move that asset.' : 'This campaign does not let you move that token.' });
      if (!asset && !leitet && encounterOnMap(stand.alle, roheKarte.id)) return reply.code(423).send({ error: 'During an encounter, tokens move through the turn plan.' });
      /* **Je Ebene** (T-307): Gitter, Sperren und Nebel sind die der Ebene,
         auf der das Token steht. */
      const ebene = floorOfMarker(roheKarte, marker.rel.id);
      const roheEbene = floorView(roheKarte, ebene);

      /* **Durchgehen** (T-307): das Token steht auf einem Übergang und
         wechselt auf dessen Ziel. Wer es ziehen darf, darf es durchgehen
         lassen; mit Bestätigung durch die Leitung wartet auch das. */
      if (typeof b.via === 'string' && b.via) {
        if (asset) return reply.code(422).send({ error: 'An asset does not take a passage.' });
        const ende = passageEnds(roheEbene, ebene).find((e) => e.relId === b.via && onPassage(e, marker, PASSAGE_EXACT, 1));
        /* Spielende kennen nur Übergänge, die ihre Karte trägt. */
        if (!ende || (!leitet && !passageEnds(floorView(karte, ebene), ebene).some((e) => e.relId === ende.relId))) return reply.code(404).send({ error: 'There is no passage here.' });
        if (!leitet && regeln.moves === 'confirm') return reply.code(423).send({ error: 'Moves wait for the GM to confirm them.' });
        if (ende.toMap !== roheKarte.id) return reply.code(422).send({ error: 'This portal leads to another map.' });
        const durch = goThrough(roheKarte, marker.rel.id, ende);
        if (!durch) return reply.code(422).send({ error: 'This passage leads nowhere.' });
        const r = await schreibeGeprueft(durch);
        if ('issues' in r) return reply.code(422).send({ error: 'Die Karte liess sich nicht schreiben.', issues: r.issues });
        return { moved: marker.rel.id, floor: ende.toFloor, to: ende.toAt };
      }

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

  /** Ein Wurf am Server ins Log (T-172), für `wer`, geworfen von `von`. */
  async function wurf(
    wer: Entity,
    von: { id: string; name: string },
    expr: string,
    label: string,
    kampagne: Entity | null,
    hidden: boolean,
    stand: Stand,
  ): Promise<{ total: number; crit?: 'crit' | 'fumble' | undefined } | null> {
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
    return { total: w.total, crit: nat?.crit };
  }

  /** Ein Angriff mit einer Kachel: Wurf, Treffer gegen die RK, Schaden — und was davon im Ergebnis steht. */
  async function angriff(
    t: PlanTile,
    wer: Entity,
    ziel: Entity,
    von: { id: string; name: string },
    kampagne: Entity | null,
    hidden: boolean,
    stand: Stand,
    vorne = '',
  ): Promise<Omit<PlanResult, 'step'>> {
    const zielName = entityName(ziel);
    const w = await wurf(wer, von, `1d20${t.toHit! < 0 ? t.toHit : `+${t.toHit}`}`, `${vorne}${t.name} → ${zielName}: attack`, kampagne, hidden, stand);
    const ac = rkVon(stand, ziel);
    const treffer = !!w && w.crit !== 'fumble' && (w.crit === 'crit' || (ac !== null && w.total >= ac));
    let schaden: number | undefined;
    if (treffer && t.damage) {
      /* Kritisch: die Würfel zweimal (PHB), der feste Teil einmal. */
      const ausdruck = w!.crit === 'crit' && /d/.test(t.damage) ? `${t.damage.replace(/\s*[+-]\s*\d+\s*$/, '')}+${t.damage}` : t.damage;
      const dmg = await wurf(wer, von, ausdruck, `${vorne}${t.name} → ${zielName}: damage${t.damageType ? ` (${t.damageType})` : ''}`, kampagne, hidden, stand);
      schaden = dmg?.total;
    }
    const wie = ac === null ? `rolled ${w?.total ?? '—'} (no AC known)` : treffer ? 'hit' : 'miss';
    return {
      text: `${vorne}${t.name} → ${zielName}: ${wie}${schaden !== undefined ? `, ${schaden}${t.damageType ? ` ${t.damageType}` : ''} damage` : ''}`,
      ...(ac !== null ? { hit: treffer } : {}),
      ...(schaden !== undefined ? { damage: schaden } : {}),
    };
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
  ): Promise<{ plan: TurnPlan } | { fehler: number; error: string; issues?: unknown }> {
    const figur = stand.map.get(plan.actor);
    if (!figur) return { fehler: 409, error: 'Die Figur gibt es nicht mehr.' };
    const kacheln = new Map(kachelnVon(stand.map, statblockVon(stand.alle, figur), () => true).map((t) => [t.id, t]));
    const hidden =
      (kampagne?.components?.['Campaign'] as { playerRolls?: unknown } | undefined)?.playerRolls === 'gm' && plan.by.id !== von.id;
    const kampf = encounterOnMap(stand.alle, roheKarte.id);
    /* Gerechnet auf der Ebene der Figur (T-307): ihr Gitter, ihre Gegner. */
    const relDa = markersOf(roheKarte).find((m) => m.to === figur.id)?.rel.id;
    const ebene = relDa ? floorOfMarker(roheKarte, relDa) : GROUND_FLOOR;
    const roheEbene = floorView(roheKarte, ebene);
    const geo = plan.nat ? gridGeometry(mapSettings(roheEbene), plan.nat) : null;
    /* Die Leitung führt aus: gegen die ganze Karte, auch verborgene Gegner. */
    const provs = geo ? opportunityAttacks(plan.steps, bedrohteFelder(roheEbene, geo, bedrohungen(stand, roheEbene, figur.id, kampf))) : [];
    const gefragt = new Set(plan.asked ?? []);
    const results: PlanResult[] = [...(plan.results ?? [])];
    let karte = roheKarte;
    const aufdecken = fogOn(roheKarte) && mapRulesOf(kampagne, roheKarte).revealOnMove;
    const rel = markersOf(karte).find((m) => m.to === figur.id)?.rel.id;
    const schreiben = async () => {
      if (karte === roheKarte) return null;
      const r = await schreibeGeprueft(karte);
      return 'issues' in r ? { fehler: 422, error: 'Die Karte liess sich nicht schreiben.', issues: r.issues } : null;
    };
    const { pending: _p, done: _d, ...rest } = plan;

    for (let i = plan.done ?? 0; i < plan.steps.length; i++) {
      const s = plan.steps[i]!;
      if (s.kind === 'move') {
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
      const t = kacheln.get(s.tile);
      const ziel = s.target ? stand.map.get(s.target) : undefined;
      if (!t || t.toHit === null || !ziel) {
        results.push({ step: s.id, text: `${s.name}${s.targetName ? ` → ${s.targetName}` : ''}` });
        continue;
      }
      results.push({ step: s.id, ...(await angriff(t, figur, ziel, plan.by, kampagne, hidden, stand)) });
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

      if (request.body?.attack === true) {
        /* Der beste Nahkampfangriff: die höchste Trefferzahl, die nicht weit trägt. */
        const nah = kachelnVon(stand.map, statblockVon(stand.alle, reagiert), () => true)
          .filter((t) => t.group === 'attack' && t.toHit !== null && t.longRange === null)
          .sort((a, b) => b.toHit! - a.toHit! || (b.average ?? 0) - (a.average ?? 0));
        const t = nah[0];
        if (t) results.push({ step: p.step, ...(await angriff(t, reagiert, figur, von, kampagne, false, stand, 'Opportunity attack: ')) });
        else results.push({ step: p.step, text: `Opportunity attack: ${p.reactorName} has no melee attack.` });
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
        results.push({ step: p.step, text: `${p.reactorName} lets ${plan.actorName} go.` });
      }

      const r = await ausfuehren(stand, roheKarte, kampagne, { ...ohneZeit, results }, plan.decidedBy ?? von);
      if ('fehler' in r) return reply.code(r.fehler).send({ error: r.error, ...(r.issues ? { issues: r.issues } : {}) });
      await repo.appendEvent(TURNPLAN_EVENT, roheKarte.id, r.plan);
      feed.publish({ kind: 'plan', id: roheKarte.id });
      return r.plan;
    },
  );
}
