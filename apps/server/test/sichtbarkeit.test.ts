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

/* T-387, REQ-368: jeder Artikel mit seiner Ebene, einzeln und für eine Auswahl. */
describe('Sichtbarkeit je Artikel (T-387)', () => {
  /** Dazu eine Ebene, die zwei Kampagnen aufschalten — sie gehört keiner, die Leitung schreibt sie nicht. */
  async function mitGeteilterEbene() {
    const t = await aufbau();
    await t.repo.putEntity(ebene('ly_srd'));
    await t.repo.putEntity({
      id: 'camp_zwei',
      interfaces: ['Campaign'],
      name: 'Zwei',
      components: { Identity: { name: 'Zwei', id: 'campaign-0002', aliases: [] } },
      relations: [{ id: 'z1', type: 'activates', to: 'ly_srd', props: { order: 1 } }],
    });
    const c = (await t.repo.getEntity('camp_nebel'))!;
    await t.repo.putEntity({ ...c, relations: [...(c.relations ?? []), { id: 'a3', type: 'activates', to: 'ly_srd', props: { order: 0 } }] });
    await t.repo.putEntity(ort('p_regel', 'ly_srd'));
    return t;
  }
  const liste = (app: Awaited<ReturnType<typeof aufbau>>['app'], cookie: string, q = '') =>
    app.inject({ method: 'GET', url: `/api/campaigns/camp_nebel/visibility/articles${q}`, headers: { cookie } });

  it('zeigt je Artikel Ebene, Stufe, Herkunft, Spalten und ob die Leitung schreibt', async () => {
    const { app, keks } = await mitGeteilterEbene();
    const res = await liste(app, await keks('Mira'), '?sort=layer&type=Place');
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b.total).toBe(5);
    expect(b.rows.map((r: { id: string }) => r.id)).toEqual(['p_werk', 'p_gruft', 'p_markt', 'p_tor', 'p_regel']);
    const gruft = b.rows.find((r: { id: string }) => r.id === 'p_gruft');
    /* Die Leitung schreibt die Ebene ihrer Kampagne (ly_brew, oben im Stapel), nicht die übrigen. */
    expect(gruft).toMatchObject({ audience: 'gm', source: 'article', own: { audience: 'gm' }, seenBy: ['gm'], writable: false });
    expect(gruft.layers).toEqual([{ id: 'ly_dnd', name: 'ly_dnd', publisher: expect.any(String), groups: [] }]);
    const werk = b.rows.find((r: { id: string }) => r.id === 'p_werk');
    expect(werk).toMatchObject({ audience: 'gm', source: 'layer', writable: true });
    expect(b.rows.find((r: { id: string }) => r.id === 'p_regel').writable).toBe(false);
    expect(b.facets.layers.map((l: { id: string; n: number }) => [l.id, l.n])).toEqual([
      ['ly_brew', 1],
      ['ly_dnd', 3],
      ['ly_srd', 1],
      /* Ohne Ebene (Figur, Ebenen, Kampagnen) zuletzt; die Facetten zählen ohne den Filter. */
      ['none', 6],
    ]);
    expect(b.facets.levels.gm).toBe(2);
    expect(b.all).toBe(11);
    /* Filter: Ebene, Stufe, Name; Seiten. */
    expect((await liste(app, await keks('Mira'), '?layer=ly_dnd&level=public')).json().rows.map((r: { id: string }) => r.id)).toEqual(['p_markt', 'p_tor']);
    expect((await liste(app, await keks('Mira'), '?q=TOR')).json().total).toBe(1);
    const s2 = (await liste(app, await keks('Mira'), '?type=Place&limit=2&offset=2')).json();
    expect([s2.total, s2.rows.length, s2.offset]).toEqual([5, 2, 2]);
  });

  it('die Mitleitung liest, ändert nicht; Spielende sehen die Liste nicht', async () => {
    const { app, keks } = await aufbau();
    const cora = await keks('Cora');
    expect((await liste(app, cora)).statusCode).toBe(200);
    const w = await app.inject({ method: 'POST', url: '/api/campaigns/camp_nebel/visibility/articles', headers: { cookie: cora }, payload: { ids: ['p_markt'], audience: 'gm' } });
    expect(w.statusCode).toBe(403);
    const sela = await keks('Sela');
    expect((await liste(app, sela)).statusCode).toBe(403);
    const ws = await app.inject({ method: 'POST', url: '/api/campaigns/camp_nebel/visibility/articles', headers: { cookie: sela }, payload: { ids: ['p_markt'], audience: 'public' } });
    expect(ws.statusCode).toBe(403);
  });

  it('setzt die Stufe für eine Auswahl; was die Leitung nicht schreibt, kommt ins Regelwerk der Kampagne (T-401)', async () => {
    const { app, keks, sieht, repo } = await mitGeteilterEbene();
    const mira = await keks('Mira');
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_regel', 'p_tor']);
    const r = await app.inject({
      method: 'POST',
      url: '/api/campaigns/camp_nebel/visibility/articles',
      headers: { cookie: mira },
      payload: { ids: ['p_werk', 'p_regel', 'gibts_nicht'], audience: 'players' },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.done).toEqual(['p_werk', 'p_regel']);
    expect(b.refused.map((x: { id: string }) => x.id)).toEqual(['gibts_nicht']);
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_regel', 'p_tor', 'p_werk']);
    expect((await repo.getEntity('p_werk'))?.components?.['Visibility']).toEqual({ audience: 'players' });
    /* Das geteilte Regelwerk bleibt unberührt; der Eintrag steht an der Kampagne. */
    expect((await repo.getEntity('p_regel'))?.components?.['Visibility']).toBeUndefined();
    expect((await repo.getEntity('camp_nebel'))?.components?.['VisibilityRules']).toEqual({ visibilityRules: [{ id: 'article:p_regel', audience: 'players' }] });
    /* Noch einmal dasselbe: nichts zu tun. */
    const n = await app.inject({ method: 'POST', url: '/api/campaigns/camp_nebel/visibility/articles', headers: { cookie: mira }, payload: { ids: ['p_werk'], audience: 'players' } });
    expect(n.json()).toMatchObject({ done: [], unchanged: ['p_werk'] });
    /* Der Gruppe folgen nimmt das Feld wieder weg — die Vorgabe der Ebene gilt. */
    await app.inject({ method: 'POST', url: '/api/campaigns/camp_nebel/visibility/articles', headers: { cookie: mira }, payload: { ids: ['p_werk'], audience: null } });
    expect((await repo.getEntity('p_werk'))?.components?.['Visibility']).toBeUndefined();
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_regel', 'p_tor']);
  });

  it('zeigt und verbirgt je Spielerin über ihre Figuren', async () => {
    const { app, keks, sieht, repo } = await aufbau();
    const mira = await keks('Mira');
    const spalte = (await liste(app, mira)).json().columns.find((c: { kind: string }) => c.kind === 'player').key as string;
    const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/campaigns/camp_nebel/visibility/articles', headers: { cookie: mira }, payload });
    expect((await post({ ids: ['p_werk'], player: { key: spalte, mode: 'show' } })).json().done).toEqual(['p_werk']);
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_tor', 'p_werk']);
    const zeile = (await liste(app, mira, '?q=werk')).json().rows[0];
    expect(zeile.players).toEqual({ [spalte]: 'show' });
    expect(zeile.seenBy).toEqual([spalte, 'gm']);
    await post({ ids: ['p_werk'], player: { key: spalte, mode: 'hide' } });
    expect((await repo.getEntity('p_werk'))?.components?.['Visibility']).toEqual({ hiddenFrom: ['pc_rook'] });
    /* Verborgen schlägt jede Stufe. */
    await post({ ids: ['p_werk'], audience: 'public' });
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_tor']);
    await post({ ids: ['p_werk'], player: { key: spalte, mode: 'follow' } });
    expect((await repo.getEntity('p_werk'))?.components?.['Visibility']).toEqual({ audience: 'public' });
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_tor', 'p_werk']);
    /* Unsinn sagt, was zu tun ist. */
    expect((await post({ ids: ['p_markt'], player: { key: 'u:niemand', mode: 'show' } })).statusCode).toBe(400);
    expect((await post({ ids: ['p_markt'], audience: 'alle' })).json().error).toMatch(/one of public/);
    expect((await post({ ids: [] , audience: 'gm' })).statusCode).toBe(400);
  });
});

describe('Das Regelwerk je Artikel (T-401, E-162 a)', () => {
  async function geteilt() {
    const t = await aufbau();
    await t.repo.putEntity(ebene('ly_srd'));
    const c = (await t.repo.getEntity('camp_nebel'))!;
    await t.repo.putEntity({ ...c, relations: [...(c.relations ?? []), { id: 'a3', type: 'activates', to: 'ly_srd', props: { order: 0 } }] });
    await t.repo.putEntity({
      id: 'camp_zwei', interfaces: ['Campaign'], name: 'Zwei',
      components: { Identity: { name: 'Zwei', id: 'campaign-0002', aliases: [] } },
      relations: [{ id: 'z1', type: 'activates', to: 'ly_srd', props: { order: 1 } }],
    });
    await t.repo.putEntity(ort('p_regel', 'ly_srd'));
    await t.repo.putEntity(ort('p_zwei', 'ly_srd'));
    return t;
  }
  const post = (app: Awaited<ReturnType<typeof aufbau>>['app'], cookie: string, payload: unknown) =>
    app.inject({ method: 'POST', url: '/api/campaigns/camp_nebel/visibility/articles', headers: { cookie }, payload });

  it('verbirgt einen Artikel einer fremden Ebene nur in dieser Kampagne und sagt die Herkunft', async () => {
    const { app, keks, sieht, repo } = await geteilt();
    const mira = await keks('Mira');
    expect((await post(app, mira, { ids: ['p_regel'], audience: 'gm' })).json().done).toEqual(['p_regel']);
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_tor', 'p_zwei']);
    const zeile = (await app.inject({ method: 'GET', url: '/api/campaigns/camp_nebel/visibility/articles?q=p_regel', headers: { cookie: mira } })).json().rows[0];
    expect(zeile).toMatchObject({ audience: 'gm', source: 'campaign', rule: 'article:p_regel', writable: false, settable: true });
    /* Je Spielerin über den Eintrag. */
    const spalte = (await app.inject({ method: 'GET', url: '/api/campaigns/camp_nebel/visibility/articles', headers: { cookie: mira } })).json().columns.find((c: { kind: string }) => c.kind === 'player').key;
    await post(app, mira, { ids: ['p_regel'], player: { key: spalte, mode: 'show' } });
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_regel', 'p_tor', 'p_zwei']);
    /* ↺ nimmt den Eintrag weg. */
    await post(app, mira, { ids: ['p_regel'], follow: true });
    expect((await repo.getEntity('camp_nebel'))?.components?.['VisibilityRules']).toEqual({ visibilityRules: [] });
    expect((await repo.getEntity('p_regel'))?.components?.['Visibility']).toBeUndefined();
  });

  it('der Eintrag schlägt die genaueste Gruppe', async () => {
    const { app, keks, sieht } = await geteilt();
    const mira = await keks('Mira');
    const r = await app.inject({ method: 'PUT', url: '/api/campaigns/camp_nebel/visibility/rules', headers: { cookie: mira }, payload: { id: 'layer:ly_srd|type:Place', audience: 'gm' } });
    expect(r.statusCode).toBe(200);
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_tor']);
    await post(app, mira, { ids: ['p_zwei'], audience: 'public' });
    expect(await sieht('Sela')).toEqual(['p_markt', 'p_tor', 'p_zwei']);
  });
});
