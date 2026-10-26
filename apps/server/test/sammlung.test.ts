/**
 * **Collection an der Session** (T-425, REQ-430): die Szenen und
 * Begegnungen, die `partOf` auf eine Session zeigen, stehen an ihr — für
 * die Leitung alle, für die Spielerin nur, was sie sehen darf.
 *
 * Die Oberfläche rechnet nichts zurück: sie folgt dem Pfad über die
 * Rückbezüge (`/backlinks`) und holt die Treffer (`/entities/:id`), und
 * beides siebt der Server. Geprüft wird hier, dass `collectionHits` mit dem,
 * was die Routen einer Rolle liefern, genau deren Treffer ergibt — und dass
 * das Register die Collection an der Session trägt.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { collectionHits } from '@nw/model';
import type { Entity, IncomingEdge, LayoutElement, Registry } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const id = (name: string, nr: string) => ({ Identity: { name, id: nr, aliases: [] }, Status: { status: 'ready' } });
const in_ = (x: string) => ({ id: `${x}~in`, type: 'inLayer', to: 'ly_a', props: {} });
const teil = (x: string, to: string) => ({ id: `${x}~p-${to}`, type: 'partOf', to, props: {} });

const BESTAND: Entity[] = [
  { id: 'ly_a', name: 'Runde A', interfaces: ['Layer'], components: { ...id('Runde A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'camp_a', name: 'Aus Nebel wacht', interfaces: ['Campaign'], components: id('Aus Nebel wacht', 'campaign-0001'), relations: [{ id: 'camp_a~ac', type: 'activates', to: 'ly_a', props: { order: 10 } }] },
  { id: 'ses_1', name: 'Session 1', interfaces: ['Session'], components: id('Session 1', 'session-0001'), relations: [in_('ses_1')] },
  { id: 'sc_alter', name: 'Der Alte', interfaces: ['Scene'], components: id('Der Alte', 'scene-0001'), relations: [in_('sc_alter'), teil('sc_alter', 'ses_1')] },
  {
    id: 'sc_geheim', name: 'Die Miene', interfaces: ['Scene'],
    components: { ...id('Die Miene', 'scene-0002'), Visibility: { audience: 'gm' } },
    relations: [in_('sc_geheim'), teil('sc_geheim', 'ses_1')],
  },
  { id: 'enc_rats', name: 'Rats', interfaces: ['Encounter'], components: id('Rats', 'encounter-0001'), relations: [in_('enc_rats'), teil('enc_rats', 'ses_1')] },
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
  const rufe = async (name: string, url: string) => {
    if (!kekse.has(name)) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      kekse.set(name, `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return app.inject({ method: 'GET', url, headers: { cookie: kekse.get(name)! } });
  };
  return { rufe };
}

/** Wie die Oberfläche: Rückbezüge und Treffer über die Routen der Rolle, dann `collectionHits`. */
async function trefferAls(rufe: Awaited<ReturnType<typeof aufbau>>['rufe'], wer: string, el: LayoutElement, registry: Registry) {
  const session = (await rufe(wer, '/api/entities/ses_1')).json() as Entity;
  const rueck = (await rufe(wer, '/api/entities/ses_1/backlinks')).json() as { relation: { type: string; props?: Record<string, unknown> }; from: { id: string } }[];
  const incoming: IncomingEdge[] = rueck.map((b) => ({ type: b.relation.type, from: b.from.id, props: b.relation.props }));
  const geholt = new Map<string, Entity>();
  for (const k of incoming) {
    const res = await rufe(wer, `/api/entities/${k.from}`);
    if (res.statusCode === 200) geholt.set(k.from, res.json() as Entity);
  }
  return collectionHits(registry, session, el, { get: (x) => geholt.get(x), incoming: (x) => (x === 'ses_1' ? incoming : []) }).map((h) => h.entity.id);
}

describe('a session shows its scenes and encounters through a collection (T-425, REQ-430)', () => {
  it('the registry carries the collection on the session', async () => {
    const { rufe } = await aufbau();
    const registry = (await rufe('Basil', '/api/registry')).json() as Registry;
    const full = registry.interfaces['Session']?.views?.['full'];
    expect(Array.isArray(full) && full.find((x) => x.el === 'collection')).toMatchObject({ id: 'se-contains', types: ['Scene', 'Encounter'] });
  });

  it('the GM gets every scene and encounter, the player only what she may see', async () => {
    const { rufe } = await aufbau();
    const registry = (await rufe('Basil', '/api/registry')).json() as Registry;
    const full = registry.interfaces['Session']!.views!['full'];
    const el = (Array.isArray(full) ? full : []).find((x) => x.el === 'collection')!;
    expect(await trefferAls(rufe, 'Basil', el, registry)).toEqual(['enc_rats', 'sc_alter', 'sc_geheim']);
    expect(await trefferAls(rufe, 'Sela', el, registry)).toEqual(['enc_rats', 'sc_alter']);
  });
});
