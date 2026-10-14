/**
 * **Die Gruppe einer Kampagne, von selbst** (T-100, E-007).
 *
 * Die Leitung entschied am 14.10.: je Kampagne wird eine Party angelegt,
 * und die Spieler werden darin festgehalten — anpassbar, aber der
 * häufigste Fall. Festgehalten wird nicht das Konto, sondern seine Figur:
 * eine Party ist das Figurengefüge einer Runde (A8), und ein Konto in
 * einem Artikel wanderte beim Export mit (REQ-199).
 *
 * Anpassbar heisst: was hier von selbst geschieht, ist eine gewöhnliche
 * Kante (`memberOfParty`) an der Figur, die man wieder wegnehmen kann.
 * Steht die Figur schon in einer Gruppe dieser Kampagne, bleibt sie dort;
 * hat die Kampagne keine Gruppe mehr (gelöscht), wird keine neue angelegt
 * — dann hat die Leitung es so gewollt.
 */

import {
  CAMPAIGN_TYPE,
  LAYER_RELATION,
  PARTY_RELATION,
  PARTY_OF_RELATION,
  nextId,
  partiesOf,
  validateEntity,
  type Entity,
} from '@nw/model';
import type { Repository } from './repo.js';

/** Die Art, die eine Gruppe ist. */
export const PARTY_TYPE = 'Party';

/**
 * Die Gruppe für eine neue Kampagne — in ihrer Ebene, damit sie ihr
 * gehört (`campaignsOf`), und fertig, damit die Spielenden sie sehen.
 * Die Id folgt der Ebene (`pt_<kampagne>` wie `ly_<kampagne>`); Migration
 * 039 legt dieselbe für jede Kampagne an, die keine hatte.
 */
export function neueGruppe(alle: readonly Entity[], kampagne: Entity, ebeneId: string | null): Entity {
  const name = `${kampagne.name || 'Campaign'} party`;
  const id = `pt_${kampagne.id}`;
  return {
    id,
    interfaces: [PARTY_TYPE],
    name,
    components: {
      Identity: { name, id: nextId(alle, PARTY_TYPE), aliases: [] },
      Status: { status: 'ready' },
    },
    relations: [
      { id: `${id}~partyOf`, type: PARTY_OF_RELATION, to: kampagne.id, props: {} },
      ...(ebeneId ? [{ id: `${id}~inLayer-1`, type: LAYER_RELATION, to: ebeneId, props: {} }] : []),
    ],
  };
}

/**
 * **Diese Figuren in die Gruppe der Kampagne** — die erste (`partiesOf`),
 * und nur, wer noch in keiner Gruppe dieser Kampagne steht. Geschrieben
 * wird über `validateEntity` wie überall; was nicht durchgeht, bleibt
 * ungeschrieben und wird gezählt, nicht verschwiegen.
 *
 * Gibt die Ids zurück, die dazukamen.
 */
export async function inDieGruppe(
  repo: Repository,
  campaignId: string,
  actorIds: readonly string[],
  by?: string,
): Promise<string[]> {
  if (!actorIds.length) return [];
  const alle = await repo.listEntities();
  const map = new Map(alle.map((e) => [e.id, e]));
  if ((map.get(campaignId)?.interfaces ?? [])[0] !== CAMPAIGN_TYPE) return [];
  const gruppen = partiesOf(map, campaignId);
  const gruppe = gruppen[0];
  if (!gruppe) return [];
  const dieser = new Set(gruppen.map((g) => g.id));
  const registry = await repo.getRegistry();
  const known = new Map(alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
  const dazu: string[] = [];
  for (const id of new Set(actorIds)) {
    const figur = map.get(id);
    if (!figur) continue;
    if ((figur.relations ?? []).some((r) => r.type === PARTY_RELATION && dieser.has(r.to))) continue;
    const neu: Entity = {
      ...figur,
      relations: [
        ...(figur.relations ?? []),
        { id: `${figur.id}~memberOfParty-${gruppe.id}`, type: PARTY_RELATION, to: gruppe.id, props: {} },
      ],
    };
    if (validateEntity(registry, neu, { knownTypes: known }).length) continue;
    await repo.putEntity(neu);
    await repo.appendEvent('party.joined', figur.id, { party: gruppe.id, campaign: campaignId, ...(by ? { by } : {}) });
    dazu.push(figur.id);
  }
  return dazu;
}
