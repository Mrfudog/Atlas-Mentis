/**
 * **Kampagne und Ebenen je Konto** (REQ-408, REQ-412, T-496).
 *
 * Bis hierher war die laufende Kampagne eine Einstellung der Installation
 * (`settings.campaign`): wechselte die Verwaltung, wechselten alle. Jetzt
 * wählt jedes Konto selbst, in welcher seiner Kampagnen es gerade ist
 * (`chosenCampaign`), und die Einstellung ist nur noch die Vorgabe für
 * Konten ohne Wahl.
 *
 * Dazu der **Globalfilter** mit zwei Ansichten (`LayerView`):
 *
 * - **Campaign view** — der Stapel der Kampagne, für mich enger gefiltert
 *   (`off`: Ebenen und Gruppenmitglieder, die ich nicht sehen will). Die
 *   Kampagne selbst ändert sich dabei nicht; „Reset“ heisst: keine Sicht.
 * - **My view** — eine eigene Zusammenstellung lesbarer Ebenen (`layers`),
 *   deutlich ausserhalb der Kampagne.
 *
 * Beides wirkt, indem die Kampagne **für diesen Betrachter** mit einem
 * anderen Stapel gelesen wird (`viewedCampaign`): jede Rechnung, die den
 * Stapel aus der Kampagne liest — Liste, Suche, Board, Sieb —, folgt so
 * ohne eigene Stelle. Die Ebene der Kampagne bleibt immer an: in ihr liegt
 * die Kampagne selbst, und dort legt die Leitung an. Wem eine Ebene gehört
 * (`campaignsOf`), rechnet weiter der Bestand, nicht die Sicht.
 */

import type { Entity, EntityId } from './types.js';
import {
  activeStack,
  activatesId,
  campaignLayer,
  currentCampaign,
  isCompareEdge,
  isOffEdge,
  LAYER_COMPONENT,
  withOff,
} from './stack.js';
import { ACTIVATES_RELATION, CAMPAIGN_TYPE } from './visibility.js';

type Rel = NonNullable<Entity['relations']>[number];

/** Einstellung am Konto: die gewählte Kampagne (`/api/me/campaign`). */
export const CAMPAIGN_PREF = 'campaign';
/** Einstellung am Konto: die Sicht je Kampagne (`/api/me/layer-view`). */
export const LAYER_VIEW_PREF = 'layerView';

export type LayerViewMode = 'campaign' | 'mine';

export interface LayerView {
  mode: LayerViewMode;
  /** Campaign view: was ich aus dem Stapel der Kampagne für mich herausnehme. */
  off: EntityId[];
  /** My view: die Ebenen, die ich sehe, in beliebiger Reihenfolge. */
  layers: EntityId[];
}

const HOECHSTENS = 300;

function idListe(x: unknown): EntityId[] | null {
  if (x === undefined || x === null) return [];
  if (!Array.isArray(x) || !x.every((y) => typeof y === 'string' && y.length > 0 && y.length <= 200)) return null;
  return [...new Set(x as string[])].slice(0, HOECHSTENS);
}

/** Eine Sicht aus Unbekanntem — `null`, wenn es keine ist. */
export function cleanLayerView(x: unknown): LayerView | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const mode = o['mode'];
  if (mode !== 'campaign' && mode !== 'mine') return null;
  const off = idListe(o['off']);
  const layers = idListe(o['layers']);
  if (!off || !layers) return null;
  return { mode, off, layers };
}

/** Ob eine Sicht etwas ändert: eine Campaign view ohne Abwahl ist die Vorgabe. */
export function isDefaultView(view: LayerView | null | undefined): boolean {
  return !view || (view.mode === 'campaign' && view.off.length === 0);
}

/** Die Sichten eines Kontos, je Kampagne, aus der Einstellung `layerView`. */
export function layerViewsOf(roh: unknown): Record<EntityId, LayerView> {
  const raus: Record<EntityId, LayerView> = {};
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return raus;
  for (const [c, v] of Object.entries(roh as Record<string, unknown>)) {
    const sicht = cleanLayerView(v);
    if (sicht && !isDefaultView(sicht)) raus[c] = sicht;
  }
  return raus;
}

/** Wer wählt: genug vom Konto für die Frage, welche Kampagnen es hat. */
export interface CampaignChooser {
  isAdmin?: boolean;
  roles?: Record<string, string>;
}

const RANG: Record<string, number> = { gm: 4, 'co-gm': 3, player: 2, spectator: 1 };

const istKampagne = (e: Entity | undefined): e is Entity => !!e && (e.interfaces ?? [])[0] === CAMPAIGN_TYPE;

/** Ob dieses Konto diese Kampagne wählen darf: mit einer Rolle darin, die Verwaltung jede. */
export function mayChooseCampaign(viewer: CampaignChooser | null | undefined, campaignId: EntityId): boolean {
  if (!viewer) return false;
  return !!viewer.isAdmin || !!viewer.roles?.[campaignId];
}

/**
 * **In welcher Kampagne dieses Konto gerade ist** (REQ-408):
 *
 * 1. die eigene Wahl, wenn es sie noch gibt und das Konto sie wählen darf;
 * 2. die Vorgabe der Installation (`settings.campaign`), wenn das Konto
 *    darin eine Rolle hat oder die Verwaltung ist;
 * 3. sonst die Kampagne, in der es die stärkste Rolle hat (bei Gleichstand
 *    nach Namen) — wer genau eine hat, ist ohne Wahl darin;
 * 4. sonst die Vorgabe — ein Konto ohne Rolle sieht, was öffentlich ist.
 */
export function chosenCampaign(
  entities: ReadonlyMap<EntityId, Entity>,
  settings: Record<string, string> | null | undefined,
  viewer: CampaignChooser | null | undefined,
  wanted?: EntityId | null,
): Entity | null {
  const vorgabe = currentCampaign(entities, settings);
  if (!viewer) return vorgabe;
  if (wanted && mayChooseCampaign(viewer, wanted)) {
    const e = entities.get(wanted);
    if (istKampagne(e)) return e;
  }
  if (!vorgabe || viewer.isAdmin || viewer.roles?.[vorgabe.id]) return vorgabe;
  const eigene = Object.entries(viewer.roles ?? {})
    .map(([id, rolle]) => ({ e: entities.get(id), rang: RANG[rolle] ?? 0 }))
    .filter((x): x is { e: Entity; rang: number } => istKampagne(x.e))
    .sort((a, b) => b.rang - a.rang || String(a.e.name ?? '').localeCompare(String(b.e.name ?? ''), 'de') || a.e.id.localeCompare(b.e.id));
  return eigene[0]?.e ?? vorgabe;
}

function ebenenOrdnung(layer: Entity | undefined): number {
  const o = (layer?.components?.[LAYER_COMPONENT] as { order?: unknown } | undefined)?.order;
  return o != null && Number.isFinite(Number(o)) ? Number(o) : 10;
}

/**
 * **Die Kampagne, wie dieser Betrachter sie liest** (REQ-412): mit dem
 * Stapel seiner Sicht statt dem der Kampagne. Ohne Sicht dieselbe
 * Kampagne (dasselbe Objekt). Gespeichert wird das Ergebnis nie — es ist
 * eine Lesart, kein Stand.
 *
 * - Campaign view: was in `off` steht, fällt heraus — eine ausdrücklich
 *   aufgeschaltete Ebene verliert ihre Kante, ein Gruppenmitglied wird
 *   abgeschaltet (`mode: 'off'`). Ausgewählt (`only`) und geordnet bleibt
 *   der Rest, wie die Kampagne es sagt.
 * - My view: genau die Ebenen in `layers`, dazu die Ebene der Kampagne;
 *   was die Kampagne schon aufschaltet, behält Kante und Stelle, das Übrige
 *   kommt nach seiner Spezifität (`Layer.order`) dazu. Abschaltungen der
 *   Kampagne gelten hier nicht — gewählt ist gewählt.
 */
export function viewedCampaign(
  entities: ReadonlyMap<EntityId, Entity>,
  campaign: Entity,
  view: LayerView | null | undefined,
): Entity {
  if (!view || isDefaultView(view)) return campaign;
  const eigene = campaignLayer(entities, campaign)?.id ?? null;
  const stapel = activeStack(entities, campaign);
  if (view.mode === 'campaign') {
    const weg = new Set(view.off.filter((id) => id !== eigene));
    if (!weg.size) return campaign;
    const direkt = new Set(stapel.map((x) => x.layer.id));
    const relations = (campaign.relations ?? []).filter(
      (r) => !(r.type === ACTIVATES_RELATION && !isOffEdge(r) && !isCompareEdge(r) && weg.has(r.to)),
    );
    const schonAus = (campaign.relations ?? []).filter(isOffEdge).map((r) => r.to);
    return withOff({ ...campaign, relations }, [...schonAus, ...[...weg].filter((id) => !direkt.has(id))]);
  }
  const gewaehlt = new Set(view.layers);
  if (eigene) gewaehlt.add(eigene);
  const alt = new Map(stapel.map((x) => [x.layer.id, x]));
  const neu: Rel[] = [...gewaehlt]
    .map((to) => ({ to, order: alt.get(to)?.order ?? ebenenOrdnung(entities.get(to)) }))
    .sort((a, b) => a.order - b.order || a.to.localeCompare(b.to))
    .map(({ to, order }) => {
      const kante = (campaign.relations ?? []).find((r) => r.type === ACTIVATES_RELATION && r.to === to && !isOffEdge(r) && !isCompareEdge(r));
      return { id: kante?.id ?? activatesId(campaign, to), type: ACTIVATES_RELATION, to, props: { ...(kante?.props ?? {}), order } };
    });
  /* Vergleiche bleiben (für eine Ebene, die nicht gewählt ist); Abschaltungen nicht. */
  const andere = (campaign.relations ?? []).filter(
    (r) => r.type !== ACTIVATES_RELATION || (isCompareEdge(r) && !gewaehlt.has(r.to)),
  );
  return { ...campaign, relations: [...andere, ...neu] };
}

/** Ein kurzer Schlüssel für eine Sicht — Zwischenspeicher, die je Stapel rechnen, brauchen ihn. */
export function layerViewKey(view: LayerView | null | undefined): string {
  if (isDefaultView(view)) return '';
  return view!.mode === 'campaign' ? `c:${[...view!.off].sort().join(',')}` : `m:${[...view!.layers].sort().join(',')}`;
}
