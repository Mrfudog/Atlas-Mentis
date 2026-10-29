/**
 * **Die Sitzung auf einen Blick** (T-151, REQ-282): die Collections an der
 * Session gehen zwei Schritte weit — `← partOf` zu Szene und Begegnung,
 * dann `features`, `participates`, `happensAt`, `onMap`. Geprüft wird mit
 * dem, was die Routen einer Rolle liefern, wie die Oberfläche es holt
 * (`erreichbar` im Ansichtsbaum): was eine geheime Szene nennt, kommt bei
 * der Spielerin nicht an, auch wenn der Artikel selbst sichtbar wäre.
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

const fertig = { Status: { status: 'ready' } };
const art = (eid: string, typ: string, name: string, nr: string, rel: { type: string; to: string; props?: Record<string, unknown> }[] = [], mehr: Record<string, unknown> = {}): Entity => ({
  id: eid,
  name,
  interfaces: [typ],
  components: { Identity: { name, id: nr, aliases: [] }, ...fertig, ...mehr },
  relations: [{ id: `${eid}~in`, type: 'inLayer', to: 'ly_a', props: {} }, ...rel.map((r, i) => ({ id: `${eid}~${i}`, props: {}, ...r }))],
});

const BESTAND: Entity[] = [
  { id: 'ly_a', name: 'Runde A', interfaces: ['Layer'], components: { Identity: { name: 'Runde A', id: 'layer-0001', aliases: [] }, ...fertig, Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'camp_a', name: 'Aus Nebel wacht', interfaces: ['Campaign'], components: { Identity: { name: 'Aus Nebel wacht', id: 'campaign-0001', aliases: [] }, ...fertig }, relations: [{ id: 'camp_a~ac', type: 'activates', to: 'ly_a', props: { order: 10 } }] },
  art('ses_1', 'Session', 'Session 1', 'session-0001'),
  art('npc_volo', 'Creature', 'Volo', 'npc-0001'),
  art('npc_spitzel', 'Creature', 'Spitzel', 'npc-0002'),
  art('npc_ratte', 'Creature', 'Riesenratte', 'npc-0003'),
  art('pl_hafen', 'Place', 'Hafen', 'place-0001'),
  art('map_keller', 'Map', 'Keller', 'map-0001'),
  art('sc_hafen', 'Scene', 'Am Hafen', 'scene-0001', [
    { type: 'partOf', to: 'ses_1' },
    { type: 'features', to: 'npc_volo' },
    { type: 'happensAt', to: 'pl_hafen' },
  ]),
  art('sc_geheim', 'Scene', 'Das Treffen', 'scene-0002', [
    { type: 'partOf', to: 'ses_1' },
    { type: 'features', to: 'npc_spitzel' },
  ], { Visibility: { audience: 'gm' } }),
  art('enc_ratten', 'Encounter', 'Ratten', 'encounter-0001', [
    { type: 'partOf', to: 'ses_1' },
    /* Ein Verbündeter, aufgedeckt und erkannt: einen Gegner siebt der Server vor Kampfbeginn heute auch für eine Leitung ohne Verwaltungsrecht weg (T-455, E-208). */
    { type: 'participates', to: 'npc_ratte', props: { revealed: true, identified: true, ally: true } },
    { type: 'onMap', to: 'map_keller' },
  ]),
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

/** Wie die Oberfläche: Rückbezüge der Session, dann Schritt für Schritt holen, was der Pfad erreicht. */
async function trefferAls(rufe: Awaited<ReturnType<typeof aufbau>>['rufe'], wer: string, el: LayoutElement, registry: Registry) {
  const session = (await rufe(wer, '/api/entities/ses_1')).json() as Entity;
  const rueck = (await rufe(wer, '/api/entities/ses_1/backlinks')).json() as { relation: { type: string; props?: Record<string, unknown> }; from: { id: string } }[];
  const incoming: IncomingEdge[] = rueck.map((b) => ({ type: b.relation.type, from: b.from.id, props: b.relation.props }));
  const geholt = new Map<string, Entity>();
  const hole = async (x: string) => {
    if (geholt.has(x)) return geholt.get(x);
    const res = await rufe(wer, `/api/entities/${x}`);
    if (res.statusCode === 200) geholt.set(x, res.json() as Entity);
    return geholt.get(x);
  };
  for (const k of incoming) {
    const e = await hole(k.from);
    for (const r of e?.relations ?? []) await hole(r.to);
  }
  return collectionHits(registry, session, el, { get: (x) => geholt.get(x), incoming: (x) => (x === 'ses_1' ? incoming : []) }).map((h) => h.entity.id);
}

describe('die Sitzung auf einen Blick (T-151, REQ-282)', () => {
  const sammlung = async (rufe: Awaited<ReturnType<typeof aufbau>>['rufe'], eid: string) => {
    const registry = (await rufe('Basil', '/api/registry')).json() as Registry;
    const full = registry.interfaces['Session']!.views!['full'];
    const el = (Array.isArray(full) ? full : []).find((x) => x.id === eid);
    expect(el, eid).toBeDefined();
    return { el: el!, registry };
  };

  it('die Leitung sieht die Leute aller Szenen, wer kämpft, Orte und Karten', async () => {
    const { rufe } = await aufbau();
    const t = async (eid: string) => {
      const { el, registry } = await sammlung(rufe, eid);
      return trefferAls(rufe, 'Basil', el, registry);
    };
    expect(await t('se-people')).toEqual(['npc_spitzel', 'npc_volo']);
    expect(await t('se-fight')).toEqual(['npc_ratte']);
    expect(await t('se-places')).toEqual(['pl_hafen']);
    expect(await t('se-maps')).toEqual(['map_keller']);
  });

  it('die Spielerin sieht nicht, wen nur eine geheime Szene nennt', async () => {
    const { rufe } = await aufbau();
    const { el, registry } = await sammlung(rufe, 'se-people');
    expect(await trefferAls(rufe, 'Sela', el, registry)).toEqual(['npc_volo']);
  });
});
