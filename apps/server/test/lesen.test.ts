/**
 * Die Leseansicht (T-091, REQ-247): ein Abenteuer als Buch — das
 * Inhaltsverzeichnis in Lesereihenfolge, ein Kapitel am Stück mit seinen
 * Karten und Begegnungen, die Suche, der Lesestand je Konto, und „im Buch
 * lesen" am Artikel. Gesiebt wie überall: Leitungstext sehen Spielende
 * nicht, und eine Fassung der Kampagne steht an der Stelle des Originals.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ident = (name: string, id: string) => ({
  Identity: { name, id, aliases: [] },
  Status: { status: 'ready' },
});
const kante = (id: string, type: string, to: string) => ({ id: `${id}~${type}`, type, to, props: {} });
const artikel = (
  id: string,
  typ: string,
  name: string,
  nr: string,
  ly: string,
  extra: { teil?: string; audience?: string; text?: string; seite?: string; karten?: Record<string, unknown> } = {},
): Entity => ({
  id,
  name,
  interfaces: [typ],
  components: {
    ...ident(name, nr),
    Visibility: { audience: extra.audience ?? 'gm' },
    ...(extra.text ? { Prose: { paragraph: [{ id: 'text', value: extra.text }] } } : {}),
    /* Wie der Importer: `Source` an einer Art, die sie trägt, sonst die Notiz. */
    ...(extra.seite
      ? typ === 'Creature'
        ? { Source: { publication: 'TST', page: extra.seite } }
        : { Notes: { note: [{ id: 'source', value: `Source: TST, p. ${extra.seite}` }] } }
      : {}),
    ...(extra.karten ?? {}),
  },
  relations: [kante(id, 'inLayer', ly), ...(extra.teil ? [kante(id, 'partOf', extra.teil)] : [])],
});

const BUCH = 'e5_book_tst';
const BESTAND: Entity[] = [
  { id: BUCH, name: 'The Sunken Test', interfaces: ['Layer'], components: { ...ident('The Sunken Test', 'layer-0001'), Layer: { kind: 'adventure', order: 0 } }, relations: [] },
  { id: 'ly_aus', name: 'Not on', interfaces: ['Layer'], components: { ...ident('Not on', 'layer-0003'), Layer: { kind: 'adventure', order: 0 } }, relations: [] },
  /* Ein Regelwerk, dessen Text nicht eingelesen ist — nur Artikel (T-126). */
  { id: 'ly_phb', name: 'Rules Only', interfaces: ['Layer'], components: { ...ident('Rules Only', 'layer-0004'), Layer: { kind: 'book', order: 0 } }, relations: [] },
  { id: 'ly_a', name: 'Runde A', interfaces: ['Layer'], components: { ...ident('Runde A', 'layer-0002'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  {
    id: 'camp_a', name: 'Aus Nebel wacht', interfaces: ['Campaign'], components: ident('Aus Nebel wacht', 'campaign-0001'),
    relations: [
      { id: 'camp_a~ac1', type: 'activates', to: BUCH, props: { order: 10 } },
      { id: 'camp_a~ac2', type: 'activates', to: 'ly_a', props: { order: 20 } },
    ],
  },
  artikel('st_tst', 'Story', 'The Sunken Test', 'story-0001', BUCH, { karten: { Story: { kind: 'adventure' } }, text: 'An adventure for testers.' }),
  artikel('st_k2', 'Arc', 'Chapter 2: Deep', 'story-0003', BUCH, { teil: 'st_tst', seite: '20' }),
  artikel('st_k1', 'Arc', 'Chapter 1: Reeds', 'story-0002', BUCH, { teil: 'st_tst', seite: '5' }),
  artikel('sc_mund', 'Scene', '1. Mouth', 'scene-0001', BUCH, {
    teil: 'st_k1', seite: '6', text: 'Wet reeds. See [[scene-0002|2]].',
    karten: { ReadAloud: { readaloud: [{ id: 'read', value: 'You smell the marsh.' }] } },
  }),
  artikel('sc_bau', 'Scene', '2. Den', 'scene-0002', BUCH, { teil: 'st_k1', seite: '8', text: 'A dry den with a secret lever.' }),
  /* Ein Abschnitt, den die Leitung für alle freigegeben hat. */
  artikel('sc_offen', 'Scene', 'Rumours', 'scene-0003', BUCH, { teil: 'st_k2', seite: '21', audience: 'public', text: 'Everyone has heard of the lever.' }),
  {
    ...artikel('mp_mund', 'Map', 'Map of the Mouth', 'map-0001', BUCH),
    relations: [kante('mp_mund', 'inLayer', BUCH), kante('mp_mund', 'mapOf', 'sc_mund')],
  },
  {
    ...artikel('en_mund', 'Encounter', '1. Mouth', 'encounter-0001', BUCH, { teil: 'sc_mund' }),
  },
  /* Ein Monster aus dem Buch, mit Seite — „im Buch lesen" führt dorthin. */
  { ...artikel('cr_frosch', 'Creature', 'Bog Frog', 'creature-0001', BUCH, { seite: '9' }) },
  artikel('sc_fremd', 'Scene', 'Elsewhere', 'scene-0009', 'ly_aus', { audience: 'public', text: 'Not on.' }),
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
  const rufe = async (name: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => {
    if (!kekse.has(name)) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      kekse.set(name, `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return app.inject({ method, url, headers: { cookie: kekse.get(name)! }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  };
  return { repo, rufe };
}

describe('reading a layer as a book (T-091)', () => {
  it('lists the contents in reading order, chapter by chapter', async () => {
    const { rufe } = await aufbau();
    const r = (await rufe('Basil', 'GET', `/api/read/${BUCH}`)).json();
    expect(r.layer).toEqual({ id: BUCH, name: 'The Sunken Test', kind: 'adventure' });
    expect(r.toc.map((z: { id: string; depth: number; unit: string }) => `${z.id}:${z.depth}@${z.unit}`)).toEqual([
      'st_tst:0@st_tst',
      'st_k1:1@st_k1',
      'sc_mund:2@st_k1',
      'sc_bau:2@st_k1',
      'st_k2:1@st_k2',
      'sc_offen:2@st_k2',
    ]);
    expect(r.toc.find((z: { id: string }) => z.id === 'sc_mund')).toMatchObject({ name: '1. Mouth', type: 'Scene', page: '6' });
    expect(r.position).toBeNull();
  });

  it('keeps the text of the GM from the players, and what is not turned on from everyone', async () => {
    const { rufe } = await aufbau();
    const r = (await rufe('Sela', 'GET', `/api/read/${BUCH}`)).json();
    expect(r.toc.map((z: { id: string; unit: string }) => `${z.id}@${z.unit}`)).toEqual(['sc_offen@st_k2']);
    /* Das Stück kommt ohne seinen Kopf, mit dem, was sie sieht. */
    const k = (await rufe('Sela', 'GET', `/api/read/${BUCH}/unit/st_k2`)).json();
    expect(k.sections.map((s: { id: string }) => s.id)).toEqual(['sc_offen']);
    expect((await rufe('Sela', 'GET', `/api/read/${BUCH}/unit/st_k1`)).json().sections).toEqual([]);
    /* Nicht aufgeschaltet heisst: nicht da, auch für die Verwaltung. */
    expect((await rufe('Admin', 'GET', '/api/read/ly_aus')).json().toc).toEqual([]);
    expect((await rufe('Admin', 'GET', '/api/read/camp_a')).statusCode).toBe(404);
  });

  it('says when a layer has no book text at all — and only then (T-126)', async () => {
    const { rufe } = await aufbau();
    const leer = (await rufe('Admin', 'GET', '/api/read/ly_phb')).json();
    expect(leer.toc).toEqual([]);
    expect(leer.empty).toBe('noText');
    /* Gesiebt oder nicht aufgeschaltet ist etwas anderes, und das bleibt ungesagt. */
    expect((await rufe('Admin', 'GET', '/api/read/ly_aus')).json().empty).toBeUndefined();
    expect((await rufe('Sela', 'GET', `/api/read/${BUCH}`)).json().empty).toBeUndefined();
  });

  it('gives a chapter in one piece, with its maps, encounters and the targets of its links', async () => {
    const { rufe } = await aufbau();
    const k = (await rufe('Basil', 'GET', `/api/read/${BUCH}/unit/st_k1`)).json();
    expect(k.unit).toBe('st_k1');
    expect(k.sections.map((s: { id: string; depth: number }) => `${s.id}:${s.depth}`)).toEqual(['st_k1:1', 'sc_mund:2', 'sc_bau:2']);
    const mund = k.sections[1];
    expect(mund.entity.components.ReadAloud.readaloud[0].value).toBe('You smell the marsh.');
    expect(mund.embeds.map((e: { id: string }) => e.id).sort()).toEqual(['en_mund', 'mp_mund']);
    expect(k.refs.links['scene-0002'].map((x: { id: string }) => x.id)).toEqual(['sc_bau']);
    expect(k.refs.names['st_tst']).toBe('The Sunken Test');
    /* Ein Abschnitt statt eines Kapitels nennt sein Kapitel. */
    expect((await rufe('Basil', 'GET', `/api/read/${BUCH}/unit/sc_bau`)).json().unit).toBe('st_k1');
  });

  it('puts the campaign’s version in place of the original (E-018)', async () => {
    const { rufe } = await aufbau();
    const { id } = (await rufe('Admin', 'POST', '/api/entities/sc_bau/adapt')).json();
    const r = (await rufe('Admin', 'GET', `/api/read/${BUCH}`)).json();
    expect(r.toc.find((z: { id: string }) => z.id === 'sc_bau')).toMatchObject({ article: id, name: '2. Den' });
    const k = (await rufe('Admin', 'GET', `/api/read/${BUCH}/unit/st_k1`)).json();
    expect(k.sections.find((s: { id: string }) => s.id === 'sc_bau').entity.id).toBe(id);
    /* „Im Buch lesen" an der Fassung führt an die Stelle des Originals. */
    expect((await rufe('Admin', 'GET', `/api/entities/${id}`)).json().refs.reading).toEqual({ layer: BUCH, at: 'sc_bau' });
  });

  it('searches the book in what the reader may see', async () => {
    const { rufe } = await aufbau();
    const gm = (await rufe('Basil', 'GET', `/api/read/${BUCH}/search?q=lever`)).json();
    expect(gm.hits.map((h: { id: string; unit: string }) => `${h.id}@${h.unit}`)).toEqual(['sc_bau@st_k1', 'sc_offen@st_k2']);
    expect(gm.hits[0].snippet).toContain('secret lever');
    expect(gm.hits[0].snippet.startsWith('A dry den')).toBe(true);
    /* Verweise lesen sich als ihr Text. */
    expect((await rufe('Basil', 'GET', `/api/read/${BUCH}/search?q=see 2`)).json().hits[0].id).toBe('sc_mund');
    const spieler = (await rufe('Sela', 'GET', `/api/read/${BUCH}/search?q=lever`)).json();
    expect(spieler.hits.map((h: { id: string }) => h.id)).toEqual(['sc_offen']);
    expect((await rufe('Sela', 'GET', `/api/read/${BUCH}/search?q=l`)).statusCode).toBe(400);
  });

  it('remembers where each account stopped reading', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Basil', 'PUT', `/api/read/${BUCH}/position`, { id: 'sc_bau' })).statusCode).toBe(204);
    expect((await rufe('Basil', 'GET', `/api/read/${BUCH}`)).json().position).toBe('sc_bau');
    /* Ein anderes Konto hat seinen eigenen. */
    expect((await rufe('Admin', 'GET', `/api/read/${BUCH}`)).json().position).toBeNull();
    /* Spielende merken sich ihren Stand, aber nur an dem, was sie sehen. */
    expect((await rufe('Sela', 'PUT', `/api/read/${BUCH}/position`, { id: 'sc_offen' })).statusCode).toBe(204);
    expect((await rufe('Sela', 'PUT', `/api/read/${BUCH}/position`, { id: 'sc_bau' })).statusCode).toBe(400);
    expect((await rufe('Sela', 'PUT', `/api/read/${BUCH}/position`, { id: 'cr_frosch' })).statusCode).toBe(400);
    expect((await rufe('Sela', 'GET', `/api/read/${BUCH}`)).json().position).toBe('sc_offen');
  });

  it('leads from an article to its place in the book', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Basil', 'GET', '/api/entities/sc_mund')).json().refs.reading).toEqual({ layer: BUCH, at: 'sc_mund' });
    expect((await rufe('Basil', 'GET', '/api/entities/cr_frosch')).json().refs.reading).toEqual({ layer: BUCH, page: '9' });
    /* Eine Ebene ohne Text führt nirgends hin. */
    expect((await rufe('Basil', 'GET', '/api/entities/camp_a')).json().refs.reading).toBeUndefined();
  });
});
