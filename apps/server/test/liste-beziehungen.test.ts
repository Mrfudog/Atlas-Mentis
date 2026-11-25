/**
 * Filter nach Beziehungen in den Übersichten (T-389, REQ-395): „hat eine
 * Kante", „hat keine", „zu diesem Artikel", „mindestens n", ein Feld wie
 * die Rasterform — gerechnet am Server über das Gesiebte. Eine Kante zu
 * einem verborgenen Artikel zählt für die Spielerin nicht, weder als
 * Treffer noch als Zahl noch als Ziel im Wähler.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const inLayer = (id: string) => ({ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} });
function artikel(id: string, typ: string, name: string, karten: Record<string, Record<string, unknown>> = {}, kanten: Entity['relations'] = []): Entity {
  return {
    id,
    interfaces: [typ],
    name,
    components: { Identity: { name, id, aliases: [] }, ...karten },
    relations: [inLayer(id), ...(kanten ?? [])],
  };
}

const ebene: Entity = { id: 'ly_nebel', interfaces: ['Layer'], name: 'Nebel', components: { Identity: { name: 'Nebel', id: 'layer-0001', aliases: [] } }, relations: [] };
const runde: Entity = {
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
  relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
};
const gilde = artikel('fac_gilde', 'Faction', 'Guild');
/* Nur die Leitung sieht den Zirkel. */
const zirkel = artikel('fac_zirkel', 'Faction', 'Circle', { Visibility: { audience: 'gm' } });
const ada = artikel('cr_ada', 'Creature', 'Ada', {}, [{ id: 'm1', type: 'memberOf', to: 'fac_gilde', props: {} }]);
const bo = artikel('cr_bo', 'Creature', 'Bo', {}, [
  { id: 'm2', type: 'memberOf', to: 'fac_gilde', props: {} },
  { id: 'm3', type: 'memberOf', to: 'fac_zirkel', props: {} },
]);
const cyr = artikel('cr_cyr', 'Creature', 'Cyr', {}, [{ id: 'm4', type: 'memberOf', to: 'fac_zirkel', props: {} }]);
const dex = artikel('cr_dex', 'Creature', 'Dex');
const bogen = artikel('it_bogen', 'Item', 'Bow', { Item: { rows: ['#', '#', '#'] } });
const seil = artikel('it_seil', 'Item', 'Rope', { Item: { weight: 10 } });

interface Liste {
  rows: { id: string }[];
  facets: {
    has: {
      choices: { ref: string; label: string; kind: string; count: number }[];
      targets: Record<string, { id: string; name: string; count: number }[]>;
    };
  };
}

async function aufbau() {
  return tisch({
    kampagne: 'camp_nebel',
    artikel: [ebene, runde, gilde, zirkel, ada, bo, cyr, dex, bogen, seil],
    konten: { Mira: { roles: { camp_nebel: 'gm' } }, Sela: { roles: { camp_nebel: 'player' } } },
  });
}
type T = Awaited<ReturnType<typeof aufbau>>;
const liste = (t: T, wer: string, q: string) => t.json<Liste>(wer, 'GET', `/api/list?limit=50&${q}`);
const ids = (l: Liste) => l.rows.map((r) => r.id).sort();
const f = (s: string) => `f=${encodeURIComponent(`@has:${s}`)}`;

describe('/api/list: nach Beziehungen (T-389)', () => {
  it('hat / hat keine Kante', async () => {
    const t = await aufbau();
    expect(ids(await liste(t, 'Mira', `type=Creature&${f('out.memberOf')}`))).toEqual(['cr_ada', 'cr_bo', 'cr_cyr']);
    expect(ids(await liste(t, 'Mira', `type=Creature&${f('!out.memberOf')}`))).toEqual(['cr_dex']);
    /* Eingehend: die Fraktion mit Mitgliedern. */
    expect(ids(await liste(t, 'Mira', `type=Faction&${f('in.memberOf')}`))).toEqual(['fac_gilde', 'fac_zirkel']);
  });

  it('zu einem bestimmten Artikel, mindestens n, mehrere zusammen', async () => {
    const t = await aufbau();
    expect(ids(await liste(t, 'Mira', `type=Creature&${f('out.memberOf=fac_zirkel')}`))).toEqual(['cr_bo', 'cr_cyr']);
    expect(ids(await liste(t, 'Mira', `type=Creature&${f('out.memberOf>=2')}`))).toEqual(['cr_bo']);
    expect(ids(await liste(t, 'Mira', `type=Creature&${f('out.memberOf=fac_gilde|!out.memberOf=fac_zirkel')}`))).toEqual(['cr_ada']);
  });

  it('ein Feld: Gegenstände mit Rasterform', async () => {
    const t = await aufbau();
    expect(ids(await liste(t, 'Mira', `type=Item&${f('Item.rows')}`))).toEqual(['it_bogen']);
    expect(ids(await liste(t, 'Mira', `type=Item&${f('!Item.rows')}`))).toEqual(['it_seil']);
    const wahl = (await liste(t, 'Mira', 'type=Item')).facets.has.choices;
    expect(wahl.find((c) => c.ref === 'Item.rows')).toMatchObject({ kind: 'field', label: 'Shape', count: 1 });
    /* Gerechnetes steht nicht zur Wahl (D8). */
    expect(wahl.some((c) => c.ref === 'Item.cells')).toBe(false);
  });

  it('Zahlen und Ziele zählen nur über die Treffer, mit der Art nur ihre Kanten', async () => {
    const t = await aufbau();
    const r = await liste(t, 'Mira', `type=Creature&${f('out.memberOf')}`);
    expect(r.facets.has.choices.find((c) => c.ref === 'out.memberOf')?.count).toBe(3);
    expect(r.facets.has.choices.some((c) => c.ref === 'in.memberOf')).toBe(false);
    expect(r.facets.has.targets['out.memberOf']).toEqual([
      { id: 'fac_zirkel', name: 'Circle', count: 2 },
      { id: 'fac_gilde', name: 'Guild', count: 2 },
    ]);
    /* Ein gewähltes Ziel engt die Ziele derselben Kante nicht ein — man tauscht es. */
    const z = await liste(t, 'Mira', `type=Creature&${f('out.memberOf=fac_gilde')}`);
    expect(z.facets.has.targets['out.memberOf']?.map((x) => x.id).sort()).toEqual(['fac_gilde', 'fac_zirkel']);
  });

  it('Sichtbarkeit: eine Kante zu Verborgenem zählt für die Spielerin nicht', async () => {
    const t = await aufbau();
    /* Cyr ist für Sela in keiner Fraktion — der Zirkel ist nicht da. */
    expect(ids(await liste(t, 'Sela', `type=Creature&${f('out.memberOf')}`))).toEqual(['cr_ada', 'cr_bo']);
    expect(ids(await liste(t, 'Sela', `type=Creature&${f('!out.memberOf')}`))).toEqual(['cr_cyr', 'cr_dex']);
    /* Nach dem Verborgenen gefragt: nichts, und kein Unterschied zu einer erfundenen Id. */
    const geheim = await liste(t, 'Sela', `type=Creature&${f('out.memberOf=fac_zirkel')}`);
    const erfunden = await liste(t, 'Sela', `type=Creature&${f('out.memberOf=fac_gibtsnicht')}`);
    expect(ids(geheim)).toEqual([]);
    expect(geheim.facets.has).toEqual(erfunden.facets.has);
    const r = await liste(t, 'Sela', `type=Creature&${f('out.memberOf')}`);
    expect(r.facets.has.targets['out.memberOf']).toEqual([{ id: 'fac_gilde', name: 'Guild', count: 2 }]);
    expect(r.facets.has.choices.find((c) => c.ref === 'out.memberOf')?.count).toBe(2);
    /* Eingehend zählt nur, wessen Quelle sie sieht: die Gilde hat zwei Mitglieder. */
    expect(ids(await liste(t, 'Sela', `type=Faction&${f('in.memberOf')}`))).toEqual(['fac_gilde']);
  });

  it('ohne Art nur Kanten, die in den Treffern vorkommen; Unsinn und many-Felder gelten nicht', async () => {
    const t = await aufbau();
    const r = await liste(t, 'Mira', 'area=world');
    expect(r.facets.has.choices.every((c) => c.kind === 'edge' && c.count > 0)).toBe(true);
    const alle = ids(await liste(t, 'Mira', 'type=Creature'));
    expect(ids(await liste(t, 'Mira', `type=Creature&${f('quatsch')}`))).toEqual(alle);
    expect(ids(await liste(t, 'Mira', `type=Creature&${f('Secrets.secret')}`))).toEqual(alle);
  });
});
