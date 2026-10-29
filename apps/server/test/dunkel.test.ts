/**
 * Tokens im Dunkeln (T-219): auf einer dunklen Karte bekommt die
 * Spielerin nur, was ihre Figur sieht — die Leitung alles.
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
  art('ghul_nah', 'Creature', 'Ghul'),
  art('ghul_licht', 'Creature', 'Ghul im Licht'),
  art('as_gruft', 'Asset', 'Gruftbild', { Asset: { width: 100, height: 100 } }),
  /* Felder zu 10 px bei 5 ft; Rook ohne Dunkelsicht. Eine Laterne steht beim zweiten Ghul. */
  art('gruft', 'Map', 'Gruft', { Image: { image: 'as_gruft' }, Map: { gridShape: 'square', gridSize: 10, scale: '5 ft', lighting: 'dark' } }, [
    { id: 'm_ich', type: 'marker', to: 'pc_1', props: { kind: 'play', x: 0.1, y: 0.1 } },
    { id: 'm_nah', type: 'marker', to: 'ghul_nah', props: { kind: 'play', x: 0.3, y: 0.1 } },
    { id: 'm_licht', type: 'marker', to: 'ghul_licht', props: { kind: 'play', x: 0.9, y: 0.9 } },
    { id: 'm_lampe', type: 'marker', to: 'gruft', props: { kind: 'light', x: 0.9, y: 0.85, light: 2, dim: 3 } },
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

const marker = (e: Entity) => (e.relations ?? []).filter((r) => r.type === 'marker').map((r) => r.id);

describe('tokens in the dark (T-219)', () => {
  it('a player gets only the tokens her character sees — in light or with darkvision', async () => {
    const { hole } = await aufbau();
    const sela = (await hole('Sela', '/api/entities/gruft')).json() as Entity;
    expect(marker(sela)).toEqual(['m_ich', 'm_licht', 'm_lampe']);
    const mira = (await hole('Mira', '/api/entities/gruft')).json() as Entity;
    expect(marker(mira)).toEqual(['m_ich', 'm_nah', 'm_licht', 'm_lampe']);
  });
});
