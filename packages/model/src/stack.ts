/**
 * **Was gilt, ist eine Abfrage** (Regel E2, Abgleich A2): der Stapel der
 * laufenden Kampagne entscheidet, welche Artikel da sind und welche Fassung
 * einer Sache gilt. Gelöscht wird dabei nie.
 *
 * Bis zum 7.10. rechnete das nur der Prototyp; der Server schickte einen
 * Artikel, den eine Ebene herausnimmt oder überschreibt, trotzdem hinaus.
 * Jetzt steht die Rechnung hier, einmal, für Server und Oberfläche.
 *
 * Die Regeln, wie im Prototyp:
 *
 *  - Die **laufende Kampagne** sagt die Einstellung `campaign`; ohne sie
 *    die erste Kampagne im Bestand. Gibt es gar keine, gilt alles — es
 *    gibt nichts, wogegen man rechnen könnte.
 *  - Ihr **Stapel** sind die Ebenen, die sie aufschaltet (`activates`),
 *    von unten nach oben: die Reihenfolge an der Kante (`props.order`),
 *    sonst die Spezifität der Ebene selbst (`Layer.order`, Vorgabe 10).
 *  - Ein Artikel **ohne Ebenenkante** ist immer da (E1). Mit: er ist da,
 *    wenn eine aufgeschaltete Ebene ihn bringt und keine spezifischere ihn
 *    herausnimmt (`mode: 'removes'`).
 *  - Eine **Überschreibung** (`overrides`) gilt nur aus einer
 *    aufgeschalteten Ebene heraus — eine, die immer gälte, wäre eine
 *    Bearbeitung. Die spezifischste gewinnt; die Kette wird bis zum Ende
 *    verfolgt, aber nicht im Kreis.
 *  - Eine **Gruppe** (`Layer.kind: 'group'`, E-022 b, T-088) ist eine
 *    Ebene, deren Mitglieder mit `partOf` an ihr hängen. Schaltet die
 *    Kampagne sie auf, sind alle Mitglieder im Spiel, verschachtelt auch
 *    die Mitglieder der Mitglieder (nicht im Kreis). Den Rang gibt die
 *    Gruppe; darin stehen sie nach Erscheinen (`Layer.published`), das
 *    neuere höher. **Eine ausdrückliche Kante schlägt die Gruppe:** eine
 *    Ebene, die die Kampagne selbst aufschaltet, steht an ihrer eigenen
 *    Stelle, und eine mit `activates` `mode: 'off'` ist aus, auch wenn
 *    eine Gruppe sie brächte — aus schlägt an.
 *  - **Teilweise aufschalten** (T-105, REQ-255): eine Kante `activates`
 *    darf sagen, was ihre Ebene bringt — `props.areas` (Bereiche wie
 *    `rules`, aus `area` der Art) und `props.types` (einzelne Arten). Ohne
 *    beide: alles. Was nicht passt, bringt die Ebene nicht — auch nicht als
 *    Herausnahme oder Überschreibung; aus einem Abenteuer kommen so die
 *    Gegenstände, nicht die Orte. Eine Gruppe gibt ihre Auswahl an ihre
 *    Mitglieder weiter; die ausdrückliche Kante eines Mitglieds hat ihre
 *    eigene.
 */

import { entityName } from './entity.js';
import { areaOf } from './entity.js';
import type { Entity, EntityId, Registry } from './types.js';
import { ACTIVATES_RELATION, CAMPAIGN_TYPE, LAYER_RELATION } from './visibility.js';

export const OVERRIDES_RELATION = 'overrides';
/**
 * **Vergleichsebenen** (E-021 d, T-092): eine Kante `activates` mit
 * `props.mode: 'compare'` bringt ihre Ebene nicht ins Spiel, sondern nur
 * in den Vergleich — ihre Fassungen stehen auf Wunsch an den Feldern und
 * lassen sich als Überschreibung übernehmen. Für `inPlay` zählt sie nicht.
 */
export const COMPARE_MODE = 'compare';
export const LAYER_COMPONENT = 'Layer';
/** Die Kontoeinstellung mit der gewählten Schreibebene je Kampagne
 *  (`{ [Kampagne]: Ebene }`, T-176) — neben dem Konto, nie im Artikel. */
export const WRITE_LAYER_PREF = 'writeLayer';
/** Eine Ebene, die andere Ebenen enthält (E-022 b, T-088). */
export const GROUP_KIND = 'group';
/**
 * **Aus, obwohl eine Gruppe es brächte** (T-088): eine Kante `activates`
 * mit `props.mode: 'off'` nimmt genau diese Ebene (und was nur über sie
 * hereinkäme) aus dem Stapel. Ohne aufgeschaltete Gruppe tut sie nichts.
 */
export const OFF_MODE = 'off';
/** Die Kante, mit der eine Ebene an ihrer Gruppe hängt (E-022 b). */
export const GROUP_RELATION = 'partOf';
/** Die Einstellung, die sagt, welche Kampagne läuft. */
export const CAMPAIGN_SETTING = 'campaign';

type Rel = NonNullable<Entity['relations']>[number];

const kanten = (e: Entity | undefined, type: string): Rel[] =>
  (e?.relations ?? []).filter((r) => r.type === type);

/** Ist diese Kante `activates` nur ein Vergleich (T-092)? */
export const isCompareEdge = (r: { type: string; props?: unknown }): boolean =>
  r.type === ACTIVATES_RELATION && (r.props as { mode?: unknown } | undefined)?.mode === COMPARE_MODE;

/** Schaltet diese Kante `activates` eine Ebene ausdrücklich ab (T-088)? */
export const isOffEdge = (r: { type: string; props?: unknown }): boolean =>
  r.type === ACTIVATES_RELATION && (r.props as { mode?: unknown } | undefined)?.mode === OFF_MODE;

/** Die Kanten, die eine Ebene wirklich aufschalten — ohne Vergleiche und Abschaltungen. */
const aufschalten = (e: Entity | undefined): Rel[] =>
  kanten(e, ACTIVATES_RELATION).filter((r) => !isCompareEdge(r) && !isOffEdge(r));

/**
 * **Was eine Ebene bringt** (T-105, REQ-255): Bereiche und Arten. Ein
 * Artikel passt, wenn seine Art genannt ist oder ihr Bereich. `null`
 * heisst: alles — die Vorgabe.
 */
export interface LayerFilter {
  areas?: string[];
  types?: string[];
}

const woerter = (x: unknown): string[] | undefined =>
  Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string') : undefined;

/** Die Auswahl an einer Kante `activates`; ohne `areas` und `types` keine. */
export function filterOf(r: { props?: unknown } | undefined): LayerFilter | null {
  const p = r?.props as { areas?: unknown; types?: unknown } | undefined;
  const areas = woerter(p?.areas);
  const types = woerter(p?.types);
  if (!areas && !types) return null;
  return { ...(areas ? { areas } : {}), ...(types ? { types } : {}) };
}

/** Der Bereich einer Art, je Art einmal gerechnet (`areaOf` läuft die Kette hoch). */
type BereichVon = (type: string) => string;
function bereichVon(registry: Pick<Registry, 'interfaces'> | undefined): BereichVon | undefined {
  if (!registry) return undefined;
  const merk = new Map<string, string>();
  return (t) => {
    let a = merk.get(t);
    if (a === undefined) merk.set(t, (a = areaOf(registry, t)));
    return a;
  };
}

/**
 * Passt der Artikel zur Auswahl? Ohne Auswahl ja. **Ohne Register** lässt
 * sich ein Bereich nicht prüfen, und die Bereichsauswahl gilt dann nicht —
 * lieber zu viel gezeigt als still ein ganzes Buch verloren; wer einen
 * Stapel rechnet, gibt das Register mit.
 */
function passt(f: LayerFilter | null | undefined, entity: Entity, bereich: BereichVon | undefined): boolean {
  if (!f) return true;
  const t = (entity.interfaces ?? [])[0] ?? '';
  if (f.types?.includes(t)) return true;
  if (!f.areas) return false;
  if (!bereich) return true;
  return f.areas.includes(bereich(t));
}

/** Öffentlich für die Oberfläche und die Tests: dieselbe Frage mit einem Register. */
export function passesFilter(
  f: LayerFilter | null | undefined,
  entity: Entity,
  registry?: Pick<Registry, 'interfaces'>,
): boolean {
  return passt(f, entity, bereichVon(registry));
}

const layerKarte = (e: Entity | undefined): Record<string, unknown> =>
  (e?.components?.[LAYER_COMPONENT] as Record<string, unknown> | undefined) ?? {};

/** Ist diese Ebene eine Gruppe (E-022 b)? Beschreibung wie jedes `kind` — aber eine, die etwas enthält. */
export const isGroupLayer = (e: Entity | undefined): boolean =>
  (e?.interfaces ?? [])[0] === LAYER_COMPONENT && layerKarte(e)['kind'] === GROUP_KIND;

/**
 * **Wonach eine Gruppe ordnet** (T-094): `publisher` — wer das Buch
 * herausgibt (Official, Partnered, Third party, Homebrew) — oder, ohne
 * Angabe, `category` (Core rules, Settings, Adventures …). Beides sind
 * Gruppen nach E-022 b, und ein Buch steht in beiden; die Angabe sagt nur,
 * in welcher Ansicht der Kampagnenseite die Gruppe steht. Für den Stapel
 * zählt sie nicht.
 */
export const PUBLISHER_GROUPING = 'publisher';
export const CATEGORY_GROUPING = 'category';
export const groupingOf = (e: Entity | undefined): 'publisher' | 'category' =>
  layerKarte(e)['groupBy'] === PUBLISHER_GROUPING ? PUBLISHER_GROUPING : CATEGORY_GROUPING;

/** Was eine Ebene ist, die hier angelegt wurde und in keiner Herausgeber-Gruppe steht (T-094, T-109). */
export const HOMEBREW = 'Homebrew';
/** Was eine eingelesene Ebene ist, die in keiner Herausgeber-Gruppe steht (T-109). */
export const UNASSIGNED = 'Unassigned';

/** Der Herausgeber einer Ebene samt Begründung (T-109): der Name, die Gruppen, aus denen er kommt, und ein Satz, warum. */
export interface PublisherInfo {
  name: string;
  groups: EntityId[];
  why: string;
}

/** Alle Herausgeber-Gruppen (T-109), nach Name — die Auswahl, an die eine Ebene gehängt werden kann. */
export function publisherGroups(entities: Map<EntityId, Entity>): Entity[] {
  return [...entities.values()]
    .filter((g) => isGroupLayer(g) && groupingOf(g) === PUBLISHER_GROUPING)
    .sort((a, b) => entityName(a).localeCompare(entityName(b)));
}

/**
 * **Der Herausgeber einer Ebene** (T-094, REQ-249) — gerechnet, nicht
 * gespeichert (D8): die Namen der Herausgeber-Gruppen, an denen sie mit
 * `partOf` hängt. Ein zweites Feld `publisher` neben der Gruppe wäre die
 * zweite Stelle, die beim ersten Umhängen falsch steht. Eine Gruppe hat
 * keinen.
 *
 * Hängt sie an keiner, entscheidet, **woher sie kommt** (T-109):
 * `homebrew` nennt die Ebenen, die hier angelegt wurden — von einem
 * Konto, mit einer Kampagne —, die sind „Homebrew"; jede andere ist
 * eingelesen und „Unassigned". Bis T-109 hiess alles ohne Gruppe
 * Homebrew, auch die Sammelebene aus 5e.tools, und niemand sah, woher
 * die Marke kam.
 */
export function publisherInfo(
  entities: Map<EntityId, Entity>,
  layer: Entity | undefined,
  homebrew?: ReadonlySet<EntityId>,
): PublisherInfo {
  if (!layer || isGroupLayer(layer)) return { name: '', groups: [], why: '' };
  const gruppen = kanten(layer, GROUP_RELATION)
    .map((r) => entities.get(r.to))
    .filter((g): g is Entity => isGroupLayer(g) && groupingOf(g) === PUBLISHER_GROUPING);
  const ids = [...new Set(gruppen.map((g) => g.id))];
  const namen = [...new Set(gruppen.map((g) => entityName(g)))];
  if (namen.length) {
    return { name: namen.join(' / '), groups: ids, why: `Because this layer is part of the publisher group ${namen.join(' and ')}.` };
  }
  return homebrew?.has(layer.id)
    ? { name: HOMEBREW, groups: [], why: 'Not part of any publisher group, and made here rather than imported.' }
    : { name: UNASSIGNED, groups: [], why: 'Not part of any publisher group.' };
}

/** Nur der Name aus `publisherInfo` — die Marke in Listen und auf der Kampagnenseite. */
export function publisherOf(
  entities: Map<EntityId, Entity>,
  layer: Entity | undefined,
  homebrew?: ReadonlySet<EntityId>,
): string {
  return publisherInfo(entities, layer, homebrew).name;
}

/**
 * **Die Mitglieder jeder Gruppe**, einmal gerechnet (T-088): Gruppen-Id →
 * die Ebenen, die mit `partOf` an ihr hängen, nach Erscheinen
 * (`Layer.published`, ohne Datum zuletzt), dann nach Name. Gezählt wird
 * nur, was selbst eine Ebene ist und an einer Gruppe hängt.
 */
export function groupMembers(entities: Map<EntityId, Entity>): Map<EntityId, EntityId[]> {
  const roh = new Map<EntityId, Entity[]>();
  for (const e of entities.values()) {
    if ((e.interfaces ?? [])[0] !== LAYER_COMPONENT) continue;
    for (const r of kanten(e, GROUP_RELATION)) {
      if (!isGroupLayer(entities.get(r.to))) continue;
      const l = roh.get(r.to) ?? [];
      if (!l.includes(e)) l.push(e);
      roh.set(r.to, l);
    }
  }
  const datum = (e: Entity) => String(layerKarte(e)['published'] ?? '') || '9999';
  const out = new Map<EntityId, EntityId[]>();
  for (const [g, l] of roh) {
    l.sort((a, b) => (datum(a) < datum(b) ? -1 : datum(a) > datum(b) ? 1 : (a.name ?? '').localeCompare(b.name ?? '')));
    out.set(g, l.map((e) => e.id));
  }
  return out;
}

/**
 * **Alle Ebenen in einer Gruppe**, verschachtelt, ohne die Gruppe selbst
 * und nicht im Kreis (T-088) — in der Reihenfolge, in der sie im Stapel
 * stünden.
 */
export function layersInGroup(
  entities: Map<EntityId, Entity>,
  groupId: EntityId,
  members: Map<EntityId, EntityId[]> = groupMembers(entities),
): EntityId[] {
  const out: EntityId[] = [];
  const gesehen = new Set<EntityId>([groupId]);
  const lauf = (g: EntityId) => {
    for (const m of members.get(g) ?? []) {
      if (gesehen.has(m)) continue;
      gesehen.add(m);
      out.push(m);
      lauf(m);
    }
  };
  lauf(groupId);
  return out;
}

/** Die Ebenen, die die Kampagne ausdrücklich abschaltet (T-088). */
export function offLayers(campaign: Entity | null): Set<EntityId> {
  return new Set(kanten(campaign ?? undefined, ACTIVATES_RELATION).filter(isOffEdge).map((r) => r.to));
}

/** Die laufende Kampagne: die Einstellung, sonst die erste im Bestand, sonst keine. */
export function currentCampaign(
  entities: Map<EntityId, Entity>,
  settings?: Record<string, string> | null,
): Entity | null {
  const gesetzt = settings?.[CAMPAIGN_SETTING];
  if (gesetzt) {
    const e = entities.get(gesetzt);
    if (e && (e.interfaces ?? [])[0] === CAMPAIGN_TYPE) return e;
  }
  for (const e of entities.values()) if ((e.interfaces ?? [])[0] === CAMPAIGN_TYPE) return e;
  return null;
}

export interface StackEntry {
  layer: Entity;
  order: number;
  /** Was sie bringt (T-105); `null` heisst alles. */
  filter: LayerFilter | null;
}

/**
 * Die Ebenen, die die Kampagne **ausdrücklich** aufschaltet, von unten
 * nach oben — so, wie sie an ihren Kanten stehen und geschrieben werden.
 * Eine Gruppe steht hier als eine Ebene; was sie bringt, sagt
 * `resolvedStack`.
 */
export function activeStack(entities: Map<EntityId, Entity>, campaign: Entity | null): StackEntry[] {
  if (!campaign) return [];
  const out: StackEntry[] = [];
  for (const r of aufschalten(campaign)) {
    const layer = entities.get(r.to);
    if (!layer) continue;
    const anKante = (r.props as { order?: unknown } | undefined)?.order;
    const amLayer = (layer.components?.[LAYER_COMPONENT] as { order?: unknown } | undefined)?.order;
    const order =
      anKante != null && Number.isFinite(Number(anKante)) ? Number(anKante)
        : Number.isFinite(Number(amLayer)) && amLayer != null ? Number(amLayer) : 10;
    out.push({ layer, order, filter: filterOf(r) });
  }
  return out.sort((a, b) => a.order - b.order);
}

/**
 * **Der Stapel mit aufgelösten Gruppen** (T-088, E-022 b), von unten nach
 * oben: an der Stelle einer Gruppe die Gruppe selbst und darüber ihre
 * Mitglieder (verschachtelt, nach Erscheinen). Eine Ebene, die die
 * Kampagne selbst aufschaltet, steht nur an ihrer eigenen Stelle; eine,
 * die sie abschaltet (`mode: 'off'`), steht gar nicht da, und was nur
 * über sie käme, auch nicht. Bringen zwei Gruppen dieselbe Ebene, zählt
 * die höhere.
 *
 * Einmal je Anfrage: die Mitglieder werden einmal gesammelt
 * (`groupMembers`), danach ist jeder Schritt ein Nachschlagen (T-086).
 */
export function resolvedStack(
  entities: Map<EntityId, Entity>,
  campaign: Entity | null,
  members?: Map<EntityId, EntityId[]>,
): Entity[] {
  return resolvedEntries(entities, campaign, members).map((x) => x.layer);
}

/**
 * Wie `resolvedStack`, mit der Auswahl je Ebene (T-105): ein Mitglied
 * trägt die seiner Gruppe, eine ausdrücklich aufgeschaltete Ebene ihre
 * eigene.
 */
export function resolvedEntries(
  entities: Map<EntityId, Entity>,
  campaign: Entity | null,
  members?: Map<EntityId, EntityId[]>,
): { layer: Entity; filter: LayerFilter | null }[] {
  const stapel = activeStack(entities, campaign);
  if (!stapel.length) return [];
  const aus = offLayers(campaign);
  const ausdruecklich = new Set(stapel.map((x) => x.layer.id));
  const gruppen = stapel.some((x) => isGroupLayer(x.layer)) ? (members ?? groupMembers(entities)) : new Map<EntityId, EntityId[]>();
  /* Eine Map behält die Einfügereihenfolge; wer später (höher) noch
     einmal kommt, wird ans Ende gesetzt. */
  const rang = new Map<EntityId, { layer: Entity; filter: LayerFilter | null }>();
  const setze = (e: Entity, filter: LayerFilter | null) => {
    rang.delete(e.id);
    rang.set(e.id, { layer: e, filter });
  };
  for (const { layer, filter } of stapel) {
    if (aus.has(layer.id)) continue;
    setze(layer, filter);
    if (!isGroupLayer(layer)) continue;
    const gesehen = new Set<EntityId>([layer.id]);
    const lauf = (g: EntityId) => {
      for (const m of gruppen.get(g) ?? []) {
        if (gesehen.has(m) || aus.has(m)) continue;
        gesehen.add(m);
        const e = entities.get(m);
        if (!e) continue;
        /* Die ausdrückliche Kante schlägt die Gruppe: die Ebene steht an
           ihrer eigenen Stelle — ihre Mitglieder bringt sie dort selbst. */
        if (ausdruecklich.has(m)) continue;
        setze(e, filter);
        lauf(m);
      }
    };
    lauf(layer.id);
  }
  return [...rang.values()];
}

/**
 * **Die Vergleichsebenen der Kampagne** (T-092), in ihrer Reihenfolge an
 * der Kante. Eine Ebene, die schon im Spiel ist, ist hier nicht noch
 * einmal — sie vergleicht sich ohnehin.
 */
export function compareLayers(entities: Map<EntityId, Entity>, campaign: Entity | null): Entity[] {
  if (!campaign) return [];
  const imSpiel = new Set(aufschalten(campaign).map((r) => r.to));
  const order = (r: Rel) => Number((r.props as { order?: unknown } | undefined)?.order ?? 0) || 0;
  return kanten(campaign, ACTIVATES_RELATION)
    .filter((r) => isCompareEdge(r) && !imSpiel.has(r.to))
    .sort((a, b) => order(a) - order(b))
    .map((r) => entities.get(r.to))
    .filter((e): e is Entity => !!e);
}

/**
 * **Welche Ebenen überhaupt genannt werden** (T-207): was die Kampagne
 * aufschaltet, samt Gruppen und ihren Mitgliedern (`resolvedStack`), und —
 * wer sie sehen darf — ihre Vergleichsebenen. Eine Ebene, die nicht
 * aufgeschaltet ist, erscheint weder als Artikel noch als Fassung,
 * Filteroption oder Zählung; ein- und ausgeschaltet wird an der Kampagne.
 * `null` ohne Kampagne: dann gibt es keinen Stapel, und alles steht da.
 */
export function shownLayers(
  entities: Map<EntityId, Entity>,
  campaign: Entity | null,
  withCompare: boolean,
  members?: Map<EntityId, EntityId[]>,
): Set<EntityId> | null {
  if (!campaign) return null;
  const ids = new Set(resolvedStack(entities, campaign, members).map((l) => l.id));
  if (withCompare) for (const l of compareLayers(entities, campaign)) ids.add(l.id);
  return ids;
}

/** Die Auswahl je Vergleichsebene (T-105), wie an ihrer Kante. */
function compareFilters(campaign: Entity | null): Map<EntityId, LayerFilter | null> {
  return new Map(kanten(campaign ?? undefined, ACTIVATES_RELATION).filter(isCompareEdge).map((r) => [r.to, filterOf(r)]));
}

/** Ebenen-Id → Rang 1..n; höher heisst spezifischer. Gruppen sind aufgelöst (T-088). */
export function activeLayerRanks(entities: Map<EntityId, Entity>, campaign: Entity | null): Map<EntityId, number> {
  const m = new Map<EntityId, number>();
  resolvedStack(entities, campaign).forEach((l, i) => m.set(l.id, i + 1));
  return m;
}

/**
 * **Rang und Auswahl je Ebene**, einmal gerechnet (T-105): `zaehlt` sagt,
 * mit welchem Rang eine Ebenenkante dieses Artikels zählt — 0, wenn die
 * Ebene nicht im Spiel ist oder ihn nach ihrer Auswahl nicht bringt.
 */
function sicht(
  entities: Map<EntityId, Entity>,
  campaign: Entity | null,
  registry: Pick<Registry, 'interfaces'> | undefined,
): { rang: Map<EntityId, number>; filter: Map<EntityId, LayerFilter | null>; zaehlt: (e: Entity, layer: EntityId) => number } {
  const eintraege = resolvedEntries(entities, campaign);
  const rang = new Map<EntityId, number>();
  const filter = new Map<EntityId, LayerFilter | null>();
  eintraege.forEach((x, i) => {
    rang.set(x.layer.id, i + 1);
    filter.set(x.layer.id, x.filter);
  });
  const bereich = bereichVon(registry);
  const zaehlt = (e: Entity, layer: EntityId): number => {
    const x = rang.get(layer);
    if (!x) return 0;
    return passt(filter.get(layer), e, bereich) ? x : 0;
  };
  return { rang, filter, zaehlt };
}

/**
 * Steht dieser Artikel im Stapel? Ohne Ebenenkante: ja. Mit: nur, wenn eine
 * aufgeschaltete Ebene ihn bringt und keine spezifischere ihn herausnimmt.
 * Ohne irgendeine Kampagne: ja — es gibt nichts, wogegen man rechnen könnte.
 * Mit `registry` gilt die Bereichsauswahl der Ebenen (T-105).
 */
export function inStack(
  entities: Map<EntityId, Entity>,
  entity: Entity,
  campaign: Entity | null,
  registry?: Pick<Registry, 'interfaces'>,
): boolean {
  const ebenen = kanten(entity, LAYER_RELATION);
  if (!ebenen.length) return true;
  if (!campaign) return true;
  const { zaehlt } = sicht(entities, campaign, registry);
  let addAt = 0;
  let remAt = 0;
  for (const r of ebenen) {
    const x = zaehlt(entity, r.to);
    if (!x) continue;
    if ((r.props as { mode?: unknown } | undefined)?.mode === 'removes') remAt = Math.max(remAt, x);
    else addAt = Math.max(addAt, x);
  }
  if (!addAt && !remAt) return false;
  return addAt > remAt;
}

/**
 * Je Artikel, wer ihn über `overrides` überschreibt — einmal über den
 * Bestand gerechnet. Mit ihr fragt `overriderOf` nur die Kandidaten statt
 * jedes Artikels (T-108: mit 250 000 Artikeln und hundert Verweisen auf
 * einer Seite sonst zehn Sekunden).
 */
export function overridersIndex(entities: Iterable<Entity>): Map<EntityId, Entity[]> {
  const out = new Map<EntityId, Entity[]>();
  for (const o of entities) {
    for (const r of kanten(o, OVERRIDES_RELATION)) (out.get(r.to) ?? out.set(r.to, []).get(r.to)!).push(o);
  }
  return out;
}

/** Wer diesen Artikel überschreibt: die spezifischste aufgeschaltete Fassung, sonst niemand. */
export function overriderOf(
  entities: Map<EntityId, Entity>,
  id: EntityId,
  campaign: Entity | null,
  registry?: Pick<Registry, 'interfaces'>,
  index?: ReadonlyMap<EntityId, readonly Entity[]>,
): Entity | null {
  if (!campaign) return null;
  /* Ohne Kandidaten keine Rechnung: die Sicht liest alle Gruppen. */
  if (index && !index.get(id)?.length) return null;
  const { zaehlt } = sicht(entities, campaign, registry);
  let best: Entity | null = null;
  let bestRang = -1;
  for (const o of index ? (index.get(id) ?? []) : entities.values()) {
    if (!kanten(o, OVERRIDES_RELATION).some((r) => r.to === id)) continue;
    const r2 = Math.max(0, ...kanten(o, LAYER_RELATION).map((x) => zaehlt(o, x.to)));
    if (!r2) continue; /* Überschreibung ohne aufgeschaltete Ebene zählt nicht */
    if (r2 > bestRang) {
      bestRang = r2;
      best = o;
    }
  }
  return best;
}

export function isOverridden(
  entities: Map<EntityId, Entity>,
  entity: Entity,
  campaign: Entity | null,
  registry?: Pick<Registry, 'interfaces'>,
): boolean {
  return overriderOf(entities, entity.id, campaign, registry) !== null;
}

/** Was an dieser Stelle wirklich gilt: die Kette der Überschreibungen bis zum Ende, nicht im Kreis. */
export function resolveArticle(
  entities: Map<EntityId, Entity>,
  entity: Entity,
  campaign: Entity | null,
  registry?: Pick<Registry, 'interfaces'>,
  index?: ReadonlyMap<EntityId, readonly Entity[]>,
): Entity {
  let at = entity;
  const gesehen = new Set<EntityId>([entity.id]);
  for (let i = 0; i < 8; i += 1) {
    const next = overriderOf(entities, at.id, campaign, registry, index);
    if (!next || gesehen.has(next.id)) return at;
    gesehen.add(next.id);
    at = next;
  }
  return at;
}

/** Das Sieb, wie der Server es braucht: da und nicht überschrieben. */
export function inPlay(
  entities: Map<EntityId, Entity>,
  entity: Entity,
  campaign: Entity | null,
  registry?: Pick<Registry, 'interfaces'>,
): boolean {
  return inStack(entities, entity, campaign, registry) && !isOverridden(entities, entity, campaign, registry);
}

export interface PlayStack {
  /** Wie `inPlay`, ohne den Bestand je Artikel neu zu durchsuchen. */
  inPlay(entity: Entity): boolean;
  /** Wie `inStack`: da, auch wenn eine Fassung ihn überschreibt. */
  inStack(entity: Entity): boolean;
  /** Bringt eine Vergleichsebene ihn (T-092)? Nicht im Spiel, aber auf Wunsch sichtbar. */
  inCompare(entity: Entity): boolean;
  /** Der höchste Rang einer aufgeschalteten Ebene, die ihn bringt; 0 heisst keine. */
  rank(entity: Entity): number;
  /** Wie `unactivatedLayers`. */
  unactivated(entity: Entity): EntityId[];
  /**
   * Wie `resolveArticle`, mit den Überschreibern aus `overridersIndex` —
   * ohne die Sicht je Frage neu zu rechnen (T-108: eine Kapitelseite fragt
   * für jeden Verweis darin).
   */
  resolve(entity: Entity, index: ReadonlyMap<EntityId, readonly Entity[]>): Entity;
}

/**
 * **Der Stapel einmal gerechnet, für viele Artikel** (T-086, REQ-246).
 *
 * `inPlay` je Artikel fragt `overriderOf`, und das sucht im ganzen Bestand
 * nach einer Überschreibung — für eine Liste über alle Artikel also jeder
 * gegen jeden. Mit 21 576 Artikeln aus 5e.tools und einer Kampagne, die
 * ihre Bücher aufschaltet, waren das gut 35 Sekunden je Liste und je
 * Registerzählung; die Seite stand still. Hier stehen die Ränge der Ebenen
 * und die Ziele aller geltenden Überschreibungen einmal vorab, danach ist
 * jede Frage ein Nachschlagen. Gleiche Regeln wie oben: eine Überschreibung
 * zählt nur aus einer aufgeschalteten Ebene heraus.
 *
 * Mit `registry` gilt die Bereichsauswahl der Ebenen (T-105); der Bereich
 * einer Art wird einmal je Art nachgeschlagen, nicht je Artikel.
 */
export function playStack(
  entities: Map<EntityId, Entity>,
  campaign: Entity | null,
  registry?: Pick<Registry, 'interfaces'>,
): PlayStack {
  if (!campaign) {
    return { inPlay: () => true, inStack: () => true, inCompare: () => false, rank: () => 0, unactivated: () => [], resolve: (e) => e };
  }
  const { rang, zaehlt } = sicht(entities, campaign, registry);
  const bereich = bereichVon(registry);
  const vergleichAuswahl = compareFilters(campaign);
  const vergleich = new Map<EntityId, LayerFilter | null>(
    compareLayers(entities, campaign).map((l) => [l.id, vergleichAuswahl.get(l.id) ?? null]),
  );
  /* Eine Gruppe zum Vergleich vergleicht ihre Mitglieder (T-088), soweit
     sie nicht ohnehin im Spiel sind — mit ihrer Auswahl (T-105). */
  if ([...vergleich.keys()].some((id) => isGroupLayer(entities.get(id)))) {
    const gruppen = groupMembers(entities);
    for (const [id, f] of [...vergleich]) {
      for (const m of layersInGroup(entities, id, gruppen)) if (!rang.has(m) && !vergleich.has(m)) vergleich.set(m, f);
    }
  }
  const ueberschrieben = new Set<EntityId>();
  for (const o of entities.values()) {
    const ziele = kanten(o, OVERRIDES_RELATION);
    if (!ziele.length) continue;
    if (!kanten(o, LAYER_RELATION).some((x) => zaehlt(o, x.to) > 0)) continue;
    for (const r of ziele) ueberschrieben.add(r.to);
  }
  const imStapel = (entity: Entity): boolean => {
    const ebenen = kanten(entity, LAYER_RELATION);
    if (!ebenen.length) return true;
    let addAt = 0;
    let remAt = 0;
    for (const r of ebenen) {
      const x = zaehlt(entity, r.to);
      if (!x) continue;
      if ((r.props as { mode?: unknown } | undefined)?.mode === 'removes') remAt = Math.max(remAt, x);
      else addAt = Math.max(addAt, x);
    }
    return addAt > remAt;
  };
  return {
    inPlay: (entity) => imStapel(entity) && !ueberschrieben.has(entity.id),
    inStack: imStapel,
    inCompare: (entity) =>
      vergleich.size > 0 &&
      kanten(entity, LAYER_RELATION).some(
        (r) =>
          vergleich.has(r.to) &&
          (r.props as { mode?: unknown } | undefined)?.mode !== 'removes' &&
          passt(vergleich.get(r.to), entity, bereich),
      ),
    rank: (entity) => {
      let best = 0;
      for (const r of kanten(entity, LAYER_RELATION)) {
        if ((r.props as { mode?: unknown } | undefined)?.mode === 'removes') continue;
        best = Math.max(best, zaehlt(entity, r.to));
      }
      return best;
    },
    unactivated: (entity) => {
      const ebenen = kanten(entity, LAYER_RELATION);
      if (!ebenen.length || ebenen.some((r) => rang.has(r.to))) return [];
      const bringen = ebenen.filter((r) => (r.props as { mode?: unknown } | undefined)?.mode !== 'removes');
      return [...new Set(bringen.map((r) => r.to))];
    },
    resolve: (entity, index) => {
      /* Dieselbe Regel wie `overriderOf`: die Fassung aus der höchsten
         aufgeschalteten Ebene, die Kette entlang, nicht im Kreis. */
      let at = entity;
      const gesehen = new Set<EntityId>([entity.id]);
      for (let i = 0; i < 8; i += 1) {
        let best: Entity | null = null;
        let bestRang = 0;
        for (const o of index.get(at.id) ?? []) {
          const r2 = Math.max(0, ...kanten(o, LAYER_RELATION).map((x) => zaehlt(o, x.to)));
          if (r2 > bestRang) {
            bestRang = r2;
            best = o;
          }
        }
        if (!best || gesehen.has(best.id)) return at;
        gesehen.add(best.id);
        at = best;
      }
      return at;
    },
  };
}

/**
 * **Die Ebene, die dieser Kampagne gehört** (REQ-237): die spezifischste
 * aufgeschaltete Ebene, die keine andere Kampagne aufschaltet. Dorthin legt
 * der Server, was Spielende anlegen — so gehört der Artikel der Runde, in
 * der er entstand, und deren Leitung sieht ihn (`campaignOf`). Gibt es
 * keine solche Ebene, `null`: der Artikel liegt dann in keiner, wie heute
 * die meisten.
 *
 * **Eine Ebene, die einem Konto gehört, ist nicht die der Kampagne**
 * (T-098, E-001): schaltet die Leitung die eigene Ebene einer Spielerin
 * auf, wird sie dadurch nicht zur Kampagnenebene — sonst schrieben `gm`
 * und `co-gm` darin, und was andere anlegen, landete dort. Wem eine Ebene
 * gehört, steht am Server neben dem Konto; der Aufrufer gibt diese Ebenen
 * als `owned` mit.
 */
export function campaignLayer(
  entities: Map<EntityId, Entity>,
  campaign: Entity | null,
  owned?: ReadonlySet<EntityId>,
): Entity | null {
  if (!campaign) return null;
  const stapel = activeStack(entities, campaign);
  for (let i = stapel.length - 1; i >= 0; i -= 1) {
    const ebene = stapel[i]!.layer;
    /* Eine Gruppe ist kein Ort für Artikel (T-088). */
    if (isGroupLayer(ebene)) continue;
    if (owned?.has(ebene.id)) continue;
    let andere = false;
    for (const e of entities.values()) {
      if (e.id === campaign.id || (e.interfaces ?? [])[0] !== CAMPAIGN_TYPE) continue;
      if (aufschalten(e).some((r) => r.to === ebene.id)) {
        andere = true;
        break;
      }
    }
    if (!andere) return ebene;
  }
  return null;
}

/**
 * **Fehlt der Artikel nur, weil seine Ebene nicht aufgeschaltet ist?**
 * (T-069) Dann die Ebenen, die ihn brächten; sonst eine leere Liste.
 *
 * Auf dev verschwanden nach dem Anlegen einer Kampagne alle Artikel aus
 * 5e.tools, ohne dass die Seite sagte, warum: die Kampagne schaltete ihre
 * Ebene nicht auf. Nimmt eine aufgeschaltete Ebene den Artikel heraus
 * oder überschreibt ihn eine Fassung, ist das Absicht und zählt hier
 * nicht — nur, was gar keine aufgeschaltete Ebene nennt.
 */
export function unactivatedLayers(
  entities: Map<EntityId, Entity>,
  entity: Entity,
  campaign: Entity | null,
): EntityId[] {
  if (!campaign) return [];
  const ebenen = kanten(entity, LAYER_RELATION);
  if (!ebenen.length) return [];
  const rang = activeLayerRanks(entities, campaign);
  if (ebenen.some((r) => rang.has(r.to))) return [];
  const bringen = ebenen.filter((r) => (r.props as { mode?: unknown } | undefined)?.mode !== 'removes');
  return [...new Set(bringen.map((r) => r.to))];
}

/**
 * **Die Kampagnen, die eine Ebene aufschalten.** Genau eine heisst: die
 * Ebene gehört ihr (`campaignsOf`). Wer sie dann in einer zweiten
 * aufschaltet, macht sie gemeinsam — und die Leitung der zweiten sähe,
 * was in der ersten nur deren Leitung sieht.
 */
export function campaignsActivating(
  entities: Map<EntityId, Entity>,
  layerId: EntityId,
  index?: ReadonlyMap<EntityId, readonly EntityId[]>,
): EntityId[] {
  return [...(index ?? activatingIndex(entities)).get(layerId) ?? []];
}

/**
 * **Ebene → die Kampagnen, die sie aufschalten**, einmal gerechnet
 * (T-143). `campaignsActivating` je Ebene lief jedes Mal über den ganzen
 * Bestand — für die Ebenenseite mit 174 Ebenen und einer Viertelmillion
 * Artikel gut eine Sekunde je Abruf. Wer viele Ebenen fragt, rechnet die
 * Tafel einmal und gibt sie mit.
 */
export function activatingIndex(entities: Map<EntityId, Entity>): Map<EntityId, EntityId[]> {
  const out = new Map<EntityId, EntityId[]>();
  for (const e of entities.values()) {
    if ((e.interfaces ?? [])[0] !== CAMPAIGN_TYPE) continue;
    /* Wer nur vergleicht, schaltet nicht auf (T-092): die Ebene bleibt, wem sie gehört. */
    for (const r of aufschalten(e)) {
      const l = out.get(r.to) ?? out.set(r.to, []).get(r.to)!;
      if (!l.includes(e.id)) l.push(e.id);
    }
  }
  return out;
}

/**
 * Die Kanten `activates` einer Kampagne neu, von unten nach oben
 * (T-069): `props.order` zählt in Zehnern, damit die Reihenfolge an der
 * Kante steht und nicht an der Spezifität der Ebene hängt. Die übrigen
 * Kanten bleiben, wie sie sind.
 */
export function withStack(campaign: Entity, layerIds: readonly EntityId[]): Entity {
  const alt = aufschalten(campaign);
  const ins = new Set(layerIds);
  /* Die Vergleiche und Abschaltungen bleiben stehen (T-092, T-088) —
     ausser für eine Ebene, die jetzt ausdrücklich im Spiel ist: die
     vergleicht sich ohnehin, und ihre Kante schlägt jede Abschaltung. */
  const andere = (campaign.relations ?? []).filter(
    (r) => r.type !== ACTIVATES_RELATION || ((isCompareEdge(r) || isOffEdge(r)) && !ins.has(r.to)),
  );
  const neu: Rel[] = [...new Set(layerIds)].map((to, i) => ({
    /* Eine Kante, die bleibt, behält ihre Id. */
    id: alt.find((r) => r.to === to)?.id ?? `${ACTIVATES_RELATION}-${to}`,
    type: ACTIVATES_RELATION,
    to,
    props: { ...(alt.find((r) => r.to === to)?.props ?? {}), order: (i + 1) * 10 },
  }));
  return { ...campaign, relations: [...andere, ...neu] };
}

/**
 * Die Vergleichsebenen einer Kampagne neu (T-092): je Ebene eine Kante
 * `activates` mit `mode: 'compare'`, in dieser Reihenfolge. Eine Ebene, die
 * im Spiel ist, wird nicht noch einmal zum Vergleich; die übrigen Kanten
 * bleiben, wie sie sind.
 */
export function withCompare(campaign: Entity, layerIds: readonly EntityId[]): Entity {
  const imSpiel = new Set(aufschalten(campaign).map((r) => r.to));
  const alt = kanten(campaign, ACTIVATES_RELATION).filter(isCompareEdge);
  const andere = (campaign.relations ?? []).filter((r) => !isCompareEdge(r));
  const neu: Rel[] = [...new Set(layerIds)]
    .filter((to) => !imSpiel.has(to))
    .map((to, i) => ({
      id: alt.find((r) => r.to === to)?.id ?? `${ACTIVATES_RELATION}-${COMPARE_MODE}-${to}`,
      type: ACTIVATES_RELATION,
      to,
      /* Die Auswahl (T-105) bleibt an der Kante. */
      props: { ...auswahlVon(alt.find((r) => r.to === to)), mode: COMPARE_MODE, order: (i + 1) * 10 },
    }));
  return { ...campaign, relations: [...andere, ...neu] };
}

const auswahlVon = (r: Rel | undefined): Record<string, unknown> => {
  const f = filterOf(r);
  return f ? { ...f } : {};
};

/**
 * **Die Auswahl einer Ebene setzen** (T-105, REQ-255): an der Kante
 * `activates`, die sie aufschaltet oder zum Vergleich nennt. `null` heisst
 * wieder alles. Ohne solche Kante `null` zurück — eine Ebene, die nur über
 * ihre Gruppe kommt, trägt deren Auswahl.
 */
export function withFilter(campaign: Entity, layerId: EntityId, filter: LayerFilter | null): Entity | null {
  const kante = kanten(campaign, ACTIVATES_RELATION).find((r) => r.to === layerId && !isOffEdge(r));
  if (!kante) return null;
  const { areas: _a, types: _t, ...rest } = (kante.props ?? {}) as Record<string, unknown>;
  const props = {
    ...rest,
    ...(filter?.areas ? { areas: [...new Set(filter.areas)] } : {}),
    ...(filter?.types ? { types: [...new Set(filter.types)] } : {}),
  };
  return {
    ...campaign,
    relations: (campaign.relations ?? []).map((r) => (r === kante ? { ...r, props } : r)),
  };
}

/**
 * Die abgeschalteten Ebenen einer Kampagne neu (T-088): je Ebene eine
 * Kante `activates` mit `mode: 'off'` — „die Gruppe ist an, dieses Buch
 * darin nicht". Eine Ebene, die die Kampagne ausdrücklich aufschaltet,
 * wird nicht zugleich abgeschaltet; die übrigen Kanten bleiben.
 */
export function withOff(campaign: Entity, layerIds: readonly EntityId[]): Entity {
  const imSpiel = new Set(aufschalten(campaign).map((r) => r.to));
  const alt = kanten(campaign, ACTIVATES_RELATION).filter(isOffEdge);
  const andere = (campaign.relations ?? []).filter((r) => !isOffEdge(r));
  const neu: Rel[] = [...new Set(layerIds)]
    .filter((to) => !imSpiel.has(to))
    .map((to) => ({
      id: alt.find((r) => r.to === to)?.id ?? `${ACTIVATES_RELATION}-${OFF_MODE}-${to}`,
      type: ACTIVATES_RELATION,
      to,
      props: { mode: OFF_MODE },
    }));
  return { ...campaign, relations: [...andere, ...neu] };
}

/**
 * **Eine ganze Gruppe an oder aus** (T-185): das Häkchen an einer Gruppe
 * schaltet alle ihre Ebenen, verschachtelt — und stellt keine alte
 * Teilwahl wieder her. Die Leitung schaltete eine Gruppe aus und wieder
 * an und hatte danach die Bücher wieder, die sie vorher einzeln gewählt
 * hatte; eine Teilwahl gibt es nur über die Häkchen am Buch.
 *
 * - **an:** die Gruppe kommt in den Stapel (an die Stelle, die ihre
 *   Spezifität sagt, wie `POST …/layers/:layer`), und keine Ebene darin
 *   bleibt abgeschaltet;
 * - **aus:** die Gruppe und jede Ebene darin gehen aus dem Stapel. Bringt
 *   eine andere aufgeschaltete Gruppe eine davon trotzdem, wird sie dort
 *   abgeschaltet (`off`) — „aus" heisst aus, nicht „nur nicht über diese
 *   Gruppe". Bleibt in einer solchen Gruppe nichts an, geht sie mit.
 *
 * Zurück kommen der neue Stapel (von unten nach oben) und die neue Liste
 * der Abschaltungen, so wie `PUT /api/campaigns/:c/layers` sie nimmt.
 */
export function groupSwitched(
  entities: Map<EntityId, Entity>,
  campaign: Entity,
  groupId: EntityId,
  on: boolean,
  members: Map<EntityId, EntityId[]> = groupMembers(entities),
): { layers: EntityId[]; off: EntityId[] } {
  const stapel = activeStack(entities, campaign);
  const darin = new Set([groupId, ...layersInGroup(entities, groupId, members)]);
  const aus = [...offLayers(campaign)].filter((id) => !darin.has(id));
  if (on) {
    const ids = stapel.map((x) => x.layer.id);
    if (!ids.includes(groupId)) {
      const spez = (e: Entity | undefined) => {
        const o = (e?.components?.[LAYER_COMPONENT] as { order?: unknown } | undefined)?.order;
        return o != null && Number.isFinite(Number(o)) ? Number(o) : 10;
      };
      const eigene = spez(entities.get(groupId));
      const bei = stapel.findIndex((x) => spez(x.layer) > eigene);
      ids.splice(bei < 0 ? ids.length : bei, 0, groupId);
    }
    return { layers: ids, off: aus };
  }
  const layers = stapel.map((x) => x.layer.id).filter((id) => !darin.has(id));
  /* Was eine andere Gruppe noch brächte, wird abgeschaltet — einmal
     gerechnet genügt, denn eine Abschaltung nimmt nur weg. */
  const probe = withOff(withStack(campaign, layers), aus);
  const noch = resolvedStack(entities, probe, members).filter((e) => darin.has(e.id));
  const off = [...aus, ...noch.map((e) => e.id)];
  /* Eine andere Gruppe, in der danach nichts mehr an ist, geht mit aus dem
     Stapel — sonst stünde sie als leere Gruppe da, die nichts bringt. Ihre
     Abschaltungen bleiben: sie gelten für jede Gruppe, die das Buch bringt. */
  const aus2 = new Set(off);
  const leer = (g: EntityId) => {
    const innen = layersInGroup(entities, g, members).filter((id) => !isGroupLayer(entities.get(id)));
    return innen.length > 0 && innen.every((id) => aus2.has(id));
  };
  return { layers: layers.filter((id) => !isGroupLayer(entities.get(id)) || !leer(id)), off };
}

/**
 * **Was diese Fassung ersetzt** (E-018, T-082): die Artikel, auf die sie
 * über `overrides` zeigt, und deren Originale — die ganze Kette zurück,
 * nicht im Kreis. Wer auf das Original zeigt, zeigt in einer Kampagne mit
 * dieser Fassung auf sie; die Rückbezüge der Fassung fragen darum auch
 * nach diesen.
 */
export function replacedIds(entities: Map<EntityId, Entity>, entity: Entity): EntityId[] {
  const out: EntityId[] = [];
  const gesehen = new Set<EntityId>([entity.id]);
  let at: Entity | undefined = entity;
  for (let i = 0; i < 8 && at; i += 1) {
    const ziel: EntityId | undefined = kanten(at, OVERRIDES_RELATION)[0]?.to;
    if (!ziel || gesehen.has(ziel)) break;
    gesehen.add(ziel);
    out.push(ziel);
    at = entities.get(ziel);
  }
  return out;
}

/** Kanten, die zum Original als Artikel gehören und an der Fassung neu entstehen. */
const NICHT_MIT = new Set([LAYER_RELATION, OVERRIDES_RELATION, 'instanceOf', 'variantOf']);

/**
 * **Eine Fassung über der Vorlage** (E-018 a, T-082): ein neuer Artikel
 * derselben Art mit denselben Karten und Kanten, der in der Ebene der
 * Kampagne liegt und das Original über `overrides` ersetzt — solange diese
 * Ebene aufgeschaltet ist (E2). Das Original bleibt, wie es ist; zurück
 * heisst, die Fassung zu löschen.
 *
 * Die Kanten gehen mit (die Szene bleibt Teil ihres Kapitels, die
 * Begegnung behält ihre Teilnehmer), ausser denen, die zum Original als
 * Artikel gehören: Ebene, Überschreibung, Vorlage, Variante. Die Nummer
 * vergibt der Aufrufer (`nextId`) — eine Fassung ist ein eigener Artikel.
 */
export function adaptedVersion(
  original: Entity,
  neu: { id: EntityId; number: string; layer: EntityId },
): Entity {
  /* Eine Kopie über JSON: das Modell kennt kein `structuredClone` (keine
     Laufzeitbibliothek), und Karten sind ohnehin JSON. */
  const kopie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  const components = kopie(original.components ?? {});
  components['Identity'] = { ...(components['Identity'] ?? {}), id: neu.number };
  const mit = (original.relations ?? []).filter((r) => !NICHT_MIT.has(r.type));
  const relations: Rel[] = [
    ...mit.map((r, i) => ({ ...kopie(r), id: `${neu.id}~${r.type}-${i + 1}` })),
    { id: `${neu.id}~${LAYER_RELATION}`, type: LAYER_RELATION, to: neu.layer, props: {} },
    { id: `${neu.id}~${OVERRIDES_RELATION}`, type: OVERRIDES_RELATION, to: original.id, props: {} },
  ];
  return { id: neu.id, interfaces: [...(original.interfaces ?? [])], name: original.name, components, relations };
}

/** Die Kanten, über die ein Teil an seinem Ganzen hängt: Szene am Kapitel, Karte an der Szene. */
export const TAKE_EDGES: readonly string[] = ['partOf', 'mapOf'];

/**
 * **Was „in die Geschichte holen" mitnimmt** (E-026, REQ-252): der Artikel und alles,
 * was über `partOf` oder `mapOf` an ihm hängt, in jeder Tiefe — ein
 * Kapitel mit seinen Szenen, deren Räumen, Begegnungen und Karten. Gezählt
 * wird nur, was in dieser Kampagne im Stapel steht (`inStack`), nicht
 * schon in der Zielebene liegt und selbst keine Fassung ist: die Fassung
 * eines Teils ersetzt ihr Original, und genommen wird das Original. Zuerst
 * der Artikel selbst, dann die Teile in der Reihenfolge, in der sie
 * gefunden werden.
 */
export function takenWith(
  entities: Map<EntityId, Entity>,
  root: Entity,
  campaign: Entity | null,
  targetLayer: EntityId,
  registry?: Pick<Registry, 'interfaces'>,
): Entity[] {
  const teile = new Map<EntityId, Entity[]>();
  for (const e of entities.values()) {
    for (const r of e.relations ?? []) {
      if (!TAKE_EDGES.includes(r.type)) continue;
      (teile.get(r.to) ?? teile.set(r.to, []).get(r.to)!).push(e);
    }
  }
  const mit = (e: Entity) =>
    inStack(entities, e, campaign, registry) && !kanten(e, LAYER_RELATION).some((r) => r.to === targetLayer) && !kanten(e, OVERRIDES_RELATION).length;
  const out: Entity[] = [root];
  const gesehen = new Set<EntityId>([root.id]);
  for (let i = 0; i < out.length; i += 1) {
    for (const t of teile.get(out[i]!.id) ?? []) {
      if (gesehen.has(t.id) || !mit(t)) continue;
      gesehen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

/**
 * **Eine geholte Fassung umhängen** (E-026): ihre `partOf`/`mapOf`, die
 * auf ein mitgenommenes Original zeigen, zeigen danach auf dessen Fassung
 * (`mapping`: Original → Fassung) — sonst hinge die Szene der Fassung am
 * Kapitel, das diese Kampagne gar nicht mehr sieht. Mit `into` hängt der
 * Artikel selbst danach nur noch dort (`partOf`), am Arc oder an der
 * Kampagne, wohin die Leitung ihn holt — mit `rank` an der Stelle, die
 * der Aufrufer ihm dort gibt (T-108).
 */
export function rehang(fassung: Entity, mapping: ReadonlyMap<EntityId, EntityId>, into?: EntityId, rank?: number): Entity {
  let relations = (fassung.relations ?? []).map((r) =>
    TAKE_EDGES.includes(r.type) && mapping.has(r.to) ? { ...r, to: mapping.get(r.to)! } : r,
  );
  if (into) {
    relations = relations.filter((r) => r.type !== 'partOf');
    /* Ein Teil eines Buchs (T-108) bekommt seinen Platz im Ziel: hinter
       dem, was dort schon steht (`rank`). */
    relations.push({ id: `${fassung.id}~partOf-into`, type: 'partOf', to: into, props: rank === undefined ? {} : { rank } });
  }
  return { ...fassung, relations };
}
