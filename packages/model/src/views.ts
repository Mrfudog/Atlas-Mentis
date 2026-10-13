/**
 * View resolution — which fields a view shows, and in which order.
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

import type { LayoutElement, ObjectSchema, PropertySchema, Registry, ViewDef } from './types.js';
import { typeChain } from './entity.js';

export const FALLBACK_VIEW: ViewDef = {
  label: 'Full',
  order: 1,
  fields: 'all',
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

/**
 * **Die Spalten einer Listenzeile** — die Felder, die die `overview`-Anordnung
 * dieser Art nennt (W7).
 *
 * Eine Zeile im Kompendium ist dieselbe Frage wie ein Verweis: „was ist das,
 * auf einen Blick" — also die Ansicht `overview` (CLAUDE.md: drei Ansichten,
 * der Ort wählt). Gelesen werden die `fields`-Elemente ihrer Anordnung, in
 * der Reihenfolge, in der sie dastehen; ein blosser Typname nimmt alle
 * Felder, die dieser Typ erklärt. `all` nennt keine Spalten — eine Zeile mit
 * dreissig Spalten ist keine Zeile mehr. Gerechnete Felder bleiben draussen:
 * sie stehen nicht in den Daten (D8), und eine Liste über 24 000 Artikel
 * rechnet nicht jede Zeile durch.
 *
 * Im Code steht keine Spaltenliste je Art: eine neue Art bringt ihre
 * Spalten mit, indem sie ihre `overview` sagt.
 */
export function listColumns(
  registry: Pick<Registry, 'interfaces' | 'views'>,
  type: string,
): { type: string; key: string; ref: string; prop: PropertySchema }[] {
  const { layout } = layoutFor(registry, 'overview', type);
  const kette = typeChain(registry, type);
  const raus: { type: string; key: string; ref: string; prop: PropertySchema }[] = [];
  const dazu = (t: string, key: string): void => {
    const prop = registry.interfaces[t]?.schema?.properties?.[key];
    if (!prop || prop.derived || !kette.includes(t)) return;
    const ref = `${t}.${key}`;
    if (!raus.some((c) => c.ref === ref)) raus.push({ type: t, key, ref, prop });
  };
  for (const el of layout) {
    if (el.el !== 'fields' || !Array.isArray(el.fields)) continue;
    for (const name of el.fields) {
      const punkt = name.indexOf('.');
      if (punkt > 0) {
        dazu(name.slice(0, punkt), name.slice(punkt + 1));
      } else {
        for (const key of Object.keys(registry.interfaces[name]?.schema?.properties ?? {})) {
          if (!(el.except ?? []).includes(`${name}.${key}`)) dazu(name, key);
        }
      }
    }
  }
  return raus;
}
