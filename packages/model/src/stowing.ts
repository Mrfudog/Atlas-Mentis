/**
 * **Nicht verstaut, liegengelassen** (T-140, REQ-064, REQ-183).
 *
 * Was ins Inventar kommt — gekauft, erbeutet, geschenkt —, liegt erst
 * **vor** der Figur und noch nicht in ihren Sachen: `holds.props.unstowed`.
 * Verstaut ist es, sobald es im Raster liegt, an einem Platz hängt, in
 * einen Behälter wandert oder (ohne Raster) jemand „Stow" sagt. An der
 * Kante und nicht am Gegenstand, wie die Drehung: *dieser* Stapel hier ist
 * noch nicht weggepackt.
 *
 * Wie lange das gut geht, sagt die Kampagne (`Campaign.stowing`,
 * `stowingRuleOf`): beliebig lange (`anytime`), bis die Sitzung endet
 * (`bySessionEnd`), oder nur, bis der Tisch weiterzieht (`immediately`:
 * Szene, Kampf oder Karte der Sitzung wechseln — Auslegung offen, E-054).
 * Was dann noch daliegt,
 * wird **liegengelassen**: es verlässt das Inventar und steht an der
 * Sitzung als Kante `leftBehind` — mit Menge und dem Inventar, aus dem es
 * kam. Gelöscht wird nichts; wer zurückgeht, hebt es auf (`pickUp`) und
 * hat es wieder vor sich liegen.
 *
 * Kein Framework: der Server ruft es beim Sitzungsende und beim Wechsel
 * der Szene, die Maske beim Verstauen.
 */
import type { Entity, EntityId, Relation } from './types.js';

/** Die Angabe an `holds`: dieser Stapel liegt noch vor der Figur. */
export const UNSTOWED = 'unstowed';
/** Die Kante an der Sitzung, die festhält, was dort liegen blieb. */
export const LEFT_BEHIND = 'leftBehind';

export const STOWING_RULES = ['anytime', 'bySessionEnd', 'immediately'] as const;
export type StowingRule = (typeof STOWING_RULES)[number];

/**
 * **Wie lange Unverstautes liegen darf** — ein Wort an der Kampagne, wie
 * `Campaign.inventory`; wandert mit T-132 in ein Modul, dann ändert sich
 * nur, wo diese Funktion nachsieht. Ohne Angabe: beliebig lange.
 */
export function stowingRuleOf(campaign: Entity | null | undefined): StowingRule {
  const roh = campaign?.components?.['Campaign']?.['stowing'];
  return (STOWING_RULES as readonly string[]).includes(roh as string) ? (roh as StowingRule) : 'anytime';
}

/** Liegt dieser Stapel noch unverstaut da? */
export function isUnstowed(edge: Pick<Relation, 'type' | 'props'> | null | undefined): boolean {
  return edge?.type === 'holds' && edge.props?.[UNSTOWED] === true;
}

/** Die Lage im Raster und am Körper — wer unverstaut ankommt, hat keine. */
const LAGE = ['gx', 'gy', 'rot', 'slot'];
const menge = (r: Pick<Relation, 'props'>): number => Math.max(1, Math.trunc(Number(r.props?.['qty']) || 1));

/**
 * **Was eben angekommen ist, liegt unverstaut da.** Vergleicht das
 * Inventar vor und nach einem Zugang (Kauf, Beute, Geschenk — wie auch
 * immer gestapelt wurde): eine neue `holds`-Kante wird unverstaut; ist ein
 * schon **verstauter** Stapel gewachsen, bleibt er, wie er war, und der
 * Zuwachs kommt als eigener unverstauter Stapel dazu (oder auf einen, der
 * schon unverstaut daliegt). Sonst wäre das Neue still mitverstaut, nur
 * weil schon einmal dasselbe im Rucksack lag.
 *
 * Die Funktion stapelt nicht selbst: wer ein Stück ins Inventar legt,
 * ruft danach diese, und die Regel steht an einer Stelle.
 */
export function arriveUnstowed(before: Pick<Entity, 'relations'> | null | undefined, after: Entity, newId: () => string): Entity {
  const vorher = new Map((before?.relations ?? []).filter((r) => r.type === 'holds').map((r) => [r.id, r]));
  const zuwachs: { to: EntityId; qty: number }[] = [];
  let relations = (after.relations ?? []).map((r): Relation => {
    if (r.type !== 'holds') return r;
    const alt = vorher.get(r.id);
    if (!alt) {
      const props: Record<string, unknown> = { ...(r.props ?? {}), [UNSTOWED]: true };
      for (const k of LAGE) delete props[k];
      return { ...r, props };
    }
    const mehr = menge(r) - menge(alt);
    if (mehr > 0 && !isUnstowed(alt) && alt.to === r.to) {
      zuwachs.push({ to: r.to, qty: mehr });
      return { ...r, props: { ...(r.props ?? {}), qty: menge(alt) } };
    }
    return r;
  });
  for (const z of zuwachs) {
    const da = relations.find((r) => isUnstowed(r) && r.to === z.to && !r.props?.['reservedFor']);
    relations = da
      ? relations.map((r) => (r === da ? { ...r, props: { ...(r.props ?? {}), qty: menge(r) + z.qty } } : r))
      : [...relations, { id: newId(), type: 'holds', to: z.to, props: { qty: z.qty, tier: 'pack', [UNSTOWED]: true } }];
  }
  return { ...after, relations };
}

/** Ein Stapel, der liegenbleibt oder liegenblieb. */
export interface LeftPiece {
  /** Das Inventar, aus dem er kam. */
  inventory: EntityId;
  /** Die `holds`-Kante dort. */
  edge: string;
  item: EntityId;
  qty: number;
}

/** Was in diesen Inventaren unverstaut liegt — Reserviertes bleibt, wo es ist. */
export function unstowedIn(inventories: readonly Entity[]): LeftPiece[] {
  return inventories.flatMap((inv) =>
    (inv.relations ?? [])
      .filter((r) => isUnstowed(r) && !r.props?.['reservedFor'])
      .map((r) => ({ inventory: inv.id, edge: r.id, item: r.to, qty: menge(r) })),
  );
}

/**
 * **Liegenlassen**: was in den Inventaren unverstaut liegt, verlässt sie
 * und steht an der Sitzung (`leftBehind`, mit `qty`, `from` und `at`).
 * Zurück kommen die Sitzung und nur die Inventare, die sich geändert
 * haben; die alten bleiben unberührt. Eine Notiz oder Drehung an der
 * Kante geht dabei nicht mit — was am Boden liegt, liegt nirgends.
 */
export function leaveBehind(
  session: Entity,
  inventories: readonly Entity[],
  opts: { at: string; newId: () => string },
): { session: Entity; inventories: Entity[]; left: LeftPiece[] } {
  const left = unstowedIn(inventories);
  if (!left.length) return { session, inventories: [], left };
  const weg = new Set(left.map((l) => `${l.inventory} ${l.edge}`));
  const geaendert = inventories
    .filter((inv) => left.some((l) => l.inventory === inv.id))
    .map((inv) => ({ ...inv, relations: (inv.relations ?? []).filter((r) => !weg.has(`${inv.id} ${r.id}`)) }));
  const kanten: Relation[] = left.map((l) => ({
    id: opts.newId(),
    type: LEFT_BEHIND,
    to: l.item,
    props: { qty: l.qty, from: l.inventory, at: opts.at },
  }));
  return { session: { ...session, relations: [...(session.relations ?? []), ...kanten] }, inventories: geaendert, left };
}

export type PickUpRefusal = 'missing';

/**
 * **Aufheben**: ein liegengelassener Stapel kommt aus der Sitzung in ein
 * Inventar — wieder unverstaut, denn aufgehoben ist noch nicht eingepackt.
 * Liegt dort schon derselbe Gegenstand unverstaut, wächst dessen Stapel.
 */
export function pickUp(
  session: Entity,
  inventory: Entity,
  edgeId: string,
  newId: string,
): { session: Entity; inventory: Entity; item: EntityId; qty: number } | { refused: PickUpRefusal } {
  const kante = (session.relations ?? []).find((r) => r.id === edgeId && r.type === LEFT_BEHIND);
  if (!kante) return { refused: 'missing' };
  const qty = menge(kante);
  const liste = inventory.relations ?? [];
  const da = liste.find((r) => isUnstowed(r) && r.to === kante.to && !r.props?.['reservedFor']);
  const relations = da
    ? liste.map((r) => (r === da ? { ...r, props: { ...(r.props ?? {}), qty: menge(r) + qty } } : r))
    : [...liste, { id: newId, type: 'holds', to: kante.to, props: { qty, tier: 'pack', [UNSTOWED]: true } }];
  return {
    session: { ...session, relations: (session.relations ?? []).filter((r) => r !== kante) },
    inventory: { ...inventory, relations },
    item: kante.to,
    qty,
  };
}

/** Was an der Sitzung „der Tisch zieht weiter" heisst: eine andere Szene, ein anderer Kampf, eine andere Karte. */
export const MOVES_ON = ['activeScene', 'activeEncounter', 'activeMap'] as const;

/**
 * **Zieht der Tisch weiter?** Hat sich an der Sitzung Szene, Kampf oder
 * Karte geändert — auch auf leer: wer den Kampf beendet, geht weiter.
 * Ein Wert, der zum ersten Mal gesetzt wird, zählt nicht: wer die Sitzung
 * beginnt, hat noch nichts zurückgelassen.
 */
export function tableMovedOn(before: Pick<Entity, 'components'> | null | undefined, after: Pick<Entity, 'components'>): boolean {
  if (!before) return false;
  /* Die Felder erklärt `Session` selbst (eine Karte je Art); `SessionState`
     liest `karten.ts` auch — beide gelten, die eigene zuletzt. */
  const zustand = (e: Pick<Entity, 'components'>): Record<string, unknown> => ({
    ...(e.components?.['SessionState'] ?? {}),
    ...(e.components?.['Session'] ?? {}),
  });
  const a = zustand(before);
  const b = zustand(after);
  return MOVES_ON.some((k) => (a[k] ?? null) !== null && (a[k] ?? null) !== (b[k] ?? null));
}
