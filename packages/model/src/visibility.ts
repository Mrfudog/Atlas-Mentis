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

/** Ist das eine Rolle, die es gibt? Was nicht, zählt nicht — geraten wird nicht. */
export function isTableRole(x: unknown): x is TableRole {
  return typeof x === 'string' && x in RANG;
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
  entities: Map<EntityId, Entity>,
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
  if (stufe === 'public') return true;
  /* **Die Rolle in der Kampagne, der der Artikel gehört.** Liegt er in der
     Ebene einer Runde, zählt nur die Rolle dort — die Leitung der anderen
     Runde ist hier niemand. Liegt er in einer geteilten Ebene oder in
     keiner, zählt die stärkste Rolle irgendwo: ein Grundregelwerk, das
     drei Runden aufschalten, gehört keiner davon. */
  return audienceAllows(stufe, tableRole(v, campaignOf(entities, article)));
}
