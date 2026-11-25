/**
 * Die Struktur (T-341): `GET /api/structure/:id` als Leitung und als
 * Spielerin — verborgene Knoten, was nur über sie erreichbar ist, und
 * Wissen fehlen der Spielerin. Erfundene Artikel.
 */

import { describe, expect, it } from 'vitest';
import type { Entity, Relation, StructureGraph } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string): Relation => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });
const art = (id: string, typ: string, extra: Record<string, unknown> = {}, rel: Relation[] = []): Entity => ({
  id,
  name: id,
  interfaces: [typ],
  components: { ...ident(id, `${typ.toLowerCase()}-${id}`), ...extra },
  relations: [im(id), ...rel],
});
const k = (id: string, type: string, to: string, props: Record<string, unknown> = {}): Relation => ({ id, type, to, props });

function bestand(): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    art('pc_rook', 'PlayerCharacter', { PlayerCharacter: { level: 1 } }),
    art('Wacht', 'Faction', {}, [k('w-c', 'controls', 'Turm'), k('w-r', 'regards', 'Gilde', { tags: ['distrust'] })]),
    art('Zirkel', 'Faction', { Visibility: { audience: 'gm' } }, [k('z-p', 'partOf', 'Wacht')]),
    art('Gilde', 'Faction', {}, [k('g-r', 'regards', 'Wacht', { tags: ['useful'] })]),
    art('Ada', 'Creature', {}, [k('a-m', 'memberOf', 'Wacht', { rank: 'Captain' })]),
    art('Bo', 'Creature', {}, [k('b-m', 'memberOf', 'Zirkel', { rank: 'Novice' })]),
    art('Turm', 'Place'),
    art('Geheim', 'Faction', { Visibility: { audience: 'gm' } }),
    {
      ...art('brd', 'Board', { Board: {} }),
      relations: [
        im('brd'),
        k('s1', 'placed', 'brd', { x: 0, y: 0, w: 400, h: 300, title: 'Watch', structure: { root: 'Wacht', layout: 'tree' } }),
        k('s2', 'placed', 'brd', { x: 500, y: 0, w: 400, h: 300, hidden: true, structure: { root: 'Geheim' } }),
      ],
    },
  ];
}

async function aufbau() {
  return tisch({
    kampagne: 'camp_a',
    artikel: bestand(),
    konten: { Gwen: { roles: { camp_a: 'gm' } }, Sela: { roles: { camp_a: 'player' }, actorIds: ['pc_rook'] } },
  });
}

const knoten = (g: StructureGraph) => g.nodes.map((n) => n.id).sort();

describe('Struktur (T-341)', () => {
  it('zeigt der Leitung alles, der Spielerin nur, was sie sieht', async () => {
    const t = await aufbau();
    const gm = await t.json<StructureGraph>('Gwen', 'GET', '/api/structure/Wacht');
    expect(knoten(gm)).toEqual(['Ada', 'Bo', 'Gilde', 'Turm', 'Wacht', 'Zirkel']);
    expect(gm.links.find((l) => l.id === 'a-m')?.labels).toEqual(['Captain']);
    expect(gm.links.filter((l) => l.type === 'regards').map((l) => l.labels[0]).sort()).toEqual(['distrust', 'useful']);

    const sp = await t.json<StructureGraph>('Sela', 'GET', '/api/structure/Wacht');
    /* Der Zirkel ist verborgen — und Bo, der nur über ihn hängt, mit ihm. */
    expect(knoten(sp)).toEqual(['Ada', 'Gilde', 'Turm', 'Wacht']);
    expect(sp.links.some((l) => l.from === 'Zirkel' || l.to === 'Zirkel' || l.from === 'Bo')).toBe(false);
  });

  it('nimmt Kanten, Tiefe und Form aus der Adresse', async () => {
    const t = await aufbau();
    const g = await t.json<StructureGraph & { edges: string[]; depth: number }>(
      'Gwen',
      'GET',
      '/api/structure/Wacht?edges=memberOf,partOf&depth=1&layout=net',
    );
    expect(knoten(g)).toEqual(['Ada', 'Wacht', 'Zirkel']);
    expect(g.layout).toBe('net');
    expect(g.depth).toBe(1);
    expect(g.nodes.find((n) => n.id === 'Zirkel')?.more).toBe(true);
  });

  it('gibt es nicht für einen verborgenen Startartikel und nicht ohne Anmeldung', async () => {
    const t = await aufbau();
    expect((await t.als('Sela', 'GET', '/api/structure/Geheim')).statusCode).toBe(404);
    expect((await t.als('Gwen', 'GET', '/api/structure/Geheim')).statusCode).toBe(200);
    expect((await t.als('Gwen', 'GET', '/api/structure/gibtsnicht')).statusCode).toBe(404);
    expect((await t.als(null, 'GET', '/api/structure/Wacht')).statusCode).toBe(401);
  });

  it('hält eine Struktur-Kachel zurück, wenn die Leitung es sagt', async () => {
    const t = await aufbau();
    const gm = await t.json<Entity>('Gwen', 'GET', '/api/entities/brd');
    expect(gm.relations?.filter((r) => r.type === 'placed').map((r) => r.id).sort()).toEqual(['s1', 's2']);
    const sp = await t.json<Entity>('Sela', 'GET', '/api/entities/brd');
    expect(sp.relations?.filter((r) => r.type === 'placed').map((r) => r.id)).toEqual(['s1']);
  });
});
