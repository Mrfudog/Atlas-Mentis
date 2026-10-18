/**
 * **Ansichten mit Geltung** (T-268, E-103, REQ-256).
 *
 * Eine Ansicht ist Anordnung + Geltung + Gruppe. Die Gruppe ist der Ort
 * (`overview`, `quick`, `full`, `print` oder eine eigene); die Geltung sagt,
 * für welche Artikel sie gilt — Typ(en), Bedingungen auf Feldwerte und
 * Kanten, oder genau ein Artikel. **Der Ort wählt die Gruppe, die Geltung
 * die Ansicht darin:** gebraucht wird die genaueste (Artikel > Bedingung >
 * Typ > global), gewählt werden darf, wo gewählt wird, unter allen.
 *
 * Die heutigen Ansichten haben keine Geltung und stehen darin unverändert:
 * global, oder „Typ", wenn die Art (oder ein Obertyp) für sie etwas Eigenes
 * sagt (`InterfaceDef.views`).
 */

import type { Entity, LayoutElement, LayoutWhen, Registry, ViewApplies, ViewDef, ViewPathStep } from './types.js';
import { primaryInterface, typeChain } from './entity.js';
import { layoutFor, viewKeys, whenHolds } from './views.js';

/** Wie genau eine Ansicht gilt; die Reihenfolge ist die Rangfolge. */
export const VIEW_SCOPES = ['article', 'condition', 'type', 'global'] as const;
export type ViewScope = (typeof VIEW_SCOPES)[number];

/** Eine eingehende Kante: ihre Art und woher sie kommt. */
export interface IncomingEdge {
  type: string;
  from: string;
  props?: Record<string, unknown>;
}

/** Was `viewsFor` je geltender Ansicht sagt. */
export interface ViewChoice {
  key: string;
  label: string;
  group: string;
  scope: ViewScope;
  /** Warum sie gilt, in einem Satz für die Oberfläche. */
  why: string;
}

/** Die Gruppe einer Ansicht: angegeben, sonst ihr Schlüssel. */
export function viewGroup(key: string, def: ViewDef | undefined): string {
  return def?.group || key;
}

/**
 * **Gestaltet?** Eine Ansicht mit Gruppe oder Geltung kommt aus dem
 * Designer (T-268). Ohne den Schalter `experiments.viewDesigner` bieten die
 * Orte sie nicht an — so zeichnet jede Seite wie bisher.
 */
export function isDesignedView(def: ViewDef | undefined): boolean {
  return !!def && (def.group !== undefined || def.applies !== undefined);
}

/** Die Genauigkeit, die eine Geltung hat — aus dem, was dasteht. */
export function appliesScope(applies: ViewApplies | undefined): ViewScope {
  if (!applies) return 'global';
  if (applies.article) return 'article';
  if (applies.where?.length) return 'condition';
  if (applies.types?.length) return 'type';
  return 'global';
}

type Gelesen = Pick<Entity, 'id' | 'components' | 'relations'> & { interfaces?: readonly string[] };

/** **Gilt diese Geltung an diesem Artikel?** Alles Genannte muss zutreffen. */
export function appliesHolds(
  registry: Pick<Registry, 'interfaces'>,
  applies: ViewApplies | undefined,
  entity: Gelesen,
  incoming: readonly { type: string }[] = [],
): boolean {
  if (!applies) return true;
  if (applies.article && applies.article !== entity.id) return false;
  if (applies.types?.length) {
    const kette = typeChain(registry, entity.interfaces?.[0] ?? '');
    if (!applies.types.some((t) => kette.includes(t) || (entity.interfaces ?? []).includes(t))) return false;
  }
  return (applies.where ?? []).every((w) => whenHolds(w, entity, incoming));
}

/** Eine Bedingung in Worten — für die Liste im Register und das „warum". */
export function whenText(w: LayoutWhen): string {
  const teile: string[] = [];
  if (w.type) teile.push(`is ${w.type}`);
  if (w.field) teile.push(w.has?.length ? `${w.field} = ${w.has.join(' or ')}` : w.empty ? `${w.field} is empty` : `${w.field} is set`);
  if (w.relation) teile.push(`has edge ${w.relation}`);
  if (w.incoming) teile.push(`is ${w.incoming} of something`);
  return teile.join(' or ') || 'always';
}

/** Die Geltung in Worten. */
export function appliesText(applies: ViewApplies | undefined, name?: (id: string) => string | undefined): string {
  if (!applies || appliesScope(applies) === 'global') return 'every article';
  const teile: string[] = [];
  if (applies.article) teile.push(`only ${name?.(applies.article) ?? applies.article}`);
  if (applies.types?.length) teile.push(applies.types.join(' or '));
  for (const w of applies.where ?? []) teile.push(whenText(w));
  return teile.join(' and ');
}

/**
 * **Alle Ansichten, die für diesen Artikel gelten** — genaueste zuerst,
 * innerhalb derselben Genauigkeit in der Reihenfolge des Registers.
 *
 * `incoming` sind die Kanten, die auf den Artikel zeigen (die Rückbezüge);
 * ohne sie gilt keine Bedingung auf eingehende Kanten. `designed: false`
 * lässt gestaltete Ansichten weg — so fragen die Orte ohne den Schalter.
 */
export function viewsFor(
  entity: Gelesen,
  registry: Pick<Registry, 'interfaces' | 'views'>,
  opts: { incoming?: readonly { type: string }[]; designed?: boolean } = {},
): ViewChoice[] {
  const typ = entity.interfaces?.[0] ?? '';
  const raus: (ViewChoice & { rang: number; i: number })[] = [];
  viewKeys(registry).forEach((key, i) => {
    const def = registry.views[key];
    if (!def) return;
    const gestaltet = isDesignedView(def);
    if (gestaltet && opts.designed === false) return;
    if (def.applies) {
      if (!appliesHolds(registry, def.applies, entity, opts.incoming)) return;
      const scope = appliesScope(def.applies);
      raus.push({ key, label: def.label, group: viewGroup(key, def), scope, why: `applies to ${appliesText(def.applies)}`, rang: VIEW_SCOPES.indexOf(scope) * 2, i });
      return;
    }
    const { from } = layoutFor(registry, key, typ);
    const scope: ViewScope = from ? 'type' : 'global';
    raus.push({
      key,
      label: def.label,
      group: viewGroup(key, def),
      scope,
      why: from ? `arranged at ${from}` : 'applies to every article',
      /* Bei gleicher Genauigkeit geht die ausdrücklich gestaltete vor. */
      rang: VIEW_SCOPES.indexOf(scope) * 2 + 1,
      i,
    });
  });
  return raus.sort((a, b) => a.rang - b.rang || a.i - b.i).map(({ rang: _r, i: _i, ...c }) => c);
}

/**
 * **Die Ansicht, die ein Ort braucht** (E-103): die genaueste geltende
 * seiner Gruppe. Gilt keine, bleibt es die Gruppe selbst — der Ort fragt
 * nach ihr wie bisher.
 */
export function viewFor(
  entity: Gelesen,
  registry: Pick<Registry, 'interfaces' | 'views'>,
  group: string,
  opts: { incoming?: readonly { type: string }[]; designed?: boolean } = {},
): string {
  return viewsFor(entity, registry, opts).find((v) => v.group === group)?.key ?? group;
}

/** Wie viele Artikel eine Ansicht bekommen — für die Liste im Register. */
export function appliesCount(
  registry: Pick<Registry, 'interfaces'>,
  def: ViewDef,
  entities: Iterable<Gelesen>,
  incoming: (id: string) => readonly { type: string }[] = () => [],
): number {
  let n = 0;
  for (const e of entities) if (appliesHolds(registry, def.applies, e, incoming(e.id))) n++;
  return n;
}

/** Die Rückbezüge eines ganzen Bestands auf einmal: Ziel → eingehende Kanten. */
export function incomingIndex(entities: Iterable<Pick<Entity, 'id' | 'relations'>>): Map<string, IncomingEdge[]> {
  const raus = new Map<string, IncomingEdge[]>();
  for (const e of entities) {
    for (const r of e.relations ?? []) {
      const l = raus.get(r.to) ?? [];
      l.push({ type: r.type, from: e.id, ...(r.props ? { props: r.props } : {}) });
      raus.set(r.to, l);
    }
  }
  return raus;
}

/** Ein Schritt am Ende eines Pfads: der Artikel und die Kante, über die er kam. */
export interface PathHit {
  entity: Entity;
  /** Die Eigenschaften der letzten Kante — Menge, Preis, Rang. */
  props: Record<string, unknown>;
}

/**
 * **Einem Pfad folgen** (T-268): vom Artikel über Kanten zu den Artikeln am
 * Ende. `get` liefert einen Artikel nach Id (was fehlt oder zurückgehalten
 * ist, fällt weg), `incoming` die Kanten, die auf einen zeigen. Ohne Pfad
 * ist der Artikel selbst das Ende. Jeder Artikel kommt einmal.
 */
export function followPath(
  registry: Pick<Registry, 'interfaces'>,
  entity: Entity,
  path: readonly ViewPathStep[] | undefined,
  ctx: { get: (id: string) => Entity | undefined; incoming: (id: string) => readonly IncomingEdge[] },
): PathHit[] {
  let stand: PathHit[] = [{ entity, props: {} }];
  for (const schritt of path ?? []) {
    const weiter: PathHit[] = [];
    const gesehen = new Set<string>();
    for (const { entity: e } of stand) {
      const kanten =
        schritt.dir === 'in'
          ? ctx.incoming(e.id).filter((k) => k.type === schritt.relation).map((k) => ({ id: k.from, props: k.props ?? {} }))
          : (e.relations ?? []).filter((r) => r.type === schritt.relation).map((r) => ({ id: r.to, props: (r.props ?? {}) as Record<string, unknown> }));
      for (const k of kanten) {
        const ziel = ctx.get(k.id);
        if (!ziel || gesehen.has(ziel.id)) continue;
        if (schritt.type && !typeChain(registry, primaryInterface(ziel)).includes(schritt.type)) continue;
        gesehen.add(ziel.id);
        weiter.push({ entity: ziel, props: k.props });
      }
    }
    stand = weiter;
  }
  return stand;
}

/** Ein Pfad in Worten: `shopkeeper › Shop › sells › Item`. */
export function pathText(path: readonly ViewPathStep[] | undefined, start = ''): string {
  const teile = start ? [start] : [];
  for (const s of path ?? []) teile.push(s.dir === 'in' ? `← ${s.relation}` : s.relation, ...(s.type ? [s.type] : []));
  return teile.join(' › ');
}

/** Die Ids, die ein Pfad braucht, um gezeichnet zu werden — für das Nachladen. */
export function pathIds(entity: Entity, path: readonly ViewPathStep[] | undefined, incoming: (id: string) => readonly IncomingEdge[]): string[] {
  const s = path?.[0];
  if (!s) return [];
  return s.dir === 'in'
    ? incoming(entity.id).filter((k) => k.type === s.relation).map((k) => k.from)
    : (entity.relations ?? []).filter((r) => r.type === s.relation).map((r) => r.to);
}

// ---------------------------------------------------------------- der Baum

/** Elemente, die Kinder tragen. */
export const CONTAINER_ELEMENTS: readonly string[] = ['section', 'columns', 'carousel', 'collapsible'];

export function isContainer(el: Pick<LayoutElement, 'el'>): boolean {
  return CONTAINER_ELEMENTS.includes(el.el);
}

/** Wo ein Element im Baum steht: die Liste, die es hält, und sein Platz darin. */
function finde(
  liste: LayoutElement[],
  id: string,
  eltern: LayoutElement | null = null,
): { liste: LayoutElement[]; i: number; eltern: LayoutElement | null } | null {
  for (let i = 0; i < liste.length; i++) {
    const el = liste[i]!;
    if (el.id === id) return { liste, i, eltern };
    if (el.children) {
      const tief = finde(el.children, id, el);
      if (tief) return tief;
    }
  }
  return null;
}

/** Eine tiefe Kopie, damit der Baum der Registerzeile unberührt bleibt. */
function kopie(tree: readonly LayoutElement[]): LayoutElement[] {
  return JSON.parse(JSON.stringify(tree)) as LayoutElement[];
}

/** Ein Element im Baum, nach `id`. */
export function findElement(tree: readonly LayoutElement[], id: string): LayoutElement | undefined {
  const f = finde(tree as LayoutElement[], id);
  return f?.liste[f.i];
}

/**
 * **Die vier Griffe des Designers** (T-268): ← aus dem Behälter hinaus
 * (hinter ihn), → in das Element darüber (wenn es ein Behälter ist), ↑ eins
 * nach oben, × weg. Jeder gibt einen neuen Baum; was nicht geht, gibt den
 * alten unverändert zurück.
 */
export function moveTree(tree: readonly LayoutElement[], id: string, op: 'out' | 'into' | 'up' | 'remove'): LayoutElement[] {
  const neu = kopie(tree);
  const f = finde(neu, id);
  if (!f) return neu;
  const [el] = f.liste.splice(f.i, 1) as [LayoutElement];
  if (op === 'remove') return neu;
  if (op === 'up') {
    if (f.i === 0) return kopie(tree);
    f.liste.splice(f.i - 1, 0, el);
    return neu;
  }
  if (op === 'into') {
    const davor = f.liste[f.i - 1];
    if (!davor || !isContainer(davor)) return kopie(tree);
    (davor.children ??= []).push(el);
    return neu;
  }
  /* out */
  if (!f.eltern) return kopie(tree);
  const oben = finde(neu, f.eltern.id)!;
  oben.liste.splice(oben.i + 1, 0, el);
  return neu;
}

/** Ein Element einfügen: in den gewählten Behälter, sonst hinter das gewählte, sonst ans Ende. */
export function insertElement(tree: readonly LayoutElement[], el: LayoutElement, at?: string | null): LayoutElement[] {
  const neu = kopie(tree);
  const f = at ? finde(neu, at) : null;
  if (!f) return [...neu, el];
  const ziel = f.liste[f.i]!;
  if (isContainer(ziel)) (ziel.children ??= []).push(el);
  else f.liste.splice(f.i + 1, 0, el);
  return neu;
}

/** Ein Element ändern (nach `id`); `null` in `patch` nimmt eine Angabe weg. */
export function patchElement(tree: readonly LayoutElement[], id: string, patch: Partial<Record<keyof LayoutElement, unknown>>): LayoutElement[] {
  const neu = kopie(tree);
  const el = findElement(neu, id) as Record<string, unknown> | undefined;
  if (!el) return neu;
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) delete el[k];
    else el[k] = v;
  }
  return neu;
}

/** Eine freie Id im Baum: `basis`, `basis-2` … */
export function freeElementId(tree: readonly LayoutElement[], basis: string): string {
  const ids = new Set<string>();
  const sammle = (l: readonly LayoutElement[]): void =>
    l.forEach((e) => {
      ids.add(e.id);
      if (e.children) sammle(e.children);
      for (const t of e.tabs ?? []) sammle(t.layout);
    });
  sammle(tree);
  if (!ids.has(basis)) return basis;
  let n = 2;
  while (ids.has(`${basis}-${n}`)) n++;
  return `${basis}-${n}`;
}

/** Wie viele Elemente ein Baum hat (für die Liste im Register). */
export function countElements(tree: readonly LayoutElement[] | undefined): number {
  return (tree ?? []).reduce((n, e) => n + 1 + countElements(e.children) + (e.tabs ?? []).reduce((m, t) => m + countElements(t.layout), 0), 0);
}

/** Ein möglicher nächster Schritt eines Pfads — für die Wahl im Designer. */
export interface PathOption {
  step: ViewPathStep;
  /** `sells → Item`, `← shopkeeper (Shop)`. */
  label: string;
  /** Die Art am Ende, wenn die Kante genau eine nennt. */
  end: string | null;
}

/**
 * **Wohin ein Pfad von dieser Art aus weitergehen kann** (T-268): die
 * Kanten, die sie ausdrücklich nennen — vorwärts, wo sie Quelle ist, und
 * zurück, wo sie Ziel ist. Kanten mit `*` treffen jede Art und sagen über
 * diese nichts; sie stehen nicht zur Wahl.
 */
export function pathOptions(registry: Pick<Registry, 'relations' | 'interfaces'>, type: string): PathOption[] {
  const kette = new Set(typeChain(registry, type));
  const nennt = (l: readonly string[] | undefined) => (l ?? []).some((t) => kette.has(t));
  const ende = (l: readonly string[] | undefined) => {
    const echt = (l ?? []).filter((t) => t !== '*' && t !== 'same');
    return echt.length === 1 ? echt[0]! : null;
  };
  const raus: PathOption[] = [];
  for (const def of Object.values(registry.relations)) {
    if (nennt(def.from)) {
      const end = ende(def.to);
      raus.push({ step: { relation: def.type, ...(end ? { type: end } : {}) }, label: `${def.label} → ${end ?? 'any'}`, end });
    }
    if (nennt(def.to)) {
      const end = ende(def.from);
      raus.push({ step: { relation: def.type, dir: 'in', ...(end ? { type: end } : {}) }, label: `← ${def.label} (${end ?? 'any'})`, end });
    }
  }
  return raus.sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

/** Die Art am Ende eines Pfads, soweit die Kanten es sagen; sonst die Art des Anfangs. */
export function pathEndType(start: string, path: readonly ViewPathStep[] | undefined): string {
  return path?.length ? (path[path.length - 1]!.type ?? '') : start;
}
