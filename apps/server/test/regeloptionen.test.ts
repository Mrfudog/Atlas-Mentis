/**
 * Die Regeloptionen einer Kampagne (T-190): `GET /api/campaigns/:id/rules`.
 * Seit T-270 aus Regelartikeln (System, Regel, Option mit `Rule.key`); ein
 * Artikel zählt nur, wenn er im Stapel steht und der Betrachter ihn sieht.
 * Erfundene Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity, RuleSortState } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string, status = 'ready') => ({ Identity: { name, id, aliases: [] }, Status: { status } });
const im = (id: string, ebene = 'ly_a') => ({ id: `${id}_in`, type: 'inLayer', to: ebene, props: {} });
const regel = (id: string, name: string, kind: string, key: string, eltern?: string, ebene = 'ly_a', status = 'ready'): Entity => ({
  id,
  name,
  interfaces: ['Rule'],
  components: { ...ident(name, `rule-${id}`, status), Rule: { kind, key } },
  relations: [im(id, ebene), ...(eltern ? [{ id: `${id}_p`, type: 'partOf', to: eltern, props: {} }] : [])],
});

function bestand(): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'ly_aus', name: 'ly_aus', interfaces: ['Layer'], components: { ...ident('Ebene aus', 'layer-0002'), Layer: { kind: 'book', order: 20 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: { inventory: 'weight', feats: false } },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }, { id: 'camp_a_m', type: 'allowsMethod', to: 'am_geheim', props: {} }, { id: 'camp_a_m2', type: 'allowsMethod', to: 'am_offen', props: {} }] },
    regel('r_sys_inv', 'Inventory', 'system', 'inventory'),
    regel('r_inv', 'Inventory rules', 'rule', 'inventory', 'r_sys_inv'),
    regel('r_grid', 'Grid', 'option', 'grid', 'r_inv'),
    regel('r_enc', 'Encumbrance', 'option', 'weight', 'r_inv'),
    /* Für Spielende nicht sichtbar: noch nicht fertig. */
    regel('r_slots', 'Slots', 'option', 'slots', 'r_inv', 'ly_a', 'idea'),
    regel('r_sys_char', 'Character options', 'system', 'character'),
    /* Nicht im Stapel: die Ebene ist nicht aufgeschaltet. */
    regel('r_feats', 'Feats', 'rule', 'feats', 'r_sys_char', 'ly_aus'),
    regel('r_sys_ab', 'Ability scores', 'system', 'abilities'),
    regel('r_am', 'Ability score methods', 'rule', 'abilityMethods', 'r_sys_ab'),
    regel('r_sys_units', 'Units', 'system', 'units'),
    regel('r_units', 'Units', 'rule', 'units', 'r_sys_units'),
    { id: 'am_geheim', name: 'Heroic', interfaces: ['AbilityMethod'], components: { ...ident('Heroic', 'abilitymethod-0001', 'idea'), AbilityMethod: { method: 'roll', dice: '4d6kh3' } }, relations: [im('am_geheim')] },
    { id: 'am_offen', name: 'Fixed', interfaces: ['AbilityMethod'], components: { ...ident('Fixed', 'abilitymethod-0002'), AbilityMethod: { method: 'array', scores: [15, 14, 13, 12, 10, 8] } }, relations: [im('am_offen')] },
    /* Im Stapel, aber nicht gewählt: steht zur Wahl. */
    { id: 'am_buy', name: 'Point buy 30', interfaces: ['AbilityMethod'], components: { ...ident('Point buy 30', 'abilitymethod-0003'), AbilityMethod: { method: 'pointBuy', budget: 30 } }, relations: [im('am_buy')] },
  ];
}

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a', units: 'metric' } };
  const repo = new InMemoryRepository(registry, bestand());
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>) =>
    repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles });
  await konto('Gwen', { camp_a: 'gm' });
  await konto('Sela', { camp_a: 'player' });
  const get = async (name: string | null, url: string) => {
    if (!name) return app.inject({ method: 'GET', url });
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
    return app.inject({ method: 'GET', url, headers: { cookie } });
  };
  return { get };
}

const option = (sorts: RuleSortState[], key: string) => sorts.flatMap((s) => s.options).find((o) => o.key === key)!;

describe('GET /api/campaigns/:id/rules (T-190)', () => {
  it('zeigt der Leitung die Systeme, Regeln und Optionen aus den Artikeln im Stapel', async () => {
    const { get } = await aufbau();
    const r = await get('Gwen', '/api/campaigns/camp_a/rules');
    expect(r.statusCode).toBe(200);
    const sorts = r.json().sorts as RuleSortState[];
    expect(sorts.map((s) => s.key)).toEqual(['abilities', 'character', 'inventory', 'units']);
    const inv = option(sorts, 'inventory');
    expect(inv.rule).toEqual({ id: 'r_inv', name: 'Inventory rules' });
    expect(inv.variants!.find((v) => v.chosen)?.key).toBe('weight');
    expect(inv.variants!.find((v) => v.key === 'weight')).toMatchObject({ label: 'Encumbrance', rule: { id: 'r_enc', name: 'Encumbrance' } });
    expect(inv.variants!.map((v) => v.key)).toEqual(['grid', 'weight', 'slots']);
    /* Nicht aufgeschaltet heisst nicht da — auch für die Leitung. */
    expect(sorts.flatMap((s) => s.options).some((o) => o.key === 'feats')).toBe(false);
    expect(r.json().missing).toBeGreaterThan(0);
    expect(option(sorts, 'abilityMethods').methods!.map((m) => m.id).sort()).toEqual(['am_geheim', 'am_offen']);
    expect(option(sorts, 'units')).toMatchObject({ scope: 'installation', value: ['units: metric'] });
  });

  it('siebt für Spielende: was sie nicht sehen, wird nicht genannt', async () => {
    const { get } = await aufbau();
    const sorts = (await get('Sela', '/api/campaigns/camp_a/rules')).json().sorts as RuleSortState[];
    expect(option(sorts, 'inventory').variants!.map((v) => v.key)).toEqual(['grid', 'weight']);
    expect(option(sorts, 'abilityMethods').methods!.map((m) => m.id)).toEqual(['am_offen']);
  });

  it('kennt nur Kampagnen', async () => {
    const { get } = await aufbau();
    expect((await get('Gwen', '/api/campaigns/r_enc/rules')).statusCode).toBe(404);
    expect((await get('Gwen', '/api/campaigns/nichts/rules')).statusCode).toBe(404);
  });
});

describe('GET /api/rule-articles (T-270)', () => {
  it('gibt die Regelartikel mit Schlüssel ganz, gesiebt', async () => {
    const { get } = await aufbau();
    const gwen = (await get('Gwen', '/api/rule-articles')).json() as Entity[];
    expect(gwen.map((e) => e.id).sort()).toEqual(['r_am', 'r_enc', 'r_grid', 'r_inv', 'r_slots', 'r_sys_ab', 'r_sys_char', 'r_sys_inv', 'r_sys_units', 'r_units']);
    expect(gwen.find((e) => e.id === 'r_inv')?.components['Rule']).toMatchObject({ kind: 'rule', key: 'inventory' });
    /* Spielende sehen das Unfertige nicht. */
    const sela = (await get('Sela', '/api/rule-articles')).json() as Entity[];
    expect(sela.some((e) => e.id === 'r_slots')).toBe(false);
  });

  it('nennt je Mehrfachwahl, was zur Wahl steht — gewählt oder nicht, nur Sichtbares (Leitung 19.10.)', async () => {
    const { get } = await aufbau();
    const gwen = (await get('Gwen', '/api/campaigns/camp_a/rules')).json();
    expect(gwen.choices.allowsMethod.map((m: { id: string }) => m.id).sort()).toEqual(['am_buy', 'am_geheim', 'am_offen']);
    expect(gwen.choices.allowsMethod.find((m: { id: string }) => m.id === 'am_buy').does).toContain('30');
    /* Spielende sehen das unfertige Verfahren nicht, auch nicht zur Wahl. */
    const sela = (await get('Sela', '/api/campaigns/camp_a/rules')).json();
    expect(sela.choices.allowsMethod.map((m: { id: string }) => m.id).sort()).toEqual(['am_buy', 'am_offen']);
  });
});
