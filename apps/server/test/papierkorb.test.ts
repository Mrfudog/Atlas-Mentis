/**
 * Der Papierkorb (T-400, E-160 a): jedes Löschen aus der eigenen Ebene
 * (T-381) steht 30 Tage auf der Seite „Deleted". Eine Spielerin sieht ihre
 * eigenen Läufe, die Leitung alle; zurück kommt ein Artikel einzeln oder
 * der ganze Lauf. Endgültig wird es nach 30 Tagen oder mit „Empty trash" —
 * erst dann geht eine Bilddatei, und nur, wenn kein anderes Bild sie nennt.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { InMemoryAssetStore } from '../src/assets.js';
import { tisch } from './hilfen/tisch.js';

const ebene = (id: string): Entity => ({
  id,
  interfaces: ['Layer'],
  name: id,
  components: { Identity: { name: id, id: `layer-${id}`, aliases: [] }, Layer: { order: 10 } },
  relations: [],
});
const kampagne = (id: string, ebenen: string[]): Entity => ({
  id,
  interfaces: ['Campaign'],
  name: id,
  components: { Identity: { name: id, id: `campaign-${id}`, aliases: [] } },
  relations: ebenen.map((l, i) => ({ id: `${id}~a${i}`, type: 'activates', to: l, props: { order: 10 + i * 10 } })),
});
const ort = (id: string, ebene: string, kanten: { type: string; to: string }[] = []): Entity => ({
  id,
  interfaces: ['Place'],
  name: id,
  components: { Identity: { name: id, id: `place-${id}`, aliases: [] } },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: ebene, props: {} }, ...kanten.map((k, i) => ({ id: `${id}~k${i}`, ...k }))],
});
const REF_A = `${'a'.repeat(64)}.png`;
const REF_B = `${'b'.repeat(64)}.png`;
const bild = (id: string, ref: string): Entity => ({
  id,
  interfaces: ['Asset'],
  name: id,
  components: { Identity: { name: id, id: `asset-${id}`, aliases: [] }, Asset: { backend: 'app', ref, kind: 'image' } },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} }],
});

interface Lauf {
  id: string;
  at: string;
  expires: string;
  by: { id: string; name: string };
  items: { id: string; name: string; type: string; parts: number; restored: boolean }[];
}

async function aufbau() {
  const assets = new InMemoryAssetStore();
  for (const k of [REF_A, REF_B]) await assets.put(k, Buffer.from('bild'));
  const t = await tisch({
    kampagne: 'camp_nebel',
    app: { assets },
    artikel: [
      ebene('ly_nebel'),
      ebene('ly_sela'),
      kampagne('camp_nebel', ['ly_sela', 'ly_nebel']),
      ort('p_markt', 'ly_nebel', [{ type: 'route', to: 'p_hafen' }]),
      ort('p_hafen', 'ly_nebel'),
      ort('p_tempel', 'ly_nebel', [{ type: 'route', to: 'p_markt' }, { type: 'route', to: 'p_hafen' }]),
      ort('p_selas', 'ly_sela'),
      bild('img_a1', REF_A),
      bild('img_a2', REF_A),
      bild('img_b', REF_B),
    ],
    konten: {
      Mira: { roles: { camp_nebel: 'gm' } },
      Sela: { roles: { camp_nebel: 'player' } },
    },
  });
  await t.repo.grantLayer(t.ids.get('Sela')!, 'ly_sela', true, 'camp_nebel');
  const loesche = async (wer: string, ids: string[]) => {
    const r = await t.als(wer, 'POST', '/api/entities/delete', { payload: { ids, ...(ids.length > 1 ? { confirmDelete: ids.length } : {}) } });
    expect(r.statusCode).toBe(200);
    return (r.json() as { id: string }).id;
  };
  const korb = async (wer: string) => (await t.json<{ days: number; runs: Lauf[] }>(wer, 'GET', '/api/trash'));
  return { ...t, assets, loesche, korb };
}

describe('Papierkorb (T-400)', () => {
  it('die Spielerin sieht nur ihre Läufe, die Leitung alle — mit Frist von 30 Tagen', async () => {
    const t = await aufbau();
    const ihrer = await t.loesche('Sela', ['p_selas']);
    const leitung = await t.loesche('Mira', ['p_markt', 'p_hafen']);

    const sela = await t.korb('Sela');
    expect(sela.days).toBe(30);
    expect(sela.runs.map((r) => r.id)).toEqual([ihrer]);
    expect(sela.runs[0]!.items).toEqual([expect.objectContaining({ id: 'p_selas', type: 'Place', restored: false })]);
    expect(Date.parse(sela.runs[0]!.expires) - Date.parse(sela.runs[0]!.at)).toBe(30 * 24 * 3600 * 1000);

    const mira = await t.korb('Mira');
    expect(mira.runs.map((r) => r.id)).toEqual([leitung, ihrer]);
    expect(mira.runs[0]!.by.name).toBe('Mira');

    /* Den Lauf der Leitung nimmt die Spielerin nicht zurück. */
    expect((await t.als('Sela', 'POST', `/api/trash/${leitung}/restore`, { payload: {} })).statusCode).toBe(403);
    /* Ohne Anmeldung gibt es keinen Papierkorb. */
    expect((await t.als(null, 'GET', '/api/trash')).statusCode).toBe(401);
  });

  it('einzeln zurück: nur der gewählte Artikel und seine Kanten; der Rest bleibt im Korb', async () => {
    const t = await aufbau();
    const lauf = await t.loesche('Mira', ['p_markt', 'p_hafen']);
    const r = await t.als('Mira', 'POST', `/api/trash/${lauf}/restore`, { payload: { ids: ['p_hafen'] } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { restored: string[] }).restored).toEqual(['p_hafen']);
    expect(await t.repo.getEntity('p_hafen')).toBeTruthy();
    expect(await t.repo.getEntity('p_markt')).toBeFalsy();
    expect((await t.repo.getEntity('p_tempel'))!.relations!.filter((k) => k.type === 'route').map((k) => k.to)).toEqual(['p_hafen']);

    const korb = await t.korb('Mira');
    expect(korb.runs[0]!.items.map((i) => [i.id, i.restored])).toEqual([['p_markt', false], ['p_hafen', true]]);
    /* Zweimal zurück geht nicht. */
    expect((await t.als('Mira', 'POST', `/api/trash/${lauf}/restore`, { payload: { ids: ['p_hafen'] } })).statusCode).toBe(409);

    /* Der Rest kommt, mit der Kante zwischen beiden — und der Lauf ist leer. */
    expect((await t.als('Mira', 'POST', `/api/trash/${lauf}/restore`, { payload: {} })).statusCode).toBe(200);
    expect((await t.repo.getEntity('p_markt'))!.relations!.some((k) => k.type === 'route' && k.to === 'p_hafen')).toBe(true);
    expect((await t.repo.getEntity('p_tempel'))!.relations!.filter((k) => k.type === 'route').map((k) => k.to)).toEqual(['p_hafen', 'p_markt']);
    expect((await t.korb('Mira')).runs).toEqual([]);
    /* Für die Werkbank ist er zurückgenommen. */
    expect((await t.als('Mira', 'POST', `/api/bulk/${lauf}/undo`, { payload: {} })).statusCode).toBe(409);
  });

  it('die Spielerin holt ihren eigenen Artikel selbst zurück', async () => {
    const t = await aufbau();
    const lauf = await t.loesche('Sela', ['p_selas']);
    expect((await t.als('Sela', 'POST', `/api/trash/${lauf}/restore`, { payload: { ids: ['p_selas'] } })).statusCode).toBe(200);
    expect(await t.repo.getEntity('p_selas')).toBeTruthy();
  });

  it('„Empty trash" ist endgültig — die Datei geht nur, wenn kein anderes Bild sie nennt', async () => {
    const t = await aufbau();
    const bilder = await t.loesche('Mira', ['img_a1', 'img_b']);
    const ihrer = await t.loesche('Sela', ['p_selas']);
    /* Gelöscht, aber im Korb: die Dateien bleiben. */
    expect(await t.assets.has(REF_B)).toBe(true);

    /* Die Spielerin leert nur ihren eigenen Korb. */
    expect((await t.json<{ emptied: number }>('Sela', 'POST', '/api/trash/empty', {})).emptied).toBe(1);
    expect((await t.korb('Mira')).runs.map((r) => r.id)).toEqual([bilder]);
    expect((await t.als('Sela', 'POST', `/api/bulk/${ihrer}/undo`, { payload: {} })).statusCode).toBe(410);

    expect((await t.json<{ emptied: number }>('Mira', 'POST', '/api/trash/empty', {})).emptied).toBe(1);
    expect(await t.assets.has(REF_B)).toBe(false);
    /* img_a2 nennt dieselbe Datei weiter. */
    expect(await t.assets.has(REF_A)).toBe(true);
    expect((await t.korb('Mira')).runs).toEqual([]);
    expect((await t.als('Mira', 'POST', `/api/trash/${bilder}/restore`, { payload: {} })).statusCode).toBe(410);
  });

  it('nach 30 Tagen ist ein Lauf endgültig, und der Aufräumlauf nimmt die Datei', async () => {
    const t = await aufbau();
    const lauf = await t.loesche('Mira', ['img_b']);
    const ereignis = t.repo.events.find((e) => e.id === lauf)!;
    ereignis.at = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
    expect((await t.korb('Mira')).runs).toEqual([]);
    expect(await t.assets.has(REF_B)).toBe(false);
    expect((await t.als('Mira', 'POST', `/api/trash/${lauf}/restore`, { payload: {} })).statusCode).toBe(410);
  });

  it('ein Bild, das noch in einem anderen Lauf im Korb liegt, behält seine Datei', async () => {
    const t = await aufbau();
    await t.loesche('Mira', ['img_a1']);
    const zweiter = await t.loesche('Mira', ['img_a2']);
    const alt = t.repo.events.find((e) => e.id !== zweiter && e.name === 'bulk')!;
    alt.at = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
    expect((await t.korb('Mira')).runs.map((r) => r.id)).toEqual([zweiter]);
    expect(await t.assets.has(REF_A)).toBe(true);
    /* … und kommt es zurück, hat es seine Datei. */
    expect((await t.als('Mira', 'POST', `/api/trash/${zweiter}/restore`, { payload: {} })).statusCode).toBe(200);
    expect(await t.assets.has(REF_A)).toBe(true);
  });
});
