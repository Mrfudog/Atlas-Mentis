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

/**
 * Die Stufen von aussen nach innen. Fehlt die Angabe, gilt `public`: ein
 * Artikel, den niemand eingestuft hat, ist offen. Andersherum wäre die
 * halbe Kampagne unsichtbar, und niemand wüsste, warum.
 */
export type Audience = 'public' | 'campaign' | 'players' | 'gm';

/**
 * Was ein Konto am Tisch ist — aus `Access.role` an der Figur (oder an der
 * Gruppe, der sie angehört). `null` heisst: gehört nicht an diesen Tisch.
 *
 * Das ist **nicht** dasselbe wie das Konto-Merkmal `app_user.is_admin`. Das
 * gilt für die ganze Installation; dies gilt je Figur, und genau darum geht
 * es: wer in einer Runde leitet, kann in einer anderen mitspielen.
 */
export type TableRole = 'player' | 'co-gm' | 'spectator';

/** Von innen nach aussen — wer zwei Figuren führt, gilt als die stärkere. */
const RANG: Record<TableRole, number> = { 'co-gm': 3, player: 2, spectator: 1 };

/**
 * Die Rolle dieses Betrachters am Tisch: die stärkste, die eine seiner
 * Figuren oder deren Gruppen trägt.
 *
 * Gefragt wird über die **Träger** und nicht über die Konto-Id, weil
 * `Access.userIds` an der Figur steht und ein Konto mehrere Figuren führen
 * darf. Wer Rook (Spieler) und einen Zuschauerplatz hält, ist Spieler.
 */
export function tableRole(
  entities: Map<EntityId, Entity>,
  viewerId: EntityId | readonly EntityId[],
): TableRole | null {
  let beste: TableRole | null = null;
  for (const id of knowledgeHolders(entities, viewerId)) {
    const karte = entities.get(id)?.components?.[ACCESS_COMPONENT] as
      | { role?: unknown }
      | undefined;
    const rolle = karte?.role;
    if (typeof rolle !== 'string' || !(rolle in RANG)) continue;
    const r = rolle as TableRole;
    if (!beste || RANG[r] > RANG[beste]) beste = r;
  }
  return beste;
}

/** Was die Stufe für diesen Betrachter erlaubt. */
function stufeErlaubt(audience: Audience, rolle: TableRole | null): boolean {
  switch (audience) {
    /* Nur die Leitung. Sie kommt hier nie an: ein Betrachter ohne Figuren
       ist `undefined` und ist schon oben durch. */
    case 'gm':
      return false;
    /* Die Spielenden, keine Zuschauer. Ein Mitleiter ist einer von ihnen —
       er sitzt hinter dem Schirm und nicht davor. */
    case 'players':
      return rolle === 'player' || rolle === 'co-gm';
    /* Wer an diesem Tisch sitzt, gleich in welcher Rolle. Ein Konto ohne
       Figur gehört nicht dazu: es hat noch keinen Platz. */
    case 'campaign':
      return rolle !== null;
    default:
      return true;
  }
}

/**
 * Darf dieser Betrachter den Artikel sehen?
 *
 * Ohne Betrachter (`undefined`) immer ja — das ist die Leitung, und die
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
  viewerId?: EntityId | readonly EntityId[],
): boolean {
  if (viewerId === undefined) return true;
  const vis = (article.components?.[VISIBILITY_COMPONENT] ?? {}) as {
    audience?: unknown;
    revealedTo?: unknown;
    hiddenFrom?: unknown;
  };
  const traeger = knowledgeHolders(entities, viewerId);
  const nennt = (wert: unknown): boolean =>
    Array.isArray(wert) && wert.some((x) => typeof x === 'string' && traeger.has(x));

  /* Die Reihenfolge ist die Regel: Verbot, Freigabe, Stufe. */
  if (nennt(vis.hiddenFrom)) return false;
  if (nennt(vis.revealedTo)) return true;
  const stufe = typeof vis.audience === 'string' ? (vis.audience as Audience) : 'public';
  return stufeErlaubt(stufe, tableRole(entities, viewerId));
}
