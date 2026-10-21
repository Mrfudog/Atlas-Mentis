/**
 * The HTTP surface.
 *
 * Every write goes through Validation before it reaches storage, so a
 * malformed entity is refused at the door rather than becoming a document
 * nobody can render. Reads return the registry and entities as the model
 * package defines them — front and back share one definition.
 */

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import {
  articleImage,
  assetVersion,
  statblocksOf,
  tokenLook,
  type TokenLook,
  BulkRequestSchema,
  EntitySchema,
  RegistrySchema,
  conditionProblem,
  planBulk,
  runChecks,
  selectEntities,
  storedKey,
  CAMPAIGN_TYPE,
  allowedMethods,
  allowedEquipmentMethods,
  checkPurchase,
  fixedGold,
  resolveEquipment,
  rollGold,
  startClassOf,
  startingBundle,
  startingGoldOf,
  campaignLanguages,
  campaignAllowsFeats,
  hitPointRuleOf,
  partyPool,
  rollAbilityScores,
  articleVisible,
  backlinks,
  campaignLayer,
  campaignOf,
  isReady,
  primaryInterface,
  seesUnfinished,
  tableRole,
  partiesOf,
  inventoryRulesOf,
  stowingRuleOf,
  ENCHANTED_RELATION,
  enhancementRefusal,
  enhancementsByOf,
  itemPricingOf,
  withEnhancement,
  pieceName,
  tableMovedOn,
  STATUS_COMPONENT,
  classParts,
  originParts,
  currentCampaign,
  campaignVisibility,
  effectiveAudience,
  inStack,
  adaptedVersion,
  rehang,
  takenWith,
  replacedIds,
  resolveArticle,
  playStack,
  compareLayers,
  shownLayers,
  enabledArticles,
  activeLayerRanks,
  layerShort,
  layersOf,
  resolvedStack,
  isGroupLayer,
  versionsOf,
  versionGroups,
  LAYER_COMPONENT,
  LAYER_RELATION,
  WRITE_LAYER_PREF,
  OVERRIDES_RELATION,
  VARIANT_RELATION,
  detachInstance,
  registryUsage,
  appliesCount,
  incomingIndex,
  instancesOf,
  isBookPart,
  isInstance,
  readInstance,
  redactEntity,
  initiativeRulesOf,
  redactMap,
  redactBoard,
  BOARD_TYPE,
  mapRulesOf,
  PARTY_RELATION,
  type FogMode,
  inParty,
  isMap,
  resolveInstance,
  resolvePlay,
  thinInstance,
  stageBases,
  summaryFields,
  summaryOf,
  validateEntity,
  articleId,
  entityName,
  idLinks,
  linkCandidates,
  nextId,
  typeChain,
  publisherOf,
  BOOK_PART_TYPES,
  CHAPTER_TYPE,
  nextRank,
  partsIndex,
  overridersIndex,
  CAMPAIGN_SETTING,
  craftCheck,
  shopWares,
  withVersionPrices,
  buybackPrice,
  reservedFor,
  SHOP_TYPE,
  type WareOffer,
  RECIPE_COMPONENT,
  answersOf as antwortenVon,
  characterProfile,
  type CharacterProfile,
  newChoiceDuplicates,
  duplicateText,
} from '@nw/model';
import type { BulkChange, BulkRequest, CraftCheck, CraftSource, Entity, Registry, ValidationIssue } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import { RevisionConflict } from './repo.js';
import type { ReadyStand, Repository } from './repo.js';
import type { AtlasEnv } from './config.js';
import { buildListIndex, listProjection, parseListQuery, queryList, search, type ListIndex } from './liste.js';
import { rechtAn, registerVerwaltung, siehtVergleich } from './verwaltung.js';
import { registerLesen } from './lesen.js';
import { registerQuelleninhalt } from './quelleninhalt.js';
import { registerHandwerk } from './handwerk.js';
import { leitetTisch, registerWuerfe, tischSitzung, wurfEintragen } from './wuerfe.js';
import { registerAufwertung } from './aufwertung.js';
import { registerFiltergruppen } from './filtergruppen.js';
import { registerSpaltenwahl } from './spaltenwahl.js';
import { LAYER_SETS_PREF, registerEbenensets } from './ebenensets.js';
import { inventareDerFigur, registerLaden } from './laden.js';
import { liegenlassen, registerLiegen } from './liegen.js';
import { registerGeben, stueckWerkstatt } from './stueck.js';
import { reservierteSperre, vorDemLoeschen } from './reservierung.js';
import { eigeneEbenen, registerEbenenrechte } from './ebenenrechte.js';
import { ausfuhrName, kampagnenAusfuhr } from './ausfuhr.js';
import { inDieGruppe } from './gruppe.js';
import { spielerEbenen, spielerEbeneVon, sorgeSpielerEbene } from './spielerebene.js';
import { gewaehlteEbene } from './schreibebene.js';
import { InMemoryAssetStore, type AssetStore } from './assets.js';
import { kartenbildAdressen, registerKartenbild, traegtBeschnitt } from './kartenbild.js';
import { registerBilder } from './bilder.js';
import { registerKarten } from './karten.js';
import { registerKartenliste } from './kartenliste.js';
import { registerRegeloptionen } from './regeloptionen.js';
import { registerGlossar } from './glossar.js';
import { registerWissen } from './wissen.js';
import { registerSichtbarkeit } from './sichtbarkeit.js';
import { registerZugplan, zugSperre } from './zugplan.js';
import { registerTueren } from './tueren.js';
import { registerKampfstart } from './kampfstart.js';
import { registerTracker } from './initiative.js';
import { insSpiel, registerSpielinstanz } from './spielinstanz.js';
import { uebernahmeRouten, type Gegenstelle, type Sicherung } from './uebernahme.js';
import { LocalChangeFeed, mitKanal, registerLive, type ChangeFeed } from './live.js';
import {
  ATTEMPT_WINDOW_MINUTES,
  MAX_ATTEMPTS,
  SESSION_DAYS,
  TOKEN_SCOPES,
  checkPassword,
  foldName,
  isLeitung,
  newApiToken,
  newInviteCode,
  tokenExpiry,
  tokenExpiryAt,
  hashPassword,
  hashToken,
  inWritableLayers,
  mayWrite,
  newSessionToken,
  passwordProblem,
  sessionExpiry,
  VIEW_AS_HEADER,
  mayViewAs,
  viewedAs,
  type ApiToken,
  type TokenScope,
  type User,
} from './auth.js';

/* Kanten, über die eine Figur etwas „hat". Was daran hängt, darf ihr
   Spieler schreiben — das Inventar ist seines, der Ort, an dem es liegt,
   nicht. Eine Liste und keine Regel im Kopf: wer eine Kante dazunimmt,
   nimmt sie hier dazu und sieht dabei, was er tut. */
const OWNING_RELATIONS = new Set(['carries', 'holds', 'crafting']);

/* **Die eigene Figur** (E-014 d): ein Spielercharakter, der einem Konto
   zugeteilt ist, samt seinem Statblock (`belongsTo`, am Statblock; auch
   eine Instanz) und seinem Inventar (`carries`; was darin liegt, sind die
   `holds`-Kanten des Inventars). Die verwaltet ihr Spieler vollständig:
   er setzt den Stand selbst, nichts fällt zurück, und die Mitspielenden
   sehen sie nach der gewöhnlichen Sichtbarkeit. Das Handwerk (`crafting`)
   gehört nicht dazu — ein Rezept ist kein Teil der Figur. */
const PLAYER_CHARACTER = 'PlayerCharacter';
const STATBLOCK_RELATION = 'belongsTo';
const FIGUR_KANTEN = new Set(['carries']);

/**
 * **Keine Wahl nimmt, was die Figur schon hat** (T-299): dieselbe Rechnung
 * wie im Assistenten (`newChoiceDuplicates`). Abgewiesen wird nur, was
 * dieses Speichern neu doppelt macht — eine ältere Figur bleibt
 * speicherbar.
 */
function doppelteWahlen(vorher: Entity | undefined, nachher: Entity, bestand: readonly Entity[]): ValidationIssue[] {
  if (!(nachher.relations ?? []).some((r) => r.type === 'chose')) return [];
  const byId = new Map(bestand.map((e) => [e.id, e]));
  byId.set(nachher.id, nachher);
  return newChoiceDuplicates(vorher, nachher, byId).map((d) => ({ code: 'choice_duplicate', relation: 'chose', message: duplicateText(d, byId) }));
}

/**
 * **Behälter in einem Inventar** (T-127): wer ein Inventar hat, hat auch
 * die Inventare der Gegenstände darin — der Rucksack in Rooks Gepäck ist
 * Rooks, und etwas hineinzulegen heisst, ihn zu schreiben. Nur die
 * Inventare, nicht die Gegenstände selbst; rekursiv, ein Beutel im Rucksack
 * auch.
 */
function mitBehaeltern(ids: Set<string>, bestand: Iterable<Entity>): Set<string> {
  const byId = new Map([...bestand].map((e) => [e.id, e]));
  const offen = [...ids];
  while (offen.length) {
    for (const h of byId.get(offen.pop()!)?.relations ?? []) {
      if (h.type !== 'holds') continue;
      for (const c of byId.get(h.to)?.relations ?? []) {
        if (c.type !== 'carries' || ids.has(c.to)) continue;
        ids.add(c.to);
        offen.push(c.to);
      }
    }
  }
  return ids;
}

/** Was an diesen Figuren hängt: über `kanten` von der Figur aus, und der
 *  Statblock, dessen `belongsTo` auf sie zeigt. */
function teileVon(figuren: ReadonlySet<string>, bestand: Iterable<Entity>, kanten: ReadonlySet<string>): Set<string> {
  const teile = new Set(figuren);
  if (!figuren.size) return teile;
  for (const e of bestand) {
    for (const r of e.relations ?? []) {
      if (!r.to) continue;
      if (figuren.has(e.id) && kanten.has(r.type)) teile.add(r.to);
      if (r.type === STATBLOCK_RELATION && figuren.has(r.to)) teile.add(e.id);
    }
  }
  return teile;
}

/** Die Felder, an denen man eine Änderung erkennt — ohne Zeitstempel und
 *  ohne leere Werte: eine Maske, die `aliases: []` mitschickt, wo nichts
 *  stand, hat nichts geändert. Schlüssel sortiert. */
function kern(e: Entity): string {
  const leer = (v: unknown): boolean =>
    v === undefined || v === null || v === '' ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);
  const ordne = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(ordne);
    if (v && typeof v === 'object') {
      const raus: Record<string, unknown> = {};
      for (const k of Object.keys(v as object).sort()) {
        const w = ordne((v as Record<string, unknown>)[k]);
        if (!leer(w)) raus[k] = w;
      }
      return raus;
    }
    return v;
  };
  return JSON.stringify(ordne({ name: e.name, interfaces: e.interfaces, components: e.components, relations: e.relations }));
}

/* Ein Hash, gegen den auch dann geprüft wird, wenn es den Namen nicht gibt:
   sonst verrät die Antwortzeit, welche Konten existieren. Das Passwort dazu
   kennt niemand — es wird nie gesetzt, nur dagegen gerechnet. */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$' +
  'PH0Zz8rUqZ9y1c0jzJtQ0dLxYQhL0ZBoVQ1sT0nQ0kM';

export interface AppOptions {
  repo: Repository;
  logger?: boolean;
  /** Directory of the built Angular app. Omitted in tests — the API stands alone. */
  staticRoot?: string;
  /** Siehe `Config.trustProxy`; in Tests ungesetzt. */
  trustProxy?: boolean | string;
  /** Siehe `Config.env`; in Tests ungesetzt. */
  env?: AtlasEnv | null;
  /** Solange gesetzt, liest der Server nach dem Start seinen Bestand vor
   *  (`index.ts`); `artikel` sagt, wie viele. Ungesetzt: er ist bereit. */
  anlauf?: () => { artikel: number } | null;
  /** Die Ablage der Bilder (T-114); ungesetzt im Speicher — für Tests. */
  assets?: AssetStore;
  /** Wie gross ein Bild sein darf, in Bytes (`ASSET_MAX_MB`). */
  assetMaxBytes?: number;
  /** Die Quelle des Live-Kanals (T-116); ungesetzt eine im Speicher. */
  live?: ChangeFeed;
  /** Die andere Installation für die Übernahme (T-130); ungesetzt keine. */
  transferPeer?: Gegenstelle | null;
  /** Nimmt diese Installation Übernahmen an (`ATLAS_TRANSFER_ACCEPT`)? */
  transferAccept?: boolean;
  /** Wohin die Sicherung vor einer Übernahme geht (`ATLAS_BACKUP_DIR`). */
  sicherung?: Sicherung | null;
}

const REGISTRY_PARTS = ['interfaces', 'relations', 'views', 'vars', 'enums', 'settings'] as const;
type RegistryPart = (typeof REGISTRY_PARTS)[number];

function isRegistryPart(value: string): value is RegistryPart {
  return (REGISTRY_PARTS as readonly string[]).includes(value);
}

export function buildApp({
  repo,
  logger = false,
  staticRoot,
  trustProxy = false,
  env = null,
  anlauf,
  assets = new InMemoryAssetStore(),
  assetMaxBytes = 40 * 1024 * 1024,
  live = new LocalChangeFeed(),
  transferPeer = null,
  transferAccept = false,
  sicherung = null,
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger, trustProxy });
  /* **Jedes Schreiben meldet sich beim Live-Kanal** (T-116): die Hülle
     liegt um das Repository, bevor irgendeine Route oder ein Modul es
     bekommt — so vergisst es keine. */
  repo = mitKanal(repo, live);

  void app.register(fastifyCookie);
  /* Hochladen (T-114): eine Datei je Anfrage, und die Grenze gilt schon
     beim Lesen — ein zu grosses Bild landet nie ganz im Speicher. */
  void app.register(fastifyMultipart, { limits: { fileSize: assetMaxBytes, files: 1, fields: 10, fieldSize: 4096 } });

  /* **Wie lange eine Antwort brauchte** (T-086, REQ-246): als
     `Server-Timing` an jeder Antwort — die Entwicklerwerkzeuge des Browsers
     zeigen es unter „Timing" neben der Wartezeit im Netz — und als Zeile im
     Log, damit man auf dem Server sieht, welche Route wartet. Gemessen wird
     von der Ankunft bis zum Absenden, ohne die Übertragung. */
  const beginn = new WeakMap<FastifyRequest, bigint>();
  app.addHook('onRequest', async (request) => {
    beginn.set(request, process.hrtime.bigint());
  });
  /* **Der Server sagt, dass er startet** (T-086, REQ-246), statt eine
     Anfrage hängen zu lassen, bis der Bestand gelesen ist: 503 mit der
     Zahl der Artikel, und die Oberfläche fragt nach einer Sekunde wieder.
     Anmelden und `health` gehen schon, sie brauchen den Bestand nicht. */
  const STARTFREI = new Set(['/api/health', '/api/login', '/api/logout', '/api/register']);
  app.addHook('onRequest', async (request, reply) => {
    const jetzt = anlauf?.();
    if (!jetzt || !request.url.startsWith('/api/')) return;
    if (STARTFREI.has(request.url.split('?')[0] ?? '')) return;
    return reply
      .code(503)
      .header('Retry-After', '1')
      .send({ error: 'Server is starting', starting: { articles: jetzt.artikel } });
  });
  app.addHook('onSend', async (request, reply) => {
    const t0 = beginn.get(request);
    if (t0 === undefined) return;
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    void reply.header('Server-Timing', `app;dur=${ms.toFixed(1)}`);
    if (request.url.startsWith('/api/')) {
      request.log.info({ route: request.routeOptions.url ?? request.url, ms: Math.round(ms) }, 'dauer');
    }
  });

  /* `env` sagt, welche Umgebung antwortet (T-070) — Werkzeuge fragen hier,
     die Oberfläche über `/api/me`. Es ist keine Auskunft, die jemandem
     nützt, den es nichts angeht: die Adresse sagt dasselbe. */
  app.get('/api/health', async () => ({ ok: true, env }));

  if (staticRoot) {
    // The Angular app, plus a catch-all so client-side routes survive a reload.
    void app.register(fastifyStatic, { root: staticRoot });
    /* **Welche Oberfläche dieser Server ausliefert** (T-086): ein Hash von
       `index.html`, die die gehashten Teile nennt. Steht an jeder Antwort
       der Schnittstelle; ändert er sich unter einer offenen Seite, sagt
       sie „New version" — nach einem Deploy gibt es ihre alten Teile
       nicht mehr. */
    let bau = '';
    try {
      bau = createHash('sha256').update(readFileSync(join(staticRoot, 'index.html'))).digest('hex').slice(0, 12);
    } catch {
      /* Ohne gebaute Oberfläche gibt es nichts zu vergleichen. */
    }
    if (bau) {
      app.addHook('onSend', async (request, reply) => {
        if (request.url.startsWith('/api/')) void reply.header('X-Atlas-Build', bau);
      });
    }
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Nicht gefunden' });
      }
      return reply.sendFile('index.html');
    });
  }


  // ------------------------------------------------------------ Zugang
  /*
   * Ein Passwort je Nutzer (REQ-031, 032). Der Reverse Proxy ist das, was
   * nach aussen zeigt — aber „nur das Heimnetz" ist keine Zugangskontrolle,
   * sondern eine Annahme über das Heimnetz.
   *
   * **Ohne Konto schreibt niemand.** Ein frischer Server hat kein Konto und
   * also auch kein Standardpasswort, das jemand vergisst zu ändern. Er sagt,
   * wie man das erste anlegt, und weigert sich bis dahin.
   */
  const COOKIE = 'nw_session';

  /**
   * Wer fragt: über den Sitzungskeks — oder über `Authorization: Bearer`
   * mit einem API-Token (W9). Ein Token wirkt wie die Sitzung seines
   * Kontos, beschränkt auf seine Rechte; es sieht und darf nie mehr als das
   * Konto, weil alles danach mit diesem `User` rechnet. Steht ein Token da
   * und gilt nicht, ist niemand angemeldet — auch mit einem Keks daneben:
   * ein Werkzeug, das still als jemand anderes weiterläuft, sucht man
   * lange.
   *
   * Einmal je Anfrage gefragt (Wache, Sieb und Route fragen alle), sonst
   * schöbe jede Frage die Sitzung nach.
   */
  interface Wer {
    user: User;
    token?: ApiToken | undefined;
  }
  const gefragt = new WeakMap<FastifyRequest, Promise<Wer | null>>();
  function werIst(request: FastifyRequest): Promise<Wer | null> {
    let p = gefragt.get(request);
    if (!p) {
      p = ermittle(request);
      gefragt.set(request, p);
    }
    return p;
  }
  async function ermittle(request: FastifyRequest): Promise<Wer | null> {
    const kopf = String(request.headers.authorization ?? '');
    if (/^bearer\s/i.test(kopf)) {
      const roh = kopf.slice(7).trim();
      if (!roh) return null;
      const treffer = await repo.useToken(hashToken(roh));
      if (!treffer || treffer.user.disabledAt) return null;
      const { passwordHash: _hash, ...user } = treffer.user;
      return { user, token: treffer.token };
    }
    const token = request.cookies?.[COOKIE];
    if (!token) return null;
    const user = await repo.touchSession(hashToken(token), sessionExpiry().toISOString());
    if (!user || user.disabledAt) return null;
    const { passwordHash: _hash, ...rest } = user;
    return { user: rest };
  }
  async function viewerOf(request: FastifyRequest): Promise<User | null> {
    const sicht = await sichtVon(request);
    if (sicht === 'nein') return null;
    if (sicht) return sicht.als;
    return (await werIst(request))?.user ?? null;
  }

  /**
   * **Die Sicht eines Mitglieds** (REQ-241, E-019 a): steht `X-View-As`
   * mit einer Konto-Id da und darf der Fragende das (`mayViewAs`), rechnet
   * jede Route mit diesem Konto — Sichtbarkeit, Wissen, Status, Liste,
   * Suche, Board. Es ist keine eigene Spieleransicht, sondern dieselbe
   * Rechnung mit einem anderen Konto; darum steht es hier, an der einen
   * Stelle, an der jede Route fragt, wer fragt. Geschrieben wird in dieser
   * Sicht nichts (die Wache).
   *
   * `null`: kein Kopf. `'nein'`: ein Kopf, der nicht gilt — dann ist
   * niemand angemeldet, statt still als man selbst weiterzulesen.
   */
  interface Sicht {
    als: User;
    von: User;
    kampagne: string;
  }
  const gesehen = new WeakMap<FastifyRequest, Promise<Sicht | 'nein' | null>>();
  function sichtVon(request: FastifyRequest): Promise<Sicht | 'nein' | null> {
    let p = gesehen.get(request);
    if (!p) {
      p = ermittleSicht(request);
      gesehen.set(request, p);
    }
    return p;
  }
  async function ermittleSicht(request: FastifyRequest): Promise<Sicht | 'nein' | null> {
    const roh = request.headers[VIEW_AS_HEADER];
    const zielId = String(Array.isArray(roh) ? roh[0] : (roh ?? '')).trim();
    if (!zielId) return null;
    const wer = await werIst(request);
    if (!wer) return 'nein';
    const gespeichert = await repo.getUser(zielId);
    const ziel = gespeichert ? (({ passwordHash: _h, ...r }) => r)(gespeichert) : null;
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const kampagne = currentCampaign(alle, (await repo.getRegistry()).settings ?? null)?.id ?? null;
    if (!ziel || !kampagne || !mayViewAs(wer.user, ziel, kampagne)) return 'nein';
    await merkeBeginn(wer.user, ziel, kampagne);
    return { als: viewedAs(wer.user, ziel, kampagne), von: wer.user, kampagne };
  }

  /**
   * **Wer wann wessen Sicht eingenommen hat** (REQ-241): eine Zeile im
   * Protokoll (`event_log`, `view_as.start`) je Beginn. Ein Beginn ist die
   * erste Anfrage mit diesem Ziel, oder die erste nach einer halben Stunde
   * ohne — eine Zeile je Anfrage wären hundert je Seite, und eine Zeile je
   * Beginn reicht für die Frage „wer hat bei Mara hineingeschaut?".
   */
  const PAUSE_MS = 30 * 60 * 1000;
  const zuletzt = new Map<string, { ziel: string; at: number }>();
  async function merkeBeginn(von: User, ziel: User, kampagne: string): Promise<void> {
    const jetzt = Date.now();
    const vorher = zuletzt.get(von.id);
    zuletzt.set(von.id, { ziel: ziel.id, at: jetzt });
    if (vorher && vorher.ziel === ziel.id && jetzt - vorher.at < PAUSE_MS) return;
    await repo.appendEvent('view_as.start', von.id, { target: ziel.id, campaign: kampagne });
  }

  /** **Die Ebenen, die einem Konto gehören** (T-098): keine davon ist die
   *  Ebene einer Kampagne (`campaignLayer`), auch wenn nur eine sie
   *  aufschaltet. */
  async function besessen(): Promise<Set<string>> {
    return new Set((await repo.layerGrants()).filter((g) => g.owner).map((g) => g.layerId));
  }

  /** **Die Ebene einer Kampagne** (T-098, E-001): die spezifischste
   *  aufgeschaltete, die keine andere Kampagne aufschaltet und keinem Konto
   *  gehört. Dorthin legen Spielende an, darin schreiben `gm` und `co-gm`. */
  async function kampagnenEbene(map: Map<string, Entity>, kampagne: Entity | null): Promise<Entity | null> {
    return kampagne ? campaignLayer(map, kampagne, await besessen()) : null;
  }

  /** Leitet dieses Konto irgendwo (`gm`, `co-gm`)? */
  const leitetIrgendwo = (user: User): boolean =>
    Object.values(user.roles ?? {}).some((r) => r === 'gm' || r === 'co-gm');

  /**
   * **In welchen Ebenen dieses Konto schreibt** (T-098, E-001): die, die
   * es besitzt oder zugeteilt bekam (`app_user_layer`), und als `gm` oder
   * `co-gm` die Ebene jeder Kampagne, die es leitet. Die Verwaltung schreibt
   * ohnehin alles; hier stehen für sie nur ihre zugeteilten Ebenen.
   */
  async function schreibEbenen(user: User | null, map: Map<string, Entity>): Promise<Set<string>> {
    if (!user || user.disabledAt) return new Set();
    const grants = await repo.layerGrants();
    const spieler = spielerEbenen(grants);
    const rolle = (c: string) => user.roles?.[c];
    /* **Rolle weg, Ebene bleibt** (T-164): die Spielerebene schreibt ihr
       Konto nur, solange es in ihrer Kampagne am Tisch mitspielt oder leitet. */
    const raus = new Set<string>(
      (user.layerIds ?? []).filter((l) => {
        const s = spieler.get(l);
        if (!s || s.userId !== user.id) return true;
        const r = rolle(s.campaign);
        return r === 'player' || r === 'gm' || r === 'co-gm';
      }),
    );
    const leitet = Object.entries(user.roles ?? {})
      .filter(([, r]) => r === 'gm' || r === 'co-gm')
      .map(([c]) => c);
    if (leitet.length) {
      const eigene = new Set(grants.filter((g) => g.owner).map((g) => g.layerId));
      for (const c of leitet) {
        const k = map.get(c);
        if (!k || primaryInterface(k) !== CAMPAIGN_TYPE) continue;
        const l = campaignLayer(map, k, eigene);
        if (l) raus.add(l.id);
        /* Die Spielerebenen ihrer Runde schreibt die Leitung mit — wie sie
           schreibt, was Spielende angelegt haben (D72, T-164). */
        for (const [id, s] of spieler) if (s.campaign === c && map.has(id)) raus.add(id);
      }
    }
    return raus;
  }

  /**
   * **Die Vorgabe-Schreibebene dieses Kontos in dieser Kampagne** (T-164,
   * für T-161 die eine Stelle): wohin angelegt wird, wenn niemand eine
   * Ebene nennt. Für `player` die eigene Spielerebene, solange die
   * Kampagne sie aufschaltet, sonst wie bisher die Ebene der Kampagne;
   * für alle anderen die erste Zielebene (die Leitung: die Ebene der
   * Kampagne). `null`: hier legt dieses Konto nicht an.
   */
  async function grundEbene(user: User | null, map: Map<string, Entity>, kampagne: Entity | null): Promise<Entity | null> {
    if (!user || user.disabledAt || !kampagne) return null;
    const ziele = await zielEbenen(user, map, kampagne);
    if (user.roles?.[kampagne.id] === 'player' && !user.isAdmin) {
      const eigene = spielerEbeneVon(await repo.layerGrants(), user.id, kampagne.id);
      return ziele.find((l) => l.id === eigene) ?? (await kampagnenEbene(map, kampagne));
    }
    return ziele[0] ?? null;
  }

  /**
   * **Die Schreibebene** (T-161): die gewählte, solange sie unter den
   * Zielebenen steht, sonst die Vorgabe (`grundEbene`). `dropped` nennt
   * eine Wahl, die gerade nicht gilt — aus dem Stapel gefallen oder ohne
   * Recht —, damit die Kopfleiste es sagen kann.
   */
  async function schreibEbene(
    user: User | null,
    map: Map<string, Entity>,
    kampagne: Entity | null,
  ): Promise<{ layer: Entity | null; grund: Entity | null; chosen: string | null; dropped: string | null }> {
    const grund = await grundEbene(user, map, kampagne);
    if (!user || user.disabledAt || !kampagne) return { layer: grund, grund, chosen: null, dropped: null };
    const wahl = gewaehlteEbene(await repo.getPrefs(user.id), kampagne.id);
    if (!wahl) return { layer: grund, grund, chosen: null, dropped: null };
    const l = (await zielEbenen(user, map, kampagne)).find((x) => x.id === wahl);
    return l ? { layer: l, grund, chosen: wahl, dropped: null } : { layer: grund, grund, chosen: wahl, dropped: wahl };
  }

  /** Die Schreibebene, nur wenn sie gewählt ist und gilt — ohne Wahl `null`. */
  async function gewaehlteSchreibEbene(user: User | null, map: Map<string, Entity>, kampagne: Entity | null): Promise<Entity | null> {
    const s = await schreibEbene(user, map, kampagne);
    return s.chosen && !s.dropped ? s.layer : null;
  }

  async function vorgabeEbene(user: User | null, map: Map<string, Entity>, kampagne: Entity | null): Promise<Entity | null> {
    return (await schreibEbene(user, map, kampagne)).layer;
  }

  /**
   * **Wohin dieses Konto anlegt und Fassungen legt** (T-098): seine
   * Schreibebenen, soweit sie in der laufenden Kampagne im Spiel sind —
   * eine Fassung in einer Ebene, die nicht aufgeschaltet ist, gälte
   * nirgends, und ein Artikel darin wäre für niemanden da. Zuerst die
   * Ebene der Kampagne, dann von oben nach unten. Für die Verwaltung die
   * Ebene der Kampagne und ihre zugeteilten.
   */
  async function zielEbenen(user: User | null, map: Map<string, Entity>, kampagne: Entity | null): Promise<Entity[]> {
    if (!user || user.disabledAt || !kampagne) return [];
    const schreibt = await schreibEbenen(user, map);
    const eigene = await kampagnenEbene(map, kampagne);
    if (user.isAdmin && eigene) schreibt.add(eigene.id);
    if (!schreibt.size) return [];
    const imSpiel = resolvedStack(map, kampagne)
      .filter((l) => !isGroupLayer(l) && schreibt.has(l.id))
      .reverse();
    return [...imSpiel.filter((l) => l.id === eigene?.id), ...imSpiel.filter((l) => l.id !== eigene?.id)];
  }

  /** Was ein Konto schreiben darf: seine Figur und was an ihr hängt, was
   *  es selbst angelegt hat (REQ-237), und was ganz in Ebenen liegt, in
   *  denen es schreibt (T-098, `inWritableLayers`). Die Kante steht in den
   *  Daten, also wird sie dort nachgesehen. */
  async function ownedBy(user: User, bestand?: Iterable<Entity>): Promise<Set<string>> {
    const figuren = new Set<string>(user.actorIds ?? []);
    const mitEbenen = (user.layerIds?.length ?? 0) > 0 || leitetIrgendwo(user);
    /* Die Kampagnen, an deren Tisch dieses Konto sitzt (nicht nur zuschaut). */
    const amTisch = new Set(Object.entries(user.roles ?? {}).filter(([, r]) => r !== 'spectator').map(([k]) => k));
    const liste = figuren.size || mitEbenen || amTisch.size ? [...(bestand ?? (await repo.listEntities()))] : [];
    /* Dazu der Statblock der Figur (E-014 d: alle Felder und Kanten). */
    const own = teileVon(figuren, liste, OWNING_RELATIONS);
    /* **Das Gruppeninventar** (T-127, REQ-183): wer am Tisch einer
       Kampagne sitzt, schreibt das Inventar ihrer Gruppe — etwas von der
       Figur zur Gruppe zu legen heisst, beide Inventare zu schreiben. Die
       Gruppe selbst nicht: Reisezähler und Beziehungen bleiben bei der
       Leitung. */
    if (amTisch.size) {
      const gruppen = new Set(
        liste.filter((e) => (e.relations ?? []).some((r) => r.type === 'partyOf' && amTisch.has(r.to))).map((e) => e.id),
      );
      for (const id of teileVon(gruppen, liste, FIGUR_KANTEN)) if (!gruppen.has(id)) own.add(id);
    }
    mitBehaeltern(own, liste);
    for (const id of user.authoredIds ?? []) own.add(id);
    if (mitEbenen) {
      const ebenen = await schreibEbenen(user, new Map(liste.map((e) => [e.id, e])));
      if (ebenen.size) for (const e of liste) if (inWritableLayers(e, ebenen)) own.add(e.id);
    }
    return own;
  }

  /** Die Spielercharaktere unter diesen Ids — nur sie sind ausgenommen
   *  (E-014 d), nicht jede Kreatur, die einem Konto zugeteilt ist. */
  function spielerfiguren(ids: Iterable<string>, bestand: Map<string, Entity>, registry: Registry): Set<string> {
    const raus = new Set<string>();
    for (const id of ids) {
      const e = bestand.get(id);
      if (e && typeChain(registry, primaryInterface(e)).includes(PLAYER_CHARACTER)) raus.add(id);
    }
    return raus;
  }

  /** **Die eigene Figur dieses Kontos** samt Statblock und Inventar (E-014 d). */
  function eigeneFigur(user: User, bestand: Map<string, Entity>, registry: Registry): Set<string> {
    return teileVon(spielerfiguren(user.actorIds ?? [], bestand, registry), bestand.values(), FIGUR_KANTEN);
  }

  /** **Vom Status-Gate ausgenommen** (E-014 d): die eigenen Figuren *aller*
   *  Konten — wer welche führt, steht am Server (`app_user_actor`). */
  async function ausgenommen(bestand: Map<string, Entity>, registry: Registry): Promise<Set<string>> {
    const ids = (await repo.listUsers()).filter((u) => !u.disabledAt).flatMap((u) => u.actorIds ?? []);
    return mitBehaeltern(teileVon(spielerfiguren(ids, bestand, registry), bestand.values(), FIGUR_KANTEN), bestand.values());
  }

  /** Mit wessen Augen gesiebt wird: Figuren, Rollen, Eigenes, Ausgenommenes. */
  async function augeVon(user: User, bestand: Map<string, Entity>, registry: Registry) {
    /* Die Regeln je Gruppe der laufenden Kampagne (T-252, E-098): sagt ein
       Artikel keine Stufe, sagt es seine Gruppe. */
    const campaignRules = campaignVisibility(bestand, registry, currentCampaign(bestand, registry.settings ?? null));
    return {
      actors: user.actorIds ?? [],
      roles: user.roles ?? {},
      own: await ownedBy(user, bestand.values()),
      ungated: await ausgenommen(bestand, registry),
      ...(campaignRules ? { campaignRules } : {}),
    };
  }

  /**
   * **Die letzten fertigen Stände** (REQ-237, E-012), je Bestand-Stempel
   * einmal gelesen. Geschrieben wird ein Stand **vor** dem Artikel, der ihn
   * auslöst — der Stempel ändert sich mit dem Artikel, und erst dann gilt
   * der neue.
   */
  let staende: { stempel: string; lauf: Promise<Map<string, ReadyStand>> } | null = null;
  async function fertigeStaende(): Promise<Map<string, ReadyStand>> {
    const stempel = await repo.version();
    if (staende?.stempel !== stempel) staende = { stempel, lauf: repo.readyStands() };
    return staende.lauf;
  }

  /**
   * **Wer Artikel anlegt** (REQ-237, E-011, E-013, T-098): die Verwaltung,
   * wer in der laufenden Kampagne `player` ist — jede Art, in die Ebene
   * der Kampagne —, und wer in einer Ebene schreibt, die dort im Spiel ist
   * (`zielEbenen`; die Leitung in der Ebene ihrer Kampagne, E-001). Eine
   * eigene Ebene legt jedes Konto an (`POST /api/layers`).
   */
  async function mayCreate(user: User, alle?: Map<string, Entity>): Promise<boolean> {
    if (user.disabledAt) return false;
    if (user.isAdmin) return true;
    const map = alle ?? new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const kampagne = currentCampaign(map, (await repo.getRegistry()).settings ?? null);
    if (!kampagne) return false;
    if (user.roles?.[kampagne.id] === 'player') return true;
    return (await zielEbenen(user, map, kampagne)).length > 0;
  }

  /**
   * **Wer `ready` setzt** (REQ-237, E-011): die Verwaltung und die Leitung
   * (`gm`) der Kampagne, der der Artikel gehört — nicht Spielende, nicht
   * ein Mitleiter. Gehört er keiner einzelnen, zählt `gm` irgendwo, wie bei
   * der Sichtbarkeit (`campaignOf`).
   */
  function maySetReady(user: User, alle: Map<string, Entity>, article: Entity, figur?: ReadonlySet<string>): boolean {
    if (user.isAdmin) return true;
    /* Die eigene Figur nennt ihr Spieler selbst fertig (E-014 d). */
    if (figur?.has(article.id)) return true;
    return tableRole({ roles: user.roles ?? {} }, campaignOf(alle, article)) === 'gm';
  }

  /**
   * **Wer das Register ändert:** die Verwaltung der Installation und die
   * Leitung (`gm`) der laufenden Kampagne. Das Register gilt für den ganzen
   * Tisch — eine Zeile zu ändern heisst, die Regeln zu ändern. Ein
   * Mitleiter sieht es und ändert es nicht; dieselbe Trennung wie bei den
   * Mitgliedern (CLAUDE.md, Rolle am Konto).
   *
   * Gefragt wird die **laufende** Kampagne (`currentCampaign`), weil das
   * Register keiner Ebene gehört: wer in einer anderen Runde leitet und
   * in dieser mitspielt, schreibt hier die Regeln nicht.
   */
  async function mayEditRegistry(user: User): Promise<boolean> {
    if (user.isAdmin) return true;
    const rollen = user.roles ?? {};
    if (!Object.values(rollen).includes('gm')) return false;
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const kampagne = currentCampaign(alle, (await repo.getRegistry()).settings ?? null);
    return !!kampagne && rollen[kampagne.id] === 'gm';
  }

  app.get('/api/me', async (request) => {
    const wer = await werIst(request);
    const count = await repo.countUsers();
    /* **In der Sicht eines Mitglieds** (REQ-241) sagt `/api/me`, wer
       gesehen wird und wer schaut. Geschrieben wird darin nichts, also
       bietet die Maske nichts an: kein Schreibbares, kein Anlegen, kein
       `ready`, kein Register. Gilt der Kopf nicht, sagt es `viewAsRefused`,
       und die Maske vergisst ihn. */
    const sicht = await sichtVon(request);
    if (sicht && sicht !== 'nein') {
      const actors: { id: string; name: string }[] = [];
      for (const id of sicht.als.actorIds ?? []) {
        const e = await repo.getEntity(id);
        if (e) actors.push({ id, name: entityName(e) });
      }
      return {
        user: sicht.als,
        actors,
        writable: [],
        env,
        registry: false,
        create: false,
        ready: false,
        character: [],
        setup: null,
        invites: (await repo.listInvites()).length > 0,
        token: wer?.token
          ? { name: wer.token.name, scope: wer.token.scope, expiresAt: wer.token.expiresAt }
          : null,
        viewAs: {
          id: sicht.als.id,
          name: sicht.als.name,
          role: sicht.als.roles?.[sicht.kampagne] ?? null,
          by: { id: sicht.von.id, name: sicht.von.name },
        },
      };
    }
    const user = wer?.user ?? null;
    /* **Der Server sagt, was jemand schreiben darf** — die Oberfläche rechnet
       es nicht zum zweiten Mal aus. Eine zweite Rechnung wäre die zweite
       Stelle, an der jemand eine Kante vergisst, und dann zeigt die Maske
       einen Knopf, den der Server danach abweist.

       `null` heisst „alles" und nicht „nichts": die Spielleitung bekommt
       keine Liste über den ganzen Bestand geschickt. */
    const bestand = user ? new Map((await repo.listEntities()).map((e) => [e.id, e])) : null;
    let writable: string[] | null = null;
    if (user && !user.isAdmin && bestand) {
      const eigen = await ownedBy(user, bestand.values());
      /* Was Spielende angelegt haben, schreibt die Leitung ihrer Kampagne
         mit (REQ-237) — sonst zeigte die Maske ihr keinen Knopf, um es
         `ready` zu setzen. Dieselbe Regel wie in der Wache. Was in ihren
         Ebenen liegt, bringt `ownedBy` schon mit (T-098). */
      if (Object.values(user.roles ?? {}).includes('gm')) {
        for (const id of await repo.authoredArticles()) {
          const e = bestand.get(id);
          if (e && maySetReady(user, bestand, e)) eigen.add(id);
        }
      }
      writable = [...eigen];
    }
    /* Was dieses Konto als eigene Figur verwaltet und selbst `ready` setzt
       (E-014 d) — die Maske bietet `ready` dort an. */
    const character = user && bestand ? [...eigeneFigur(user, bestand, await repo.getRegistry())] : [];
    /* Die Figuren mit Namen, nicht nur mit Id. Die Maske müsste sie sonst
       einzeln nachladen, bevor sie „meine Figuren" überhaupt beschriften
       kann — und täte es beim ersten Mal falsch. */
    const actors: { id: string; name: string }[] = [];
    for (const id of user?.actorIds ?? []) {
      const e = await repo.getEntity(id);
      if (e) actors.push({ id, name: entityName(e) });
    }
    return {
      user,
      actors,
      writable,
      /* Welche Umgebung das ist: auf dev zeigt die Oberfläche ein Band,
         dass Daten ersetzt werden können (T-070). */
      env,
      /* Ob dieser Betrachter das Register ändern darf — gesagt vom Server,
         der es beim Schreiben ohnehin prüft (`mayEditRegistry`). */
      registry: user ? await mayEditRegistry(user) : false,
      /* Ob „New article" angeboten wird (REQ-237) — Spielende der
         laufenden Kampagne und die Verwaltung. Der Server prüft es beim
         Anlegen noch einmal. */
      create: user && bestand ? await mayCreate(user, bestand) : false,
      /* Ob die Maske `ready` anbietet: die Verwaltung, und wer irgendwo
         leitet (`gm`). Je Artikel prüft der Server genauer (`maySetReady`). */
      ready: !!user && (user.isAdmin || Object.values(user.roles ?? {}).includes('gm')),
      /* Die eigene Figur samt Statblock und Inventar: dort setzt auch ein
         Spieler `ready` (E-014 d). */
      character,
      /* Ein frischer Server sagt es geradeheraus. Das ist keine Auskunft,
         die jemandem nützt, den es nichts angeht: wer den Port erreicht,
         sieht ohnehin, dass nichts eingerichtet ist. */
      setup: count === 0 ? 'Kein Konto angelegt. `pnpm --filter @nw/server user add <name> --admin`' : null,
      /* Ob sich hier überhaupt jemand anmelden kann, ohne dass die
         Spielleitung etwas tut. Die Maske zeigt den Registrieren-Knopf nur
         dann — einer, der bei jedem Versuch „Einladung fehlt" sagt, ist
         kein Knopf, sondern eine Enttäuschung. */
      invites: count === 0 ? false : (await repo.listInvites()).length > 0,
      /* Über welches Token gefragt wird — ein Werkzeug soll sehen, was es
         darf, ohne es auszuprobieren. */
      token: wer?.token
        ? { name: wer.token.name, scope: wer.token.scope, expiresAt: wer.token.expiresAt }
        : null,
      viewAs: null,
      ...(sicht === 'nein' ? { viewAsRefused: true } : {}),
    };
  });

  app.post<{ Body: { name?: string; password?: string } }>(
    '/api/login',
    async (request, reply) => {
      const name = String(request.body?.name ?? '');
      const password = String(request.body?.password ?? '');
      const fold = foldName(name);
      const origin = request.ip ?? 'unknown';
      const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString();

      if (!fold || !password) {
        return reply.code(400).send({ error: 'Name und Passwort fehlen.' });
      }
      if ((await repo.countAttempts(fold, origin, since)) >= MAX_ATTEMPTS) {
        return reply.code(429).send({
          error: `Zu viele Fehlversuche. In ${ATTEMPT_WINDOW_MINUTES} Minuten wieder.`,
        });
      }

      const user = await repo.findUserByName(fold);
      /* Auch ohne Konto wird geprüft — sonst verrät die Antwortzeit, welche
         Namen es gibt. Das kostet eine Argon2-Runde und ist es wert. */
      const ok = user
        ? !user.disabledAt && (await checkPassword(user.passwordHash, password))
        : await checkPassword(DUMMY_HASH, password);

      if (!ok || !user) {
        await repo.noteAttempt(fold, origin);
        await repo.appendEvent('login.failed', undefined, { name: fold });
        // Eine Auskunft für beide Fälle: welcher Name existiert, geht niemanden an.
        return reply.code(401).send({ error: 'Name oder Passwort stimmt nicht.' });
      }

      const token = newSessionToken();
      await repo.createSession({
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: sessionExpiry().toISOString(),
        agent: String(request.headers['user-agent'] ?? '').slice(0, 200),
      });
      await repo.clearAttempts(fold, origin);
      await repo.appendEvent('login.ok', user.id, {});

      void reply.setCookie(COOKIE, token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        /* `secure` nur hinter TLS: auf einem nackten localhost würde der
           Keks sonst stillschweigend nie gesetzt, und niemand fände heraus,
           warum die Anmeldung „funktioniert" und doch nicht hält. */
        secure: request.protocol === 'https',
        maxAge: SESSION_DAYS * 24 * 60 * 60,
      });
      const { passwordHash: _hash, ...rest } = user;
      return { user: rest };
    },
  );

  /**
   * Ein Konto anlegen — vom Spieler selbst, nicht von der Spielleitung.
   *
   * Die Spielleitung dachte sich sonst für jeden ein Passwort aus und gab
   * es weiter, über einen Kanal, der keiner ist. Wer sich selbst eines
   * setzt, hat eines, das nur er kennt.
   *
   * **Gegen eine Einladung**, und ohne sie gar nicht. Ein offener
   * Registrierungsendpunkt an einem Server, der im Netz steht, ist ein
   * Loch — und eines, das niemandem auffällt, weil sich ja nichts ändert,
   * ausser dass ein Konto mehr da ist.
   *
   * Der Code kommt aus der Einladung, die Rolle auch: ein Link kann eine
   * Figur mitbringen (dann ist es „der spezifische Link") oder die
   * Spielleitungsrolle (dann sollte ihn niemand weiterleiten).
   */
  app.post<{ Body: { name?: string; password?: string; invite?: string } }>(
    '/api/register',
    async (request, reply) => {
      const name = String(request.body?.name ?? '').trim();
      const password = String(request.body?.password ?? '');
      const code = String(request.body?.invite ?? '').trim();
      const fold = foldName(name);
      const origin = request.ip ?? 'unknown';
      const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString();

      if (!fold || !password || !code) {
        return reply.code(400).send({ error: 'Name, Passwort und Einladung gehören dazu.' });
      }
      /* Dieselbe Bremse wie beim Anmelden, mit demselben Zähler: sonst
         liesse sich über diesen Weg durchprobieren, welche Einladungen es
         gibt, während der Anmeldeweg zugehalten wird. */
      if ((await repo.countAttempts(fold, origin, since)) >= MAX_ATTEMPTS) {
        return reply.code(429).send({
          error: `Zu viele Versuche. In ${ATTEMPT_WINDOW_MINUTES} Minuten wieder.`,
        });
      }
      const schwach = passwordProblem(password);
      if (schwach) return reply.code(400).send({ error: schwach });

      /* Erst der Name, dann die Einladung: sonst wird ein Gebrauch
         verbraucht, weil jemand einen Namen gewählt hat, den es schon
         gibt. */
      if (await repo.findUserByName(fold)) {
        return reply.code(409).send({ error: 'Diesen Namen gibt es schon.' });
      }
      const invite = await repo.useInvite(hashToken(code), new Date().toISOString());
      if (!invite) {
        await repo.noteAttempt(fold, origin);
        await repo.appendEvent('register.refused', undefined, { name: fold });
        /* Eine Auskunft für alle Fälle — abgelaufen, aufgebraucht oder nie
           dagewesen geht niemanden an, der sie nicht hat. */
        return reply.code(403).send({ error: 'Diese Einladung gilt nicht (mehr).' });
      }

      const id = `u_${newSessionToken().slice(0, 16)}`;
      await repo.putUser({
        id,
        name,
        passwordHash: await hashPassword(password),
        isAdmin: invite.isAdmin,
        actorIds: invite.actorId ? [invite.actorId] : [],
        /* Eine Einladung führt in eine Kampagne, mit der Rolle darin (W3).
           Danach steht die Rolle am Konto und nicht mehr an der Einladung —
           die ist mit dem letzten Gebrauch weg. */
        roles: invite.campaignId && invite.role ? { [invite.campaignId]: invite.role } : {},
      });
      await repo.clearAttempts(fold, origin);
      await repo.appendEvent('register.ok', id, { invite: invite.label ?? null });
      /* Eine Einladung mit Figur und Rolle `player` bringt die Figur in die
         Gruppe der Kampagne (T-100, E-007) — wie das Zuteilen. */
      if (invite.actorId && invite.campaignId && invite.role === 'player') {
        await inDieGruppe(repo, invite.campaignId, [invite.actorId]);
      }
      /* … und seine Spielerebene (T-164). */
      if (invite.campaignId && invite.role === 'player') await sorgeSpielerEbene(repo, id, invite.campaignId);

      /* Gleich angemeldet. Wer sich eben ein Passwort ausgedacht hat, soll
         es nicht sofort wieder eintippen müssen — und der Weg dahin ist
         derselbe, den `/api/login` nimmt. */
      const token = newSessionToken();
      await repo.createSession({
        tokenHash: hashToken(token),
        userId: id,
        expiresAt: sessionExpiry().toISOString(),
        agent: String(request.headers['user-agent'] ?? '').slice(0, 200),
      });
      void reply.setCookie(COOKIE, token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: request.protocol === 'https',
        maxAge: SESSION_DAYS * 24 * 60 * 60,
      });
      const angelegt = await repo.getUser(id);
      const rest = angelegt ? (({ passwordHash: _h, ...r }) => r)(angelegt) : null;
      return reply.code(201).send({ user: rest });
    },
  );

  /* Einladungen, Kampagnen, Mitglieder und Konten: `verwaltung.ts` (W3). */
  registerVerwaltung(app, { repo, viewerOf });
  /* Eigene Ebenen und wer darin schreibt: `ebenenrechte.ts` (T-098). */
  registerEbenenrechte(app, { repo, viewerOf, schreibEbenen, zielEbenen, kampagnenEbene, vorgabeEbene, schreibEbene });

  app.post('/api/logout', async (request, reply) => {
    const token = request.cookies?.[COOKIE];
    if (token) await repo.dropSession(hashToken(token));
    void reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  /** Alle Geräte. Genau dafür liegt die Sitzung beim Server. */
  app.post('/api/logout-everywhere', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const n = await repo.dropSessionsOf(user.id);
    kanal.closeUser(user.id);
    void reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true, sessions: n };
  });

  /**
   * Die Wache. Sie steht vor allem unter `/api`, ausser vor dem, was man
   * braucht, um sich überhaupt anzumelden.
   *
   * Solange kein Konto angelegt ist **und der Bestand leer ist**, ist der
   * Server offen zum Lesen und zu zum Schreiben: sonst käme man an einen
   * frisch aufgesetzten Server nicht heran, und ein offener Schreibweg wäre
   * das Schlimmste von beidem.
   *
   * Die Ausnahme hing bis P5 nur an den Konten. Mit leerem Bestand war das
   * harmlos; mit zehntausend geladenen Artikeln wäre es eine offene
   * Bibliothek, sobald jemand das letzte Konto löscht (Arbeitsplan §4). Der
   * Ladebefehl verweigert ohnehin ohne Verwaltungskonto (`import.ts`).
   */
  const OPEN = new Set(['/api/health', '/api/login', '/api/register', '/api/logout', '/api/me']);
  app.addHook('preHandler', async (request, reply) => {
    const url = request.url.split('?')[0] ?? '';
    if (!url.startsWith('/api/') || OPEN.has(url)) return;

    const wer = await werIst(request);
    const user = wer?.user ?? null;
    (request as FastifyRequest & { viewer?: User | null }).viewer = user;
    /* Drei POST schreiben nichts: prüfen (`/api/validate`), Verweise
       auflösen (`/api/links` — die Texte sind zu lang für eine Adresse,
       darum kein GET) und die Vorschau einer Massenänderung (`dryRun`).
       Ein Token mit `read` darf sie, sonst könnte ein Werkzeug nicht
       fragen, was geschähe. */
    const liestNur =
      url === '/api/validate' ||
      url === '/api/links' ||
      /* Die Übernahme (T-130): lesen und vorschauen schreibt nichts. */
      url === '/api/transfer/peer/read' ||
      url === '/api/transfer/preview' ||
      (url === '/api/bulk' && (request.body as { dryRun?: unknown } | null)?.dryRun === true);
    const schreibt = request.method !== 'GET' && request.method !== 'HEAD' && !liestNur;

    if (!user) {
      const frisch = (await repo.countUsers()) === 0 && (await repo.countEntities()) === 0;
      if (frisch && !schreibt) return; // frischer Server: lesen ja, schreiben nie
      return reply.code(401).send({ error: 'Nicht angemeldet.' });
    }
    /* **Die Sicht eines Mitglieds ist nur zum Schauen** (REQ-241, E-019 a):
       was die Leitung ändert, ändert sie als sie selbst. Die eigenen
       Tokens des Ziels gehen sie nichts an — sie gehören zum Konto, nicht
       zur Kampagne. Danach rechnet alles mit dem Zielkonto. */
    const sicht = await sichtVon(request);
    if (sicht === 'nein') {
      return reply.code(403).send({ error: 'Diese Sicht darfst du nicht einnehmen.', code: 'view_as_forbidden' });
    }
    if (sicht) {
      if (schreibt) {
        return reply.code(403).send({ error: 'In dieser Sicht wird nur gelesen.', code: 'view_as_read_only' });
      }
      if (url === '/api/tokens' || url.startsWith('/api/tokens/')) {
        return reply.code(403).send({ error: 'Die Tokens gehören dem Konto.', code: 'view_as_read_only' });
      }
      (request as FastifyRequest & { viewer?: User | null }).viewer = sicht.als;
      if (url.startsWith('/api/registry/usage') && !(await mayEditRegistry(sicht.als))) {
        return reply.code(403).send({ error: 'Das Register ändert die Spielleitung.' });
      }
      return;
    }
    /* Vor jeder anderen Regel: ein Lesetoken schreibt nirgends — auch
       nicht dort, wo das Konto es dürfte (Register, Verwaltung). */
    if (schreibt && wer?.token && wer.token.scope !== 'write') {
      return reply.code(403).send({ error: 'Dieses Token darf nur lesen.' });
    }
    /* Das Register gehört der Spielleitung: eine Registerzeile zu ändern
       heisst, die Regeln zu ändern. Auch die Zählung des Bestands gehört
       ihr — sie zählt über alles, auch über Verborgenes. */
    if (url.startsWith('/api/registry') && (schreibt || url.startsWith('/api/registry/usage'))) {
      if (await mayEditRegistry(user)) return;
      return reply.code(403).send({ error: 'Das Register ändert die Spielleitung.' });
    }
    if (!schreibt) return;
    if (user.isAdmin) return;
    /* Die eigenen Tokens verwaltet jedes Konto; die Massenänderung prüft
       je Artikel selbst, ob geschrieben werden darf (`mayWrite`). */
    if (url === '/api/tokens' || url.startsWith('/api/tokens/')) return;
    /* Die eigenen Einstellungen (T-092) schreibt jedes Konto. */
    if (url.startsWith('/api/me/prefs/')) return;
    /* … und seine gespeicherten Ebenenauswahlen (T-186); geladen wird über die Kampagnenroute. */
    if (url === '/api/me/layer-sets' || url.startsWith('/api/me/layer-sets/')) return;
    if ((url === '/api/bulk' || url.startsWith('/api/bulk/')) && isLeitung(user)) return;
    /* Das eigene Leeren einer Ebene zurücknehmen (T-176): die Route prüft, wer es war. */
    if (/^\/api\/bulk\/[^/]+\/undo$/.test(url)) return;
    /* Verwaltung und Einladungen prüfen selbst: das Recht hängt an der
       Kampagne im Pfad (gm ändert, co-gm sieht), nicht am Konto allein. */
    if (url.startsWith('/api/campaigns') || url.startsWith('/api/invites')) return;

    /* Eigene Ebenen und wer darin schreibt (T-098): die Routen prüfen je
       Ebene selbst (`ebenenrechte.ts`). */
    if (url === '/api/layers' || url.startsWith('/api/layers/')) return;
    /* „Edit" an einem fremden Artikel legt eine Fassung an (T-098): die
       Route prüft die Zielebene selbst. */
    if (/^\/api\/entities\/[^/]+\/adapt$/.test(url) && request.method === 'POST') return;
    /* In die Geschichte holen (E-026): die Route prüft die Ebene der Kampagne selbst (`uebernahmeZiele`). */
    if (/^\/api\/entities\/[^/]+\/take$/.test(url) && request.method === 'POST') return;
    /* Würfeln für die Attribute (E-016 a): die Route prüft die Rolle in
       der laufenden Kampagne selbst. */
    if (url === '/api/abilities/roll' && request.method === 'POST') return;
    /* Würfe auf einem Artikel (T-172): die Route prüft Rolle und Artikel selbst (`wuerfe.ts`). */
    if (url === '/api/rolls' && request.method === 'POST') return;
    /* Die Startausrüstung (T-096): die Routen prüfen Rolle und Figur selbst. */
    if (url === '/api/equipment/roll' && request.method === 'POST') return;
    if (/^\/api\/entities\/[^/]+\/equipment$/.test(url) && request.method === 'POST') return;
    /* Das Handwerk (T-128): die Routen prüfen Figur, Rolle und Regel selbst. */
    if (url === '/api/crafting' || url.startsWith('/api/crafting/')) return;
    /* Der Reiter Knowledge (T-286): Leitung und Schreibrecht prüft die Route selbst. */
    if (url.startsWith('/api/knowledge/')) return;
    /* Filtergruppen (T-137): eigene schreibt jedes Konto, die der
       Kampagne die Leitung — die Routen prüfen beides selbst. */
    if (url === '/api/filters' || url.startsWith('/api/filters/')) return;
    /* Die Vorgabe der Spalten (T-343): die Route prüft die Leitung selbst. */
    if (url === '/api/list-columns') return;
    /* Kaufen und Verkaufen (T-133): die Route prüft die Figur selbst (`laden.ts`). */
    if (/^\/api\/shops\/[^/]+\/(buy|sell)$/.test(url) && request.method === 'POST') return;
    /* Sitzungsende und Aufheben (T-140): die Routen prüfen Rolle und Zielinventar selbst (`liegen.ts`). */
    if (/^\/api\/sessions\/[^/]+\/(end|pick-up)$/.test(url) && request.method === 'POST') return;
    /* Geben (T-150): die Route fragt `mayWrite` am Inventar selbst (`stueck.ts`). */
    if (/^\/api\/inventories\/[^/]+\/give$/.test(url) && request.method === 'POST') return;
    /* Der Zugplan (T-198): die Routen prüfen Figur und Leitung selbst (`zugplan.ts`). */
    if (/^\/api\/maps\/[^/]+\/turn-plan(\/[^/]+\/(decide|react))?$/.test(url) && request.method === 'POST') return;
    /* Die eigene Figur ziehen (T-204): die Route prüft Figur, Kampf und Kampagnenregel selbst (`zugplan.ts`). */
    if (/^\/api\/maps\/[^/]+\/move$/.test(url) && request.method === 'POST') return;
    /* Alle durch einen Übergang schicken (T-326): die Route prüft die Leitung selbst (`zugplan.ts`). */
    if (/^\/api\/maps\/[^/]+\/passage$/.test(url) && request.method === 'POST') return;
    /* Eine Tür öffnen (T-118): die Route prüft Leitung, Kampagnenregel und Figur an der Tür selbst (`tueren.ts`). */
    if (/^\/api\/maps\/[^/]+\/door$/.test(url) && request.method === 'POST') return;
    /* Eine Begegnung beginnen (T-203): die Route prüft die Leitung selbst (`kampfstart.ts`). */
    if (/^\/api\/encounters\/[^/]+\/start$/.test(url) && request.method === 'POST') return;
    /* Der Initiative-Tracker (T-022): die Route prüft Leitung und eigenen Zug selbst (`initiative.ts`). */
    if (/^\/api\/encounters\/[^/]+\/tracker$/.test(url) && request.method === 'POST') return;
    /* Eine Karte oder Begegnung ins Spiel nehmen (T-289): die Route prüft die Leitung selbst (`spielinstanz.ts`). */
    if (url === '/api/play/take' && request.method === 'POST') return;
    /* Enhancements an einem Stück (T-300): die Route prüft Leitung und Kampagnenregel selbst (`aufwertung.ts`). */
    if (/^\/api\/entities\/[^/]+\/enhancements(\/[^/]+)?$/.test(url) && (request.method === 'POST' || request.method === 'DELETE')) return;
    /* Den eigenen Lesestand merken (T-091): die Route schreibt nur am Konto. */
    if (/^\/api\/read\/[^/]+\/position$/.test(url) && request.method === 'PUT') return;
    /* „ready" per Knopf (REQ-237): die Route prüft je Artikel (`maySetReady`). */
    if (/^\/api\/entities\/[^/]+\/ready$/.test(url) && request.method === 'POST') return;
    /* Anlegen: Spielende der laufenden Kampagne (REQ-237). Ein Bild
       hochladen legt einen Asset-Artikel an (T-114) — dieselbe Frage. */
    if ((url === '/api/entities' || url === '/api/assets') && request.method === 'POST') {
      if (await mayCreate(user)) return;
      return reply.code(403).send({ error: 'Anlegen darfst du hier nicht.' });
    }
    /* „Quelle ersetzen" an einem Bild (T-119): die Route fragt
       `mayWrite` selbst — erst nach dem Sieb, damit ein fremdes Bild 404
       sagt und nicht 403. */
    if (/^\/api\/assets\/[^/]+\/file$/.test(url) && request.method === 'PUT') return;
    /* Ein Bild als Karte, Token, Requisite (T-201): die Route fragt
       `mayCreate` und `mayWrite` selbst, je nachdem, was sie tut. */
    if (/^\/api\/assets\/[^/]+\/use$/.test(url) && request.method === 'POST') return;
    /* Ein Konto schreibt seine Figur und was an ihr hängt, was es selbst
       angelegt hat und was in seinen Ebenen liegt (T-098) — und sonst
       nichts. */
    const id = url.startsWith('/api/entities/') ? decodeURIComponent(url.slice(14)) : '';
    if (id && mayWrite(user, await ownedBy(user), id)) return;
    /* **Die Leitung schreibt, was Spielende ihr vorlegen** (REQ-237): sonst
       könnte sie es nicht `ready` setzen. Nur Artikel, die jemand angelegt
       hat, und nur als `gm` ihrer Kampagne (`maySetReady`) — auch wenn sie
       nicht in der Ebene der Kampagne liegen. */
    if (id && request.method === 'PUT' && (await repo.authorsOf(id)).length) {
      const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      const da = alle.get(id);
      if (da && maySetReady(user, alle, da)) return;
    }
    return reply.code(403).send({ error: 'Das gehört dir nicht.' });
  });

  // ---------------------------------------------------------------- registry

  app.get('/api/registry', async () => repo.getRegistry());

  /* Je Bestandsstempel und Register einmal gezählt (T-086): das Register
     fragt bei jedem Öffnen, und gezählt wird über den ganzen Bestand. */
  let gezaehlt: { key: string; lauf: Promise<unknown> } | null = null;

  /**
   * **Was der Bestand an jeder Zeile trägt** — je Art, Karte, Feld,
   * Listenwert und Kantenart (`registryUsage`). Das Register fragt es,
   * bevor es ein Feld löscht, einen Typ herausnimmt oder einen Wert
   * streicht: was dabei verloren ginge oder beim nächsten Speichern
   * abgewiesen würde, wird vorher gezählt und gesagt. Ungesiebt, darum nur
   * für die, die das Register ändern (Wache oben).
   */
  app.get('/api/registry/usage', async () => {
    const [stand, registry] = await Promise.all([roh(), repo.getRegistry()]);
    const key = `${stand.stempel}|${registerStempel(registry)}`;
    if (gezaehlt?.key !== key) {
      const lauf = Promise.resolve().then(() => zaehle(registry, stand.alle, stand.map));
      gezaehlt = { key, lauf };
      lauf.catch(() => {
        if (gezaehlt?.lauf === lauf) gezaehlt = null;
      });
    }
    return gezaehlt.lauf;
  });
  function zaehle(registry: Registry, alle: Entity[], map: Map<string, Entity>) {
    const usage = registryUsage(registry, alle);
    /* **Gespeichert und sichtbar sind zwei Zahlen** (T-069). Das Register
       zählte den ganzen Bestand und widersprach damit der Liste, die nur
       zeigt, was die laufende Kampagne aufschaltet. Beides steht jetzt da;
       „sichtbar" heisst im Stapel, vor Sichtbarkeit und Wissen. */
    const kampagne = currentCampaign(map, registry.settings ?? null);
    const stapel = kampagne ? playStack(map, kampagne, registry) : null;
    /* Gestaltete Ansichten (T-268): wie viele Artikel jede bekommt —
       gezählt, was im Stapel steht; Teile und Instanzen sind keine Artikel
       einer Liste und bekommen keine eigene Ansicht. */
    const gestaltet = Object.entries(registry.views).filter(([, d]) => d.applies);
    const views: Record<string, number> = {};
    if (gestaltet.length) {
      const zaehlbar = alle.filter((e) => (!stapel || stapel.inPlay(e)) && !isBookPart(e) && !isInstance(e));
      const rueck = incomingIndex(alle);
      for (const [key, def] of gestaltet) views[key] = appliesCount(registry, def, zaehlbar, (id) => rueck.get(id) ?? []);
    }
    const mitAnsichten = gestaltet.length ? { ...usage, views } : usage;
    if (!kampagne || !stapel) return mitAnsichten;
    const inPlayJeArt: Record<string, number> = {};
    for (const e of alle) {
      const typ = e.interfaces?.[0];
      if (typ && stapel.inPlay(e)) inPlayJeArt[typ] = (inPlayJeArt[typ] ?? 0) + 1;
    }
    return { ...mitAnsichten, inPlay: inPlayJeArt, campaign: { id: kampagne.id, name: entityName(kampagne) } };
  }

  app.put<{ Params: { part: string }; Body: unknown }>(
    '/api/registry/:part',
    async (request, reply) => {
      const { part } = request.params;
      if (!isRegistryPart(part)) {
        return reply.code(404).send({ error: `Unbekannter Registerteil: ${part}` });
      }

      // Validate the part in the context of the whole registry, so a broken
      // row cannot be written and then break every later read.
      const current = await repo.getRegistry();
      const candidate: Registry = { ...current, [part]: request.body } as Registry;
      const parsed = RegistrySchema.safeParse(candidate);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Register ungültig', issues: parsed.error.issues });
      }

      // Written out per part so each call is properly typed — a generic
      // indexed write across the union loses the correlation between the
      // key and the value's shape.
      switch (part) {
        case 'interfaces': await repo.putRegistryPart('interfaces', parsed.data.interfaces); break;
        case 'relations': await repo.putRegistryPart('relations', parsed.data.relations); break;
        case 'views': await repo.putRegistryPart('views', parsed.data.views); break;
        case 'vars': await repo.putRegistryPart('vars', parsed.data.vars); break;
        case 'enums': await repo.putRegistryPart('enums', parsed.data.enums ?? {}); break;
        case 'settings': await repo.putRegistryPart('settings', parsed.data.settings ?? {}); break;
      }
      await repo.appendEvent('registry.written', undefined, { part });
      return { ok: true, part };
    },
  );

  // ---------------------------------------------------------------- entities

  /**
   * Gelesen wird gesiebt (REQ-035, 036).
   *
   * Bis hierher machte das Zurückhalten nur die Oberfläche. Das reicht
   * genau so lange, wie niemand die Schnittstelle direkt aufruft — und ein
   * Server, der einem Spieler die Geheimnisse schickt und darauf baut, dass
   * sein Browser sie nicht anzeigt, hält gar nichts zurück. Das Sieb selbst
   * steht im Modellpaket, weil es für Server und Oberfläche gleichermassen
   * gilt und es nur einmal geben darf.
   */
  /* Die laufende Kampagne je Bestand: ohne Einstellung sucht
     `currentCampaign` den ganzen Bestand ab, und das Sieb fragt je Aufruf. */
  const kampagneJe = new WeakMap<Map<string, Entity>, { key: string; kampagne: Entity | null }>();
  function kampagneIn(map: Map<string, Entity>, settings: Record<string, string> | null): Entity | null {
    const key = settings?.[CAMPAIGN_SETTING] ?? '';
    const da = kampagneJe.get(map);
    if (da?.key === key) return da.kampagne;
    const kampagne = currentCampaign(map, settings);
    kampagneJe.set(map, { key, kampagne });
    return kampagne;
  }

  const stapelJe = new WeakMap<Map<string, Entity>, { key: string; stapel: ReturnType<typeof playStack> }>();
  function stapelFuer(roh: Map<string, Entity>, kampagne: Entity | null, registry: Registry): ReturnType<typeof playStack> {
    const key = `${kampagne?.id ?? ''}|${registerStempel(registry)}`;
    const da = stapelJe.get(roh);
    if (da?.key === key) return da.stapel;
    const stapel = playStack(roh, kampagne, registry);
    stapelJe.set(roh, { key, stapel });
    return stapel;
  }

  /**
   * Welche Artikel das Sieb überhaupt fragt. `{ preview }` (T-167): was im
   * Stapel steht und dazu, was nur fehlt, weil eine dieser Ebenen nicht
   * aufgeschaltet ist — die Vorschau eines Buchs vor dem Aufschalten.
   * Sichtbarkeit und Wissen gelten danach wie immer.
   */
  /* `{ preview, whole: true }` (T-189): alles, was in einer dieser Ebenen
     liegt, auch was eine Auswahl, eine Typ-Regel oder eine Fassung im Spiel
     gerade nicht bringt — der Inhaltsbaum einer Quelle zeigt der Leitung
     das Ganze, mit dem Stand daneben. */
  type Stapelfrage = 'inPlay' | 'unactivated' | 'versions' | 'compare' | { preview: ReadonlySet<string>; whole?: true };

  async function sieve(
    request: FastifyRequest,
    entities: Entity[],
    bestand?: Entity[] | Map<string, Entity>,
    /** Vor dem Wissen auf das Nötige kürzen — der Index der Liste braucht
     *  nur die Karten, die eine Zeile zeigt, und das Wissen gilt je Feld:
     *  was gekürzt wird, hätte keinen anderen Wert gesiebt. */
    schmal?: (e: Entity) => Entity,
    /** `'unactivated'`: statt der Artikel im Stapel die, die nur fehlen,
     *  weil ihre Ebene nicht aufgeschaltet ist (T-069) — gesiebt, als
     *  wären sie da. Gezählt wird so nur, was dieser Betrachter nach dem
     *  Aufschalten sähe. */
    /* `'versions'` (T-092): die Fassungen eines Artikels — was im Stapel
       steht, auch überschrieben, und was eine Vergleichsebene bringt, wenn
       dieser Betrachter Vergleichsebenen sehen darf (`siehtVergleich`). */
    stapel: Stapelfrage = 'inPlay',
  ): Promise<Entity[]> {
    return sieveFuer(await viewerOf(request), entities, bestand, schmal, stapel);
  }

  /** **Das Sieb für ein Konto statt einer Anfrage** — der Live-Kanal
   *  (T-116) siebt je Empfänger, ohne dass eine Anfrage dasteht. Dieselbe
   *  Rechnung, damit der Kanal kein Umweg an ihr vorbei ist. */
  async function sieveFuer(
    user: User | null,
    entities: Entity[],
    bestand?: Entity[] | Map<string, Entity>,
    schmal?: (e: Entity) => Entity,
    stapel: Stapelfrage = 'inPlay',
  ): Promise<Entity[]> {
    /* **Eine Instanz geht aufgelöst hinaus**, mit ihrer Vorlage darin und
       der Angabe, welche Felder von dort kommen. Gespeichert ist an ihr nur,
       was abweicht; ohne Auflösung hätte Wache 1 keine Trefferpunkte. */
    const roh =
      bestand instanceof Map
        ? bestand
        : new Map((bestand ?? (await repo.listEntities())).map((e) => [e.id, e]));
    const registry = await repo.getRegistry();
    /* **Die nullte Frage: steht der Artikel im Stapel?** (E2, A2) Was eine
       aufgeschaltete Ebene herausnimmt oder eine spezifischere Fassung
       überschreibt, ist nicht da — für jeden, auch für die Verwaltung.
       Bis zum 7.10. rechnete das nur der Prototyp, und der Server schickte
       solche Artikel trotzdem hinaus. */
    const kampagne = kampagneIn(roh, registry.settings ?? null);
    /* Einmal je Bestand und Register gerechnet, nicht je Aufruf (T-086,
       T-108): mit hunderttausend Teilen kostet der Stapel eine Sekunde,
       und die Leseansicht siebt je Anfrage zwei- oder dreimal. */
    const sicht = stapelFuer(roh, kampagne, registry);
    const vergleich = (stapel === 'versions' || stapel === 'compare') && siehtVergleich(user, kampagne);
    entities = entities
      .filter((e) =>
        typeof stapel === 'object'
          ? sicht.inPlay(e) ||
            (stapel.whole
              ? (e.relations ?? []).some(
                  (r) => r.type === LAYER_RELATION && stapel.preview.has(r.to) && (r.props as { mode?: unknown } | undefined)?.mode !== 'removes',
                )
              : sicht.unactivated(e).some((l) => stapel.preview.has(l)))
          : stapel === 'inPlay'
          ? sicht.inPlay(e)
          : stapel === 'versions'
            ? sicht.inStack(e) || (vergleich && sicht.inCompare(e))
            : stapel === 'compare'
              ? vergleich && !sicht.inStack(e) && sicht.inCompare(e)
              : sicht.unactivated(e).length > 0,
      )
      /* Ein Stück mit Enhancements bekommt Name, Preis und Boni gerechnet
         dazu (T-300, D8), nach der Preisregel der Kampagne. */
      .map((e) => withEnhancement(roh, readInstance(roh, e), e, itemPricingOf(kampagne)));
    if (!user || user.isAdmin) return entities;
    /* Der Zusammenhang ist immer der ganze Bestand, auch wenn nur ein
       Artikel gesiebt wird: welche Information ein Feld beansprucht und
       wem sie gehört, steht an anderen Artikeln. Mit einer Karte aus nur
       diesem einen fände das Sieb keine einzige Information — und liesse
       alles durch, ohne dass irgendwo etwas schiefginge. */
    let alle = roh;
    const gmFields = String(registry.settings?.['gmFields'] ?? 'Secrets.secret,Tactics.tactics,Encounter.solution,Encounter.hint')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    /* **Alle Figuren dieses Kontos zusammen.** Wer Rook und Sela spielt,
       weiss am Tisch, was beide wissen — eine Seite, die ihm Selas Wissen
       vorenthält, während er Rook offen hat, zwingt ihn zum Umschalten und
       sonst zu nichts.

       Eine leere Liste ist nicht dasselbe wie keine: `undefined` heisst
       Spielleitung und sieht alles, `[]` heisst ein Konto ohne Figur und
       sieht genau das Offene. Das ist die richtige Vorgabe — ein Konto
       ohne Figur ist eines, dem noch nichts zugeteilt wurde. */
    /* **Zwei Fragen, und die grobe kommt zuerst.** Die Sichtbarkeit sagt,
       ob dieser Artikel überhaupt an ihn geht; das Wissen sagt, welche
       Felder darin. Sie zusammenzulegen hiesse, einen Artikel dadurch zu
       verbergen, dass man alle seine Felder wegnimmt — und er stünde
       trotzdem in der Liste, mit Namen und Bereich.

       Bis hierher war die grobe Frage nur eine Angabe in der Karte, die
       niemand auswertete: `audience: 'gm'` stand da, und der Server
       schickte den Artikel. */
    const augen = user.actorIds ?? [];
    /* **Die Rollen gehen mit, nicht nur die Figuren.** Wer eine Kampagne
       leitet, hat keine Figur — seine Rolle steht am Konto, je Kampagne
       (`campaign_member`). Das Wissen fragt weiter nur nach den Figuren:
       was jemand erfahren hat, hat eine Figur erfahren. Eigenes geht in
       jedem Stand an ihn (REQ-237), und die Figuren der Mitspielenden sind
       vom Stand ausgenommen (E-014 d). */
    const auge = await augeVon(user, roh, registry);
    /* **Der letzte fertige Stand gilt für alle anderen** (REQ-237, E-012):
       fiel ein Artikel nach einer Änderung einer Spielerin auf `prepared`,
       bekommt, wer den Arbeitsstand nicht sieht (`seesUnfinished`), die
       Kopie von vorher — in der Liste, als Artikel und als Zusammenhang
       des Siebs. Nennt die Leitung ihn wieder fertig, gilt der neue. */
    const fertig = await fertigeStaende();
    if (fertig.size) {
      const statt = new Map<string, Entity>();
      for (const [id, st] of fertig) {
        const jetzt = roh.get(id);
        if (jetzt && !isReady(jetzt) && !seesUnfinished(roh, jetzt, auge)) statt.set(id, st.entity);
      }
      if (statt.size) {
        alle = new Map(roh);
        for (const [id, e] of statt) alle.set(id, e);
        entities = entities.map((e) => (statt.has(e.id) ? readInstance(alle, statt.get(e.id)!) : e));
      }
    }
    /* **Eine Karte ohne das, was am Tisch niemand sehen soll** (T-115,
       docs/Karten.md): versteckte Marker, Marker auf Verborgenes und die
       Blätter der Leitung gehen gar nicht erst hinaus. Wer die Karte
       leitet oder schreibt, bekommt sie ganz — sonst schriebe er beim
       nächsten Speichern eine gekürzte Karte zurück. */
    const sieht = new Map<string, boolean>();
    const siehtZiel = (id: string): boolean => {
      let ja = sieht.get(id);
      if (ja === undefined) {
        const z = alle.get(id);
        ja = !!z && articleVisible(alle, z, auge);
        sieht.set(id, ja);
      }
      return ja;
    };
    /* **Nebel je Figur** (T-204): was die Kampagne sagt, und wessen
       Aufgedecktes dieses Konto sieht — seine Figuren und deren Gruppen. */
    let nebel: { fog: FogMode; own: (id: string) => boolean } | null = null;
    const nebelFuer = () => {
      if (!nebel) {
        const eigene = new Set(augen);
        for (const a of augen) for (const r of alle.get(a)?.relations ?? []) if (r.type === PARTY_RELATION) eigene.add(r.to);
        nebel = { fog: mapRulesOf(currentCampaign(alle, registry.settings ?? null)).fog, own: (id) => eigene.has(id) };
      }
      return nebel;
    };
    /* Was die Kampagne Spielenden von der Initiative zeigt (T-022). */
    const initRegeln = initiativeRulesOf(currentCampaign(alle, registry.settings ?? null));
    return entities
      .filter((e) => articleVisible(alle, e, auge))
      .map((e) => redactEntity(registry, alle, schmal ? schmal(e) : e, augen, gmFields, initRegeln))
      .map((e) =>
        isMap(e) && !seesUnfinished(alle, e, auge)
          ? /* Das Kartenbild nur, soweit aufgedeckt (T-312, E-041): die
               Blätter zeigen auf eine beschnittene Adresse (`kartenbild.ts`). */
            kartenbildAdressen(
              redactMap(e, {
                gm: false,
                sees: siehtZiel,
                /* Unter dem Nebel (REQ-139) bleiben die eigenen stehen: die
                   Figuren der Gruppe und wer zu ihr gehört. */
                keep: (id) => inParty(alle, id),
                ...nebelFuer(),
              }),
              (id) => assetVersion(alle.get(id)),
            )
          : /* Ein Board ohne das, was die Leitung zurückhält (T-339): Formen
               und Kacheln mit `hidden`. Wer es schreibt, bekommt es ganz. */
            primaryInterface(e) === BOARD_TYPE && !seesUnfinished(alle, e, auge)
            ? redactBoard(e)
            : e,
      );
  }

  app.get<{ Querystring: { ids?: string } }>('/api/entities', async (request, reply) => {
    /* Der ganze Bestand, gesiebt — für Ausfuhr und Prüfungen. Die
       Oberfläche fragt ihn nicht mehr: Listen kommen aus `/api/list`, ein
       Artikel aus `/api/entities/:id`. Die Kurzfassung `?as=summary` ist
       am 13.10. weggefallen (W7) — sie war genau der Weg, auf dem der
       Browser 7,7 MB lud, bevor er eine Zeile zeigte. */
    const alle = await repo.listEntities();
    /* `?ids=a,b,c`: **diese Artikel ganz**, in einer Anfrage — die Teile
       eines Statblocks (die Ziele seiner `composedOf`-Kanten), die ein
       geöffneter Artikel zeichnet (W2). Ein Drache hat dreizehn Teile;
       dreizehn Anfragen wären dreizehnmal das Sieb. Gesiebt wird wie
       sonst: was der Betrachter nicht sehen darf, fehlt in der Antwort. */
    if (request.query.ids !== undefined) {
      const ids = new Set(request.query.ids.split(',').map((x) => x.trim()).filter(Boolean));
      if (ids.size > 500) return reply.code(400).send({ error: 'Höchstens 500 Ids je Anfrage' });
      return sieve(request, alle.filter((e) => ids.has(e.id)), alle);
    }
    return sieve(request, alle, alle);
  });

  /* **Die eigene Kampagne als Datei** (T-077, REQ-199): Register und die
     Artikel der Kampagne, im Format, das `import.ts` liest. Herunterladen
     dürfen die Verwaltung und die Leitung dieser Kampagne (`gm`, `co-gm` —
     sehen tun beide dasselbe); `layers=all` mit 5e.tools und allem nur die
     Verwaltung. Was hineingeht und warum: `ausfuhr.ts`. */
  app.get<{ Querystring: { campaign?: string; layers?: string } }>('/api/export', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const c = String(request.query.campaign ?? '').trim();
    if (!c) return reply.code(400).send({ error: 'Welche Kampagne? `?campaign=<id>`' });
    if (!rechtAn(user, c)) return reply.code(403).send({ error: 'Ausführen darf die Leitung dieser Kampagne.' });
    const layers = request.query.layers ?? 'campaign';
    if (layers !== 'campaign' && layers !== 'all') return reply.code(400).send({ error: '`layers` ist `campaign` oder `all`.' });
    if (layers === 'all' && !user.isAdmin) return reply.code(403).send({ error: 'Den ganzen Bestand führt die Verwaltung aus.' });
    const alle = await repo.listEntities();
    const kampagne = alle.find((e) => e.id === c && (e.interfaces ?? [])[0] === CAMPAIGN_TYPE);
    if (!kampagne) return reply.code(404).send({ error: 'Diese Kampagne gibt es nicht als Artikel.' });
    const datei = kampagnenAusfuhr(alle, await repo.getRegistry(), kampagne, { all: layers === 'all', user });
    await repo.appendEvent('export', c, { by: user.id, layers, entities: datei.entities.length });
    return reply
      .header('content-disposition', `attachment; filename="${ausfuhrName(datei.campaign.name, datei.at)}"`)
      .send(datei);
  });

  // ------------------------------------------------------------ Liste (W7)

  /**
   * Der rohe Bestand je Stempel, mit den Nachschlagetafeln für Verweise:
   * Nummer und Peg-Id → Artikel, Name und Alias → Artikel. Ungesiebt — wer
   * daraus liest, siebt danach, was er gefunden hat.
   */
  let rohStand: {
    stempel: string;
    alle: Entity[];
    map: Map<string, Entity>;
    /** Was eine Fassung ersetzt (`overrides`) — nur dafür lohnt `geltend` die Rechnung. */
    ersetzt: Set<string>;
    /** Je Artikel, wer ihn überschreibt (`overridersIndex`, T-108). */
    ueberschreiber: Map<string, Entity[]>;
    namen: Map<string, Entity[]>;
  } | null = null;
  async function roh(): Promise<NonNullable<typeof rohStand>> {
    const stempel = await repo.version();
    if (rohStand?.stempel === stempel) return rohStand;
    const alle = await repo.listEntities();
    const map = new Map(alle.map((e) => [e.id, e]));
    const namen = new Map<string, Entity[]>();
    const merke = (k: string, e: Entity): void => {
      const key = k.trim().toLowerCase();
      if (!key) return;
      const l = namen.get(key);
      if (!l) namen.set(key, [e]);
      else if (!l.includes(e)) l.push(e);
    };
    for (const e of alle) {
      merke(e.id, e);
      merke(articleId(e), e);
      /* Ein Teil eines Buchs ist kein Ziel nach Namen (T-108). */
      if (isBookPart(e)) continue;
      merke(entityName(e), e);
      const aliases = e.components?.['Identity']?.['aliases'];
      if (Array.isArray(aliases)) for (const a of aliases) merke(String(a), e);
    }
    const ueberschreiber = overridersIndex(alle);
    const ersetzt = new Set<string>(ueberschreiber.keys());
    rohStand = { stempel, alle, map, namen, ersetzt, ueberschreiber };
    return rohStand;
  }

  /** Ein kleiner Hash des Registers: ändert es sich, gilt kein Index mehr. */
  function registerStempel(registry: Registry): string {
    const s = JSON.stringify(registry);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return `${s.length}:${(h >>> 0).toString(36)}`;
  }

  /**
   * Der Index der Liste — je Bestand-Stempel, Register und Betrachter
   * einmal gerechnet (`liste.ts`). Die Verwaltung teilt sich einen; ein
   * Spieler hat seinen eigenen, weil das Sieb für ihn Wissen je Artikel
   * rechnet. Gehalten werden die letzten acht: eine Runde hat selten mehr
   * Leute gleichzeitig am Kompendium.
   */
  const indizes = new Map<string, Promise<ListIndex>>();
  /** Wer die Werkbank hat (W9): die Verwaltung und die Leitung der laufenden
   *  Kampagne — sie sieht alle Ebenen (T-207), jede andere Seite nur den Stapel. */
  async function darfAlleEbenen(request: FastifyRequest): Promise<boolean> {
    const [stand, registry, user] = await Promise.all([roh(), repo.getRegistry(), viewerOf(request)]);
    if (!user) return true;
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    return user.isAdmin || (!!kampagne && !!rechtAn(user, kampagne.id));
  }
  async function indexFor(
    request: FastifyRequest,
    stapel: 'inPlay' | 'unactivated' | 'compare' = 'inPlay',
    /** Alle Ebenen nennen, auch nicht aufgeschaltete (T-207) — nur für die
     *  Werkbank der Leitung und Verwaltung (`allLayers=1`, `darfAlleEbenen`). */
    alleEbenen = false,
  ): Promise<ListIndex> {
    const [stand, registry, user] = await Promise.all([roh(), repo.getRegistry(), viewerOf(request)]);
    /* Die ausgenommenen Figuren gehören in den Schlüssel: wer eine Figur
       zugeteilt bekommt, ändert keinen Artikel und damit keinen Stempel.
       Ebenso die Ebenen, in denen er schreibt (T-098): was darin liegt,
       sieht er in jedem Stand. */
    const wer =
      !user || user.isAdmin
        ? '*'
        : `${user.id}|${(user.actorIds ?? []).join(',')}|${(user.authoredIds ?? []).join(',')}|${JSON.stringify(user.roles ?? {})}|${[...(await ausgenommen(stand.map, registry))].sort().join(',')}|${(user.layerIds ?? []).join(',')}|${[...(await besessen())].sort().join(',')}`;
    const key = `${stand.stempel}|${stapel}|${alleEbenen ? 'alle' : ''}|${registerStempel(registry)}|${wer}`;
    let lauf = indizes.get(key);
    if (lauf) {
      indizes.delete(key);
      indizes.set(key, lauf); // zuletzt gebraucht steht hinten
      return lauf;
    }
    /* Der Rang je Artikel für die Kopfzeile der Fassungen (T-092) —
       derselbe Stapel, einmal gerechnet. */
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const rang = playStack(stand.map, kampagne, registry);
    /* **Was nicht aufgeschaltet ist, steht nicht da** (T-207): Ebenen
       ausserhalb des Stapels (und der Vergleichsebenen, wer sie sieht)
       fallen hier heraus — als Zeile, als Name und als Ebene einer Zeile.
       Damit gilt es für Kompendium, Bereiche, Suche, Quellenkürzel und jede
       Auswahl auf einmal; der Zählindex (`unactivated`) bleibt, wie er war. */
    const genannt =
      (stapel === 'inPlay' && !alleEbenen) || stapel === 'compare'
        ? shownLayers(stand.map, kampagne, siehtVergleich(user, kampagne))
        : null;
    /* **Der Vergleichsindex** (T-213): was nur eine Vergleichsebene bringt,
       ein eigener Index neben dem des Spiels — im selben zählten Facetten
       und Summen, was nicht im Spiel ist. Und nur, was **keine geltende
       Fassung im Spiel** hat (`versionGroups`): sonst ist es eine andere
       Fassung derselben Sache, und die vergleicht die Artikelseite. */
    const ohneFassungImSpiel = (gesiebt: Entity[]): Entity[] => {
      if (stapel !== 'compare' || !gesiebt.length) return gesiebt;
      const gruppe = versionGroups(stand.map.values());
      const gespielt = new Set<string>();
      for (const [id, wurzel] of gruppe) {
        const e = stand.map.get(id);
        if (e && rang.inPlay(e)) gespielt.add(wurzel);
      }
      return gesiebt.filter((e) => {
        const w = gruppe.get(e.id);
        return !w || !gespielt.has(w);
      });
    };
    lauf = sieve(request, stand.alle, stand.map, listProjection(registry), stapel).then(async (gesiebt) => {
      const idx = buildListIndex(registry, ohneFassungImSpiel(gesiebt), (e) => rang.rank(stand.map.get(e.id) ?? e), genannt);
      /* Die Namen kennt der Vergleich vom Spiel: seine Ebenen, und wohin
         seine Verweise zeigen, sind Artikel, die dieser Betrachter dort
         sieht — sonst stünde an einer Zeile die Id ihrer Ebene. */
      if (stapel === 'compare') {
        for (const [id, name] of (await indexFor(request)).names) if (!idx.names.has(id)) idx.names.set(id, name);
      }
      return idx;
    });
    indizes.set(key, lauf);
    lauf.catch(() => indizes.delete(key));
    /* Alte Stempel fallen sofort, sonst die ältesten über acht. */
    for (const k of indizes.keys()) {
      if (!k.startsWith(`${stand.stempel}|`)) indizes.delete(k);
    }
    while (indizes.size > 16) indizes.delete(indizes.keys().next().value as string);
    return lauf;
  }

  /**
   * Ein Blatt der Liste (W7): `GET /api/list?area=&type=&of=&ids=&rel=&q=&layer=&nolayer=&parts=&sort=&offset=&limit=&f=`.
   * Antwort `{ total, offset, limit, columns, rows, facets }`. Dieselbe
   * Route sucht für Auswahlen (Kantenziel, Verweis): `of=Art&q=…&limit=20`.
   */
  /**
   * **„Usable by <Figur>"** (T-180): die Figur, wie dieser Betrachter sie
   * sieht — Figur, Statblock, Klassen, Herkunft und was sie gewähren gehen
   * durch dasselbe Sieb wie jede Route. Was ihm verborgen ist, zählt als
   * unbekannt; eine Figur, die er nicht sieht, gibt es nicht.
   */
  async function figurFuer(request: FastifyRequest, id: unknown): Promise<CharacterProfile | undefined> {
    if (typeof id !== 'string' || !id) return undefined;
    const stand = await roh();
    const figur = stand.map.get(id);
    if (!figur) return undefined;
    const ids = new Set([id]);
    const dazu = (x: unknown) => {
      if (typeof x === 'string' && stand.map.has(x)) ids.add(x);
    };
    for (const r of figur.relations ?? []) {
      if (r.type === 'hasClass') {
        dazu(r.to);
        dazu(r.props?.['subclass']);
      } else if (r.type === 'hasAncestry' || r.type === 'hasBackground') dazu(r.to);
    }
    for (const a of antwortenVon(figur)) for (const p of a.picks) dazu(p);
    /* Grundarten (`subraceOf`) und was die Quellen gewähren — zwei Schritte
       reichen für Unterart → Art und Klasse → Merkmal. */
    for (let i = 0; i < 2; i++) {
      for (const x of [...ids]) {
        for (const r of stand.map.get(x)?.relations ?? []) if (r.type === 'subraceOf' || r.type === 'grants') dazu(r.to);
      }
    }
    for (const e of stand.alle) if ((e.relations ?? []).some((r) => r.type === 'belongsTo' && r.to === id)) ids.add(e.id);
    const gesehen = await sieve(request, [...ids].map((x) => stand.map.get(x)!), stand.map);
    const byId = new Map(gesehen.map((e) => [e.id, e]));
    const f = byId.get(id);
    return f ? characterProfile(f, byId) : undefined;
  }

  app.get('/api/list', async (request) => {
    const roh_ = request.query as Record<string, unknown>;
    const idx = await indexFor(request, 'inPlay', (roh_['allLayers'] === '1' || roh_['allLayers'] === 'true') && (await darfAlleEbenen(request)));
    const q = parseListQuery(roh_);
    q.usable = await figurFuer(request, roh_['usable']);
    /* **Unbenutzte Bilder** (T-119, `unused=1`): was kein Artikel zeigt,
       **den dieser Betrachter sieht** — ein Bild, das nur ein verborgener
       NSC trägt, ist für die Spielerin unbenutzt, und „benutzt" verriete
       den NSC. */
    if (roh_['unused'] === '1' || roh_['unused'] === 'true') {
      const genutzt = new Set<string>();
      for (const [asset, uses] of await bilder.verwendung()) {
        if (uses.some((u) => idx.names.has(u.id))) genutzt.add(asset);
      }
      q.exclude = genutzt;
    }
    const blatt = queryList(idx, q);
    /* Eine Auswahl nach Ids fragt nach Bekanntem; dort fehlt nichts. */
    const aus = q.ids?.length ? null : await ausgeblendet(request, q);
    const extra = q.ids?.length ? null : await vergleichsFrage(request, roh_);
    return {
      ...blatt,
      ...(aus ? { unactivated: aus } : {}),
      ...(extra ? { compare: { ...vergleichsZeilen(queryList(extra.idx, { ...q, offset: extra.offset })), canEnable: extra.canEnable } } : {}),
    };
  });

  /**
   * **Was nur eine Vergleichsebene bringt** (T-213, Rest von T-187): mit
   * `compare=1` stehen unter dem Blatt die Artikel der Vergleichsebenen,
   * die nichts im Spiel vertreten — dieselben Filter, ein eigener Index
   * (`indexFor(…, 'compare')`), gesiebt wie jede Liste und nur für wen
   * Vergleichsebenen sieht (`siehtVergleich`). `canEnable`: die Leitung
   * holt sie mit „Enable" einzeln ins Spiel (`PUT /api/campaigns/:c/enabled/:id`).
   * Eigenes Blättern (`compareOffset`): der Vergleich hängt am Ende, nicht
   * zwischen den Zeilen des Spiels.
   */
  async function vergleichsFrage(
    request: FastifyRequest,
    roh_: Record<string, unknown>,
  ): Promise<{ idx: ListIndex; offset: number; canEnable: { campaign: string } | null } | null> {
    if (roh_['compare'] !== '1' && roh_['compare'] !== 'true') return null;
    const [stand, registry, user] = await Promise.all([roh(), repo.getRegistry(), viewerOf(request)]);
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    if (!kampagne || !siehtVergleich(user, kampagne)) return null;
    const offset = Math.max(0, Number.parseInt(String(roh_['compareOffset'] ?? '0'), 10) || 0);
    return {
      idx: await indexFor(request, 'compare'),
      offset,
      canEnable: rechtAn(user, kampagne.id) === 'manage' ? { campaign: kampagne.id } : null,
    };
  }
  /** Ein Blatt des Vergleichs: die Zeilen mit Merkmal und die Zahl, ohne Facetten — die gehören dem Spiel. */
  function vergleichsZeilen<R extends { total: number; offset: number; limit: number; rows: object[] }>(
    blatt: R,
  ): { total: number; offset: number; limit: number; rows: (R['rows'][number] & { notInPlay: true })[] } {
    return {
      total: blatt.total,
      offset: blatt.offset,
      limit: blatt.limit,
      rows: blatt.rows.map((z) => ({ ...(z as R['rows'][number]), notInPlay: true as const })),
    };
  }

  /**
   * **Die übergreifende Suche** (T-138): `GET /api/search?q=&type=&layer=&publisher=&area=&offset=&limit=&f=&usable=`.
   * Mit einer gewählten Art filtern dieselben Facetten wie im Kompendium (`f`, T-180).
   * Derselbe gesiebte Index wie `/api/list` — was dieser Betrachter nicht
   * sieht, findet er nicht —, nach Nähe geordnet und mit einem Filter nach
   * Herausgeber. Beim Tippen fragt die Seite hier; ohne `q` antwortet sie
   * leer, eine Suche nach nichts ist keine Liste aller Artikel.
   */
  const verlage = new WeakMap<Map<string, Entity>, Map<string, string>>();
  app.get('/api/search', async (request) => {
    const roh_ = request.query as Record<string, unknown>;
    const q = parseListQuery(roh_);
    q.limit = Math.min(q.limit, 50);
    const text = q.q?.trim() ?? '';
    if (!text) return { q: '', total: 0, offset: 0, limit: q.limit, rows: [], facets: { types: [], layers: [], publishers: [], fields: [] } };
    const [stand, idx] = await Promise.all([roh(), indexFor(request)]);
    q.usable = await figurFuer(request, roh_['usable']);
    /* Herausgeber je Ebene, einmal je Stand (T-094, T-109). */
    let verlag = verlage.get(stand.map);
    if (!verlag) {
      verlag = new Map();
      const eigene = eigeneEbenen(stand.map);
      for (const e of stand.map.values()) {
        if ((e.interfaces ?? [])[0] === 'Layer') verlag.set(e.id, publisherOf(stand.map, e, eigene));
      }
      verlage.set(stand.map, verlag);
    }
    const publisher = typeof roh_['publisher'] === 'string' && roh_['publisher']
      ? roh_['publisher'].split(',').map((x) => x.trim()).filter(Boolean)
      : undefined;
    const v = verlag;
    /* Nur Ebenen, die dieser Betrachter sieht: der Index kennt ihren Namen. */
    const treffer = search(idx, q, publisher, (l) => (idx.names.has(l) ? (v.get(l) ?? '') : ''));
    /* Mit `compare=1` dazu die Treffer aus Vergleichsebenen (T-213). */
    const extra = await vergleichsFrage(request, roh_);
    if (!extra) return treffer;
    const x = extra.idx;
    const vergleich = search(x, { ...q, offset: extra.offset }, publisher, (l) => (x.names.has(l) ? (v.get(l) ?? '') : ''));
    return { ...treffer, compare: { ...vergleichsZeilen(vergleich), canEnable: extra.canEnable } };
  });

  /**
   * **Die Quellenkürzel und ihre Bücher** (T-088, REQ-245): Kürzel → voller
   * Titel, aus `Layer.abbreviation` der Ebenen, die dieser Betrachter
   * sieht. Die Seite zeigt damit an jedem „XGE" den Titel — beim
   * Darüberfahren, auf dem Telefon beim Antippen.
   */
  app.get('/api/sources', async (request) => {
    const [stand, idx] = await Promise.all([roh(), indexFor(request)]);
    const out: Record<string, string> = {};
    /* Je Kürzel auch der Herausgeber (T-094) — die Marke in Listen und Vorschau. */
    const verlag: Record<string, string> = {};
    const eigene = eigeneEbenen(stand.map);
    for (const e of stand.map.values()) {
      if ((e.interfaces ?? [])[0] !== 'Layer') continue;
      const k = (e.components?.['Layer'] as { abbreviation?: unknown } | undefined)?.abbreviation;
      const name = idx.names.get(e.id);
      if (typeof k !== 'string' || !k.trim() || !name) continue;
      if (out[k.trim()] !== undefined) continue;
      out[k.trim()] = name;
      verlag[k.trim()] = publisherOf(stand.map, e, eigene);
    }
    return { sources: out, publishers: verlag };
  });

  /**
   * **Was fehlt, weil seine Ebene nicht aufgeschaltet ist** (T-069) — mit
   * denselben Filtern wie das Blatt gezählt. Auf dev verschwanden nach dem
   * Anlegen einer Kampagne alle 5e.tools-Artikel, und die Seite sagte nicht
   * warum; nichts war gelöscht. Gezählt wird nur, was dieser Betrachter
   * nach dem Aufschalten sähe (gesiebt wie sonst).
   *
   * **Eine Zahl und kein Verzeichnis** (T-207): welche Ebenen das sind,
   * steht auf der Kampagnenseite, und nur dort wird ein- und
   * ausgeschaltet. Eine Liste je Seite war die Ebene, die nirgends
   * aufgeschaltet ist und trotzdem überall genannt wurde. `canManage`
   * sagt, ob dieser Betrachter dort schaltet.
   */
  async function ausgeblendet(
    request: FastifyRequest,
    q: ReturnType<typeof parseListQuery>,
  ): Promise<{ campaign: { id: string; name: string }; total: number; canManage: boolean } | null> {
    const [stand, registry, user] = await Promise.all([roh(), repo.getRegistry(), viewerOf(request)]);
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    if (!kampagne) return null;
    const aus = queryList(await indexFor(request, 'unactivated'), {
      ...q,
      layer: undefined,
      nolayer: undefined,
      offset: 0,
      limit: 1,
    });
    if (!aus.total) return null;
    return {
      campaign: { id: kampagne.id, name: entityName(kampagne) },
      total: aus.total,
      canManage: rechtAn(user, kampagne.id) === 'manage',
    };
  }

  /**
   * Die Kandidaten eines Verweises `[[ziel]]`, gesiebt: was dieser Betrachter
   * nicht sehen darf, ist kein Ziel — sonst verriete ein Verweis, dass es
   * den Artikel gibt. Dieselbe Regel wie `linkCandidates` (M11), nur über
   * die Nachschlagetafel statt über den ganzen Bestand.
   */
  /**
   * **Die Fassung, die in der laufenden Kampagne gilt** (E2, E-018):
   * ersetzt eine aufgeschaltete Ebene den Artikel über `overrides`, die
   * Fassung, sonst er selbst. Gesiebt wird danach wie immer.
   */
  async function geltend(e: Entity, map: Map<string, Entity>): Promise<Entity> {
    /* Ist `map` der Stand, den wir halten, fragt niemand die Datenbank nach
       dem Stempel — eine Kapitelseite fragt hier für jeden Verweis darin,
       und je Frage ein `count(*)` über 150 000 Artikel waren drei Sekunden. */
    const stand = rohStand?.map === map ? rohStand : await roh();
    /* **Eine Karte oder Begegnung im Spiel** (T-289) kommt aufgelöst: die
       Tischrouten (Kontext, Kampfstart, Zugplan, Türen) lesen Marker und
       Teilnehmer der Vorlage mit; geschrieben wird ausgedünnt
       (`schreibeGeprueft`). */
    if (!stand.ersetzt.has(e.id)) return resolvePlay(map, e);
    const registry = await repo.getRegistry();
    const kampagne = kampagneIn(map, registry.settings ?? null);
    if (!kampagne) return e;
    /* Aus dem Bestand dieses Stempels: der Stapel ist gerechnet, die
       Überschreiber sind gezählt (T-108). Ein anderer Bestand fragt wie bisher. */
    if (map === stand.map) return stapelFuer(map, kampagne, registry).resolve(e, stand.ueberschreiber);
    return resolveArticle(map, e, kampagne);
  }

  async function kandidaten(request: FastifyRequest, ziele: Iterable<string>): Promise<Map<string, Entity[]>> {
    const stand = await roh();
    const ziel = [...new Set([...ziele].map((t) => t.trim()).filter(Boolean))];
    const sammel = new Map<string, Entity>();
    for (const t of ziel) for (const e of stand.namen.get(t.toLowerCase()) ?? []) sammel.set(e.id, e);
    /* Ein Treffer, den eine Fassung ersetzt, ist die Fassung (E-018): erst
       gegen das Original suchen — die Nummer im Text ist seine —, dann
       umleiten und sieben. */
    const gilt = new Map<string, Entity>();
    for (const e of sammel.values()) gilt.set(e.id, await geltend(e, stand.map));
    const ausgeliefert = gilt.size ? await sieve(request, [...new Map([...gilt.values()].map((e) => [e.id, e])).values()], stand.map) : [];
    const sichtbar = new Map(ausgeliefert.map((e) => [e.id, e]));
    const raus = new Map<string, Entity[]>();
    for (const t of ziel) {
      const treffer = linkCandidates([...sammel.values()], t)
        .map((e) => sichtbar.get(gilt.get(e.id)?.id ?? e.id))
        .filter((e): e is Entity => !!e);
      raus.set(t, [...new Map(treffer.map((e) => [e.id, e])).values()]);
    }
    return raus;
  }

  const VERWEIS = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  function verweiseIn(wert: unknown, raus: Set<string>): void {
    if (typeof wert === 'string') {
      if (!wert.includes('[[')) return;
      for (const m of wert.matchAll(VERWEIS)) raus.add((m[1] ?? '').trim());
    } else if (Array.isArray(wert)) {
      for (const w of wert) verweiseIn(w, raus);
    } else if (wert && typeof wert === 'object') {
      for (const w of Object.values(wert)) verweiseIn(w, raus);
    }
  }

  /**
   * Was ein geöffneter Artikel an Namen braucht, ohne dass der Browser den
   * Bestand hält (W7): die Ziele seiner Kanten, Verweisfelder und
   * Sichtbarkeitslisten (`names`) und die Treffer jedes `[[…]]` in seinen
   * Texten (`links`). Gerechnet beim Ausliefern, **nie gespeichert** — ein
   * Name von gestern wäre heute falsch.
   */
  /**
   * **Womit an diesem Rezept gefertigt wird** (T-122): für die laufende
   * Kampagne und für jede eigene Figur — `craftCheck` mit der Herkunft
   * jedes Werts, die Träger beim Namen. Nur an Rezepten.
   */
  async function fertigungswert(
    request: FastifyRequest,
    e: Entity,
    map: Map<string, Entity>,
  ): Promise<{ table: unknown; mine: unknown[] } | null> {
    const registry = await repo.getRegistry();
    if (!typeChain(registry, primaryInterface(e)).includes(RECIPE_COMPONENT)) return null;
    const get = (id: string) => map.get(id);
    const campaign = currentCampaign(map, registry.settings ?? null);
    const benannt = (c: CraftCheck) => {
      const quelle = (q: CraftSource) => (q.holder ? { ...q, name: entityName(map.get(q.holder)) } : q);
      return { ...c, source: { tool: quelle(c.source.tool), ability: quelle(c.source.ability), dc: quelle(c.source.dc) } };
    };
    const user = await viewerOf(request);
    const figuren = (user?.actorIds ?? []).map((id) => map.get(id)).filter((x): x is Entity => !!x);
    return {
      table: benannt(craftCheck(e, { get, campaign })),
      mine: figuren.map((f) => ({ id: f.id, name: entityName(f), check: benannt(craftCheck(e, { get, campaign, actor: f })) })),
    };
  }

  /**
   * **Was ein Laden führt, und zu welchem Preis** (T-129): am Tisch (Laden
   * und Ware) und für jede eigene Figur (dazu ihre Rabatte). Gerechnet beim
   * Lesen (D8) über den ganzen Stand — ein Rabatt der Gilde gilt auch, wenn
   * jemand die Gilde nicht aufschlagen darf —, gezeigt wird aber nur, was
   * dieser Betrachter sieht: die Waren aus dem gesiebten Laden und davon
   * die sichtbaren Gegenstände; ein Geber, den er nicht sieht, bleibt ohne
   * Namen.
   */
  async function ladenwaren(
    request: FastifyRequest,
    e: Entity,
    map: Map<string, Entity>,
  ): Promise<{ table: unknown[]; mine: unknown[] } | null> {
    const registry = await repo.getRegistry();
    if (!typeChain(registry, primaryInterface(e)).includes(SHOP_TYPE)) return null;
    /* Gerechnet wird in der Preissicht (T-139): jede Ware mit dem Preis
       ihrer geltenden Fassung, etwa aus „AI generated prices". */
    const kampagne = currentCampaign(map, registry.settings ?? null);
    const roherStand = map;
    map = withVersionPrices(map, kampagne, registry);
    const verkauft = (e.relations ?? []).filter((r) => r.type === 'sells').map((r) => map.get(r.to)).filter((x): x is Entity => !!x);
    const user = await viewerOf(request);
    const figuren = (user?.actorIds ?? []).map((id) => map.get(id)).filter((x): x is Entity => !!x);
    const genannt = new Set<string>();
    for (const r of [...(e.relations ?? []), ...figuren.flatMap((f) => f.relations ?? [])]) genannt.add(r.to);
    for (const x of map.values()) if ((x.relations ?? []).some((r) => r.type === 'controls' && r.to === e.id)) genannt.add(x.id);
    /* Was die eigenen Figuren verkaufen könnten, muss der Betrachter sehen dürfen (T-133). */
    for (const f of figuren) for (const inv of inventareDerFigur(f, map)) for (const r of map.get(inv)?.relations ?? []) if (r.type === 'holds') genannt.add(r.to);
    const kandidaten = [...new Set([...verkauft, ...[...genannt].map((i) => map.get(i)).filter((x): x is Entity => !!x)])];
    /* Ein Original, das eine Fassung ersetzt, steht nicht im Spiel — gesiebt
       wird darum die geltende Fassung, gezeigt das Original, auf das die
       Kante zeigt (T-139). */
    const index = overridersIndex(roherStand.values());
    const geltend = (x: Entity) => resolveArticle(roherStand, x, kampagne, registry, index);
    const gesiebt = new Set((await sieve(request, kandidaten.map(geltend), roherStand)).map((x) => x.id));
    const sichtbar = new Set(kandidaten.filter((x) => gesiebt.has(geltend(x).id)).map((x) => x.id));
    const name = (id?: string) => (id && sichtbar.has(id) ? entityName(map.get(id)) : undefined);
    const benannt = (w: WareOffer[]) =>
      w
        .filter((x) => sichtbar.has(x.item))
        .map((x) => ({
          ...x,
          steps: x.steps.map((st) => {
            const g = name(st.giver);
            const t = name(st.target);
            return { ...st, ...(g ? { giverName: g } : {}), ...(t ? { targetName: t } : {}) };
          }),
        }));
    return {
      table: benannt(shopWares(e, { entities: map })),
      mine: figuren.map((f) => ({ id: f.id, name: entityName(f), ...geldbeutel(f), wares: benannt(shopWares(e, { entities: map, buyer: f })) })),
    };

    /**
     * Was die Figur hat (T-133): ihr Geld (`Inventory.copper` am Inventar,
     * das sie trägt) und was sie diesem Laden verkaufen kann — die freien
     * Stücke aus ihrem Inventar und den Behältern darin, mit dem
     * Ankaufspreis (`buybackPrice`, E-045). Reserviertes fehlt (T-128).
     */
    function geldbeutel(f: Entity) {
      const invId = (f.relations ?? []).find((r) => r.type === 'carries')?.to;
      if (!invId) return {};
      const purse = Math.max(0, Math.trunc(Number(map.get(invId)?.components?.['Inventory']?.['copper']) || 0));
      const sellable = inventareDerFigur(f, map).flatMap((inv) =>
        (map.get(inv)?.relations ?? [])
          .filter((r) => r.type === 'holds' && !reservedFor(r) && sichtbar.has(r.to))
          .map((r) => ({
            inventory: inv,
            edge: r.id,
            item: r.to,
            name: map.get(r.to) ? pieceName(map, map.get(r.to)!) : entityName(undefined),
            qty: Math.max(1, Math.trunc(Number(r.props?.['qty']) || 1)),
            ...(buybackPrice(map.get(r.to), map) !== undefined ? { price: buybackPrice(map.get(r.to), map) } : {}),
          })),
      );
      return { inventory: invId, purse, sellable };
    }
  }

  /**
   * **Die Bilder eines Artikels** (T-211): `image` ist, was er als sein
   * Bild zeigt (`articleImage` — an einer Kreatur ohne eigenes das ihres
   * Statblocks), `assets` die Version jeder Bilddatei, die er nennt. Mit
   * der Version in der Adresse darf der Browser ein Bild behalten; ohne
   * fragt er bei jedem Öffnen neu. Nur, was der Betrachter sieht — ein
   * verborgenes Bild hat für ihn keine Version und kein Ziel.
   */
  async function bilderVon(
    request: FastifyRequest,
    e: Entity,
  ): Promise<{
    image?: { id: string; version?: string; from?: string };
    assets?: Record<string, string>;
    token?: { statblock: string; changeable: boolean; id?: string; version?: string; from?: string; look?: TokenLook; adjustable?: boolean };
  }> {
    const registry = await repo.getRegistry();
    const stand = await roh();
    const bild = articleImage(registry, e, stand.map, (id) => statblocksOf(stand.alle, id));
    /* **Das Token** (T-297): am Statblock sein eigenes, an der Kreatur das
       ihres Statblocks — beide durch die Vorlage gelesen. Mit seinem
       Aussehen (`tokenLook`) und ob dieser Betrachter es einstellen darf:
       eingestellt wird am Bild, also schreibt, wer das Bild schreibt. */
    const kette = typeChain(registry, primaryInterface(e));
    const boegen = kette.includes('Statblock') ? [{ sb: e, from: undefined }] : kette.includes('Creature') ? statblocksOf(stand.alle, e.id).map((sb) => ({ sb, from: sb.id })) : [];
    let tok: { id: string; from?: string } | null = null;
    for (const { sb, from } of boegen) {
      const t = (resolveInstance(stand.map, sb).components?.['Statblock'] as { token?: unknown } | undefined)?.token;
      if (typeof t === 'string' && t.trim() && stand.map.has(t.trim())) {
        tok = { id: t.trim(), ...(from ? { from } : {}) };
        break;
      }
    }
    const ids = new Set<string>();
    for (const [typ, karte] of Object.entries(e.components ?? {})) {
      const props = registry.interfaces[typ]?.schema?.properties ?? {};
      for (const [k, v] of Object.entries(karte ?? {})) {
        if (props[k]?.format !== 'asset') continue;
        for (const w of Array.isArray(v) ? v : [v]) if (typeof w === 'string' && w && stand.map.has(w)) ids.add(w);
      }
    }
    const fremd = bild && !/^https?:\/\//i.test(bild.id) ? bild.id : null;
    if (fremd && stand.map.has(fremd)) ids.add(fremd);
    if (tok) ids.add(tok.id);
    const gesehen = new Set(
      ids.size ? (await sieve(request, [...ids].map((i) => stand.map.get(i)!), stand.map)).map((x) => x.id) : [],
    );
    const assets: Record<string, string> = {};
    for (const i of gesehen) {
      const v = assetVersion(stand.map.get(i));
      if (v) assets[i] = v;
    }
    const raus: Awaited<ReturnType<typeof bilderVon>> = {};
    if (bild && (!fremd || gesehen.has(fremd))) {
      raus.image = { id: bild.id, ...(assets[bild.id] ? { version: assets[bild.id] } : {}), ...(bild.from ? { from: bild.from } : {}) };
    }
    if (Object.keys(assets).length) raus.assets = assets;
    /* Welcher Statblock das Token trägt, und ob dieser Betrachter dort ein
       anderes Bild setzen darf (T-301: „Change image" schreibt
       `Statblock.token`). Ohne Token wird es nur genannt, wo man eins setzen
       darf — sonst zeichnet das Element nichts. */
    const traeger = boegen.find((b) => (tok?.from ? b.sb.id === tok.from : true))?.sb;
    if (traeger) {
      const user = await viewerOf(request);
      const besitz = user ? await ownedBy(user) : undefined;
      const changeable = !!user && mayWrite(user, besitz!, traeger.id);
      if (tok && gesehen.has(tok.id)) {
        raus.token = {
          statblock: traeger.id,
          changeable,
          ...tok,
          ...(assets[tok.id] ? { version: assets[tok.id] } : {}),
          look: tokenLook(stand.map.get(tok.id)),
          adjustable: !!user && mayWrite(user, besitz!, tok.id),
        };
      } else if (!tok && changeable) {
        raus.token = { statblock: traeger.id, changeable };
      }
    }
    return raus;
  }

  async function bezuegeVon(
    request: FastifyRequest,
    e: Entity,
  ): Promise<{ names: Record<string, string>; links: Record<string, { id: string; name: string }[]> }> {
    const registry = await repo.getRegistry();
    const stand = await roh();
    /* Die Ebenen eines Artikels nur, soweit die Kampagne sie aufschaltet
       oder vergleicht (T-207) — „PHB · Ein Buch, das niemand aufschaltet"
       wäre die Ebene, die nirgends sonst steht. */
    const kampagne = kampagneIn(stand.map, registry.settings ?? null);
    const genannt = shownLayers(stand.map, kampagne, siehtVergleich(await viewerOf(request), kampagne));
    const ids = new Set<string>();
    for (const r of e.relations ?? []) {
      if (!r.to) continue;
      if (r.type === LAYER_RELATION && genannt && !genannt.has(r.to)) continue;
      ids.add(r.to);
    }
    for (const [typ, karte] of Object.entries(e.components ?? {})) {
      const props = registry.interfaces[typ]?.schema?.properties ?? {};
      for (const [k, v] of Object.entries(karte ?? {})) {
        const istVerweis = props[k]?.format === 'link' || (typ === 'Visibility' && k !== 'audience');
        if (!istVerweis) continue;
        for (const w of Array.isArray(v) ? v : [v]) if (typeof w === 'string' && w) ids.add(w);
      }
    }
    /* Ein Ziel, das eine Fassung ersetzt (E-018), heisst wie die Fassung —
       der Verweis führt dorthin (`GET /api/entities/:id`). */
    const paare = await Promise.all(
      [...ids].map(async (i) => {
        const z = stand.map.get(i);
        return z ? ([i, await geltend(z, stand.map)] as const) : undefined;
      }),
    );
    const ziele = paare.filter((x): x is readonly [string, Entity] => !!x);
    const names: Record<string, string> = {};
    const gesiebt = new Set((ziele.length ? await sieve(request, ziele.map(([, z]) => z), stand.map) : []).map((z) => z.id));
    /* Ein Stück mit Enhancements heisst, wie es gerechnet wird (T-300). */
    for (const [i, z] of ziele) if (gesiebt.has(z.id)) names[i] = (z.relations ?? []).some((r) => r.type === ENCHANTED_RELATION) ? pieceName(stand.map, z) : entityName(z);
    const texte = new Set<string>();
    verweiseIn(e.components, texte);
    const links: Record<string, { id: string; name: string }[]> = {};
    for (const [t, treffer] of await kandidaten(request, texte)) {
      links[t] = treffer.map((x) => ({ id: x.id, name: entityName(x) }));
    }
    return { names, links };
  }

  /**
   * `[[Name]]` wird beim Speichern zur Nummer (M11) — über das, was der
   * Schreibende sehen darf. `{ texts }` → `{ texts, open }`: die Texte mit
   * Ids, und welche Verweise nichts oder mehreres trafen.
   */
  app.post<{ Body: { texts?: unknown } }>('/api/links', async (request, reply) => {
    const texts = request.body?.texts;
    if (!Array.isArray(texts) || texts.some((t) => typeof t !== 'string')) {
      return reply.code(400).send({ error: 'texts: eine Liste von Texten' });
    }
    const ziele = new Set<string>();
    for (const t of texts as string[]) verweiseIn(t, ziele);
    const treffer = await kandidaten(request, ziele);
    const pool = new Map<string, Entity>();
    for (const l of treffer.values()) for (const e of l) pool.set(e.id, e);
    const open = new Set<string>();
    const raus = (texts as string[]).map((t) => {
      const r = idLinks(t, pool.values());
      r.open.forEach((o) => open.add(o));
      return r.text;
    });
    return { texts: raus, open: [...open] };
  });

  /**
   * **Die Fassungen eines Artikels** (T-092, E-021 d): was über `variantOf`
   * oder `overrides` dieselbe Sache ist (`versionsOf`), aus Spiel- und —
   * wer sie sehen darf — Vergleichsebenen, gesiebt wie jeder Artikel. Die
   * Seite vergleicht selbst (`versionDiff`); hier steht, woher jede Fassung
   * kommt, ob sie im Spiel ist und ob die Leitung sie als Überschreibung
   * übernehmen kann (`adoptable`) oder schon übernommen hat (`adoptedAs`).
   *
   * Ein Gang über den Bestand je Anfrage (`versionsOf`), der Stapel einmal
   * (`playStack`) — nie jeder Artikel gegen jeden (T-086).
   */
  app.get<{ Params: { id: string } }>('/api/entities/:id/versions', async (request, reply) => {
    const stand = await roh();
    const basis = stand.map.get(request.params.id);
    const sichtbar = basis
      ? (await sieve(request, [basis], stand.map)).length ||
        (await sieve(request, [basis], stand.map, undefined, 'compare')).length
      : 0;
    if (!basis || !sichtbar) return reply.code(404).send({ error: 'Nicht gefunden' });
    const registry = await repo.getRegistry();
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const sicht = playStack(stand.map, kampagne, registry);
    const roheFassungen = versionsOf(stand.map, basis.id);
    const gesiebt = roheFassungen.length
      ? await sieve(request, roheFassungen, stand.map, undefined, 'versions')
      : [];
    const user = await viewerOf(request);
    const eigene = kampagne && rechtAn(user, kampagne.id) === 'manage' ? await kampagnenEbene(stand.map, kampagne) : null;
    const vergleichsIds = new Set(compareLayers(stand.map, kampagne).map((l) => l.id));
    const imSpiel = activeLayerRanks(stand.map, kampagne);
    /* Übernommen ist eine Fassung, wenn eine Kopie in der Kampagnenebene
       mit `variantOf` auf sie zeigt und etwas überschreibt (`adopt`). */
    const kopieVon = new Map<string, string>();
    if (eigene) {
      for (const e of [basis, ...roheFassungen]) {
        if (!istUebernahme(e, eigene.id)) continue;
        const von = (e.relations ?? []).find((r) => r.type === VARIANT_RELATION)?.to;
        if (von) kopieVon.set(von, e.id);
      }
    }
    const basisImSpiel = sicht.inPlay(basis);
    /* Genannt werden nur Spiel- und Vergleichsebenen (T-207): liegt der
       Artikel auch in einem Buch, das die Kampagne nicht aufschaltet, steht
       es hier nicht. */
    const genannt = shownLayers(stand.map, kampagne, siehtVergleich(user, kampagne));
    const ebenenIds = new Set(layersOf(basis));
    const versions = gesiebt.map((v) => {
      const r = stand.map.get(v.id) ?? v;
      for (const l of layersOf(r)) ebenenIds.add(l);
      const compare = !sicht.inStack(r) && sicht.inCompare(r);
      const adoptedAs = kopieVon.get(v.id);
      return {
        entity: v,
        layers: layersOf(r).filter((id) => !genannt || genannt.has(id)),
        play: sicht.inPlay(r),
        compare,
        ...(adoptedAs ? { adoptedAs } : {}),
        adoptable: !!eigene && compare && !adoptedAs && basisImSpiel,
      };
    });
    const ebenen = await sieve(
      request,
      [...ebenenIds]
        .filter((id) => !genannt || genannt.has(id))
        .map((id) => stand.map.get(id))
        .filter((e): e is Entity => !!e),
      stand.map,
    );
    return {
      layers: ebenen.map((l) => ({
        id: l.id,
        name: entityName(l),
        short: layerShort(l),
        compare: vergleichsIds.has(l.id),
        play: imSpiel.has(l.id),
        /* Der Platz im Stapel (T-173): die Fassung aus der obersten Ebene
           steht in Listen und Verweisen — die Seite sagt, welche das ist. */
        ...(imSpiel.has(l.id) ? { rank: imSpiel.get(l.id) } : {}),
      })),
      versions,
      ...(kampagne ? { campaign: { id: kampagne.id, name: entityName(kampagne) } } : {}),
    };
  });

  /**
   * **Einzeln freigeben am Artikel** (T-187): ein Artikel aus einer
   * Vergleichsebene bekommt `refs.enable` — die Leitung holt ihn mit einem
   * Klick als Extra-Inhalt ins Spiel —, ein freigegebener `refs.enabled`,
   * damit dieselbe Stelle es zurücknimmt. Nur für die Leitung der
   * laufenden Kampagne; alle anderen sehen ihn wie jeden Artikel.
   */
  async function freigabeAm(
    request: FastifyRequest,
    entity: Entity,
    map: Map<string, Entity>,
    vergleich: boolean,
  ): Promise<{ enable?: { campaign: string }; enabled?: { campaign: string } } | null> {
    const registry = await repo.getRegistry();
    const kampagne = currentCampaign(map, registry.settings ?? null);
    if (!kampagne || rechtAn(await viewerOf(request), kampagne.id) !== 'manage') return null;
    if (enabledArticles(kampagne).has(entity.id)) return { enabled: { campaign: kampagne.id } };
    return vergleich ? { enable: { campaign: kampagne.id } } : null;
  }

  /** Ist dieser Artikel eine übernommene Fassung in dieser Ebene (T-092)? */
  function istUebernahme(e: Entity, ebene: string): boolean {
    const rs = e.relations ?? [];
    return (
      rs.some((r) => r.type === LAYER_RELATION && r.to === ebene) &&
      rs.some((r) => r.type === OVERRIDES_RELATION) &&
      rs.some((r) => r.type === VARIANT_RELATION)
    );
  }

  /**
   * **Eine Fassung als Überschreibung übernehmen** (T-092, E-021 d):
   * „use this in my campaign" an einer Fassung aus einer Vergleichsebene.
   * Es entsteht eine **Kopie** in der Ebene der Kampagne (`campaignLayer`)
   * mit `overrides` auf die Fassung, die gerade gilt, und `variantOf` auf
   * die übernommene — die Herkunft. Eine Kopie und keine Kante an der
   * Fassung selbst: die liegt in einer geteilten Ebene, und eine
   * Überschreibung dort gälte in jeder Kampagne, die das Buch aufschaltet.
   * Die Kopie trägt den Namen der Fassung, die sie ersetzt, damit Verweise
   * und Suche dasselbe finden.
   *
   * Nur die Leitung (`rechtAn` = `manage`), nur in der laufenden Kampagne.
   */
  app.post<{ Params: { c: string }; Body: { version?: unknown; over?: unknown } }>(
    '/api/campaigns/:c/adopt',
    async (request, reply) => {
      const user = await viewerOf(request);
      const c = request.params.c;
      if (rechtAn(user, c) !== 'manage') return reply.code(403).send({ error: 'Übernehmen darf die Leitung.' });
      const stand = await roh();
      const registry = await repo.getRegistry();
      const kampagne = currentCampaign(stand.map, registry.settings ?? null);
      if (!kampagne || kampagne.id !== c) {
        return reply.code(409).send({ error: 'Übernehmen geht nur in der laufenden Kampagne.' });
      }
      const ebene = await kampagnenEbene(stand.map, kampagne);
      if (!ebene) {
        return reply.code(409).send({ error: 'Diese Kampagne hat keine eigene Ebene, in die eine Überschreibung käme.' });
      }
      const quelle = stand.map.get(String(request.body?.version ?? ''));
      const ueber = stand.map.get(String(request.body?.over ?? ''));
      if (!quelle || !ueber) return reply.code(404).send({ error: 'Nicht gefunden' });
      const sicht = playStack(stand.map, kampagne, registry);
      if (!sicht.inPlay(ueber)) return reply.code(409).send({ error: 'Überschrieben wird, was gerade gilt.' });
      if (sicht.inStack(quelle) || !sicht.inCompare(quelle)) {
        return reply.code(409).send({ error: 'Übernommen wird eine Fassung aus einer Vergleichsebene.' });
      }
      if (!versionsOf(stand.map, ueber.id).some((v) => v.id === quelle.id)) {
        return reply.code(409).send({ error: 'Das ist keine Fassung derselben Sache.' });
      }
      const type = quelle.interfaces?.[0] ?? '';
      const neueId = (): string => `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      let id = neueId();
      while (stand.map.has(id)) id = neueId();
      const name = entityName(ueber);
      const components = structuredClone(quelle.components ?? {});
      components['Identity'] = { ...(components['Identity'] ?? {}), name, id: nextId(stand.alle, type) };
      const STRUKTUR = new Set([LAYER_RELATION, OVERRIDES_RELATION, VARIANT_RELATION]);
      const relations: NonNullable<Entity['relations']> = [
        ...(quelle.relations ?? [])
          .filter((r) => !STRUKTUR.has(r.type))
          .map((r, i) => ({ ...structuredClone(r), id: `${id}~${r.type}-${i + 1}` })),
        { id: `${id}~inLayer-1`, type: LAYER_RELATION, to: ebene.id, props: {} },
        { id: `${id}~overrides-1`, type: OVERRIDES_RELATION, to: ueber.id, props: {} },
        { id: `${id}~variantOf-1`, type: VARIANT_RELATION, to: quelle.id, props: {} },
      ];
      const kopie: Entity = { id, interfaces: [...(quelle.interfaces ?? [])], name, components, relations };
      const known = new Map(stand.alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
      known.set(id, type);
      const issues = validateEntity(registry, kopie, { knownTypes: known });
      if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
      const stored = await repo.putEntity(kopie);
      await repo.appendEvent('version.adopted', id, { version: quelle.id, over: ueber.id, campaign: c, by: user?.id });
      return reply.code(201).send(stored);
    },
  );

  /** **Rückgängig** (T-092): die übernommene Kopie geht wieder; es gilt,
   *  was vorher galt. Nur eine Kopie, die `adopt` angelegt haben könnte. */
  app.delete<{ Params: { c: string; id: string } }>('/api/campaigns/:c/adopt/:id', async (request, reply) => {
    const user = await viewerOf(request);
    const c = request.params.c;
    if (rechtAn(user, c) !== 'manage') return reply.code(403).send({ error: 'Rückgängig macht die Leitung.' });
    const stand = await roh();
    const kampagne = stand.map.get(c);
    const ebene = kampagne ? await kampagnenEbene(stand.map, kampagne) : null;
    const kopie = stand.map.get(request.params.id);
    if (!kopie || !ebene || !istUebernahme(kopie, ebene.id)) {
      return reply.code(404).send({ error: 'Keine übernommene Fassung dieser Kampagne.' });
    }
    const ueber = (kopie.relations ?? []).find((r) => r.type === OVERRIDES_RELATION)?.to;
    await repo.dropReadyStand(kopie.id);
    await repo.deleteEntity(kopie.id);
    await repo.appendEvent('version.dropped', kopie.id, { campaign: c, by: user?.id });
    return { ok: true, over: ueber };
  });

  /**
   * **Einstellungen je Konto** (T-092): `GET` alle, `PUT …/:key` eine
   * (`{ value }`, `null` nimmt sie weg). Was die Seite sich merkt — ob die
   * Fassungen an den Feldern stehen und welche Ebenen —, gilt auf jedem
   * Gerät desselben Kontos.
   */
  app.get('/api/me/prefs', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    return repo.getPrefs(user.id);
  });
  app.put<{ Params: { key: string }; Body: { value?: unknown } }>('/api/me/prefs/:key', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const key = request.params.key;
    if (!/^[a-z][a-zA-Z0-9.-]{0,63}$/.test(key)) return reply.code(400).send({ error: 'Unbekannter Schlüssel.' });
    /* Die Schreibebene prüft der Server gegen die Zielebenen (T-161). */
    if (key === WRITE_LAYER_PREF) return reply.code(400).send({ error: 'Die Schreibebene setzt PUT /api/layers/write oder PUT /api/layers/:layer/default.' });
    /* Gespeicherte Ebenenauswahlen prüft ihre eigene Route (T-186). */
    if (key === LAYER_SETS_PREF) return reply.code(400).send({ error: 'Ebenenauswahlen speichert POST /api/me/layer-sets.' });
    const value = request.body?.value ?? null;
    if (JSON.stringify(value).length > 8000) return reply.code(400).send({ error: 'Zu gross.' });
    await repo.putPref(user.id, key, value);
    return { ok: true };
  });

  /**
   * Wer auf diesen Artikel zeigt. Die Gegenrichtung ist eine Abfrage (K1);
   * gestellt wurde sie bisher in der Oberfläche, über den ganzen Bestand —
   * den hat sie jetzt nicht mehr. Gefragt wird nur unter dem, was der
   * Betrachter sehen darf: eine Kante von einem verborgenen Artikel verriete
   * ihn.
   */
  app.get<{ Params: { id: string } }>('/api/entities/:id/backlinks', async (request, reply) => {
    const stand = await roh();
    const gefunden = stand.map.get(request.params.id);
    const ziel = gefunden ? await geltend(gefunden, stand.map) : undefined;
    /* Auch eine Fassung aus einer Vergleichsebene hat Rückbezüge (T-092). */
    const sichtbar =
      ziel &&
      ((await sieve(request, [ziel], stand.map)).length ||
        (await sieve(request, [ziel], stand.map, undefined, 'compare')).length);
    if (!ziel || !sichtbar) {
      return reply.code(404).send({ error: 'Nicht gefunden' });
    }
    /* Eine Fassung (E-018) sammelt auch, was aufs Original zeigt: die
       Szenen eines angepassten Kapitels hängen weiter am Original. Ihre
       eigene Kante `overrides` zählt nicht. */
    const auch = new Set([ziel.id, ...replacedIds(stand.map, ziel)]);
    /* Gesiebt wird nur, wer überhaupt auf ihn zeigt — nicht der ganze
       Bestand (W7: für einen Spieler eine halbe Sekunde je Artikelseite).
       Das Sieb nimmt Kanten nur weg, nie dazu; die Antwort ist dieselbe. */
    /* Die Teile eines Kapitels zeigt das Element `parts` (T-108) — in
       „Linked here" stünden sonst hundert Absätze unter „contains". */
    const zeigen = stand.alle
      .filter((e) => e.id !== ziel.id && !isBookPart(e) && (e.relations ?? []).some((r) => auch.has(r.to)))
      .map((e) => (auch.size > 1 ? { ...e, relations: (e.relations ?? []).map((r) => (auch.has(r.to) ? { ...r, to: ziel.id } : r)) } : e));
    const gesiebt = zeigen.length ? await sieve(request, zeigen, stand.map) : [];
    const registry = await repo.getRegistry();
    const felder = summaryFields(registry);
    return backlinks(registry, gesiebt, ziel.id).map((b) => ({
      from: summaryOf(b.from, felder),
      relation: b.relation,
    }));
  });

  /**
   * **Eine Klasse samt allem, was ihre Ansicht braucht** (W6): die Klasse,
   * ihre Unterklassen, die Stufentabellen und jedes Merkmal, das eine davon
   * gewährt oder einbettet (`classParts`). Eine Antwort statt einer Anfrage
   * je Merkmal — und nicht die 7 000 Merkmale des ganzen Bestands, von
   * denen die Kurzfassung ohnehin keinen Text trägt.
   *
   * Gesiebt wird wie überall (`sieve`). Danach wird **auf dem Gesiebten**
   * noch einmal gesammelt: ein Merkmal, das nur eine verborgene Unterklasse
   * gewährt, verriete sonst, dass es sie gibt.
   */
  app.get<{ Params: { id: string } }>('/api/classes/:id', async (request, reply) => {
    const alle = await repo.listEntities();
    const roh = classParts(alle, request.params.id);
    if (!roh) return reply.code(404).send({ error: 'Nicht gefunden' });
    const byId = new Map(alle.map((e) => [e.id, e]));
    const ids = [roh.klass, ...roh.subclasses, ...roh.tables, ...roh.features];
    const gesiebt = await sieve(
      request,
      ids.map((i) => byId.get(i)).filter((e): e is Entity => !!e),
      alle,
    );
    const teile = classParts(gesiebt, request.params.id);
    if (!teile) return reply.code(404).send({ error: 'Nicht gefunden' });
    const nach = new Map(gesiebt.map((e) => [e.id, e]));
    const nimm = (l: string[]) => l.map((i) => nach.get(i)).filter((e): e is Entity => !!e);
    return {
      class: nach.get(teile.klass),
      subclasses: nimm(teile.subclasses),
      tables: nimm(teile.tables),
      features: nimm(teile.features),
    };
  });

  /**
   * **Eine Herkunft oder ein Hintergrund samt allem, was die Ansicht
   * braucht** (T-166) — gebaut wie `/api/classes/:id`: der Artikel, seine
   * Spielarten, Tabellen und Merkmale in einer Antwort, gesiebt wie
   * überall und danach auf dem Gesiebten noch einmal gesammelt.
   */
  app.get<{ Params: { id: string } }>('/api/origins/:id', async (request, reply) => {
    const alle = await repo.listEntities();
    const roh = originParts(alle, request.params.id);
    if (!roh) return reply.code(404).send({ error: 'Nicht gefunden' });
    const byId = new Map(alle.map((e) => [e.id, e]));
    const ids = [roh.origin, ...roh.variants, ...roh.tables, ...roh.features];
    const gesiebt = await sieve(
      request,
      ids.map((i) => byId.get(i)).filter((e): e is Entity => !!e),
      alle,
    );
    const teile = originParts(gesiebt, request.params.id);
    if (!teile) return reply.code(404).send({ error: 'Nicht gefunden' });
    const nach = new Map(gesiebt.map((e) => [e.id, e]));
    const nimm = (l: string[]) => l.map((i) => nach.get(i)).filter((e): e is Entity => !!e);
    return {
      origin: nach.get(teile.origin),
      variants: nimm(teile.variants),
      tables: nimm(teile.tables),
      features: nimm(teile.features),
    };
  });

  /**
   * **Die Attributsverfahren dieser Kampagne** (REQ-238, E-016 a) für den
   * Assistenten: was die laufende Kampagne über `allowsMethod` erlaubt —
   * gesiebt wie jeder Artikel —, ohne eine einzige Kante die Vorgabe
   * (Standardreihe, Punktekauf). Dazu ihre Gruppen mit den Pools, die für
   * sie schon gewürfelt sind.
   */
  async function verfahren(request: FastifyRequest) {
    const stand = await roh();
    const registry = await repo.getRegistry();
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const genannt = (kampagne?.relations ?? []).filter((r) => r.type === 'allowsMethod').map((r) => r.to);
    const sichtbar = genannt.length
      ? new Set((await sieve(request, genannt.map((i) => stand.map.get(i)).filter((e): e is Entity => !!e), stand.map)).map((e) => e.id))
      : null;
    const methods = allowedMethods(kampagne ?? undefined, stand.map).filter((m) => m.builtIn || sichtbar?.has(m.id));
    const gruppen = kampagne
      ? partiesOf(stand.map, kampagne.id)
      : [];
    const parties = (await sieve(request, gruppen, stand.map)).map((p) => ({
      id: p.id,
      name: entityName(p),
      pools: Object.fromEntries(
        methods.filter((m) => m.scope === 'party').flatMap((m) => {
          const pool = partyPool(stand.map.get(p.id), m.id);
          return pool ? [[m.id, pool] as const] : [];
        }),
      ),
    }));
    return { kampagne, methods, parties };
  }

  /**
   * **Die Spieler der laufenden Kampagne, mit ihren Figuren** (T-100,
   * E-007) — für „Revealed to" und „Hidden from". Wer einen Spieler wählt,
   * wählt seine Figuren: gespeichert wird ein Träger, nie ein Konto
   * (REQ-199). Die Antwort trägt darum keine Konto-Id, nur den Namen.
   *
   * Sehen dürfen es, wer an diesem Tisch sitzt, und die Verwaltung. Eine
   * Figur, die der Betrachter nicht sieht, steht nicht dabei — ein Spieler
   * ohne sichtbare Figur auch nicht: über ihn liesse sich nichts freigeben.
   */
  app.get('/api/players', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
    const stand = await roh();
    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    if (!kampagne) return { campaign: null, players: [] };
    const campaign = { id: kampagne.id, name: entityName(kampagne) };
    if (!user.isAdmin && !user.roles?.[kampagne.id]) return { campaign, players: [] };
    const konten = (await repo.listUsers()).filter((u) => !u.disabledAt && u.roles?.[kampagne.id] === 'player');
    const figuren = konten.flatMap((u) => u.actorIds ?? []).map((id) => stand.map.get(id)).filter((e): e is Entity => !!e);
    const sichtbar = new Map((await sieve(request, figuren, stand.map)).map((e) => [e.id, e]));
    const players = konten
      .map((u) => ({
        name: u.name,
        actors: (u.actorIds ?? []).flatMap((id) => {
          const e = sichtbar.get(id);
          return e ? [{ id, name: entityName(e) }] : [];
        }),
      }))
      .filter((p) => p.actors.length)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return { campaign, players };
  });

  /* Dazu die Sprachen der Kampagne (REQ-251, T-095): leer heisst jede. */
  app.get('/api/abilities', async (request) => {
    const { kampagne, methods, parties } = await verfahren(request);
    return {
      campaign: kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null,
      methods,
      parties,
      languages: campaignLanguages(kampagne ?? undefined),
      /* Talente am Tisch (T-107): nein nimmt das Talent als Ausweg weg. */
      feats: campaignAllowsFeats(kampagne ?? undefined),
      /* Trefferpunkte je Stufe (T-194): würfeln, Durchschnitt oder wählen. */
      hitPoints: hitPointRuleOf(kampagne ?? undefined),
    };
  });

  /**
   * **Das Inventar der laufenden Kampagne** (T-127): ihr Regelset
   * (`Campaign.inventory` — Raster, Gewicht oder Slots) und ihre Gruppen mit
   * dem Inventar, das jede trägt — wohin eine Figur etwas „der Gruppe gibt".
   * Gesiebt wie jede Liste; wer die Gruppe nicht sieht, bekommt sie nicht.
   */
  app.get('/api/inventory', async (request) => {
    const stand = await roh();
    const registry = await repo.getRegistry();
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const gruppen = kampagne ? await sieve(request, partiesOf(stand.map, kampagne.id), stand.map) : [];
    const ids = new Set(gruppen.map((p) => p.id));
    const mitglieder = await sieve(
      request,
      [...stand.map.values()].filter((e) => (e.relations ?? []).some((r) => r.type === 'memberOfParty' && ids.has(r.to))),
      stand.map,
    );
    const traegt = (e: Entity) => (e.relations ?? []).find((r) => r.type === 'carries')?.to ?? null;
    return {
      campaign: kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null,
      rules: inventoryRulesOf(kampagne),
      /* Wie lange Unverstautes liegen darf (T-140). */
      stowing: stowingRuleOf(kampagne),
      parties: gruppen.map((p) => ({
        id: p.id,
        name: entityName(p),
        inventory: traegt(p),
        /* Wem die Gruppe etwas geben kann: ihre Figuren mit ihrem Inventar. */
        members: mitglieder
          .filter((m) => (m.relations ?? []).some((r) => r.type === 'memberOfParty' && r.to === p.id))
          .map((m) => ({ id: m.id, name: entityName(m), inventory: traegt(m) })),
      })),
    };
  });

  /**
   * **Würfeln am Server** (E-016 a): jeder Wurf steht im Protokoll
   * (`abilities.rolled`). Für eine Figur bekommt der Assistent die Werte
   * zurück; für die Gruppe stehen sie danach an ihr (`abilityPool`), und
   * jede Figur der Gruppe verteilt dieselben. Würfeln dürfen, wer in der
   * laufenden Kampagne spielt oder leitet; einen schon gewürfelten Pool
   * würfelt nur die Leitung neu — sonst würfelte die Gruppe, bis es passt.
   */
  app.post<{ Body: { method?: unknown; party?: unknown } | null }>('/api/abilities/roll', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
    const { kampagne, methods, parties } = await verfahren(request);
    const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
    const leitet = user.isAdmin || rolle === 'gm' || rolle === 'co-gm';
    if (!leitet && rolle !== 'player') return reply.code(403).send({ error: 'Würfeln dürfen, wer in dieser Kampagne spielt oder leitet.' });
    const m = methods.find((x) => x.id === String(request.body?.method ?? ''));
    if (!m || m.method !== 'roll') return reply.code(400).send({ error: 'Kein erlaubtes Verfahren mit Würfeln.' });
    const wurf = rollAbilityScores(m);
    if (!wurf) return reply.code(422).send({ error: `Kein Würfelausdruck: ${m.dice ?? '—'}` });
    const at = new Date().toISOString();
    if (m.scope === 'party') {
      const gruppe = parties.find((p) => p.id === String(request.body?.party ?? ''));
      if (!gruppe) return reply.code(400).send({ error: 'Für den Gruppenpool fehlt die Gruppe dieser Kampagne.' });
      const da = gruppe.pools[m.id];
      if (da && !leitet) return reply.code(409).send({ error: 'Für diese Gruppe ist schon gewürfelt.', pool: da });
      const party = (await repo.getEntity(gruppe.id))!;
      /* Ein neuer Wurf ersetzt den alten; im Protokoll stehen beide. */
      const relations = (party.relations ?? []).filter((r) => !(r.type === 'abilityPool' && r.to === m.id));
      relations.push({ id: `${party.id}~abilityPool-${randomUUID().slice(0, 8)}`, type: 'abilityPool', to: m.id, props: { ...wurf, at } });
      const ergebnis = await schreibeGeprueft({ ...party, relations });
      if ('issues' in ergebnis) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: ergebnis.issues });
      await repo.appendEvent('abilities.rolled', party.id, { method: m.id, dice: m.dice, scope: 'party', ...wurf, by: user.id });
      return { ...wurf, at, party: party.id };
    }
    await repo.appendEvent('abilities.rolled', undefined, { method: m.id, dice: m.dice, scope: 'character', ...wurf, by: user.id });
    return { ...wurf, at };
  });
  /**
   * **Die Verfahren für die Startausrüstung dieser Kampagne** (REQ-250,
   * T-096): was die laufende Kampagne über `allowsEquipment` erlaubt —
   * gesiebt wie jeder Artikel —, ohne eine einzige Kante die Vorgabe
   * (Klasse und Hintergrund, Startgold).
   */
  async function ausruestungsVerfahren(request: FastifyRequest) {
    const stand = await roh();
    const registry = await repo.getRegistry();
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const genannt = (kampagne?.relations ?? []).filter((r) => r.type === 'allowsEquipment').map((r) => r.to);
    const sichtbar = genannt.length
      ? new Set((await sieve(request, genannt.map((i) => stand.map.get(i)).filter((e): e is Entity => !!e), stand.map)).map((e) => e.id))
      : null;
    const methods = allowedEquipmentMethods(kampagne ?? undefined, stand.map).filter((m) => m.builtIn || sichtbar?.has(m.id));
    return { stand, kampagne, methods };
  }

  app.get('/api/equipment', async (request) => {
    const { methods } = await ausruestungsVerfahren(request);
    return { methods };
  });

  /**
   * **Das Startgold würfeln** (T-096): am Server, und jeder Wurf steht im
   * Protokoll (`equipment.rolled`). Die Id des Eintrags ist der Beleg, den
   * das Anlegen der Ausrüstung nennt — ein Betrag aus der Maske gälte
   * sonst ungeprüft. Ohne Betrag am Verfahren gilt der der Klasse.
   */
  app.post<{ Body: { method?: unknown; class?: unknown } | null }>('/api/equipment/roll', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
    const { stand, kampagne, methods } = await ausruestungsVerfahren(request);
    const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
    if (!user.isAdmin && rolle !== 'gm' && rolle !== 'co-gm' && rolle !== 'player') {
      return reply.code(403).send({ error: 'Würfeln dürfen, wer in dieser Kampagne spielt oder leitet.' });
    }
    const m = methods.find((x) => x.id === String(request.body?.method ?? ''));
    if (!m || m.method !== 'gold') return reply.code(400).send({ error: 'Kein erlaubtes Verfahren mit Startgold.' });
    const klasse = String(request.body?.class ?? '');
    const ausdruck = m.gold ?? startingGoldOf(stand.map.get(klasse));
    if (!ausdruck) return reply.code(422).send({ error: 'Diese Klasse nennt kein Startgold.' });
    if (fixedGold(ausdruck) !== undefined) return reply.code(400).send({ error: 'Ein fester Betrag wird nicht gewürfelt.' });
    const wurf = rollGold(ausdruck);
    if (!wurf) return reply.code(422).send({ error: `Kein Würfelausdruck: ${ausdruck}` });
    const event = await repo.appendEvent('equipment.rolled', undefined, {
      method: m.id,
      ...(m.gold ? {} : { class: klasse }),
      expr: ausdruck,
      ...wurf,
      by: user.id,
    });
    return { ...wurf, expr: ausdruck, event };
  });

  /**
   * **Die Startausrüstung in das Inventar der Figur** (T-096, REQ-250):
   * je nach Verfahren das, was Klasse und Hintergrund geben (`rules`,
   * gerechnet aus den gespeicherten Antworten), oder ein Einkauf, den
   * **dieser** Server gegen Budget und Grenzen prüft (`checkPurchase`).
   * Das Ergebnis ist ein Inventar (`carries`) mit je Gegenstand einer
   * Kante `holds` und dem Rest des Geldes im Beutel (`Inventory.copper`).
   *
   * Wer die Figur schreibt, darf es — einmal: hält ihr Inventar schon
   * etwas, gibt es die Startausrüstung nur noch durch die Leitung.
   */
  app.post<{ Params: { id: string }; Body: { method?: unknown; purchases?: unknown; roll?: unknown } | null }>(
    '/api/entities/:id/equipment',
    async (request, reply) => {
      const user = await viewerOf(request);
      if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
      const { stand, kampagne, methods } = await ausruestungsVerfahren(request);
      const registry = await repo.getRegistry();
      const figur = stand.map.get(request.params.id);
      if (!figur || !typeChain(registry, primaryInterface(figur)).includes(PLAYER_CHARACTER)) {
        return reply.code(404).send({ error: 'Keine Spielerfigur.' });
      }
      const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
      const leitet = user.isAdmin || rolle === 'gm' || rolle === 'co-gm';
      /* Wie beim Schreiben: die eigene Figur, und die Leitung, was Spielende ihr vorlegen (D72). */
      const darf =
        mayWrite(user, await ownedBy(user, stand.alle), figur.id) ||
        ((await repo.authorsOf(figur.id)).length > 0 && maySetReady(user, stand.map, figur));
      if (!darf) return reply.code(403).send({ error: 'Das gehört dir nicht.' });
      const inventarId = (figur.relations ?? []).find((r) => r.type === 'carries')?.to;
      const inventar = inventarId ? stand.map.get(inventarId) : undefined;
      if (!leitet && inventar?.relations?.some((r) => r.type === 'holds')) {
        return reply.code(409).send({ error: 'Diese Figur hat schon Ausrüstung; mehr gibt die Leitung.' });
      }
      const m = methods.find((x) => x.id === String(request.body?.method ?? ''));
      if (!m) return reply.code(400).send({ error: 'Kein erlaubtes Verfahren.' });

      /* Gegenstände nur, wie dieser Betrachter sie sieht, und nur fertige. */
      const sichtbar = async (ids: string[]) =>
        new Map(
          (await sieve(request, ids.map((i) => stand.map.get(i)).filter((e): e is Entity => !!e), stand.map))
            .filter((e) => isReady(e))
            .map((e) => [e.id, e] as const),
        );
      let items: { id: string; qty: number }[] = [];
      let kupfer = 0;
      const ausgelassen: string[] = [];
      let beleg: string | undefined;
      if (m.method === 'rules') {
        const paket = resolveEquipment(startingBundle(figur, stand.map), stand.alle);
        const da = await sichtbar(paket.items.map((i) => i.id));
        items = paket.items.filter((i) => da.has(i.id));
        ausgelassen.push(...paket.missing, ...paket.items.filter((i) => !da.has(i.id)).map((i) => i.id), ...paket.rest);
        kupfer = paket.copper;
      } else {
        const roh = Array.isArray(request.body?.purchases) ? (request.body.purchases as unknown[]) : [];
        const kauf = roh
          .filter((p): p is { id: string; qty: unknown } => !!p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string')
          .map((p) => ({ id: p.id, qty: Number(p.qty) }));
        let budget: number | undefined;
        if (m.method === 'free') budget = m.budget !== undefined ? Math.round(m.budget * 100) : undefined;
        else {
          const ausdruck = m.gold ?? startingGoldOf(stand.map.get(startClassOf(figur) ?? ''));
          const fest = fixedGold(ausdruck);
          if (fest !== undefined) budget = Math.round(fest * 100);
          else {
            /* Der Beleg: ein Wurf dieses Kontos mit diesem Verfahren (und
               bei Startgold je Klasse für die erste Klasse der Figur), der
               noch nicht verbraucht ist. */
            beleg = String(request.body?.roll ?? '');
            const ev = beleg ? await repo.getEvent(beleg) : undefined;
            const p = (ev?.payload ?? {}) as { method?: unknown; class?: unknown; gp?: unknown; by?: unknown };
            if (!ev || ev.name !== 'equipment.rolled' || p.method !== m.id || p.by !== user.id || (!m.gold && p.class !== startClassOf(figur))) {
              return reply.code(400).send({ error: 'Erst würfeln: der Wurf für dieses Verfahren und diese Klasse fehlt.' });
            }
            const verbraucht = (await repo.listEvents({ name: 'equipment.applied', limit: 10000 })).some(
              (x) => (x.payload as { roll?: unknown } | undefined)?.roll === beleg,
            );
            if (verbraucht) return reply.code(409).send({ error: 'Dieser Wurf ist schon ausgegeben.' });
            budget = Math.round(Number(p.gp) * 100);
          }
        }
        const da = await sichtbar(kauf.map((k) => k.id));
        const pruefung = checkPurchase(kauf, da, m, budget);
        if (pruefung.problem) return reply.code(422).send({ error: pruefung.problem });
        for (const k of kauf) {
          const vorhanden = items.find((i) => i.id === k.id);
          if (vorhanden) vorhanden.qty += k.qty;
          else items.push({ id: k.id, qty: k.qty });
        }
        kupfer = budget !== undefined ? budget - pruefung.spent : 0;
      }

      /* Das Inventar: das vorhandene, sonst ein neues in den Ebenen der Figur.
         Jeder Gegenstand kommt als Instanz (T-150, `stueckWerkstatt`). */
      const werkstatt = stueckWerkstatt({ repo, schreibeGeprueft: (e, erwartet) => schreibeGeprueft(e, undefined, erwartet), kampagnenEbene }, stand, kampagne);
      const autor = leitet ? null : user.id;
      const einlegen = async (inv: Entity): Promise<Entity | { issues: ReturnType<typeof validateEntity> }> => {
        let jetzt = inv;
        for (const i of items) {
          const r = await werkstatt.geben(jetzt, i.id, i.qty, autor);
          if ('issues' in r) return r;
          jetzt = r.inventory;
        }
        return jetzt;
      };
      let invId = inventar?.id;
      if (inventar) {
        const gefuellt = await einlegen(inventar);
        if ('issues' in gefuellt) {
          await werkstatt.zuruecknehmen();
          return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: gefuellt.issues });
        }
        const alt = Number(inventar.components?.['Inventory']?.['copper']) || 0;
        const components = { ...(gefuellt.components ?? {}), Inventory: { ...(gefuellt.components?.['Inventory'] ?? {}), copper: alt + kupfer } };
        const ergebnis = await schreibeGeprueft({ ...gefuellt, components });
        if ('issues' in ergebnis) {
          await werkstatt.zuruecknehmen();
          return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: ergebnis.issues });
        }
      } else {
        const neueId = (): string => `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
        let id = neueId();
        while (stand.map.has(id)) id = neueId();
        invId = id;
        const name = `${entityName(figur)}'s inventory`;
        const leer: Entity = {
          id,
          interfaces: ['Inventory'],
          name,
          components: {
            Identity: { name, id: nextId(stand.alle, 'Inventory') },
            Inventory: { copper: kupfer },
            /* Teil der eigenen Figur (E-014 d): fertig wie sie. */
            [STATUS_COMPONENT]: { status: 'ready' },
          },
          relations: (figur.relations ?? [])
            .filter((r) => r.type === 'inLayer')
            .map((r, n) => ({ id: `${id}~inLayer-${n + 1}`, type: 'inLayer', to: r.to, props: {} })),
        };
        const neu = await einlegen(leer);
        if ('issues' in neu) {
          await werkstatt.zuruecknehmen();
          return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: neu.issues });
        }
        const known = new Map(stand.alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
        known.set(id, 'Inventory');
        for (const s of werkstatt.angelegt) known.set(s, werkstatt.bestand.get(s)?.interfaces?.[0] ?? '');
        const issues = validateEntity(registry, neu, { knownTypes: known, stageOf: stageBases([...stand.alle, neu]) });
        if (issues.length) {
          await werkstatt.zuruecknehmen();
          return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
        }
        await repo.putEntity(neu);
        if (!user.isAdmin && (user.authoredIds ?? []).includes(figur.id)) await repo.addAuthored(user.id, id);
        const ergebnis = await schreibeGeprueft({
          ...figur,
          relations: [...(figur.relations ?? []), { id: `${figur.id}~carries-${randomUUID().slice(0, 8)}`, type: 'carries', to: id, props: {} }],
        });
        if ('issues' in ergebnis) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: ergebnis.issues });
      }
      await repo.appendEvent('equipment.applied', figur.id, {
        method: m.id,
        inventory: invId,
        items,
        copper: kupfer,
        ...(beleg ? { roll: beleg } : {}),
        ...(ausgelassen.length ? { skipped: ausgelassen } : {}),
        by: user.id,
      });
      return { inventory: invId, items, copper: kupfer, skipped: ausgelassen };
    },
  );

  /* Die Leseansicht (T-091, REQ-247): eine Ebene als Buch. */
  const { leseZiel } = registerLesen(app, {
    repo,
    viewerOf,
    roh,
    sieve: (request, entities, bestand, vorschau) =>
      sieve(request, entities, bestand, undefined, vorschau?.size ? { preview: vorschau } : 'inPlay'),
    geltend,
    bezuegeVon,
    aufgeschaltet: async (map) => new Set(activeLayerRanks(map, kampagneIn(map, (await repo.getRegistry()).settings ?? null)).keys()),
  });
  /* Der Inhalt einer Quelle als Baum (T-189): gesiebt wie die Leseansicht. */
  registerQuelleninhalt(app, {
    repo,
    viewerOf,
    roh,
    sieve: (request, entities, bestand, vorschau) =>
      sieve(request, entities, bestand, undefined, vorschau?.size ? { preview: vorschau, whole: true } : 'inPlay'),
    kampagne: (map, registry) => kampagneIn(map, registry.settings ?? null),
  });
  /* Filtergruppen je Seite (T-137): die der Kampagne und die eigenen. */
  registerFiltergruppen(app, { repo, viewerOf, roh });
  registerSpaltenwahl(app, { repo, viewerOf, roh });
  registerEbenensets(app, { repo, viewerOf });
  /* Der Fertigungsauftrag (T-128): Material reservieren, Proben, Abrechnung. */
  registerHandwerk(app, {
    repo,
    viewerOf,
    roh,
    sieve,
    schreibeGeprueft: (e) => schreibeGeprueft(e),
    kampagnenEbene,
    wurf: async (subject, payload) =>
      wurfEintragen({ repo, feed: live }, subject, { ...payload, session: tischSitzung((await roh()).alle)?.id ?? null }),
  });
  /* Würfe auf einem Artikel (T-172): am Server gewürfelt, im Protokoll, im Log des Artikels. */
  registerWuerfe(app, { repo, feed: live, viewerOf, roh, sieve });
  /* Kaufen und Verkaufen im Laden (T-133): der Preis am Server, gegen die gelesene Revision. */
  registerLaden(app, { repo, viewerOf, roh, sieve, schreibeGeprueft: (e, erwartet) => schreibeGeprueft(e, undefined, erwartet), kampagnenEbene });
  /* Die Regeloptionen einer Kampagne (T-190): nach Sorte, mit Regelartikeln. */
  registerRegeloptionen(app, { repo, roh, sieve });
  /* Das Glossar (T-242): Wörter der App und sichtbare Glossarartikel, mit Nennungen. */
  registerGlossar(app, { roh, sieve });
  /* Der Reiter Knowledge am Artikel (T-286): Informationen und ihre Bündel. */
  registerWissen(app, {
    repo,
    viewerOf,
    roh,
    sieve,
    schreibeGeprueft: (e) => schreibeGeprueft(e),
    kampagnenEbene,
    darfSchreiben: async (request, id) => {
      const user = await viewerOf(request);
      return !!user && mayWrite(user, await ownedBy(user), id);
    },
  });
  /* Die Sichtbarkeit je Gruppe an der Kampagne (T-252, E-098). */
  registerSichtbarkeit(app, {
    repo,
    viewerOf,
    roh,
    imSpiel: (map, kampagne, registry) => {
      const st = stapelFuer(map, kampagne, registry);
      return (e) => st.inPlay(e);
    },
    augeVon,
    schreiben,
  });
  /* Liegengelassen (T-140): Sitzungsende und Aufheben. */
  registerLiegen(app, {
    repo,
    viewerOf,
    roh,
    sieve,
    schreibeGeprueft: (e, erwartet) => schreibeGeprueft(e, undefined, erwartet),
    darfSchreiben: async (request, id) => {
      const user = await viewerOf(request);
      return !!user && mayWrite(user, await ownedBy(user), id);
    },
  });
  /* Geben (T-150): Beute, Geschenke, was die Leitung austeilt — als Instanz. */
  registerGeben(app, {
    repo,
    viewerOf,
    roh,
    sieve,
    schreibeGeprueft: (e, erwartet) => schreibeGeprueft(e, undefined, erwartet),
    kampagnenEbene,
    /* Wie am `PUT`: was das Konto schreibt, und als Leitung, was Spielende ihr vorlegen (D72). */
    darfSchreiben: async (request, id) => {
      const user = await viewerOf(request);
      if (!user) return false;
      if (mayWrite(user, await ownedBy(user), id)) return true;
      if (!(await repo.authorsOf(id)).length) return false;
      const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      const da = alle.get(id);
      return !!da && maySetReady(user, alle, da);
    },
  });

  /* **Der Live-Kanal** (T-116, REQ-116): `GET /api/live`, je Empfänger
     gesiebt mit `sieveFuer` — dieselbe Rechnung wie jede Route. */
  const kanal = registerLive(app, {
    repo,
    feed: live,
    viewerOf,
    sieveFuer: (user, entities, bestand) => sieveFuer(user, entities, bestand),
    roh,
  });
  app.addHook('onClose', async () => kanal.close());

  app.get<{ Params: { id: string }; Querystring: { stand?: string } }>('/api/entities/:id', async (request, reply) => {
    const stand = await roh();
    const gefunden = stand.map.get(request.params.id) ?? (await repo.getEntity(request.params.id));
    if (!gefunden) return reply.code(404).send({ error: 'Nicht gefunden' });
    /* **Wer das Original öffnet, bekommt die Fassung, die gilt** (E-018,
       T-082): ein Verweis im Abenteuer zeigt aufs Original, und in einer
       Kampagne, die es angepasst hat, ist die Fassung die Sache. Die
       Seite sieht an der Id, dass sie umgeleitet wurde. */
    const entity = await geltend(gefunden, stand.map);
    /* **Gilt ein älterer fertiger Stand?** (REQ-237, E-012) Wer den
       Arbeitsstand sieht — Verfasserin, Leitung —, bekommt ihn mit dem
       Datum des fertigen Stands (`refs.ready`), für das Band; mit
       `?stand=ready` den fertigen Stand selbst. Alle anderen bekommen ohnehin
       nur ihn (`sieve`) und erfahren nicht, dass es einen neueren gibt. */
    const fertig = isReady(entity) ? undefined : (await fertigeStaende()).get(entity.id);
    let ready: { at: string; old: boolean } | undefined;
    let zeige = entity;
    if (fertig) {
      const user = await viewerOf(request);
      const registry = await repo.getRegistry();
      const sieht = !user || user.isAdmin || seesUnfinished(stand.map, entity, await augeVon(user, stand.map, registry));
      if (sieht) {
        const alt = request.query.stand === 'ready';
        ready = { at: fertig.at, old: alt };
        if (alt) zeige = fertig.entity;
      }
    }
    let [gesiebt] = await sieve(request, [zeige], stand.map);
    /* **Eine Fassung aus einer Vergleichsebene** (T-092) ist nicht im
       Spiel, aber auf Wunsch sichtbar — wer Vergleichsebenen sehen darf,
       öffnet sie wie jeden Artikel, mit dem Hinweis `refs.compare`. */
    let vergleich = false;
    if (!gesiebt) {
      [gesiebt] = await sieve(request, [zeige], stand.map, undefined, 'compare');
      vergleich = !!gesiebt;
    }
    const einer = gesiebt;
    /* Fällt er durchs Sieb, gibt es ihn für diesen Betrachter nicht.
       „Verboten" wäre die genauere Auskunft und die falsche: sie sagt, dass
       da etwas ist. Vorher stand hier `einer ?? entity` — der Rückfall
       schickte genau den Artikel, den das Sieb gerade zurückgehalten
       hatte. */
    if (!einer) return reply.code(404).send({ error: 'Nicht gefunden' });
    /* Die Namen, die der Artikel braucht, kommen mit (W7) — der Browser
       hält keinen Bestand mehr, aus dem er sie nachschlagen könnte. */
    /* „Im Buch lesen" (T-091): wohin die Quellenangabe führt, wenn seine Ebene Text hat. */
    const reading = await leseZiel(einer);
    const craft = await fertigungswert(request, einer, stand.map);
    const shop = await ladenwaren(request, einer, stand.map);
    /* Die geltende Stufe und woher sie kommt (T-252), für das Kapitel
       „Admin" (T-277): sagt der Artikel keine, sagt es seine Gruppe. */
    const registry = await repo.getRegistry();
    const audience = effectiveAudience(stand.map, einer, campaignVisibility(stand.map, registry, currentCampaign(stand.map, registry.settings ?? null)));
    const refs = {
      audience,
      ...(await bezuegeVon(request, einer)),
      ...(await bilderVon(request, einer)),
      ...(ready ? { ready } : {}),
      ...(vergleich ? { compare: true } : {}),
      ...(reading ? { reading } : {}),
      ...(craft ? { craft } : {}),
      ...(shop ? { shop } : {}),
    };
    /* Ob „Adapt" angeboten wird (E-018, T-082) und in welche Ebenen
       (`adaptTo`, T-098): dieselbe Frage wie die Route, damit die Seite
       nichts anbietet, was der Server ablehnt. Wer den Artikel nicht
       schreibt, aber eine Zielebene hat, bekommt an „Edit" eine Fassung. */
    const ziele = await anpassZiele(request, einer, stand.map);
    /* „Take into campaign" (E-026): wohin es gehängt werden kann. */
    const nehmen = await uebernahmeZiele(request, einer, stand.map);
    const mitNehmen0 = nehmen.length ? { ...refs, takeInto: nehmen.map((x) => ({ id: x.id, name: entityName(x), type: primaryInterface(x) })) } : refs;
    const freigabe = await freigabeAm(request, entity, stand.map, vergleich);
    const mitNehmen = freigabe ? { ...mitNehmen0, ...freigabe } : mitNehmen0;
    return {
      ...einer,
      refs: ziele.length
        ? { ...mitNehmen, adaptable: true, adaptTo: ziele.map((l) => ({ id: l.id, name: entityName(l) })) }
        : mitNehmen,
    };
  });

  /** Was sich in die Geschichte holen lässt (E-026): ein Teil der Geschichte, kein Ganzes einer Runde. */
  const OHNE_UEBERNAHME = new Set([CAMPAIGN_TYPE, 'Session']);

  /**
   * **Wohin ein Teil eines Abenteuers geholt werden kann** (E-026,
   * REQ-252, auf E-018 a und E-001): in die Kampagne selbst oder an einen
   * ihrer Arcs — was in der Ebene der laufenden Kampagne liegt. Holen
   * darf, wer dort schreibt: die Verwaltung und die Leitung (`gm`, `co-gm`).
   * Übernommen wird ein Original aus einer anderen Ebene, das eine Sprosse
   * der Geschichte ist (ein Kapitel, eine Szene); leer heisst: nicht
   * anbieten.
   */
  async function uebernahmeZiele(request: FastifyRequest, e: Entity, map: Map<string, Entity>): Promise<Entity[]> {
    const user = await viewerOf(request);
    if (!user || user.disabledAt) return [];
    const registry = await repo.getRegistry();
    const kette = typeChain(registry, primaryInterface(e));
    /* Holen lässt sich eine Sprosse der Geschichte, ein Kapitel eines Buchs
       und ein einzelner Teil daraus — ein Vorlesetext (T-108, E-028). */
    const teil = kette.includes('BookPart');
    if (!(kette.includes('Story') || kette.includes(CHAPTER_TYPE) || teil) || OHNE_UEBERNAHME.has(primaryInterface(e))) return [];
    if ((e.relations ?? []).some((r) => r.type === OVERRIDES_RELATION)) return [];
    const kampagne = currentCampaign(map, registry.settings ?? null);
    if (!kampagne || !inStack(map, e, kampagne, registry)) return [];
    const ebene = await kampagnenEbene(map, kampagne);
    if (!ebene || layersOf(e).includes(ebene.id)) return [];
    if (!user.isAdmin && !(await zielEbenen(user, map, kampagne)).some((l) => l.id === ebene.id)) return [];
    /* Ein Teil darf auch in eine eigene Szene (E-028: „in eine Szene deiner Wahl"). */
    const zielArten = teil ? ['Arc', 'Scene'] : ['Arc'];
    const arcs = [...map.values()]
      .filter((x) => x.id !== e.id && layersOf(x).includes(ebene.id) && zielArten.some((a) => typeChain(registry, primaryInterface(x)).includes(a)))
      .filter((x) => inStack(map, x, kampagne, registry))
      .sort((a, b) => entityName(a).localeCompare(entityName(b), 'en'));
    return [kampagne, ...arcs];
  }

  /**
   * **In die Geschichte holen** (E-026, REQ-252; nicht zu verwechseln
   * mit `adopt`, E7): ein Kapitel, eine Szene aus einem
   * Abenteuer in die eigene Kampagne holen — als Fassung in der Ebene der
   * laufenden Kampagne (E-018 a, wie `adapt`), **mit allem darunter**
   * (`takenWith`: Szenen, Räume, Begegnungen, Karten), und gehängt an die
   * Kampagne oder einen ihrer Arcs (`into`). Die Teile hängen danach an den
   * Fassungen ihrer Eltern (`rehang`), nicht an den Originalen, die diese
   * Kampagne nicht mehr sieht. Gibt es eine Fassung schon, wird sie
   * genommen und nur umgehängt — zweimal holen legt nichts doppelt an.
   * Das Original bleibt; zurück heisst, die Fassungen zu löschen.
   */
  app.post<{ Params: { id: string }; Body: { into?: unknown; use?: unknown } | null }>('/api/entities/:id/take', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const registry = await repo.getRegistry();
    const stand = await roh();
    const original = stand.map.get(request.params.id);
    const gesehen = original ? (await sieve(request, [original], stand.map, undefined, 'versions')).length > 0 : false;
    if (!original || !gesehen) return reply.code(404).send({ error: 'Nicht gefunden' });
    const ziele = await uebernahmeZiele(request, original, stand.map);
    if (!ziele.length) return reply.code(403).send({ error: 'Das lässt sich nicht in deine Kampagne holen.' });
    const into = ziele.find((z) => z.id === String(request.body?.into ?? ''));
    if (!into) {
      return reply.code(409).send({
        error: 'Wohin?',
        into: ziele.map((z) => ({ id: z.id, name: entityName(z), type: primaryInterface(z) })),
      });
    }
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const ebene = (await kampagnenEbene(stand.map, kampagne))!;
    /* Ein Teil eines Buchs steht im Ziel an der nächsten Stelle (T-108). */
    const imFluss = [CHAPTER_TYPE, ...BOOK_PART_TYPES].includes(primaryInterface(original));
    const rang = imFluss ? nextRank(partsIndex(stand.alle), into.id) : undefined;
    /* **Verwenden statt kopieren** (E-028): ein Verweis-Teil in der Ebene
       der Kampagne zeigt auf das Original — eine Korrektur am Original
       erreicht ihn, und geändert wird er erst, wenn die Leitung ihn als
       Fassung holt. */
    if (request.body?.use === true) {
      const id = `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const name = entityName(original);
      const verweis: Entity = {
        id,
        name,
        interfaces: ['Embed'],
        components: {
          Identity: { name, id: nextId(stand.alle, 'Embed'), aliases: [] },
          Embed: { target: original.id },
          ...(original.components?.['Visibility'] ? { Visibility: original.components['Visibility'] } : {}),
        },
        relations: [
          { id: `${id}~${LAYER_RELATION}`, type: LAYER_RELATION, to: ebene.id, props: {} },
          { id: `${id}~partOf-into`, type: 'partOf', to: into.id, props: { rank: rang ?? nextRank(partsIndex(stand.alle), into.id) } },
        ],
      };
      const known = new Map([...stand.alle, verweis].map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
      const issues = validateEntity(registry, verweis, { knownTypes: known });
      if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
      await repo.putEntity(verweis);
      await repo.appendEvent('entity.created', id, { interfaces: verweis.interfaces, uses: original.id, layer: ebene.id, takenInto: into.id, by: user.id });
      return reply.code(201).send({ id, created: 1, taken: 1, used: true });
    }
    const teile = takenWith(stand.map, original, kampagne, ebene.id, registry);
    /* Original → Fassung: die schon da ist, oder eine neue. */
    const mapping = new Map<string, string>();
    const fassungen: Entity[] = [];
    const bestand = [...stand.alle];
    const neueId = (): string => {
      let id = `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      while (stand.map.has(id) || mapping.has(id)) id = `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      return id;
    };
    let neu = 0;
    for (const t of teile) {
      const schon = stand.alle.find(
        (e) => layersOf(e).includes(ebene.id) && (e.relations ?? []).some((r) => r.type === OVERRIDES_RELATION && r.to === t.id),
      );
      if (schon) {
        mapping.set(t.id, schon.id);
        fassungen.push(schon);
        continue;
      }
      const id = neueId();
      const typ = t.interfaces?.[0] ?? '';
      const f = adaptedVersion(t, { id, number: nextId(bestand, typ), layer: ebene.id });
      bestand.push(f);
      mapping.set(t.id, id);
      fassungen.push(f);
      neu += 1;
    }
    const geschrieben = fassungen.map((f, i) => rehang(f, mapping, i === 0 ? into.id : undefined, i === 0 ? rang : undefined));
    const known = new Map(bestand.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
    for (const f of geschrieben) {
      const issues = validateEntity(registry, f, { knownTypes: known, stageOf: stageBases(bestand) });
      if (issues.length) return reply.code(422).send({ error: `Validierung fehlgeschlagen: ${entityName(f)}`, issues });
    }
    for (const f of geschrieben) {
      const vorher = stand.map.get(f.id);
      if (vorher && JSON.stringify(vorher.relations) === JSON.stringify(f.relations)) continue;
      await repo.putEntity(f);
      await repo.appendEvent(vorher ? 'entity.written' : 'entity.created', f.id, {
        interfaces: f.interfaces,
        adapts: (f.relations ?? []).find((r) => r.type === OVERRIDES_RELATION)?.to,
        layer: ebene.id,
        takenInto: into.id,
        by: user.id,
      });
    }
    return reply.code(201).send({ id: mapping.get(original.id)!, created: neu, taken: teile.length });
  });

  /** Arten, von denen es keine Fassung gibt: eine Ebene ist der Ort, eine
   *  Kampagne der Stapel selbst (T-098). */
  const OHNE_FASSUNG = new Set(['Layer', CAMPAIGN_TYPE]);

  /**
   * **In welche Ebenen dieser Artikel angepasst werden kann** (E-018, T-082,
   * T-098) — die Regeln der Route `adapt`. Die Verwaltung wie bisher in die
   * Ebene der laufenden Kampagne, und nur aus einer anderen Ebene. Alle
   * anderen in ihre Zielebenen (`zielEbenen`), wenn sie ihn nicht selbst
   * schreiben — auch einen Artikel ohne Ebene: der gehört niemandem, und
   * ändern heisst für alle ausser der Verwaltung, eine Fassung anzulegen.
   */
  async function anpassZiele(request: FastifyRequest, e: Entity, map: Map<string, Entity>): Promise<Entity[]> {
    const user = await viewerOf(request);
    if (!user || user.disabledAt) return [];
    if ((e.relations ?? []).some((r) => r.type === OVERRIDES_RELATION)) return [];
    if (OHNE_FASSUNG.has(primaryInterface(e))) return [];
    const registry = await repo.getRegistry();
    const kampagne = currentCampaign(map, registry.settings ?? null);
    if (!kampagne || !inStack(map, e, kampagne, registry)) return [];
    const ebenen = layersOf(e);
    /* Die Verwaltung schreibt ohnehin alles; eine Fassung legt sie in die
       Ebene der Kampagne oder in eine eigene, die im Spiel ist — etwa
       „AI generated prices" (T-139). */
    /* **Keine Fassung in einer Spielerebene** (T-164): der Stapel gilt für
       alle am Tisch, eine Überschreibung darin änderte den Artikel für alle. */
    const spieler = spielerEbenen(await repo.layerGrants());
    /* Die Schreibebene steht vorn (T-161) — die Maske wählt die erste vor. */
    const ziele = async () => {
      const liste = (await zielEbenen(user, map, kampagne)).filter((l) => !ebenen.includes(l.id) && !spieler.has(l.id));
      const w = (await gewaehlteSchreibEbene(user, map, kampagne))?.id;
      return [...liste.filter((l) => l.id === w), ...liste.filter((l) => l.id !== w)];
    };
    if (user.isAdmin) {
      if (!ebenen.length) return [];
      return ziele();
    }
    if ((await ownedBy(user, map.values())).has(e.id)) return [];
    return ziele();
  }

  /**
   * **Einen Artikel anlegen** (W7). Die Oberfläche nennt Art und Name, der
   * Server vergibt den Rest: die Peg-Id (undurchsichtig, wie jede), die
   * Nummer (`nextId` über den ganzen Bestand — gezählt wird, was dasteht),
   * die Karten, die Pflicht sind oder Vorgaben tragen, mit den Vorgaben
   * (`default`) aus dem Register. Geprüft wird wie beim Schreiben
   * (`validateEntity`); was Pflicht ist und keine Vorgabe hat (die Art
   * einer Aktion), schickt die Maske in `fields` mit.
   *
   * Anlegen darf die Verwaltung und, wer in der laufenden Kampagne `player`
   * ist (`mayCreate`, REQ-237, E-011, E-013) — jede Art, die einen Stand
   * trägt. Was eine Spielerin anlegt, liegt in der Ebene ihrer Kampagne
   * (`campaignLayer`), steht auf `idea` oder `prepared` und gehört ihr:
   * vermerkt neben ihrem Konto (`app_user_article`), nicht im Artikel
   * (REQ-199). Eine Spielerfigur wird ihr gleich zugeteilt.
   *
   * Wer in einer Ebene schreibt, die in der laufenden Kampagne im Spiel ist
   * (T-098, E-001 — die Leitung in der Ebene ihrer Kampagne), legt dort an:
   * in der Ebene, die die Maske nennt, sonst in der ersten. Ob der Stand
   * `ready` sein darf, sagt `maySetReady` wie beim Schreiben.
   */
  /** Was `POST /api/entities` bekommt — auch vom Hochladen eines Bildes (T-114). */
  interface Anlage {
    type?: unknown;
    name?: unknown;
    fields?: unknown;
    relations?: unknown;
  }

  /**
   * **Einen Artikel anlegen**, mit allen Regeln der Route: wer anlegt, in
   * welche Ebene, mit welchem Stand, durch `validateEntity`. Eine Funktion
   * und keine zweite Kopie, weil das Hochladen eines Bildes einen
   * Asset-Artikel anlegt (T-114) — und dieselben Regeln an zwei Stellen
   * laufen genau so lange gleich, bis eine sich ändert.
   *
   * `fuer`: der Artikel, aus dem heraus angelegt wird. Ist er die eigene
   * Figur, darf der Stand `ready` bleiben (E-014 d). `zurueck`: ein
   * `ready`, das man nicht setzen darf, fällt auf `idea` zurück, statt
   * abgelehnt zu werden (D74) — das Bild übernimmt den Stand seines
   * Artikels, und das darf das Hochladen nicht verhindern.
   */
  async function anlegen(
    request: FastifyRequest,
    body: Anlage | null | undefined,
    optionen: { fuer?: string; zurueck?: boolean; ohneVorgabe?: string[] } = {},
  ): Promise<{ code: number; body: unknown }> {
      const type = String(body?.type ?? '');
      const name = String(body?.name ?? '').trim();
      const registry = await repo.getRegistry();
      const def = registry.interfaces[type];
      if (!def || def.abstract) {
        return { code: 400, body: { error: `Diese Art lässt sich nicht anlegen: ${type || '—'}` } };
      }
      if (!name) return { code: 400, body: { error: 'Der Name fehlt.' } };

      const stand = await roh();
      const kette = typeChain(registry, type);
      const components: Record<string, Record<string, unknown>> = {};
      for (const t of kette) {
        const schema = registry.interfaces[t]?.schema;
        if (!schema) continue;
        const karte: Record<string, unknown> = {};
        for (const [k, p] of Object.entries(schema.properties ?? {})) {
          if (!p.derived && p.default !== undefined && !optionen.ohneVorgabe?.includes(`${t}.${k}`)) karte[k] = structuredClone(p.default);
        }
        if (Object.keys(karte).length || (schema.required ?? []).length) components[t] = karte;
      }
      const extra = body?.fields;
      if (extra && typeof extra === 'object') {
        for (const [ref, wert] of Object.entries(extra as Record<string, unknown>)) {
          const [t, k] = ref.split('.');
          if (!t || !k || !kette.includes(t)) continue;
          if (wert === undefined || wert === null || wert === '') continue;
          (components[t] ??= {})[k] = wert;
        }
      }
      components['Identity'] = {
        ...(components['Identity'] ?? {}),
        name,
        id: nextId(stand.alle, type),
      };
      const neueId = (): string => `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      let id = neueId();
      while (stand.map.has(id)) id = neueId();
      /* Kanten gehen mit, wenn die Seite sie schon kennt — ein Board gehört
         gleich zu seiner Sitzung (`partOf`). Die Ids vergibt der Server. */
      const kanten = Array.isArray(body?.relations) ? (body.relations as unknown[]) : [];
      const relations: NonNullable<Entity['relations']> = kanten
        .filter((k): k is { type: string; to: string; props?: Record<string, unknown> } =>
          !!k && typeof k === 'object' && typeof (k as { type?: unknown }).type === 'string' &&
          typeof (k as { to?: unknown }).to === 'string')
        .map((k, i) => ({ id: `${id}~${k.type}-${i + 1}`, type: k.type, to: k.to, props: k.props ?? {} }));
      const user = await viewerOf(request);
      /* `spielerin`: legt als `player` in die Ebene der Kampagne an und
         schreibt danach, was sie angelegt hat (REQ-237). Wer eine Zielebene
         hat (T-098), legt dort an — die genannte, sonst die erste. */
      let spielerin = false;
      if (user && !user.isAdmin) {
        const kampagne = currentCampaign(stand.map, registry.settings ?? null);
        const ziele = await zielEbenen(user, stand.map, kampagne);
        const genannt = relations.filter((r) => r.type === 'inLayer').map((r) => r.to);
        const spielt = !!kampagne && user.roles?.[kampagne.id] === 'player';
        /* Die Ebene gibt der Server, nicht die Maske: angelegt wird in eine
           Ebene, in der man schreibt, oder als Spielerin in die Runde — nie
           in ein geteiltes Regelwerk. */
        /* Ohne genannte Ebene in die Schreibebene (T-161), wenn sie unter
           den Zielebenen steht. */
        const wahl = (await schreibEbene(user, stand.map, kampagne)).layer;
        let ziel =
          ziele.find((l) => genannt.includes(l.id)) ??
          ziele.find((l) => l.id === wahl?.id) ??
          (spielt ? null : (ziele[0] ?? null));
        /* Als Spielerin in die Vorgabe: die eigene Spielerebene, sonst die
           Ebene der Kampagne (T-164). Was dort liegt, hat sie angelegt. */
        const vorgabe = spielt ? await grundEbene(user, stand.map, kampagne) : null;
        spielerin = !ziel || (spielt && ziel.id === vorgabe?.id);
        if (!ziel) {
          if (!spielt) return { code: 403, body: { error: 'Anlegen darfst du hier nicht.' } };
          ziel = vorgabe;
        }
        for (let i = relations.length - 1; i >= 0; i -= 1) {
          if (relations[i]!.type === 'inLayer') relations.splice(i, 1);
        }
        if (ziel) relations.push({ id: `${id}~inLayer-1`, type: 'inLayer', to: ziel.id, props: {} });

        /* **`ready` setzt die Leitung** (REQ-237, E-011): wer es hier nicht
           darf (`maySetReady` — `gm` der Kampagne, der die Ebene gehört),
           legt unfertig an. Ein Stand muss dann da sein: ohne Status-Karte
           gilt ein Artikel als fertig (`isReady`), und jeder sähe sofort,
           was eben erst angelegt wurde. Die eigene Figur nennt ihr Spieler
           selbst fertig (E-014 d) — auch den Statblock, den der Assistent
           gleich an sie hängt (T-080). */
        const anEigener =
          relations.some((r) => r.type === 'belongsTo') &&
          (() => {
            const figur = eigeneFigur(user, stand.map, registry);
            return relations.every((r) => r.type !== 'belongsTo' || figur.has(r.to));
          })();
        const darfFertig =
          kette.includes(PLAYER_CHARACTER) ||
          anEigener ||
          /* Das Bild der eigenen Figur (T-114) sehen die Mitspielenden wie die Figur. */
          (!!optionen.fuer && eigeneFigur(user, stand.map, registry).has(optionen.fuer)) ||
          (!spielerin && maySetReady(user, stand.map, { id, interfaces: [type], name, components, relations }));
        /* Was eine Spielerin anlegt, trägt immer einen Stand — „ready" blieb
           hier bis T-080 nicht stehen, auch an der eigenen Figur. */
        if (spielerin || !darfFertig) {
          if (!kette.includes(STATUS_COMPONENT)) {
            return { code: 400, body: { error: `Diese Art trägt keinen Stand und bleibt bei der Leitung: ${type}` } };
          }
          const karte = (components[STATUS_COMPONENT] ??= {});
          const wert = karte['status'];
          if (wert === 'ready' && !darfFertig && !optionen.zurueck) return { code: 403, body: { error: '„ready" setzt die Leitung.' } };
          if (wert !== 'idea' && wert !== 'prepared' && !(wert === 'ready' && darfFertig)) karte['status'] = 'idea';
        }
      } else if (user && type !== LAYER_COMPONENT && type !== CAMPAIGN_TYPE && !relations.some((r) => r.type === LAYER_RELATION)) {
        /* **Die Verwaltung legt an, wo sie nichts sagt** — wie bisher ohne
           Ebene, ausser sie hat für die laufende Kampagne eine Schreibebene
           gewählt (T-161, T-176): dann dort, damit Tests in der Testebene
           landen und mit „Empty this layer" wieder gehen. */
        const kampagne = currentCampaign(stand.map, registry.settings ?? null);
        const gewaehlt = await gewaehlteSchreibEbene(user, stand.map, kampagne);
        if (gewaehlt) relations.push({ id: `${id}~inLayer-1`, type: LAYER_RELATION, to: gewaehlt.id, props: {} });
      }
      const entity: Entity = { id, interfaces: [type], name, components, relations };

      const known = new Map(stand.alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
      known.set(id, type);
      /* **Aus einer Vorlage angelegt** (T-125): eine Instanz nennt ihre
         Vorlage mit `instanceOf`. Die muss es geben, sie muss von derselben
         Art sein, und wer anlegt, muss sie sehen — sonst läse er über die
         Instanz, was ihm verborgen ist. Geprüft wird aufgelöst, gespeichert
         ausgedünnt wie beim Schreiben: die Vorgaben der Art stünden sonst
         an der Instanz und verdeckten die Werte der Vorlage. */
      let pruefling = entity;
      let zuSchreiben = entity;
      if (isInstance(entity)) {
        const vorlageId = relations.find((r) => r.type === 'instanceOf')?.to ?? '';
        const vorlage = stand.map.get(vorlageId);
        const [sichtbar] = vorlage ? await sieve(request, [vorlage], stand.map) : [];
        if (!vorlage || !sichtbar || primaryInterface(vorlage) !== type) {
          return { code: 400, body: { error: 'Diese Vorlage gibt es nicht, oder sie ist von einer anderen Art.' } };
        }
        /* Die Vorgaben der Art gelten nicht: die Vorlage gibt, was fehlt,
           und eine Vorgabe, die sie nicht trägt (`system`), stünde sonst
           als Abweichung da. Bleiben Name, Nummer, Stand, Sichtbarkeit und
           was ausdrücklich mitkam. */
        const genannt = new Set(Object.keys((body?.fields ?? {}) as Record<string, unknown>));
        const eigen: Record<string, Record<string, unknown>> = {};
        for (const [t, karte] of Object.entries(components)) {
          if (t === 'Identity' || t === STATUS_COMPONENT || t === 'Visibility') {
            eigen[t] = karte;
            continue;
          }
          for (const [k, v] of Object.entries(karte)) if (genannt.has(`${t}.${k}`)) (eigen[t] ??= {})[k] = v;
        }
        entity.components = eigen;
        const alle = new Map(stand.map);
        alle.set(id, entity);
        pruefling = resolveInstance(alle, entity);
        zuSchreiben = thinInstance(alle, entity);
      }
      const issues = [...validateEntity(registry, pruefling, { knownTypes: known, stageOf: stageBases([...stand.alle, entity]) }), ...doppelteWahlen(undefined, entity, stand.alle)];
      if (issues.length) {
        return { code: 422, body: { error: 'Validierung fehlgeschlagen', issues } };
      }
      const stored = await repo.putEntity(zuSchreiben);
      if (spielerin && user) {
        await repo.addAuthored(user.id, id);
        /* Eine Figur, die sie anlegt, führt sie auch (REQ-237). */
        if (kette.includes(PLAYER_CHARACTER)) {
          const konto = await repo.getUser(user.id);
          if (konto && !konto.actorIds.includes(id)) {
            await repo.putUser({ ...konto, actorIds: [...konto.actorIds, id] });
          }
        }
      }
      await repo.appendEvent('entity.created', id, { interfaces: [type], ...(user && !user.isAdmin ? { by: user.id } : {}) });
      return { code: 201, body: stored };
  }

  app.post<{ Body: Anlage }>('/api/entities', async (request, reply) => {
    const r = await anlegen(request, request.body);
    return reply.code(r.code).send(r.body);
  });

  /* Bilder hochladen und ausliefern (T-114): `bilder.ts`. */
  /* Das Kartenbild unter dem Nebel, beschnitten (T-312). */
  const kartenbild = registerKartenbild(app, { repo, store: assets, roh, sieve, geltend });
  const bilder = registerBilder(app, {
    unterNebel: (request, id) => kartenbild.zurueckgehalten(request, id),
    repo,
    store: assets,
    viewerOf,
    roh,
    sieve,
    geltend,
    anlegen,
    schreiben,
    darfSchreiben: async (request, id) => {
      const user = await viewerOf(request);
      return !!user && mayWrite(user, await ownedBy(user), id);
    },
    darfAnlegen: async (request) => {
      const user = await viewerOf(request);
      return !!user && (user.isAdmin || (await mayCreate(user)));
    },
  });
  /* Der Zugplan auf der Karte (T-198): planen, einreichen, bestätigen —
     gewürfelt wird beim Bestätigen, ins Log (T-172). */
  /* Karten und Begegnungen im Spiel als Instanz (T-289) — auch der Zugplan braucht sie: ein Portal auf eine andere Karte (T-326). */
  const spielDeps = { repo, viewerOf, roh, sieve, kampagnenEbene, schreibeGeprueft: (e: Entity) => schreibeGeprueft(e) };
  registerZugplan(app, { repo, feed: live, viewerOf, roh, sieve, geltend, schreibeGeprueft: (e) => schreibeGeprueft(e), insSpiel: insSpiel(spielDeps) });
  /* Türen am Tisch (T-118): öffnen, schliessen, verschliessen — und aufdecken, was dahinter liegt. */
  registerTueren(app, { repo, viewerOf, roh, sieve, geltend, schreibeGeprueft: (e) => schreibeGeprueft(e) });
  /* Eine Begegnung beginnen (T-203): Initiative, vorplatzierte Tokens, die Sitzung führt sie. */
  /* Karten und Begegnungen im Spiel als Instanz (T-289): „In Play nehmen“ und „Played“. */
  registerSpielinstanz(app, spielDeps);
  /* Enhancements an einem Stück (T-300): +1, versilbert … */
  registerAufwertung(app, {
    repo,
    viewerOf,
    roh,
    sieve,
    darfSchreiben: async (request, id) => {
      const user = await viewerOf(request);
      return !!user && mayWrite(user, await ownedBy(user), id);
    },
    schreibeGeprueft: (e) => schreibeGeprueft(e),
  });
  registerKampfstart(app, { repo, feed: live, viewerOf, roh, geltend, schreibeGeprueft: (e) => schreibeGeprueft(e), insSpiel: insSpiel(spielDeps) });
  /* Der Initiative-Tracker (T-022): die Reihe gesiebt, Züge und Effekte durch die Leitung. */
  registerTracker(app, { repo, viewerOf, roh, geltend, sieve: (request, entities, bestand) => sieve(request, entities, bestand), schreibeGeprueft: (e) => schreibeGeprueft(e) });
  /* Karten finden (T-202): die Liste unter Play › Maps und wo eine Karte vorkommt. */
  registerKartenliste(app, { roh, sieve, registry: () => repo.getRegistry() });
  /* Karten am Tisch (T-115): Brotkrumen, Unterkarten, Gruppe, die Karte der Sitzung. */
  registerKarten(app, {
    repo,
    roh,
    sieve,
    geltend,
    eigeneFiguren: async (request) => (await viewerOf(request))?.actorIds ?? [],
    /* Wer die Karte leitet, sieht unter dem Nebel alles — dieselbe Frage
       wie in `sieve` vor `redactMap`. */
    leitet: async (request, karte, bestand) => {
      const user = await viewerOf(request);
      if (!user || user.isAdmin) return true;
      return seesUnfinished(bestand, karte, await augeVon(user, bestand, await repo.getRegistry()));
    },
  });

  app.put<{ Params: { id: string }; Body: unknown }>(
    '/api/entities/:id',
    async (request, reply) => {
      const parsed = EntitySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Artikel ungültig', issues: parsed.error.issues });
      }
      const entity = parsed.data as Entity;
      if (entity.id !== request.params.id) {
        return reply.code(400).send({ error: 'id im Pfad und im Körper stimmen nicht überein' });
      }
      const r = await schreiben(request, entity);
      if ('konflikt' in r) return konflikt(request, reply, entity.id, r.konflikt);
      return reply.code(r.code).send(r.body);
    },
  );

  /**
   * **Einen Artikel schreiben**, mit allen Regeln von `PUT`: gegen die
   * gelesene Revision, `ready` nur durch die Leitung, der Rückfall auf
   * `prepared` (E-012), durch `validateEntity`. Eine Funktion wie
   * `anlegen`, weil „Quelle ersetzen" an einem Bild (T-119) denselben
   * Artikel schreibt — und dieselben Regeln an zwei Stellen laufen nur so
   * lange gleich, bis sich eine ändert.
   */
  async function schreiben(
    request: FastifyRequest,
    entity: Entity,
  ): Promise<{ code: number; body: unknown } | { konflikt: number | null }> {

    /* **Gegen welchen Stand wird geschrieben?** (REQ-192) Die Revision,
       die gelesen wurde; ohne sie nur gegen „keinen" — anlegen ja,
       überschreiben nein. Ein Schreiben ohne gelesenen Stand gewänne
       sonst still gegen alles, was seither geschah. Hier zuerst
       geprüft, damit nichts anderes geschieht (der fertige Stand unten),
       und beim Schreiben noch einmal, gesperrt (`putEntity`). */
    const erwartet = entity.revision ?? null;
    const vorherRoh = await repo.getEntity(entity.id);
    const steht = vorherRoh?.revision ?? null;
    if (steht !== erwartet) return { konflikt: erwartet };

    /* **Reservierte Stücke bleiben, wie sie sind** (T-134): verkaufen,
       verschieben, verbrauchen, löschen geht erst, wenn der Auftrag
       abgeschlossen oder abgebrochen ist — oder durch die Leitung. */
    const gesperrt = await reservierteSperre(repo, await viewerOf(request), await repo.getEntity(entity.id), entity);
    /* 423 und nicht 409: ein 409 heisst in der Maske „neu laden und zusammenführen". */
    if (gesperrt) return { code: 423, body: { error: gesperrt } };

    /* Eine beschnittene Adresse (T-312) ist keine Bildquelle: zurückgeschrieben
       stünde an der Karte ein Bild, das nur für einen Nebelstand gilt. */
    if (isMap(entity) && traegtBeschnitt(entity)) {
      return { code: 400, body: { error: 'Ein beschnittenes Kartenbild ist keine Bildquelle.' } };
    }

    /* **Im Kampf zieht niemand frei** (T-198, Runde 2): läuft auf dieser
       Karte eine Begegnung, bewegen Spielende Tokens nur über den Zugplan. */
    if (vorherRoh && isMap(vorherRoh)) {
      const alleJetzt = await repo.listEntities();
      const kampagneJetzt = currentCampaign(new Map(alleJetzt.map((e) => [e.id, e])), (await repo.getRegistry()).settings ?? null);
      const sperre = zugSperre(await viewerOf(request), alleJetzt, vorherRoh, entity, kampagneJetzt?.id ?? null);
      if (sperre) return { code: 423, body: { error: sperre } };
    }

    /* **Enhancements hängt die Leitung an** (T-300, E-107): auch über den
       gewöhnlichen Schreibweg, sonst schriebe sich eine Spielerin über ihr
       Inventar einen +1-Dolch. Verglichen wird mit dem aufgelösten Stand —
       was das Stück von seiner Vorlage liest, kommt aus der Maske zurück
       und ist nicht neu. */
    if ([vorherRoh, entity].some((e) => (e?.relations ?? []).some((r) => r.type === ENCHANTED_RELATION))) {
      const bestand = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      const ziele = (e: Entity | null | undefined) =>
        new Set((e?.relations ?? []).filter((r) => r.type === ENCHANTED_RELATION).map((r) => r.to));
      const vorher = ziele(vorherRoh ? resolveInstance(bestand, vorherRoh) : null);
      const nachher = ziele(entity);
      const neu = [...nachher].filter((z) => !vorher.has(z));
      if (neu.length || [...vorher].some((z) => !nachher.has(z))) {
        const wer = await viewerOf(request);
        const kampagneJetzt = currentCampaign(bestand, (await repo.getRegistry()).settings ?? null);
        const darf = !!wer && (leitetTisch(wer, kampagneJetzt?.id ?? null) || enhancementsByOf(kampagneJetzt) === 'players');
        if (!darf) return { code: 403, body: { error: 'Enhancements hängt die Leitung an.' } };
        const ohne = { ...entity, relations: (entity.relations ?? []).filter((r) => !(r.type === ENCHANTED_RELATION && neu.includes(r.to))) };
        bestand.set(entity.id, ohne);
        for (const z of neu) {
          const nein = enhancementRefusal(bestand, ohne, z);
          if (nein) return { code: 400, body: { error: nein } };
        }
      }
    }

    /* **`ready` setzt die Leitung** (REQ-237, E-011): wer nicht
       `maySetReady` ist, macht aus einem unfertigen Artikel keinen
       fertigen — auch nicht, indem er die Status-Karte weglässt (ohne
       Karte gilt er als fertig, `isReady`). Die eigene Figur ist
       ausgenommen (E-014 d).

       **Ändert eine Spielerin einen fertigen Artikel, fällt er auf
       `prepared`** (E-012), und der Stand davor bleibt als Kopie
       (`entity_ready`): für alle anderen gilt er weiter, bis die Leitung
       wieder `ready` setzt. Jede Änderung zählt — Lore hat keinen
       Spielstand. Ändert die Leitung selbst, fällt nichts zurück. */
    const schreiber = await viewerOf(request);
    const registry = await repo.getRegistry();
    let zurueck: ReadyStand | null = null;
    if (schreiber && !schreiber.isAdmin) {
      const bestand = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      const vorher = bestand.get(entity.id);
      const figur = eigeneFigur(schreiber, bestand, registry);
      if (!maySetReady(schreiber, bestand, vorher ?? entity, figur)) {
        const warFertig = vorher ? isReady(vorher) : false;
        /* Ohne Stand in der Art gibt es nichts, worauf er fallen könnte. */
        const traegtStand = typeChain(registry, primaryInterface(entity)).includes(STATUS_COMPONENT);
        if (warFertig && vorher && traegtStand && kern(vorher) !== kern(entity)) {
          entity.components = {
            ...(entity.components ?? {}),
            [STATUS_COMPONENT]: { ...(entity.components?.[STATUS_COMPONENT] ?? {}), status: 'prepared' },
          };
          zurueck = { entity: vorher, at: typeof vorher.updatedAt === 'string' ? vorher.updatedAt : new Date().toISOString() };
        } else if (!warFertig && isReady(entity)) {
          return { code: 403, body: { error: '„ready" setzt die Leitung.' } };
        }
      }
    }

    let ergebnis: Awaited<ReturnType<typeof schreibeGeprueft>>;
    try {
      ergebnis = await schreibeGeprueft(entity, async () => {
        /* Vor dem Artikel: mit ihm ändert sich der Stempel, und erst dann
           liest jemand den neuen Stand (`fertigeStaende`). */
        if (zurueck) await repo.keepReadyStand(zurueck);
        else if (isReady(entity)) await repo.dropReadyStand(entity.id);
      }, erwartet);
    } catch (error) {
      if (error instanceof RevisionConflict) return { konflikt: erwartet };
      throw error;
    }
    if ('issues' in ergebnis) {
      return { code: 422, body: { error: 'Validierung fehlgeschlagen', issues: ergebnis.issues } };
    }
    await repo.appendEvent('entity.written', entity.id, {
      interfaces: entity.interfaces,
      cards: Object.keys(entity.components ?? {}),
      ...(zurueck ? { fellBack: true } : {}),
    });
    /* **Der Tisch zieht weiter** (T-140): wechselt an der Sitzung Szene,
       Kampf oder Karte und gilt `immediately`, bleibt liegen, was nicht
       verstaut ist. Nach dem Schreiben — die Sitzung steht dann schon. */
    if (vorherRoh && tableMovedOn(vorherRoh, entity) && typeChain(registry, primaryInterface(entity)).includes('Session')) {
      const kampagne = currentCampaign(new Map((await repo.listEntities()).map((e) => [e.id, e])), registry.settings ?? null);
      if (kampagne && stowingRuleOf(kampagne) === 'immediately') {
        await liegenlassen({ repo, roh, schreibeGeprueft: (e, erwartet) => schreibeGeprueft(e, undefined, erwartet) }, entity.id, kampagne, 'movedOn');
        const frisch = await repo.getEntity(entity.id);
        if (frisch) return { code: 200, body: frisch };
      }
    }
    return { code: 200, body: ergebnis.stored };
  }

  /**
   * **Prüfen und schreiben** — für `PUT` und den Knopf „ready". Eine
   * Instanz wird aufgelöst geprüft und ausgedünnt gespeichert. `vorher`
   * läuft nach der Prüfung und vor dem Schreiben.
   */
  async function schreibeGeprueft(
    entity: Entity,
    vorher?: () => Promise<void>,
    /** Die gelesene Revision (`null`: neu); ohne Angabe ungeprüft. */
    erwartet?: number | null,
  ): Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }> {
    const registry = await repo.getRegistry();
    /* Id **und Art**: daran prüft ein Verweisfeld seinen Zieltyp. Der
       Artikel selbst kommt dazu, weil er in diesem Augenblick noch nicht
       im Bestand steht und ein Verweis auf sich selbst kein Bruch ist. */
    const liste = await repo.listEntities();
    const known = new Map(liste.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
    known.set(entity.id, entity.interfaces?.[0] ?? '');
    /* Welche Zustände Stufen eines Grundzustands sind (D48) — gerechnet
       aus den Kanten, nicht gespeichert. */
    const stufen = stageBases([...liste, entity]);

    /* **Eine Instanz wird aufgelöst geprüft und ausgedünnt gespeichert.**
       Ihre Pflichtfelder stehen an der Vorlage; gespeichert wird nur, was
       abweicht. Eine Maske, die den aufgelösten Artikel zurückschickt,
       schreibt so nicht still jeden Wert der Vorlage fest — und wer den
       Wert der Vorlage einträgt, folgt ihr wieder. */
    let zuSchreiben = entity;
    let zuPruefen = entity;
    if (isInstance(entity)) {
      const alle = new Map(liste.map((e) => [e.id, e]));
      alle.set(entity.id, entity);
      zuPruefen = resolveInstance(alle, entity);
      zuSchreiben = thinInstance(alle, entity);
    }

    const issues = [...validateEntity(registry, zuPruefen, { knownTypes: known, stageOf: stufen }), ...doppelteWahlen(liste.find((e) => e.id === entity.id), entity, liste)];
    if (issues.length) return { issues };
    if (vorher) await vorher();
    return {
      stored: await repo.putEntity(zuSchreiben, erwartet === undefined ? {} : { expectRevision: erwartet }),
    };
  }

  /**
   * **Abgewiesen, mit dem Stand, der gilt** (REQ-192). Die Antwort trägt
   * den Artikel so, wie dieser Betrachter ihn sieht — gesiebt, aufgelöst,
   * mit seinen Namen —, damit die Maske ohne zweite Anfrage
   * zusammenführen kann (`mergeEntity`). Sieht er ihn nicht mehr, steht
   * `current: null` da und nicht mehr.
   */
  async function konflikt(
    request: FastifyRequest,
    reply: FastifyReply,
    id: string,
    erwartet: number | null,
  ): Promise<FastifyReply> {
    const stand = await roh();
    const jetzt = stand.map.get(id) ?? (await repo.getEntity(id));
    const [gesiebt] = jetzt ? await sieve(request, [jetzt], stand.map) : [];
    const current = gesiebt ? { ...gesiebt, refs: await bezuegeVon(request, gesiebt) } : null;
    return reply.code(409).send({
      error:
        erwartet === null
          ? 'Diesen Artikel gibt es schon. Schicke die Revision mit, die du gelesen hast.'
          : 'Der Artikel wurde seit dem Lesen anderswo geändert.',
      revision: current?.revision ?? null,
      current,
    });
  }

  /**
   * **„ready" per Knopf** (REQ-237, E-014 d): die Liste „not ready, by
   * players" setzt damit, ohne den Artikel zu öffnen. Wer darf, sagt
   * `maySetReady`; der neue Stand gilt, ein älterer fertiger fällt weg.
   */
  app.post<{ Params: { id: string } }>('/api/entities/:id/ready', async (request, reply) => {
    const user = await viewerOf(request);
    const registry = await repo.getRegistry();
    const bestand = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const e = bestand.get(request.params.id);
    if (!e) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (user && !maySetReady(user, bestand, e, eigeneFigur(user, bestand, registry))) {
      return reply.code(403).send({ error: '„ready" setzt die Leitung.' });
    }
    if (!typeChain(registry, primaryInterface(e)).includes(STATUS_COMPONENT)) {
      return reply.code(400).send({ error: 'Diese Art trägt keinen Stand.' });
    }
    const neu: Entity = {
      ...e,
      components: { ...(e.components ?? {}), [STATUS_COMPONENT]: { ...(e.components?.[STATUS_COMPONENT] ?? {}), status: 'ready' } },
    };
    const ergebnis = await schreibeGeprueft(neu, () => repo.dropReadyStand(e.id));
    if ('issues' in ergebnis) {
      return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: ergebnis.issues });
    }
    await repo.appendEvent('entity.ready', e.id, { by: user?.id ?? null });
    return ergebnis.stored;
  });

  /**
   * **Was wartet** (REQ-237, Punkt 7): was Spielende angelegt haben und
   * nicht `ready` ist — für die Leitung, mit den Namen der Verfasser und,
   * wenn schon ein fertiger Stand gilt, seinem Datum. Die eigene Figur
   * wartet auf niemanden (E-014 d) und steht nicht darin. `canReady` sagt,
   * ob dieser Betrachter den Knopf hat (`gm`, nicht `co-gm`).
   */
  app.get('/api/unready', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user || !isLeitung(user)) return reply.code(403).send({ error: 'Das sieht die Leitung.' });
    const registry = await repo.getRegistry();
    const bestand = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const frei = await ausgenommen(bestand, registry);
    const fertig = await fertigeStaende();
    const namen = new Map((await repo.listUsers()).map((u) => [u.id, u.name]));
    const rows = [];
    for (const id of await repo.authoredArticles()) {
      const e = bestand.get(id);
      if (!e || isReady(e) || frei.has(id)) continue;
      if (!user.isAdmin && !seesUnfinished(bestand, e, { roles: user.roles ?? {} })) continue;
      rows.push({
        id,
        name: entityName(e),
        type: primaryInterface(e),
        status: String((e.components?.[STATUS_COMPONENT] as { status?: unknown } | undefined)?.status ?? ''),
        authors: (await repo.authorsOf(id)).map((a) => namen.get(a) ?? a),
        readyAt: fertig.get(id)?.at ?? null,
        updatedAt: e.updatedAt ?? null,
        canReady: maySetReady(user, bestand, e),
      });
    }
    rows.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
    return { rows };
  });

  app.delete<{ Params: { id: string } }>('/api/entities/:id', async (request, reply) => {
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const weg = alle.get(request.params.id);
    /* **Eine Ebene mit Inhalt löscht nur die Verwaltung** (T-098): ihre
       Artikel stünden danach in keiner aufgeschalteten Ebene und wären für
       niemanden mehr da. Eine leere darf, wer darin schreibt. */
    const wer = await viewerOf(request);
    if (weg && wer && !wer.isAdmin && primaryInterface(weg) === 'Layer') {
      const inhalt = [...alle.values()].filter((e) => e.id !== weg.id && layersOf(e).includes(weg.id));
      /* Mit Aufzählung (T-164): wer löschen wollte, sieht, was darin liegt —
         und kann es übernehmen (`POST /api/layers/:layer/takeover`). */
      if (inhalt.length) {
        return reply.code(409).send({
          error: 'In dieser Ebene liegen Artikel; eine Ebene mit Inhalt löscht die Verwaltung.',
          contents: inhalt.map((e) => ({ id: e.id, name: entityName(e), type: primaryInterface(e) })),
        });
      }
    }
    /* Reserviertes Material geht nicht mit; ein Auftrag gibt seines vorher frei (T-134). */
    if (weg) {
      const gesperrt = await vorDemLoeschen(repo, wer, weg, alle);
      if (gesperrt) return reply.code(423).send({ error: gesperrt });
    }
    if (weg) {
      /* Eine Vorlage nimmt beim Gehen nichts mit: ihre Instanzen bekommen
         vorher, was sie von ihr lasen. */
      for (const instanz of instancesOf(alle, weg)) {
        await repo.putEntity(detachInstance(alle, instanz));
      }
      /* Eine Kreatur nimmt ihre Instanz mit — die steht in keiner Liste und
         gehört nur ihr. Ein eigener Statblock bleibt stehen. */
      const registry = await repo.getRegistry();
      const teilVon = new Set(
        Object.values(registry.relations).filter((r) => r.asField === 'to').map((r) => r.type),
      );
      for (const o of alle.values()) {
        if (o.id === weg.id || !isInstance(o)) continue;
        if ((o.relations ?? []).some((r) => teilVon.has(r.type) && r.to === weg.id)) {
          await repo.deleteEntity(o.id);
        }
      }
    }
    /* Ein fertiger Stand geht mit (REQ-237) — vor dem Artikel, siehe `fertigeStaende`. */
    await repo.dropReadyStand(request.params.id);
    const removed = await repo.deleteEntity(request.params.id);
    if (!removed) return reply.code(404).send({ error: 'Nicht gefunden' });
    /* Wer in einer gelöschten Ebene schrieb, schreibt in nichts mehr. */
    if (weg && primaryInterface(weg) === 'Layer') {
      for (const g of await repo.layerGrants()) if (g.layerId === weg.id) await repo.revokeLayer(g.userId, g.layerId);
    }
    /* Ein Bild nimmt seine Datei mit, wenn kein anderes Asset sie nennt (T-114). */
    if (weg) await bilder.aufraeumen(weg);
    await repo.appendEvent('entity.deleted', request.params.id, {});
    return { ok: true };
  });

  /**
   * **Anpassen über der Vorlage** (E-018 a, T-082, REQ-240): aus einem
   * Artikel einer geteilten Ebene — einem Kapitel, einer Szene, einer
   * Begegnung, einer Karte aus einem Abenteuer — wird eine Fassung in der
   * Ebene der laufenden Kampagne (`campaignLayer`), die ihn über
   * `overrides` ersetzt (`adaptedVersion`). Das Original bleibt; eine
   * Korrektur daran erreicht jede Runde, die es nicht angepasst hat, und
   * zurück heisst, die Fassung zu löschen. Gibt es die Fassung schon,
   * kommt sie zurück und keine zweite.
   *
   * **„Edit" an einem fremden Artikel ist dasselbe** (T-098, E-001): wer
   * ihn nicht schreibt, aber eine Zielebene hat (`anpassZiele` — eigene
   * oder zugeteilte Ebenen im Spiel, als Leitung die Ebene der Kampagne),
   * bekommt die Fassung dort. Gibt es mehrere, nennt die Maske eine
   * (`{ layer }`); ohne Angabe antwortet der Server 409 mit der Auswahl.
   * Die Fassung schreibt danach, wer in ihrer Ebene schreibt.
   */
  app.post<{ Params: { id: string }; Body: { layer?: unknown } | null }>('/api/entities/:id/adapt', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const registry = await repo.getRegistry();
    const stand = await roh();
    const original = stand.map.get(request.params.id);
    /* Was dieser Betrachter nicht sieht, kann er auch nicht anpassen — auch
       ein Original, das schon eine Fassung ersetzt, steht im Stapel. */
    const gesehen = original ? (await sieve(request, [original], stand.map, undefined, 'versions')).length > 0 : false;
    if (!original || !gesehen) return reply.code(404).send({ error: 'Nicht gefunden' });
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const ziele = await anpassZiele(request, original, stand.map);
    if (!kampagne || !ziele.length) {
      if (!user.isAdmin) return reply.code(403).send({ error: 'Dafür hast du keine Ebene, in der du schreibst.' });
      const ebene = await kampagnenEbene(stand.map, kampagne);
      if (!kampagne || !ebene) {
        return reply.code(409).send({ error: 'Die laufende Kampagne hat keine eigene Ebene, in der die Fassung liegen könnte.' });
      }
      if (layersOf(original).includes(ebene.id)) {
        return reply.code(409).send({ error: 'Das liegt schon in der Ebene der Kampagne — hier wird direkt bearbeitet.' });
      }
      return reply.code(409).send({ error: 'Seine Ebene ist in dieser Kampagne nicht aufgeschaltet.' });
    }
    const gewuenscht = String(request.body?.layer ?? '');
    /* Ohne Nennung in die gewählte Schreibebene, wenn eine Fassung dorthin
       darf (T-161); ohne Wahl fragt der Server bei mehreren zurück. */
    const schreibt = gewuenscht ? null : await gewaehlteSchreibEbene(user, stand.map, kampagne);
    const ebene = gewuenscht
      ? ziele.find((l) => l.id === gewuenscht)
      : ziele.length === 1
        ? ziele[0]
        : ziele.find((l) => l.id === schreibt?.id);
    if (!ebene) {
      return reply.code(409).send({
        error: gewuenscht ? 'In diese Ebene geht keine Fassung von dir.' : 'In welche Ebene?',
        layers: ziele.map((l) => ({ id: l.id, name: entityName(l) })),
      });
    }
    const schon = stand.alle.find(
      (e) => layersOf(e).includes(ebene.id) && (e.relations ?? []).some((r) => r.type === OVERRIDES_RELATION && r.to === original.id),
    );
    if (schon) return reply.code(200).send({ id: schon.id, created: false });

    const neueId = (): string => `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    let id = neueId();
    while (stand.map.has(id)) id = neueId();
    const typ = original.interfaces?.[0] ?? '';
    const fassung = adaptedVersion(original, { id, number: nextId(stand.alle, typ), layer: ebene.id });
    const known = new Map(stand.alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
    known.set(id, typ);
    const issues = validateEntity(registry, fassung, { knownTypes: known, stageOf: stageBases([...stand.alle, fassung]) });
    if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
    await repo.putEntity(fassung);
    await repo.appendEvent('entity.created', id, { interfaces: fassung.interfaces, adapts: original.id, layer: ebene.id, by: user.id });
    return reply.code(201).send({ id, created: true });
  });

  /**
   * Dry-run validation, so the editor can warn before anything is written.
   * Same code path as the write — there is deliberately no second implementation.
   */
  app.post<{ Body: unknown }>('/api/validate', async (request, reply) => {
    const parsed = EntitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Artikel ungültig', issues: parsed.error.issues });
    }
    const registry = await repo.getRegistry();
    const known = new Map(
      (await repo.listEntities()).map((e) => [e.id, e.interfaces?.[0] ?? ''] as const),
    );
    /* Dieselbe Auflösung wie beim Schreiben: eine Instanz ohne eigene
       Trefferpunkte ist keine unvollständige. */
    let pruefling = parsed.data as Entity;
    if (isInstance(pruefling)) {
      const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      alle.set(pruefling.id, pruefling);
      pruefling = resolveInstance(alle, pruefling);
    }
    const stufen = stageBases([...(await repo.listEntities()), pruefling]);
    return { issues: validateEntity(registry, pruefling, { knownTypes: known, stageOf: stufen }) };
  });

  // ---------------------------------------------------------- API-Tokens
  /*
   * Eigene Tokens anlegen, ansehen, widerrufen (W9). Nur aus einer
   * angemeldeten Sitzung, nie mit einem Token: ein Token, das Tokens
   * anlegt, machte aus `read` ein `write`, und aus einem verlorenen eines
   * zehn.
   */
  async function nurSitzung(request: FastifyRequest): Promise<User | string> {
    const wer = await werIst(request);
    if (!wer) return 'Nicht angemeldet.';
    if (wer.token) return 'Tokens werden in einer angemeldeten Sitzung verwaltet, nicht mit einem Token.';
    return wer.user;
  }
  const tokenAus = (t: ApiToken) => ({
    id: t.id,
    name: t.name,
    scope: t.scope,
    expiresAt: t.expiresAt,
    createdAt: t.createdAt ?? null,
    lastUsedAt: t.lastUsedAt ?? null,
  });

  app.get('/api/tokens', async (request, reply) => {
    const user = await nurSitzung(request);
    if (typeof user === 'string') return reply.code(403).send({ error: user });
    return (await repo.listTokens(user.id)).map(tokenAus);
  });

  app.post<{ Body: { name?: string; scope?: string; days?: number; expiresAt?: string } }>('/api/tokens', async (request, reply) => {
    const user = await nurSitzung(request);
    if (typeof user === 'string') return reply.code(403).send({ error: user });
    const name = String(request.body?.name ?? '').trim();
    if (!name) return reply.code(400).send({ error: 'Ein Token braucht einen Namen — woran erkennst du es sonst?' });
    const scope = (request.body?.scope ?? 'read') as TokenScope;
    if (!TOKEN_SCOPES.includes(scope)) return reply.code(400).send({ error: 'Rechte: read oder write.' });
    /* Ein Datum (die Maske, T-112) oder Tage (Kommandozeile, Skripte). */
    let ablauf = tokenExpiry(request.body?.days);
    if (request.body?.expiresAt !== undefined) {
      const bis = tokenExpiryAt(request.body.expiresAt);
      if (!bis) return reply.code(400).send({ error: 'Das Ablaufdatum muss in der Zukunft liegen.' });
      ablauf = bis;
    }
    const klartext = newApiToken();
    const token: ApiToken = {
      id: `tok_${newInviteCode().slice(0, 12)}`,
      userId: user.id,
      name: name.slice(0, 80),
      tokenHash: hashToken(klartext),
      scope,
      expiresAt: ablauf.toISOString(),
    };
    await repo.createToken(token);
    await repo.appendEvent('token.created', user.id, { id: token.id, name: token.name, scope, expiresAt: token.expiresAt });
    /* Einmal und nie wieder — gespeichert ist nur der Hash. */
    return reply.code(201).send({ ...tokenAus(token), token: klartext });
  });

  app.delete<{ Params: { id: string } }>('/api/tokens/:id', async (request, reply) => {
    const user = await nurSitzung(request);
    if (typeof user === 'string') return reply.code(403).send({ error: user });
    if (!(await repo.dropToken(user.id, request.params.id))) return reply.code(404).send({ error: 'Nicht gefunden' });
    await repo.appendEvent('token.revoked', user.id, { id: request.params.id });
    return { ok: true };
  });

  // ------------------------------------------------------------ Werkbank
  /*
   * Prüfungen und Massenänderungen (W9) — für Leitung und Verwaltung.
   * Gerechnet wird über den Bestand, **wie ihn der Fragende sieht** (das
   * Sieb), geschrieben nur, was `mayWrite` ihm erlaubt, und jeder Artikel
   * geht durch `validateEntity`.
   */
  async function werkbankFuer(request: FastifyRequest): Promise<Wer | string> {
    const echt = await werIst(request);
    if (!echt) return 'Nicht angemeldet.';
    /* In der Sicht eines Mitglieds rechnet auch die Werkbank mit ihm (REQ-241). */
    const sicht = await sichtVon(request);
    const wer = sicht && sicht !== 'nein' ? { ...echt, user: sicht.als } : echt;
    if (!isLeitung(wer.user)) return 'Die Werkbank ist für Leitung und Verwaltung.';
    return wer;
  }

  app.get<{ Querystring: { check?: string; limit?: string } }>('/api/checks', async (request, reply) => {
    const wer = await werkbankFuer(request);
    if (typeof wer === 'string') return reply.code(403).send({ error: wer });
    const t0 = Date.now();
    const alle = await repo.listEntities();
    const gesiebt = await sieve(request, alle, alle);
    const registry = await repo.getRegistry();
    const exists = new Map(alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
    const roh = String(request.query.limit ?? '50');
    const limit = roh === 'all' ? Number.MAX_SAFE_INTEGER : Math.max(0, Math.floor(Number(roh)) || 0);
    const only = request.query.check ? request.query.check.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
    const checks = runChecks({ registry, entities: gesiebt, exists, seed: seedRegistry }, { limit, ...(only ? { only } : {}) });
    return { total: gesiebt.length, ms: Date.now() - t0, checks };
  });

  /** Ein Artikel in einer Antwort der Werkbank: wer, was, was sich ändert. */
  const zeile = (c: BulkChange) => {
    const e = c.after ?? c.before!;
    return {
      id: c.id,
      name: String(e.components?.['Identity']?.['name'] ?? e.name ?? c.id),
      type: e.interfaces?.[0] ?? '',
      change: c.after === null ? 'delete' : c.before === null ? 'create' : 'update',
      summary: c.summary,
    };
  };

  /**
   * Prüft die Nachher-Fassungen eines Laufs, als stünden sie schon da:
   * Instanzen aufgelöst geprüft und ausgedünnt gespeichert (wie `PUT`),
   * Rechte je Artikel. Gibt die Änderungen zurück, wie sie geschrieben
   * würden, und die Abgelehnten.
   */
  async function pruefeLauf(user: User, registry: Registry, roh: Map<string, Entity>, changes: BulkChange[]) {
    const danach = new Map(roh);
    for (const c of changes) {
      if (c.after) danach.set(c.id, c.after);
      else danach.delete(c.id);
    }
    const known = new Map([...danach.values()].map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
    /* Einmal, nicht je Artikel (siehe `invalid` in checks.ts). */
    const ids = new Set(known.keys());
    const stufen = stageBases(danach.values());
    const eigen = user.isAdmin ? null : await ownedBy(user);
    /* Was erst entsteht — oder beim Zurücknehmen wiederkommt —, steht im
       heutigen Bestand nicht: es zählt, ob es danach dem Konto gehört
       (T-176). Was schon steht, zählt wie es vorher war; sonst eignete sich
       an, wer eine Ebenenkante dazuschreibt. */
    const eigenDanach = user.isAdmin || !changes.some((c) => !roh.has(c.id)) ? null : await ownedBy(user, danach.values());
    const abgelehnt: { id: string; name: string; type: string; issues: string[] }[] = [];
    const geprueft: BulkChange[] = [];
    for (const c of changes) {
      const e = c.after ?? c.before!;
      const name = String(e.components?.['Identity']?.['name'] ?? e.name ?? c.id);
      const pruefe = !roh.has(c.id) && eigenDanach ? eigenDanach : eigen;
      if (pruefe && !mayWrite(user, pruefe, c.id)) {
        abgelehnt.push({ id: c.id, name, type: e.interfaces?.[0] ?? '', issues: ['Das gehört dir nicht.'] });
        continue;
      }
      if (!c.after) {
        geprueft.push(c);
        continue;
      }
      const pruefling = isInstance(c.after) ? resolveInstance(danach, c.after) : c.after;
      const issues = validateEntity(registry, pruefling, { knownTypes: known, knownIds: ids, stageOf: stufen });
      if (issues.length) {
        abgelehnt.push({ id: c.id, name, type: e.interfaces?.[0] ?? '', issues: issues.map((i) => i.message) });
        continue;
      }
      const after = isInstance(c.after) ? thinInstance(danach, c.after) : c.after;
      if (c.before && storedKey(after) === storedKey(c.before)) continue;
      geprueft.push({ ...c, after });
    }
    return { geprueft, abgelehnt };
  }

  /**
   * Eine Massenänderung. `dryRun: true` sagt, was geschähe — Zahl,
   * Beispiele, Ablehnungen —, und schreibt nichts. Ohne `dryRun` geht jeder
   * Artikel durch `validateEntity`; besteht einer nicht, wird **nichts**
   * geschrieben (ausser `skipRejected`, und nie beim Löschen). Vor dem
   * ersten Schreiben steht das Ereignis im Protokoll, mit jeder alten
   * Fassung: bricht der Lauf mittendrin ab, ist er trotzdem rückgängig zu
   * machen.
   */
  app.post<{ Body: unknown }>('/api/bulk', async (request, reply) => {
    const wer = await werkbankFuer(request);
    if (typeof wer === 'string') return reply.code(403).send({ error: wer });
    const parsed = BulkRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Massenänderung ungültig', issues: parsed.error.issues });
    const auftrag = parsed.data;
    const falsch = (auftrag.select.where ?? []).map(conditionProblem).filter((x): x is string => !!x);
    if (falsch.length) return reply.code(400).send({ error: falsch.join('; ') });
    const allein = auftrag.ops.find((o) => o.op === 'merge' || o.op === 'delete');
    if (allein && auftrag.ops.length > 1) {
      return reply.code(400).send({
        error: allein.op === 'merge'
          ? 'Zusammenführen steht allein — nicht mit anderen Operationen in einem Lauf.'
          : 'Löschen steht allein — nicht mit anderen Operationen in einem Lauf.',
      });
    }
    if (!auftrag.select.ids?.length && !auftrag.select.types?.length && !auftrag.select.layer && !auftrag.select.tag && !auftrag.select.where?.length) {
      return reply.code(400).send({ error: 'Eine Auswahl ohne Bedingung träfe den ganzen Bestand — sag, welche Artikel.' });
    }

    const t0 = Date.now();
    const alle = await repo.listEntities();
    const roh = new Map(alle.map((e) => [e.id, e]));
    const registry = await repo.getRegistry();
    const gesiebt = await sieve(request, alle, alle);
    const auswahl = selectEntities(registry, gesiebt, auftrag.select);
    const r = await fuehreLaufAus(request, wer, registry, roh, auftrag, auswahl.map((e) => e.id));
    return reply.code(r.code).send({ ...r.body, ms: Date.now() - t0 });
  });

  /**
   * Was `/api/bulk` und „Empty this layer" gemeinsam tun (T-176): planen,
   * prüfen, und ohne `dryRun` schreiben — mit jeder alten Fassung vorher
   * im Protokoll (`bulk`), damit Werkbank › Undo es zurücknimmt.
   */
  async function fuehreLaufAus(
    request: FastifyRequest,
    wer: Wer,
    registry: Registry,
    roh: Map<string, Entity>,
    auftrag: BulkRequest,
    ausgewaehlt: string[],
  ): Promise<{ code: number; body: Record<string, unknown> }> {
    const plan = planBulk(registry, roh, ausgewaehlt, auftrag.ops);
    const { geprueft, abgelehnt } = await pruefeLauf(wer.user, registry, roh, plan.changes);
    const loescht = geprueft.filter((c) => !c.after).length;
    const limit = auftrag.limit ?? 50;
    const antwort = {
      dryRun: auftrag.dryRun === true,
      selected: plan.selected,
      changed: geprueft.length - loescht,
      deleted: loescht,
      examples: geprueft.slice(0, limit).map(zeile),
      rejected: abgelehnt.slice(0, limit),
      rejectedCount: abgelehnt.length,
      skipped: plan.skipped.slice(0, limit),
      skippedCount: plan.skipped.length,
    };
    if (auftrag.dryRun) return { code: 200, body: antwort };

    if (loescht > 1 && auftrag.confirmDelete !== loescht) {
      return {
        code: 409,
        body: { ...antwort, error: `Dieser Lauf löscht ${loescht} Artikel. Bestätige mit "confirmDelete": ${loescht}.` },
      };
    }
    if (abgelehnt.length && (!auftrag.skipRejected || loescht > 0)) {
      return {
        code: 422,
        body: { ...antwort, error: `${abgelehnt.length} Artikel bestehen die Prüfung nicht — nichts geschrieben.` },
      };
    }
    if (!geprueft.length) return { code: 200, body: { ...antwort, id: null } };

    const { dryRun: _d, ...was } = auftrag;
    const id = await repo.appendEvent('bulk', undefined, {
      by: { id: wer.user.id, name: wer.user.name },
      token: wer.token?.name ?? null,
      request: was,
      selected: plan.selected,
      changed: antwort.changed,
      deleted: loescht,
      summary: geprueft.slice(0, 5).map((c) => `${zeile(c).name}: ${c.summary.join(', ')}`),
      changes: geprueft.map((c) => ({ id: c.id, before: c.before, after: c.after })),
    });
    let geschrieben = 0;
    try {
      /* Zuerst die gehenden: ein bleibender Artikel nimmt ihre Kanten mit,
         und eine Kanten-Id ist Schlüssel der ganzen Tabelle. */
      for (const c of geprueft) if (!c.after) {
        await repo.deleteEntity(c.id);
        geschrieben += 1;
      }
      for (const c of geprueft) if (c.after) {
        await repo.putEntity(c.after);
        geschrieben += 1;
      }
    } catch (error) {
      request.log.error(error);
      return {
        code: 500,
        body: { error: `Abgebrochen nach ${geschrieben} von ${geprueft.length} Artikeln. Rückgängig: POST /api/bulk/${id}/undo`, id },
      };
    }
    return { code: 200, body: { ...antwort, id } };
  }

  /**
   * **Eine Ebene leeren** (T-176): alles, was in ihr liegt, samt Teilen und
   * Kanten darauf, als **eine** Massenänderung — zurück über Werkbank ›
   * Undo. Die Ebene selbst bleibt, mit ihren Rechten und ihrer Aufschaltung.
   * Dürfen: die Verwaltung und wer die Ebene besitzt; geschrieben wird nur,
   * was das Konto auch einzeln schreiben dürfte (`pruefeLauf`), sonst
   * nichts. `dryRun` zeigt Zahl und Liste, `confirmDelete` nennt die Zahl
   * aus der Vorschau, wie bei jeder Massenänderung.
   */
  app.post<{ Params: { layer: string }; Body: { dryRun?: unknown; confirmDelete?: unknown; limit?: unknown } | null }>(
    '/api/layers/:layer/empty',
    async (request, reply) => {
      const echt = await werIst(request);
      if (!echt || echt.user.disabledAt) return reply.code(401).send({ error: 'Nicht angemeldet.' });
      if (await sichtVon(request)) return reply.code(403).send({ error: 'In einer Sicht wird nicht geleert.' });
      const t0 = Date.now();
      const alle = await repo.listEntities();
      const roh = new Map(alle.map((e) => [e.id, e]));
      const l = roh.get(request.params.layer);
      if (!l || primaryInterface(l) !== LAYER_COMPONENT) return reply.code(404).send({ error: 'Diese Ebene gibt es nicht.' });
      if (!echt.user.isAdmin && !(echt.user.ownedLayerIds ?? []).includes(l.id)) {
        return reply.code(403).send({ error: 'Eine Ebene leeren die Verwaltung und wer sie besitzt.' });
      }
      const b = request.body ?? {};
      const auftrag: BulkRequest = {
        select: { layer: l.id },
        ops: [{ op: 'delete' }],
        dryRun: b.dryRun === true,
        ...(typeof b.confirmDelete === 'number' ? { confirmDelete: b.confirmDelete } : {}),
        limit: typeof b.limit === 'number' ? Math.min(5000, Math.max(0, Math.floor(b.limit))) : 200,
        note: `Empty layer ${entityName(l)}`,
      };
      const drin = alle.filter((e) => e.id !== l.id && layersOf(e).includes(l.id)).map((e) => e.id);
      const r = await fuehreLaufAus(request, echt, await repo.getRegistry(), roh, auftrag, drin);
      return reply.code(r.code).send({ ...r.body, layer: { id: l.id, name: entityName(l) }, ms: Date.now() - t0 });
    },
  );

  /** Die letzten Massenänderungen, ohne ihre alten Fassungen. */
  app.get<{ Querystring: { limit?: string } }>('/api/bulk', async (request, reply) => {
    const wer = await werkbankFuer(request);
    if (typeof wer === 'string') return reply.code(403).send({ error: wer });
    const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 20));
    const laeufe = await repo.listEvents({ name: 'bulk', limit, light: true });
    const zurueck = new Set((await repo.listEvents({ name: 'bulk.undone', limit: 1000, light: true })).map((e) => e.subject));
    return laeufe.map((e) => ({ id: e.id, at: e.at, undone: zurueck.has(e.id), ...(e.payload as object) }));
  });

  /**
   * Eine Massenänderung zurücknehmen: jede alte Fassung wieder hin, jeder
   * gelöschte Artikel wieder da. Hat jemand einen Artikel seither anders
   * geändert, steht er als Konflikt da, und es geschieht nichts — ausser
   * mit `force`, dann gewinnt die alte Fassung. Auch das geht durch
   * `validateEntity`, und auch das steht im Protokoll.
   */
  app.post<{ Params: { id: string }; Body: { force?: boolean; dryRun?: boolean } | null }>(
    '/api/bulk/:id/undo',
    async (request, reply) => {
      const ereignis = await repo.getEvent(request.params.id);
      if (!ereignis || ereignis.name !== 'bulk') return reply.code(404).send({ error: 'Nicht gefunden' });
      /* Wer eine eigene Ebene geleert hat, nimmt das selbst zurück (T-176),
         auch ohne Werkbank. */
      const echt = await werIst(request);
      const selbst = !!echt && !(await sichtVon(request)) && (ereignis.payload as { by?: { id?: string } }).by?.id === echt.user.id;
      const wer = selbst ? echt! : await werkbankFuer(request);
      if (typeof wer === 'string') return reply.code(403).send({ error: wer });
      if ((await repo.listEvents({ name: 'bulk.undone', subject: ereignis.id, limit: 1, light: true })).length) {
        return reply.code(409).send({ error: 'Schon rückgängig gemacht.' });
      }
      const payload = ereignis.payload as { changes?: { id: string; before: Entity | null; after: Entity | null }[] };
      const alle = await repo.listEntities();
      const roh = new Map(alle.map((e) => [e.id, e]));
      const konflikte: { id: string; name: string; reason: string }[] = [];
      const zurueck: BulkChange[] = [];
      for (const c of [...(payload.changes ?? [])].reverse()) {
        const jetzt = roh.get(c.id) ?? null;
        const name = String((c.before ?? c.after)?.components?.['Identity']?.['name'] ?? c.id);
        if (storedKey(jetzt) === storedKey(c.before)) continue; // steht schon wie vorher
        if (storedKey(jetzt) !== storedKey(c.after)) {
          konflikte.push({
            id: c.id,
            name,
            reason: jetzt ? (c.after ? 'changed since' : 'exists again') : 'deleted since',
          });
          if (!request.body?.force) continue;
        }
        zurueck.push({ id: c.id, before: jetzt, after: c.before, summary: [] });
      }
      if (konflikte.length && !request.body?.force) {
        return reply.code(409).send({ error: `${konflikte.length} Artikel wurden seither geändert. Mit "force": true gewinnt die alte Fassung.`, conflicts: konflikte });
      }
      const registry = await repo.getRegistry();
      const { geprueft, abgelehnt } = await pruefeLauf(wer.user, registry, roh, zurueck);
      const antwort = { restored: geprueft.length, conflicts: konflikte, rejected: abgelehnt };
      if (request.body?.dryRun) return { dryRun: true, ...antwort };
      if (abgelehnt.length) return reply.code(422).send({ error: 'Die alten Fassungen bestehen die Prüfung nicht — nichts geschrieben.', ...antwort });
      await repo.appendEvent('bulk.undone', ereignis.id, {
        by: { id: wer.user.id, name: wer.user.name },
        token: wer.token?.name ?? null,
        changes: geprueft.map((c) => ({ id: c.id, before: c.before, after: c.after })),
      });
      for (const c of geprueft) if (!c.after) await repo.deleteEntity(c.id);
      for (const c of geprueft) if (c.after) await repo.putEntity(c.after);
      return antwort;
    },
  );


  /** Die Übernahme ist Sache der Verwaltung der Installation (T-130) — nie in einer Sicht. */
  async function verwaltungFuer(request: FastifyRequest): Promise<Wer | string> {
    const echt = await werIst(request);
    if (!echt) return 'Nicht angemeldet.';
    if (!echt.user.isAdmin || echt.user.disabledAt) return 'Die Übernahme ist Sache der Verwaltung.';
    if (await sichtVon(request)) return 'In einer Sicht wird nicht übernommen.';
    return echt;
  }
  uebernahmeRouten(app, {
    repo,
    env,
    peer: transferPeer,
    accept: transferAccept,
    sicherung,
    assets,
    verwaltung: verwaltungFuer,
  });

  return app;
}
