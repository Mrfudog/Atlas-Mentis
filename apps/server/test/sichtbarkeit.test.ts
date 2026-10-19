/**
 * Die Sichtbarkeit je Gruppe an der Kampagne (T-252, E-098): Regeln an der
 * Kampagne, Vorgabe an der Ebene, die Übersicht je Spalte — und das Sieb
 * jeder Route liest dieselben Regeln.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ebene = (id: string, vorgabe?: string): Entity => ({
  id,
  interfaces: ['Layer'],
  name: id,
  components: { Identity: { name: id, id: `layer-${id}`, aliases: [] }, ...(vorgabe ? { Layer: { defaultAudience: vorgabe } } : {}) },
  relations: [],
});
const runde: Entity = {
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
  relations: [
    { id: 'a1', type: 'activates', to: 'ly_dnd', props: { order: 1 } },
    { id: 'a2', type: 'activates', to: 'ly_brew', props: { order: 5 } },
  ],
};
const ort = (id: string, layer: string, extra: Record<string, unknown> = {}): Entity => ({
  id,
  interfaces: ['Place'],
  name: id,
  components: { Identity: { name: id, id: `place-${id}`, aliases: [] }, ...extra },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: layer, props: {} }],
});

async function aufbau() {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [
      ebene('ly_dnd'),
      ebene('ly_brew', 'gm'),
      runde,
      { id: 'pc_rook', interfaces: ['PlayerCharacter'], name: 'Rook', components: { Identity: { name: 'Rook', id: 'pc-0001', aliases: [] } }, relations: [] },
      ort('p_markt', 'ly_dnd'),
      ort('p_tor', 'ly_dnd'),
      ort('p_werk', 'ly_brew'),
      ort('p_gruft', 'ly_dnd', { Visibility: { audience: 'gm' } }),
    ],
  );
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'co-gm' | 'player' | 'spectator'>, actorIds: string[] = []) => {
    await repo.putUser({ id: `u_${name}_${randomUUID().slice(0, 4)}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles });
  };
  await konto('Mira', { camp_nebel: 'gm' });
  await konto('Cora', { camp_nebel: 'co-gm' });
  await konto('Sela', { camp_nebel: 'player' }, ['pc_rook']);
  const keks = async (name: string): Promise<string> => {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = res.cookies.find((x) => x.name === 'nw_session');
    if (!c) throw new Error(`keine Sitzung für ${name}`);
    return `nw_session=${c.value}`;
  };
  const sieht = async (name: string): Promise<string[]> => {
    const res = await app.inject({ method: 'GET', url: '/api/entities', headers: { cookie: await keks(name) } });
    return (res.json() as Entity[]).map((e) => e.id).filter((id) => id.startsWith('p_')).sort();
  };
  return { app, repo, keks, sieht };
}

describe('Sichtbarkeit je Gruppe (T-252)', () => {
  it('die Ebene gibt vor, die Kampagne überschreibt, das Feld am Artikel gewinnt', async () => {
    const { app, keks, sieht } = await aufbau();
    /* Vorgabe: Homebrew gm, die Gruft sagt selbst gm. */
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_tor']);
    const mira = await keks('Mira');
    let r = await app.inject({ method: 'PUT', url: '/api/campaigns/camp_nebel/visibility/rules', headers: { cookie: mira }, payload: { id: 'layer:ly_brew', audience: 'players' } });
    expect(r.statusCode).toBe(200);
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_tor', 'p_werk']);
    /* Genauer schlägt gröber, und je Spieler verbergen. */
    r = await app.inject({ method: 'PUT', url: '/api/campaigns/camp_nebel/visibility/rules', headers: { cookie: mira }, payload: { id: 'layer:ly_dnd', audience: 'gm' } });
    r = await app.inject({ method: 'PUT', url: '/api/campaigns/camp_nebel/visibility/rules', headers: { cookie: mira }, payload: { id: 'layer:ly_dnd|type:Place', show: ['pc_rook'] } });
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_tor', 'p_werk']);
    r = await app.inject({ method: 'PUT', url: '/api/campaigns/camp_nebel/visibility/rules', headers: { cookie: mira }, payload: { id: 'layer:ly_dnd|type:Place', show: [] } });
    expect(r.json().rules).toEqual([{ id: 'layer:ly_brew', audience: 'players' }, { id: 'layer:ly_dnd', audience: 'gm' }]);
    expect(await sieht('Sela')).toEqual(['p_werk']);
    /* Zurück zur Vorgabe der Ebene. */
    await app.inject({ method: 'PUT', url: '/api/campaigns/camp_nebel/visibility/rules', headers: { cookie: mira }, payload: { id: 'layer:ly_dnd', audience: null } });
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_tor', 'p_werk']);
  });

  it('zeigt die Übersicht je Spalte mit Herkunft und Ausnahmen; die Mitleitung liest nur', async () => {
    const { app, keks } = await aufbau();
    const cora = await keks('Cora');
    const res = await app.inject({ method: 'GET', url: '/api/campaigns/camp_nebel/visibility?steps=group:layer', headers: { cookie: cora } });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b.columns.map((c: { key: string; label: string }) => c.label)).toEqual(['Public', 'Table', 'Rook', 'GM']);
    const dnd = b.nodes.find((n: { value: string }) => n.value === 'ly_dnd');
    expect(dnd.count).toBe(3);
    const rook = b.columns[2].key;
    expect(dnd.cells).toMatchObject({ public: 2, table: 2, [rook]: 2, gm: 3 });
    expect(dnd.sources).toEqual({ default: 2, article: 1 });
    expect(dnd.exceptions).toEqual({ count: 1, items: [{ id: 'p_gruft', name: 'p_gruft', own: 'gm' }] });
    const brew = b.nodes.find((n: { value: string }) => n.value === 'ly_brew');
    expect(brew.sources).toEqual({ layer: 1 });
    expect(brew.cells.gm).toBe(1);
    expect(brew.cells.public).toBe(0);
    const w = await app.inject({ method: 'PUT', url: '/api/campaigns/camp_nebel/visibility/rules', headers: { cookie: cora }, payload: { id: 'layer:ly_dnd', audience: 'gm' } });
    expect(w.statusCode).toBe(403);
    const s = await app.inject({ method: 'GET', url: '/api/campaigns/camp_nebel/visibility', headers: { cookie: await keks('Sela') } });
    expect(s.statusCode).toBe(403);
  });

  it('lässt Ausnahmen der Gruppe folgen', async () => {
    const { app, keks, sieht, repo } = await aufbau();
    const mira = await keks('Mira');
    const r = await app.inject({ method: 'POST', url: '/api/campaigns/camp_nebel/visibility/follow', headers: { cookie: mira }, payload: { ids: ['p_gruft', 'gibts_nicht'] } });
    expect(r.statusCode).toBe(200);
    expect(r.json().done).toEqual(['p_gruft']);
    expect(r.json().refused.map((x: { id: string }) => x.id)).toEqual(['gibts_nicht']);
    expect((await repo.getEntity('p_gruft'))?.components?.['Visibility']).toBeUndefined();
    expect(await sieht('Sela')).toEqual(['p_gruft', 'p_markt', 'p_tor']);
  });

  it('sagt am Artikel die geltende Stufe und woher sie kommt (refs.audience, T-277)', async () => {
    const { app, keks } = await aufbau();
    const mira = await keks('Mira');
    const stufe = async (id: string) =>
      (await app.inject({ method: 'GET', url: `/api/entities/${id}`, headers: { cookie: mira } })).json().refs.audience;
    expect(await stufe('p_markt')).toEqual({ audience: 'public', source: 'default' });
    expect(await stufe('p_werk')).toEqual({ audience: 'gm', source: 'layer' });
    expect(await stufe('p_gruft')).toEqual({ audience: 'gm', source: 'article' });
    await app.inject({ method: 'PUT', url: '/api/campaigns/camp_nebel/visibility/rules', headers: { cookie: mira }, payload: { id: 'layer:ly_dnd', audience: 'players' } });
    expect(await stufe('p_markt')).toEqual({ audience: 'players', source: 'campaign', rule: 'layer:ly_dnd' });
  });
});
