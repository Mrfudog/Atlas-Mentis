/**
 * Karten am Tisch (T-115): was ein Spieler von einer Karte bekommt, was
 * neben ihr steht (Brotkrumen, Unterkarten, Gruppe) und welche Karte auf
 * dem Tisch liegt.
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
    components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
    relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
  },
  art('pt_1', 'Party', 'Die Wache', {}, [{ id: 'po', type: 'partyOf', to: 'camp_nebel', props: {} }]),
  art('pc_1', 'PlayerCharacter', 'Rook', {}, [{ id: 'mp', type: 'memberOfParty', to: 'pt_1', props: {} }]),
  art('npc_offen', 'Creature', 'Volo'),
  art('npc_geheim', 'Creature', 'Der Fremde', { Visibility: { audience: 'gm' } }),
  art('welt', 'Map', 'Welt', { Image: { image: 'as_welt' }, Map: { gridShape: 'hex' } }),
  art(
    'stadt',
    'Map',
    'Hafenstadt',
    {
      Image: { image: 'as_stadt' },
      Map: { baseGmOnly: false, sheets: [{ id: 's1', image: 'as_sl', gmOnly: true }, { id: 's2', image: 'as_alle' }] },
    },
    [
      { id: 'in', type: 'insideMap', to: 'welt', props: { x: 0.5, y: 0.5, w: 0.1, h: 0.2 } },
      { id: 'm1', type: 'marker', to: 'npc_offen', props: { x: 0.2, y: 0.2 } },
      { id: 'm2', type: 'marker', to: 'npc_geheim', props: { x: 0.3, y: 0.3 } },
      { id: 'm3', type: 'marker', to: 'npc_offen', props: { x: 0.4, y: 0.4, hidden: true } },
      { id: 'm4', type: 'marker', to: 'pc_1', props: { x: 0.5, y: 0.5, kind: 'party' } },
    ],
  ),
  art('keller', 'Map', 'Keller', { Visibility: { audience: 'gm' } }, [
    { id: 'in2', type: 'insideMap', to: 'stadt', props: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } },
  ]),
  art('npc_dunkel', 'Creature', 'Ghul'),
  art(
    'gruft',
    'Map',
    'Gruft',
    { Image: { image: 'as_gruft' }, Map: { fog: true, reveal: [{ id: 'r1', kind: 'rect', x: 0, y: 0, w: 0.5, h: 0.5 }] } },
    [
      { id: 'g1', type: 'marker', to: 'npc_offen', props: { x: 0.2, y: 0.2 } },
      { id: 'g2', type: 'marker', to: 'npc_dunkel', props: { x: 0.8, y: 0.8 } },
      { id: 'g3', type: 'marker', to: 'pc_1', props: { x: 0.9, y: 0.9 } },
    ],
  ),
  art('kammer', 'Map', 'Kammer', {}, [{ id: 'in3', type: 'insideMap', to: 'gruft', props: { x: 0.7, y: 0.7, w: 0.1, h: 0.1 } }]),
  art('nische', 'Map', 'Nische', {}, [{ id: 'in4', type: 'insideMap', to: 'gruft', props: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } }]),
  art('s_1', 'Session', 'Abend 1', { Time: { sort: 1 } }),
  art('s_2', 'Session', 'Abend 2', { Time: { sort: 2 }, SessionState: { activeMap: 'stadt' } }),
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
  return { hole };
}

const marker = (e: Entity) => (e.relations ?? []).filter((r) => r.type === 'marker').map((r) => r.id);

describe('a map, as a player gets it', () => {
  it('leaves out hidden markers, markers on unseen articles and GM sheets', async () => {
    const { hole } = await aufbau();
    const sela = (await hole('Sela', '/api/entities/stadt')).json() as Entity;
    expect(marker(sela)).toEqual(['m1', 'm4']);
    const sheets = (sela.components['Map'] as { sheets: { id: string }[] }).sheets.map((s) => s.id);
    expect(sheets).toEqual(['s2']);
    const mira = (await hole('Mira', '/api/entities/stadt')).json() as Entity;
    expect(marker(mira)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });
});

describe('/api/maps/:id/context', () => {
  it('names the maps above and the frames inside, as far as the viewer sees them', async () => {
    const { hole } = await aufbau();
    const gm = (await hole('Mira', '/api/maps/stadt/context')).json();
    expect(gm.parents).toEqual([{ id: 'welt', name: 'Welt' }]);
    expect(gm.children.map((c: { id: string }) => c.id)).toEqual(['keller']);
    expect(gm.targets['npc_geheim'].name).toBe('Der Fremde');
    const sp = (await hole('Sela', '/api/maps/stadt/context')).json();
    expect(sp.children).toEqual([]);
    expect(sp.targets['npc_geheim']).toBeUndefined();
    expect(sp.targets['npc_offen']).toMatchObject({ name: 'Volo', type: 'Creature' });
  });
  it('shows the party on the map above, through the frame', async () => {
    const { hole } = await aufbau();
    const welt = (await hole('Sela', '/api/maps/welt/context')).json();
    expect(welt.party).toMatchObject({ id: 'pt_1', mapId: 'stadt', mapName: 'Hafenstadt', direct: false });
    expect(welt.party.x).toBeCloseTo(0.55);
    expect(welt.party.y).toBeCloseTo(0.6);
    const stadt = (await hole('Sela', '/api/maps/stadt/context')).json();
    expect(stadt.party).toMatchObject({ direct: true, x: 0.5 });
  });
  it('is not found for a map the viewer cannot see', async () => {
    const { hole } = await aufbau();
    expect((await hole('Sela', '/api/maps/keller/context')).statusCode).toBe(404);
  });
});

describe('fog of war (REQ-139)', () => {
  it('withholds markers and frames under the fog from players, but not their own figure', async () => {
    const { hole } = await aufbau();
    const sela = (await hole('Sela', '/api/entities/gruft')).json() as Entity;
    expect(marker(sela)).toEqual(['g1', 'g3']);
    expect((sela.components['Map'] as { reveal: unknown[] }).reveal).toHaveLength(1);
    const mira = (await hole('Mira', '/api/entities/gruft')).json() as Entity;
    expect(marker(mira)).toEqual(['g1', 'g2', 'g3']);
    const sp = (await hole('Sela', '/api/maps/gruft/context')).json();
    expect(sp.children.map((c: { id: string }) => c.id)).toEqual(['nische']);
    expect(sp.targets['npc_dunkel']).toBeUndefined();
    const gm = (await hole('Mira', '/api/maps/gruft/context')).json();
    expect(gm.children.map((c: { id: string }) => c.id)).toEqual(['kammer', 'nische']);
  });
});

describe('/api/play', () => {
  it('follows the newest session with a map on the table', async () => {
    const { hole } = await aufbau();
    const p = (await hole('Sela', '/api/play')).json();
    expect(p.session).toBe('s_2');
    expect(p.map).toBe('stadt');
    expect(p.sessions.map((s: { id: string }) => s.id)).toEqual(['s_2', 's_1']);
    const gewaehlt = (await hole('Sela', '/api/play?session=s_1')).json();
    expect(gewaehlt).toMatchObject({ session: 's_1', map: null });
  });
});
