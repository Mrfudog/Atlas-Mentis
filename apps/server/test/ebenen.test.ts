/**
 * Ausgeblendete Ebenen (T-069): die Listen sagen, was fehlt, weil die
 * laufende Kampagne seine Ebene nicht aufschaltet; die Kampagnenseite
 * schaltet auf; das Register zählt gespeichert und sichtbar.
 *
 * Geprüft wird vor allem das Recht: die Leitung der einen Runde schaltet
 * keine Ebene auf, die genau einer anderen gehört — sonst sähe sie, was
 * dort nur deren Leitung sieht.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
type Rolle = 'gm' | 'co-gm' | 'player' | 'spectator';

const ident = (name: string, id: string) => ({
  Identity: { name, id, aliases: [] },
  Status: { status: 'ready' },
});
const ebene = (id: string, name: string, n: number, order: number): Entity => ({
  id,
  name,
  interfaces: ['Layer'],
  components: { ...ident(name, `layer-00${n}`), Layer: { kind: 'campaign', order } },
  relations: [],
});
const kampagne = (id: string, name: string, n: number, ly: string): Entity => ({
  id,
  name,
  interfaces: ['Campaign'],
  components: ident(name, `campaign-000${n}`),
  relations: [{ id: `${id}_ac`, type: 'activates', to: ly, props: {} }],
});
const regel = (id: string, n: number, ly?: string): Entity => ({
  id,
  name: id,
  interfaces: ['Rule'],
  components: ident(id, `rule-000${n}`),
  relations: ly ? [{ id: `${id}_in`, type: 'inLayer', to: ly, props: {} }] : [],
});

const BESTAND = [
  ebene('ly_5e', 'D&D 5e (2014)', 1, 0),
  ebene('ly_a', 'Runde A', 2, 50),
  ebene('ly_b', 'Runde B', 3, 50),
  kampagne('camp_a', 'Aus Nebel wacht', 1, 'ly_a'),
  kampagne('camp_b', 'Der Salzpfad', 2, 'ly_b'),
  regel('r_frei', 1),
  regel('r_a', 2, 'ly_a'),
  regel('r_5e_1', 3, 'ly_5e'),
  regel('r_5e_2', 4, 'ly_5e'),
  regel('r_5e_3', 5, 'ly_5e'),
  regel('r_b', 6, 'ly_b'),
];

/**
 * Hält seinen Bestand wie `PgRepository`: unveränderte Artikel bleiben
 * dieselben Objekte über ein Schreiben hinweg (T-143) — darauf baut die
 * Ebenenseite, wenn sie nach einem Häkchen nicht neu zählt.
 */
class Gehalten extends InMemoryRepository {
  private gehalten = new Map<string, Entity>();
  override async listEntities(): Promise<Entity[]> {
    const neu = new Map<string, Entity>();
    for (const e of await super.listEntities()) {
      const alt = this.gehalten.get(e.id);
      neu.set(e.id, alt && alt.revision === e.revision ? alt : e);
    }
    this.gehalten = neu;
    return [...neu.values()];
  }
}

async function aufbau(Repo: typeof InMemoryRepository = InMemoryRepository) {
  const repo = new Repo(seedRegistry, BESTAND);
  const app = buildApp({ repo });
  const konto = async (name: string, opts: { admin?: boolean; roles?: Record<string, Rolle> } = {}) => {
    await repo.putUser({
      id: randomUUID(),
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: opts.admin ?? false,
      actorIds: [],
      roles: opts.roles ?? {},
    });
  };
  await konto('Admin', { admin: true });
  await konto('Basil', { roles: { camp_a: 'gm' } });
  await konto('Mira', { roles: { camp_a: 'co-gm' } });
  await konto('Sela', { roles: { camp_a: 'player' } });
  const kekse = new Map<string, string>();
  const keks = async (name: string) => {
    if (kekse.has(name)) return kekse.get(name)!;
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
    kekse.set(name, c);
    return c;
  };
  const rufe = async (name: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      headers: { cookie: await keks(name) },
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
  return { repo, rufe };
}

const namen = (l: { rows: { id: string }[] }) => l.rows.map((z) => z.id).sort();

describe('the lists say what a layer that is off hides', () => {
  it('counts per layer, with the running campaign, and offers the switch to who may', async () => {
    const { rufe } = await aufbau();
    const admin = (await rufe('Admin', 'GET', '/api/list?type=Rule')).json();
    expect(namen(admin)).toEqual(['r_a', 'r_frei']);
    /* Eine Zahl, keine Ebenen (T-207): welche, steht an der Kampagne. */
    expect(admin.unactivated).toEqual({
      campaign: { id: 'camp_a', name: 'Aus Nebel wacht' },
      total: 4,
      canManage: true,
    });
    const basil = (await rufe('Basil', 'GET', '/api/list?type=Rule')).json();
    expect(basil.unactivated.canManage).toBe(true);
    expect((await rufe('Mira', 'GET', '/api/list?type=Rule')).json().unactivated.canManage).toBe(false);
    const sela = (await rufe('Sela', 'GET', '/api/list?type=Rule')).json();
    expect(sela.unactivated.total).toBe(4);
    expect(sela.unactivated.canManage).toBe(false);
  });

  it('follows the filters of the page and stays away from a lookup by ids', async () => {
    const { rufe } = await aufbau();
    const such = (await rufe('Admin', 'GET', '/api/list?type=Rule&q=r_5e_1')).json();
    expect(such.unactivated.total).toBe(1);
    expect((await rufe('Admin', 'GET', '/api/list?q=nichts-dergleichen')).json().unactivated).toBeUndefined();
    expect((await rufe('Admin', 'GET', '/api/list?ids=r_a')).json().unactivated).toBeUndefined();
  });
});

describe('what is not in play is not named (T-207)', () => {
  /* Ein Artikel in der Kampagnenebene und im nicht aufgeschalteten 5e.tools. */
  async function mitZweien() {
    const a = await aufbau();
    const r = regel('r_beide', 7, 'ly_a');
    r.relations!.push({ id: 'r_beide_5e', type: 'inLayer', to: 'ly_5e', props: {} });
    await a.repo.putEntity(r);
    return a;
  }

  it('lists only layers the campaign puts in play — for every account, the admin included', async () => {
    const { rufe } = await mitZweien();
    for (const wer of ['Admin', 'Basil', 'Sela']) {
      const l = (await rufe(wer, 'GET', '/api/list?type=Layer')).json();
      expect(namen(l)).toEqual(['ly_a']);
    }
    const alle = (await rufe('Basil', 'GET', '/api/list')).json();
    expect(alle.facets.layers.map((x: { id: string }) => x.id)).not.toContain('ly_5e');
    const beide = alle.rows.find((z: { id: string }) => z.id === 'r_beide');
    expect(beide.layers).toEqual(['Runde A']);
  });

  it('keeps every layer for the workbench, but only for admin and GM', async () => {
    const { rufe } = await mitZweien();
    expect(namen((await rufe('Admin', 'GET', '/api/list?type=Layer&allLayers=1')).json())).toEqual(['ly_5e', 'ly_a', 'ly_b']);
    expect(namen((await rufe('Mira', 'GET', '/api/list?type=Layer&allLayers=1')).json())).toEqual(['ly_5e', 'ly_a', 'ly_b']);
    expect(namen((await rufe('Sela', 'GET', '/api/list?type=Layer&allLayers=1')).json())).toEqual(['ly_a']);
  });

  it('finds no layer that is off in the search, the sources or the facets', async () => {
    const { rufe, repo } = await mitZweien();
    for (const id of ['ly_5e', 'ly_a']) {
      const l = (await repo.getEntity(id))!;
      await repo.putEntity({ ...l, components: { ...l.components, Layer: { ...(l.components!['Layer'] as object), abbreviation: id === 'ly_5e' ? 'PHB' : 'RA' } } });
    }
    const such = (await rufe('Basil', 'GET', '/api/search?q=r')).json();
    expect(such.facets.layers.map((x: { id: string }) => x.id)).not.toContain('ly_5e');
    expect(such.rows.find((z: { id: string }) => z.id === 'r_beide').layers).toEqual(['Runde A']);
    expect((await rufe('Basil', 'GET', '/api/search?q=D%26D')).json().rows).toEqual([]);
    expect(Object.keys((await rufe('Basil', 'GET', '/api/sources')).json().sources)).toEqual(['RA']);
  });

  it('names only layers in play at the article and its versions', async () => {
    const { rufe } = await mitZweien();
    const e = (await rufe('Basil', 'GET', '/api/entities/r_beide')).json();
    expect(e.refs.names).toEqual({ ly_a: 'Runde A' });
    const v = (await rufe('Basil', 'GET', '/api/entities/r_beide/versions')).json();
    expect(v.layers.map((x: { id: string }) => x.id)).toEqual(['ly_a']);
  });

  it('names a compare layer to whom sees compare layers', async () => {
    const { rufe } = await mitZweien();
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/compare', { layers: ['ly_5e'] })).statusCode).toBe(200);
    expect(namen((await rufe('Basil', 'GET', '/api/list?type=Layer')).json())).toEqual(['ly_5e', 'ly_a']);
    expect((await rufe('Basil', 'GET', '/api/entities/r_beide')).json().refs.names).toEqual({ ly_a: 'Runde A', ly_5e: 'D&D 5e (2014)' });
    /* Die Spielenden sehen Vergleichsebenen nur, wenn die Kampagne es sagt. */
    expect(namen((await rufe('Sela', 'GET', '/api/list?type=Layer')).json())).toEqual(['ly_a']);
  });
});

describe('the campaign page switches layers on', () => {
  it('lists every layer, the active ones first, with who else runs it', async () => {
    const { rufe } = await aufbau();
    const res = await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers');
    expect(res.statusCode).toBe(200);
    const l = res.json();
    expect(l.may).toBe('manage');
    expect(l.layers.map((x: { id: string; active: boolean }) => [x.id, x.active])).toEqual([
      ['ly_a', true],
      ['ly_5e', false],
      ['ly_b', false],
    ]);
    expect(l.layers.find((x: { id: string }) => x.id === 'ly_5e')).toMatchObject({ articles: 3, canActivate: true });
    expect(l.layers.find((x: { id: string }) => x.id === 'ly_b')).toMatchObject({
      alsoIn: ['Der Salzpfad'],
      canActivate: false,
    });
    expect((await rufe('Mira', 'GET', '/api/campaigns/camp_a/layers')).json().may).toBe('see');
    expect((await rufe('Sela', 'GET', '/api/campaigns/camp_a/layers')).statusCode).toBe(403);
  });

  /* Gruppen sind Ebenen (E-022 b, T-088): „Core rules" enthält PHB und
     MM; eine zweite Gruppe hält die Ebene der anderen Runde. */
  const mitGruppen = async (Repo: typeof InMemoryRepository = InMemoryRepository) => {
    const a = await aufbau(Repo);
    const buch = (id: string, name: string, n: number, published: string, partOf: string): Entity => ({
      ...ebene(id, name, n, 0),
      components: {
        ...ident(name, `layer-00${n}`),
        Layer: { kind: 'book', order: 0, abbreviation: name.slice(0, 3).toUpperCase(), published },
        Description: { description: `${name.slice(0, 3).toUpperCase()} — ${name}` },
      },
      relations: [{ id: `${id}~partOf`, type: 'partOf', to: partOf, props: {} }],
    });
    const gruppe = (id: string, name: string, n: number): Entity => ({
      ...ebene(id, name, n, 0),
      components: { ...ident(name, `layer-00${n}`), Layer: { kind: 'group', order: 0 } },
    });
    await a.repo.putEntity(gruppe('e5_group_core', 'Core rules', 7));
    await a.repo.putEntity(gruppe('g_fremd', 'Fremd', 8));
    await a.repo.putEntity(buch('e5_book_phb', "Player's Handbook", 9, '2014-08-19', 'e5_group_core'));
    await a.repo.putEntity(buch('e5_book_mm', 'Monster Manual', 10, '2014-09-30', 'e5_group_core'));
    await a.repo.putEntity({ ...BESTAND.find((e) => e.id === 'ly_b')!, relations: [{ id: 'ly_b~partOf', type: 'partOf', to: 'g_fremd', props: {} }] });
    await a.repo.putEntity(regel('r_phb', 7, 'e5_book_phb'));
    await a.repo.putEntity(regel('r_mm', 8, 'e5_book_mm'));
    return a;
  };
  const zeile = (l: { layers: { id: string }[] }, id: string) => l.layers.find((x) => x.id === id) as Record<string, unknown>;

  it('lists groups with their members, and every layer with what it holds (T-088)', async () => {
    const { rufe } = await mitGruppen();
    const l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    expect(zeile(l, 'e5_group_core')).toMatchObject({ kind: 'group', members: ['e5_book_phb', 'e5_book_mm'], active: false, inPlay: false });
    expect(zeile(l, 'e5_book_phb')).toMatchObject({
      groups: ['e5_group_core'],
      content: { Rule: 1 },
      about: { abbreviation: 'PLA', published: '2014-08-19', description: 'PLA — Player\'s Handbook' },
    });
    /* Die Gruppe der anderen Runde bringt deren Ebene: die Leitung schaltet sie nicht auf. */
    expect(zeile(l, 'g_fremd')).toMatchObject({ canActivate: false });
    expect(zeile(l, 'e5_group_core')).toMatchObject({ canActivate: true });
    expect((await rufe('Basil', 'POST', '/api/campaigns/camp_a/layers/g_fremd')).statusCode).toBe(403);
  });

  it('turns a group on as a whole and one book inside it off (T-088)', async () => {
    const { rufe, repo } = await mitGruppen();
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['e5_group_core', 'ly_a'] })).statusCode).toBe(200);
    let liste = (await rufe('Basil', 'GET', '/api/list?type=Rule')).json();
    expect(namen(liste)).toEqual(['r_a', 'r_frei', 'r_mm', 'r_phb']);
    let l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    expect(zeile(l, 'e5_book_mm')).toMatchObject({ active: false, inPlay: true, off: false });
    /* Aus schlägt an: das Monsterbuch geht, die Gruppe bleibt. */
    const res = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['e5_group_core', 'ly_a'], off: ['e5_book_mm'] });
    expect(res.json()).toMatchObject({ off: ['e5_book_mm'] });
    liste = (await rufe('Basil', 'GET', '/api/list?type=Rule')).json();
    expect(namen(liste)).toEqual(['r_a', 'r_frei', 'r_phb']);
    l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    expect(zeile(l, 'e5_book_mm')).toMatchObject({ inPlay: false, off: true });
    /* Ohne `off` bleibt die Abschaltung stehen. */
    await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['ly_a', 'e5_group_core'] });
    const c = await repo.getEntity('camp_a');
    expect(c?.relations?.filter((r) => r.props?.['mode'] === 'off').map((r) => r.to)).toEqual(['e5_book_mm']);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: [], off: 'e5_book_mm' })).statusCode).toBe(400);
  });

  it('switches a whole group and brings back no old partial choice (T-185)', async () => {
    const { rufe } = await mitGruppen();
    /* Die Leitung hatte beide Bücher einzeln an — wie „Core rules" auf dev. */
    await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['e5_book_phb', 'e5_book_mm', 'ly_a'] });
    let res = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/e5_group_core/group', { on: false });
    expect(res.statusCode).toBe(200);
    expect(res.json().layers).toEqual(['ly_a']);
    expect(zeile(res.json().state, 'e5_book_phb')).toMatchObject({ active: false, inPlay: false });
    res = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/e5_group_core/group', { on: true });
    expect(res.json().layers).toEqual(['e5_group_core', 'ly_a']);
    expect(zeile(res.json().state, 'e5_book_mm')).toMatchObject({ active: false, inPlay: true, off: false });
    /* Ein Buch heraus, Gruppe aus und an: das Buch ist wieder da. */
    await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['e5_group_core', 'ly_a'], off: ['e5_book_mm'] });
    await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/e5_group_core/group', { on: false });
    res = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/e5_group_core/group', { on: true });
    expect(zeile(res.json().state, 'e5_book_mm')).toMatchObject({ inPlay: true, off: false });
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/e5_book_mm/group', { on: true })).statusCode).toBe(400);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/e5_group_core/group', {})).statusCode).toBe(400);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/g_fremd/group', { on: true })).statusCode).toBe(403);
  });

  it('answers every switch with the new state, and a whole group compares (T-143)', async () => {
    const { rufe, repo } = await mitGruppen(Gehalten);
    let l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    expect(zeile(l, 'e5_book_phb')).toMatchObject({ articles: 1, inPlay: false });
    /* Das Popup fragt nach dem Häkchen nicht noch einmal: der Stand kommt mit. */
    let res = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['e5_group_core', 'ly_a'] });
    expect(zeile(res.json().state, 'e5_book_mm')).toMatchObject({ inPlay: true, articles: 1 });
    res = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['ly_a'] });
    expect(zeile(res.json().state, 'e5_book_mm')).toMatchObject({ inPlay: false });
    /* Eine Gruppe wie „D&D 5e (2024)" als Ganzes zum Vergleich. */
    res = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/compare', { layers: ['e5_group_core'] });
    expect(res.json().layers).toEqual(['e5_group_core']);
    expect(zeile(res.json().state, 'e5_group_core')).toMatchObject({ compare: true, inPlay: false });
    const fassung = await rufe('Basil', 'GET', '/api/entities/r_phb');
    expect(fassung.json().refs?.compare).toBe(true);
    res = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/e5_group_core/only', { areas: ['rules'] });
    expect(zeile(res.json().state, 'e5_group_core')).toMatchObject({ only: { areas: ['rules'] } });
    /* Ändert sich Inhalt statt der Kampagne, wird neu gezählt. */
    await repo.putEntity(regel('r_phb_2', 9, 'e5_book_phb'));
    l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    expect(zeile(l, 'e5_book_phb')).toMatchObject({ articles: 2 });
    /* Und eine Kampagne, die eine Ebene aufschaltet, macht sie zu ihrer. */
    await repo.putEntity({ ...BESTAND.find((e) => e.id === 'camp_b')!, relations: [{ id: 'cb_core', type: 'activates', to: 'e5_book_phb', props: {} }] });
    l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    expect(zeile(l, 'e5_book_phb')).toMatchObject({ alsoIn: ['Der Salzpfad'], canActivate: false });
  });

  it('names the running campaign for everyone, and only the admin switches it (T-143)', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Sela', 'GET', '/api/campaigns')).json().current).toMatchObject({ id: 'camp_a', name: 'Aus Nebel wacht', role: 'player', may: null });
    expect((await rufe('Basil', 'GET', '/api/campaigns')).json().current).toMatchObject({ id: 'camp_a', may: 'manage' });
    /* Die Ebene der Kampagne (T-251): Listen nennen nur andere. */
    expect((await rufe('Sela', 'GET', '/api/campaigns')).json().current.campaignLayer).toEqual({ id: 'ly_a', name: 'Runde A' });
    expect((await rufe('Basil', 'PUT', '/api/campaigns/current', { id: 'camp_b' })).statusCode).toBe(403);
    expect((await rufe('Admin', 'PUT', '/api/campaigns/current', { id: 'r_frei' })).statusCode).toBe(400);
    expect((await rufe('Admin', 'PUT', '/api/campaigns/current', { id: 'camp_b' })).statusCode).toBe(200);
    expect((await rufe('Sela', 'GET', '/api/campaigns')).json().current).toMatchObject({ id: 'camp_b', name: 'Der Salzpfad', role: null });
    /* Was jetzt im Spiel ist, folgt: die Runde B bringt ihre Regel. */
    expect(namen((await rufe('Admin', 'GET', '/api/list?type=Rule')).json())).toContain('r_b');
  });

  it('names the publisher of every layer and what a group sorts by (T-094)', async () => {
    const { rufe, repo } = await mitGruppen();
    await repo.putEntity({
      ...ebene('e5_publisher_official', 'Official', 11, 0),
      components: { ...ident('Official', 'layer-0011'), Layer: { kind: 'group', order: 0, groupBy: 'publisher' } },
    });
    const phb = (await repo.getEntity('e5_book_phb'))!;
    await repo.putEntity({ ...phb, relations: [...(phb.relations ?? []), { id: 'e5_book_phb~pub', type: 'partOf', to: 'e5_publisher_official', props: {} }] });
    const l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    expect(zeile(l, 'e5_book_phb')).toMatchObject({ publisher: 'Official', groups: ['e5_group_core', 'e5_publisher_official'] });
    expect(zeile(l, 'e5_publisher_official')).toMatchObject({ groupBy: 'publisher', publisher: '', members: ['e5_book_phb'] });
    expect(zeile(l, 'e5_group_core')).toMatchObject({ groupBy: 'category' });
    expect(zeile(l, 'e5_book_phb').publisherWhy).toBe('Because this layer is part of the publisher group Official.');
    /* Ohne Herausgeber-Gruppe (T-109): eingelesen heisst „Unassigned",
       Homebrew ist nur, was ein Konto oder eine Kampagne hier anlegte. */
    expect(zeile(l, 'e5_book_mm')).toMatchObject({ publisher: 'Unassigned', publisherWhy: 'Not part of any publisher group.' });
    expect(zeile(l, 'ly_a')).toMatchObject({ publisher: 'Homebrew' });
    /* Kürzel nur aus Ebenen im Spiel (T-207): erst aufgeschaltet stehen sie da. */
    expect((await rufe('Sela', 'GET', '/api/sources')).json().publishers).toEqual({});
    await rufe('Basil', 'POST', '/api/campaigns/camp_a/layers/e5_group_core');
    const q = (await rufe('Sela', 'GET', '/api/sources')).json();
    expect(q.publishers).toMatchObject({ PLA: 'Official', MON: 'Unassigned' });
  });

  it('shows the publisher at the layer and lets the admin hang it under another one (T-109)', async () => {
    const { rufe, repo } = await mitGruppen();
    for (const [id, name, n] of [['e5_publisher_official', 'Official', 11], ['e5_publisher_partnered', 'Partnered', 12]] as const) {
      await repo.putEntity({
        ...ebene(id, name, n, 0),
        components: { ...ident(name, `layer-00${n}`), Layer: { kind: 'group', order: 0, groupBy: 'publisher' } },
      });
    }
    let p = (await rufe('Basil', 'GET', '/api/layers/e5_book_mm/publisher')).json();
    expect(p).toMatchObject({ name: 'Unassigned', groups: [], canChange: false });
    expect(p.options.map((o: { name: string }) => o.name)).toEqual(['Official', 'Partnered']);
    expect((await rufe('Basil', 'PUT', '/api/layers/e5_book_mm/publisher', { groups: ['e5_publisher_official'] })).statusCode).toBe(403);
    expect((await rufe('Admin', 'PUT', '/api/layers/e5_book_mm/publisher', { groups: ['e5_group_core'] })).statusCode).toBe(400);
    p = (await rufe('Admin', 'PUT', '/api/layers/e5_book_mm/publisher', { groups: ['e5_publisher_official'] })).json();
    expect(p).toMatchObject({ name: 'Official', groups: ['e5_publisher_official'] });
    /* Umhängen nimmt den alten Herausgeber weg, die Kategorie bleibt. */
    await rufe('Admin', 'PUT', '/api/layers/e5_book_mm/publisher', { groups: ['e5_publisher_partnered'] });
    const mm = (await repo.getEntity('e5_book_mm'))!;
    expect((mm.relations ?? []).filter((r) => r.type === 'partOf').map((r) => r.to)).toEqual(['e5_group_core', 'e5_publisher_partnered']);
    expect((await rufe('Admin', 'GET', '/api/layers/e5_group_core/publisher')).json()).toMatchObject({ name: '', canChange: false });
  });

  it('explains every source abbreviation the viewer may see (T-088)', async () => {
    const { rufe } = await mitGruppen();
    expect((await rufe('Basil', 'POST', '/api/campaigns/camp_a/layers/e5_group_core')).statusCode).toBe(200);
    const q = (await rufe('Sela', 'GET', '/api/sources')).json();
    expect(q.sources).toMatchObject({ PLA: "Player's Handbook", MON: 'Monster Manual' });
  });

  it('turns one on at the place its own order says, and the articles are back', async () => {
    const { rufe, repo } = await aufbau();
    const res = await rufe('Basil', 'POST', '/api/campaigns/camp_a/layers/ly_5e');
    expect(res.statusCode).toBe(200);
    /* Das Regelwerk (order 0) kommt unter die Kampagnenebene (order 50). */
    expect(res.json().layers).toEqual(['ly_5e', 'ly_a']);
    const c = await repo.getEntity('camp_a');
    expect(c?.relations?.filter((r) => r.type === 'activates').map((r) => [r.to, r.props?.['order']])).toEqual([
      ['ly_5e', 10],
      ['ly_a', 20],
    ]);
    const liste = (await rufe('Basil', 'GET', '/api/list?type=Rule')).json();
    expect(namen(liste)).toEqual(['r_5e_1', 'r_5e_2', 'r_5e_3', 'r_a', 'r_frei']);
    expect(liste.unactivated.total).toBe(1);
  });

  it('writes the whole stack in order, and only who manages', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['ly_a', 'ly_5e'] })).json().layers).toEqual([
      'ly_a',
      'ly_5e',
    ]);
    const l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    expect(l.layers.slice(0, 2).map((x: { id: string }) => x.id)).toEqual(['ly_a', 'ly_5e']);
    /* Abschalten löscht nichts: die Artikel fehlen nur in der Liste. */
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: [] })).statusCode).toBe(200);
    expect((await rufe('Admin', 'GET', '/api/list?type=Rule')).json().unactivated.total).toBe(5);
    expect((await rufe('Mira', 'PUT', '/api/campaigns/camp_a/layers', { layers: [] })).statusCode).toBe(403);
    expect((await rufe('Sela', 'POST', '/api/campaigns/camp_a/layers/ly_5e')).statusCode).toBe(403);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['r_a'] })).statusCode).toBe(400);
  });

  it('keeps a layer of another campaign from the GM, not from the admin', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Basil', 'POST', '/api/campaigns/camp_a/layers/ly_b')).statusCode).toBe(403);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['ly_a', 'ly_b'] })).statusCode).toBe(403);
    expect((await rufe('Admin', 'POST', '/api/campaigns/camp_a/layers/ly_b')).statusCode).toBe(200);
  });
});

describe('the registry counts stored and in play', () => {
  it('gives both numbers per type and names the campaign', async () => {
    const { rufe } = await aufbau();
    const u = (await rufe('Admin', 'GET', '/api/registry/usage')).json();
    expect(u.types['Rule']).toBe(6);
    expect(u.inPlay['Rule']).toBe(2);
    expect(u.campaign).toEqual({ id: 'camp_a', name: 'Aus Nebel wacht' });
  });
});
