/**
 * Wer Tokens zieht (T-290, E-040): `Campaign.tokenMove` sagt, welche Tokens
 * Spielende ziehen — keine, die eigenen, die der Gruppe, dazu Verbündete
 * oder alle —, und `Campaign.moves`, ob die Leitung vorher bestätigt.
 * Geprüft am Server, an der Route für die Stelle eines Tokens
 * (`POST /api/maps/:id/move`), im Kartenkontext (`movable`) und im
 * Zugplan. Erfundene Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { markersOf, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { LocalChangeFeed } from '../src/live.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'wer-zieht-am-tisch';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });
const inGruppe = (id: string) => ({ id: `${id}_grp`, type: 'memberOfParty', to: 'party_a', props: {} });

function bestand(kampagne: Record<string, unknown>, kampf: boolean): Entity[] {
  const alle: Entity[] = [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: kampagne },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'party_a', name: 'Die Wache', interfaces: ['Party'], components: ident('Die Wache', 'party-0001'),
      relations: [im('party_a'), { id: 'party_a_of', type: 'partyOf', to: 'camp_a', props: {} }] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'), relations: [im('pc_rook'), inGruppe('pc_rook')] },
    { id: 'pc_mira', name: 'Mira', interfaces: ['PlayerCharacter'], components: ident('Mira', 'playercharacter-0002'), relations: [im('pc_mira'), inGruppe('pc_mira')] },
    /* Ein Packesel der Gruppe: Mitglied, aber keine Spielerfigur. */
    { id: 'cr_esel', name: 'Esel', interfaces: ['Creature'], components: ident('Esel', 'creature-0001'), relations: [im('cr_esel'), inGruppe('cr_esel')] },
    /* Ein Hund, der im Kampf auf der Seite der Gruppe steht — kein Mitglied. */
    { id: 'cr_hund', name: 'Hund', interfaces: ['Creature'], components: ident('Hund', 'creature-0002'), relations: [im('cr_hund')] },
    { id: 'sb_hund', name: 'Hund (Werte)', interfaces: ['Statblock'], components: { ...ident('Hund (Werte)', 'statblock-0001'), Statblock: { speed: '40 ft.' } },
      relations: [im('sb_hund'), { id: 'sb_hund_bt', type: 'belongsTo', to: 'cr_hund', props: {} }] },
    { id: 'cr_gob', name: 'Goblin', interfaces: ['Creature'], components: ident('Goblin', 'creature-0003'), relations: [im('cr_gob')] },
    { id: 'map_1', name: 'Hof', interfaces: ['Map'],
      components: { ...ident('Hof', 'map-0001'), Map: { gridShape: 'square', gridSize: 70 }, Image: { image: 'https://example.org/hof.png' } },
      relations: [im('map_1'),
        { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: 0.1, y: 0.1, kind: 'play' } },
        { id: 'mk_mira', type: 'marker', to: 'pc_mira', props: { x: 0.2, y: 0.2, kind: 'play' } },
        { id: 'mk_esel', type: 'marker', to: 'cr_esel', props: { x: 0.3, y: 0.3, kind: 'play' } },
        { id: 'mk_hund', type: 'marker', to: 'cr_hund', props: { x: 0.4, y: 0.4, kind: 'play' } },
        { id: 'mk_gob', type: 'marker', to: 'cr_gob', props: { x: 0.5, y: 0.5, kind: 'play' } }] },
  ];
  if (kampf) {
    alle.push({ id: 'enc_1', name: 'Überfall', interfaces: ['Encounter'], components: { ...ident('Überfall', 'encounter-0001'), Encounter: { round: 1, turn: 0 } },
      relations: [im('enc_1'), { id: 'enc_1_om', type: 'onMap', to: 'map_1', props: {} },
        { id: 'enc_1_hund', type: 'participates', to: 'cr_hund', props: { initiative: 15, ally: true } },
        { id: 'enc_1_gob', type: 'participates', to: 'cr_gob', props: { initiative: 10 } }] });
  }
  return alle;
}

async function aufbau(kampagne: Record<string, unknown> = {}, kampf = false) {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, bestand(kampagne, kampf));
  const app = buildApp({ repo, live: new LocalChangeFeed({ flushMs: 1 }) });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>, actorIds: string[] = []) => {
    await repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles });
  };
  await konto('Gwen', { camp_a: 'gm' });
  await konto('Sela', { camp_a: 'player' }, ['pc_rook']);
  await konto('Tam', { camp_a: 'player' }, ['pc_mira']);
  const cookies = new Map<string, string>();
  const cookie = async (name: string) => {
    if (!cookies.has(name)) {
      const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      cookies.set(name, `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return cookies.get(name)!;
  };
  const rufe = async (name: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
    app.inject({ method, url, ...(payload ? { payload } : {}), headers: { cookie: await cookie(name) } });
  const zieh = (name: string, rel: string) => rufe(name, 'POST', '/api/maps/map_1/move', { rel, to: { x: 0.8, y: 0.8 } });
  const stelle = async (rel: string) => markersOf((await repo.getEntity('map_1'))!).find((m) => m.rel.id === rel)!;
  const kontext = async (name: string) => (await rufe(name, 'GET', '/api/maps/map_1/context')).json() as { movable: string[]; campaign: string | null; proposals: { actor: string; plan: string }[] };
  return { rufe, zieh, stelle, kontext };
}

describe('Wer Tokens zieht (T-290)', () => {
  it('Vorgabe `own`: die eigene Figur ja, die der Mitspielerin nicht', async () => {
    const { zieh, stelle, kontext } = await aufbau();
    expect((await zieh('Sela', 'mk_mira')).statusCode).toBe(403);
    expect((await zieh('Sela', 'mk_rook')).statusCode).toBe(200);
    expect((await stelle('mk_rook')).x).toBe(0.8);
    expect((await kontext('Sela')).movable).toEqual(['pc_rook']);
    expect((await kontext('Sela')).campaign).toBe('camp_a');
  });

  it('`none`: auch die eigene Figur steht — die Leitung zieht weiter', async () => {
    const { zieh, kontext } = await aufbau({ tokenMove: 'none' });
    expect((await zieh('Sela', 'mk_rook')).statusCode).toBe(403);
    expect((await kontext('Sela')).movable).toEqual([]);
    expect((await zieh('Gwen', 'mk_gob')).statusCode).toBe(200);
  });

  it('`party`: jedes Mitglied der Gruppe, nicht den Hund und nicht den Goblin', async () => {
    const { zieh, kontext } = await aufbau({ tokenMove: 'party' });
    expect((await zieh('Sela', 'mk_mira')).statusCode).toBe(200);
    expect((await zieh('Sela', 'mk_esel')).statusCode).toBe(200);
    expect((await zieh('Sela', 'mk_hund')).statusCode).toBe(403);
    expect((await zieh('Sela', 'mk_gob')).statusCode).toBe(403);
    expect((await kontext('Sela')).movable.sort()).toEqual(['cr_esel', 'pc_mira', 'pc_rook']);
  });

  it('`allies`: im Kampf auch, wer an der Begegnung auf der Seite der Gruppe steht — über den Zugplan', async () => {
    const { rufe, kontext } = await aufbau({ tokenMove: 'allies' }, true);
    expect((await kontext('Sela')).movable.sort()).toEqual(['cr_esel', 'cr_hund', 'pc_mira', 'pc_rook']);
    const plan = (await rufe('Sela', 'GET', '/api/maps/map_1/turn-plan?actor=cr_hund')).json() as { actors: { id: string }[]; actor: { id: string } };
    expect(plan.actors.map((a) => a.id)).toContain('cr_hund');
    expect(plan.actors.map((a) => a.id)).not.toContain('cr_gob');
    expect(plan.actor.id).toBe('cr_hund');
    const ein = await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'cr_hund', steps: [{ id: 's1', kind: 'move', path: [{ x: 5, y: 5 }, { x: 6, y: 5 }], feet: 5, to: { x: 0.45, y: 0.4 } }] });
    expect(ein.statusCode).toBe(200);
    /* Mit `party` ist der Hund nicht zu haben, auch im Kampf nicht. */
    const eng = await aufbau({ tokenMove: 'party' }, true);
    const nein = await eng.rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'cr_hund', steps: [{ id: 's1', kind: 'move', path: [{ x: 5, y: 5 }, { x: 6, y: 5 }], feet: 5, to: { x: 0.45, y: 0.4 } }] });
    expect(nein.statusCode).toBe(403);
  });

  it('`all`: jedes Token, das man sieht', async () => {
    const { zieh, kontext } = await aufbau({ tokenMove: 'all' });
    expect((await zieh('Sela', 'mk_gob')).statusCode).toBe(200);
    expect((await kontext('Sela')).movable.length).toBe(5);
  });

  it('mit Bestätigung schreibt erst die Freigabe — und den Vorschlag sieht jeder am Tisch', async () => {
    const { rufe, zieh, stelle, kontext } = await aufbau({ tokenMove: 'party', moves: 'confirm' });
    const r = await zieh('Sela', 'mk_mira');
    expect(r.statusCode).toBe(202);
    expect((await stelle('mk_mira')).x).toBe(0.2);
    const vorschlag = (await kontext('Tam')).proposals.find((p) => p.actor === 'pc_mira');
    expect(vorschlag).toBeDefined();
    /* Spielende entscheiden nicht. */
    expect((await rufe('Tam', 'POST', `/api/maps/map_1/turn-plan/${vorschlag!.plan}/decide`, { decision: 'confirm' })).statusCode).toBe(403);
    expect((await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${vorschlag!.plan}/decide`, { decision: 'confirm' })).statusCode).toBe(200);
    expect((await stelle('mk_mira')).x).toBe(0.8);
    expect((await kontext('Tam')).proposals).toEqual([]);
  });

  it('verworfen bleibt das Token stehen', async () => {
    const { rufe, zieh, stelle, kontext } = await aufbau({ moves: 'confirm' });
    expect((await zieh('Sela', 'mk_rook')).statusCode).toBe(202);
    const [v] = (await kontext('Gwen')).proposals;
    expect((await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${v!.plan}/decide`, { decision: 'reject' })).statusCode).toBe(200);
    expect((await stelle('mk_rook')).x).toBe(0.1);
  });
});
