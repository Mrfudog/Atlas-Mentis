/**
 * **Die Spielerebene** (T-164): je Konto und Kampagne, in der es `player`
 * ist, eine eigene Ebene — die Vorgabe zum Schreiben. Figur, Notizen und
 * was sie sonst anlegt, landen dort und nicht mehr in der Ebene der
 * Kampagne.
 *
 * Die Regeln stehen in CLAUDE.md („Geschrieben wird je Ebene") und in
 * docs/Datenmodell.md; hier werden sie angewandt:
 *
 *  - **Wessen sie ist, steht neben dem Konto** (`app_user_layer.campaign_id`,
 *    REQ-199), nicht an der Ebene. `Layer.kind: 'player'` ist Beschreibung
 *    wie jedes Wort dort — ein Feld, das gleichzeitig Regel ist, leckt beim
 *    ersten Tippfehler.
 *  - **Die Kampagne schaltet sie auf, unter ihrer eigenen Ebene.** Genau
 *    eine Kampagne heisst: sie gehört ihr (`campaignsOf`), und deren
 *    Leitung sieht darin, was sie in der Kampagnenebene sähe.
 *  - **Keine Fassungen darin** (`anpassZiele`): der Stapel gilt für alle am
 *    Tisch, eine Überschreibung in einer Spielerebene änderte den Artikel
 *    für alle.
 *  - **Rolle weg, Ebene bleibt** — beschrieben wird sie dann nicht mehr
 *    (`schreibEbenen`); die Leitung übernimmt sie oder löscht sie.
 */

import { randomUUID } from 'node:crypto';
import {
  ACTIVATES_RELATION,
  CAMPAIGN_TYPE,
  LAYER_COMPONENT,
  activatesId,
  activeStack,
  campaignLayer,
  entityName,
  nextId,
  primaryInterface,
  validateEntity,
  type Entity,
} from '@nw/model';
import type { LayerGrant, Repository } from './repo.js';
import { frischAendern } from './kampagnenrevision.js';

/** Das Wort an `Layer.kind` — Beschreibung, nicht Regel. */
export const PLAYER_LAYER_KIND = 'player';

/** Wie weit unter der Kampagnenebene sie steht: dicht darunter, über allem anderen. */
const UNTER_KAMPAGNE = 1;

/** Ebenen-Id → wessen Spielerebene in welcher Kampagne, aus den Zeilen. */
export function spielerEbenen(grants: readonly LayerGrant[]): Map<string, { userId: string; campaign: string }> {
  const out = new Map<string, { userId: string; campaign: string }>();
  for (const g of grants) if (g.owner && g.campaign) out.set(g.layerId, { userId: g.userId, campaign: g.campaign });
  return out;
}

/** Die Spielerebene dieses Kontos in dieser Kampagne — die Id, oder `null`. */
export function spielerEbeneVon(grants: readonly LayerGrant[], userId: string, campaignId: string): string | null {
  return grants.find((g) => g.owner && g.userId === userId && g.campaign === campaignId)?.layerId ?? null;
}

/**
 * **Sorgt dafür, dass dieses Konto in dieser Kampagne seine Spielerebene
 * hat** — beim Zuteilen der Rolle `player` (Seite, Einladung, Kommandozeile)
 * und für ältere Mitglieder über Migration 069. Gibt es sie schon (und den
 * Artikel dazu), bleibt alles, wie es ist; sonst wird sie angelegt, durch
 * `validateEntity`, und die Kampagne schaltet sie dicht unter ihrer
 * eigenen Ebene auf.
 *
 * Gibt die Id zurück, oder `null`, wenn es Konto oder Kampagne nicht gibt.
 */
export async function sorgeSpielerEbene(repo: Repository, userId: string, campaignId: string, by?: string): Promise<string | null> {
  const konto = await repo.getUser(userId);
  if (!konto) return null;
  const alle = await repo.listEntities();
  const map = new Map(alle.map((e) => [e.id, e]));
  const kampagne = map.get(campaignId);
  if (!kampagne || primaryInterface(kampagne) !== CAMPAIGN_TYPE) return null;
  const grants = await repo.layerGrants();
  const schon = spielerEbeneVon(grants, userId, campaignId);
  if (schon && map.has(schon)) return schon;

  const name = `${konto.name} · ${entityName(kampagne) || 'Campaign'}`.slice(0, 80);
  let id = `ly_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  while (map.has(id)) id = `ly_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const ebene: Entity = {
    id,
    interfaces: [LAYER_COMPONENT],
    name,
    components: {
      Identity: { name, id: nextId(alle, LAYER_COMPONENT), aliases: [] },
      Status: { status: 'ready' },
      Layer: { kind: PLAYER_LAYER_KIND, order: 90 },
    },
    relations: [],
  };

  /* Unter der Kampagnenebene: deren Stelle im Stapel, eins tiefer. Ohne
     Kampagnenebene oben drauf — dann ist sie die spezifischste. */
  const besessen = new Set(grants.filter((g) => g.owner).map((g) => g.layerId));
  const stapel = activeStack(map, kampagne);
  const eigene = campaignLayer(map, kampagne, besessen);
  const dort = stapel.find((x) => x.layer.id === eigene?.id)?.order;
  const order = dort != null ? dort - UNTER_KAMPAGNE : (stapel.at(-1)?.order ?? 0) + 10;
  const neu: Entity = {
    ...kampagne,
    relations: [
      ...(kampagne.relations ?? []),
      { id: activatesId(kampagne, id), type: ACTIVATES_RELATION, to: id, props: { order } },
    ],
  };

  const registry = await repo.getRegistry();
  const known = new Map(alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
  known.set(id, LAYER_COMPONENT);
  const issues = [...validateEntity(registry, ebene, {}), ...validateEntity(registry, neu, { knownTypes: known })];
  if (issues.length) {
    await repo.appendEvent('layer.player.refused', userId, { campaign: campaignId, issues });
    return null;
  }
  await repo.putEntity(ebene);
  /* Die Kante auf den frischen Stand der Kampagne, gegen seine Revision
     (T-449) — wer gerade den Stapel schaltet, verlöre sonst seine Wahl. */
  const kante = neu.relations!.at(-1)!;
  await frischAendern(repo, kampagne.id, (k) =>
    (k.relations ?? []).some((r) => r.id === kante.id) ? null : { ...k, relations: [...(k.relations ?? []), kante] },
  );
  await repo.grantLayer(userId, id, true, campaignId);
  await repo.appendEvent('layer.player', id, { user: userId, campaign: campaignId, ...(by ? { by } : {}) });
  return id;
}
