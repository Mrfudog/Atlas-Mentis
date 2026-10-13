/**
 * Die eigene Kampagne als Datei (T-077): was hineingeht, wer sie bekommt,
 * und dass sie auf demselben Weg zurückkommt — Ausfuhr, frischer Bestand,
 * Einfuhr, derselbe Bestand.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { runImport } from '../src/import.js';
import { ausfuhrName } from '../src/ausfuhr.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const ebene = (id: string, name: string, kind: string): Entity => ({
  id, name, interfaces: ['Layer'],
  components: { ...ident(name, `layer-${id}`), Layer: { kind, order: kind === 'system' ? 0 : 50 } },
  relations: [],
});
const kampagne = (id: string, name: string, ebenen: string[]): Entity => ({
  id, name, interfaces: ['Campaign'],
  components: ident(name, `campaign-${id}`),
  relations: ebenen.map((to, i) => ({ id: `${id}_ac${i}`, type: 'activates', to, props: { order: i } })),
});
const inEbene = (e: Entity, to: string, mode?: 'removes'): Entity => ({
  ...e,
  relations: [...(e.relations ?? []), { id: `${e.id}_in_${to}`, type: 'inLayer', to, props: mode ? { mode } : {} }],
});
const kreatur = (id: string, name: string, mehr: Record<string, unknown> = {}): Entity => ({
  id, name, interfaces: ['Creature'],
  components: { ...ident(name, `creature-${id}`), ...mehr },
  relations: [],
});
const regel = (id: string, name: string): Entity => ({
  id, name, interfaces: ['Rule'],
  components: ident(name, `rule-${id}`),
  relations: [],
});

const BESTAND: Entity[] = [
  ebene('ly_5e', 'D&D 5e (2014)', 'system'),
  ebene('ly_nebel', 'Nebelwacht', 'campaign'),
  ebene('ly_salz', 'Salzküste', 'campaign'),
  kampagne('camp_nebel', 'Nebelwacht', ['ly_5e', 'ly_nebel']),
  kampagne('camp_salz', 'Salzküste', ['ly_salz']),
  inEbene(regel('r_grapple', 'Grapple'), 'ly_5e'),
  /* Eine Regel aus 5e.tools, die die Kampagnenebene herausnimmt: die
     Änderung steht an ihr, also geht sie mit. */
  inEbene(inEbene(regel('r_flanking', 'Flanking'), 'ly_5e'), 'ly_nebel', 'removes'),
  inEbene(
    kreatur('npc_wachsmann', 'Der Wachsmann', {
      Visibility: { audience: 'gm' },
      Secrets: { secret: [{ id: 'secret-bruder', value: 'Er sucht seinen Bruder.' }] },
    }),
    'ly_nebel',
  ),
  inEbene(kreatur('npc_salz', 'Salzhändlerin'), 'ly_salz'),
  inEbene(kreatur('npc_salz_geheim', 'Schmugglerin', { Visibility: { audience: 'gm' } }), 'ly_salz'),
  regel('r_hausregel', 'Hausregel ohne Ebene'),
  /* Vorlage und Instanz: die Instanz geht so hinaus, wie sie liegt. */
  {
    id: 'sb_wache', name: 'Wache', interfaces: ['Statblock'],
    components: { ...ident('Wache', 'statblock-0001'), Statblock: { ac: 16, hp: 11 } },
    relations: [],
  },
  {
    id: 'sb_wache_1', name: 'Wache 1', interfaces: ['Statblock'],
    components: { Identity: { name: 'Wache 1', id: 'statblock-0002', aliases: [] }, Statblock: { hp: 18 } },
    relations: [{ id: 'sb_wache_1_i', type: 'instanceOf', to: 'sb_wache', props: {} }],
  },
];

type Rolle = 'gm' | 'co-gm' | 'player' | 'spectator';

async function aufbau() {
  const repo = new InMemoryRepository(seedRegistry, BESTAND);
  const app = buildApp({ repo });
  const ids: string[] = [];
  const konto = async (name: string, admin: boolean, roles: Record<string, Rolle> = {}) => {
    const id = randomUUID();
    ids.push(id);
    await repo.putUser({ id, name, passwordHash: await hashPassword(PASSWORT), isAdmin: admin, actorIds: [], roles });
  };
  await konto('Basil', true);
  await konto('Lea', false, { camp_nebel: 'gm' });
  await konto('Cora', false, { camp_nebel: 'co-gm' });
  await konto('Sela', false, { camp_nebel: 'player' });
  await konto('Mira', false, { camp_salz: 'gm' });
  const keks = async (name: string) => {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = res.cookies.find((x) => x.name === 'nw_session');
    return c ? `nw_session=${c.value}` : '';
  };
  const ausfuhr = async (name: string, frage: string) =>
    app.inject({ method: 'GET', url: `/api/export?${frage}`, headers: { cookie: await keks(name) } });
  return { repo, app, ids, ausfuhr };
}

const idsIn = (datei: { entities: Entity[] }) => datei.entities.map((e) => e.id).sort();

describe('GET /api/export', () => {
  it('gibt der Leitung Register und die Artikel ihrer Kampagne, als Datei', async () => {
    const { ausfuhr } = await aufbau();
    const res = await ausfuhr('Lea', 'campaign=camp_nebel');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="nebelwacht-\d{4}-\d{2}-\d{2}\.json"$/);
    const datei = res.json();
    expect(datei.format).toBe('nebelwacht/1');
    expect(datei.layers).toBe('campaign');
    expect(Object.keys(datei.registry.interfaces)).toContain('Creature');
    expect(idsIn(datei)).toEqual(
      [
        'camp_nebel', 'ly_5e', 'ly_nebel', // die Kampagne und die Ebenen, die sie aufschaltet
        'npc_wachsmann', 'r_flanking', // aus der Kampagnenebene, auch die herausgenommene Regel
        'r_hausregel', 'sb_wache', 'sb_wache_1', // ohne Ebene
      ].sort(),
    );
    /* Die Geheimnisse sind die der Leitung — eine Sicherung ohne sie wäre keine. */
    const wachsmann = datei.entities.find((e: Entity) => e.id === 'npc_wachsmann');
    expect(wachsmann.components.Secrets.secret).toHaveLength(1);
    /* Gespeichert, nicht gelesen: die Instanz trägt nur, was abweicht. */
    const instanz = datei.entities.find((e: Entity) => e.id === 'sb_wache_1');
    expect(instanz.components.Statblock).toEqual({ hp: 18 });
    expect(instanz.fromTemplate).toBeUndefined();
  });

  it('enthält keine Konten, Rollen oder Sitzungen (REQ-199)', async () => {
    const { ausfuhr, ids } = await aufbau();
    for (const frage of ['campaign=camp_nebel', 'campaign=camp_nebel&layers=all']) {
      const res = await ausfuhr('Basil', frage);
      for (const id of ids) expect(res.body).not.toContain(id);
      const datei = res.json();
      expect(Object.keys(datei).sort()).toEqual(['at', 'campaign', 'entities', 'format', 'layers', 'registry']);
      expect(JSON.stringify(datei.entities)).not.toMatch(/passwordHash|nw_session|"roles"|"actorIds"|"userIds"/);
    }
  });

  it('lässt nur Verwaltung und Leitung dieser Kampagne ausführen', async () => {
    const { ausfuhr } = await aufbau();
    expect((await ausfuhr('Cora', 'campaign=camp_nebel')).statusCode).toBe(200);
    expect((await ausfuhr('Basil', 'campaign=camp_nebel')).statusCode).toBe(200);
    expect((await ausfuhr('Sela', 'campaign=camp_nebel')).statusCode).toBe(403);
    expect((await ausfuhr('Mira', 'campaign=camp_nebel')).statusCode).toBe(403);
    expect((await ausfuhr('Lea', 'campaign=camp_salz')).statusCode).toBe(403);
    expect((await ausfuhr('Lea', '')).statusCode).toBe(400);
    expect((await ausfuhr('Basil', 'campaign=gibt_es_nicht')).statusCode).toBe(404);
  });

  it('siebt nach dem Recht des Aufrufers: die andere Runde bleibt draussen', async () => {
    const { ausfuhr } = await aufbau();
    const salz = idsIn((await ausfuhr('Mira', 'campaign=camp_salz')).json());
    expect(salz).toEqual(['camp_salz', 'ly_salz', 'npc_salz', 'npc_salz_geheim', 'r_hausregel', 'sb_wache', 'sb_wache_1'].sort());
    expect(salz).not.toContain('npc_wachsmann');
  });

  it('gibt `layers=all` nur der Verwaltung, dann mit allem', async () => {
    const { ausfuhr } = await aufbau();
    expect((await ausfuhr('Lea', 'campaign=camp_nebel&layers=all')).statusCode).toBe(403);
    expect((await ausfuhr('Basil', 'campaign=camp_nebel&layers=nichts')).statusCode).toBe(400);
    const alles = (await ausfuhr('Basil', 'campaign=camp_nebel&layers=all')).json();
    expect(alles.layers).toBe('all');
    expect(idsIn(alles)).toEqual(BESTAND.map((e) => e.id).sort());
  });

  it('kommt zurück: Ausfuhr → frischer Bestand → Einfuhr ergibt denselben Bestand', async () => {
    const { ausfuhr, repo } = await aufbau();
    for (const [wer, frage] of [['Lea', 'campaign=camp_nebel'], ['Basil', 'campaign=camp_nebel&layers=all']] as const) {
      const datei = (await ausfuhr(wer, frage)).json();
      const frisch = new InMemoryRepository(seedRegistry, []);
      await frisch.putUser({ id: randomUUID(), name: 'Verwaltung', passwordHash: 'x', isAdmin: true, actorIds: [], roles: {} });
      const r = await runImport(frisch, datei);
      expect(r.geschrieben).toBe(datei.entities.length);
      /* `updatedAt` setzt die Ablage beim Schreiben; der Rest ist derselbe. */
      const ohneZeit = (l: Entity[]) =>
        l.map(({ updatedAt: _t, ...e }: Entity & { updatedAt?: string }) => e).sort((a, b) => a.id.localeCompare(b.id));
      expect(ohneZeit(await frisch.listEntities())).toEqual(ohneZeit(datei.entities));
      expect(await frisch.getRegistry()).toEqual(await repo.getRegistry());
    }
  });
});

describe('ausfuhrName', () => {
  it('macht aus dem Namen der Kampagne einen Dateinamen', () => {
    expect(ausfuhrName('Aus Nebel wacht', '2026-10-13T15:00:00Z')).toBe('aus-nebel-wacht-2026-10-13.json');
    expect(ausfuhrName('Salzküste & Co.', '2026-10-13T15:00:00Z')).toBe('salzkuste-co-2026-10-13.json');
    expect(ausfuhrName('???', '2026-10-13T15:00:00Z')).toBe('campaign-2026-10-13.json');
  });
});
