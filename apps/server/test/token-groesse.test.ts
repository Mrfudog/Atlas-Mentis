/**
 * **Die Grösse eines Tokens am Kartenkontext** (T-390, REQ-396):
 * Statblock → Wirkungen → Überschreibung am Token. Der Fehler aus dem
 * Demo-Video: ein eingelesenes Monster ist selbst ein Statblock, das Token
 * zeigt direkt darauf — und die Grösse fehlte. Dazu Enlarge als Zustand an
 * der Kreatur und in der Begegnung, und welche Namen Spielende sehen.
 * Erfundene Artikel.
 */

import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });

function bestand(kampf: boolean): Entity[] {
  const alle: Entity[] = [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    /* Ein Monster wie aus 5e.tools: nur ein Statblock. */
    { id: 'sb_drache', name: 'Roter Drache', interfaces: ['Statblock'], components: { ...ident('Roter Drache', 'statblock-0001'), Statblock: { size: 'huge' } }, relations: [im('sb_drache')] },
    /* Eine Kreatur mit Statblock über belongsTo. */
    { id: 'cr_oger', name: 'Oger', interfaces: ['Creature'], components: ident('Oger', 'creature-0001'), relations: [im('cr_oger')] },
    { id: 'sb_oger', name: 'Oger (Werte)', interfaces: ['Statblock'], components: { ...ident('Oger (Werte)', 'statblock-0002'), Statblock: { size: 'large' } },
      relations: [im('sb_oger'), { id: 'sb_oger_bt', type: 'belongsTo', to: 'cr_oger', props: {} }] },
    /* Eine Zwergin, vergrössert über einen Zustand an Vitals. */
    { id: 'cr_zwerg', name: 'Brakka', interfaces: ['Creature'], components: { ...ident('Brakka', 'creature-0002'), Vitals: { conditions: ['cond_gross'] } }, relations: [im('cr_zwerg')] },
    { id: 'sb_zwerg', name: 'Brakka (Werte)', interfaces: ['Statblock'], components: { ...ident('Brakka (Werte)', 'statblock-0003'), Statblock: { size: 'medium' } },
      relations: [im('sb_zwerg'), { id: 'sb_zwerg_bt', type: 'belongsTo', to: 'cr_zwerg', props: {} }] },
    { id: 'cond_gross', name: 'Enlarged', interfaces: ['Condition'],
      components: { ...ident('Enlarged', 'condition-0001'), Effects: { effects: [{ id: 'size', target: 'size', op: 'add', value: 1 }] } }, relations: [im('cond_gross')] },
    { id: 'cond_klein', name: 'Reduced', interfaces: ['Condition'],
      components: { ...ident('Reduced', 'condition-0002'), Effects: { effects: [{ id: 'size', target: 'size', op: 'add', value: -1 }] } }, relations: [im('cond_klein')] },
    { id: 'map_1', name: 'Hort', interfaces: ['Map'],
      components: { ...ident('Hort', 'map-0001'), Map: { gridShape: 'square', gridSize: 70 }, Image: { image: 'https://example.org/hort.png' } },
      relations: [im('map_1'),
        { id: 'mk_drache', type: 'marker', to: 'sb_drache', props: { x: 0.5, y: 0.5, kind: 'play' } },
        { id: 'mk_oger', type: 'marker', to: 'cr_oger', props: { x: 0.2, y: 0.2, kind: 'play' } },
        { id: 'mk_zwerg', type: 'marker', to: 'cr_zwerg', props: { x: 0.8, y: 0.8, kind: 'play' } }] },
  ];
  if (kampf) {
    alle.push({ id: 'enc_1', name: 'Im Hort', interfaces: ['Encounter'], components: { ...ident('Im Hort', 'encounter-0001'), Encounter: { round: 1, turn: 0 } },
      relations: [im('enc_1'), { id: 'enc_1_om', type: 'onMap', to: 'map_1', props: {} },
        { id: 'enc_1_drache', type: 'participates', to: 'sb_drache', props: { initiative: 20, conditions: ['cond_klein'] } }] });
  }
  return alle;
}

const aufbau = (kampf = false) =>
  tisch({
    artikel: bestand(kampf),
    kampagne: 'camp_a',
    konten: { Gwen: { roles: { camp_a: 'gm' } }, Sela: { roles: { camp_a: 'player' } } },
  });

type Ziel = { size?: string; baseSize?: string; sizeFrom?: string; sizeVia?: string[] };
type Kontext = { targets: Record<string, Ziel> };

describe('Token-Grösse im Kartenkontext (T-390)', () => {
  it('liest die Grösse eines Monsters, das selbst ein Statblock ist (Drache: huge)', async () => {
    const t = await aufbau();
    const k = await t.json<Kontext>('Gwen', 'GET', '/api/maps/map_1/context');
    expect(k.targets['sb_drache']).toMatchObject({ size: 'huge', sizeFrom: 'statblock' });
    expect(k.targets['cr_oger']).toMatchObject({ size: 'large', sizeFrom: 'statblock' });
  });

  it('rechnet Enlarge an Vitals ein und nennt der Leitung die Quelle', async () => {
    const t = await aufbau();
    const k = await t.json<Kontext>('Gwen', 'GET', '/api/maps/map_1/context');
    expect(k.targets['cr_zwerg']).toEqual(expect.objectContaining({ size: 'large', baseSize: 'medium', sizeFrom: 'effects', sizeVia: ['Enlarged'] }));
  });

  it('gibt Spielenden dieselbe Grösse, aber keine Namen der Quellen', async () => {
    const t = await aufbau();
    const k = await t.json<Kontext>('Sela', 'GET', '/api/maps/map_1/context');
    expect(k.targets['cr_zwerg']).toMatchObject({ size: 'large', sizeFrom: 'effects' });
    expect(k.targets['cr_zwerg']?.sizeVia).toBeUndefined();
  });

  it('nimmt Zustände aus der Begegnung auf der Karte dazu (Reduce am Drachen)', async () => {
    const t = await aufbau(true);
    const k = await t.json<Kontext>('Gwen', 'GET', '/api/maps/map_1/context');
    expect(k.targets['sb_drache']).toMatchObject({ size: 'large', baseSize: 'huge', sizeFrom: 'effects', sizeVia: ['Reduced'] });
  });
});

/* E-164, T-428: überlappende Grössen-Zustände — die Leitung wählt am Token. */
describe('überlappende Grössen-Zustände (T-428)', () => {
  /* Brakka: Enlarged an Vitals, dazu Reduced in der Begegnung — als Eintrag
     mit Dauer, wie ihn der Tracker schreibt ({rule, rounds}). */
  const mitKampf = (sizeSource?: string): Entity[] => {
    const alle = bestand(false).map((e) =>
      e.id !== 'map_1'
        ? e
        : { ...e, relations: (e.relations ?? []).map((r) => (r.id === 'mk_zwerg' && sizeSource ? { ...r, props: { ...r.props, sizeSource } } : r)) },
    );
    alle.push({ id: 'enc_2', name: 'Im Hort', interfaces: ['Encounter'], components: { ...ident('Im Hort', 'encounter-0002'), Encounter: { round: 1, turn: 0 } },
      relations: [im('enc_2'), { id: 'enc_2_om', type: 'onMap', to: 'map_1', props: {} },
        { id: 'enc_2_zwerg', type: 'participates', to: 'cr_zwerg', props: { initiative: 12, conditions: [{ rule: 'cond_klein', rounds: 3 }] } }] });
    return alle;
  };
  const mit = (sizeSource?: string) =>
    tisch({ artikel: mitKampf(sizeSource), kampagne: 'camp_a', konten: { Gwen: { roles: { camp_a: 'gm' } }, Sela: { roles: { camp_a: 'player' } } } });
  type Wahl = Ziel & { sizePassed?: string[]; sizeChoice?: { options: { id: string; name: string }[]; chosen: string | null } };

  it('ohne Wahl: keine Summe, der zuletzt hinzugekommene gilt (Reduced aus der Initiative, mit Dauer)', async () => {
    const t = await mit();
    const k = await t.json<{ targets: Record<string, Wahl> }>('Gwen', 'GET', '/api/maps/map_1/context');
    expect(k.targets['cr_zwerg']).toMatchObject({ size: 'small', baseSize: 'medium', sizeFrom: 'effects', sizeVia: ['Reduced'], sizePassed: ['Enlarged'] });
    expect(k.targets['cr_zwerg']?.sizeChoice).toEqual({ options: [{ id: 'cond_gross', name: 'Enlarged' }, { id: 'cond_klein', name: 'Reduced' }], chosen: null });
  });

  it('die Wahl am Token gilt, und Spielende sehen die Grösse ohne Namen und ohne Wahl', async () => {
    const t = await mit('cond_gross');
    const k = await t.json<{ targets: Record<string, Wahl> }>('Gwen', 'GET', '/api/maps/map_1/context');
    expect(k.targets['cr_zwerg']).toMatchObject({ size: 'large', sizeVia: ['Enlarged'], sizePassed: ['Reduced'], sizeChoice: { chosen: 'cond_gross' } });
    const s = await t.json<{ targets: Record<string, Wahl> }>('Sela', 'GET', '/api/maps/map_1/context');
    expect(s.targets['cr_zwerg']).toMatchObject({ size: 'large', sizeFrom: 'effects' });
    expect(s.targets['cr_zwerg']?.sizeVia).toBeUndefined();
    expect(s.targets['cr_zwerg']?.sizePassed).toBeUndefined();
    expect(s.targets['cr_zwerg']?.sizeChoice).toBeUndefined();
  });
});
