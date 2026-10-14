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
 */

import { entityName } from './entity.js';
import type { Entity, EntityId } from './types.js';
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

/** Was eine Ebene ist, die in keiner Herausgeber-Gruppe steht: eigener Inhalt (T-094). */
export const HOMEBREW = 'Homebrew';

/**
 * **Der Herausgeber einer Ebene** (T-094, REQ-249) — gerechnet, nicht
 * gespeichert (D8): die Namen der Herausgeber-Gruppen, an denen sie mit
 * `partOf` hängt, sonst „Homebrew". Eine Gruppe hat keinen. Ein zweites
 * Feld `publisher` neben der Gruppe wäre die zweite Stelle, die beim
 * ersten Umhängen falsch steht.
 */
export function publisherOf(entities: Map<EntityId, Entity>, layer: Entity | undefined): string {
  if (!layer || isGroupLayer(layer)) return '';
  const namen = kanten(layer, GROUP_RELATION)
    .map((r) => entities.get(r.to))
    .filter((g): g is Entity => isGroupLayer(g) && groupingOf(g) === PUBLISHER_GROUPING)
    .map((g) => entityName(g));
  return namen.length ? [...new Set(namen)].join(' / ') : HOMEBREW;
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
    out.push({ layer, order });
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
  const stapel = activeStack(entities, campaign);
  if (!stapel.length) return [];
  const aus = offLayers(campaign);
  const ausdruecklich = new Set(stapel.map((x) => x.layer.id));
  const gruppen = stapel.some((x) => isGroupLayer(x.layer)) ? (members ?? groupMembers(entities)) : new Map<EntityId, EntityId[]>();
  /* Eine Map behält die Einfügereihenfolge; wer später (höher) noch
     einmal kommt, wird ans Ende gesetzt. */
  const rang = new Map<EntityId, Entity>();
  const setze = (e: Entity) => {
    rang.delete(e.id);
    rang.set(e.id, e);
  };
  for (const { layer } of stapel) {
    if (aus.has(layer.id)) continue;
    setze(layer);
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
        setze(e);
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

/** Ebenen-Id → Rang 1..n; höher heisst spezifischer. Gruppen sind aufgelöst (T-088). */
export function activeLayerRanks(entities: Map<EntityId, Entity>, campaign: Entity | null): Map<EntityId, number> {
  const m = new Map<EntityId, number>();
  resolvedStack(entities, campaign).forEach((l, i) => m.set(l.id, i + 1));
  return m;
}

/**
 * Steht dieser Artikel im Stapel? Ohne Ebenenkante: ja. Mit: nur, wenn eine
 * aufgeschaltete Ebene ihn bringt und keine spezifischere ihn herausnimmt.
 * Ohne irgendeine Kampagne: ja — es gibt nichts, wogegen man rechnen könnte.
 */
export function inStack(entities: Map<EntityId, Entity>, entity: Entity, campaign: Entity | null): boolean {
  const ebenen = kanten(entity, LAYER_RELATION);
  if (!ebenen.length) return true;
  if (!campaign) return true;
  const rang = activeLayerRanks(entities, campaign);
  let addAt = 0;
  let remAt = 0;
  for (const r of ebenen) {
    const x = rang.get(r.to);
    if (!x) continue;
    if ((r.props as { mode?: unknown } | undefined)?.mode === 'removes') remAt = Math.max(remAt, x);
    else addAt = Math.max(addAt, x);
  }
  if (!addAt && !remAt) return false;
  return addAt > remAt;
}

/** Wer diesen Artikel überschreibt: die spezifischste aufgeschaltete Fassung, sonst niemand. */
export function overriderOf(entities: Map<EntityId, Entity>, id: EntityId, campaign: Entity | null): Entity | null {
  if (!campaign) return null;
  const rang = activeLayerRanks(entities, campaign);
  let best: Entity | null = null;
  let bestRang = -1;
  for (const o of entities.values()) {
    if (!kanten(o, OVERRIDES_RELATION).some((r) => r.to === id)) continue;
    const r2 = Math.max(0, ...kanten(o, LAYER_RELATION).map((x) => rang.get(x.to) ?? 0));
    if (!r2) continue; /* Überschreibung ohne aufgeschaltete Ebene zählt nicht */
    if (r2 > bestRang) {
      bestRang = r2;
      best = o;
    }
  }
  return best;
}

export function isOverridden(entities: Map<EntityId, Entity>, entity: Entity, campaign: Entity | null): boolean {
  return overriderOf(entities, entity.id, campaign) !== null;
}

/** Was an dieser Stelle wirklich gilt: die Kette der Überschreibungen bis zum Ende, nicht im Kreis. */
export function resolveArticle(entities: Map<EntityId, Entity>, entity: Entity, campaign: Entity | null): Entity {
  let at = entity;
  const gesehen = new Set<EntityId>([entity.id]);
  for (let i = 0; i < 8; i += 1) {
    const next = overriderOf(entities, at.id, campaign);
    if (!next || gesehen.has(next.id)) return at;
    gesehen.add(next.id);
    at = next;
  }
  return at;
}

/** Das Sieb, wie der Server es braucht: da und nicht überschrieben. */
export function inPlay(entities: Map<EntityId, Entity>, entity: Entity, campaign: Entity | null): boolean {
  return inStack(entities, entity, campaign) && !isOverridden(entities, entity, campaign);
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
 */
export function playStack(entities: Map<EntityId, Entity>, campaign: Entity | null): PlayStack {
  if (!campaign) {
    return { inPlay: () => true, inStack: () => true, inCompare: () => false, rank: () => 0, unactivated: () => [] };
  }
  const rang = activeLayerRanks(entities, campaign);
  const vergleich = new Set(compareLayers(entities, campaign).map((l) => l.id));
  /* Eine Gruppe zum Vergleich vergleicht ihre Mitglieder (T-088), soweit
     sie nicht ohnehin im Spiel sind. */
  if ([...vergleich].some((id) => isGroupLayer(entities.get(id)))) {
    const gruppen = groupMembers(entities);
    for (const id of [...vergleich]) {
      for (const m of layersInGroup(entities, id, gruppen)) if (!rang.has(m)) vergleich.add(m);
    }
  }
  const ueberschrieben = new Set<EntityId>();
  for (const o of entities.values()) {
    const ziele = kanten(o, OVERRIDES_RELATION);
    if (!ziele.length) continue;
    if (!kanten(o, LAYER_RELATION).some((x) => (rang.get(x.to) ?? 0) > 0)) continue;
    for (const r of ziele) ueberschrieben.add(r.to);
  }
  const imStapel = (entity: Entity): boolean => {
    const ebenen = kanten(entity, LAYER_RELATION);
    if (!ebenen.length) return true;
    let addAt = 0;
    let remAt = 0;
    for (const r of ebenen) {
      const x = rang.get(r.to);
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
        (r) => vergleich.has(r.to) && (r.props as { mode?: unknown } | undefined)?.mode !== 'removes',
      ),
    rank: (entity) => {
      let best = 0;
      for (const r of kanten(entity, LAYER_RELATION)) {
        if ((r.props as { mode?: unknown } | undefined)?.mode === 'removes') continue;
        best = Math.max(best, rang.get(r.to) ?? 0);
      }
      return best;
    },
    unactivated: (entity) => {
      const ebenen = kanten(entity, LAYER_RELATION);
      if (!ebenen.length || ebenen.some((r) => rang.has(r.to))) return [];
      const bringen = ebenen.filter((r) => (r.props as { mode?: unknown } | undefined)?.mode !== 'removes');
      return [...new Set(bringen.map((r) => r.to))];
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
 */
export function campaignLayer(entities: Map<EntityId, Entity>, campaign: Entity | null): Entity | null {
  if (!campaign) return null;
  const stapel = activeStack(entities, campaign);
  for (let i = stapel.length - 1; i >= 0; i -= 1) {
    const ebene = stapel[i]!.layer;
    /* Eine Gruppe ist kein Ort für Artikel (T-088). */
    if (isGroupLayer(ebene)) continue;
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
export function campaignsActivating(entities: Map<EntityId, Entity>, layerId: EntityId): EntityId[] {
  const out: EntityId[] = [];
  for (const e of entities.values()) {
    if ((e.interfaces ?? [])[0] !== CAMPAIGN_TYPE) continue;
    /* Wer nur vergleicht, schaltet nicht auf (T-092): die Ebene bleibt, wem sie gehört. */
    if (aufschalten(e).some((r) => r.to === layerId)) out.push(e.id);
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
      props: { mode: COMPARE_MODE, order: (i + 1) * 10 },
    }));
  return { ...campaign, relations: [...andere, ...neu] };
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
