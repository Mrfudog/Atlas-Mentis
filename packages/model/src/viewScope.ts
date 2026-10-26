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

import type { Entity, LayoutAdjust, LayoutElement, LayoutWhen, Registry, ViewApplies, ViewDef, ViewPathStep } from './types.js';
import { primaryInterface, typeChain } from './entity.js';
import { RETIRED_PLACES, applyAdjust, layoutFor, viewKeys, whenHolds } from './views.js';

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
 * Designer (T-268) und zeichnet ihren Baum selbst (`nw-ansichtsbaum`); die
 * Ansichten der Orte und ihre Anordnungen je Art zeichnet die Seite wie
 * bisher. `viewsFor(…, { designed: false })` fragt ohne sie.
 */
export function isDesignedView(def: ViewDef | undefined): boolean {
  return !!def && !def.adjust && (def.group !== undefined || def.applies !== undefined);
}

/**
 * **Ein Beitrag** (T-425, E-168): eine Ansichtszeile mit `adjust` legt sich
 * über die Ansicht ihrer Gruppe, statt sie zu ersetzen. Sie steht nicht zur
 * Wahl und wird nicht für sich gezeichnet — sie ist eine Schicht.
 */
export function isContribution(def: ViewDef | undefined): boolean {
  return !!def?.adjust;
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
  lineOf?: (id: string) => readonly string[],
): boolean {
  if (!applies) return true;
  if (applies.article && applies.article !== entity.id) return false;
  if (applies.types?.length) {
    const kette = typeChain(registry, entity.interfaces?.[0] ?? '');
    if (!applies.types.some((t) => kette.includes(t) || (entity.interfaces ?? []).includes(t))) return false;
  }
  return (applies.where ?? []).every((w) => whenHolds(w, entity, incoming, lineOf));
}

/** Eine Bedingung in Worten — für die Liste im Register und das „warum". */
export function whenText(w: LayoutWhen): string {
  const teile: string[] = [];
  if (w.type) teile.push(`is ${w.type}`);
  if (w.field) teile.push(w.has?.length ? `${w.field} = ${w.has.join(' or ')}` : w.empty ? `${w.field} is empty` : `${w.field} is set`);
  if (w.relation) teile.push(w.to?.length ? `${w.relation} ${w.to.join(' or ')}` : `has edge ${w.relation}`);
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
    /* Ein Beitrag ist eine Schicht, keine Ansicht zum Wählen (E-168). */
    if (!def || isContribution(def)) return;
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

/** Was `pickView` sagt: welche Ansicht, ihre Anordnung für diese Art und woher. */
export interface ViewPick {
  key: string;
  layout: LayoutElement[];
  /** Die Art, an der die Anordnung steht; `null` heisst: die der Ansicht selbst. */
  from: string | null;
  mode: 'view' | 'own' | 'adjusted';
  /** Aus dem Designer (Gruppe oder Geltung) — dann zeichnet sie ihren Baum ganz. */
  designed: boolean;
  /** Woher jedes Element kommt: die Grundlage (`type Shop`, `view full`) und die Beiträge, die es anfassen (E-168). */
  origin: Record<string, string[]>;
  /** Gleichstände und Konflikte der Schichten (E-173). */
  conflicts: ViewConflict[];
  /** Die Position, nach der jedes Element steht (E-168) — für den Designer (`contributionFrom`). */
  positions: Record<string, number>;
}

/**
 * **Ein Konflikt der Schichten** (E-173): `conflict` — zwei Beiträge
 * ändern dasselbe Element, `winner` gilt (die genauere Schicht, bei
 * gleicher Genauigkeit die höhere Priorität); `tie` — ein Element steht
 * mit Absicht auf derselben Position wie ein anderes, die Reihenfolge
 * entscheidet dann Priorität und Genauigkeit. Beides ist kein Fehler,
 * aber etwas, das die Leitung sehen soll.
 */
export interface ViewConflict {
  kind: 'conflict' | 'tie';
  element: string;
  sources: string[];
  winner?: string;
  position?: number;
}

/**
 * **Die eine Stelle, an der gewählt wird** (T-310, E-103): für einen
 * Artikel und einen Ort (`quick`, `overview`, `full`, `print` oder eine
 * eigene Gruppe) die geltende Ansicht und ihre Anordnung. Ein Ort, den es
 * nicht mehr gibt (`search`, T-346), liest sich als sein Nachfolger
 * (`RETIRED_PLACES`).
 *
 * Ein Ort ist eine Gruppe: es gilt die genaueste Ansicht darin
 * (`viewFor`), sonst die des Ortes selbst. Nennt `place` eine gestaltete
 * Ansicht, gilt genau sie; `exact` nimmt auch eine Ortsansicht beim Wort —
 * so die Wahl oben am Artikel, wo „Quick" Quick heisst. Fehlt die Ansicht
 * im Register, gilt `fallback`.
 *
 * Popup, Kompendium-Vorschau, Board-Kachel, Artikelseite und Druck fragen
 * hier und nicht bei `layoutFor` — sonst sähe eine im Designer gestaltete
 * Kurzansicht nur, wer die Artikelseite öffnet.
 */
export function pickView(
  entity: Gelesen,
  registry: Pick<Registry, 'interfaces' | 'views'>,
  place: string,
  opts: { incoming?: readonly { type: string }[]; exact?: boolean; fallback?: string; force?: string } = {},
): ViewPick {
  if (!registry.views[place] && RETIRED_PLACES[place]) place = RETIRED_PLACES[place]!;
  const def = registry.views[place];
  let key = def && (opts.exact || isDesignedView(def)) ? place : viewFor(entity, registry, place, { incoming: opts.incoming });
  if (!registry.views[key] && opts.fallback && registry.views[opts.fallback]) {
    key = viewFor(entity, registry, opts.fallback, { incoming: opts.incoming });
  }
  const { layout, from, mode } = layoutFor(registry, key, entity.interfaces?.[0] ?? '');
  const designed = isDesignedView(registry.views[key]);
  /* Die Schichten (E-168): was für diesen Artikel an Beiträgen der Gruppe gilt, legt sich darüber. */
  /* `force` nimmt einen Beitrag auch ohne passenden Artikel mit — der Designer zeigt die Schicht, die er bearbeitet. */
  const beitraege = contributionsFor(registry, viewGroup(key, registry.views[key]), (d, k) => k === opts.force || appliesHolds(registry, d.applies, entity, opts.incoming ?? []));
  const grund = from ? `type ${from}` : `view ${key}`;
  const c = composeLayout(layout, grund, from ? SPEC.type : SPEC.global, beitraege);
  return { key, layout: c.layout, from, mode, designed, origin: c.origin, conflicts: c.conflicts, positions: c.positions };
}

/**
 * **Die zusammengesetzte Ansicht** (T-425, E-168, E-173): was ein Ort für
 * diesen Artikel zeichnet, mit Herkunft je Element und den Konflikten —
 * für den Designer und die Werkbank. Dasselbe wie `pickView`.
 */
export function composeView(
  entity: Gelesen,
  registry: Pick<Registry, 'interfaces' | 'views'>,
  place: string,
  opts: { incoming?: readonly { type: string }[]; exact?: boolean; fallback?: string; force?: string } = {},
): ViewPick {
  return pickView(entity, registry, place, opts);
}

/** Wie genau eine Schicht ist: global < Typ < Bedingung < Artikel. */
const SPEC: Record<ViewScope, number> = { global: 0, type: 1, condition: 2, article: 3 };

interface Beitrag {
  key: string;
  adjust: LayoutAdjust;
  spec: number;
  prio: number;
}

/** Die Beiträge einer Gruppe, die gelten — von allgemein nach genau, bei gleicher Genauigkeit nach Priorität. */
function contributionsFor(registry: Pick<Registry, 'views'>, group: string, gilt: (def: ViewDef, key: string) => boolean): Beitrag[] {
  const raus: (Beitrag & { i: number })[] = [];
  viewKeys(registry).forEach((key, i) => {
    const def = registry.views[key];
    if (!def?.adjust || viewGroup(key, def) !== group || !gilt(def, key)) return;
    raus.push({ key, adjust: def.adjust, spec: SPEC[appliesScope(def.applies)], prio: def.priority ?? 0, i });
  });
  return raus.sort((a, b) => a.spec - b.spec || a.prio - b.prio || a.i - b.i);
}

/**
 * **Die Schichten anwenden.** Jeder Beitrag wirkt auf das Ergebnis des
 * vorigen (`applyAdjust`); ein Element, das ein Beitrag mit derselben Id
 * bringt, ersetzt das alte an seiner Stelle. Fassen zwei Beiträge
 * dasselbe Element an, ist das ein Konflikt — der spätere (genauere oder
 * höher priorisierte) gilt. Danach wird nach Position sortiert: was keine
 * nennt, zählt in der Grundlage 10, 20, 30 … (still, und darum fest —
 * nimmt ein Beitrag das erste weg, bleibt das zweite bei 20); was ein
 * Beitrag ohne Position bringt, folgt seinem Vorgänger. Bei gleicher Zahl
 * geht die höhere Priorität vor, dann die genauere Schicht.
 */
function composeLayout(
  basis: readonly LayoutElement[],
  grund: string,
  grundSpec: number,
  beitraege: readonly Beitrag[],
): { layout: LayoutElement[]; origin: Record<string, string[]>; conflicts: ViewConflict[]; positions: Record<string, number> } {
  const origin: Record<string, string[]> = {};
  const still = new Map<string, number>();
  let zaehler = 0;
  for (const el of basis) {
    origin[el.id] = [grund];
    still.set(el.id, el.pos ?? (zaehler += 10));
  }
  if (!beitraege.length) return { layout: [...basis], origin, conflicts: [], positions: Object.fromEntries(still) };
  let layout = [...basis];
  const wer = new Map<string, string>();
  const rang = new Map<string, { spec: number; prio: number; quelle: string }>();
  const conflicts: ViewConflict[] = [];
  for (const b of beitraege) {
    const a = b.adjust;
    const extra = a.extra ?? [];
    const neu: LayoutElement[] = [];
    for (const x of extra) {
      const i = layout.findIndex((e) => e.id === x.id);
      if (i >= 0) layout[i] = x;
      else neu.push(x);
    }
    layout = applyAdjust(layout, { ...a, extra: neu });
    const ids = new Set([...(a.drop ?? []), ...Object.keys(a.add ?? {}), ...extra.map((x) => x.id), ...(a.order ?? [])]);
    for (const id of ids) {
      const vorher = wer.get(id);
      if (vorher && vorher !== b.key) conflicts.push({ kind: 'conflict', element: id, sources: [vorher, b.key], winner: b.key });
      wer.set(id, b.key);
      const o = (origin[id] ??= []);
      if (!o.includes(b.key)) o.push(b.key);
    }
    for (const x of extra) rang.set(x.id, { spec: b.spec, prio: b.prio, quelle: b.key });
  }
  let vorher = 0;
  const gesetzt = layout.map((el, i) => {
    const r = rang.get(el.id) ?? { spec: grundSpec, prio: 0, quelle: origin[el.id]?.[0] ?? grund };
    const pos = el.pos ?? still.get(el.id) ?? vorher;
    const folgt = el.pos === undefined && !still.has(el.id);
    vorher = pos;
    return { el, i, r, pos, folgt, eigen: el.pos !== undefined && el.pos !== still.get(el.id) };
  });
  gesetzt.sort((x, y) => x.pos - y.pos || +x.folgt - +y.folgt || (x.folgt ? x.i - y.i : 0) || y.r.prio - x.r.prio || y.r.spec - x.r.spec || x.i - y.i);
  /* Gleichstände melden: eine Position, mehrere Elemente, mindestens eins mit Absicht dorthin gesetzt. */
  const nachPos = new Map<number, typeof gesetzt>();
  for (const g of gesetzt) nachPos.set(g.pos, [...(nachPos.get(g.pos) ?? []), g]);
  for (const [pos, gruppe] of nachPos) {
    const erster = gruppe.find((g) => g.eigen);
    if (gruppe.length < 2 || !erster) continue;
    const andere = gruppe.filter((g) => g !== erster && !g.folgt).map((g) => g.r.quelle);
    if (!andere.length) continue;
    conflicts.push({ kind: 'tie', element: erster.el.id, sources: [erster.r.quelle, ...new Set(andere)], position: pos });
  }
  return { layout: gesetzt.map((g) => g.el), origin, conflicts, positions: Object.fromEntries(gesetzt.map((g) => [g.el.id, g.pos])) };
}

/**
 * **Ein Beitrag aus dem Entwurf** (T-425, E-168): was der Designer als
 * Schicht speichert. `basis` ist, was ohne diesen Beitrag gezeichnet würde,
 * `positions` dessen Positionen (`ViewPick.positions`). Was fehlt, geht
 * (`drop`); was neu ist, verschoben oder anders eingestellt, kommt als
 * `extra` — ein geändertes an seiner Stelle mit derselben Id, ein neues
 * oder verschobenes mit einer Position zwischen seinen Nachbarn. Kein
 * `order`: eine Reihenfolge über alle Elemente stiesse mit jeder anderen
 * Schicht zusammen.
 */
export function contributionFrom(
  basis: readonly LayoutElement[],
  positions: Readonly<Record<string, number>>,
  tree: readonly LayoutElement[],
  hide?: readonly string[],
): LayoutAdjust {
  const inBasis = new Map(basis.map((e) => [e.id, e]));
  const imBaum = new Set(tree.map((e) => e.id));
  const adj: LayoutAdjust = {};
  const drop = basis.filter((e) => !imBaum.has(e.id)).map((e) => e.id);
  if (drop.length) adj.drop = drop;
  if (hide?.length) adj.hide = [...hide];
  /* Anker: Elemente der Grundlage, die in aufsteigender Position bleiben. */
  let zuletzt = -Infinity;
  const anker = tree.map((el) => {
    const b = inBasis.get(el.id);
    const p = b ? positions[el.id] : undefined;
    if (b && p !== undefined && p > zuletzt && el.pos === b.pos) {
      zuletzt = p;
      return p;
    }
    return null;
  });
  const extra: LayoutElement[] = [];
  tree.forEach((el, i) => {
    const b = inBasis.get(el.id);
    if (anker[i] !== null) {
      if (!gleich(el, b)) extra.push(kopie([el])[0]!);
      return;
    }
    let j = i - 1;
    while (j >= 0 && anker[j] === null) j--;
    let k = i + 1;
    while (k < tree.length && anker[k] === null) k++;
    const lo = j >= 0 ? anker[j]! : k < tree.length ? Math.min(0, anker[k]! - 10) : 0;
    const hi = k < tree.length ? anker[k]! : lo + 10 * (k - j);
    const p = lo + ((hi - lo) * (i - j)) / (k - j);
    extra.push({ ...kopie([el])[0]!, pos: Math.round(p * 100) / 100 });
  });
  if (extra.length) adj.extra = extra;
  return adj;
}

/** Ein Konflikt der Schichten, für eine Gruppe und eine Art (die Werkbank, E-173). */
export interface ViewConflictRow extends ViewConflict {
  group: string;
  type: string;
}

/**
 * **Konflikte im ganzen Register** (E-173): je Gruppe mit Beiträgen und je
 * anlegbare Art, was sich überschneidet — als gälte jede Bedingung. Ein
 * Beitrag für einen Artikel zählt bei dessen Art (`typeOf`), sonst nicht.
 * Dasselbe Paar an mehreren Arten steht einmal da.
 */
export function viewConflicts(
  registry: Pick<Registry, 'interfaces' | 'views'>,
  typeOf: (id: string) => string | undefined = () => undefined,
): ViewConflictRow[] {
  const gruppen = new Set<string>();
  for (const key of viewKeys(registry)) {
    const def = registry.views[key];
    if (def?.adjust) gruppen.add(viewGroup(key, def));
  }
  const raus: ViewConflictRow[] = [];
  const gesehen = new Set<string>();
  const arten = Object.entries(registry.interfaces)
    .filter(([, d]) => !d.abstract)
    .map(([n]) => n)
    .sort();
  for (const group of gruppen) {
    for (const type of arten) {
      const kette = typeChain(registry, type);
      const gilt = (def: ViewDef): boolean => {
        const a = def.applies;
        if (!a) return true;
        if (a.types?.length && !a.types.some((t) => kette.includes(t))) return false;
        if (a.article) {
          const t = typeOf(a.article);
          return t === type;
        }
        return true;
      };
      const beitraege = contributionsFor(registry, group, gilt);
      if (!beitraege.length) continue;
      const { layout, from } = registry.views[group] ? layoutFor(registry, group, type) : { layout: [], from: null };
      const c = composeLayout(layout, from ? `type ${from}` : `view ${group}`, from ? SPEC.type : SPEC.global, beitraege);
      for (const k of c.conflicts) {
        const schluessel = `${group}|${k.kind}|${k.element}|${k.sources.join(',')}`;
        if (gesehen.has(schluessel)) continue;
        gesehen.add(schluessel);
        raus.push({ ...k, group, type });
      }
    }
  }
  return raus;
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

/**
 * **Was nur der Baum zeichnet** (T-310): die Behälter und die Werte, die
 * der Designer brachte, und die Zeilen einer Tabelle. Steht eins davon in
 * einer Anordnung, die eine Karte (Vorschau, Kachel, Druck) sonst selbst
 * zeichnet, zeichnet es `nw-ansichtsbaum` an seiner Stelle — ein
 * Collapsible in der Kurzansicht ist sonst einfach weg.
 */
export const TREE_ELEMENTS: readonly string[] = [...CONTAINER_ELEMENTS, 'tileGroup', 'quote', 'badges', 'edgeTable', 'table', 'structure', 'collection'];

export function drawnByTree(el: Pick<LayoutElement, 'el'>): boolean {
  return TREE_ELEMENTS.includes(el.el);
}

/**
 * **Ein Reiter als Knoten** (T-276): im Baum des Designers steht ein
 * Element `tabs` mit je Reiter einem Knoten `tab` darunter, dessen Kinder
 * seine Anordnung sind — so ordnet man in Reitern mit denselben Griffen wie
 * in einer Section. Gespeichert wird wieder `tabs: [{ id, label, layout }]`
 * (`treeAsTabs`); den Knoten `tab` gibt es nur im Designer.
 */
export const TAB_NODE = 'tab';

/** Hält dieses Element im Baum des Designers Kinder? Behälter, Reiter und ihre Leiste. */
export function holdsChildren(el: Pick<LayoutElement, 'el'>): boolean {
  return isContainer(el) || el.el === 'tabs' || (el.el as string) === TAB_NODE;
}

/** Darf `kind` in `behaelter` stehen? In `tabs` nur Reiter, Reiter nur in `tabs`. */
function passt(behaelter: Pick<LayoutElement, 'el'>, kind: Pick<LayoutElement, 'el'>): boolean {
  if (!holdsChildren(behaelter)) return false;
  return (behaelter.el === 'tabs') === ((kind.el as string) === TAB_NODE);
}

/** `tabs` mit Reitern → Knoten mit Kindern (für den Designer). */
export function tabsAsTree(layout: readonly LayoutElement[]): LayoutElement[] {
  return layout.map((alt) => {
    const el: LayoutElement = { ...alt };
    if (el.children) el.children = tabsAsTree(el.children);
    if (el.el === 'tabs') {
      el.children = (el.tabs ?? []).map((t) => ({ id: t.id, el: TAB_NODE as LayoutElement['el'], text: t.label, children: tabsAsTree(t.layout) }));
      delete el.tabs;
    }
    return el;
  });
}

/** Zurück: die Knoten `tab` unter `tabs` werden wieder `tabs: [{ id, label, layout }]`. */
export function treeAsTabs(tree: readonly LayoutElement[]): LayoutElement[] {
  return tree.map((alt) => {
    const el: LayoutElement = { ...alt };
    if (el.el === 'tabs') {
      el.tabs = (el.children ?? [])
        .filter((k) => (k.el as string) === TAB_NODE)
        .map((k) => ({ id: k.id, label: k.text ?? 'Tab', layout: treeAsTabs(k.children ?? []) }));
      delete el.children;
    } else if (el.children) el.children = treeAsTabs(el.children);
    return el;
  });
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

export type TreeMove = 'out' | 'into' | 'up' | 'down' | 'remove';

/**
 * **Was ein Griff an diesem Element kann** (T-276) — der Designer zeigt
 * nur, was geht: → nur, wenn das Element darüber ein Behälter ist, der es
 * nimmt; ← nur, wenn es verschachtelt ist.
 */
export function canMove(tree: readonly LayoutElement[], id: string, op: TreeMove): boolean {
  const f = finde(tree as LayoutElement[], id);
  if (!f) return false;
  const el = f.liste[f.i]!;
  if (op === 'remove') return true;
  if (op === 'up') return f.i > 0;
  if (op === 'down') return f.i < f.liste.length - 1;
  if (op === 'into') {
    const davor = f.liste[f.i - 1];
    if (!davor) return false;
    if (passt(davor, el)) return true;
    /* In eine Reiterleiste: in ihren letzten Reiter. */
    return davor.el === 'tabs' && (el.el as string) !== TAB_NODE && !!davor.children?.length;
  }
  /* out: ein Reiter verlässt seine Leiste nicht. */
  return !!f.eltern && (el.el as string) !== TAB_NODE;
}

/**
 * **Die Griffe des Designers** (T-268, T-276): ← aus dem Behälter hinaus
 * (hinter ihn; aus einem Reiter hinter die Reiterleiste), → in das Element
 * darüber (wenn es ein Behälter ist), ↑ ↓ eins weiter, × weg. Jeder gibt
 * einen neuen Baum; was nicht geht (`canMove`), gibt den alten unverändert
 * zurück.
 */
export function moveTree(tree: readonly LayoutElement[], id: string, op: TreeMove): LayoutElement[] {
  if (!canMove(tree, id, op)) return kopie(tree);
  const neu = kopie(tree);
  const f = finde(neu, id)!;
  const [el] = f.liste.splice(f.i, 1) as [LayoutElement];
  if (op === 'remove') return neu;
  if (op === 'up' || op === 'down') {
    f.liste.splice(op === 'up' ? f.i - 1 : f.i + 1, 0, el);
    return neu;
  }
  if (op === 'into') {
    const davor = f.liste[f.i - 1]!;
    const ziel = passt(davor, el) ? davor : davor.children![davor.children!.length - 1]!;
    (ziel.children ??= []).push(el);
    return neu;
  }
  /* out — aus einem Reiter hinaus heisst: hinter die Reiterleiste. */
  let anker = f.eltern!;
  if ((anker.el as string) === TAB_NODE) anker = finde(neu, anker.id)!.eltern ?? anker;
  const oben = finde(neu, anker.id)!;
  oben.liste.splice(oben.i + 1, 0, el);
  return neu;
}

/**
 * **Ziehen** (T-276, zusätzlich zu den Griffen): das Element in einen
 * Behälter (`into`) oder hinter ein anderes (`after`). In sich selbst oder
 * ein eigenes Kind lässt es sich nicht ziehen; was nicht passt, bleibt.
 */
export function moveToElement(tree: readonly LayoutElement[], id: string, target: string, where: 'into' | 'after'): LayoutElement[] {
  const quelle = findElement(tree, id);
  if (!quelle || id === target || (quelle.children && findElement(quelle.children, target))) return kopie(tree);
  const neu = kopie(tree);
  const f = finde(neu, id)!;
  const [el] = f.liste.splice(f.i, 1) as [LayoutElement];
  const t = finde(neu, target);
  if (!t) return kopie(tree);
  const ziel = t.liste[t.i]!;
  if (where === 'into' && passt(ziel, el)) (ziel.children ??= []).push(el);
  else if (where === 'after' && (t.eltern ? passt(t.eltern, el) : (el.el as string) !== TAB_NODE)) t.liste.splice(t.i + 1, 0, el);
  else return kopie(tree);
  return neu;
}

/**
 * Ein Element einfügen: in den gewählten Behälter, sonst hinter das
 * gewählte, sonst ans Ende. In eine Reiterleiste kommt ein Reiter; was
 * kein Reiter ist, kommt in ihren letzten Reiter.
 */
export function insertElement(tree: readonly LayoutElement[], el: LayoutElement, at?: string | null): LayoutElement[] {
  const neu = kopie(tree);
  const f = at ? finde(neu, at) : null;
  if (!f) return [...neu, el];
  const ziel = f.liste[f.i]!;
  if (passt(ziel, el)) (ziel.children ??= []).push(el);
  else if (ziel.el === 'tabs' && ziel.children?.length) (ziel.children[ziel.children.length - 1]!.children ??= []).push(el);
  else if ((el.el as string) === TAB_NODE && f.eltern && passt(f.eltern, el)) f.liste.splice(f.i + 1, 0, el);
  else if ((el.el as string) === TAB_NODE) return kopie(tree);
  else f.liste.splice(f.i + 1, 0, el);
  return neu;
}

/** Alle Ids eines Baums, auch in Kindern und Reitern. */
function alleIds(tree: readonly LayoutElement[], raus = new Map<string, LayoutElement>()): Map<string, LayoutElement> {
  for (const el of tree) {
    raus.set(el.id, el);
    if (el.children) alleIds(el.children, raus);
    for (const t of el.tabs ?? []) alleIds(t.layout, raus);
  }
  return raus;
}

/** Gleich, ohne auf die Reihenfolge der Schlüssel zu achten. */
function gleich(a: unknown, b: unknown): boolean {
  const norm = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(norm)
      : x && typeof x === 'object'
        ? Object.fromEntries(
            Object.entries(x as Record<string, unknown>)
              .filter(([, v]) => v !== undefined)
              .sort(([k1], [k2]) => (k1 < k2 ? -1 : 1))
              .map(([k, v]) => [k, norm(v)]),
          )
        : x;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/**
 * **Eine Anordnung als Anpassung sagen** (T-276): aus der geerbten
 * Anordnung (`basis`) und dem, was der Designer daraus gemacht hat
 * (`tree`, gespeicherte Form mit `tabs`), die Abweichung — weggelassene
 * Elemente (`drop`), Felder, die ein Element dazunimmt (`add`), Elemente,
 * die nur hier stehen (`extra`), die Reihenfolge (`order`). `hide` bleibt,
 * wie es war. Lässt sich der Baum so nicht sagen (ein Element anders
 * eingestellt, verschoben, Felder umsortiert), gibt es `null`: dann ist es
 * eine eigene Anordnung.
 */
export function adjustFrom(basis: readonly LayoutElement[], tree: readonly LayoutElement[], hide?: readonly string[]): LayoutAdjust | null {
  const inBasis = alleIds(basis);
  const inTree = alleIds(tree);
  const adj: LayoutAdjust = {};
  const drop = [...inBasis.keys()].filter((id) => !inTree.has(id));
  if (drop.length) adj.drop = drop;
  if (hide?.length) adj.hide = [...hide];
  const add: Record<string, string[]> = {};
  for (const [id, el] of inTree) {
    const b = inBasis.get(id);
    if (!b || (el.el !== 'fields' && el.el !== 'prose') || !Array.isArray(el.fields)) continue;
    const vorher = Array.isArray(b.fields) ? b.fields : [];
    const dazu = el.fields.filter((x) => !vorher.includes(x));
    if (dazu.length) add[id] = dazu;
  }
  if (Object.keys(add).length) adj.add = add;
  const extra = tree.filter((el) => !inBasis.has(el.id));
  if (extra.length) adj.extra = kopie(extra);
  if (gleich(applyAdjust(basis, adj), tree)) return adj;
  adj.order = tree.map((el) => el.id);
  return gleich(applyAdjust(basis, adj), tree) ? adj : null;
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
