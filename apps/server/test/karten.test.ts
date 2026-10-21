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
  /* Der Standort (T-330): die Weltkarte zeigt ein Land, das in einem Kontinent liegt, den nur die Leitung kennt. */
  art('ort_kontinent', 'Place', 'Kontinent', { Visibility: { audience: 'gm' } }),
  art('ort_land', 'Place', 'Nebelland', {}, [{ id: 'po2', type: 'partOf', to: 'ort_kontinent', props: {} }]),
  art('welt', 'Map', 'Welt', { Image: { image: 'as_welt' }, Map: { gridShape: 'hex' } }, [{ id: 'mo', type: 'mapOf', to: 'ort_land', props: {} }]),
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
  art('npc_wache', 'Creature', 'Wache'),
  art('sb_ghul', 'Statblock', 'Ghul', { Statblock: { token: 'as_ghul_token' } }, [{ id: 'bt', type: 'belongsTo', to: 'npc_dunkel', props: {} }]),
  art('enc_gruft', 'Encounter', 'Ghule', { Encounter: { round: 1, turn: 1 } }, [
    { id: 'p1', type: 'participates', to: 'pc_1', props: { init: 18 } },
    { id: 'p2', type: 'participates', to: 'npc_dunkel', props: { init: 12, revealed: true } },
    { id: 'p3', type: 'participates', to: 'npc_wache', props: { init: 8 } },
    { id: 'om', type: 'onMap', to: 'gruft', props: {} },
  ]),
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
  return { hole, repo };
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
    /* Das Tokenbild kommt vom Statblock (T-119). */
    expect(gm.targets['npc_dunkel'].image).toBe('as_ghul_token');
  });
});

describe('initiative on the map (REQ-144)', () => {
  it('names whose token is up and next — for players only what their order shows', async () => {
    const { hole } = await aufbau();
    const gm = (await hole('Mira', '/api/maps/gruft/context')).json();
    expect(gm.turn).toMatchObject({ encounter: 'enc_gruft', round: 1, current: 'npc_dunkel', next: 'npc_wache' });
    expect(gm.combatants).toEqual([
      { id: 'pc_1', name: 'Rook', placed: true },
      { id: 'npc_dunkel', name: 'Ghul', placed: true },
      { id: 'npc_wache', name: 'Wache', placed: false },
    ]);
    const sp = (await hole('Sela', '/api/maps/gruft/context')).json();
    /* Der Ghul steht im Nebel — sein Token kommt nicht an, also auch kein Ring. */
    expect(sp.turn).toMatchObject({ encounter: 'enc_gruft', current: null, next: null });
    expect(sp.combatants).toEqual([]);
  });
  it('rings the own figure when it is up, and hides an enemy whose turn has not come (D58)', async () => {
    const { hole, repo } = await aufbau();
    const enc = (await repo.getEntity('enc_gruft'))!;
    await repo.putEntity({ ...enc, components: { ...enc.components, Encounter: { round: 1, turn: 0 } } });
    const sp = (await hole('Sela', '/api/maps/gruft/context')).json();
    expect(sp.turn).toMatchObject({ current: 'pc_1', next: null });
    const gm = (await hole('Mira', '/api/maps/gruft/context')).json();
    expect(gm.turn).toMatchObject({ current: 'pc_1', next: 'npc_dunkel' });
  });
  it('has no turn on a map without a running fight', async () => {
    const { hole } = await aufbau();
    expect((await hole('Mira', '/api/maps/stadt/context')).json().turn).toBeNull();
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

  /* T-202: die Maske schreibt `activeMap` in die Karte `Session` (eine
     Karte je Art, die das Feld erklärt) — gelesen wurde nur `SessionState`,
     und die gewählte Karte lag in Play nie auf dem Tisch. */
  it('reads the map the session form writes (card Session)', async () => {
    const { hole, repo } = await aufbau();
    const s3 = { ...(await repo.getEntity('s_1'))!, id: 's_3', components: { Identity: { name: 'Abend 3', id: 'session-s_3', aliases: [] }, Time: { sort: 3 }, Session: { activeMap: 'gruft' } } };
    await repo.putEntity(s3);
    const p = (await hole('Mira', '/api/play')).json();
    expect(p).toMatchObject({ session: 's_3', map: 'gruft' });
    expect(p.sessions.find((x: { id: string }) => x.id === 's_3')).toMatchObject({ activeMap: 'gruft', mapName: 'Gruft' });
  });
});

/* Karten finden (T-202): die Liste unter Play › Maps und wo eine Karte vorkommt. */
describe('/api/maps', () => {
  it('lists the maps as a tree, as far as the viewer sees them', async () => {
    const { hole } = await aufbau();
    const gm = (await hole('Mira', '/api/maps')).json() as { maps: { id: string; depth: number; parent: string | null; image: string; layers: { name: string }[] }[] };
    expect(gm.maps.map((m) => [m.id, m.depth])).toEqual([
      ['gruft', 0],
      ['kammer', 1],
      ['nische', 1],
      ['welt', 0],
      ['stadt', 1],
      ['keller', 2],
    ]);
    expect(gm.maps.find((m) => m.id === 'stadt')).toMatchObject({ parent: 'welt', image: 'as_stadt', layers: [{ name: 'Nebel' }] });
    const sp = (await hole('Sela', '/api/maps')).json() as { maps: { id: string; location: { name: string }[] }[] };
    expect(sp.maps.map((m) => m.id)).not.toContain('keller');
    /* T-330: der Standort, die Unterkarte bei ihrer Karte; der Weg endet vor dem verborgenen Ort. */
    const ort = (r: { maps: { id: string; location?: { name: string }[] }[] }, id: string) => r.maps.find((m) => m.id === id)?.location?.map((l) => l.name);
    expect(ort(gm, 'stadt')).toEqual(['Nebelland', 'Kontinent']);
    expect(ort(sp, 'stadt')).toEqual(['Nebelland']);
    expect(ort(sp, 'gruft')).toEqual([]);
  });

  it('says where a map is used — sessions and fights the viewer sees', async () => {
    const { hole } = await aufbau();
    const stadt = (await hole('Mira', '/api/maps/stadt/uses')).json();
    expect(stadt.uses).toEqual([{ id: 's_2', name: 'Abend 2', type: 'Session', via: 'SessionState.activeMap' }]);
    const gruft = (await hole('Mira', '/api/maps/gruft/uses')).json();
    expect(gruft.uses).toEqual([{ id: 'enc_gruft', name: 'Ghule', type: 'Encounter', via: 'onMap' }]);
    expect((await hole('Sela', '/api/maps/keller/uses')).statusCode).toBe(404);
    expect((await hole('Mira', '/api/maps/npc_offen/uses')).statusCode).toBe(404);
  });
});

describe('the side bar of a map (T-203)', () => {
  it('lists the party for everyone and the encounters of the session only for the GM', async () => {
    const { hole } = await aufbau();
    const mira = (await hole('Mira', '/api/maps/gruft/side?session=s_2')).json() as {
      party: { id: string } | null;
      figures: { id: string; name: string }[];
      session: { id: string } | null;
      encounters: { id: string; here: boolean; participants: { id: string }[] }[];
    };
    expect(mira.party?.id).toBe('pt_1');
    expect(mira.figures.map((f) => f.name)).toEqual(['Rook']);
    expect(mira.session?.id).toBe('s_2');
    expect(mira.encounters.map((e) => e.id)).toEqual(['enc_gruft']);
    expect(mira.encounters[0]).toMatchObject({ here: true });
    expect(mira.encounters[0]!.participants.map((p) => p.id)).toEqual(['pc_1', 'npc_dunkel', 'npc_wache']);
    const sela = (await hole('Sela', '/api/maps/gruft/side')).json() as typeof mira;
    expect(sela.figures.map((f) => f.name)).toEqual(['Rook']);
    expect(sela.encounters).toEqual([]);
    expect(sela.session).toBeNull();
  });

  it('picks the session that has this map on the table when none is named', async () => {
    const { hole } = await aufbau();
    const mira = (await hole('Mira', '/api/maps/stadt/side')).json() as { session: { id: string } | null };
    expect(mira.session?.id).toBe('s_2');
    expect((await hole('Mira', '/api/maps/nix/side')).statusCode).toBe(404);
  });
});

describe('starting an encounter (T-203)', () => {
  it('rolls initiative where none stands, reveals prepared tokens and lets the session lead it — GM only', async () => {
    const vorbereitet: Entity[] = bestand.map((e) => {
      if (e.id === 'gruft') {
        return {
          ...e,
          relations: [...(e.relations ?? []), { id: 'v1', type: 'marker', to: 'npc_wache', props: { x: 0.6, y: 0.6, kind: 'play', hidden: true, encounter: 'enc_neu' } }],
        };
      }
      return e;
    });
    vorbereitet.push(
      art('enc_neu', 'Encounter', 'Wachwechsel', { Encounter: { phase: 'planned', round: 0 } }, [
        { id: 'n1', type: 'participates', to: 'npc_wache', props: {} },
        { id: 'n2', type: 'participates', to: 'pc_1', props: { init: 15 } },
        { id: 'n3', type: 'onMap', to: 'gruft', props: {} },
      ]),
    );
    const repo = new InMemoryRepository({ ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } }, vorbereitet);
    const app = buildApp({ repo });
    for (const [name, role] of [['Mira', 'gm'], ['Sela', 'player']] as const) {
      await repo.putUser({ id: `u_${name.toLowerCase()}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles: { camp_nebel: role } });
    }
    const keks = async (name: string) => {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      return `nw_session=${res.cookies.find((x) => x.name === 'nw_session')!.value}`;
    };
    const start = async (name: string) =>
      app.inject({ method: 'POST', url: '/api/encounters/enc_neu/start', headers: { cookie: await keks(name) }, payload: { session: 's_1' } });

    expect((await start('Sela')).statusCode).toBe(403);
    const res = await start('Mira');
    expect(res.statusCode, res.body).toBe(200);
    /* Begonnen wird eine Instanz (T-289): auf einer Instanz der Karte, und die Sitzung zeigt auf beide. */
    const { encounter: id } = res.json() as { encounter: string };
    expect(res.json()).toMatchObject({ revealed: 1, session: 's_1' });
    expect(id).not.toBe('enc_neu');
    const enc = (await repo.getEntity(id))!;
    expect(enc.components['Encounter']).toMatchObject({ phase: 'running', round: 1, turn: 0 });
    const inits = (enc.relations ?? []).filter((r) => r.type === 'participates').map((r) => (r.props as { init?: number }).init);
    expect(inits[1]).toBe(15);
    expect(inits[0]).toBeGreaterThanOrEqual(1);
    expect((await repo.getEntity('enc_neu'))!.components['Encounter']).toMatchObject({ round: 0 });
    const karteId = (enc.relations ?? []).find((r) => r.type === 'onMap')!.to;
    expect(karteId).not.toBe('gruft');
    const karte = (await repo.getEntity(karteId))!;
    expect((karte.relations ?? []).find((r) => r.id.startsWith('v1'))!.props).toEqual({ x: 0.6, y: 0.6, kind: 'play' });
    const sitzung = (await repo.getEntity('s_1'))!;
    expect((sitzung.components['Session'] ?? sitzung.components['SessionState']) as object).toMatchObject({ activeEncounter: id, activeMap: karteId });
    /* Noch einmal: dieselbe Instanz der Sitzung, und die läuft schon. */
    expect((await start('Mira')).statusCode).toBe(409);
  });
});
