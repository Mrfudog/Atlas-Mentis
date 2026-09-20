/**
 * View resolution — which fields and blocks a view shows, and in which order.
 *
 * A projection defines what *can* be read; a ViewDef defines what *is* shown,
 * and it can only ever narrow. Field selection is per property, so a combat
 * view takes `Statblock.ac` without dragging in every field of that type.
 *
 * A view also carries an ordered `layout`; `layoutFor` resolves it, falling
 * back to the flags for views written before layouts existed. Converting on
 * read rather than migrating means both forms can sit side by side while the
 * registry is edited.
 */

import type { LayoutElement, ObjectSchema, Registry, ViewDef } from './types.js';
import { typeChain } from './entity.js';

export const FALLBACK_VIEW: ViewDef = {
  label: 'Full',
  order: 1,
  fields: 'all',
  blocks: 'all',
  description: true,
  composed: true,
  relations: true,
  bindings: true,
  image: true,
};

/** View keys in display order; `order` first, then the key itself. */
export function viewKeys(registry: Pick<Registry, 'views'>): string[] {
  return Object.keys(registry.views).sort((a, b) => {
    const oa = registry.views[a]?.order ?? 99;
    const ob = registry.views[b]?.order ?? 99;
    return oa === ob ? a.localeCompare(b) : oa - ob;
  });
}

/** The named view, or the first by order, or the fallback when the registry is empty. */
export function resolveView(registry: Pick<Registry, 'views'>, key: string | undefined): ViewDef {
  if (key && registry.views[key]) return registry.views[key];
  const first = viewKeys(registry)[0];
  return (first ? registry.views[first] : undefined) ?? FALLBACK_VIEW;
}

/**
 * Does this view show `type.property`?
 * A bare type name in `fields` takes all the fields that type declares;
 * `Type.field` takes exactly one.
 */
export function showField(view: ViewDef, component: string, property: string): boolean {
  if (view.fields === 'all') return true;
  if (view.fields === 'none' || !view.fields) return false;
  if (!Array.isArray(view.fields)) return false;
  return view.fields.includes(component) || view.fields.includes(`${component}.${property}`);
}

/** True when at least one field the type declares survives the view. */
export function componentVisible(view: ViewDef, component: string, schema: ObjectSchema): boolean {
  return Object.keys(schema.properties).some((p) => showField(view, component, p));
}

export function showBlock(view: ViewDef, blockType: string): boolean {
  if (view.blocks === 'all') return true;
  return Array.isArray(view.blocks) && view.blocks.includes(blockType);
}

/**
 * Derived properties carrying `of` ride inside their base field's cell,
 * unless the view names them explicitly. Returns base property → derived keys.
 */
export function attachedDerived(
  view: ViewDef,
  component: string,
  schema: ObjectSchema,
): Record<string, string[]> {
  const attached: Record<string, string[]> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (!prop.derived || !prop.of) continue;
    // Already shown in its own right, or its base field is hidden — nothing to attach to.
    if (showField(view, component, key)) continue;
    if (!showField(view, component, prop.of)) continue;
    (attached[prop.of] ??= []).push(key);
  }
  return attached;
}

/**
 * Welche Anordnung diese Ansicht für diese Artikelart zeichnet — **und aus
 * welcher Zeile sie kommt.**
 *
 * Gesucht wird die `extends`-Kette hoch: die Art selbst, dann ihre
 * Bestandteile in der Reihenfolge, in der sie dastehen. Sagt keiner etwas,
 * gilt die Grundanordnung der Ansicht. Damit deckt eine Anordnung an
 * `Creature` auch NSC, Spielerfigur, Begleiter und Gefolge ab, ohne dass
 * eine davon sie wiederholt.
 *
 * Die Herkunft steht mit dabei, weil sie beim Bearbeiten der Unterschied
 * ist: wer die geerbte Anordnung ändert, ändert sie für alle — und das ist
 * der Sinn, aber eine Überraschung, wenn es nirgends steht.
 */
export function layoutFor(
  registry: Pick<Registry, 'interfaces' | 'views'>,
  viewKey: string,
  type: string,
): { layout: LayoutElement[]; from: string | null } {
  for (const name of typeChain(registry, type)) {
    const eigen = registry.interfaces[name]?.views?.[viewKey];
    if (Array.isArray(eigen) && eigen.length) return { layout: eigen, from: name };
  }
  return { layout: registry.views[viewKey]?.layout ?? [], from: null };
}
