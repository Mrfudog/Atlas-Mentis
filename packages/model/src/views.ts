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

import type {
  Entity,
  LayoutAdjust,
  LayoutElement,
  LayoutWhen,
  ObjectSchema,
  PropertySchema,
  Registry,
  TypeLayout,
  ViewDef,
} from './types.js';
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
 * **Die Ansichten, die ein Ort wählt** (T-110, E-030 b): die Liste und der
 * Verweis `overview`, Karte und Popup `quick`, die Artikelseite `full`,
 * der Druck `print`, das „+" der Suche `search` (T-138). Sie lassen sich
 * umbenennen und umbauen, aber nicht löschen — der Ort fragt nach ihnen. Eigene Ansichten daneben wählt man
 * dort, wo gewählt wird (die Kachel auf dem Board, der Druck).
 */
export const PLACE_VIEWS = ['overview', 'quick', 'full', 'print', 'search'] as const;

/** Eine Anpassung statt einer eigenen Anordnung? */
export function isAdjust(x: TypeLayout | undefined | null): x is { adjust: LayoutAdjust } {
  return !!x && !Array.isArray(x) && typeof x === 'object' && 'adjust' in x;
}

/** Sagt diese Art (selbst, nicht geerbt) etwas für diese Ansicht? */
export function ownLayout(x: TypeLayout | undefined | null): boolean {
  return Array.isArray(x) ? x.length > 0 : isAdjust(x);
}

/**
 * **Nennt das Element dieses Feld?** — `fields` mit `Typ` oder `Typ.feld`,
 * `all` nimmt alles, `except` nimmt wieder heraus. Fehlt `fields`, nimmt
 * das Element alles (so stand es bei `prose` immer).
 */
export function elementTakes(el: LayoutElement, type: string, field: string): boolean {
  if ((el.except ?? []).some((x) => x === type || x === `${type}.${field}`)) return false;
  if (el.fields === undefined || el.fields === 'all') return true;
  return el.fields.some((x) => x === type || x === `${type}.${field}`);
}

/**
 * **Gilt diese Bedingung an diesem Artikel?** (`LayoutWhen`, T-184). Ohne
 * Bedingung gilt das Element immer; eine Bedingung ohne jede Angabe auch.
 */
export function whenHolds(
  when: LayoutWhen | undefined,
  entity: Pick<Entity, 'components' | 'relations'> & { interfaces?: readonly string[] },
  incoming: readonly { type: string }[] = [],
): boolean {
  if (!when) return true;
  const { field, has, empty, relation, type } = when;
  if (type && (entity.interfaces ?? []).includes(type)) return true;
  if (!field && !relation && !when.incoming) return !type;
  if (relation && (entity.relations ?? []).some((r) => r.type === relation)) return true;
  /* Die Gegenrichtung ist eine Abfrage (T-268): wer sie nicht mitgibt, bekommt „nein". */
  if (when.incoming && incoming.some((r) => r.type === when.incoming)) return true;
  if (!field) return false;
  const punkt = field.indexOf('.');
  const karte = (entity.components?.[field.slice(0, punkt)] ?? {}) as Record<string, unknown>;
  const roh = karte[field.slice(punkt + 1)];
  const werte = (Array.isArray(roh) ? roh : roh === undefined || roh === null || roh === '' ? [] : [roh]).map(String);
  if (!werte.length) return !!empty;
  return (has ?? []).some((h) => werte.includes(h));
}

/**
 * **Die Anordnung für genau diesen Artikel** (T-184): was `when` an ihm
 * ausschliesst, fällt weg, auch in Reitern. Die Eingabe bleibt, wie sie
 * ist — sie gehört dem Typ.
 */
export function forArticle(
  layout: readonly LayoutElement[],
  entity: Pick<Entity, 'components' | 'relations'> & { interfaces?: readonly string[] },
  incoming: readonly { type: string }[] = [],
): LayoutElement[] {
  return layout
    .filter((el) => whenHolds(el.when, entity, incoming))
    .map((el) => {
      let neu = el;
      if (el.tabs) neu = { ...neu, tabs: el.tabs.map((t) => ({ ...t, layout: forArticle(t.layout, entity, incoming) })) };
      /* Behälter gestalteter Ansichten (T-268): ihre Kinder ebenso. */
      if (el.children) neu = { ...neu, children: forArticle(el.children, entity, incoming) };
      return neu;
    });
}

/**
 * **Eine Anordnung anpassen** (`LayoutAdjust`). Die Eingabe bleibt, wie
 * sie ist: die geerbte Anordnung gehört einem anderen Typ oder der Ansicht.
 */
export function applyAdjust(layout: readonly LayoutElement[], adjust: LayoutAdjust): LayoutElement[] {
  const drop = new Set(adjust.drop ?? []);
  const hide = adjust.hide ?? [];
  const add = adjust.add ?? {};
  const passe = (els: readonly LayoutElement[]): LayoutElement[] =>
    els
      .filter((el) => !drop.has(el.id))
      .map((alt) => {
        const el: LayoutElement = { ...alt };
        if (el.tabs) el.tabs = el.tabs.map((t) => ({ ...t, layout: passe(t.layout) }));
        if (el.el !== 'fields' && el.el !== 'prose') return el;
        const dazu = add[el.id] ?? [];
        if (dazu.length && el.fields !== 'all') {
          el.fields = [...new Set([...(el.fields ?? []), ...dazu])];
        }
        /* Was dazukommt, ist nicht zugleich ausgenommen — sonst hiesse
           „dazu" hier nichts, sobald die Ansicht es weglässt. */
        if (dazu.length && el.except) el.except = el.except.filter((x) => !dazu.includes(x));
        if (hide.length) {
          if (Array.isArray(el.fields)) el.fields = el.fields.filter((x) => !hide.includes(x));
          el.except = [...new Set([...(el.except ?? []), ...hide])];
        }
        return el;
      });
  const out = [...passe(layout), ...(adjust.extra ?? []).filter((x) => !drop.has(x.id))];
  const order = adjust.order ?? [];
  if (!order.length) return out;
  const rang = (el: LayoutElement) => {
    const i = order.indexOf(el.id);
    return i < 0 ? order.length : i;
  };
  /* Stabil: Ungenanntes behält seine Reihenfolge, hinter dem Genannten. */
  return out
    .map((el, i) => ({ el, i }))
    .sort((a, b) => rang(a.el) - rang(b.el) || a.i - b.i)
    .map((x) => x.el);
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
 * **Eine Anpassung** (`{ adjust }`, T-110) sucht weiter: ihre Grundlage ist,
 * was die übrige Kette sagt, und am Ende die Ansicht. Mehrere Anpassungen
 * die Kette hoch gelten alle, die allgemeinste zuerst.
 *
 * Die Herkunft steht mit dabei, weil sie beim Bearbeiten der Unterschied
 * ist: wer die geerbte Anordnung ändert, ändert sie für alle — und das ist
 * der Sinn, aber eine Überraschung, wenn es nirgends steht.
 */
export function layoutFor(
  registry: Pick<Registry, 'interfaces' | 'views'>,
  viewKey: string,
  type: string,
): { layout: LayoutElement[]; from: string | null; mode: 'view' | 'own' | 'adjusted' } {
  const anpassungen: LayoutAdjust[] = [];
  let from: string | null = null;
  let basis: LayoutElement[] | null = null;
  for (const name of typeChain(registry, type)) {
    const eigen = registry.interfaces[name]?.views?.[viewKey];
    if (Array.isArray(eigen) && eigen.length) {
      basis = eigen;
      from ??= name;
      break;
    }
    if (isAdjust(eigen)) {
      anpassungen.push(eigen.adjust);
      from ??= name;
    }
  }
  let layout = basis ?? registry.views[viewKey]?.layout ?? [];
  for (const a of anpassungen.reverse()) layout = applyAdjust(layout, a);
  const mode = anpassungen.length ? 'adjusted' : basis ? 'own' : 'view';
  return { layout, from, mode };
}

/**
 * **Was eine Art in dieser Ansicht zeigen kann** — je Element die Felder
 * (`Typ.feld`), die es nimmt, in der Reihenfolge, in der die Art sie
 * erklärt; was keines nimmt, unter `rest`. Was ein Artikel davon zeigt, ist
 * die Schnittmenge mit dem, was er hat (T-110). Für die Maske im Register:
 * „welche Felder stehen wo", ohne einen Artikel aufzumachen.
 *
 * Wie die Artikelseite: ein Feld steht im ersten Element, das es nimmt.
 */
export function viewFields(
  registry: Pick<Registry, 'interfaces' | 'views'>,
  viewKey: string,
  type: string,
): { elements: { id: string; el: string; fields: string[] }[]; rest: string[] } {
  const { layout } = layoutFor(registry, viewKey, type);
  const alle: { comp: string; key: string; prose: boolean }[] = [];
  for (const comp of typeChain(registry, type)) {
    for (const [key, prop] of Object.entries(registry.interfaces[comp]?.schema?.properties ?? {})) {
      alle.push({ comp, key, prose: !!(prop.many && prop.format === 'long') });
    }
  }
  const flach = (els: readonly LayoutElement[]): LayoutElement[] =>
    els.flatMap((el) => (el.el === 'tabs' ? (el.tabs ?? []).flatMap((t) => flach(t.layout)) : [el]));
  const vergeben = new Set<string>();
  const elements: { id: string; el: string; fields: string[] }[] = [];
  for (const el of flach(layout)) {
    if (el.el !== 'fields' && el.el !== 'prose') continue;
    const hier = alle
      .filter((f) => f.prose === (el.el === 'prose'))
      .map((f) => `${f.comp}.${f.key}`)
      .filter((ref) => !vergeben.has(ref) && elementTakes(el, ref.split('.')[0]!, ref.split('.')[1]!));
    hier.forEach((ref) => vergeben.add(ref));
    elements.push({ id: el.id, el: el.el, fields: hier });
  }
  return { elements, rest: alle.map((f) => `${f.comp}.${f.key}`).filter((ref) => !vergeben.has(ref)) };
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
        const [t, k] = [name.slice(0, punkt), name.slice(punkt + 1)];
        if (elementTakes(el, t, k)) dazu(t, k);
      } else {
        for (const key of Object.keys(registry.interfaces[name]?.schema?.properties ?? {})) {
          if (elementTakes(el, name, key)) dazu(name, key);
        }
      }
    }
  }
  return raus;
}
