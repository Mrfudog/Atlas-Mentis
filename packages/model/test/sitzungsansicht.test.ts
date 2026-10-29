import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { collectionHits } from '../src/collection.js';
import { incomingIndex, pickView } from '../src/viewScope.js';
import type { Entity, LayoutElement } from '../src/types.js';

/**
 * **Die Sitzung auf einen Blick** (T-151, REQ-282): die Vorgabeansicht der
 * Session zeigt neben ihren Szenen und Begegnungen, wer darin vorkommt, wo
 * sie spielen und auf welcher Karte gekämpft wird — alles über Collections
 * (T-425), zwei Schritte vom Abend weg: `← partOf`, dann die Kante der
 * Szene bzw. Begegnung.
 */
const id = (name: string, nr: string) => ({ Identity: { name, id: nr, aliases: [] } });
const art = (eid: string, typ: string, name: string, nr: string, relations: Entity['relations'] = []): Entity => ({
  id: eid,
  interfaces: [typ],
  name,
  components: id(name, nr),
  relations,
});
const session = art('ses_1', 'Session', 'Session 1', 'session-0001');
const volo = art('npc_volo', 'Creature', 'Volo', 'npc-0001');
const mara = art('npc_mara', 'Creature', 'Mara', 'npc-0002');
const ratte = art('npc_ratte', 'Creature', 'Giant rat', 'npc-0003');
const wache = art('fa_wache', 'Faction', 'The Watch', 'faction-0001');
const hafen = art('pl_hafen', 'Place', 'Harbour', 'place-0001');
const keller = art('map_keller', 'Map', 'Cellar', 'map-0001');
const markt = art('pl_markt', 'Place', 'Market', 'place-0002');
const szene = art('sc_hafen', 'Scene', 'At the harbour', 'scene-0001', [
  { type: 'partOf', to: 'ses_1' },
  { type: 'features', to: 'npc_volo' },
  { type: 'features', to: 'npc_mara' },
  { type: 'features', to: 'fa_wache' },
  { type: 'happensAt', to: 'pl_hafen' },
]);
const kampf = art('enc_ratten', 'Encounter', 'Rats', 'encounter-0001', [
  { type: 'partOf', to: 'ses_1' },
  { type: 'participates', to: 'npc_ratte' },
  { type: 'participates', to: 'npc_volo' },
  { type: 'onMap', to: 'map_keller' },
  /* Seit T-333 hat auch die Begegnung einen Ort — derselbe Hafen steht einmal. */
  { type: 'happensAt', to: 'pl_hafen' },
]);
/* Eine Szene einer anderen Sitzung: ihr Ort und ihre Leute gehören nicht hierher. */
const fremd = art('sc_fremd', 'Scene', 'Elsewhere', 'scene-0002', [
  { type: 'partOf', to: 'ses_2' },
  { type: 'features', to: 'npc_ratte' },
  { type: 'happensAt', to: 'pl_markt' },
]);
const alle = [session, volo, mara, ratte, wache, hafen, keller, markt, szene, kampf, fremd];
const rueck = incomingIndex(alle);
const ctx = (sichtbar: readonly Entity[] = alle) => {
  const m = new Map(sichtbar.map((e) => [e.id, e]));
  return { get: (x: string) => m.get(x), incoming: (x: string) => rueck.get(x) ?? [] };
};

const layout = pickView(session, seedRegistry, 'full').layout;
const el = (eid: string): LayoutElement => {
  const e = layout.find((x) => x.id === eid);
  if (!e) throw new Error(`${eid} fehlt in der Ansicht der Session`);
  return e;
};
const treffer = (eid: string, sichtbar?: readonly Entity[]) => collectionHits(seedRegistry, session, el(eid), ctx(sichtbar)).map((h) => h.entity.id);

describe('Sitzungsansicht (T-151, REQ-282)', () => {
  it('steht oben: nach dem, was läuft, zuerst Szenen, Leute, Orte, Karten', () => {
    const ids = layout.map((x) => x.id);
    const blick = ['se-contains', 'se-people', 'se-fight', 'se-places', 'se-maps'];
    expect(ids.slice(ids.indexOf('se-live') + 1, ids.indexOf('se-live') + 1 + blick.length)).toEqual(blick);
    for (const b of blick) expect(el(b).el).toBe('collection');
  });

  it('zeigt die NSC der Szenen, nach Name, ohne Fraktion und ohne die anderer Sitzungen', () => {
    expect(treffer('se-people')).toEqual(['npc_mara', 'npc_volo']);
  });

  it('zeigt, wer in den Begegnungen kämpft', () => {
    expect(treffer('se-fight')).toEqual(['npc_ratte', 'npc_volo']);
  });

  it('zeigt die Orte der Szenen und Begegnungen und die Karten der Begegnungen', () => {
    expect(treffer('se-places')).toEqual(['pl_hafen']);
    expect(treffer('se-maps')).toEqual(['map_keller']);
  });

  it('was der Server zurückhielt, fehlt — auch was nur über eine verborgene Szene erreichbar wäre', () => {
    const ohneSzene = alle.filter((e) => e.id !== 'sc_hafen');
    expect(treffer('se-people', ohneSzene)).toEqual([]);
    expect(treffer('se-places', ohneSzene.filter((e) => e.id !== 'enc_ratten'))).toEqual([]);
    expect(treffer('se-fight', ohneSzene)).toEqual(['npc_ratte', 'npc_volo']);
  });
});
