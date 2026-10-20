/**
 * **Ebenen einer Karte und Übergänge** (T-307, E-108, REQ-130) — Stockwerke,
 * Keller, Turmgeschosse, und was sie verbindet.
 *
 * **Eine flache Liste, keine Stapelnummer.** Je Ebene ein Gebäudeteil
 * (`structure`: Halle, Westturm …) und optional ein Höhenbereich
 * (`elevation`, von–bis in Fuss). Welche Ebenen verbunden sind, sagen allein
 * die Übergänge — nie die Reihenfolge. So decken zwei ungleich hohe Türme
 * sich ab: Westturm 1 ist 0–20 ft, Ostturm 1 und 2 sind 0–10 und 10–20 ft.
 *
 * **Die erste Ebene ist die Karte selbst** („Ground"): ihr Bild ist
 * `Image.image`, ihr Gitter, ihre Sperren und Blätter stehen, wo sie vor
 * T-307 standen. Bestehende Karten sind darum ohne Umschreiben eine Karte mit
 * einer Ebene. Jede weitere Ebene trägt in `Map.floors` **dieselben Felder**
 * (`FLOOR_FIELDS`): eigenes Bild, eigenes Gitter und eigener Massstab, eigene
 * Sperren und Blätter. Ihr Nebel und ob sie freigegeben ist, stehen nicht an
 * ihr, sondern in `Map.floorReveal` und `Map.floorReleased` — das ist der
 * Stand am Tisch, und an einer Instanz (T-289) soll das Aufdecken eines
 * Kellers nicht alle Ebenen der Vorlage in die Instanz kopieren.
 *
 * **Gerechnet wird je Ebene über eine Projektion** (`floorView`): ein
 * Artikel, der aussieht wie eine Karte mit einer Ebene — Bild, Gitter,
 * Sperren und Nebel dieser Ebene, nur ihre Marker. Alles, was vor T-307 an
 * einer Karte rechnete (Sicht, Licht, Messen, Aufdecken, Zurückhalten),
 * rechnet so unverändert je Ebene; `withFloorView` schreibt zurück.
 *
 * Kein Framework, kein DOM.
 */

import type { Pt } from './sight.js';
import type { Entity, EntityId, Relation } from './types.js';

const KARTE = 'Map';
const MARKER = 'marker';

/** Die Id der ersten Ebene — der Karte selbst. */
export const GROUND_FLOOR = 'ground';

/**
 * Was eine Ebene für sich hat. `image` steht an ihr selbst (an der ersten
 * Ebene: `Image.image`); der Nebel (`reveal`) steht in `Map.floorReveal`.
 */
export const FLOOR_FIELDS: readonly string[] = [
  'gridShape',
  'gridSize',
  'gridOffsetX',
  'gridOffsetY',
  'scale',
  'gridColor',
  'gridOpacity',
  'gridHidden',
  'sheets',
  'baseHidden',
  'baseGmOnly',
  'walls',
  'lighting',
];
/** Was die Ebenen betrifft und an keiner einzelnen steht. */
const STAND = ['floors', 'floorReveal', 'floorReleased'];
/** Was eine Ebene über sich sagt. */
const META = ['id', 'name', 'structure', 'elevation', 'gmOnly'] as const;
/** Was eine neue Ebene von der ersten übernimmt: dasselbe Gitter als Anfang, danach ihr eigenes. */
const VON_GROUND = ['gridShape', 'gridSize', 'scale', 'gridColor', 'gridOpacity', 'gridHidden'];

export interface Elevation {
  /** Unterkante in Fuss. */
  from: number;
  /** Oberkante in Fuss. */
  to: number;
}

export interface MapFloor {
  id: string;
  name: string;
  /** Der Gebäudeteil — die Leiste gruppiert danach. Leer: das Gebäude selbst. */
  structure: string;
  elevation: Elevation | null;
  /** Nie für Spielende — Notizen der Leitung, ein Geheimgeschoss. */
  gmOnly: boolean;
  /** Freigegeben (Vorgabe ja); `false` hält die Ebene zurück, bis die Leitung sie freigibt. */
  released: boolean;
  /** Die erste Ebene: die Karte selbst. */
  ground: boolean;
  image: string;
}

type Roh = Record<string, unknown>;

function kartenFeld(map: Entity): Roh {
  return (map.components?.[KARTE] ?? {}) as Roh;
}

function rohEbenen(map: Entity): Roh[] {
  const v = kartenFeld(map)['floors'];
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Roh[]) : [];
}

function zahl(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
}

function hoehe(v: unknown): Elevation | null {
  if (!v || typeof v !== 'object') return null;
  const a = zahl((v as Roh)['from']);
  const b = zahl((v as Roh)['to']);
  if (a === null && b === null) return null;
  const von = a ?? b!;
  const bis = b ?? a!;
  return { from: Math.min(von, bis), to: Math.max(von, bis) };
}

function dict(map: Entity, feld: string): Roh {
  const v = kartenFeld(map)[feld];
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Roh) : {};
}

function ebeneAus(r: Roh, i: number, map: Entity): MapFloor {
  const id = typeof r['id'] === 'string' && r['id'] ? r['id'] : `floor-${i + 1}`;
  const ground = id === GROUND_FLOOR;
  return {
    id,
    name: typeof r['name'] === 'string' && r['name'].trim() ? r['name'].trim() : ground ? 'Ground' : `Floor ${i + 1}`,
    structure: typeof r['structure'] === 'string' ? r['structure'].trim() : '',
    elevation: hoehe(r['elevation']),
    gmOnly: !ground && r['gmOnly'] === true,
    released: ground || dict(map, 'floorReleased')[id] !== false,
    ground,
    image: ground ? bildDerKarte(map) : typeof r['image'] === 'string' ? r['image'].trim() : '',
  };
}

function bildDerKarte(map: Entity): string {
  const v = (map.components?.['Image'] as { image?: unknown } | undefined)?.image;
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * **Die Ebenen einer Karte**, die erste zuerst. Eine Karte ohne `floors` hat
 * genau eine — „Ground", die Karte selbst (E-108: bestehende Karten).
 */
export function mapFloors(map: Entity): MapFloor[] {
  const roh = rohEbenen(map);
  const g = roh.find((r) => r['id'] === GROUND_FLOOR) ?? { id: GROUND_FLOOR };
  const rest = roh.filter((r) => r['id'] !== GROUND_FLOOR);
  const out = [ebeneAus(g, 0, map)];
  const ids = new Set([GROUND_FLOOR]);
  rest.forEach((r, i) => {
    const f = ebeneAus(r, i + 1, map);
    if (ids.has(f.id)) return;
    ids.add(f.id);
    out.push(f);
  });
  return out;
}

/** Hat die Karte mehr als die eine Ebene? */
export function hasFloors(map: Entity): boolean {
  return rohEbenen(map).some((r) => r['id'] !== GROUND_FLOOR);
}

/** Die Ebene eines Markers: `props.floor`, ohne Angabe die erste. */
export function floorOfRelation(r: Pick<Relation, 'props'>): string {
  const f = (r.props as Roh | undefined)?.['floor'];
  return typeof f === 'string' && f ? f : GROUND_FLOOR;
}

/**
 * **Die Leiste: nach Gebäudeteil, darin nach Höhe** (E-108). Ohne Höhe
 * stehen Ebenen hinter denen mit Höhe, in der Reihenfolge der Liste; die
 * Gruppen ordnen nach ihrer niedrigsten Ebene, das Gebäude selbst (`''`)
 * zuerst.
 */
export function floorGroups(floors: readonly MapFloor[]): Array<{ structure: string; floors: MapFloor[] }> {
  const nach = new Map<string, MapFloor[]>();
  for (const f of floors) (nach.get(f.structure) ?? nach.set(f.structure, []).get(f.structure)!).push(f);
  const unten = (f: MapFloor) => f.elevation?.from ?? Number.POSITIVE_INFINITY;
  const gruppen = [...nach].map(([structure, fs]) => ({
    structure,
    floors: fs.map((f, i) => ({ f, i })).sort((a, b) => unten(a.f) - unten(b.f) || a.i - b.i).map((x) => x.f),
  }));
  return gruppen.sort((a, b) => {
    if (!a.structure !== !b.structure) return a.structure ? 1 : -1;
    return Math.min(...a.floors.map(unten)) - Math.min(...b.floors.map(unten));
  });
}

/** Wie die Höhe in der Leiste steht: „0–20 ft". */
export function elevationLabel(e: Elevation | null): string {
  if (!e) return '';
  return e.from === e.to ? `${e.from} ft` : `${e.from}–${e.to} ft`;
}

/** Decken sich zwei Höhenbereiche? Eine gemeinsame Kante zählt nicht. */
export function elevationsOverlap(a: Elevation | null, b: Elevation | null): boolean {
  return !!a && !!b && a.from < b.to && b.from < a.to;
}

// --------------------------------------------------------------- Projektion

function ohne(o: Roh, keys: readonly string[]): Roh {
  const r: Roh = {};
  for (const [k, v] of Object.entries(o)) if (!keys.includes(k)) r[k] = v;
  return r;
}
function nur(o: Roh, keys: readonly string[]): Roh {
  const r: Roh = {};
  for (const k of keys) if (k in o) r[k] = o[k];
  return r;
}

/**
 * **Die Karte, wie eine Ebene sie sieht** — Bild, Gitter, Sperren, Blätter
 * und Nebel dieser Ebene, die Marker auf ihr; was für die ganze Karte gilt
 * (Nebel an, Freigabe, Art), bleibt. Eine unbekannte Ebene ist die erste.
 */
export function floorView(map: Entity, floor: string | null | undefined): Entity {
  const id = floor && floor !== GROUND_FLOOR && rohEbenen(map).some((r) => r['id'] === floor) ? floor : GROUND_FLOOR;
  const mehrere = hasFloors(map);
  const relations = mehrere
    ? (map.relations ?? []).filter((r) => r.type !== MARKER || floorOfRelation(r) === id)
    : map.relations;
  /* Eine Ebene ist eine Karte ohne weitere Ebenen: was die anderen
     betrifft, steht nicht in ihr — sonst rechnete `redactMap` an ihr noch
     einmal je Ebene. */
  const oben = kartenFeld(map);
  if (id === GROUND_FLOOR) {
    if (!mehrere) return map;
    return { ...map, components: { ...map.components, [KARTE]: ohne(oben, STAND) }, relations: relations ?? [] };
  }
  const f = rohEbenen(map).find((r) => r['id'] === id)!;
  const karte: Roh = { ...ohne(oben, [...FLOOR_FIELDS, 'reveal', ...STAND]), ...nur(f, FLOOR_FIELDS) };
  const reveal = dict(map, 'floorReveal')[id];
  karte['reveal'] = Array.isArray(reveal) ? reveal : [];
  const bild = { ...((map.components?.['Image'] ?? {}) as Roh), image: typeof f['image'] === 'string' ? f['image'] : '' };
  return { ...map, components: { ...map.components, [KARTE]: karte, Image: bild }, relations: relations ?? [] };
}

/**
 * **Zurückschreiben, was an einer Ebene geändert wurde** — `view` ist eine
 * (veränderte) `floorView` derselben Karte. Marker darin gehören der Ebene
 * (neue bekommen `props.floor`), die übrigen Ebenen bleiben, wie sie waren.
 */
export function withFloorView(map: Entity, floor: string | null | undefined, view: Entity): Entity {
  const id = floor && floor !== GROUND_FLOOR && rohEbenen(map).some((r) => r['id'] === floor) ? floor : GROUND_FLOOR;
  if (!hasFloors(map)) return view;
  const andere = (map.relations ?? []).filter((r) => r.type === MARKER && floorOfRelation(r) !== id);
  const eigene = (view.relations ?? []).map((r) => {
    if (r.type !== MARKER) return r;
    const props = { ...((r.props ?? {}) as Roh) };
    if (id === GROUND_FLOOR) delete props['floor'];
    else props['floor'] = id;
    return { ...r, props };
  });
  const relations = [...eigene, ...andere];
  const oben = kartenFeld(map);
  const vk = (view.components?.[KARTE] ?? {}) as Roh;
  if (id === GROUND_FLOOR) {
    const karte: Roh = { ...vk };
    for (const k of ['floors', 'floorReveal', 'floorReleased']) {
      if (k in oben) karte[k] = oben[k];
      else delete karte[k];
    }
    return { ...view, components: { ...view.components, [KARTE]: karte }, relations };
  }
  const bild = (view.components?.['Image'] as { image?: unknown } | undefined)?.image;
  const floors = rohEbenen(map).map((r) =>
    r['id'] === id ? { ...nur(r, META), ...nur(vk, FLOOR_FIELDS), ...(typeof bild === 'string' && bild ? { image: bild } : {}) } : r,
  );
  const reveal = Array.isArray(vk['reveal']) ? vk['reveal'] : [];
  const karte: Roh = {
    ...nur(oben, [...FLOOR_FIELDS, 'reveal', 'floorReleased']),
    ...ohne(vk, [...FLOOR_FIELDS, 'reveal', 'floors', 'floorReveal', 'floorReleased']),
    floors,
    floorReveal: { ...dict(map, 'floorReveal'), [id]: reveal },
  };
  const components: NonNullable<Entity['components']> = { ...view.components, [KARTE]: karte };
  /* Das Bild der Ebene steht an ihr — `Image` bleibt das der Karte. */
  if (map.components?.['Image']) components['Image'] = map.components['Image'];
  else delete components['Image'];
  return { ...view, components, relations };
}

/** An einer Ebene etwas ändern: projizieren, ändern, zurückschreiben. */
export function onFloor(map: Entity, floor: string | null | undefined, fn: (view: Entity) => Entity): Entity {
  return withFloorView(map, floor, fn(floorView(map, floor)));
}

/** Auf welcher Ebene liegt eine Sperre? Die erste, wenn sie keine kennt. */
export function floorOfWall(map: Entity, wallId: string): string {
  for (const r of rohEbenen(map)) {
    const w = r['walls'];
    if (r['id'] !== GROUND_FLOOR && Array.isArray(w) && w.some((x) => (x as Roh | null)?.['id'] === wallId)) return String(r['id']);
  }
  return GROUND_FLOOR;
}

/** Auf welcher Ebene steht ein Marker? */
export function floorOfMarker(map: Entity, relId: string): string {
  const r = (map.relations ?? []).find((x) => x.id === relId);
  return r ? floorOfRelation(r) : GROUND_FLOOR;
}

// ------------------------------------------------------------- Ebenen ändern

function mitKarte(map: Entity, patch: Roh): Entity {
  const karte: Roh = { ...kartenFeld(map) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete karte[k];
    else karte[k] = v;
  }
  return { ...map, components: { ...map.components, [KARTE]: karte } };
}

/**
 * **Eine Ebene dazu**, mit dem Gitter der ersten als Anfang. Die erste
 * Ebene steht danach ausdrücklich in der Liste — sie trägt dort ihren
 * Namen, Gebäudeteil und Höhe.
 */
export function addFloor(
  map: Entity,
  id: string,
  meta: { name: string; structure?: string; elevation?: Elevation | null },
): Entity {
  const roh = rohEbenen(map);
  if (roh.some((r) => r['id'] === id) || id === GROUND_FLOOR) return map;
  const oben = kartenFeld(map);
  const ground = roh.find((r) => r['id'] === GROUND_FLOOR) ?? { id: GROUND_FLOOR, name: 'Ground' };
  const neu: Roh = { id, name: meta.name.trim() || 'Floor', ...nur(oben, VON_GROUND) };
  if (meta.structure?.trim()) neu['structure'] = meta.structure.trim();
  if (meta.elevation) neu['elevation'] = meta.elevation;
  return mitKarte(map, { floors: [ground, ...roh.filter((r) => r['id'] !== GROUND_FLOOR), neu] });
}

/**
 * **Was eine Ebene über sich sagt** — Name, Gebäudeteil, Höhe, `gmOnly`,
 * `image`; `null` nimmt eine Angabe weg. Die Freigabe steht nicht hier
 * (`setFloorReleased`).
 */
export function updateFloor(map: Entity, id: string, patch: Readonly<Record<string, unknown>>): Entity {
  const erlaubt = id === GROUND_FLOOR ? ['name', 'structure', 'elevation'] : ['name', 'structure', 'elevation', 'gmOnly', 'image'];
  const roh = rohEbenen(map);
  const liste = roh.some((r) => r['id'] === id) ? roh : id === GROUND_FLOOR ? [{ id: GROUND_FLOOR }, ...roh] : roh;
  if (!liste.some((r) => r['id'] === id)) return map;
  return mitKarte(map, {
    floors: liste.map((r) => {
      if (r['id'] !== id) return r;
      const n = { ...r };
      for (const [k, v] of Object.entries(patch)) {
        if (!erlaubt.includes(k)) continue;
        if (v === null || v === undefined || v === '' || v === false) delete n[k];
        else n[k] = typeof v === 'string' ? v.trim() : v;
      }
      return n;
    }),
  });
}

/** Eine Ebene freigeben oder zurückhalten (Stand am Tisch, `Map.floorReleased`). */
export function setFloorReleased(map: Entity, id: string, released: boolean): Entity {
  if (id === GROUND_FLOOR) return map;
  const d = { ...dict(map, 'floorReleased') };
  if (released) delete d[id];
  else d[id] = false;
  return mitKarte(map, { floorReleased: Object.keys(d).length ? d : undefined });
}

/**
 * **Eine Ebene weg** — mit ihren Markern und den Übergängen dieser Karte,
 * die auf sie zeigen. Die erste bleibt: sie ist die Karte.
 */
export function removeFloor(map: Entity, id: string): Entity {
  if (id === GROUND_FLOOR || !rohEbenen(map).some((r) => r['id'] === id)) return map;
  const floors = rohEbenen(map).filter((r) => r['id'] !== id);
  const reveal = { ...dict(map, 'floorReveal') };
  delete reveal[id];
  const frei = { ...dict(map, 'floorReleased') };
  delete frei[id];
  const e = mitKarte(map, {
    floors: floors.length ? floors : undefined,
    floorReveal: Object.keys(reveal).length ? reveal : undefined,
    floorReleased: Object.keys(frei).length ? frei : undefined,
  });
  return {
    ...e,
    relations: (map.relations ?? []).filter((r) => {
      if (r.type !== MARKER) return true;
      if (floorOfRelation(r) === id) return false;
      const p = (r.props ?? {}) as Roh;
      return !(p['kind'] === 'passage' && r.to === map.id && (p['toFloor'] ?? GROUND_FLOOR) === id);
    }),
  };
}

// ---------------------------------------------------------------- Übergänge

/** Was ein Übergang ist — eine Markerart, vier Gestalten (E-108). */
export type PassageKind = 'stairs' | 'ladder' | 'bridge' | 'portal';
export const PASSAGE_KINDS: readonly PassageKind[] = ['stairs', 'ladder', 'bridge', 'portal'];
/** Durchsehen (wie eine Treppe) oder nur durchgehen. */
export type PassageSight = 'through' | 'none';

/**
 * **Ein Übergang** — ein Marker `kind: 'passage'` auf einer Ebene, mit Ziel
 * {Karte, Ebene, Punkt}. Die Karte ist das Ziel der Kante (`to`): dieselbe
 * Karte für Treppe und Leiter, eine andere für ein Portal dorthin. In beide
 * Richtungen gilt er, solange er nicht `oneWay` ist — die Gegenseite ist
 * dann ein **gespiegeltes Ende** am Zielpunkt (`mirrored`), kein zweiter
 * Marker: ein Paar von Hand zu pflegen hiesse, dass eines wandert und das
 * andere nicht.
 */
export interface Passage {
  /** Die Markerkante. */
  relId: string;
  kind: PassageKind;
  map: EntityId;
  floor: string;
  at: Pt;
  toMap: EntityId;
  toFloor: string;
  toAt: Pt;
  sight: PassageSight;
  oneWay: boolean;
  /** Das Ende am Ziel eines Übergangs in beide Richtungen. */
  mirrored: boolean;
  note: string;
}

const anteil = (v: unknown, sonst: number): number => {
  const n = zahl(v);
  return n === null ? sonst : Math.min(1, Math.max(0, n));
};

/** Ein Übergang aus seiner Markerkante; `null`, wenn sie keiner ist. */
export function passageOf(map: Entity, r: Relation): Passage | null {
  const p = (r.props ?? {}) as Roh;
  if (r.type !== MARKER || p['kind'] !== 'passage' || !r.to) return null;
  const kind = PASSAGE_KINDS.includes(p['passage'] as PassageKind) ? (p['passage'] as PassageKind) : 'stairs';
  return {
    relId: r.id,
    kind,
    map: map.id,
    floor: floorOfRelation(r),
    at: { x: anteil(p['x'], 0.5), y: anteil(p['y'], 0.5) },
    toMap: r.to,
    toFloor: typeof p['toFloor'] === 'string' && p['toFloor'] ? p['toFloor'] : GROUND_FLOOR,
    toAt: { x: anteil(p['toX'], 0.5), y: anteil(p['toY'], 0.5) },
    sight: p['sight'] === 'none' ? 'none' : 'through',
    oneWay: p['oneWay'] === true,
    mirrored: false,
    note: typeof p['note'] === 'string' ? p['note'] : '',
  };
}

/** Alle Übergänge der Karte, wie sie gespeichert sind (ein Ende je Übergang). */
export function passagesOf(map: Entity): Passage[] {
  return (map.relations ?? []).flatMap((r) => passageOf(map, r) ?? []);
}

/**
 * **Die Enden auf einer Ebene** — die Übergänge, die hier stehen, und die
 * gespiegelten Enden der Übergänge dieser Karte, die in beide Richtungen
 * gelten und hierher führen. Ein Portal auf eine andere Karte hat dort kein
 * gespiegeltes Ende: zurück führt ein Portal, das man dort setzt.
 */
export function passageEnds(map: Entity, floor: string): Passage[] {
  const alle = passagesOf(map);
  const hier = alle.filter((p) => p.floor === floor);
  const zurueck = alle
    .filter((p) => !p.oneWay && p.toMap === map.id && p.toFloor === floor)
    .map((p) => ({ ...p, floor: p.toFloor, at: p.toAt, toFloor: p.floor, toAt: p.at, mirrored: true }));
  return [...hier, ...zurueck];
}

/** Steht ein Punkt auf diesem Ende? `reach` in Anteilen der Breite, `ar` Höhe durch Breite. */
export function onPassage(end: Pick<Passage, 'at'>, p: Pt, reach: number, ar: number): boolean {
  return Math.hypot(p.x - end.at.x, (p.y - end.at.y) * (ar > 0 ? ar : 1)) <= reach;
}

/** Ein Token steht auf einem Übergang, wenn es dessen Punkt bis auf diesen Rest trifft — gesetzt wird es genau dorthin. */
export const PASSAGE_EXACT = 0.002;

/** Das nächste Ende auf dieser Ebene, auf dem der Punkt steht. */
export function passageAt(map: Entity, floor: string, p: Pt, reach: number = PASSAGE_EXACT, ar = 1): Passage | null {
  let best: Passage | null = null;
  let d = Infinity;
  for (const e of passageEnds(map, floor)) {
    const a = Math.hypot(p.x - e.at.x, (p.y - e.at.y) * (ar > 0 ? ar : 1));
    if (a <= reach && a < d) {
      best = e;
      d = a;
    }
  }
  return best;
}

/**
 * **Durchgehen** (T-307): das Token steht auf einem Ende und wechselt auf
 * dessen Ziel — Ebene und Punkt. Nur innerhalb der Karte; ein Portal auf
 * eine andere Karte gibt `null` (das Token gehört dort einer anderen
 * Instanz). Einbahn heisst: das gespiegelte Ende gibt es nicht, also geht
 * es auch nicht zurück.
 */
export function goThrough(map: Entity, tokenRel: string, end: Passage): Entity | null {
  if (end.toMap !== map.id) return null;
  const r = (map.relations ?? []).find((x) => x.id === tokenRel && x.type === MARKER);
  if (!r || floorOfRelation(r) !== end.floor) return null;
  if (!mapFloors(map).some((f) => f.id === end.toFloor)) return null;
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  return {
    ...map,
    relations: (map.relations ?? []).map((x) => {
      if (x.id !== tokenRel) return x;
      const props: Roh = { ...((x.props ?? {}) as Roh), x: r4(end.toAt.x), y: r4(end.toAt.y) };
      if (end.toFloor === GROUND_FLOOR) delete props['floor'];
      else props['floor'] = end.toFloor;
      return { ...x, props };
    }),
  };
}

/**
 * **Sicht über Übergänge** (T-307, T-305): wer auf einem Ende steht, durch
 * das man sieht, sieht auch vom Zielpunkt aus — auf der Zielebene, mit
 * deren Sperren und in deren Massstab (die Rechnung macht die Ebene, nicht
 * der Übergang). Gefragt für eine Ebene `floor`: die Tokens der anderen
 * Ebenen derselben Karte, die von dort hierher sehen, je mit dem Punkt, von
 * dem aus.
 */
export function sightInto(
  map: Entity,
  floor: string,
): Array<{ relId: string; to: EntityId; from: Pt; passage: Passage }> {
  const out: Array<{ relId: string; to: EntityId; from: Pt; passage: Passage }> = [];
  for (const f of mapFloors(map)) {
    if (f.id === floor) continue;
    const enden = passageEnds(map, f.id).filter((e) => e.sight === 'through' && e.toMap === map.id && e.toFloor === floor);
    if (!enden.length) continue;
    for (const r of map.relations ?? []) {
      if (r.type !== MARKER || floorOfRelation(r) !== f.id) continue;
      const p = (r.props ?? {}) as Roh;
      if (p['kind'] !== 'play' && p['kind'] !== 'party') continue;
      const at = { x: anteil(p['x'], 0.5), y: anteil(p['y'], 0.5) };
      const e = enden.find((x) => onPassage(x, at, PASSAGE_EXACT, 1));
      if (e) out.push({ relId: r.id, to: r.to, from: e.toAt, passage: e });
    }
  }
  return out;
}

/**
 * **Was Spielende von den Ebenen nicht bekommen** (E-108): Ebenen mit
 * `gmOnly` und zurückgehaltene (`released: false`), samt ihren Markern, und
 * die Übergänge dieser Karte, die dorthin führen — ein Treppenpfeil in ein
 * verborgenes Geschoss verriete es. Den Rest siebt `redactMap` je Ebene.
 */
export function redactFloors(map: Entity): Entity {
  if (!hasFloors(map)) return map;
  const weg = new Set(mapFloors(map).filter((f) => f.gmOnly || !f.released).map((f) => f.id));
  if (!weg.size) return map;
  let e = map;
  for (const id of weg) e = removeFloor(e, id);
  return e;
}
