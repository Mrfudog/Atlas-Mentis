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
export const LAYER_COMPONENT = 'Layer';
/** Die Einstellung, die sagt, welche Kampagne läuft. */
export const CAMPAIGN_SETTING = 'campaign';

type Rel = NonNullable<Entity['relations']>[number];

const kanten = (e: Entity | undefined, type: string): Rel[] =>
  (e?.relations ?? []).filter((r) => r.type === type);

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
  for (const r of kanten(campaign, ACTIVATES_RELATION)) {
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
