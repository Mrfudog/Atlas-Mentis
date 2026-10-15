/**
 * Die Regeloptionen einer Kampagne (T-190): `GET /api/campaigns/:id/rules`.
 * Ein Regelartikel wird nur genannt, wenn er im Stapel steht und der
 * Betrachter ihn sieht. Erfundene Artikel.
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

function bestand(): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'ly_aus', name: 'ly_aus', interfaces: ['Layer'], components: { ...ident('Ebene aus', 'layer-0002'), Layer: { kind: 'book', order: 20 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: { inventory: 'weight', feats: false } },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }, { id: 'camp_a_m', type: 'allowsMethod', to: 'am_geheim', props: {} }, { id: 'camp_a_m2', type: 'allowsMethod', to: 'am_offen', props: {} }] },
    { id: 'r_enc', name: 'Encumbrance', interfaces: ['Rule'], components: ident('Encumbrance', 'rule-0001'), relations: [im('r_enc')] },
    /* Nicht im Stapel: die Ebene ist nicht aufgeschaltet. */
    { id: 'r_feats', name: 'Feats', interfaces: ['Rule'], components: ident('Feats', 'rule-0002'), relations: [im('r_feats', 'ly_aus')] },
    /* Für Spielende nicht sichtbar: noch nicht fertig. */
    { id: 'r_slots', name: 'Inventory rules: Slots', interfaces: ['Rule'], components: ident('Inventory rules: Slots', 'rule-0003', 'idea'), relations: [im('r_slots')] },
    { id: 'am_geheim', name: 'Heroic', interfaces: ['AbilityMethod'], components: { ...ident('Heroic', 'abilitymethod-0001', 'idea'), AbilityMethod: { method: 'roll', dice: '4d6kh3' } }, relations: [im('am_geheim')] },
    { id: 'am_offen', name: 'Fixed', interfaces: ['AbilityMethod'], components: { ...ident('Fixed', 'abilitymethod-0002'), AbilityMethod: { method: 'array', scores: [15, 14, 13, 12, 10, 8] } }, relations: [im('am_offen')] },
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
  it('zeigt der Leitung die Optionen mit den Regelartikeln, die im Stapel stehen', async () => {
    const { get } = await aufbau();
    const r = await get('Gwen', '/api/campaigns/camp_a/rules');
    expect(r.statusCode).toBe(200);
    const sorts = r.json().sorts as RuleSortState[];
    const inv = option(sorts, 'inventory');
    expect(inv.variants!.find((v) => v.chosen)?.key).toBe('weight');
    expect(inv.variants!.find((v) => v.key === 'weight')?.rule).toEqual({ id: 'r_enc', name: 'Encumbrance' });
    expect(inv.variants!.find((v) => v.key === 'slots')?.rule?.id).toBe('r_slots');
    /* Nicht aufgeschaltet heisst nicht da — auch für die Leitung. */
    expect(option(sorts, 'feats').variants!.find((v) => v.key === 'true')?.rule).toBeUndefined();
    expect(option(sorts, 'abilityMethods').methods!.map((m) => m.id).sort()).toEqual(['am_geheim', 'am_offen']);
    expect(option(sorts, 'units')).toMatchObject({ scope: 'installation', value: ['units: metric'] });
  });

  it('siebt für Spielende: was sie nicht sehen, wird nicht genannt', async () => {
    const { get } = await aufbau();
    const sorts = (await get('Sela', '/api/campaigns/camp_a/rules')).json().sorts as RuleSortState[];
    expect(option(sorts, 'inventory').variants!.find((v) => v.key === 'slots')?.rule).toBeUndefined();
    expect(option(sorts, 'abilityMethods').methods!.map((m) => m.id)).toEqual(['am_offen']);
  });

  it('kennt nur Kampagnen', async () => {
    const { get } = await aufbau();
    expect((await get('Gwen', '/api/campaigns/r_enc/rules')).statusCode).toBe(404);
    expect((await get('Gwen', '/api/campaigns/nichts/rules')).statusCode).toBe(404);
  });
});
