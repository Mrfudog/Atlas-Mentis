/**
 * Zonen und Gebiete auf der Karte (T-219, REQ-193): was Spielende davon
 * bekommen, und was der Kartenkontext über ihre Ziele sagt.
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
  art('pc_1', 'PlayerCharacter', 'Rook'),
  art('zk_eis', 'ZoneKind', 'Ice', { ZoneKind: { moveCost: 2 } }),
  art('zk_falle', 'ZoneKind', 'Pit trap', { ZoneKind: { hiddenUntil: 15, damage: '2d6' } }),
  art('fac_offen', 'Faction', 'Zentarim'),
  art('fac_geheim', 'Faction', 'Kult', { Visibility: { audience: 'gm' } }),
  art('feld', 'Map', 'Feld', { Image: { image: 'as_feld' }, Map: { gridShape: 'square', gridSize: 40 } }, [
    { id: 'z1', type: 'zone', to: 'zk_eis', props: { kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.1 } },
    { id: 'z2', type: 'zone', to: 'zk_falle', props: { kind: 'rect', x: 0.5, y: 0.5, w: 0.1, h: 0.1 } },
    { id: 'z3', type: 'zone', to: 'zk_falle', props: { kind: 'rect', x: 0.7, y: 0.7, w: 0.1, h: 0.1, found: true } },
    { id: 't1', type: 'territory', to: 'fac_offen', props: { kind: 'circle', x: 0.5, y: 0.5, r: 0.2 } },
    { id: 't2', type: 'territory', to: 'fac_geheim', props: { kind: 'circle', x: 0.2, y: 0.8, r: 0.1 } },
  ]),
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

const flaechen = (e: Entity) => (e.relations ?? []).filter((r) => r.type === 'zone' || r.type === 'territory').map((r) => r.id);

describe('zones and territories on a map (T-219)', () => {
  it('leaves out hidden zones not yet found and territories of unseen articles for players', async () => {
    const { hole } = await aufbau();
    const sela = (await hole('Sela', '/api/entities/feld')).json() as Entity;
    expect(flaechen(sela)).toEqual(['z1', 'z3', 't1']);
    const mira = (await hole('Mira', '/api/entities/feld')).json() as Entity;
    expect(flaechen(mira)).toEqual(['z1', 'z2', 'z3', 't1', 't2']);
  });

  it('names what the areas point to, with the rule of a zone kind, as far as the viewer sees it', async () => {
    const { hole } = await aufbau();
    const sp = (await hole('Sela', '/api/maps/feld/context')).json();
    expect(sp.areas['zk_eis']).toEqual({ name: 'Ice', type: 'ZoneKind', rule: { moveCost: 2 } });
    expect(sp.areas['fac_offen']).toEqual({ name: 'Zentarim', type: 'Faction' });
    expect(sp.areas['fac_geheim']).toBeUndefined();
    const gm = (await hole('Mira', '/api/maps/feld/context')).json();
    expect(gm.areas['zk_falle']).toEqual({ name: 'Pit trap', type: 'ZoneKind', rule: { hidden: true, damage: '2d6' } });
    expect(gm.areas['fac_geheim'].name).toBe('Kult');
  });
});
