/**
 * Sichtbarkeit: wer einen Artikel **überhaupt** sehen darf.
 *
 * Das ist die grobe Frage, und sie kommt vor der feinen. Wissen
 * (`knowledge.ts`) entscheidet, welche **Felder** eines Artikels ein
 * Betrachter liest; die Sichtbarkeit entscheidet, ob er den Artikel
 * überhaupt bekommt. Beides zu einer Frage zu machen hiesse, ein Geheimnis
 * dadurch zu verbergen, dass man alle seine Felder einzeln verbirgt — und
 * der Artikel stünde trotzdem in der Liste, mit Namen und Bereich.
 *
 * Gelesen werden drei Felder, in dieser Reihenfolge:
 *
 *   `hiddenFrom`  →  `revealedTo`  →  `audience`
 *
 * Das ausdrückliche Verbot gewinnt, weil es die Ausnahme ist, die jemand
 * von Hand eingetragen hat. Eine Freigabe, die ein Verbot aufhebt, wäre die
 * Sorte Regel, deren Wirkung man erst am Tisch merkt.
 *
 * **Vererbt wird nichts.** Ein Artikel sagt für sich, wer ihn sehen darf;
 * dass das Zimmer zum Haus gehört, sagt nichts darüber, wer das Zimmer
 * kennt. Es gab dafür ein Feld (`Visibility.inherit`, Vorgabe `true`), und
 * es war nie ausgewertet — mit Absicht: sobald es stimmen soll, braucht es
 * eine Tiefe, und eine Vererbung ohne Tiefe gibt irgendwann einen ganzen
 * Zweig frei, den niemand gemeint hat.
 *
 * **Sagt der Artikel nichts, sagt es die Gruppe** (T-252, E-098): eine
 * Regel der laufenden Kampagne je Gruppe (`Campaign.visibilityRules`, die
 * genaueste zuerst), sonst die Vorgabe seiner Ebene
 * (`Layer.defaultAudience`), sonst `public`. Das ist keine Vererbung von
 * Artikel zu Artikel: die Regel steht an der Kampagne und sagt für alle
 * Artikel einer Gruppe dasselbe, auch für die von morgen.
 *
 * Wie überall wird beim Lesen entschieden und nichts gespeichert (D8).
 */

import type { Entity, EntityId } from './types.js';
import { knowledgeHolders } from './knowledge.js';
import { glied, mostSpecific, type Dimension } from './transformkeys.js';
import { applyVisibilityChange, type VisibilityChange } from './articlevisibility.js';
import { heldBackMap } from './playinstance.js';

/** Die Art, deren Karte die Sichtbarkeit trägt. */
export const VISIBILITY_COMPONENT = 'Visibility';
/** Die Artikelart, die eine Kampagne ist. */
export const CAMPAIGN_TYPE = 'Campaign';
/** Artikel → Ebene. `props.mode` sagt, ob sie ihn bringt oder herausnimmt. */
export const LAYER_RELATION = 'inLayer';
/** Kampagne → Ebene: welche Ebenen sie aufschaltet. */
export const ACTIVATES_RELATION = 'activates';

/**
 * Die Stufen von aussen nach innen. Fehlt die Angabe, gilt `public`: ein
 * Artikel, den niemand eingestuft hat, ist offen. Andersherum wäre die
 * halbe Kampagne unsichtbar, und niemand wüsste, warum.
 */
export type Audience = 'public' | 'campaign' | 'players' | 'gm';

/**
 * Was ein Konto in **einer** Kampagne ist. Es steht am Konto und nicht in
 * einem Artikel — am Server in `campaign_member`, im Prototyp in der
 * Sammlung `members`.
 *
 * Es stand einmal als `Access`-Karte an der Figur (und für einen Tag an der
 * Kampagne). Der Server las sie nie: welche Figur ein Konto führt, stand
 * dort längst am Konto (`app_user_actor`), und `Access.userIds` war eine
 * Doppelung, die in keinem Artikel des Prüfbestands gefüllt war. Eine
 * Kontoangabe in einem Artikel wandert ausserdem beim Export mit — und
 * Zugänge wandern nicht (REQ-199).
 *
 * `co-gm` sitzt hinter dem Schirm und sieht dasselbe wie die Leitung; was
 * die beiden trennt (wer Mitglieder verwaltet, wer schreiben darf), ist
 * eine Frage an die Schreibregel und nicht an die Sichtbarkeit.
 */
export type TableRole = 'gm' | 'co-gm' | 'player' | 'spectator';

/**
 * **Wer schaut.** Die Figuren für Wissen und Freigaben, die Rollen je
 * Kampagne für die Stufe. Beides kommt vom Konto.
 *
 * Eine blosse Id oder Liste gilt weiter als „diese Figuren, keine Rolle":
 * die meisten Aufrufer haben nur sie, und eine Pflicht zum Objekt hiesse,
 * an dreissig Stellen `{ actors: … }` zu schreiben.
 */
export interface Viewer {
  /** Die Figuren dieses Kontos. */
  actors?: EntityId | readonly EntityId[];
  /** Kampagnen-Id → Rolle darin. Was fehlt, ist kein Platz am Tisch. */
  roles?: Readonly<Record<EntityId, TableRole>>;
  /**
   * **Die eigenen Artikel** — was dieses Konto angelegt hat oder schreiben
   * darf (REQ-237, E-011). Die sieht es in jedem Stand, auch unfertig.
   * Wer was angelegt hat, steht am Server neben dem Konto, nicht im
   * Artikel (REQ-199).
   */
  own?: readonly EntityId[] | ReadonlySet<EntityId>;
  /**
   * **Vom Status-Gate ausgenommen** (E-014 d): die Spielercharaktere, die
   * einem Konto zugeteilt sind, samt Statblock und Inventar — die Figuren
   * *aller* Konten, nicht nur dieses. Sie verwaltet ihr Spieler selbst,
   * und für die Mitspielenden gilt die gewöhnliche Sichtbarkeit, nicht der
   * Vorbereitungsstand. Wer welche Figur führt, steht am Server
   * (`app_user_actor`), also gibt der Server die Liste mit.
   */
  ungated?: readonly EntityId[] | ReadonlySet<EntityId>;
  /**
   * **Die Regeln je Gruppe der laufenden Kampagne** (T-252, E-098). Der
   * Server gibt sie mit, denn welche Kampagne läuft, ist eine Einstellung
   * und kein Teil des Artikels. Ohne sie gilt nach dem Feld am Artikel
   * gleich die Vorgabe der Ebene.
   */
  campaignRules?: CampaignVisibility;
}

/** Eine Regel je Gruppe: die `id` ist der Schlüssel der Gruppe (`layer:dnd|type:Spell`, T-253). */
export interface VisibilityRule {
  id: string;
  audience?: Audience;
  /** Träger, die die Gruppe sehen, was die Stufe auch sagt. */
  show?: readonly EntityId[];
  /** Träger, die sie nicht sehen. */
  hide?: readonly EntityId[];
}

/**
 * **Ein Eintrag je Artikel** (T-401, E-162 a): der Schlüssel `article:<id>`
 * im Regelwerk der Kampagne. So entscheidet die Leitung über einen
 * einzelnen Artikel aus einer Ebene, die sie nicht schreibt — ein
 * Grundregelwerk, das drei Runden teilen —, ohne das Buch zu beschreiben
 * oder eine Fassung anzulegen. Er gilt **vor jeder Gruppe**, gleich wie
 * genau (gesonderte Artikel > Merkmal > Ebene), aber nach dem eigenen Feld
 * am Artikel.
 */
export const ARTICLE_DIMENSION = 'article';
export const articleRuleKey = (id: EntityId): string => glied(ARTICLE_DIMENSION, id);

/** Das Merkmal Beziehung (T-401): eine Kante und ihr Ziel, `memberOf>f_kult`. */
export const RELATION_DIMENSION = 'relation';
export const relationValue = (type: string, to: EntityId): string => `${type}>${to}`;

/**
 * **Die Regel, die für diesen Artikel spricht**: zuerst sein eigener
 * Eintrag, dann die genaueste Gruppe. `spricht` sagt, welche Regeln für
 * die Frage etwas sagen — eine Stufe, oder eine Freigabe für diesen
 * Betrachter.
 */
function regelFuer(ctx: CampaignVisibility, article: Entity, spricht: (r: VisibilityRule) => boolean): VisibilityRule | undefined {
  const sprechend = ctx.rules.filter(spricht);
  const eigen = articleRuleKey(article.id);
  const direkt = sprechend.find((r) => r.id === eigen);
  if (direkt) return direkt;
  const k = mostSpecific(
    sprechend.filter((r) => !r.id.startsWith(ARTICLE_DIMENSION + ':')).map((r) => r.id),
    article,
    ctx.dims,
  );
  return k ? sprechend.find((x) => x.id === k) : undefined;
}

/**
 * **Den Eintrag eines Artikels ändern** (T-401): dieselbe Änderung wie am
 * Feld (`applyVisibilityChange` — Stufe, je Träger zeigen oder verbergen,
 * folgen), nur im Regelwerk der Kampagne. Sagt er danach nichts mehr,
 * fällt er weg.
 */
export function withArticleRule(rules: readonly VisibilityRule[], id: EntityId, change: VisibilityChange): VisibilityRule[] {
  const key = articleRuleKey(id);
  const alt = rules.find((r) => r.id === key);
  const neu = applyVisibilityChange(
    alt ? { ...(alt.audience ? { audience: alt.audience } : {}), ...(alt.show ? { revealedTo: [...alt.show] } : {}), ...(alt.hide ? { hiddenFrom: [...alt.hide] } : {}) } : undefined,
    change,
  );
  const rest = rules.filter((r) => r.id !== key);
  if (!neu) return rest;
  return [
    ...rest,
    {
      id: key,
      ...(istStufe(neu.audience) ? { audience: neu.audience } : {}),
      ...(neu.revealedTo?.length ? { show: neu.revealedTo } : {}),
      ...(neu.hiddenFrom?.length ? { hide: neu.hiddenFrom } : {}),
    },
  ];
}

/** Die Regeln einer Kampagne samt den Dimensionen, gegen die ihre Schlüssel prüfen. */
export interface CampaignVisibility {
  campaign: EntityId;
  rules: readonly VisibilityRule[];
  dims: readonly Dimension<Entity>[];
}

/** Die Karte an der Kampagne, die die Regeln trägt. */
export const VISIBILITY_RULES_COMPONENT = 'VisibilityRules';
/* Die Karte an der Ebene, die ihre Vorgabe trägt — `LAYER_COMPONENT` aus
   `stack.ts`, hier ohne Import: `stack.ts` liest die Sichtbarkeit. */
const EBENEN_KARTE = 'Layer';

function istStufe(x: unknown): x is Audience {
  return x === 'public' || x === 'campaign' || x === 'players' || x === 'gm';
}

/** Die Regeln an einer Kampagne; was keine Form hat, fällt weg. */
export function visibilityRulesOf(campaign: Entity | undefined): VisibilityRule[] {
  const roh = (campaign?.components?.[VISIBILITY_RULES_COMPONENT] as { visibilityRules?: unknown } | undefined)?.visibilityRules;
  if (!Array.isArray(roh)) return [];
  const ids = (x: unknown): EntityId[] | undefined =>
    Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string') : undefined;
  return roh.flatMap((r): VisibilityRule[] => {
    if (!r || typeof r !== 'object' || typeof (r as { id?: unknown }).id !== 'string') return [];
    const o = r as { id: string; audience?: unknown; show?: unknown; hide?: unknown };
    const show = ids(o.show);
    const hide = ids(o.hide);
    return [{ id: o.id, ...(istStufe(o.audience) ? { audience: o.audience } : {}), ...(show?.length ? { show } : {}), ...(hide?.length ? { hide } : {}) }];
  });
}

const STUFE_RANG: Record<Audience, number> = { public: 0, campaign: 1, players: 2, gm: 3 };

/**
 * **Die Vorgabe der Ebenen eines Artikels** (E-098) — die engste, wenn
 * mehrere etwas sagen: wer ihn in einer Ebene für die Leitung hält, soll
 * ihn nicht durch die zweite öffnen. `null`, wenn keine etwas sagt.
 */
export function layerDefaultAudience(entities: ReadonlyMap<EntityId, Entity>, article: Entity): Audience | null {
  let enge: Audience | null = null;
  for (const r of article.relations ?? []) {
    if (r.type !== LAYER_RELATION || (r.props as { mode?: unknown } | undefined)?.mode === 'removes') continue;
    const d = (entities.get(r.to)?.components?.[EBENEN_KARTE] as { defaultAudience?: unknown } | undefined)?.defaultAudience;
    if (istStufe(d) && (!enge || STUFE_RANG[d] > STUFE_RANG[enge])) enge = d;
  }
  return enge;
}

/** Woher die Stufe kommt — die Übersicht sagt es je Zelle. */
export type AudienceSource = 'article' | 'campaign' | 'layer' | 'default';

/**
 * **Die geltende Stufe eines Artikels und woher sie kommt** (T-252):
 * Feld am Artikel > Regel der Kampagne (die genaueste mit Stufe) >
 * Vorgabe der Ebene > `public`. Freigaben und Verbote je Träger rechnet
 * `articleVisible` dazu; hier steht nur die Stufe.
 */
export function effectiveAudience(
  entities: ReadonlyMap<EntityId, Entity>,
  article: Entity,
  ctx?: CampaignVisibility,
): { audience: Audience; source: AudienceSource; rule?: string } {
  const eigen = (article.components?.[VISIBILITY_COMPONENT] as { audience?: unknown } | undefined)?.audience;
  if (istStufe(eigen)) return { audience: eigen, source: 'article' };
  if (ctx) {
    const r = regelFuer(ctx, article, (x) => !!x.audience);
    if (r?.audience) return { audience: r.audience, source: 'campaign', rule: r.id };
  }
  const ebene = layerDefaultAudience(entities, article);
  if (ebene) return { audience: ebene, source: 'layer' };
  return { audience: 'public', source: 'default' };
}

function enthaelt(l: readonly EntityId[] | ReadonlySet<EntityId> | undefined, id: EntityId): boolean {
  if (!l) return false;
  return Array.isArray(l) ? l.includes(id) : (l as ReadonlySet<EntityId>).has(id);
}

/** Wen auch immer der Aufrufer mitgibt. `undefined` heisst: die Verwaltung. */
export type ViewerRef = EntityId | readonly EntityId[] | Viewer;

function alsViewer(ref: ViewerRef): Viewer {
  if (typeof ref === 'string') return { actors: [ref] };
  if (Array.isArray(ref)) return { actors: ref as readonly EntityId[] };
  return ref as Viewer;
}

/** Die Art, deren Karte den Vorbereitungsstand trägt (Zeile `State`). */
export const STATUS_COMPONENT = 'Status';
/** Der Stand, der für Spielende zählt. */
export const READY = 'ready';

/**
 * **Ist der Artikel fertig?** (REQ-237, E-011) Ohne Status-Karte oder ohne
 * Wert: ja. Sonst verschwände alles, was keinen Vorbereitungsstand trägt
 * (Ebenen, Kampagnen, Regelteile) — ein Stand, den niemand gesetzt hat,
 * ist keiner, der etwas zurückhält.
 */
export function isReady(article: Entity): boolean {
  const s = (article.components?.[STATUS_COMPONENT] as { status?: unknown } | undefined)?.status;
  return s === undefined || s === null || s === '' || s === READY;
}

/**
 * **Sieht dieser Betrachter den Arbeitsstand?** (REQ-237, E-011, E-012)
 * Die Leitung der Kampagne des Artikels (`gm`, `co-gm`) und wer ihn
 * angelegt hat oder schreiben darf (`own`). Alle anderen sehen nur, was
 * `ready` ist — und von einem Artikel, der nach einer Änderung auf
 * `prepared` zurückfiel, den letzten fertigen Stand (am Server,
 * `entity_ready`). Ohne Betrachter: die Verwaltung, ja.
 */
export function seesUnfinished(entities: ReadonlyMap<EntityId, Entity>, article: Entity, viewerId?: ViewerRef): boolean {
  if (viewerId === undefined) return true;
  const v = alsViewer(viewerId);
  if (enthaelt(v.own, article.id)) return true;
  const rolle = tableRole(v, campaignOf(entities, article));
  return rolle === 'gm' || rolle === 'co-gm';
}

/** Von innen nach aussen — wer zwei Rollen hält, gilt als die stärkere. */
const RANG: Record<TableRole, number> = { gm: 4, 'co-gm': 3, player: 2, spectator: 1 };

/** Ist das eine Rolle, die es gibt? Was nicht, zählt nicht — geraten wird nicht. */
export function isTableRole(x: unknown): x is TableRole {
  return typeof x === 'string' && x in RANG;
}

/* ---------- wem ein Artikel gehört ---------- */

/* **Die Kampagnen eines Bestands, einmal gesucht** (T-252): `campaignsOf`
   fragt je Artikel, und mit einer Vorgabe der Ebene fragt das Sieb bei
   vierundzwanzigtausend Artikeln jedes Mal — die Suche über den ganzen
   Bestand je Artikel wäre die Zeit der ganzen Liste. Gemerkt werden die
   Ids, gelesen wird der Artikel aus dem Bestand: wer einen Eintrag
   ersetzt (der letzte fertige Stand), bekommt den neuen; kommt einer
   dazu, ändert sich die Grösse und es wird neu gesucht. */
const kampagnenJe = new WeakMap<ReadonlyMap<EntityId, Entity>, { size: number; ids: EntityId[] }>();
function kampagnenIn(entities: ReadonlyMap<EntityId, Entity>): EntityId[] {
  const da = kampagnenJe.get(entities);
  if (da && da.size === entities.size) return da.ids;
  const ids: EntityId[] = [];
  for (const e of entities.values()) if ((e.interfaces ?? [])[0] === CAMPAIGN_TYPE) ids.push(e.id);
  kampagnenJe.set(entities, { size: entities.size, ids });
  return ids;
}

/**
 * **Die Kampagnen, denen dieser Artikel gehört** — abgelesen am
 * Ebenenstapel, nicht an einem eigenen Feld.
 *
 * Ein Artikel liegt in Ebenen (`inLayer`), eine Kampagne schaltet Ebenen
 * auf (`activates`). Also: **eine Ebene, die genau eine Kampagne
 * aufschaltet, gehört ihr; eine, die mehrere aufschalten, ist gemeinsam.**
 * Dass Zugehörigkeit so von selbst herausfällt, ist der Grund, hier kein
 * Feld zu setzen: ein Feld, das gleichzeitig Regel ist, leckt beim ersten
 * Tippfehler — ein Paket, das versehentlich `campaign` heisst, gehörte
 * plötzlich wem?
 *
 * `null` heisst **nicht zuzuordnen**: der Artikel trägt keine Ebenenkante.
 * Das ist heute der Normalfall („ohne Ebene gehört er der Kampagne und ist
 * immer da"), und solange es ihn gibt, sagt der Stapel über ihn nichts.
 *
 * `mode: 'removes'` zählt nicht: eine Ebene, die den Artikel herausnimmt,
 * bringt ihn nicht mit und besitzt ihn nicht.
 */
export function campaignsOf(
  entities: ReadonlyMap<EntityId, Entity>,
  article: Entity,
): ReadonlySet<EntityId> | null {
  const ebenen = new Set<EntityId>();
  for (const r of article.relations ?? []) {
    if (r.type !== LAYER_RELATION) continue;
    if ((r.props as { mode?: unknown } | undefined)?.mode === 'removes') continue;
    ebenen.add(r.to);
  }
  if (!ebenen.size) return null;
  const out = new Set<EntityId>();
  for (const id of kampagnenIn(entities)) {
    const e = entities.get(id);
    if (!e || (e.interfaces ?? [])[0] !== CAMPAIGN_TYPE) continue;
    for (const r of e.relations ?? []) {
      /* Ein Vergleich schaltet nicht auf (T-092): wer eine Ebene nur zum
         Vergleichen nennt, macht sie nicht zu seiner oder zu einer gemeinsamen. */
      const mode = (r.props as { mode?: unknown } | undefined)?.mode;
      if (mode === 'compare') continue;
      /* Abgeschaltet (T-088) ebensowenig — und eine Gruppe macht ihre
         Mitglieder nicht zu Eigentum: es zählt nur die ausdrückliche Kante. */
      if (mode === 'off') continue;
      if (r.type === ACTIVATES_RELATION && ebenen.has(r.to)) out.add(e.id);
    }
  }
  return out;
}

/**
 * **Die eine Kampagne, der dieser Artikel gehört** — oder `undefined`,
 * wenn es keine einzelne ist.
 *
 * `undefined` heisst zweierlei, und beides läuft auf dasselbe hinaus: der
 * Artikel trägt keine Ebene (nicht zuzuordnen), oder seine Ebenen laufen
 * unter mehreren Kampagnen (gemeinsam). In beiden Fällen ist er nicht das
 * Geheimnis *einer* Runde, und gefragt wird die Rolle in irgendeiner.
 */
export function campaignOf(
  entities: ReadonlyMap<EntityId, Entity>,
  article: Entity,
): EntityId | undefined {
  const besitzer = campaignsOf(entities, article);
  if (!besitzer || besitzer.size !== 1) return undefined;
  const [eine] = besitzer;
  return eine;
}

/* ---------- was der Betrachter am Tisch ist ---------- */

/**
 * Die Rolle dieses Betrachters — **in der genannten Kampagne**, oder ohne
 * Kampagne die stärkste, die er irgendwo hält.
 *
 * Mit Kampagne zählt nur sie: wer in der einen Runde leitet und in der
 * anderen zuschaut, ist in der anderen Zuschauer. Das ging nicht, solange
 * die Rolle an einer Figur stand — eine Figur sagt nicht, in welcher Runde
 * ihr Konto was ist.
 */
export function tableRole(viewerId: ViewerRef, campaignId?: EntityId): TableRole | null {
  const rollen = alsViewer(viewerId).roles ?? {};
  if (campaignId !== undefined) {
    const r = rollen[campaignId];
    return isTableRole(r) ? r : null;
  }
  let beste: TableRole | null = null;
  for (const r of Object.values(rollen)) {
    if (!isTableRole(r)) continue;
    if (!beste || RANG[r] > RANG[beste]) beste = r;
  }
  return beste;
}

/**
 * Was die Stufe für diese Rolle erlaubt. Die Leitung sieht jede Stufe
 * darunter mit — ein Artikel „für die Spielenden" vor ihr zu verbergen wäre
 * Unsinn —, und ein Mitleiter sitzt hinter dem Schirm und nicht davor.
 */
export function audienceAllows(audience: Audience, rolle: TableRole | null): boolean {
  switch (audience) {
    case 'gm':
      return rolle === 'gm' || rolle === 'co-gm';
    case 'players':
      return rolle === 'player' || rolle === 'co-gm' || rolle === 'gm';
    /* Wer an diesem Tisch sitzt, gleich in welcher Rolle. Ein Konto ohne
       Rolle gehört nicht dazu: es hat noch keinen Platz. */
    case 'campaign':
      return rolle !== null;
    default:
      return true;
  }
}

/**
 * Darf dieser Betrachter den Artikel sehen?
 *
 * Ohne Betrachter (`undefined`) immer ja — das ist die Verwaltung, und die
 * sieht alles. Eine **leere** Liste ist etwas anderes: ein Konto ohne Figur
 * und ohne Rolle sieht, was offen ist, und sonst nichts.
 *
 * Wer das Ergebnis nicht anwendet, hält nichts zurück: ein Server, der
 * einem Spieler den Artikel schickt und darauf baut, dass die Maske ihn
 * nicht zeichnet, hat ihn geschickt.
 */
export function articleVisible(
  entities: ReadonlyMap<EntityId, Entity>,
  article: Entity,
  viewerId?: ViewerRef,
): boolean {
  if (viewerId === undefined) return true;
  const v = alsViewer(viewerId);
  const vis = (article.components?.[VISIBILITY_COMPONENT] ?? {}) as {
    audience?: unknown;
    revealedTo?: unknown;
    hiddenFrom?: unknown;
  };
  const traeger = knowledgeHolders(entities, v.actors ?? []);
  const nennt = (wert: unknown): boolean =>
    Array.isArray(wert) && wert.some((x) => typeof x === 'string' && traeger.has(x));

  /* **Eigenes sieht man immer, in jedem Stand** (REQ-237, E-011): wer
     einen Artikel angelegt hat oder schreiben darf, verliert ihn nicht aus
     den Augen, nur weil die Leitung ihn noch nicht fertig nennt. */
  if (enthaelt(v.own, article.id)) return true;
  /* **Eine Karte im Spiel ist nicht vorhanden, bis sie freigegeben ist**
     (T-289, E-041): Spielende bekommen sie weder in einer Liste noch über
     die Id noch im Live-Kanal. Die Leitung der Kampagne sieht sie immer. */
  if (heldBackMap(article) && !seesUnfinished(entities, article, v)) return false;
  /* **Unfertiges sieht nur die Leitung** (REQ-237, E-011). Wer nicht `gm`
     oder `co-gm` der Kampagne ist, der der Artikel gehört, bekommt nur,
     was `ready` ist. Das ist die grobe Frage: ein Entwurf stünde sonst mit
     Namen in der Liste, auch wenn das Wissen jedes Feld zurückhielte. Die
     eigene Figur eines Spielers ist ausgenommen (E-014 d, `ungated`): für
     sie gilt, was darunter steht. */
  if (!isReady(article) && !enthaelt(v.ungated, article.id) && !seesUnfinished(entities, article, v)) {
    return false;
  }
  /* Die Reihenfolge ist die Regel: Verbot, Freigabe, Stufe. */
  if (nennt(vis.hiddenFrom)) return false;
  if (nennt(vis.revealedTo)) return true;
  /* **Sagt der Artikel keine Stufe, sagt es die Gruppe** (T-252, E-098):
     die genaueste Regel der Kampagne, die für diesen Betrachter etwas
     sagt — ein Verbot oder eine Freigabe für einen seiner Träger, sonst
     ihre Stufe; gefragt wird dann die Rolle in dieser Kampagne. Eine
     Regel, die nur Rook etwas zeigt, sagt über Bram nichts, und für ihn
     gilt die nächst gröbere. */
  const ctx = v.campaignRules;
  if (!istStufe(vis.audience) && ctx) {
    /* Zuerst der Eintrag dieses Artikels (T-401), dann die genaueste Gruppe. */
    const r = regelFuer(ctx, article, (x) => !!x.audience || nennt(x.show) || nennt(x.hide));
    if (r) {
      if (nennt(r.hide)) return false;
      if (nennt(r.show)) return true;
      if (r.audience) return audienceAllows(r.audience, tableRole(v, ctx.campaign));
    }
  }
  const stufe = istStufe(vis.audience) ? vis.audience : (layerDefaultAudience(entities, article) ?? 'public');
  if (stufe === 'public') return true;
  /* **Die Rolle in der Kampagne, der der Artikel gehört.** Liegt er in der
     Ebene einer Runde, zählt nur die Rolle dort — die Leitung der anderen
     Runde ist hier niemand. Liegt er in einer geteilten Ebene oder in
     keiner, zählt die stärkste Rolle irgendwo: ein Grundregelwerk, das
     drei Runden aufschalten, gehört keiner davon. */
  return audienceAllows(stufe, tableRole(v, campaignOf(entities, article)));
}
