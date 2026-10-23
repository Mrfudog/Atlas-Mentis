/**
 * **Durch einen Übergang schicken** (T-326, aufbauend auf T-307) — ein
 * Token oder alle in der Fläche, auf die Zielebene derselben Karte oder
 * durch ein Portal auf eine andere Karte.
 *
 * - Dieselbe Karte: je Token ein Feld der Zielfläche (`landingSpots`, freie
 *   zuerst), Ebene gewechselt (`goThrough`).
 * - Eine andere Karte: liegt die Quelle als Instanz auf dem Tisch einer
 *   Sitzung (T-289), kommen die Tokens in die Instanz der Zielkarte für
 *   dieselbe Sitzung (`insSpiel` legt sie an, wenn es sie noch nicht gibt),
 *   sonst in die Zielkarte selbst. **Wer ankommt, sieht die Karte:** eine
 *   zurückgehaltene Instanz wird dabei freigegeben — sonst stünde eine
 *   Figur auf einer Karte, die ihre Spielerin nicht öffnen darf.
 *
 * Die Bildgrösse einer Ebene steht am Asset (`Asset.width/height`); die
 * Zielfelder rechnen damit, ohne dass der Browser das Zielbild kennen muss.
 * Geschrieben wird vom Aufrufer — dieser Baustein rechnet nur und legt
 * höchstens die Zielinstanz an.
 */

import {
  floorView,
  goThrough,
  gridGeometry,
  GROUND_FLOOR,
  isMap,
  isPlayInstance,
  landingSpots,
  mapImage,
  mapSettings,
  markersOf,
  playedInfo,
  type Entity,
  type GridGeometry,
  type Passage,
  type Pt,
} from '@nw/model';
import type { InsSpiel } from './spielinstanz.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}
type Size = { w: number; h: number };

/** Die Bildgrösse einer Ebene aus ihrem Asset — sonst, was der Browser schickte. */
export function natDerEbene(stand: Stand, view: Entity, sonst: Size | null): Size | null {
  const a = stand.map.get(mapImage(view))?.components?.['Asset'] as { width?: unknown; height?: unknown } | undefined;
  const w = Number(a?.width);
  const h = Number(a?.height);
  return w > 0 && h > 0 ? { w, h } : sonst;
}

/** Das Gitter einer Ebene, gerechnet mit der Bildgrösse ihres Assets. */
export function geoDerEbene(stand: Stand, karte: Entity, floor: string, sonst: Size | null): GridGeometry | null {
  const view = floorView(karte, floor);
  return gridGeometry(mapSettings(view), natDerEbene(stand, view, sonst));
}

export interface Durchgang {
  /** Die Quellkarte nach dem Durchgang (noch nicht geschrieben). */
  quelle: Entity;
  /** Weitere Artikel zu schreiben: die Zielkarte, wenn es eine andere ist. */
  andere: Entity[];
  /** Wohin: Karte (bei einem Portal die Instanz) und Ebene. */
  map: string;
  floor: string;
  moved: Array<{ rel: string; to: Pt }>;
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;

/**
 * **Tokens durch ein Ende schicken.** `karte` ist die geltende Quellkarte
 * (wie sie geschrieben wird), `rels` die Markerkanten. `null` als Fehler,
 * wenn das Ziel fehlt.
 */
export async function durchschicken(
  deps: { geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>; insSpiel?: InsSpiel | undefined },
  o: { stand: Stand; karte: Entity; kampagne: Entity | null; ende: Passage; rels: readonly string[]; nat: Size | null },
): Promise<Durchgang | { fehler: number; error: string; issues?: unknown }> {
  const { stand, ende } = o;
  const rels = o.rels.filter((id) => markersOf(o.karte).some((m) => m.rel.id === id));
  if (!rels.length) return { fehler: 422, error: 'Nobody stands in this passage.' };

  if (ende.toMap === o.karte.id) {
    const geo = geoDerEbene(stand, o.karte, ende.toFloor, o.nat);
    const belegt = markersOf(floorView(o.karte, ende.toFloor))
      .filter((m) => (m.kind === 'play' || m.kind === 'party') && !rels.includes(m.rel.id))
      .map((m) => ({ x: m.x, y: m.y }));
    const spots = landingSpots(ende, geo, belegt, rels.length);
    let karte = o.karte;
    const moved: Durchgang['moved'] = [];
    for (const [i, rel] of rels.entries()) {
      const neu = goThrough(karte, rel, ende, spots[i]);
      if (!neu) return { fehler: 422, error: 'This passage leads nowhere.' };
      karte = neu;
      moved.push({ rel, to: spots[i]! });
    }
    return { quelle: karte, andere: [], map: karte.id, floor: ende.toFloor, moved };
  }

  /* **Ein Portal auf eine andere Karte.** */
  const vorlage = stand.map.get(ende.toMap);
  if (!vorlage || !isMap(vorlage)) return { fehler: 404, error: 'The map this portal leads to is gone.' };
  let ziel = vorlage;
  const sitzungId = isPlayInstance(o.karte) ? playedInfo(o.karte).session : null;
  const sitzung = sitzungId ? stand.map.get(sitzungId) ?? null : null;
  if (sitzung && deps.insSpiel) {
    const r = await deps.insSpiel({ stand, kampagne: o.kampagne, template: vorlage, session: sitzung });
    if ('issues' in r) return { fehler: 422, error: 'The map this portal leads to could not be taken into play.', issues: r.issues };
    ziel = r.instance;
  }
  ziel = await deps.geltend(ziel, stand.map);
  const geo = geoDerEbene(stand, ziel, ende.toFloor, null);
  const belegt = markersOf(floorView(ziel, ende.toFloor))
    .filter((m) => m.kind === 'play' || m.kind === 'party')
    .map((m) => ({ x: m.x, y: m.y }));
  const spots = landingSpots(ende, geo, belegt, rels.length);
  /* Auch die Ids der Quellkarte gelten als vergeben (T-410): die Zielkarte
     wird zuerst geschrieben, und solange hängt die Kante noch an der
     Quelle — in Postgres ist `relation.id` eindeutig über alle Artikel. */
  const vergeben = new Set([...(ziel.relations ?? []), ...(o.karte.relations ?? [])].map((r) => r.id));
  const dazu = [];
  const moved: Durchgang['moved'] = [];
  for (const [i, rel] of rels.entries()) {
    const r = (o.karte.relations ?? []).find((x) => x.id === rel)!;
    let id = r.id;
    for (let k = 2; vergeben.has(id); k++) id = `${r.id}-${k}`;
    vergeben.add(id);
    const props: Record<string, unknown> = { ...((r.props ?? {}) as Record<string, unknown>), x: r4(spots[i]!.x), y: r4(spots[i]!.y) };
    if (ende.toFloor === GROUND_FLOOR) delete props['floor'];
    else props['floor'] = ende.toFloor;
    /* Vorbereitet für eine Begegnung der Quellkarte hiess dort etwas — hier nicht. */
    delete props['encounter'];
    dazu.push({ ...r, id, props });
    moved.push({ rel: id, to: spots[i]! });
  }
  let neuesZiel: Entity = { ...ziel, relations: [...(ziel.relations ?? []), ...dazu] };
  const kz = (neuesZiel.components?.['Map'] ?? {}) as Record<string, unknown>;
  if (isPlayInstance(neuesZiel) && kz['released'] === false) {
    neuesZiel = { ...neuesZiel, components: { ...neuesZiel.components, Map: { ...kz, released: true } } };
  }
  const quelle: Entity = { ...o.karte, relations: (o.karte.relations ?? []).filter((r) => !rels.includes(r.id)) };
  return { quelle, andere: [neuesZiel], map: neuesZiel.id, floor: ende.toFloor, moved };
}
