/**
 * View resolution — which fields and blocks a Darstellungsstufe shows.
 *
 * A projection defines what *can* be read; a ViewDef defines what *is* shown,
 * and it can only ever narrow. Field selection is per property, so a combat
 * view takes `StatblockInfo.ac` without dragging in the whole component.
 */

import type { ComponentDef, ObjectSchema, Registry, ViewDef } from './types.js';

export const FALLBACK_VIEW: ViewDef = {
  label: 'Voll',
  order: 1,
  felder: 'alle',
  bloecke: 'alle',
  beschreibung: true,
  bausteine: true,
  bezuege: true,
  bindungen: true,
  bild: true,
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
 * Does this view show `component.property`?
 * A bare component name in `felder` takes all of its properties;
 * `Komponente.feld` takes exactly one.
 */
export function showField(view: ViewDef, component: string, property: string): boolean {
  if (view.felder === 'alle') return true;
  if (view.felder === 'keine' || !view.felder) return false;
  if (!Array.isArray(view.felder)) return false;
  return view.felder.includes(component) || view.felder.includes(`${component}.${property}`);
}

/** True when at least one of the component's properties survives the view. */
export function componentVisible(view: ViewDef, component: string, schema: ObjectSchema): boolean {
  return Object.keys(schema.properties).some((p) => showField(view, component, p));
}

export function showBlock(view: ViewDef, blockType: string): boolean {
  if (view.bloecke === 'alle') return true;
  return Array.isArray(view.bloecke) && view.bloecke.includes(blockType);
}

/**
 * Derived properties carrying `of` ride inside their base field's cell,
 * unless the view names them explicitly. Returns base property → derived keys.
 */
export function attachedDerived(
  view: ViewDef,
  component: string,
  def: ComponentDef,
): Record<string, string[]> {
  const attached: Record<string, string[]> = {};
  for (const [key, prop] of Object.entries(def.schema.properties)) {
    if (!prop.derived || !prop.of) continue;
    // Already shown in its own right, or its base field is hidden — nothing to attach to.
    if (showField(view, component, key)) continue;
    if (!showField(view, component, prop.of)) continue;
    (attached[prop.of] ??= []).push(key);
  }
  return attached;
}
