/**
 * Artikel löschen aus der eigenen Ebene (T-381): gelöscht wird, was in der
 * Schreibebene liegt und geschrieben werden darf; der Rest der Auswahl wird
 * abgewählt. Gelöscht wird als Massenänderung — also zurück mit Undo, auch
 * für Spielende, die ihren eigenen Lauf zurücknehmen.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
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
const ort = (id: string, ebenen: string[], extra: Partial<Entity> = {}, karten: Record<string, unknown> = {}): Entity => ({
  id,
  interfaces: ['Place'],
  name: id,
  components: { Identity: { name: id, id: `place-${id}`, aliases: [] }, ...karten } as Entity['components'],
  relations: ebenen.map((l, i) => ({ id: `${id}~l${i}`, type: 'inLayer', to: l, props: {} })),
  ...extra,
});

interface Antwort {
  deleted: number;
  id: string | null;
  deselected: { id: string; reason: string }[];
  layer: { id: string } | null;
  error?: string;
}

async function aufbau() {
  const t = await tisch({
    kampagne: 'camp_nebel',
    artikel: [
      ebene('ly_regeln'),
      ebene('ly_nebel'),
      ebene('ly_sela'),
      /* Eine zweite Runde schaltet das Regelwerk auf: dann ist es geteilt,
         und die Ebene der Kampagne ist ly_nebel. */
      kampagne('camp_nebel', ['ly_regeln', 'ly_sela', 'ly_nebel']),
      kampagne('camp_andere', ['ly_regeln']),
      ort('p_markt', ['ly_nebel']),
      ort('p_hafen', ['ly_nebel']),
      ort('p_tempel', ['ly_regeln']),
      ort('p_gruft', ['ly_nebel'], {}, { Visibility: { audience: 'gm' } }),
      ort('p_selas', ['ly_sela']),
      ort('p_lose', []),
    ],
    konten: {
      Mira: { roles: { camp_nebel: 'gm' } },
      Sela: { roles: { camp_nebel: 'player' } },
      Vera: { admin: true },
    },
  });
  await t.repo.grantLayer(t.ids.get('Sela')!, 'ly_sela', true, 'camp_nebel');
  return t;
}

const loesche = (t: Awaited<ReturnType<typeof aufbau>>, wer: string, payload: Record<string, unknown>) =>
  t.als(wer, 'POST', '/api/entities/delete', { payload });

describe('POST /api/entities/delete (T-381)', () => {
  it('die Leitung löscht aus der Ebene der Kampagne und wählt das Regelwerk ab', async () => {
    const t = await aufbau();
    const vorschau = (await loesche(t, 'Mira', { ids: ['p_markt', 'p_hafen', 'p_tempel'], dryRun: true })).json() as Antwort;
    expect(vorschau.deleted).toBe(2);
    expect(vorschau.layer?.id).toBe('ly_nebel');
    expect(vorschau.deselected).toEqual([expect.objectContaining({ id: 'p_tempel', reason: 'other-layer' })]);
    expect(await t.repo.getEntity('p_markt')).toBeTruthy();

    /* Mehr als einer nur mit der Zahl aus der Vorschau (D68). */
    const ohne = await loesche(t, 'Mira', { ids: ['p_markt', 'p_hafen', 'p_tempel'] });
    expect(ohne.statusCode).toBe(409);
    expect(await t.repo.getEntity('p_markt')).toBeTruthy();

    const r = (await loesche(t, 'Mira', { ids: ['p_markt', 'p_hafen', 'p_tempel'], confirmDelete: 2 })).json() as Antwort;
    expect(r.deleted).toBe(2);
    expect(r.id).toBeTruthy();
    expect((await t.als('Mira', 'GET', '/api/entities/p_markt')).statusCode).toBe(404);
    expect(await t.repo.getEntity('p_tempel')).toBeTruthy();

    /* Undo bringt beide zurück. */
    expect((await t.als('Mira', 'POST', `/api/bulk/${r.id}/undo`, { payload: {} })).statusCode).toBe(200);
    expect((await t.als('Mira', 'GET', '/api/entities/p_markt')).statusCode).toBe(200);
    expect((await t.als('Mira', 'GET', '/api/entities/p_hafen')).statusCode).toBe(200);
  });

  it('die Spielerin löscht aus ihrer Spielerebene und nimmt es selbst zurück', async () => {
    const t = await aufbau();
    const r = (await loesche(t, 'Sela', { ids: ['p_selas', 'p_markt'] })).json() as Antwort;
    expect(r.layer?.id).toBe('ly_sela');
    expect(r.deleted).toBe(1);
    expect(r.deselected).toEqual([expect.objectContaining({ id: 'p_markt', reason: 'other-layer' })]);
    expect(await t.repo.getEntity('p_selas')).toBeFalsy();
    expect(await t.repo.getEntity('p_markt')).toBeTruthy();

    const undo = await t.als('Sela', 'POST', `/api/bulk/${r.id}/undo`, { payload: {} });
    expect(undo.statusCode).toBe(200);
    expect(await t.repo.getEntity('p_selas')).toBeTruthy();
  });

  it('ein fremder Verweis sperrt das Löschen nicht: die Kante geht mit und kommt mit Undo wieder', async () => {
    const t = await aufbau();
    const gm = ort('p_kopie', ['ly_nebel'], {
      relations: [
        { id: 'p_kopie~l0', type: 'inLayer', to: 'ly_nebel', props: {} },
        { id: 'p_kopie~v', type: 'variantOf', to: 'p_selas' },
      ],
    });
    await t.repo.putEntity(gm);
    const r = (await loesche(t, 'Sela', { ids: ['p_selas'] })).json() as Antwort;
    expect(r.deleted).toBe(1);
    expect((await t.repo.getEntity('p_kopie'))?.relations?.some((x) => x.type === 'variantOf')).toBe(false);

    /* Zurück ja, aber nicht mit force — das überschriebe die Leitung. */
    expect((await t.als('Sela', 'POST', `/api/bulk/${r.id}/undo`, { payload: { force: true } })).statusCode).toBe(403);
    expect((await t.als('Sela', 'POST', `/api/bulk/${r.id}/undo`, { payload: {} })).statusCode).toBe(200);
    expect((await t.repo.getEntity('p_kopie'))?.relations?.some((x) => x.type === 'variantOf')).toBe(true);
  });

  it('Verborgenes heisst für die Spielerin not-found und bleibt', async () => {
    const t = await aufbau();
    const r = (await loesche(t, 'Sela', { ids: ['p_gruft'] })).json() as Antwort;
    expect(r.deleted).toBe(0);
    expect(r.deselected).toEqual([expect.objectContaining({ id: 'p_gruft', reason: 'not-found' })]);
    expect(await t.repo.getEntity('p_gruft')).toBeTruthy();
  });

  it('die Verwaltung ohne gewählte Schreibebene löscht, was in keiner Ebene liegt', async () => {
    const t = await aufbau();
    const r = (await loesche(t, 'Vera', { ids: ['p_lose', 'p_markt'], confirmDelete: 1 })).json() as Antwort;
    expect(r.layer).toBeNull();
    expect(r.deleted).toBe(1);
    expect(r.deselected.map((d) => d.id)).toEqual(['p_markt']);
    expect(await t.repo.getEntity('p_lose')).toBeFalsy();
  });

  it('mit gewählter Schreibebene löscht die Verwaltung dort', async () => {
    const t = await aufbau();
    expect((await t.als('Vera', 'PUT', '/api/layers/write', { payload: { layer: 'ly_nebel' } })).statusCode).toBe(200);
    const r = (await loesche(t, 'Vera', { ids: ['p_lose', 'p_markt'] })).json() as Antwort;
    expect(r.layer?.id).toBe('ly_nebel');
    expect(r.deselected.map((d) => d.id)).toEqual(['p_lose']);
    expect(await t.repo.getEntity('p_markt')).toBeFalsy();
  });

  it('Ebenen gehen hier nie, auch nicht für die Verwaltung', async () => {
    const t = await aufbau();
    const r = (await loesche(t, 'Vera', { ids: ['ly_nebel'] })).json() as Antwort;
    expect(r.deleted).toBe(0);
    expect(r.deselected[0]?.reason).toBe('protected');
    expect(await t.repo.getEntity('ly_nebel')).toBeTruthy();
  });

  it('ohne Auswahl, ohne Sitzung und in einer Sicht wird nichts gelöscht', async () => {
    const t = await aufbau();
    expect((await loesche(t, 'Mira', { ids: [] })).statusCode).toBe(400);
    expect((await t.als(null, 'POST', '/api/entities/delete', { payload: { ids: ['p_markt'] } })).statusCode).toBe(401);
    const sicht = await t.als('Mira', 'POST', '/api/entities/delete', { payload: { ids: ['p_markt'] }, viewAs: 'Sela' });
    expect(sicht.statusCode).toBe(403);
    expect(await t.repo.getEntity('p_markt')).toBeTruthy();
  });

  it('eine fremde Spielerin nimmt den Lauf nicht zurück', async () => {
    const t = await aufbau();
    const r = (await loesche(t, 'Mira', { ids: ['p_markt'] })).json() as Antwort;
    expect((await t.als('Sela', 'POST', `/api/bulk/${r.id}/undo`, { payload: {} })).statusCode).toBe(403);
  });
});
