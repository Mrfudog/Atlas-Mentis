/**
 * **Die Kurzansicht eines Boards** (T-425, Schnitt 4): eine Skizze der
 * Tafel, gerechnet in der Oberfläche aus dem Board, wie der Server es
 * schickt (`boardSketch`). Was die Leitung als „GM only" hält, nimmt der
 * Server vorher weg — die Spielerin sieht in der Skizze keine Kachel davon.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { boardSketch, pickView } from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const id = (name: string, nr: string) => ({ Identity: { name, id: nr, aliases: [] }, Status: { status: 'ready' } });
const in_ = (x: string) => ({ id: `${x}~in`, type: 'inLayer', to: 'ly_a', props: {} });

const BESTAND: Entity[] = [
  { id: 'ly_a', name: 'Runde A', interfaces: ['Layer'], components: { ...id('Runde A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'camp_a', name: 'Aus Nebel wacht', interfaces: ['Campaign'], components: id('Aus Nebel wacht', 'campaign-0001'), relations: [{ id: 'camp_a~ac', type: 'activates', to: 'ly_a', props: { order: 10 } }] },
  { id: 'sc_alter', name: 'Der Alte', interfaces: ['Scene'], components: id('Der Alte', 'scene-0001'), relations: [in_('sc_alter')] },
  { id: 'sc_falle', name: 'Die Falle', interfaces: ['Scene'], components: id('Die Falle', 'scene-0002'), relations: [in_('sc_falle')] },
  {
    id: 'brd',
    name: 'Session board',
    interfaces: ['Board'],
    components: { ...id('Session board', 'board-0001'), Board: { width: 1200, height: 800 } },
    relations: [
      in_('brd'),
      { id: 'brd~p1', type: 'placed', to: 'sc_alter', props: { x: 100, y: 100 } },
      { id: 'brd~p2', type: 'placed', to: 'sc_falle', props: { x: 500, y: 100, hidden: true } },
    ],
  },
];

async function aufbau() {
  const repo = new InMemoryRepository(seedRegistry, BESTAND.map((e) => structuredClone(e)));
  const app = buildApp({ repo });
  for (const [name, roles] of [
    ['Basil', { camp_a: 'gm' }],
    ['Sela', { camp_a: 'player' }],
  ] as const) {
    await repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles: { ...roles } });
  }
  const kekse = new Map<string, string>();
  return async (name: string, url: string) => {
    if (!kekse.has(name)) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      kekse.set(name, `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return app.inject({ method: 'GET', url, headers: { cookie: kekse.get(name)! } });
  };
}

describe('the quick view of a board is a sketch (T-425)', () => {
  it('the registry shows the board in its quick view; the GM sees every card, the player not the hidden one', async () => {
    const rufe = await aufbau();
    const registry = (await rufe('Basil', '/api/registry')).json() as Registry;
    const fuer = async (wer: string) => {
      const b = (await rufe(wer, '/api/entities/brd')).json() as Entity & { refs?: { names?: Record<string, string> } };
      expect(pickView(b, registry, 'quick').layout.map((e) => e.el)).toContain('board');
      return boardSketch(b, (x) => b.refs?.names?.[x]).cards.map((k) => k.name || k.id);
    };
    expect(await fuer('Basil')).toEqual(['Der Alte', 'Die Falle']);
    expect(await fuer('Sela')).toEqual(['Der Alte']);
  });
});
