/**
 * **Karten am Tisch** (T-115, REQ-130 bis 136): was eine Karte neben sich
 * braucht, und welche Karte gerade auf dem Tisch liegt.
 *
 * - `GET /api/maps/:id/context` — die Karten darüber (Brotkrumen), die
 *   Unterkarten mit ihren Rahmen, die Ziele der Marker (Name, Art, Bild)
 *   und wo die Gruppe steht. Die Karte selbst kommt wie jeder Artikel aus
 *   `/api/entities/:id` — gesiebt, mit `redactMap`.
 * - `GET /api/play` — die Sitzungen der laufenden Kampagne und die Karte,
 *   die an der laufenden liegt (`SessionState.activeMap`) — seit T-289
 *   eine Instanz der Vorlage, die Spielende erst nach der Freigabe sehen.
 *
 * **Gesiebt wird wie überall** (`sieve`): eine Unterkarte, die jemand nicht
 * sehen darf, hat keinen Rahmen auf seiner Karte, und das Gruppen-Token
 * steht nur, wo er die Karte sieht, auf der es wirklich steht. Die
 * Gegenrichtung von `insideMap` ist eine Abfrage — gespeichert wird nur
 * vorwärts.
 *
 * Keine eigene Ablage: alles wird beim Lesen gerechnet (D8). Ändert sich
 * ein Artikel, fragt die Seite neu — dasselbe, was ein Ereignis aus dem
 * Live-Kanal (T-116) später auslöst.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  statblockSize,
  assetVersion,
  tokenLook,
  type TokenLook,
  currentCampaign,
  carriedLights,
  darkvisionFor,
  encounterOnMap,
  entityName,
  fogOn,
  frameOf,
  frameRevealed,
  INSIDE_MAP_RELATION,
  isMap,
  isPlayInstance,
  mapNavigationOn,
  playedInfo,
  playTemplateId,
  sessionInstance,
  mapAncestors,
  markersOf,
  PARTY_RELATION,
  partiesOf,
  participantLabel,
  partyPosition,
  primaryInterface,
  resolvePlay,
  sessionState,
  turnOf,
  mapRulesOf,
  mayMoveAsset,
  partyMembers,
  sessionEncounters,
  sideFigure,
  type Entity,
  type SideEncounter,
  type SideFigure,
  type Frame,
  type MapRules,
  type PlanStep,
} from '@nw/model';
import type { Repository } from './repo.js';
import { darfZiehen, plaeneDerKarte, zieher } from './zugplan.js';

const SESSION_TYPE = 'Session';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface KartenDeps {
  repo: Repository;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  /** Leitet der Betrachter diese Karte (oder schreibt sie)? Dann gilt der Nebel ihm nicht. */
  leitet: (request: FastifyRequest, karte: Entity, bestand: Map<string, Entity>) => Promise<boolean>;
  /** Die Figuren, die der Betrachter führt (`app_user_actor`). */
  eigeneFiguren: (request: FastifyRequest) => Promise<string[]>;
}

/** Ein offener Zugvorschlag (T-204): ein Zugplan, der nur zieht, und wohin. */
export interface ZugVorschlag {
  plan: string;
  actor: string;
  actorName: string;
  by: string;
  to: { x: number; y: number };
}

/** Was eine Marke zeichnet: Name, Art und ein Bild, wenn der Artikel eines hat. */
export interface MarkerZiel {
  name: string;
  type: string;
  image?: string;
  /** Die Version der Bilddatei (T-211): mit ihr darf der Browser das Token behalten. */
  version?: string;
  /** Wie das Bild als Token gezeigt wird (T-297): fertiges Rundtoken oder Ausschnitt. */
  look?: TokenLook;
  /** Die Grösse des Statblocks (T-317) — daraus rechnet die Seite den Platz des Tokens (`tokenSpan`). */
  size?: string;
}

export interface KartenKontext {
  parents: { id: string; name: string }[];
  children: { id: string; name: string; frame: Frame }[];
  /**
   * Darf der Betrachter von hier zu einer anderen Karte zoomen (T-308)?
   * Aus heisst: keine Brotkrumen, keine Rahmen — die Seite fällt auch nicht
   * auf die Kante der Karte zurück.
   */
  navigation: boolean;
  /** Der Schalter der Sitzung selbst (`Session.mapNavigation`) — für den Knopf der Leitung. */
  mapNavigation: boolean;
  /** Die Sitzung einer Karte im Spiel, deren Schalter gilt; sonst `null`. */
  session: string | null;
  targets: Record<string, MarkerZiel>;
  party: { id: string; name: string; x: number; y: number; mapId: string; mapName: string; direct: boolean } | null;
  /**
   * Der laufende Kampf auf dieser Karte (REQ-144): wessen Token dran ist
   * und wessen danach — als Id des Artikels, auf den die Marker zeigen.
   */
  turn: { encounter: string; name: string; round: number; current: string | null; next: string | null } | null;
  /** Die Kartenregeln der Kampagne (T-204): Nebel je Gruppe oder Figur, Züge, Aufdecken beim Zug — ohne `Map.revealOnMove`, das liest die Seite an der Karte. */
  rules: MapRules;
  /** Die Figuren des Betrachters mit Token auf dieser Karte (T-204). */
  own: string[];
  /**
   * **Was der Betrachter ziehen darf** (T-290): die Ziele der Tokens, die
   * `Campaign.tokenMove` ihm lässt — für die Leitung jedes. Gerechnet am
   * Server (`darfZiehen`); die Seite fragt nicht selbst.
   */
  movable: string[];
  /**
   * **Welche Assets der Betrachter in Play schiebt** (T-306): die Kanten
   * (nicht die Ziele — zwei Kisten zeigen auf dasselbe Bild) der Assets mit
   * `movable`, für die Leitung jedes, für Spielende nach `mayMoveAsset`.
   */
  movableAssets: string[];
  /** Die laufende Kampagne, deren Regeln gelten — dorthin springt „Movement" der Leitung (T-290). */
  campaign: string | null;
  /** Offene Zugvorschläge, gestrichelt für jeden, der das Token sieht (T-204, T-290). */
  proposals: ZugVorschlag[];
  /** Nur für die Leitung: wer am Kampf teilnimmt, und ob er hier schon ein Token hat. */
  combatants: { id: string; name: string; placed: boolean }[];
  /**
   * **Dunkelsicht in Fuss** (T-216) je Figur, deren Sicht die Seite
   * zeichnet: für Spielende die eigenen und das Gruppen-Token, für die
   * Leitung jedes Spiel- und Gruppen-Token. Gelesen aus `senses` am
   * Statblock (`darkvisionFor`, D8) — gespeichert wird sie nirgends neu.
   */
  darkvision: Record<string, number>;
  /**
   * **Getragene Lichter in Fuss** (T-305) je Ziel eines Markers: ein
   * Gegenstand als Marker, die Fackel in der Hand einer Figur
   * (`carriedLights`, D8). Nur Radien — was die Figur trägt, sagt es nicht.
   */
  lights: Record<string, { bright: number; dim: number }>;
}

/** Die Seitenleiste der Karte (T-203): die Gruppe, und für die Leitung die Begegnungen der Sitzung. */
export interface KartenSeite {
  party: { id: string; name: string } | null;
  figures: SideFigure[];
  session: { id: string; name: string } | null;
  /** Nur für die Leitung; sonst leer. */
  encounters: SideEncounter[];
}

/** Das Bild eines Artikels: an einem Asset es selbst, sonst `Image.image`. */
function bildVon(e: Entity): string | undefined {
  if (primaryInterface(e) === 'Asset' && (e.components?.['Asset'] as { ref?: unknown } | undefined)?.ref) return e.id;
  const v = (e.components?.['Image'] as { image?: unknown } | undefined)?.image;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export function registerKarten(app: FastifyInstance, deps: KartenDeps): void {
  const { repo, roh, sieve, geltend, leitet, eigeneFiguren } = deps;

  app.get<{ Params: { id: string } }>('/api/maps/:id/context', async (request, reply) => {
    const stand = await roh();
    const gefunden = stand.map.get(request.params.id);
    if (!gefunden) return reply.code(404).send({ error: 'Nicht gefunden' });
    const roheKarte = await geltend(gefunden, stand.map);
    /* Alle Karten auf einmal gesiebt: Brotkrumen, Unterkarten und das
       Gruppen-Token fragen dieselben, und das Sieb ist der teure Teil. */
    /* Karten im Spiel (T-289) tragen aufgelöst die Rahmen und Marker ihrer
       Vorlage — als Unterkarte oder Standort der Gruppe zählt nur die
       Vorlage, und die Karte selbst. */
    /* Dazu die Instanzen derselben Sitzung (T-308): wer in Play zoomt,
       landet in der Karte dieser Sitzung und nicht in der Vorlage. */
    const instanz = isPlayInstance(gefunden);
    const spielSitzung = instanz ? playedInfo(gefunden).session : null;
    const karten = await sieve(
      request,
      stand.alle.filter(
        (e) => isMap(e) && (!isPlayInstance(e) || e.id === gefunden.id || (!!spielSitzung && playedInfo(e).session === spielSitzung)),
      ),
      stand.map,
    );
    const sichtbar = new Map(karten.map((k) => [k.id, k]));
    const karte = sichtbar.get(roheKarte.id);
    if (!karte || !isMap(karte)) return reply.code(404).send({ error: 'Nicht gefunden' });
    const leitetKarte = await leitet(request, roheKarte, stand.map);

    /* **Zwischen Karten wechseln** (T-308): auf einer Karte im Spiel nur,
       wenn die Sitzung es erlaubt (`mapNavigation`, Vorgabe aus), und dann
       nur in Instanzen dieser Sitzung, die der Betrachter sieht — eine
       nicht freigegebene hat das Sieb schon genommen (`heldBackMap`). Die
       Leitung navigiert immer und landet in der Instanz, wenn es eine gibt,
       sonst in der Vorlage. Abseits des Spiels gilt die Sichtbarkeit allein. */
    const erlaubt = mapNavigationOn(spielSitzung ? stand.map.get(spielSitzung) : undefined);
    const navigation = !instanz || leitetKarte || erlaubt;
    const ziel = (vorlage: Entity): Entity | null => {
      if (!instanz) return vorlage;
      const i = sessionInstance(stand.map, vorlage.id, spielSitzung);
      const gesehen = i ? sichtbar.get(i.id) : undefined;
      if (gesehen) return gesehen;
      return leitetKarte ? vorlage : null;
    };
    const vorlageId = instanz ? playTemplateId(stand.map, gefunden) : karte.id;
    const parents = navigation
      ? mapAncestors(sichtbar, karte).flatMap((e) => {
          const z = ziel(e);
          return z ? [{ id: z.id, name: entityName(z) }] : [];
        })
      : [];
    const children = !navigation
      ? []
      : karten
          .filter((k) => k.id !== karte.id && !isPlayInstance(k))
          .flatMap((k) => {
            const rel = (k.relations ?? []).find((r) => r.type === INSIDE_MAP_RELATION && (r.to === karte.id || r.to === vorlageId));
            const frame = frameOf(rel);
            const z = frame ? ziel(k) : null;
            return frame && z ? [{ id: z.id, name: entityName(z), frame }] : [];
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    /* **Unter dem Nebel kein Rahmen** (REQ-139): eine Unterkarte im
       Verdeckten verriete, dass dort etwas ist. Es zählt, ob die Mitte
       oder eine Ecke aufgedeckt ist. */
    const ohneNebel = !fogOn(karte) || leitetKarte;
    const kinder = ohneNebel ? children : children.filter((k) => frameRevealed(karte, k.frame));

    /* Die Ziele der Marker — auf der Karte stehen nur noch die, die der
       Betrachter sieht (`redactMap`); gesiebt wird trotzdem, denn ein Name
       ist ein Feld. */
    const zielIds = [...new Set(markersOf(karte).map((m) => m.to))];
    const ziele = await sieve(
      request,
      zielIds.map((id) => stand.map.get(id)).filter((e): e is Entity => !!e),
      stand.map,
    );
    /* **Das Tokenbild** (T-117, T-119): `Statblock.token` des Statblocks,
       der der Kreatur gehört (`belongsTo`), gesiebt wie jeder Artikel —
       eine Instanz kommt aufgelöst, mit dem Token ihrer Vorlage. Sonst
       das Bild des Artikels, sonst zeichnet die Seite die Anfangsbuchstaben
       des Namens, den der Server schickt (für Spielende der Deckname,
       REQ-178). Ein Durchgang über den Bestand, nicht einer je Marker. */
    const zielSet = new Set(ziele.map((z) => z.id));
    const boegen = stand.alle.filter(
      (e) => primaryInterface(e) === 'Statblock' && (e.relations ?? []).some((r) => r.type === 'belongsTo' && zielSet.has(r.to)),
    );
    const tokenVon = new Map<string, string>();
    const groesseVon = new Map<string, string>();
    for (const sb of boegen.length ? await sieve(request, boegen, stand.map) : []) {
      const t = (sb.components?.['Statblock'] as { token?: unknown } | undefined)?.token;
      const wem = (boegen.find((b) => b.id === sb.id)?.relations ?? []).find((r) => r.type === 'belongsTo' && zielSet.has(r.to))?.to;
      if (wem && typeof t === 'string' && t.trim() && !tokenVon.has(wem)) tokenVon.set(wem, t.trim());
      /* Gesiebt gelesen: was Spielende von der Grösse nicht wissen, ist ein Feld. */
      const g = wem ? statblockSize(stand.map, sb) : null;
      if (wem && g && !groesseVon.has(wem)) groesseVon.set(wem, g);
    }
    const targets: Record<string, MarkerZiel> = {};
    for (const z of ziele) {
      const bild = tokenVon.get(z.id) ?? bildVon(z);
      const asset = bild ? stand.map.get(bild) : undefined;
      const v = assetVersion(asset);
      targets[z.id] = {
        name: entityName(z),
        type: primaryInterface(z),
        ...(bild ? { image: bild } : {}),
        ...(v ? { version: v } : {}),
        ...(asset ? { look: tokenLook(asset) } : {}),
        ...(groesseVon.has(z.id) ? { size: groesseVon.get(z.id)! } : {}),
      };
    }

    /* **Wo die Gruppe steht** (REQ-136): ihr Token oder das einer ihrer
       Figuren, auf der feinsten Karte, abgebildet durch die Rahmen. */
    let party: KartenKontext['party'] = null;
    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    const gruppe = kampagne ? partiesOf(stand.map, kampagne.id)[0] : undefined;
    const [gruppeSichtbar] = gruppe ? await sieve(request, [gruppe], stand.map) : [];
    if (gruppeSichtbar) {
      const ids = new Set([gruppeSichtbar.id]);
      for (const e of stand.alle) {
        if ((e.relations ?? []).some((r) => r.type === PARTY_RELATION && r.to === gruppeSichtbar.id)) ids.add(e.id);
      }
      const p = partyPosition(sichtbar, karte, ids);
      if (p) {
        party = {
          id: gruppeSichtbar.id,
          name: entityName(gruppeSichtbar),
          ...p,
          mapName: entityName(sichtbar.get(p.mapId)),
        };
      }
    }
    /* **Der Kampf auf dieser Karte** (REQ-144): die Begegnung, die eine
       Sitzung gerade führt (`SessionState.activeEncounter`), sonst eine
       laufende mit `onMap` hierher. */
    let turn: KartenKontext['turn'] = null;
    let combatants: KartenKontext['combatants'] = [];
    /* Eine Begegnung im Spiel (T-289) aufgelöst: ihre Teilnehmer stehen an der Vorlage. */
    const kampfGefunden = encounterOnMap(stand.alle, karte.id);
    const kampfRoh = kampfGefunden ? resolvePlay(stand.map, kampfGefunden) : null;
    const [kampf] = kampfGefunden ? await sieve(request, [kampfGefunden], stand.map) : [];
    if (kampfRoh && kampf) {
      const gm = leitetKarte && (await leitet(request, kampfRoh, stand.map));
      const { current, next } = turnOf(stand.map, kampfRoh);
      /* Spielende bekommen nur, was ihre Reihe ohnehin zeigt (D53, D58):
         den Laufenden, wenn er für sie dasteht (`current` an der gesiebten
         Kante), und den Nächsten, wenn seine Kante für sie dasteht — und
         beides nur, wenn ein Token davon auf ihrer Karte steht. Ein Ring
         um ein Token, das sie ohnehin sehen, verrät keinen Namen. */
      const gesiebt = new Map((kampf.relations ?? []).map((r) => [r.id, r]));
      const aufKarte = new Set(markersOf(karte).map((m) => m.to));
      const zeig = (r: typeof current, istDran: boolean): string | null => {
        if (!r) return null;
        if (gm) return r.to;
        const g = gesiebt.get(r.id);
        if (!g || (istDran && !(g.props as { current?: boolean } | undefined)?.current)) return null;
        return aufKarte.has(r.to) ? r.to : null;
      };
      const runde = Number((kampfRoh.components?.['Encounter'] as { round?: unknown } | undefined)?.round) || 0;
      turn = { encounter: kampf.id, name: entityName(kampf), round: runde, current: zeig(current, true), next: zeig(next, false) };
      if (gm) {
        combatants = (kampfRoh.relations ?? [])
          .filter((r) => r.type === 'participates' && r.to)
          .map((r) => ({ id: r.to, name: participantLabel(stand.map, r), placed: aufKarte.has(r.to) }));
      }
    }
    /* **Regeln, eigene Figuren, Vorschläge** (T-204). Ein Vorschlag nennt
       nur das Ziel; wer ihn sieht, sieht das Token ohnehin (die eigene
       Figur, oder die Leitung). */
    const rules = mapRulesOf(kampagne);
    const meine = new Set(await eigeneFiguren(request));
    const own = [...new Set(markersOf(karte).map((m) => m.to))].filter((id) => meine.has(id));
    const aufDerKarte = [...new Set(markersOf(karte).filter((m) => m.kind !== 'scenery').map((m) => m.to))];
    /* **Wer zieht** (T-290): gefragt an der gesiebten Karte — was nicht
       dasteht, zieht niemand ausser der Leitung. */
    const wer = zieher(stand, kampagne, karte, meine);
    const movable = aufDerKarte.filter((id) => darfZiehen(leitetKarte, rules, id, wer));
    const movableAssets =
      leitetKarte || mayMoveAsset(rules) ? markersOf(karte).filter((m) => m.kind === 'scenery' && m.movable).map((m) => m.rel.id) : [];
    /* Ein Vorschlag steht für jeden da, der das Token sieht (T-290: „für
       alle sichtbar") — mit dem Namen, den der Betrachter kennt. */
    const proposals: ZugVorschlag[] = (await plaeneDerKarte(repo, roheKarte.id))
      .filter((p) => p.state === 'planned' && p.steps.length === 1 && p.steps[0]!.kind === 'move' && !!p.steps[0]!.to)
      .filter((p) => leitetKarte || !!targets[p.actor])
      .map((p) => {
        const s = p.steps[0] as Extract<PlanStep, { kind: 'move' }>;
        return { plan: p.plan, actor: p.actor, actorName: leitetKarte ? p.actorName : (targets[p.actor]?.name ?? p.actorName), by: p.by.name, to: s.to! };
      });
    /* **Dunkelsicht** (T-216): die Seite rechnet die laufende Sicht selbst
       (`figureView`) und braucht dafür die Reichweite der Figur. */
    const darkvision: Record<string, number> = {};
    for (const m of markersOf(karte)) {
      if (m.kind !== 'play' && m.kind !== 'party') continue;
      if (!leitetKarte && !meine.has(m.to) && m.kind !== 'party') continue;
      const dv = darkvisionFor(stand.map, m.to);
      if (dv > 0) darkvision[m.to] = dv;
    }
    const lights = carriedLights(stand.map, karte);
    return { parents, children: kinder, navigation, mapNavigation: erlaubt, session: spielSitzung, targets, party, turn, combatants, rules, own, movable, movableAssets, campaign: kampagne?.id ?? null, proposals, darkvision, lights } satisfies KartenKontext;
  });

  /**
   * **Die Seitenleiste der Karte** (T-203): die Figuren der Gruppe der
   * laufenden Kampagne mit Trefferpunkten und Zuständen, und für die
   * Leitung die Begegnungen der Sitzung (`?session=`, sonst die jüngste,
   * die diese Karte auf dem Tisch hat). Gerechnet über gesiebte Artikel:
   * was der Betrachter nicht wissen darf (ein Maximum am Statblock, ein
   * Zustand), fehlt hier wie überall.
   */
  app.get<{ Params: { id: string }; Querystring: { session?: string } }>('/api/maps/:id/side', async (request, reply) => {
    const stand = await roh();
    const gefunden = stand.map.get(request.params.id);
    if (!gefunden || !isMap(gefunden)) return reply.code(404).send({ error: 'Nicht gefunden' });
    const [karte] = await sieve(request, [gefunden], stand.map);
    if (!karte) return reply.code(404).send({ error: 'Nicht gefunden' });

    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    const gruppeRoh = kampagne ? partiesOf(stand.map, kampagne.id)[0] : undefined;
    const [gruppe] = gruppeRoh ? await sieve(request, [gruppeRoh], stand.map) : [];
    let figures: SideFigure[] = [];
    if (gruppe) {
      /* Figuren, ihre Statblöcke, deren Vorlagen und die Zustände — einmal gesiebt. */
      const mitglieder = partyMembers(stand.map, gruppe.id);
      const ids = new Set(mitglieder.map((m) => m.id));
      const boegen = stand.alle.filter((e) => primaryInterface(e) === 'Statblock' && (e.relations ?? []).some((r) => r.type === 'belongsTo' && ids.has(r.to)));
      const vorlagen = boegen.flatMap((b) => (b.relations ?? []).filter((r) => r.type === 'instanceOf').map((r) => stand.map.get(r.to)));
      const zustaende = mitglieder.flatMap((m) => {
        const c = (m.components?.['Vitals'] as { conditions?: unknown } | undefined)?.conditions;
        return Array.isArray(c) ? c.map((id) => stand.map.get(String(id))) : [];
      });
      const roheListe = [...new Set([...mitglieder, ...boegen, ...vorlagen, ...zustaende].filter((e): e is Entity => !!e))];
      const gesiebt = new Map((await sieve(request, roheListe, stand.map)).map((e) => [e.id, e]));
      figures = mitglieder.flatMap((m) => {
        const g = gesiebt.get(m.id);
        return g ? [sideFigure(gesiebt, g)] : [];
      });
    }

    let encounters: SideEncounter[] = [];
    let session: KartenSeite['session'] = null;
    if (await leitet(request, gefunden, stand.map)) {
      const sitzungen = await sieve(request, stand.alle.filter((e) => primaryInterface(e) === SESSION_TYPE), stand.map);
      const zeit = (e: Entity) => {
        const t = Number((e.components?.['Time'] as { sort?: unknown } | undefined)?.sort);
        return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
      };
      const sitzung =
        sitzungen.find((e) => e.id === request.query.session) ??
        sitzungen
          .filter((e) => (sessionState(e) as { activeMap?: unknown }).activeMap === karte.id)
          .sort((a, b) => zeit(b) - zeit(a) || b.id.localeCompare(a.id))[0] ??
        null;
      session = sitzung ? { id: sitzung.id, name: entityName(sitzung) } : null;
      const begegnungen = await sieve(request, stand.alle.filter((e) => primaryInterface(e) === 'Encounter'), stand.map);
      /* Eine Begegnung, die der Betrachter nicht sieht, fällt weg; die
         übrigen roh, wie die Teilnehmer im Kartenkontext — die Leitung
         bekommt die ganze Liste, die Reihe für Spielende siebt
         `redactParticipants`. */
      const sieht = new Set(begegnungen.map((e) => e.id));
      const bestand = new Map(stand.map);
      for (const e of stand.alle) if (primaryInterface(e) === 'Encounter' && !sieht.has(e.id)) bestand.delete(e.id);
      encounters = sessionEncounters(bestand, sitzung, karte.id);
    }
    return {
      party: gruppe ? { id: gruppe.id, name: entityName(gruppe) } : null,
      figures,
      session,
      encounters,
    } satisfies KartenSeite;
  });

  /**
   * **Was auf dem Tisch liegt** (REQ-116): die Karte der laufenden Sitzung.
   * Welche Sitzung läuft, sagt `?session=`; sonst die jüngste, an der eine
   * Karte liegt — nach Weltzeit (`Time.sort`), dann nach Nummer. Eine
   * zweite Stelle dafür (am Schirm, im Browser) wäre die, an der der Beamer
   * etwas anderes zeigt als der Laptop.
   */
  app.get<{ Querystring: { session?: string } }>('/api/play', async (request) => {
    const stand = await roh();
    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    const sitzungen = await sieve(
      request,
      stand.alle.filter((e) => primaryInterface(e) === SESSION_TYPE),
      stand.map,
    );
    const karten = new Map(
      (await sieve(request, stand.alle.filter(isMap), stand.map)).map((k) => [k.id, k]),
    );
    const begegnungen = new Set(
      (await sieve(request, stand.alle.filter((e) => primaryInterface(e) === 'Encounter'), stand.map)).map((e) => e.id),
    );
    const zeile = (e: Entity) => {
      /* Die Maske schreibt in `Session`, ältere Bestände tragen `SessionState` (T-202). */
      const st = sessionState(e) as { activeMap?: unknown };
      const t = (e.components?.['Time'] ?? {}) as { sort?: unknown };
      const id = typeof st.activeMap === 'string' && karten.has(st.activeMap) ? st.activeMap : null;
      /* Die Begegnung, die die Sitzung führt (T-022) — für den Tracker; nur, wenn sie zu sehen ist. */
      const kampf = (st as { activeEncounter?: unknown }).activeEncounter;
      return {
        id: e.id,
        name: entityName(e),
        activeMap: id,
        mapName: id ? entityName(karten.get(id)) : null,
        /* Liegt eine Karte im Spiel (T-289) oder noch die Vorlage? */
        inPlay: id ? isPlayInstance(karten.get(id)) : false,
        encounter: typeof kampf === 'string' && begegnungen.has(kampf) ? kampf : null,
        sort: typeof t.sort === 'number' ? t.sort : Number.NEGATIVE_INFINITY,
        nummer: String((e.components?.['Identity'] as { id?: unknown } | undefined)?.id ?? ''),
      };
    };
    const zeilen = sitzungen
      .map(zeile)
      .sort((a, b) => b.sort - a.sort || b.nummer.localeCompare(a.nummer) || a.id.localeCompare(b.id));
    const gewaehlt =
      zeilen.find((z) => z.id === request.query.session) ?? zeilen.find((z) => z.activeMap || z.encounter) ?? null;
    return {
      campaign: kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null,
      sessions: zeilen.map(({ sort: _s, nummer: _n, ...z }) => z),
      session: gewaehlt?.id ?? null,
      map: gewaehlt?.activeMap ?? null,
      inPlay: gewaehlt?.inPlay ?? false,
      encounter: gewaehlt?.encounter ?? null,
      /* Zur Wahl stehen Vorlagen; eine Karte im Spiel steht an ihrer Sitzung (T-289). */
      maps: [...karten.values()]
        .filter((k) => !isPlayInstance(k))
        .map((k) => ({ id: k.id, name: entityName(k) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    };
  });
}
