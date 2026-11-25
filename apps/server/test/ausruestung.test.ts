/**
 * Startausrüstung nach Kampagnenregel (T-096, REQ-250): die Kampagne nennt
 * die Verfahren, gewürfelt wird am Server mit Beleg im Protokoll, und der
 * Einkauf wird hier gegen Budget und Grenzen geprüft, bevor er im Inventar
 * der Figur landet.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const artikel = (id: string, typ: string, extra: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id,
  interfaces: [typ],
  name: id,
  components: { Identity: { name: id, id: `${typ.toLowerCase()}-${id}` }, Status: { status: 'ready' }, ...extra },
  relations,
});
const ding = (id: string, item: Record<string, unknown>) => artikel(id, 'Item', { Item: item });

const seil = ding('rope', { itemType: 'adventuring gear', rarity: 'none', copperPrice: 100 });
const schwert = ding('sword', { itemType: 'melee weapon', rarity: 'none', copperPrice: 1500 });
const umhang = ding('cloak', { itemType: 'wondrous item', rarity: 'uncommon' });
const geheim = { ...ding('secret', { itemType: 'other', rarity: 'none', copperPrice: 1 }), components: { ...ding('secret', {}).components, Item: { copperPrice: 1 }, Visibility: { audience: 'gm' } } };
const klasse = artikel('fighter', 'Class', {
  Class: { startingGold: '5d4×10' },
  Choices: {
    choices: [
      { id: 'equipment-fixed', kind: 'equipment', when: 'start', from: { options: [{ key: 'fixed', label: 'rope', items: [{ id: 'item-rope', qty: 2 }] }] } },
      { id: 'equipment', kind: 'equipment', when: 'start', from: { options: [{ key: 'a', label: '[[item-sword|sword]]' }, { key: 'b', label: '15 gp' }] } },
    ],
  },
});
const frei = artikel('m_free', 'EquipmentMethod', { EquipmentMethod: { method: 'free', budget: 20, magic: { uncommon: 1 } } });
const festGold = artikel('m_gold', 'EquipmentMethod', { EquipmentMethod: { method: 'gold', gold: '10' } });

async function aufbau(methoden: string[]) {
  const runde = artikel('camp_nebel', 'Campaign', {}, methoden.map((m, i) => ({ id: `ae${i}`, type: 'allowsEquipment', to: m, props: {} })));
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [runde, klasse, seil, schwert, umhang, geheim, frei, festGold, artikel('bg', 'Background'), artikel('an', 'Ancestry')],
  );
  const app = buildApp({ repo });
  const konten: Record<string, string> = {};
  for (const [name, role] of [['Mira', 'gm'], ['Sela', 'player'], ['Tom', 'player']] as const) {
    konten[name] = `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`;
    await repo.putUser({ id: konten[name], name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles: { camp_nebel: role } });
  }
  const als = async (name: string, method: 'GET' | 'POST', url: string, payload?: object) => {
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = login.cookies.find((x) => x.name === 'nw_session')!;
    return app.inject({ method, url, headers: { cookie: `nw_session=${c.value}` }, ...(payload ? { payload } : {}) });
  };
  /* Sela legt ihre Figur an, wie der Assistent es tut: Kanten und Antworten. */
  const figur = async (antwort = 'a') => {
    const r = await als('Sela', 'POST', '/api/entities', {
      type: 'PlayerCharacter',
      name: 'Aster',
      fields: { 'Status.status': 'ready' },
      relations: [
        { type: 'hasClass', to: 'fighter', props: { level: 1 } },
        { type: 'hasBackground', to: 'bg', props: {} },
        { type: 'chose', to: 'fighter', props: { choice: 'equipment', picks: [antwort] } },
      ],
    });
    expect(r.statusCode).toBe(201);
    return (r.json() as Entity).id;
  };
  return { repo, als, figur };
}

const inventarVon = async (repo: InMemoryRepository, id: string) => {
  const f = await repo.getEntity(id);
  const inv = await repo.getEntity(f!.relations!.find((r) => r.type === 'carries')!.to);
  /* Jedes Stück ist eine Instanz seines Gegenstands (T-150): gezählt wird nach der Vorlage. */
  const holds = [];
  for (const r of (inv!.relations ?? []).filter((x) => x.type === 'holds')) {
    const stueck = await repo.getEntity(r.to);
    const vorlage = stueck?.relations?.find((x) => x.type === 'instanceOf')?.to;
    expect(vorlage, `${r.to} ist keine Instanz`).toBeTruthy();
    holds.push([vorlage, r.props?.['qty']]);
  }
  return { inv: inv!, holds };
};

describe('Startausrüstung (T-096, REQ-250)', () => {
  it('bietet ohne Kante „Klasse und Hintergrund" und „Startgold"', async () => {
    const { als } = await aufbau([]);
    const res = (await als('Sela', 'GET', '/api/equipment')).json() as { methods: { id: string }[] };
    expect(res.methods.map((m) => m.id)).toEqual(['class-and-background', 'starting-gold']);
  });

  it('nach Regeln: das Feste und die gewählte Variante landen im Inventar, einmal', async () => {
    const { repo, als, figur } = await aufbau([]);
    const id = await figur('a');
    const r = await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'class-and-background' });
    expect(r.statusCode).toBe(200);
    const { inv, holds } = await inventarVon(repo, id);
    expect(holds).toEqual([['rope', 2], ['sword', 1]]);
    expect(inv.components['Inventory']).toMatchObject({ copper: 0 });
    /* Ihr Inventar schreibt sie (es hängt an ihrer Figur). */
    expect((await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'class-and-background' })).statusCode).toBe(409);
    expect((await repo.listEvents({ name: 'equipment.applied' }))[0]!.payload).toMatchObject({ method: 'class-and-background', copper: 0 });
  });

  it('nach Regeln mit Gold statt Gegenstand: das Geld kommt in den Beutel', async () => {
    const { repo, als, figur } = await aufbau([]);
    const id = await figur('b');
    expect((await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'class-and-background' })).statusCode).toBe(200);
    const { inv, holds } = await inventarVon(repo, id);
    expect(holds).toEqual([['rope', 2]]);
    expect(inv.components['Inventory']).toMatchObject({ copper: 1500 });
  });

  it('Startgold: gewürfelt am Server, der Wurf ist Beleg und wird nur einmal ausgegeben', async () => {
    const { repo, als, figur } = await aufbau([]);
    const id = await figur();
    const ohne = await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'starting-gold', purchases: [] });
    expect(ohne.statusCode).toBe(400);
    const wurf = (await als('Sela', 'POST', '/api/equipment/roll', { method: 'starting-gold', class: 'fighter' })).json() as { gp: number; event: string };
    expect(wurf.gp).toBeGreaterThanOrEqual(50);
    expect(wurf.gp % 10).toBe(0);
    /* Toms Wurf ist nicht ihrer. */
    const fremd = (await als('Tom', 'POST', '/api/equipment/roll', { method: 'starting-gold', class: 'fighter' })).json() as { event: string };
    expect((await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'starting-gold', roll: fremd.event, purchases: [] })).statusCode).toBe(400);

    const zuviel = await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'starting-gold', roll: wurf.event, purchases: [{ id: 'sword', qty: 100 }] });
    expect(zuviel.statusCode).toBe(422);
    const ok = await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'starting-gold', roll: wurf.event, purchases: [{ id: 'sword', qty: 1 }, { id: 'rope', qty: 3 }] });
    expect(ok.statusCode).toBe(200);
    const { inv, holds } = await inventarVon(repo, id);
    expect(holds).toEqual([['sword', 1], ['rope', 3]]);
    expect(inv.components['Inventory']).toMatchObject({ copper: wurf.gp * 100 - 1800 });
    /* Ein zweites Mal gibt es nur durch die Leitung — und derselbe Wurf gilt nicht zweimal. */
    const nochmal = await als('Mira', 'POST', `/api/entities/${id}/equipment`, { method: 'starting-gold', roll: wurf.event, purchases: [] });
    expect(nochmal.statusCode).toBe(400);
  });

  it('frei mit Grenzen: Budget, magische Gegenstände je Seltenheit, nur Sichtbares', async () => {
    const { repo, als, figur } = await aufbau(['m_free', 'm_gold']);
    const res = (await als('Sela', 'GET', '/api/equipment')).json() as { methods: { id: string }[] };
    expect(res.methods.map((m) => m.id)).toEqual(['m_free', 'm_gold']);
    const id = await figur();
    expect((await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'class-and-background' })).statusCode).toBe(400);
    expect((await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'm_free', purchases: [{ id: 'cloak', qty: 2 }] })).statusCode).toBe(422);
    expect((await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'm_free', purchases: [{ id: 'secret', qty: 1 }] })).statusCode).toBe(422);
    expect((await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'm_free', purchases: [{ id: 'sword', qty: 2 }] })).statusCode).toBe(422);
    const ok = await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'm_free', purchases: [{ id: 'cloak', qty: 1 }, { id: 'sword', qty: 1 }] });
    expect(ok.statusCode).toBe(200);
    const { inv, holds } = await inventarVon(repo, id);
    expect(holds).toEqual([['cloak', 1], ['sword', 1]]);
    expect(inv.components['Inventory']).toMatchObject({ copper: 500 });
  });

  it('ein fester Betrag wird nicht gewürfelt; fremde Figuren bekommen nichts', async () => {
    const { als, figur } = await aufbau(['m_gold']);
    expect((await als('Sela', 'POST', '/api/equipment/roll', { method: 'm_gold' })).statusCode).toBe(400);
    const id = await figur();
    expect((await als('Tom', 'POST', `/api/entities/${id}/equipment`, { method: 'm_gold', purchases: [] })).statusCode).toBe(403);
    const ok = await als('Sela', 'POST', `/api/entities/${id}/equipment`, { method: 'm_gold', purchases: [{ id: 'rope', qty: 1 }] });
    expect(ok.json()).toMatchObject({ copper: 900 });
  });
});
