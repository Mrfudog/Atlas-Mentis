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
  /** `long` asks for a textarea; `signed` prints +3 / -1; `color`, `link`,
   *  `asset` and `date` each pick their own input. */
  format?: 'long' | 'signed' | 'color' | 'link' | 'asset' | 'date' | string;
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
/** The kinds of element a view layout may hold. */
export type LayoutElementKind =
  | 'heading'
  | 'text'
  | 'fields'
  | 'blocks'
  | 'description'
  | 'composed'
  | 'relations'
  | 'image'
  | 'knowledge'
  | 'map'
  | 'sheet'
  | 'inventory'
  | 'crafting'
  | 'board'
  | 'initiative'
  | 'quests'
  | 'timeline'
  | 'live'
  | 'table'
  | 'prep'
  | 'crawl'
  | 'stack';

/**
 * One element of a view's layout. A view is an ordered list of these, so the
 * sequence is a statement in the registry rather than a side effect of
 * whatever the renderer happens to do first.
 *
 * Deliberately one shape with optional settings rather than a discriminated
 * union: these rows are hand-edited JSON, and a reader that has to cope with
 * a half-filled element anyway gains nothing from a type that promises the
 * element is complete.
 */
export interface LayoutElement {
  id: string;
  el: LayoutElementKind;
  /** `heading` and `text`. */
  text?: string;
  /** `fields`: `all` or a list of `Component` / `Component.field`. */
  fields?: 'all' | string[];
  /** `fields`: 0 fits the width. */
  columns?: number;
  /** `blocks`: `all` or a list of block types. */
  blocks?: 'all' | string[];
}

export interface ViewDef {
  label: string;
  order?: number;
  /** `all`, `none`, or a list of `Component` / `Component.field` entries. */
  fields: 'all' | 'none' | string[];
  /** `all` or a list of block types. */
  blocks: 'all' | string[];
  description?: boolean;
  /** Composition sections built from `section` relations. */
  composed?: boolean;
  /** The relations panel. */
  relations?: boolean;
  /** Per-reference variable bindings. */
  bindings?: boolean;
  image?: boolean;
  /** The ordered layout. Views written before layouts existed carry none;
   *  readers derive one from the flags above rather than migrating data. */
  layout?: LayoutElement[];
  /** A type — and its subtypes — may carry a layout of its own. */
  byInterface?: Record<string, LayoutElement[]>;
}

export interface Registry {
  components: Record<string, ComponentDef>;
  interfaces: Record<string, InterfaceDef>;
  relations: Record<string, RelationDef>;
  views: Record<string, ViewDef>;
  /** Campaign-wide defaults for {VAR} substitution — the last resort. */
  vars: Record<string, string>;
  /**
   * Campaign settings (REQ-043): a key-value store each area reads the keys
   * it knows from and ignores the rest. Deliberately untyped — a setting
   * that needs a schema before anyone can set it does not get set.
   */
  settings?: Record<string, string>;
}

export interface Block {
  id: string;
  blockType: string;
  body: string;
  order: number;
  /** Stable handle for per-block knowledge grants later. */
  anchor?: string;
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
