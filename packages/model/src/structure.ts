/**
 * **Die Struktur** (T-341): eine Fraktion, ein Ort, eine Familie als
 * Organigramm oder Beziehungsnetz — gezeichnet aus den Kanten, die schon
 * dastehen. Mitglieder und Ränge (`memberOf`), Teile und Unterfraktionen
 * (`partOf`), was eine Fraktion beherrscht — ihre Gebiete (`controls`) —,
 * wer wo wohnt (`livesIn`) und was wer von wem hält (`regards`,
 * docs/Beziehungen.md). Die Formen auf einer Karte (`territory`) kommen
 * dazu, sobald die Karte sie zeichnet: sie zu lesen hiesse hier, das
 * Versprechen der Kante (`intended`) als eingelöst zu melden.
 *
 * **Nichts davon wird gespeichert** (D8): gespeichert ist nur die Frage —
 * ein Startartikel, welche Kanten, wie tief, Baum oder Netz
 * (`StructureSpec`). An einer Kachel steht sie an der Kante `placed` des
 * Boards auf sich selbst (`props.structure`, wie die Abfrage-Kachel), im
 * Ansichtsdesigner am Element `structure`; dort ist der Startartikel der
 * Artikel, an dem die Ansicht steht.
 *
 * **Gerechnet wird am Server über den gesiebten Bestand** (CLAUDE.md,
 * „Zurückgehalten wird am Server"): `structureGraph` sieht nur, was es
 * bekommt. Bekommt es für eine Spielerin nur, was sie sehen darf, stehen
 * weder ein verborgener Knoten noch eine Kante zu ihm da — und was nur
 * über einen verborgenen Knoten erreichbar war, auch nicht: eine
 * Unterfraktion, die ohne ihre Mutter in der Luft hinge, verriete die
 * Mutter. Eine Kante sagt dabei nichts, was der Artikel, an dem sie
 * steht, nicht ohnehin sagt.
 *
 * **Die Kante steht beim Urteilenden** (docs/Beziehungen.md): `regards`
 * von A nach B und von B nach A sind zwei Linien mit eigenen Marken, nicht
 * eine mit zwei Enden.
 */

import { entityName, primaryInterface } from './entity.js';
import { isInstance } from './instance.js';
import { isBookPart } from './parts.js';
import { PLACED_RELATION } from './board.js';
import type { Entity, Relation } from './types.js';

/** Baum (Organigramm) oder Netz. */
export const STRUCTURE_LAYOUTS = ['tree', 'net'] as const;
export type StructureLayout = (typeof STRUCTURE_LAYOUTS)[number];

/** Wie viele Schritte vom Startartikel; mehr holt man am Knoten (+). */
export const STRUCTURE_DEPTH = { default: 2, min: 1, max: 5 } as const;

/** Mehr Knoten zeichnet die Struktur nicht — ein Netz über alles ist ein Knäuel, keine Übersicht. */
export const STRUCTURE_LIMIT = 120;

/**
 * **Welche Kanten die Struktur kennt, und welches Ende darunter steht.**
 * `child: 'from'` — der Artikel am Anfang der Kante steht unter dem am
 * Ende (ein Mitglied unter seiner Fraktion); `'to'` umgekehrt (der Ort
 * unter der Fraktion, die ihn beherrscht); `null` — eine Beziehung und
 * keine Rangordnung. Im Baum entscheidet der Weg vom Startartikel, wer
 * oben steht; `child` sagt nur, ob die Linie hinauf zeigt (`up`).
 *
 * Eine Zeile mehr ist eine Kantenart mehr — `regards` steht hier, nicht
 * im Code der Kachel.
 */
export interface StructureEdge {
  type: string;
  child: 'from' | 'to' | null;
  /** Wie die Linie heisst, wenn die Kante selbst keine Marke trägt. */
  label: string;
}

export const STRUCTURE_EDGES: readonly StructureEdge[] = [
  { type: 'memberOf', child: 'from', label: 'member' },
  { type: 'partOf', child: 'from', label: 'part of' },
  { type: 'controls', child: 'to', label: 'controls' },
  { type: 'livesIn', child: 'from', label: 'lives in' },
  { type: 'regards', child: null, label: 'regards' },
];

/** Was eine neue Struktur zeichnet: Mitglieder, Teile, Herrschaft, Beziehungen. */
export const STRUCTURE_DEFAULT_EDGES: readonly string[] = ['memberOf', 'partOf', 'controls', 'regards'];

/** Die Frage einer Struktur, wie sie an Kachel oder Element steht. */
export interface StructureSpec {
  /** Der Startartikel; am Element leer — dann der Artikel der Seite. */
  root: string;
  edges: string[];
  layout: StructureLayout;
  depth: number;
}

/** Eine Struktur-Kachel: die Frage und ein Titel. */
export interface StructureTile extends StructureSpec {
  title: string;
}

export interface StructureNode {
  id: string;
  name: string;
  /** Die Art (`primaryInterface`). */
  type: string;
  /** Schritte vom Startartikel. */
  depth: number;
  /** Über wen er gefunden wurde — im Baum der Knoten darüber. */
  parent: string | null;
  /** An der Grenze der Tiefe: es gibt weitere Kanten, die nicht gezeichnet sind. */
  more: boolean;
}

export interface StructureLink {
  /** Die Id der Kante. */
  id: string;
  type: string;
  /** Wie gespeichert: von, nach. */
  from: string;
  to: string;
  /** Die Beschriftung: die Marken (`regards`), der Rang (`memberOf`), sonst das Wort der Kantenart. */
  labels: string[];
  note: string;
  /** Diese Kante hängt den Knoten im Baum an seinen Platz. */
  tree: boolean;
  /** Im Baum zeigt sie hinauf: der Knoten darunter ist der übergeordnete (die Fraktion, zu der der Startartikel gehört). */
  up: boolean;
}

export interface StructureGraph {
  root: string;
  layout: StructureLayout;
  nodes: StructureNode[];
  links: StructureLink[];
  /** Es gäbe mehr als `STRUCTURE_LIMIT` Knoten. */
  truncated: boolean;
}

const KNOWN = new Map(STRUCTURE_EDGES.map((e) => [e.type, e]));

function woerter(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))];
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Die Frage, wie sie gespeichert ist; Unbrauchbares fällt auf die Vorgabe. */
export function structureSpecOf(raw: unknown): StructureSpec {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const edges = woerter(o['edges']).filter((t) => KNOWN.has(t));
  const d = typeof o['depth'] === 'number' && Number.isFinite(o['depth']) ? Math.round(o['depth']) : STRUCTURE_DEPTH.default;
  return {
    root: text(o['root']),
    /* Eine leere Liste heisst „noch nichts gewählt", nicht „keine Kante":
       eine Struktur ohne Kanten wäre ein einzelner Knoten. */
    edges: edges.length ? edges : [...STRUCTURE_DEFAULT_EDGES],
    layout: STRUCTURE_LAYOUTS.includes(o['layout'] as StructureLayout) ? (o['layout'] as StructureLayout) : 'tree',
    depth: Math.min(STRUCTURE_DEPTH.max, Math.max(STRUCTURE_DEPTH.min, d)),
  };
}

/** Ist diese Kante eine Struktur-Kachel (und kein Artikel auf dem Board)? */
export function isStructurePlacement(rel: Pick<Relation, 'type' | 'props'>): boolean {
  const s = rel.props?.['structure'];
  return rel.type === PLACED_RELATION && !!s && typeof s === 'object' && !Array.isArray(s);
}

export function structureTileOf(rel: Pick<Relation, 'type' | 'props'>): StructureTile | null {
  if (!isStructurePlacement(rel)) return null;
  const p = (rel.props ?? {}) as Record<string, unknown>;
  return { title: text(p['title']), ...structureSpecOf(p['structure']) };
}

/** Die Beschriftung einer Kante: Marken, sonst Rang, sonst das Wort ihrer Art. */
export function structureLabels(rel: Pick<Relation, 'type' | 'props'>): string[] {
  const p = (rel.props ?? {}) as Record<string, unknown>;
  const tags = woerter(p['tags']);
  if (tags.length) return tags;
  const rank = p['rank'];
  if (typeof rank === 'string' && rank.trim()) return [rank.trim()];
  /* `partOf.rank` ist eine Reihenfolge und kein Titel. */
  if (typeof rank === 'number' && rel.type === 'memberOf') return [`rank ${rank}`];
  return [KNOWN.get(rel.type)?.label ?? rel.type];
}

/** Ein Knoten kommt in Frage: kein Stück, kein Buchteil. */
function knoten(e: Entity | undefined): e is Entity {
  return !!e && !isInstance(e) && !isBookPart(e);
}

/**
 * **Die Struktur rechnen.** Breitensuche vom Startartikel über die
 * gewählten Kanten, in beide Richtungen (die Gegenrichtung ist eine
 * Abfrage, CLAUDE.md), bis `depth` Schritte. Gefunden wird nur, was in
 * `entities` steht — der Aufrufer gibt den gesiebten Bestand. Die Linien
 * sind alle gewählten Kanten zwischen gefundenen Knoten, auch die, die
 * im Baum quer laufen. Ohne Startartikel: `null`.
 */
export function structureGraph(
  entities: Iterable<Entity> | ReadonlyMap<string, Entity>,
  spec: StructureSpec,
  opt: { limit?: number } = {},
): StructureGraph | null {
  const limit = opt.limit ?? STRUCTURE_LIMIT;
  const map: ReadonlyMap<string, Entity> =
    entities instanceof Map ? entities : new Map([...(entities as Iterable<Entity>)].map((e) => [e.id, e]));
  const root = map.get(spec.root);
  if (!knoten(root)) return null;
  const arten = new Set(spec.edges.filter((t) => KNOWN.has(t)));

  /* Je Artikel seine Kanten der gewählten Arten, hin wie her. */
  type Halb = { rel: Relation; from: string; to: string };
  const an = new Map<string, Halb[]>();
  const dazu = (id: string, h: Halb) => (an.get(id) ?? an.set(id, []).get(id)!).push(h);
  for (const e of map.values()) {
    if (!knoten(e)) continue;
    for (const rel of e.relations ?? []) {
      if (!arten.has(rel.type) || rel.to === e.id || !knoten(map.get(rel.to))) continue;
      const h = { rel, from: e.id, to: rel.to };
      dazu(e.id, h);
      dazu(rel.to, h);
    }
  }

  const nodes = new Map<string, StructureNode>();
  const baumKante = new Map<string, { id: string; up: boolean }>();
  const name = (e: Entity) => entityName(e);
  nodes.set(root.id, { id: root.id, name: name(root), type: primaryInterface(root), depth: 0, parent: null, more: false });
  let truncated = false;
  let reihe = [root.id];
  for (let d = 0; d < spec.depth && reihe.length; d++) {
    const naechste: string[] = [];
    for (const id of reihe) {
      /* Nach Name, damit dieselbe Struktur zweimal gleich aussieht. */
      const halbe = [...(an.get(id) ?? [])].sort((a, b) => {
        const na = name(map.get(a.from === id ? a.to : a.from)!);
        const nb = name(map.get(b.from === id ? b.to : b.from)!);
        return na.localeCompare(nb) || a.rel.id.localeCompare(b.rel.id);
      });
      for (const h of halbe) {
        const andere = h.from === id ? h.to : h.from;
        if (nodes.has(andere)) continue;
        if (nodes.size >= limit) {
          truncated = true;
          continue;
        }
        const e = map.get(andere)!;
        nodes.set(andere, { id: andere, name: name(e), type: primaryInterface(e), depth: d + 1, parent: id, more: false });
        /* Hinauf zeigt die Linie, wenn der neue Knoten das übergeordnete Ende ist. */
        const kind = KNOWN.get(h.rel.type)?.child ?? null;
        const unten = kind === 'from' ? h.from : kind === 'to' ? h.to : null;
        baumKante.set(h.rel.id, { id: andere, up: unten === id });
        naechste.push(andere);
      }
    }
    reihe = naechste;
  }
  /* An der Grenze: hat ein Knoten Kanten zu Artikeln, die nicht dastehen? */
  for (const n of nodes.values()) {
    n.more = (an.get(n.id) ?? []).some((h) => !nodes.has(h.from === n.id ? h.to : h.from));
  }

  const links: StructureLink[] = [];
  const gesehen = new Set<string>();
  for (const id of nodes.keys()) {
    for (const h of an.get(id) ?? []) {
      if (gesehen.has(h.rel.id) || !nodes.has(h.from) || !nodes.has(h.to)) continue;
      gesehen.add(h.rel.id);
      const b = baumKante.get(h.rel.id);
      links.push({
        id: h.rel.id,
        type: h.rel.type,
        from: h.from,
        to: h.to,
        labels: structureLabels(h.rel),
        note: text((h.rel.props as Record<string, unknown> | undefined)?.['note']),
        tree: !!b,
        up: !!b?.up,
      });
    }
  }
  return { root: root.id, layout: spec.layout, nodes: [...nodes.values()], links, truncated };
}

/**
 * **Das Netz anordnen** (Kreise je Tiefe): der Startartikel in der Mitte,
 * jede Tiefe ein Ring, auf dem Ring nach der Lage des Knotens darüber,
 * damit Zweige beieinanderbleiben. Reine Rechnung, damit sie prüfbar ist
 * und die Kachel nur zeichnet.
 */
export function netLayout(graph: Pick<StructureGraph, 'root' | 'nodes'>, ring = 140): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number; a: number }>();
  pos.set(graph.root, { x: 0, y: 0, a: 0 });
  const tiefe = Math.max(0, ...graph.nodes.map((n) => n.depth));
  for (let d = 1; d <= tiefe; d++) {
    const hier = graph.nodes
      .filter((n) => n.depth === d)
      .sort((a, b) => (pos.get(a.parent ?? '')?.a ?? 0) - (pos.get(b.parent ?? '')?.a ?? 0) || a.name.localeCompare(b.name));
    hier.forEach((n, i) => {
      const a = (2 * Math.PI * i) / hier.length - Math.PI / 2;
      pos.set(n.id, { x: Math.round(Math.cos(a) * ring * d), y: Math.round(Math.sin(a) * ring * d), a });
    });
  }
  return new Map([...pos].map(([id, p]) => [id, { x: p.x, y: p.y }]));
}

/** Zwei Graphen zusammenlegen — was ein aufgeklappter Knoten (+) dazu holt. */
export function mergeStructure(a: StructureGraph, b: StructureGraph): StructureGraph {
  const nodes = new Map(a.nodes.map((n) => [n.id, n]));
  const unter = nodes.get(b.root);
  const basis = unter?.depth ?? 0;
  for (const n of b.nodes) {
    if (nodes.has(n.id)) continue;
    nodes.set(n.id, { ...n, depth: basis + n.depth, parent: n.parent ?? unter?.parent ?? null });
  }
  /* Der aufgeklappte Knoten hat jetzt, was er hat. */
  if (unter) nodes.set(unter.id, { ...unter, more: false });
  const links = new Map(a.links.map((l) => [l.id, l]));
  /* Eine Linie, die im zweiten Graphen einen neuen Knoten anhängt, tut es auch hier. */
  for (const l of b.links) if (!links.has(l.id)) links.set(l.id, l);
  return { ...a, nodes: [...nodes.values()], links: [...links.values()], truncated: a.truncated || b.truncated };
}
