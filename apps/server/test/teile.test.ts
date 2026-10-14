/**
 * Bücher aus Teilen (T-108, E-028, E-029): ein Kapitel eines Abenteuers ist
 * Chapter und Arc über denselben Szenen; die Artikelseite zeigt seine Teile
 * in Reihenfolge, die Leseansicht bringt das Ziel eines Verweis-Teils mit,
 * und ein einzelner Vorlesetext lässt sich holen (als Fassung) oder
 * verwenden (als Verweis aufs Original).
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const L = 'e5_book_tst';
const id = (name: string, nr: string) => ({ Identity: { name, id: nr, aliases: [] } });
const gm = { Visibility: { audience: 'gm' } };
const in_ = (x: string, ly = L) => ({ id: `${x}~in`, type: 'inLayer', to: ly, props: {} });
const teil = (x: string, to: string, rank?: number) => ({ id: `${x}~p-${to}`, type: 'partOf', to, props: rank === undefined ? {} : { rank } });

const BESTAND: Entity[] = [
  { id: L, name: 'The Sunken Test', interfaces: ['Layer'], components: { ...id('The Sunken Test', 'layer-0001'), Layer: { kind: 'adventure', order: 0 } }, relations: [] },
  { id: 'ly_a', name: 'Runde A', interfaces: ['Layer'], components: { ...id('Runde A', 'layer-0002'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'ly_mm', name: 'Monster Manual', interfaces: ['Layer'], components: { ...id('Monster Manual', 'layer-0003'), Layer: { kind: 'book', order: 0 } }, relations: [] },
  {
    id: 'camp_a', name: 'Aus Nebel wacht', interfaces: ['Campaign'], components: id('Aus Nebel wacht', 'campaign-0001'),
    relations: [
      { id: 'camp_a~ac1', type: 'activates', to: L, props: { order: 10 } },
      { id: 'camp_a~ac2', type: 'activates', to: 'ly_a', props: { order: 20 } },
      { id: 'camp_a~ac3', type: 'activates', to: 'ly_mm', props: { order: 5 } },
    ],
  },
  { id: 'sb_goblin', name: 'Goblin', interfaces: ['Statblock'], components: id('Goblin', 'statblock-0001'), relations: [in_('sb_goblin', 'ly_mm')] },
  { id: 'arc_k1', name: 'Chapter 1: Reeds', interfaces: ['Arc'], components: { ...id('Chapter 1: Reeds', 'arc-0001'), ...gm }, relations: [in_('arc_k1')] },
  { id: 'arc_k1_chapter', name: 'Chapter 1: Reeds', interfaces: ['Chapter'], components: { ...id('Chapter 1: Reeds', 'chapter-0001'), ...gm }, relations: [in_('arc_k1_chapter'), { id: 'ch~of', type: 'chapterOf', to: 'arc_k1', props: {} }] },
  { id: 'pa_intro', name: 'Reeds everywhere.', interfaces: ['Paragraph'], components: { ...id('Reeds everywhere.', 'paragraph-0001'), ...gm, Prose: { paragraph: [{ id: 'text', value: 'Reeds everywhere.' }] } }, relations: [in_('pa_intro'), teil('pa_intro', 'arc_k1_chapter', 1)] },
  { id: 'em_goblin', name: 'Goblin', interfaces: ['Embed'], components: { ...id('Goblin', 'embed-0001'), ...gm, Embed: { target: 'sb_goblin' } }, relations: [in_('em_goblin'), teil('em_goblin', 'arc_k1_chapter', 2)] },
  { id: 'sc_cave', name: 'Reed Cave', interfaces: ['Scene'], components: { ...id('Reed Cave', 'scene-0001'), ...gm }, relations: [in_('sc_cave'), teil('sc_cave', 'arc_k1'), teil('sc_cave', 'arc_k1_chapter', 3)] },
  { id: 'ra_drip', name: 'Water drips.', interfaces: ['ReadAloudText'], components: { ...id('Water drips.', 'readaloudtext-0001'), ...gm, ReadAloud: { readaloud: [{ id: 'read', value: 'Water drips.' }] } }, relations: [in_('ra_drip'), teil('ra_drip', 'sc_cave', 1)] },
  { id: 'arc_eigen', name: 'Session zero', interfaces: ['Arc'], components: id('Session zero', 'arc-0002'), relations: [in_('arc_eigen', 'ly_a'), teil('arc_eigen', 'camp_a')] },
  { id: 'sc_eigen', name: 'At the inn', interfaces: ['Scene'], components: id('At the inn', 'scene-0002'), relations: [in_('sc_eigen', 'ly_a'), teil('sc_eigen', 'arc_eigen')] },
];

async function aufbau() {
  const repo = new InMemoryRepository(seedRegistry, BESTAND.map((e) => structuredClone(e)));
  const app = buildApp({ repo });
  for (const [name, admin, roles] of [
    ['Admin', true, {}],
    ['Basil', false, { camp_a: 'gm' }],
    ['Sela', false, { camp_a: 'player' }],
  ] as const) {
    await repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: admin, actorIds: [], roles: { ...roles } });
  }
  const kekse = new Map<string, string>();
  const rufe = async (name: string, method: 'GET' | 'POST', url: string, payload?: object) => {
    if (!kekse.has(name)) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      kekse.set(name, `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return app.inject({ method, url, headers: { cookie: kekse.get(name)! }, ...(payload ? { payload } : {}) });
  };
  return { repo, rufe };
}

describe('a chapter made of parts (T-108)', () => {
  it('reads as a book from its Chapters, with the target of an embed', async () => {
    const { rufe } = await aufbau();
    const buch = (await rufe('Basil', 'GET', `/api/read/${L}`)).json();
    expect(buch.toc.map((z: { id: string }) => z.id)).toEqual(['arc_k1_chapter', 'sc_cave']);
    const stueck = (await rufe('Basil', 'GET', `/api/read/${L}/unit/arc_k1_chapter`)).json();
    expect(stueck.sections.map((s: { id: string }) => s.id)).toEqual(['arc_k1_chapter', 'pa_intro', 'em_goblin', 'sc_cave', 'ra_drip']);
    const em = stueck.sections.find((s: { id: string }) => s.id === 'em_goblin');
    expect(em).toMatchObject({ toc: false, target: { id: 'sb_goblin' } });
    /* Der Absatz ist kein Anhang des Kapitels. */
    expect(stueck.sections[0].embeds).toEqual([]);
    /* „Read in book" am Arc führt zu seinem Kapitel, am Absatz zum Absatz. */
    expect((await rufe('Basil', 'GET', '/api/entities/arc_k1')).json().refs.reading).toEqual({ layer: L, at: 'arc_k1_chapter' });
    expect((await rufe('Basil', 'GET', '/api/entities/ra_drip')).json().refs.reading).toEqual({ layer: L, at: 'ra_drip' });
    /* Wer nach einem Absatz fragt, bekommt sein Stück. */
    expect((await rufe('Basil', 'GET', `/api/read/${L}/unit/ra_drip`)).json().unit).toBe('arc_k1_chapter');
  });

  it('lists its parts in order on the article page, and not under “Linked here”', async () => {
    const { rufe } = await aufbau();
    const t = (await rufe('Basil', 'GET', '/api/entities/arc_k1_chapter/parts')).json();
    expect(t.parts.map((p: { id: string }) => p.id)).toEqual(['pa_intro', 'em_goblin', 'sc_cave']);
    expect(t.parts[1].target.id).toBe('sb_goblin');
    const zurueck = (await rufe('Basil', 'GET', '/api/entities/arc_k1_chapter/backlinks')).json();
    expect(zurueck.map((b: { from: { id: string } }) => b.from.id)).toEqual(['sc_cave']);
    /* Ein Arc hat seine Szenen, nicht die Absätze des Kapitels. */
    expect((await rufe('Basil', 'GET', '/api/entities/arc_k1/parts')).json().parts).toEqual([]);
    /* Was die Leitung liest, sehen Spielende nicht. */
    expect((await rufe('Sela', 'GET', '/api/entities/arc_k1_chapter/parts')).statusCode).toBe(404);
  });

  it('takes a single read-aloud text into an own scene, at the next place, as a version', async () => {
    const { repo, rufe } = await aufbau();
    const frage = (await rufe('Basil', 'POST', '/api/entities/ra_drip/take', {})).json();
    /* Ein Teil darf auch in eine eigene Szene. */
    expect(frage.into.map((z: { id: string }) => z.id)).toEqual(['camp_a', 'sc_eigen', 'arc_eigen']);
    const r = await rufe('Basil', 'POST', '/api/entities/ra_drip/take', { into: 'sc_eigen' });
    expect(r.statusCode).toBe(201);
    const f = (await repo.getEntity(r.json().id))!;
    expect(f.interfaces).toEqual(['ReadAloudText']);
    expect(f.relations?.find((k) => k.type === 'partOf')).toMatchObject({ to: 'sc_eigen', props: { rank: 1 } });
    expect(f.relations?.find((k) => k.type === 'overrides')?.to).toBe('ra_drip');
    /* Das Original bleibt im Kapitel. */
    expect((await repo.getEntity('ra_drip'))!.relations?.find((k) => k.type === 'partOf')?.to).toBe('sc_cave');
  });

  it('uses a read-aloud text as it is: a link to the original, behind what is already there', async () => {
    const { repo, rufe } = await aufbau();
    await rufe('Basil', 'POST', '/api/entities/pa_intro/take', { into: 'sc_eigen', use: true });
    const r = await rufe('Basil', 'POST', '/api/entities/ra_drip/take', { into: 'sc_eigen', use: true });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ used: true });
    const v = (await repo.getEntity(r.json().id))!;
    expect(v.interfaces).toEqual(['Embed']);
    expect(v.components['Embed']).toEqual({ target: 'ra_drip' });
    expect(v.relations?.find((k) => k.type === 'partOf')).toMatchObject({ to: 'sc_eigen', props: { rank: 2 } });
    expect(v.relations?.find((k) => k.type === 'inLayer')?.to).toBe('ly_a');
    /* Keine Fassung: das Original gilt weiter. */
    expect((await repo.listEntities()).some((e) => e.relations?.some((k) => k.type === 'overrides' && k.to === 'ra_drip'))).toBe(false);
    /* Die eigene Szene zeigt beide, in Reihenfolge. */
    const t = (await rufe('Basil', 'GET', '/api/entities/sc_eigen/parts')).json();
    expect(t.parts.map((p: { target?: { id: string } }) => p.target?.id)).toEqual(['pa_intro', 'ra_drip']);
  });

  it('takes a whole Chapter into an own arc; the campaign still reads as its story', async () => {
    const { repo, rufe } = await aufbau();
    const r = (await rufe('Basil', 'POST', '/api/entities/arc_k1_chapter/take', { into: 'arc_eigen' })).json();
    /* Kapitel, Absatz, Verweis, Szene und ihr Vorlesetext. */
    expect(r).toMatchObject({ created: 5, taken: 5 });
    const k = (await repo.getEntity(r.id))!;
    expect(k.relations?.find((x) => x.type === 'partOf')).toMatchObject({ to: 'arc_eigen', props: { rank: 1 } });
    /* Die Kampagnenebene bleibt eine Geschichte: das geholte Kapitel steht unter dem Arc. */
    const b = (await rufe('Basil', 'GET', '/api/read/ly_a')).json();
    expect(b.toc.map((z: { id: string }) => z.id)).toEqual(expect.arrayContaining(['arc_eigen', r.id]));
  });
});
