/**
 * Kartenverknüpfungen (T-327): Form, Zoomtiefe und Anzeige je Betrachter,
 * und die Karte darüber als Rand — gesiebt wie Brotkrumen und Nebel.
 */

import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity, Relation } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const imLayer = (id: string): Relation => ({ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} });

const art = (id: string, type: string, name: string, extra: Record<string, unknown> = {}, relations: Relation[] = []): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name, id: `${type.toLowerCase()}-${id}`, aliases: [] }, ...extra },
  relations: [imLayer(id), ...relations],
});

const bestand: Entity[] = [
  { id: 'ly_nebel', interfaces: ['Layer'], name: 'Nebel', components: { Identity: { name: 'Nebel', id: 'layer-1', aliases: [] } }, relations: [] },
  {
    id: 'camp_nebel',
    interfaces: ['Campaign'],
    name: 'Nebelwacht',
    components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] }, Campaign: { mapLinkShowPlayers: 'hidden', mapLinkOuter: 'faded' } },
    relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
  },
  art('welt', 'Map', 'Welt', { Image: { image: 'as_welt' }, Map: { fog: true, reveal: [{ id: 'r1', kind: 'rect', x: 0, y: 0, w: 1, h: 0.5 }] } }),
  art('stadt', 'Map', 'Hafenstadt', { Image: { image: 'as_stadt' } }, [
    {
      id: 'in',
      type: 'insideMap',
      to: 'welt',
      props: { x: 0, y: 0, w: 1, h: 1, area: [[0.2, 0.1], [0.4, 0.1], [0.3, 0.3]], near: 0.3, show: 'frame' },
    },
  ]),
  art('geheim', 'Map', 'Geheimkarte', { Image: { image: 'as_geheim' }, Visibility: { audience: 'gm' } }),
  art('raum', 'Map', 'Raum', { Image: { image: 'as_raum' } }, [{ id: 'in2', type: 'insideMap', to: 'geheim', props: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }]),
];

async function aufbau() {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    bestand,
  );
  const app = buildApp({ repo });
  const konto = async (name: string, role: 'gm' | 'player', actorIds: string[] = []) =>
    repo.putUser({ id: `u_${name.toLowerCase()}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles: { camp_nebel: role } });
  await konto('Mira', 'gm');
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
  return { hole, repo };
}

describe('Kartenverknüpfung (T-327)', () => {
  it('schickt Form und Zoomtiefe, die Anzeige je Betrachter, die eigenen Angaben nur der Leitung', async () => {
    const { hole } = await aufbau();
    const sp = (await hole('Sela', '/api/maps/welt/context')).json();
    expect(sp.children).toHaveLength(1);
    const k = sp.children[0];
    expect(k).toMatchObject({ id: 'stadt', near: 0.3, show: 'hidden' });
    expect(k.area).toHaveLength(3);
    expect(k.frame.x).toBeCloseTo(0.2);
    expect(k.frame.w).toBeCloseTo(0.2);
    expect(k.own).toBeUndefined();
    expect(sp.linkDefaults).toBeUndefined();
    const gm = (await hole('Mira', '/api/maps/welt/context')).json();
    expect(gm.children[0]).toMatchObject({ show: 'frame', own: { near: 0.3, show: 'frame' }, template: 'stadt' });
    expect(gm.linkDefaults).toEqual({ show: 'jump', showPlayers: 'hidden', outer: 'faded' });
  });

  it('zeigt die Karte darüber als Rand — für Spielende unter Nebel beschnitten', async () => {
    const { hole } = await aufbau();
    const gm = (await hole('Mira', '/api/maps/stadt/context')).json();
    expect(gm.outer).toMatchObject({ id: 'welt', name: 'Welt', image: 'as_welt' });
    expect(gm.outer.frame.x).toBeCloseTo(0.2);
    const sp = (await hole('Sela', '/api/maps/stadt/context')).json();
    expect(sp.outer.id).toBe('welt');
    expect(sp.outer.image).not.toBe('as_welt');
    expect(sp.outer.image).toContain('/api/maps/welt/image');
  });

  it('keinen Rand aus einer Karte, die der Betrachter nicht hat', async () => {
    const { hole } = await aufbau();
    expect((await hole('Sela', '/api/maps/raum/context')).json().outer).toBeNull();
    expect((await hole('Mira', '/api/maps/raum/context')).json().outer).toMatchObject({ id: 'geheim' });
  });
});
