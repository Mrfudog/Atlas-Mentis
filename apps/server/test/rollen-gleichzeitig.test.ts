/**
 * **Zwei Rollenänderungen am selben Konto zugleich** (T-452): zwei Läufe
 * nahmen dasselbe Konto als `gm` in zwei Kampagnen auf, und danach fehlte
 * eine der beiden Rollen. Die Routen lasen das Konto, setzten `roles[c]`
 * und schrieben es mit `putUser` ganz zurück — und `putUser` glich
 * `campaign_member` auf genau diese Rollen ab. Der zweite Schreiber
 * löschte die Rolle des ersten. Jetzt wird eine Rolle je (Konto, Kampagne)
 * einzeln geschrieben (`setRole`), und `putUser` fasst Rollen nur beim
 * Anlegen an.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const ebene = (id: string, n: string): Entity => ({
  id, name: id, interfaces: ['Layer'], components: { ...ident(id, `layer-000${n}`), Layer: { kind: 'campaign', order: 50 } }, relations: [],
});
const kampagne = (id: string, name: string, n: string): Entity => ({
  id, name, interfaces: ['Campaign'], components: ident(name, `campaign-000${n}`),
  relations: [{ id: `${id}_ac`, type: 'activates', to: `ly_${id}`, props: {} }],
});
const figur = (id: string, name: string, n: string, layer: string): Entity => ({
  id, name, interfaces: ['PlayerCharacter'], components: { ...ident(name, `playercharacter-000${n}`), PlayerCharacter: { level: 1 } },
  relations: [{ id: `${id}_in`, type: 'inLayer', to: layer, props: {} }],
});
const ARTIKEL: Entity[] = [
  ebene('ly_camp_a', '1'), ebene('ly_camp_b', '2'),
  kampagne('camp_a', 'Runde A', '1'), kampagne('camp_b', 'Runde B', '2'),
  figur('pc_wren', 'Wren', '1', 'ly_camp_b'),
];

async function aufbau(roles: Record<string, 'gm' | 'co-gm' | 'player' | 'spectator'> = {}) {
  const t = await tisch({ artikel: ARTIKEL, kampagne: 'camp_a', konten: { Admin: { admin: true }, Basil: { roles } } });
  const basil = t.ids.get('Basil')!;
  /* Wie gegen Postgres: Lesen und Schreiben sind je ein Weg zum Server, und
     zwischen beiden kommt die andere Anfrage dran. Im Speicher läuft eine
     Route sonst ohne Pause durch, und der Wettlauf zeigt sich nie. */
  const lesen = t.repo.getUser.bind(t.repo);
  t.repo.getUser = async (id: string) => {
    const u = await lesen(id);
    await new Promise((r) => setTimeout(r, 5));
    return u;
  };
  const rollen = async () => (await t.repo.getUser(basil))?.roles ?? {};
  return { ...t, basil, rollen };
}

describe('roles of one account in two campaigns at the same time (T-452)', () => {
  it('taking the account into two campaigns at once keeps both roles', async () => {
    const { als, basil, rollen } = await aufbau();
    const [a, b] = await Promise.all([
      als('Admin', 'POST', '/api/campaigns/camp_a/members', { payload: { user: basil, role: 'gm' } }),
      als('Admin', 'POST', '/api/campaigns/camp_b/members', { payload: { user: basil, role: 'gm' } }),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
    expect(await rollen()).toEqual({ camp_a: 'gm', camp_b: 'gm' });
  });

  it('a change in one campaign and a removal in the other do not undo each other', async () => {
    const { als, basil, rollen } = await aufbau({ camp_a: 'player', camp_b: 'spectator' });
    const [a, b] = await Promise.all([
      als('Admin', 'PUT', `/api/campaigns/camp_a/members/${basil}`, { payload: { role: 'co-gm' } }),
      als('Admin', 'DELETE', `/api/campaigns/camp_b/members/${basil}`),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(await rollen()).toEqual({ camp_a: 'co-gm' });
  });

  it('a role change next to a character assignment keeps both', async () => {
    const { als, basil, rollen, repo } = await aufbau({ camp_b: 'gm' });
    const [a, b] = await Promise.all([
      als('Admin', 'POST', '/api/campaigns/camp_a/members', { payload: { user: basil, role: 'gm' } }),
      als('Admin', 'PUT', `/api/campaigns/camp_b/members/${basil}/actors`, { payload: { actorIds: ['pc_wren'], party: false } }),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([201, 200]);
    expect(await rollen()).toEqual({ camp_a: 'gm', camp_b: 'gm' });
    expect((await repo.getUser(basil))?.actorIds).toEqual(['pc_wren']);
  });

  it('the member list and /api/me read the roles that stand', async () => {
    const { als, basil, json } = await aufbau();
    await Promise.all([
      als('Admin', 'POST', '/api/campaigns/camp_a/members', { payload: { user: basil, role: 'gm' } }),
      als('Admin', 'POST', '/api/campaigns/camp_b/members', { payload: { user: basil, role: 'player' } }),
    ]);
    const a = await json<{ members: { id: string; role: string }[] }>('Admin', 'GET', '/api/campaigns/camp_a/members');
    const b = await json<{ members: { id: string; role: string }[] }>('Admin', 'GET', '/api/campaigns/camp_b/members');
    expect(a.members.find((m) => m.id === basil)?.role).toBe('gm');
    expect(b.members.find((m) => m.id === basil)?.role).toBe('player');
  });
});
