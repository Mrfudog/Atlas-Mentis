/**
 * Würfe auf einem Artikel (T-172): der Server würfelt, der Wurf steht im
 * Protokoll und im Log des Artikels, gesiebt nach Sichtbarkeit; verdeckt
 * sieht ihn nur die Leitung. Erfundene Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { naturalD20, rollDice, rollVisible, withAdvantage, type Entity, type RollEntry } from '@nw/model';
import { buildApp } from '../src/app.js';
import { LocalChangeFeed } from '../src/live.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });

function bestand(playerRolls?: string): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: playerRolls ? { playerRolls } : {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: { ...ident('Rook', 'playercharacter-0001') }, relations: [im('pc_rook')] },
    { id: 'cr_wolf', name: 'Wolf', interfaces: ['Creature'], components: ident('Wolf', 'creature-0001'), relations: [im('cr_wolf')] },
    { id: 'sb_wolf', name: 'Wolf stats', interfaces: ['Statblock'], components: ident('Wolf stats', 'statblock-0001'),
      relations: [im('sb_wolf'), { id: 'sb_wolf_b', type: 'belongsTo', to: 'cr_wolf', props: {} }] },
    { id: 'cr_geheim', name: 'Lurker', interfaces: ['Creature'], components: { ...ident('Lurker', 'creature-0002'), Visibility: { audience: 'gm' } },
      relations: [im('cr_geheim')] },
    { id: 'se_1', name: 'Evening 1', interfaces: ['Session'], components: { ...ident('Evening 1', 'session-0001'), Session: { activeScene: 'sc_1' } },
      relations: [im('se_1')] },
  ];
}

async function aufbau(playerRolls?: string) {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, bestand(playerRolls));
  const live = new LocalChangeFeed({ flushMs: 1 });
  const app = buildApp({ repo, live });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player' | 'spectator'>, actorIds: string[] = []) =>
    repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles });
  await konto('Gwen', { camp_a: 'gm' });
  await konto('Sela', { camp_a: 'player' }, ['pc_rook']);
  await konto('Zaun', { camp_a: 'spectator' });
  const cookies = new Map<string, string>();
  const cookie = async (name: string) => {
    if (!cookies.has(name)) {
      const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      cookies.set(name, `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return cookies.get(name)!;
  };
  const wirf = async (name: string, payload: object) =>
    app.inject({ method: 'POST', url: '/api/rolls', payload, headers: { cookie: await cookie(name) } });
  const log = async (name: string, query: string) =>
    app.inject({ method: 'GET', url: `/api/rolls?${query}`, headers: { cookie: await cookie(name) } });
  return { repo, live, wirf, log };
}

describe('Würfelausdrücke mit Vorteil (T-172)', () => {
  it('schreibt den ersten W20 um und lässt Schaden stehen', () => {
    expect(withAdvantage('+4', 'adv')).toBe('2d20kh1+4');
    expect(withAdvantage('1d20-1', 'dis')).toBe('2d20kl1-1');
    expect(withAdvantage('2d6+3', 'adv')).toBe('2d6+3');
    expect(withAdvantage('1d20+2', undefined)).toBe('1d20+2');
  });
  it('kennt die natürliche Zahl und den kritischen Treffer', () => {
    expect(naturalD20(rollDice('1d20+5', () => 0.999))).toEqual({ nat: 20, crit: 'crit' });
    expect(naturalD20(rollDice('2d20kh1', () => 0))).toEqual({ nat: 1, crit: 'fumble' });
    expect(naturalD20(rollDice('2d6', () => 0.5))).toBeNull();
  });
  it('rollVisible: Artikel zuerst, dann wer würfelte, Leitung, verdeckt, Tisch', () => {
    const w = { by: { id: 'u1', name: 'A' }, campaign: 'c', hidden: undefined };
    expect(rollVisible(w, { id: 'u2', roles: { c: 'player' } }, true)).toBe(true);
    expect(rollVisible(w, { id: 'u2', roles: { c: 'player' } }, false)).toBe(false);
    expect(rollVisible(w, { id: 'u2', roles: {} }, true)).toBe(false);
    expect(rollVisible({ ...w, hidden: true }, { id: 'u2', roles: { c: 'player' } }, true)).toBe(false);
    expect(rollVisible({ ...w, hidden: true }, { id: 'u2', roles: { c: 'co-gm' } }, true)).toBe(true);
    expect(rollVisible({ ...w, hidden: true }, { id: 'u1', roles: { c: 'player' } }, true)).toBe(true);
    expect(rollVisible(w, null, true)).toBe(false);
  });
});

describe('POST /api/rolls (T-172)', () => {
  it('würfelt am Server und schreibt einen Eintrag ins Protokoll', async () => {
    const { repo, wirf } = await aufbau();
    const r = await wirf('Sela', { expr: '1d20+3', subject: 'pc_rook', label: 'Athletics' });
    expect(r.statusCode).toBe(200);
    const w = r.json() as RollEntry;
    expect(w.total).toBeGreaterThanOrEqual(4);
    expect(w.total).toBeLessThanOrEqual(23);
    expect(w).toMatchObject({ subject: 'pc_rook', label: 'Athletics', modifier: 3, campaign: 'camp_a', session: 'se_1', actor: { id: 'pc_rook', name: 'Rook' } });
    expect(w.by.name).toBe('Sela');
    const ev = await repo.listEvents({ name: 'roll' });
    expect(ev).toHaveLength(1);
    expect(ev[0]!.subject).toBe('pc_rook');
    expect((ev[0]!.payload as { total: number }).total).toBe(w.total);
  });

  it('lehnt Unsinn, Zuschauer und verborgene Artikel ab', async () => {
    const { wirf } = await aufbau();
    expect((await wirf('Sela', { expr: 'zwei Würfel' })).statusCode).toBe(422);
    expect((await wirf('Zaun', { expr: '1d6' })).statusCode).toBe(403);
    expect((await wirf('Sela', { expr: '1d6', subject: 'cr_geheim' })).statusCode).toBe(404);
    expect((await wirf('Sela', { expr: '1d6', hidden: true })).statusCode).toBe(403);
  });

  it('Vorteil: zwei W20, der höhere zählt', async () => {
    const { wirf } = await aufbau();
    const w = (await wirf('Gwen', { expr: '+2', mode: 'adv', subject: 'cr_wolf' })).json() as RollEntry;
    expect(w.expr).toBe('2d20kh1+2');
    expect(w.asked).toBe('+2');
    expect(w.rolls.filter((x) => 'd' in x)).toHaveLength(2);
    expect(w.nat).toBeGreaterThanOrEqual(1);
  });

  it('meldet den Wurf über den Live-Kanal', async () => {
    const { live, wirf } = await aufbau();
    const gehoert: unknown[] = [];
    live.subscribe((b) => gehoert.push(...b));
    await wirf('Sela', { expr: '1d6', subject: 'cr_wolf' });
    live.flush();
    expect(gehoert).toEqual([expect.objectContaining({ kind: 'roll', entry: expect.objectContaining({ subject: 'cr_wolf' }) })]);
  });
});

describe('GET /api/rolls — das Log am Artikel (T-172)', () => {
  it('an der Kreatur auch die Würfe auf ihrem Statblock, neueste zuerst', async () => {
    const { wirf, log } = await aufbau();
    await wirf('Gwen', { expr: '1d6', subject: 'cr_wolf', label: 'erst' });
    await wirf('Gwen', { expr: '+4', subject: 'sb_wolf', label: 'Bite' });
    await wirf('Gwen', { expr: '1d4', subject: 'pc_rook' });
    const r = (await log('Sela', 'subject=cr_wolf')).json() as { entries: RollEntry[]; people: { name: string }[] };
    expect(r.entries.map((e) => e.label)).toEqual(['Bite', 'erst']);
    expect(r.entries[0]!.subjectName).toBe('Wolf stats');
    expect(r.people.map((p) => p.name)).toEqual(['Gwen']);
    const sb = (await log('Sela', 'subject=sb_wolf')).json() as { entries: RollEntry[] };
    expect(sb.entries.map((e) => e.label)).toEqual(['Bite']);
  });

  it('an der Sitzung alle Würfe, die während ihr fielen; filterbar nach Person, seitenweise', async () => {
    const { wirf, log } = await aufbau();
    await wirf('Gwen', { expr: '1d6', subject: 'cr_wolf' });
    await wirf('Sela', { expr: '1d6', subject: 'pc_rook' });
    await wirf('Sela', { expr: '1d8', subject: 'pc_rook' });
    const alle = (await log('Gwen', 'subject=se_1')).json() as { entries: RollEntry[]; people: { id: string; name: string }[]; total: number };
    expect(alle.total).toBe(3);
    const sela = alle.people.find((p) => p.name === 'Sela')!;
    const nur = (await log('Gwen', `subject=se_1&by=${sela.id}&limit=1`)).json() as { entries: RollEntry[]; next: number | null; total: number };
    expect(nur.total).toBe(2);
    expect(nur.entries).toHaveLength(1);
    expect(nur.next).toBe(1);
  });

  it('wer den Artikel nicht sieht, sieht weder Log noch Würfe darauf', async () => {
    const { wirf, log } = await aufbau();
    await wirf('Gwen', { expr: '1d20', subject: 'cr_geheim' });
    expect((await log('Sela', 'subject=cr_geheim')).statusCode).toBe(404);
    expect((await log('Gwen', 'subject=cr_geheim')).json().entries).toHaveLength(1);
    expect((await log('Sela', 'subject=se_1')).json().entries).toHaveLength(0);
  });

  it('verdeckt: nur die Leitung sieht Eintrag und Ergebnis', async () => {
    const { wirf, log } = await aufbau();
    await wirf('Gwen', { expr: '1d20', subject: 'cr_wolf', hidden: true });
    expect((await log('Sela', 'subject=cr_wolf')).json().entries).toHaveLength(0);
    expect((await log('Gwen', 'subject=cr_wolf')).json().entries[0].hidden).toBe(true);
  });

  it('Spielerwürfe nur für die Leitung (Campaign.playerRolls)', async () => {
    const { wirf, log } = await aufbau('gm');
    const w = (await wirf('Sela', { expr: '1d20', subject: 'cr_wolf' })).json() as RollEntry;
    expect(w.hidden).toBe(true);
    expect((await log('Zaun', 'subject=cr_wolf')).json().entries).toHaveLength(0);
    expect((await log('Sela', 'subject=cr_wolf')).json().entries).toHaveLength(1);
    expect((await log('Gwen', 'subject=cr_wolf')).json().entries).toHaveLength(1);
  });

  it('ein gelöschter Artikel lässt seine Würfe im Log der Sitzung stehen', async () => {
    const { repo, wirf, log } = await aufbau();
    await wirf('Gwen', { expr: '1d6', subject: 'cr_wolf' });
    await repo.deleteEntity('cr_wolf');
    const e = (await log('Sela', 'subject=se_1')).json().entries as RollEntry[];
    expect(e).toHaveLength(1);
    expect(e[0]!.subjectName).toBeNull();
  });
});
