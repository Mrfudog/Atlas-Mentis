/**
 * Marker zwischen Kartenstufen (T-328): was auf der Karte darin steht,
 * zeigt die Karte darüber gehoben — gesiebt wie die Unterkarte selbst und
 * wie der Nebel oben; was oben im Bereich einer Karte darin steht, ist dort
 * ein Vorschlag „To place", nur für die Leitung.
 */

import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity, Relation } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { kartenImSpiel } from './hilfen/imspiel.js';

const PASSWORT = 'nebel-wacht-am-tor';
const imLayer = (id: string): Relation => ({ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} });

const art = (id: string, type: string, name: string, extra: Record<string, unknown> = {}, relations: Relation[] = []): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name, id: `${type.toLowerCase()}-${id}`, aliases: [] }, ...extra },
  relations: [imLayer(id), ...relations],
});
const marke = (id: string, to: string, x: number, y: number, props: Record<string, unknown> = {}): Relation => ({
  id,
  type: 'marker',
  to,
  props: { x, y, kind: 'static', ...props },
});

const bestand: Entity[] = [
  { id: 'ly_nebel', interfaces: ['Layer'], name: 'Nebel', components: { Identity: { name: 'Nebel', id: 'layer-1', aliases: [] } }, relations: [] },
  {
    id: 'camp_nebel',
    interfaces: ['Campaign'],
    name: 'Nebelwacht',
    components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
    relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
  },
  /* Die Region: oben aufgedeckt, unten Nebel. Der Wirt steht im Bereich der Stadt, der Turm auch, aber gehört hierher. */
  art('region', 'Map', 'Region', { Image: { image: 'as_region' }, Map: { fog: true, reveal: [{ id: 'r1', kind: 'rect', x: 0, y: 0, w: 1, h: 0.5 }] } }, [
    marke('m_wirt', 'wirt', 0.25, 0.25),
    marke('m_turm', 'turm', 0.3, 0.3, { stay: true }),
    marke('m_aussen', 'bauer', 0.9, 0.1),
  ]),
  art('stadt', 'Map', 'Hafenstadt', { Image: { image: 'as_stadt' } }, [
    { id: 'in1', type: 'insideMap', to: 'region', props: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 } },
    marke('s_volo', 'volo', 0.5, 0.5),
    marke('s_dieb', 'dieb', 0.1, 0.1, { hidden: true }),
    marke('s_geheim', 'geheimnpc', 0.9, 0.9),
    marke('s_kiste', 'kiste', 0.4, 0.4, { kind: 'scenery' }),
  ]),
  /* Das Dorf liegt unter dem Nebel der Region. */
  art('dorf', 'Map', 'Dorf', { Image: { image: 'as_dorf' } }, [
    { id: 'in2', type: 'insideMap', to: 'region', props: { x: 0.6, y: 0.7, w: 0.2, h: 0.2 } },
    marke('d_volo2', 'mira', 0.5, 0.5),
  ]),
  art('volo', 'Creature', 'Volo'),
  art('dieb', 'Creature', 'Dieb'),
  art('geheimnpc', 'Creature', 'Spitzel', { Visibility: { audience: 'gm' } }),
  art('kiste', 'Item', 'Kiste'),
  art('wirt', 'Creature', 'Wirt'),
  art('turm', 'Creature', 'Turmwächter'),
  art('bauer', 'Creature', 'Bauer'),
  art('mira', 'Creature', 'Mira'),
];

async function aufbau() {
  const repo = new InMemoryRepository({ ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } }, kartenImSpiel(bestand));
  const app = buildApp({ repo });
  const konto = async (name: string, role: 'gm' | 'player', actorIds: string[] = []) =>
    repo.putUser({ id: `u_${name.toLowerCase()}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles: { camp_nebel: role } });
  await konto('Lea', 'gm');
  await konto('Sela', 'player', ['pc_1']);
  const kekse = new Map<string, string>();
  const hole = async (name: string, url: string) => {
    let k = kekse.get(name);
    if (!k) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      k = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')!.value}`;
      kekse.set(name, k);
    }
    return app.inject({ method: 'GET', url, headers: { cookie: k } });
  };
  return { hole };
}

describe('Marker zwischen Kartenstufen (T-328)', () => {
  it('hebt die Marker der Karte darin auf die Karte darüber — ohne Assets, umgerechnet', async () => {
    const { hole } = await aufbau();
    const gm = (await hole('Lea', '/api/maps/region/context')).json();
    const stadt = gm.lifted.find((g: { map: string }) => g.map === 'stadt');
    expect(stadt.name).toBe('Hafenstadt');
    expect(stadt.items.map((m: { to: string }) => m.to).sort()).toEqual(['dieb', 'geheimnpc', 'volo']);
    const volo = stadt.items.find((m: { to: string }) => m.to === 'volo');
    expect(volo.x).toBeCloseTo(0.3);
    expect(volo.y).toBeCloseTo(0.3);
    expect(gm.targets['volo'].name).toBe('Volo');
    /* Die Leitung sieht auch unter dem Nebel. */
    expect(gm.lifted.some((g: { map: string }) => g.map === 'dorf')).toBe(true);
  });

  it('zeigt Spielenden nur, was beide Karten zeigen', async () => {
    const { hole } = await aufbau();
    const sp = (await hole('Sela', '/api/maps/region/context')).json();
    const stadt = sp.lifted.find((g: { map: string }) => g.map === 'stadt');
    /* `hidden` und ein Ziel, das sie nicht sehen, fallen weg. */
    expect(stadt.items.map((m: { to: string }) => m.to)).toEqual(['volo']);
    expect(sp.targets['geheimnpc']).toBeUndefined();
    /* Das Dorf liegt unter dem Nebel der Region: kein Bereich, kein Marker. */
    expect(sp.lifted.some((g: { map: string }) => g.map === 'dorf')).toBe(false);
  });

  it('schlägt der Leitung die Marker oben im Bereich zum Platzieren vor — ohne „Keep here“ und ohne was ausserhalb steht', async () => {
    const { hole } = await aufbau();
    const gm = (await hole('Lea', '/api/maps/stadt/context')).json();
    expect(gm.toPlace).toHaveLength(1);
    expect(gm.toPlace[0]).toMatchObject({ rel: 'm_wirt', from: 'region', to: 'wirt', name: 'Wirt', fromName: 'Region' });
    expect(gm.toPlace[0].x).toBeCloseTo(0.25);
    expect(gm.toPlace[0].y).toBeCloseTo(0.25);
    const sp = (await hole('Sela', '/api/maps/stadt/context')).json();
    expect(sp.toPlace).toBeUndefined();
  });
});
