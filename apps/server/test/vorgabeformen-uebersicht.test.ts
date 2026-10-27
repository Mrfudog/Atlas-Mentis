/**
 * Die Übersicht der Vorgabeformen (T-394): GET liefert Gruppen und je
 * Gegenstand die geltende Form mit Herkunft und der lokalen Angabe; PUT
 * ändert die Karte einer Ebene, die der Betrachter schreibt. Erfundene
 * Gegenstände.
 */

import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { regelsystemeNachziehen } from '../src/regelsysteme.js';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const ding = (id: string, name: string, n: number, extra: Record<string, unknown> = {}): Entity => ({
  id,
  name,
  interfaces: ['Item'],
  components: { ...ident(name, `item-00${n}`), Item: { weight: 1 }, ...extra },
  relations: [],
});

async function aufbau() {
  const t = await tisch({
    kampagne: 'camp',
    artikel: [
      { id: 'camp', interfaces: ['Campaign'], components: ident('Runde', 'campaign-0001'), relations: [{ id: 'a1', type: 'activates', to: 'ly_rs_inventory', props: { order: 10 } }] },
      ding('sword', 'Sword', 10),
      ding('sword1', '+1 Sword', 11),
      ding('arrow', 'Arrow', 12),
      ding('secret', 'Secret blade', 13, { Visibility: { audience: 'gm' } }),
    ],
    konten: { Admin: { admin: true }, Mira: { roles: { camp: 'gm' } }, Sela: { roles: { camp: 'player' } } },
  });
  await regelsystemeNachziehen(t.repo);
  return t;
}

interface Uebersicht {
  layers: { id: string; writable: boolean }[];
  target: string | null;
  groups: { id: string; name: string; count: number; layer?: string; refName?: string }[];
  items: { id: string; name: string; rows: string[] | null; source: string; group?: string; ref?: string; set?: Record<string, unknown> }[];
}

describe('Übersicht der Vorgabeformen (T-394)', () => {
  it('die Verwaltung legt eine Gruppe an, ordnet zu und setzt eine Referenz', async () => {
    const t = await aufbau();
    expect((await t.als('Admin', 'PUT', '/api/inventory/shapes/groups/BL', { payload: { name: 'Blades', rows: '.#./###', stackSize: 1, ref: 'sword' } })).statusCode).toBe(200);
    expect((await t.als('Admin', 'PUT', '/api/inventory/shapes/items/sword', { payload: { group: 'BL', rows: ['#', '#', '#'] } })).statusCode).toBe(200);
    expect((await t.als('Admin', 'PUT', '/api/inventory/shapes/items/sword1', { payload: { group: 'BL', ref: 'sword' } })).statusCode).toBe(200);
    expect((await t.als('Admin', 'PUT', '/api/inventory/shapes/items/arrow', { payload: { group: 'BL' } })).statusCode).toBe(200);

    const u = await t.json<Uebersicht>('Admin', 'GET', '/api/inventory/shapes');
    /* Ohne Angabe die spezifischste Formebene: das Raster, mit dem die Formen kommen. */
    expect(u.target).toBe('ly_rm_grid');
    expect(u.groups).toEqual([expect.objectContaining({ id: 'BL', name: 'Blades', count: 3, layer: 'ly_rm_grid', refName: 'Sword' })]);
    const je = Object.fromEntries(u.items.map((i) => [i.id, i]));
    expect(je['sword1']).toMatchObject({ rows: ['#', '#', '#'], source: 'reference', ref: 'sword', set: { group: 'BL', ref: 'sword' } });
    expect(je['arrow']).toMatchObject({ rows: ['#', '#', '#'], source: 'group', weight: 1, type: 'Item' });
    /* Der Artikel sagt dasselbe wie die Übersicht. */
    expect((await t.json<Entity>('Admin', 'GET', '/api/entities/sword1')).components?.['Item']?.['rows']).toEqual(['#', '#', '#']);
  });

  it('null nimmt eine lokale Angabe heraus, leer heisst ausdrücklich keine Form', async () => {
    const t = await aufbau();
    await t.als('Admin', 'PUT', '/api/inventory/shapes/groups/BL', { payload: { name: 'Blades', rows: '##' } });
    await t.als('Admin', 'PUT', '/api/inventory/shapes/items/arrow', { payload: { group: 'BL', rows: [] } });
    let u = await t.json<Uebersicht>('Admin', 'GET', '/api/inventory/shapes');
    expect(u.items.find((i) => i.id === 'arrow')).toMatchObject({ rows: null, source: 'none' });
    await t.als('Admin', 'PUT', '/api/inventory/shapes/items/arrow', { payload: { rows: null } });
    u = await t.json<Uebersicht>('Admin', 'GET', '/api/inventory/shapes');
    expect(u.items.find((i) => i.id === 'arrow')).toMatchObject({ rows: ['##'], source: 'group' });
  });

  it('wer die Ebene nicht schreibt, bekommt 403 mit einem Weg', async () => {
    const t = await aufbau();
    const r = await t.als('Mira', 'PUT', '/api/inventory/shapes/items/arrow', { payload: { group: 'BL' } });
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toMatch(/ask the administration|Turn on Inventory/);
    expect((await t.json<Uebersicht>('Mira', 'GET', '/api/inventory/shapes')).layers.every((l) => !l.writable)).toBe(true);
  });

  it('eine Referenz auf sich selbst wird abgelehnt', async () => {
    const t = await aufbau();
    expect((await t.als('Admin', 'PUT', '/api/inventory/shapes/items/sword', { payload: { ref: 'sword' } })).statusCode).toBe(400);
  });

  it('die Spielerin sieht nur, was sie sieht — auch keinen verborgenen Referenzgegenstand', async () => {
    const t = await aufbau();
    await t.als('Admin', 'PUT', '/api/inventory/shapes/groups/BL', { payload: { name: 'Blades', ref: 'secret' } });
    await t.als('Admin', 'PUT', '/api/inventory/shapes/items/secret', { payload: { rows: ['#'] } });
    await t.als('Admin', 'PUT', '/api/inventory/shapes/items/sword', { payload: { group: 'BL', ref: 'secret' } });
    const u = await t.json<Uebersicht>('Sela', 'GET', '/api/inventory/shapes');
    expect(u.items.map((i) => i.id)).not.toContain('secret');
    const sword = u.items.find((i) => i.id === 'sword')!;
    expect(sword.rows).toEqual(['#']);
    expect(sword.ref).toBeUndefined();
    expect(sword.set?.['ref']).toBeUndefined();
    expect(u.groups[0]?.refName).toBeUndefined();
  });

  it('ohne Anmeldung nichts', async () => {
    const t = await aufbau();
    expect((await t.als(null, 'GET', '/api/inventory/shapes')).statusCode).toBe(401);
  });
});

describe('gleichzeitig (T-394)', () => {
  it('schreibt jemand dazwischen in dieselbe Karte, geht keine der beiden Änderungen verloren', async () => {
    const t = await aufbau();
    await t.als('Admin', 'PUT', '/api/inventory/shapes/groups/A', { payload: { name: 'A', rows: '#' } });
    /* Beim nächsten Schreiben der Ebene legt „jemand anders“ vorher Gruppe B an. */
    const echt = t.repo.putEntity.bind(t.repo);
    let einmal = true;
    t.repo.putEntity = (async (e: Entity, opts?: { expectRevision?: number | null }) => {
      if (einmal && e.id === 'ly_rm_grid') {
        einmal = false;
        const da = (await t.repo.getEntity('ly_rm_grid'))!;
        const k = da.components?.['ShapeDefaults'] as { shapeGroups: unknown[]; shapeItems: unknown[] };
        await echt({ ...da, components: { ...da.components, ShapeDefaults: { ...k, shapeGroups: [...k.shapeGroups, { id: 'B', name: 'B' }] } } });
      }
      return echt(e, opts);
    }) as typeof t.repo.putEntity;
    expect((await t.als('Admin', 'PUT', '/api/inventory/shapes/items/arrow', { payload: { group: 'A' } })).statusCode).toBe(200);
    const u = await t.json<Uebersicht>('Admin', 'GET', '/api/inventory/shapes');
    expect(u.groups.map((g) => g.id).sort()).toEqual(['A', 'B']);
    expect(u.items.find((i) => i.id === 'arrow')?.group).toBe('A');
  });
});

describe('viele Werte auf einmal (T-394 Schritt 5)', () => {
  it('legt Gruppen und Werte Feld für Feld über die Karte, mit Probelauf', async () => {
    const t = await aufbau();
    await t.als('Admin', 'PUT', '/api/inventory/shapes/items/arrow', { payload: { stackSize: 16 } });
    const body = {
      shapeGroups: [{ id: 'AM', name: 'Ammunition', rows: ['#', '#'], stackSize: 32 }],
      shapeItems: [{ id: 'arrow', group: 'AM' }, { id: 'sword', group: 'AM', rows: ['###'] }],
    };
    const probe = await t.als('Admin', 'PUT', '/api/inventory/shapes', { payload: { ...body, dryRun: true } });
    expect(probe.json()).toMatchObject({ dryRun: true, groups: { added: 1, changed: 0 }, items: { added: 1, changed: 1 } });
    expect((await t.json<Uebersicht>('Admin', 'GET', '/api/inventory/shapes')).groups).toEqual([]);

    const r = await t.als('Admin', 'PUT', '/api/inventory/shapes', { payload: body });
    expect(r.json()).toMatchObject({ dryRun: false, groups: { added: 1 }, items: { added: 1, changed: 1 } });
    const u = await t.json<Uebersicht>('Admin', 'GET', '/api/inventory/shapes');
    /* Der Stapel von vorher bleibt, die Gruppe kommt dazu. */
    expect(u.items.find((i) => i.id === 'arrow')?.set).toEqual({ id: 'arrow', stackSize: 16, group: 'AM' });
    expect(u.items.find((i) => i.id === 'sword')).toMatchObject({ rows: ['###'], source: 'own' });
  });

  it('wer die Ebene nicht schreibt, bekommt 403', async () => {
    const t = await aufbau();
    expect((await t.als('Mira', 'PUT', '/api/inventory/shapes', { payload: { shapeGroups: [{ id: 'X', name: 'X' }] } })).statusCode).toBe(403);
  });
});

describe('in die Ebene selbst (T-394)', () => {
  /** Eine Kampagne, die das Inventar nicht aufschaltet: geschrieben wird
   *  trotzdem in die genannte Formebene — aktiviert wird sie anderswo. */
  async function ohneInventar() {
    const t = await tisch({
      kampagne: 'camp',
      artikel: [
        { id: 'camp', interfaces: ['Campaign'], components: ident('Runde', 'campaign-0001'), relations: [] },
        ding('sword', 'Sword', 10),
      ],
      konten: { Admin: { admin: true }, Mira: { roles: { camp: 'gm' } }, Tom: { roles: { camp: 'gm' } } },
    });
    await regelsystemeNachziehen(t.repo);
    await t.repo.grantLayer(t.ids.get('Mira')!, 'ly_rm_shapes');
    return t;
  }
  const karte = async (t: Awaited<ReturnType<typeof ohneInventar>>) =>
    (await t.repo.getEntity('ly_rm_shapes'))?.components?.['ShapeDefaults'] as { shapeGroups?: { id: string }[] } | undefined;

  it('wer die Ebene schreibt, schreibt sie, auch wenn keine Kampagne sie aufschaltet', async () => {
    const t = await ohneInventar();
    const body = { layer: 'ly_rm_shapes', shapeGroups: [{ id: 'BL', name: 'Blades', rows: ['#'] }] };
    const probe = await t.als('Mira', 'PUT', '/api/inventory/shapes', { payload: { ...body, dryRun: true } });
    expect(probe.statusCode).toBe(200);
    expect(probe.json()).toMatchObject({ layer: 'ly_rm_shapes', dryRun: true, groups: { added: 1 } });
    expect((await t.als('Mira', 'PUT', '/api/inventory/shapes', { payload: body })).statusCode).toBe(200);
    expect((await karte(t))?.shapeGroups?.map((g) => g.id)).toEqual(['BL']);
    expect((await t.als('Admin', 'PUT', '/api/inventory/shapes/items/sword', { payload: { layer: 'ly_rm_shapes', group: 'BL' } })).statusCode).toBe(200);
  });

  it('wer sie nicht schreibt, bleibt draussen; eine Ebene ohne Formen ist kein Ziel', async () => {
    const t = await ohneInventar();
    const r = await t.als('Tom', 'PUT', '/api/inventory/shapes', { payload: { layer: 'ly_rm_shapes', shapeGroups: [{ id: 'X', name: 'X' }] } });
    expect(r.statusCode).toBe(403);
    expect((await karte(t))?.shapeGroups ?? []).toEqual([]);
    const falsch = await t.als('Admin', 'PUT', '/api/inventory/shapes', { payload: { layer: 'ly_rm_weight', shapeGroups: [{ id: 'X', name: 'X' }] } });
    expect(falsch.statusCode).toBe(404);
    expect(falsch.json().error).toMatch(/Default shapes/);
  });
});

describe('am Raster (T-394)', () => {
  it('in die Ebene von Grid geschrieben, kommen die Formen mit dem Raster in jede Kampagne, die es aufschaltet', async () => {
    const t = await tisch({
      kampagne: 'camp',
      artikel: [
        { id: 'camp', interfaces: ['Campaign'], components: ident('Runde', 'campaign-0001'), relations: [{ id: 'a1', type: 'activates', to: 'ly_rm_grid', props: { order: 10 } }] },
        ding('sword', 'Sword', 10),
      ],
      konten: { Admin: { admin: true } },
    });
    await regelsystemeNachziehen(t.repo);
    const r = await t.als('Admin', 'PUT', '/api/inventory/shapes', {
      payload: { layer: 'ly_rm_grid', shapeGroups: [{ id: 'BL', name: 'Blades', rows: ['#', '#'] }], shapeItems: [{ id: 'sword', group: 'BL' }] },
    });
    expect(r.statusCode).toBe(200);
    const u = await t.json<Uebersicht>('Admin', 'GET', '/api/inventory/shapes');
    expect(u.layers.map((l) => l.id)).toEqual(['ly_rm_grid']);
    expect(u.items.find((i) => i.id === 'sword')).toMatchObject({ rows: ['#', '#'], source: 'group', group: 'BL' });
  });
});

describe('in der Liste (T-394)', () => {
  it('„hat Shape" findet Gegenstände, deren Form aus dem Modul kommt — für Leitung und Spielerin', async () => {
    const t = await tisch({
      kampagne: 'camp',
      artikel: [
        { id: 'camp', interfaces: ['Campaign'], components: ident('Runde', 'campaign-0001'), relations: [{ id: 'a1', type: 'activates', to: 'ly_rm_grid', props: { order: 10 } }] },
        ding('sword', 'Sword', 10),
        ding('stone', 'Stone', 14),
      ],
      konten: { Admin: { admin: true }, Mira: { roles: { camp: 'gm' } }, Sela: { roles: { camp: 'player' } } },
    });
    await regelsystemeNachziehen(t.repo);
    await t.als('Admin', 'PUT', '/api/inventory/shapes', {
      payload: { layer: 'ly_rm_grid', shapeGroups: [{ id: 'BL', name: 'Blades', rows: ['#', '#'] }], shapeItems: [{ id: 'sword', group: 'BL' }] },
    });
    const f = (s: string) => `f=${encodeURIComponent(`@has:${s}`)}`;
    for (const wer of ['Mira', 'Sela']) {
      const mit = await t.json<{ rows: { id: string }[] }>(wer, 'GET', `/api/list?type=Item&${f('Item.rows')}`);
      expect(mit.rows.map((r) => r.id), wer).toEqual(['sword']);
      const ohne = await t.json<{ rows: { id: string }[] }>(wer, 'GET', `/api/list?type=Item&${f('!Item.rows')}`);
      expect(ohne.rows.map((r) => r.id), wer).toEqual(['stone']);
    }
  });
});
