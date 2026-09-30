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
 * Wie überall wird beim Lesen entschieden und nichts gespeichert (D8).
 */

import type { Entity, EntityId } from './types.js';
import { knowledgeHolders } from './knowledge.js';

/** Die Art, deren Karte die Sichtbarkeit trägt. */
export const VISIBILITY_COMPONENT = 'Visibility';
/** Die Art, deren Karte die Rolle eines Kontos am Tisch trägt. */
export const ACCESS_COMPONENT = 'Access';
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
 * Was ein Konto am Tisch ist — aus `Access.role`. `null` heisst: gehört
 * nicht an diesen Tisch.
 *
 * `gm` steht an der **Kampagne**, die anderen an einer Figur (oder an der
 * Gruppe, der sie angehört). Das ist **nicht** dasselbe wie das
 * Konto-Merkmal `app_user.is_admin`: das gilt für die ganze Installation,
 * und genau darum geht es hier — wer in einer Runde leitet, kann in einer
 * anderen mitspielen.
 */
export type TableRole = 'gm' | 'co-gm' | 'player' | 'spectator';

/**
 * **Wer schaut.** Ein Konto führt Figuren, und beides wird gebraucht: die
 * Figuren für Wissen und Freigaben, die Konto-Id für die Leitung einer
 * Kampagne (die steht an der Kampagne und nicht an einer Figur — eine
 * Leitung hat keine).
 *
 * Eine blosse Id oder Liste gilt weiter als „diese Figuren, kein Konto":
 * die meisten Aufrufer haben nur sie, und eine Pflicht zum Konto hiesse,
 * an dreissig Stellen `{ actors: … }` zu schreiben, damit einer davon die
 * Leitung prüfen kann.
 */
export interface Viewer {
  /** Die Figuren dieses Kontos. */
  actors?: EntityId | readonly EntityId[];
  /** Die Konto-Id. Ohne sie ist niemand Leitung einer Kampagne. */
  user?: string;
}

/** Wen auch immer der Aufrufer mitgibt. `undefined` heisst: die Verwaltung. */
export type ViewerRef = EntityId | readonly EntityId[] | Viewer;

function alsViewer(ref: ViewerRef): Viewer {
  if (typeof ref === 'string') return { actors: [ref] };
  if (Array.isArray(ref)) return { actors: ref as readonly EntityId[] };
  return ref as Viewer;
}

/** Von innen nach aussen — wer zwei Rollen hält, gilt als die stärkere. */
const RANG: Record<TableRole, number> = { gm: 4, 'co-gm': 3, player: 2, spectator: 1 };

function rolleAus(karte: unknown): TableRole | null {
  const rolle = (karte as { role?: unknown } | undefined)?.role;
  if (typeof rolle !== 'string' || !(rolle in RANG)) return null;
  return rolle as TableRole;
}

function staerker(a: TableRole | null, b: TableRole | null): TableRole | null {
  if (!a) return b;
  if (!b) return a;
  return RANG[a] >= RANG[b] ? a : b;
}

/* ---------- wem ein Artikel gehört ---------- */

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
 * Mit einer Kampagne ist das richtig; mit zweien braucht jede ihre eigene
 * Ebene, und das ist eine eigene Entscheidung.
 *
 * `mode: 'removes'` zählt nicht: eine Ebene, die den Artikel herausnimmt,
 * bringt ihn nicht mit und besitzt ihn nicht.
 */
export function campaignsOf(
  entities: Map<EntityId, Entity>,
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
  for (const e of entities.values()) {
    if ((e.interfaces ?? [])[0] !== CAMPAIGN_TYPE) continue;
    for (const r of e.relations ?? []) {
      if (r.type === ACTIVATES_RELATION && ebenen.has(r.to)) out.add(e.id);
    }
  }
  return out;
}

/** Die Konten, die diese Kampagne leiten — ihre `Access`-Karte mit `gm`. */
export function gmAccounts(campaign: Entity | undefined): ReadonlySet<string> {
  const karte = campaign?.components?.[ACCESS_COMPONENT] as
    | { role?: unknown; userIds?: unknown }
    | undefined;
  if (rolleAus(karte) !== 'gm') return new Set();
  const ids = Array.isArray(karte?.userIds) ? karte.userIds : [];
  return new Set(ids.filter((x): x is string => typeof x === 'string' && !!x));
}

/**
 * Leitet dieses Konto die genannte Kampagne — oder, ohne Kampagne,
 * irgendeine?
 *
 * Ohne Konto niemals: eine Leitung, die sich aus Figuren ergäbe, wäre
 * geraten, und geraten wird bei der Frage „darf er das Geheimnis sehen"
 * nicht.
 */
export function leadsCampaign(
  entities: Map<EntityId, Entity>,
  user: string | undefined,
  campaignId?: EntityId,
): boolean {
  if (!user) return false;
  if (campaignId !== undefined) return gmAccounts(entities.get(campaignId)).has(user);
  for (const e of entities.values()) {
    if ((e.interfaces ?? [])[0] !== CAMPAIGN_TYPE) continue;
    if (gmAccounts(e).has(user)) return true;
  }
  return false;
}

/* ---------- was der Betrachter am Tisch ist ---------- */

/**
 * Die Rolle dieses Betrachters am Tisch: die stärkste, die eine seiner
 * Figuren oder deren Gruppen trägt — und `gm`, wenn sein Konto eine
 * Kampagne leitet.
 *
 * Gefragt wird über die **Träger** und nicht über die Konto-Id, weil
 * `Access.userIds` an der Figur steht und ein Konto mehrere Figuren führen
 * darf. Wer Rook (Spieler) und einen Zuschauerplatz hält, ist Spieler.
 */
export function tableRole(
  entities: Map<EntityId, Entity>,
  viewerId: ViewerRef,
): TableRole | null {
  const v = alsViewer(viewerId);
  let beste: TableRole | null = leadsCampaign(entities, v.user) ? 'gm' : null;
  for (const id of knowledgeHolders(entities, v.actors ?? [])) {
    beste = staerker(beste, rolleAus(entities.get(id)?.components?.[ACCESS_COMPONENT]));
  }
  return beste;
}

/** Was die Stufe für diesen Betrachter erlaubt — ohne `gm`, das fragt mehr. */
function stufeErlaubt(audience: Audience, rolle: TableRole | null): boolean {
  switch (audience) {
    /* Die Spielenden, keine Zuschauer. Ein Mitleiter ist einer von ihnen —
       er sitzt hinter dem Schirm und nicht davor, und die Leitung sieht
       ohnehin alles darunter. */
    case 'players':
      return rolle === 'player' || rolle === 'co-gm' || rolle === 'gm';
    /* Wer an diesem Tisch sitzt, gleich in welcher Rolle. Ein Konto ohne
       Figur und ohne Leitung gehört nicht dazu: es hat noch keinen Platz. */
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
 * sieht, was offen ist, und sonst nichts.
 *
 * Wer das Ergebnis nicht anwendet, hält nichts zurück: ein Server, der
 * einem Spieler den Artikel schickt und darauf baut, dass die Maske ihn
 * nicht zeichnet, hat ihn geschickt.
 */
export function articleVisible(
  entities: Map<EntityId, Entity>,
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

  /* Die Reihenfolge ist die Regel: Verbot, Freigabe, Stufe. */
  if (nennt(vis.hiddenFrom)) return false;
  if (nennt(vis.revealedTo)) return true;
  const stufe = typeof vis.audience === 'string' ? (vis.audience as Audience) : 'public';
  if (stufe === 'gm') return leadsCampaign(entities, v.user, campaignOf(entities, article));
  return stufeErlaubt(stufe, tableRole(entities, v));
}

/**
 * **Die eine Kampagne, der dieser Artikel gehört** — oder `undefined`,
 * wenn es keine einzelne ist.
 *
 * `undefined` heisst hier zweierlei, und beides läuft auf dasselbe hinaus:
 * der Artikel trägt keine Ebene (nicht zuzuordnen), oder seine Ebenen
 * laufen unter mehreren Kampagnen (gemeinsam). In beiden Fällen ist er
 * nicht das Geheimnis *einer* Runde, und `audience: 'gm'` heisst dann:
 * jede Leitung.
 *
 * Das ist die Regel, um die es geht: **liegt ein Artikel in der Ebene der
 * Kampagne, sieht ihn nur ihre Leitung; liegt er in einer geteilten Ebene,
 * sehen ihn alle Leitungen.** Ein Grundregelwerk, das drei Runden
 * aufschalten, gehört keiner davon — seine Spielleitungshinweise vor den
 * anderen zwei zu verbergen wäre eine Sperre ohne Grund.
 */
export function campaignOf(
  entities: Map<EntityId, Entity>,
  article: Entity,
): EntityId | undefined {
  const besitzer = campaignsOf(entities, article);
  if (!besitzer || besitzer.size !== 1) return undefined;
  const [eine] = besitzer;
  return eine;
}
