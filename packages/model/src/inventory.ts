/**
 * **Das Inventar nach Basils Blatt** (REQ-214 bis 217, D54).
 *
 * Drei Rechnungen, alle beim Lesen (D8) und keine davon gespeichert:
 *
 *  - **Das Tragraster** einer Kreatur, deren Inventar keine eigene Form
 *    hat: seit REQ-356 aus den Bausteinen des Tragblatts, die für sie
 *    gelten, aneinandergefügt (`carrySheet.ts`) — Grösse, Stärke oder was
 *    eine Bedingung sonst nennt. Das Blatt steht als Einstellung; eine
 *    Kampagne mit einem anderen Blatt ist eine andere Zeile, kein
 *    Codewechsel. Die älteren Einstellungen nach Spalten liest es weiter.
 *  - **Die Ziehstufe die Kette hinauf**: ein Stück in einem Behälter
 *    braucht das Langsamere aus seiner Zone und der Stufe des Behälters
 *    + 1. Ein Behälter an einem Körperplatz nimmt die Stufe des Platzes
 *    (Einstellung `slotDraw`).
 *
 * Kein Framework, keine Entitäten: wer die Kette baut (Server, Prototyp),
 * reicht die Plätze herein. So bleibt die Regel an einer Stelle.
 *
 * Dazu (T-127) das **Raster** selbst — Form drehen, passt es, erster
 * freier Platz, Zone eines Stücks —, das **Regelset** der Kampagne
 * (Raster, Gewicht oder Slots), Gewicht und Tragestufen, Slots, das
 * **Verschieben** zwischen zwei Inventaren und die Reservierung eines
 * Stücks (`holds.props.reservedFor`, für den Handwerksauftrag T-128).
 */
import type { Entity, EntityId, Relation } from './types.js';


/** Ein Zeichen, das kein Feld ist — wie in `Item.rows` und `Inventory.grid`. */
const EMPTY = new Set(['0', '.', ' ', '_']);

/**
 * Eine Liste `schlüssel:wert, schlüssel:wert` lesen. Leere Teile und Teile
 * ohne Doppelpunkt fallen weg — eine halb getippte Einstellung soll den
 * Rest nicht mitnehmen.
 */
export function parsePairs(spec: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const teil of String(spec ?? '').split(',')) {
    const i = teil.indexOf(':');
    if (i <= 0) continue;
    const k = teil.slice(0, i).trim();
    const v = teil.slice(i + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

/** `tiny:3, small:4, medium:5, large:6` → Seitenlänge je Grösse. */
export function parseCarrySquares(spec: string | undefined | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsePairs(spec))) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k.toLowerCase()] = Math.floor(n);
  }
  return out;
}

/** Die Zonen nach Spalten als Spalte → Stufe: `0-1:action` → `{0: 'action', 1: 'action'}`. */
export function zonesByColumn(spec: string | undefined | null): Record<number, string> {
  const spalte: Record<number, string> = {};
  for (const [k, v] of Object.entries(parsePairs(spec))) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(k);
    if (!m) continue;
    const von = Number(m[1]);
    const bis = m[2] === undefined ? von : Number(m[2]);
    for (let x = Math.min(von, bis); x <= Math.max(von, bis); x++) spalte[x] = v;
  }
  return spalte;
}

/** Schlüssel und Wert wieder als Einstellung (`tiny:3, small:4`); leere Werte fallen weg. */
export function formatPairs(paare: Readonly<Record<string, string | number>>): string {
  return Object.entries(paare)
    .filter(([k, v]) => k.trim() !== '' && String(v).trim() !== '')
    .map(([k, v]) => `${k.trim()}:${String(v).trim()}`)
    .join(', ');
}

/** Das Langsamere zweier Stufen auf der Leiter; eine unbekannte zählt nicht. */
export function slowerDraw(a: string | null | undefined, b: string | null | undefined, ladder: readonly string[]): string | null {
  const ia = a ? ladder.indexOf(a) : -1;
  const ib = b ? ladder.indexOf(b) : -1;
  if (ia < 0 && ib < 0) return null;
  return ladder[Math.max(ia, ib)] ?? null;
}

/** Eine Stufe weiter; die letzte bleibt die letzte. */
export function nextDraw(a: string | null | undefined, ladder: readonly string[]): string | null {
  const i = a ? ladder.indexOf(a) : -1;
  if (i < 0) return null;
  return ladder[Math.min(i + 1, ladder.length - 1)] ?? null;
}

/** Wo ein Stück liegt: in welchem Behälter, auf welcher Zone oder an welchem Platz. */
export interface Placement {
  /** Der Behälter (Name oder Id) — nur für den Weg, gerechnet wird nicht damit. */
  via: string;
  /** Die langsamste Zone, die das Stück im Behälter bedeckt. */
  zone?: string | null;
  /** Der Körperplatz, nur im äussersten Behälter (dem der Kreatur). */
  slot?: string | null;
}

export interface DrawStep extends Placement {
  /** Die Stufe nach diesem Schritt. */
  stage: string | null;
}

/**
 * **Die Ziehstufe die Kette hinauf** (REQ-216, D54).
 *
 * `chain[0]` ist der äusserste Platz (im Inventar der Kreatur), der letzte
 * der des Stücks selbst. Aussen gilt der Platz (`slotDraw`) oder die Zone;
 * jeder Behälter weiter innen gibt eine Stufe dazu: das Langsamere aus der
 * eigenen Zone und der Stufe des Behälters + 1.
 *
 * Kennt ein Schritt keine Stufe (nicht ins Raster gelegt, kein Platz, eine
 * Zone, die die Leiter nicht kennt), ist das Ergebnis `null` — eine
 * geschätzte Stufe sähe aus wie eine, die stimmt.
 */
export function drawStage(
  chain: readonly Placement[],
  ladder: readonly string[],
  slotDraw: Record<string, string>,
): { stage: string | null; steps: DrawStep[] } {
  const steps: DrawStep[] = [];
  let stufe: string | null = null;
  chain.forEach((p, i) => {
    if (i === 0) {
      const amPlatz = p.slot ? slotDraw[p.slot] : undefined;
      stufe = amPlatz && ladder.includes(amPlatz) ? amPlatz
        : p.zone && ladder.includes(p.zone) ? p.zone : null;
    } else if (stufe !== null) {
      const zone = p.zone && ladder.includes(p.zone) ? p.zone : null;
      /* Ohne Zone im inneren Behälter zählt nur die Stufe des Behälters + 1:
         eine Bag of Holding hat auf dem Blatt keine Zonen, und was darin
         liegt, ist trotzdem eine Stufe weiter weg. */
      stufe = slowerDraw(zone, nextDraw(stufe, ladder), ladder);
    }
    steps.push({ ...p, stage: stufe });
  });
  return { stage: stufe, steps };
}

/**
 * Die Hände (REQ-225, D58): was an diesen Plätzen liegt, ist „in der Hand“
 * und kann fallen gelassen oder verstaut werden. Ein Stück ohne Platz mit
 * `tier: 'held'` zählt auch — so stand es vor dem Blatt.
 */
export const HAND_SLOTS: readonly string[] = ['mainHand', 'offHand'];

export function inHand(p: { slot?: string | null; tier?: string | null }): boolean {
  return p.slot ? HAND_SLOTS.includes(p.slot) : p.tier === 'held';
}

/**
 * Was Fallenlassen und Verstauen kosten (REQ-225, D58), aus der
 * Einstellung `handActions` (`drop:free action, stow:bonus action`). Ein
 * Wert, der nicht auf der Leiter (`DrawTime`) steht, gilt nicht — dann
 * steht die Handlung am Bogen nicht, statt auf einer erfundenen Stufe.
 */
export function handActions(
  spec: string | undefined | null,
  ladder: readonly string[],
): { drop: string | null; stow: string | null } {
  const p = parsePairs(spec);
  const auf = (v: string | undefined): string | null => (v && ladder.includes(v) ? v : null);
  return { drop: auf(p['drop']), stow: auf(p['stow']) };
}

// ------------------------------------------------------------ Regelset (T-127)

/**
 * **Wie diese Kampagne Inventar zählt** (T-127): nach Basils Blatt im
 * Raster, nach Gewicht (5e, mit Tragestufen) oder nach Slots. Ein Wort an
 * der Kampagne (`Campaign.inventory`) und keine Einstellung des Registers:
 * zwei Runden derselben Installation spielen verschieden. Bis T-132
 * (Regelsysteme als Behälter) steht es dort; wandert es in ein Modul,
 * ändert sich nur, **wo** diese eine Funktion nachsieht.
 */
export const INVENTORY_RULES = ['grid', 'weight', 'slots'] as const;
export type InventoryRules = (typeof INVENTORY_RULES)[number];

export function inventoryRulesOf(campaign: Entity | null | undefined): InventoryRules {
  const roh = campaign?.components?.['Campaign']?.['inventory'];
  return (INVENTORY_RULES as readonly unknown[]).includes(roh) ? (roh as InventoryRules) : 'grid';
}

// ------------------------------------------------------------ Formen im Raster

export interface Shape {
  /** Ein Zeichen je Feld, wie `Item.rows` und `Inventory.grid`. */
  rows: string[];
  w: number;
  h: number;
}

/** Zeilen lesen, wie sie in einer Karte stehen: Liste oder Text mit Zeilenumbruch/Komma. */
export function shapeRows(roh: unknown): string[] {
  const zeilen = Array.isArray(roh) ? roh.map(String) : typeof roh === 'string' && roh !== '' ? roh.split(/[,\n]/) : [];
  return zeilen.filter((r) => r.trim() !== '');
}

function alsForm(rows: string[]): Shape {
  return { rows, w: rows.reduce((m, r) => Math.max(m, r.length), 0), h: rows.length };
}

/**
 * Eine Form `n` Vierteldrehungen im Uhrzeigersinn. Gedreht wird die Form
 * und nicht der Gegenstand: die Drehung steht an der Kante
 * (`holds.props.rot`), denn derselbe Bogen liegt quer oder längs.
 */
export function turnGrid(rows: readonly string[], n: number): string[] {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 1);
  let netz = rows.map((r) => r.padEnd(w, '.').split(''));
  const mal = ((Math.round(Number(n) || 0) % 4) + 4) % 4;
  for (let i = 0; i < mal; i++) {
    const h = netz.length;
    const br = netz[0]?.length ?? 0;
    const neu: string[][] = [];
    for (let x = 0; x < br; x++) {
      const zeile: string[] = [];
      for (let y = h - 1; y >= 0; y--) zeile.push(netz[y]![x]!);
      neu.push(zeile);
    }
    netz = neu;
  }
  return netz.map((r) => r.join(''));
}

/** Die Form eines Gegenstands, gedreht. Ohne `rows` ein Feld — der Normalfall, kein Sonderfall. */
export function itemShape(rows: unknown, rot = 0): Shape {
  const r = shapeRows(rows);
  if (!r.length) return { rows: ['#'], w: 1, h: 1 };
  return alsForm(rot ? turnGrid(r, Number(rot) / 90) : r);
}

export function filled(shape: Shape, x: number, y: number): boolean {
  const c = shape.rows[y]?.charAt(x) ?? '';
  return c !== '' && !EMPTY.has(c);
}

/**
 * **Die Form des Behälters:** seine eigene (`Inventory.grid`), sonst das
 * Tragraster nach dem Blatt, sonst das Rechteck aus den Einstellungen
 * (`inventoryCols` × `inventoryRows`). Wer seine Form selbst sagt, gewinnt.
 */
export function containerShape(grid: unknown, carry: readonly string[] | null, cols = 10, rows = 6): Shape {
  const eigen = shapeRows(grid);
  if (eigen.length) return alsForm(eigen);
  if (carry?.length) return alsForm([...carry]);
  const c = Math.max(1, Math.trunc(cols) || 10);
  return alsForm(Array.from({ length: Math.max(1, Math.trunc(rows) || 6) }, () => '#'.repeat(c)));
}

/** Ein Stück im Raster: welche Kante, welche Form, wo, wie gedreht. */
export interface GridPiece {
  key: string;
  rows: unknown;
  gx?: number | null;
  gy?: number | null;
  rot?: number | null;
}

function liegt(p: GridPiece): p is GridPiece & { gx: number; gy: number } {
  return typeof p.gx === 'number' && typeof p.gy === 'number';
}

/** Die Felder, die ein Stück belegt, als `x,y`. */
export function cellsOf(p: GridPiece, rot = p.rot ?? 0, gx = p.gx ?? 0, gy = p.gy ?? 0): string[] {
  const f = itemShape(p.rows, rot);
  const out: string[] = [];
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (filled(f, x, y)) out.push(`${gx + x},${gy + y}`);
  return out;
}

/**
 * **Passt das Stück dorthin?** Der Rand, gesperrte Felder und belegte
 * Felder sind die einzigen Gründe für nein — Gewicht zählt im Raster nicht.
 */
export function fitsAt(box: Shape, pieces: readonly GridPiece[], piece: GridPiece, gx: number, gy: number, rot = piece.rot ?? 0): boolean {
  const f = itemShape(piece.rows, rot);
  if (gx < 0 || gy < 0 || gx + f.w > box.w || gy + f.h > box.h) return false;
  const belegt = new Set<string>();
  for (const p of pieces) if (p.key !== piece.key && liegt(p)) for (const c of cellsOf(p)) belegt.add(c);
  for (const c of cellsOf(piece, rot, gx, gy)) {
    const [x, y] = c.split(',').map(Number) as [number, number];
    if (!filled(box, x, y) || belegt.has(c)) return false;
  }
  return true;
}

/** Der erste freie Platz, zeilenweise von oben links — erst wie es liegt, dann gedreht. */
export function firstFreeSpot(box: Shape, pieces: readonly GridPiece[], piece: GridPiece): { gx: number; gy: number; rot: number } | null {
  const r0 = piece.rot ?? 0;
  for (const rot of [r0, (r0 + 90) % 360]) {
    for (let gy = 0; gy < box.h; gy++) for (let gx = 0; gx < box.w; gx++) if (fitsAt(box, pieces, piece, gx, gy, rot)) return { gx, gy, rot };
  }
  return null;
}

/**
 * Liegt ein Stück noch ganz in der Form? Das Tragraster wächst und
 * schrumpft mit dem Statblock; was gestern passte, liegt heute vielleicht
 * im gesperrten Teil. Seine Lage bleibt gespeichert, gezeigt wird es im Fach.
 */
export function pieceInShape(box: Shape, piece: GridPiece): boolean {
  if (!liegt(piece)) return false;
  const f = itemShape(piece.rows, piece.rot ?? 0);
  if (piece.gx < 0 || piece.gy < 0 || piece.gx + f.w > box.w || piece.gy + f.h > box.h) return false;
  return cellsOf(piece).every((c) => {
    const [x, y] = c.split(',').map(Number) as [number, number];
    return filled(box, x, y);
  });
}

/** Die **langsamste** Zone, die ein Stück bedeckt — man muss das Ganze herausbekommen. */
export function pieceZone(zones: Record<string, string>, piece: GridPiece, ladder: readonly string[]): string | null {
  if (!liegt(piece)) return null;
  let best: string | null = null;
  for (const c of cellsOf(piece)) best = slowerDraw(best, zones[c], ladder);
  return best;
}

// ------------------------------------------------------------ Gewicht und Slots

/** Ein Posten, wie Gewicht und Slots ihn brauchen. */
export interface Load {
  qty: number;
  weight?: number | null;
  stackSize?: number | null;
}

/** Das Gesamtgewicht (Menge × Gewicht); ein Stück ohne Gewicht wiegt nichts. */
export function totalWeight(items: readonly Load[]): number {
  const s = items.reduce((m, i) => m + (Number(i.weight) || 0) * (Number(i.qty) || 0), 0);
  return Math.round(s * 100) / 100;
}

/** Slots: je Stapel einer, ein Stapel fasst `stackSize` (ohne Angabe 1). */
export function slotsUsed(items: readonly Load[]): number {
  return items.reduce((m, i) => m + Math.ceil(Math.max(0, Number(i.qty) || 0) / Math.max(1, Math.trunc(Number(i.stackSize) || 1))), 0);
}

/** Wie viel mehr eine Grösse trägt (5e: Tiny ½, Large 2, Huge 4, Gargantuan 8). */
export function sizeFactor(size: string | null | undefined): number {
  const f: Record<string, number> = { tiny: 0.5, large: 2, huge: 4, gargantuan: 8 };
  return f[String(size ?? '').toLowerCase()] ?? 1;
}

export type LoadStage = 'light' | 'encumbered' | 'heavy' | 'over';

/**
 * **Tragestufen** nach der Variante aus dem Spielerhandbuch: bis 5 × STÄ
 * leicht, bis 10 × belastet, bis 15 × schwer belastet (zugleich die
 * Tragfähigkeit), darüber zu viel. Ohne Stärke keine Stufe — eine
 * geschätzte sähe aus wie eine, die stimmt.
 */
export function loadStage(total: number, str: number | null | undefined, factor = 1): { stage: LoadStage; encumbered: number; heavy: number; max: number } | null {
  const s = Number(str);
  if (str === null || str === undefined || !Number.isFinite(s) || s <= 0) return null;
  const encumbered = 5 * s * factor;
  const heavy = 10 * s * factor;
  const max = 15 * s * factor;
  const stage: LoadStage = total > max ? 'over' : total > heavy ? 'heavy' : total > encumbered ? 'encumbered' : 'light';
  return { stage, encumbered, heavy, max };
}

/** Kupfer als Münzen (pp, gp, sp, cp), die grösste zuerst — nur zur Anzeige; gespeichert bleibt Kupfer. */
export function coins(copper: unknown): { pp: number; gp: number; sp: number; cp: number } {
  let c = Math.max(0, Math.trunc(Number(copper) || 0));
  const pp = Math.floor(c / 1000);
  c -= pp * 1000;
  const gp = Math.floor(c / 100);
  c -= gp * 100;
  const sp = Math.floor(c / 10);
  return { pp, gp, sp, cp: c - sp * 10 };
}

// ------------------------------------------------------------ Reservierung (T-128)

/**
 * **Ein Stück ist reserviert für …** (T-127, Schnittstelle für T-128): die
 * Kante `holds` nennt in `props.reservedFor` den Artikel, der das Stück
 * gerade braucht — einen Handwerksauftrag. Es bleibt, wo es liegt, und
 * gehört weiter der Figur; nur verschieben, aufteilen oder ausgeben lässt
 * es sich nicht, bis die Reservierung fällt. An der Kante und nicht am
 * Gegenstand, wie die Drehung: reserviert ist *dieser* Stapel hier.
 */
export const RESERVED_FOR = 'reservedFor';

/** Die Lage im Raster und am Körper: sie gilt nur im Behälter, in dem das Stück liegt. */
const LAGE = ['gx', 'gy', 'rot', 'slot'];

export function reservedFor(edge: Pick<Relation, 'props'> | null | undefined): EntityId | null {
  const v = edge?.props?.[RESERVED_FOR];
  return typeof v === 'string' && v ? v : null;
}

/** Eine Kante mit gesetzter oder gelöster Reservierung (neu, die alte bleibt unberührt). */
export function reserve<R extends Pick<Relation, 'props'>>(edge: R, forId: EntityId | null): R {
  const props = { ...(edge.props ?? {}) };
  if (forId) props[RESERVED_FOR] = forId;
  else delete props[RESERVED_FOR];
  return { ...edge, props };
}

/** Was eine Schreibung an einem reservierten Stück täte: es wegnehmen, es ändern, eins erfinden. */
export interface ReservationBreach {
  edge: string;
  item: EntityId;
  order: EntityId;
  change: 'removed' | 'changed' | 'added';
}

/**
 * **Die Sperre** (T-134): was `after` gegenüber `before` an reservierten
 * Stücken anrührt. Ein reserviertes Stück bleibt, wie es ist — nicht weg
 * (verkauft, verbraucht, verschoben, gelöscht), nicht anders (Menge,
 * Gegenstand, Reservierung) —, solange sein Auftrag läuft (`live`). Nur
 * die Lage im selben Behälter (Raster, Platz, Drehung, Griffweite `tier`)
 * darf sich ändern: umräumen gibt nichts frei. Eine Reservierung **setzt** keine
 * Schreibung; das tut der Auftrag (T-128). Ein Stück, dessen Auftrag
 * nicht mehr läuft, ist frei — eine Reservierung ohne Auftrag sperrt nicht
 * für immer.
 */
export function reservationBreaches(
  before: Pick<Entity, 'relations'> | null | undefined,
  after: Pick<Entity, 'relations'> | null | undefined,
  live: (order: EntityId) => boolean,
): ReservationBreach[] {
  const vorher = new Map((before?.relations ?? []).filter((r) => r.type === 'holds').map((r) => [r.id, r]));
  const nachher = new Map((after?.relations ?? []).filter((r) => r.type === 'holds').map((r) => [r.id, r]));
  const ohneLage = (r: Relation) => {
    const p: Record<string, unknown> = { ...(r.props ?? {}) };
    /* Verstauen (T-140) ist umräumen: `unstowed` darf fallen. */
    for (const k of [...LAGE, 'tier', 'unstowed']) delete p[k];
    return JSON.stringify(Object.keys(p).sort().map((k) => [k, p[k]]));
  };
  const raus: ReservationBreach[] = [];
  for (const [id, r] of vorher) {
    const order = reservedFor(r);
    if (!order || !live(order)) continue;
    const n = nachher.get(id);
    if (!n) raus.push({ edge: id, item: r.to, order, change: 'removed' });
    else if (n.to !== r.to || ohneLage(n) !== ohneLage(r)) raus.push({ edge: id, item: r.to, order, change: 'changed' });
  }
  for (const [id, n] of nachher) {
    const order = reservedFor(n);
    if (order && order !== reservedFor(vorher.get(id))) raus.push({ edge: id, item: n.to, order, change: 'added' });
  }
  return raus;
}

// ------------------------------------------------------------ Verschieben

export type MoveRefusal = 'missing' | 'reserved' | 'same' | 'cycle';

/**
 * **Ein Stück von einem Inventar in ein anderes** (T-127): Figur → Gruppe,
 * in einen Behälter, zurück. Gibt beide Inventare neu zurück; die alten
 * bleiben unberührt. `qty` weniger als der Stapel teilt ihn. Die Lage
 * (Raster, Platz, Drehung) bleibt zurück — sie war die im alten Behälter;
 * im neuen liegt es im Fach, bis jemand es hinlegt. Liegt dort schon
 * derselbe Gegenstand lose im Fach, wächst dessen Stapel.
 *
 * Nein sagt es, wenn das Stück reserviert ist, das Ziel dasselbe ist, oder
 * wenn das Ziel in dem Stück selbst steckt (`inside`: die Inventare, die
 * dieser Gegenstand trägt, und was darin liegt) — ein Rucksack in sich selbst.
 *
 * Unverstautes (T-140, `holds.props.unstowed`) bleibt unverstaut, wenn es
 * nur den Träger wechselt — der Gruppe gegeben, ist es noch nicht
 * eingepackt. In einen **Behälter** gelegt ist es verstaut (`stow`), und
 * gestapelt wird nur auf einen Stapel im selben Zustand.
 */
export function moveHeld(
  from: Entity,
  to: Entity,
  edgeId: string,
  opts: { qty?: number; newId: string; inside?: ReadonlySet<EntityId>; stow?: boolean },
): { from: Entity; to: Entity } | { refused: MoveRefusal } {
  if (from.id === to.id) return { refused: 'same' };
  const kante = (from.relations ?? []).find((r) => r.id === edgeId && r.type === 'holds');
  if (!kante) return { refused: 'missing' };
  if (reservedFor(kante)) return { refused: 'reserved' };
  if (opts.inside?.has(to.id)) return { refused: 'cycle' };
  const alle = Math.max(1, Number(kante.props?.['qty']) || 1);
  const n = Math.min(alle, Math.max(1, Math.trunc(opts.qty ?? alle)));
  const rest = (from.relations ?? []).flatMap((r) => {
    if (r.id !== edgeId) return [r];
    return n < alle ? [{ ...r, props: { ...(r.props ?? {}), qty: alle - n } }] : [];
  });
  const props: Record<string, unknown> = { ...(kante.props ?? {}), qty: n };
  for (const k of LAGE) delete props[k];
  if (props['tier'] !== 'stored') props['tier'] = 'pack';
  if (opts.stow) delete props['unstowed'];
  const offen = props['unstowed'] === true;
  const lose = (r: Relation) =>
    r.type === 'holds' && r.to === kante.to && !reservedFor(r) && (r.props?.['unstowed'] === true) === offen &&
    LAGE.every((k) => r.props?.[k] === undefined || r.props?.[k] === null);
  const ziel = to.relations ?? [];
  const da = ziel.find(lose);
  const neu = da
    ? ziel.map((r) => (r === da ? { ...r, props: { ...(r.props ?? {}), qty: (Number(r.props?.['qty']) || 1) + n } } : r))
    : [...ziel, { id: opts.newId, type: 'holds', to: kante.to, props }];
  return { from: { ...from, relations: rest }, to: { ...to, relations: neu } };
}

/**
 * Was in einem Gegenstand steckt: die Inventare, die er trägt (`carries`),
 * und rekursiv die der Gegenstände darin. Für die Frage, ob ein Ziel ein
 * Rucksack in sich selbst wäre.
 */
export function insideOf(item: EntityId, byId: ReadonlyMap<EntityId, Entity>): Set<EntityId> {
  const raus = new Set<EntityId>();
  const offen = [item];
  while (offen.length) {
    const e = byId.get(offen.pop()!);
    for (const r of e?.relations ?? []) {
      if (r.type !== 'carries' || raus.has(r.to)) continue;
      raus.add(r.to);
      for (const h of byId.get(r.to)?.relations ?? []) if (h.type === 'holds') offen.push(h.to);
    }
  }
  return raus;
}
