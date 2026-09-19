/**
 * The compound backbone, as types.
 *
 *   entity   = peg   — an opaque id and nothing else
 *   component = card — one typed payload per type per entity, absent when unused
 *   relation  = string — a typed, directed edge that may carry its own props
 *
 * Interfaces replace entity types (D5): membership is asserted with `Typed`
 * and verified by Validation. Every definition below is a REGISTRY ROW, not
 * code — adding a kind of thing is an insert, never a migration.
 */

/** Opaque entity id. No pack, type or version encoded in it (D15 / REQ-163). */
export type EntityId = string;

export type PropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface PropertySchema {
  type: PropertyType;
  title?: string;
  enum?: string[];
  /** `long` asks for a textarea; `signed` prints +3 / -1. */
  format?: 'long' | 'signed' | string;
  items?: { type: PropertyType };
  /**
   * Calculation engine: an expression evaluated on read and never stored (D8).
   * Names resolve against sibling fields of the same component.
   * Examples: `mod(str)`, `10+mod(wis)`, `mod(dex)+prof`.
   */
  derived?: string;
  /** Render this derived value inside the named sibling's cell: STÄ 16 (+3). */
  of?: string;
  default?: unknown;
}

export interface ObjectSchema {
  type: 'object';
  required?: string[];
  properties: Record<string, PropertySchema>;
  additionalProperties?: boolean;
}

/** A row of `component_def`. */
export interface ComponentDef {
  name: string;
  label?: string;
  /** The engine that owns the meaning; null means plain data (D1). */
  engine: string | null;
  schema: ObjectSchema;
}

/** A row of `interface`. */
export interface InterfaceDef {
  name: string;
  label?: string;
  /** Abstract interfaces are extended but never instantiated. */
  abstract?: boolean;
  extends?: string[];
  requires?: string[];
  allows?: string[];
  /** `+x` adds to the inherited set; a bare list replaces it. */
  blockTypes?: string[];
}

/** A row of `relation_def`. */
export interface RelationDef {
  type: string;
  label: string;
  /** How the edge reads from its target. One edge, two labels (REQ-182). */
  inverseLabel: string;
  /** Source interfaces; `*` for any. */
  from?: string[];
  /** Target interfaces; `*` for any, `same` for the source's own interface. */
  to?: string[];
  /** The target is deleted with the source. */
  owned?: boolean;
  cardinality?: 'one' | 'many';
  /** When set, the edge renders as a composition section under this heading. */
  section?: string;
  props?: ObjectSchema;
}

/**
 * A Darstellungsstufe (facet, REQ-164): what a view shows, not what it may read.
 * Selection can only narrow — Access and Knowledge filter before layout.
 */
export interface ViewDef {
  label: string;
  order?: number;
  /** `alle`, `keine`, or a list of `Komponente` / `Komponente.feld` entries. */
  felder: 'alle' | 'keine' | string[];
  /** `alle` or a list of block types. */
  bloecke: 'alle' | string[];
  beschreibung?: boolean;
  /** Composition sections built from `section` relations. */
  bausteine?: boolean;
  /** The relations panel. */
  bezuege?: boolean;
  /** Per-reference variable bindings. */
  bindungen?: boolean;
  bild?: boolean;
}

export interface Registry {
  components: Record<string, ComponentDef>;
  interfaces: Record<string, InterfaceDef>;
  relations: Record<string, RelationDef>;
  views: Record<string, ViewDef>;
  /** Campaign-wide defaults for {VAR} substitution — the last resort. */
  vars: Record<string, string>;
}

export interface Block {
  id: string;
  blockType: string;
  body: string;
  order: number;
  /** Stable handle for per-block knowledge grants later. */
  anker?: string;
}

export interface RelationProps {
  /** Per-reference bindings for the target's {VAR} placeholders (REQ-174). */
  vars?: Record<string, string>;
  note?: string;
  menge?: number;
  [key: string]: unknown;
}

export interface Relation {
  id: string;
  type: string;
  to: EntityId;
  props?: RelationProps;
}

/** An article-local field, not yet promoted into the interface (REQ-181). */
export interface AdhocField {
  key: string;
  label: string;
  type: PropertyType;
  value: unknown;
}

export type ComponentValue = Record<string, unknown>;

export interface Entity {
  id: EntityId;
  /** Asserted interface membership — the `Typed` card, flattened. */
  interfaces: string[];
  name: string;
  tags: string[];
  components: Record<string, ComponentValue>;
  adhoc?: AdhocField[];
  blocks?: Block[];
  /** Forward edges only. The reverse is always a query. */
  relations?: Relation[];
  createdAt?: string;
  updatedAt?: string;
}

/** One edge seen from its target. */
export interface Backlink {
  from: Entity;
  relation: Relation;
  def: RelationDef;
}
