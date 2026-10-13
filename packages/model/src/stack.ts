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
 */

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
/** Die Einstellung, die sagt, welche Kampagne läuft. */
export const CAMPAIGN_SETTING = 'campaign';

type Rel = NonNullable<Entity['relations']>[number];

const kanten = (e: Entity | undefined, type: string): Rel[] =>
  (e?.relations ?? []).filter((r) => r.type === type);

/** Ist diese Kante `activates` nur ein Vergleich (T-092)? */
export const isCompareEdge = (r: { type: string; props?: unknown }): boolean =>
  r.type === ACTIVATES_RELATION && (r.props as { mode?: unknown } | undefined)?.mode === COMPARE_MODE;

/** Die Kanten, die eine Ebene wirklich aufschalten — ohne die Vergleiche. */
const aufschalten = (e: Entity | undefined): Rel[] => kanten(e, ACTIVATES_RELATION).filter((r) => !isCompareEdge(r));

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

/** Die aufgeschalteten Ebenen der Kampagne, von unten nach oben. */
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

/** Ebenen-Id → Rang 1..n; höher heisst spezifischer. */
export function activeLayerRanks(entities: Map<EntityId, Entity>, campaign: Entity | null): Map<EntityId, number> {
  const m = new Map<EntityId, number>();
  activeStack(entities, campaign).forEach((x, i) => m.set(x.layer.id, i + 1));
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
  /* Die Vergleiche bleiben stehen (T-092) — ausser für eine Ebene, die
     jetzt im Spiel ist: die vergleicht sich ohnehin. */
  const andere = (campaign.relations ?? []).filter(
    (r) => r.type !== ACTIVATES_RELATION || (isCompareEdge(r) && !ins.has(r.to)),
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
