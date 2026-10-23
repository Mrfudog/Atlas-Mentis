/**
 * **In Ebenen schreiben, die nicht die der Kampagne sind** (T-418,
 * REQ-417). Auf dev konnte die Verwaltung Bilder für das Regelwerk von
 * Kibbles nicht in dessen Ebene legen: angeboten wurden nur die Ebene der
 * Kampagne und eigene, aufgeschaltete Ebenen. Jetzt stehen in „Writes to"
 * und am Artikel alle Ebenen, in die das Konto schreibt — die nicht
 * aufgeschalteten mit `inPlay: false` und einem Hinweis, denn was dort
 * liegt, steht in dieser Kampagne nicht da.
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
const kampagne: Entity = {
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
  relations: [
    { id: 'camp_nebel~a1', type: 'activates', to: 'ly_kibbles', props: { order: 10 } },
    { id: 'camp_nebel~a2', type: 'activates', to: 'ly_nebel', props: { order: 100 } },
  ],
};
const ort = (id: string, ly: string): Entity => ({
  id,
  interfaces: ['Place'],
  name: id,
  components: { Identity: { name: id, id: `place-${id}`, aliases: [] }, Status: { status: 'ready' } },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: ly, props: {} }],
});

type Option = { id: string; selectable: boolean; inPlay?: boolean; why?: string };
const optionen = async (t: Awaited<ReturnType<typeof tisch>>, wer: string) =>
  (await t.json<{ options: Option[] }>(wer, 'GET', '/api/layers/write')).options;

async function aufbau() {
  const t = await tisch({
    kampagne: 'camp_nebel',
    artikel: [ebene('ly_kibbles'), ebene('ly_nebel'), ebene('ly_frei'), kampagne, ort('o_markt', 'ly_nebel')],
    konten: { Basil: { admin: true }, Mira: { roles: { camp_nebel: 'gm' } }, Sela: { roles: { camp_nebel: 'player' } } },
  });
  return t;
}

describe('Schreiben ausserhalb der Kampagnenebene (T-418)', () => {
  it('die Verwaltung wählt eine aufgeschaltete Ebene, die ihr nicht gehört, und legt dort an', async () => {
    const t = await aufbau();
    const o = await optionen(t, 'Basil');
    expect(o.find((x) => x.id === 'ly_kibbles')).toMatchObject({ selectable: true, inPlay: true });
    expect((await t.als('Basil', 'PUT', '/api/layers/write', { payload: { layer: 'ly_kibbles' } })).statusCode).toBe(200);
    const neu = await t.json<{ id: string }>('Basil', 'POST', '/api/entities', { type: 'Place', name: 'Werkstatt' });
    const e = (await t.repo.getEntity(neu.id))!;
    expect(e.relations?.filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual(['ly_kibbles']);
  });

  it('die Verwaltung wählt auch eine Ebene, die nicht aufgeschaltet ist — mit Hinweis', async () => {
    const t = await aufbau();
    const frei = (await optionen(t, 'Basil')).find((x) => x.id === 'ly_frei');
    expect(frei).toMatchObject({ selectable: true, inPlay: false });
    expect(frei?.why).toMatch(/not switched on/i);
    expect((await t.als('Basil', 'PUT', '/api/layers/write', { payload: { layer: 'ly_frei' } })).statusCode).toBe(200);
    const stand = await t.json<{ layer: { id: string } | null; dropped: string | null }>('Basil', 'GET', '/api/layers/write');
    expect(stand).toMatchObject({ layer: { id: 'ly_frei' }, dropped: null });
  });

  it('die Leitung schreibt in ihre eigene Ebene ausserhalb der Kampagne, legt an und verschiebt dorthin', async () => {
    const t = await aufbau();
    const eigene = await t.json<{ id: string }>('Mira', 'POST', '/api/layers', { name: 'Mira – Module' });
    const o = await optionen(t, 'Mira');
    expect(o.find((x) => x.id === eigene.id)).toMatchObject({ selectable: true, inPlay: false });
    expect(o.find((x) => x.id === 'ly_kibbles')).toBeUndefined();

    const neu = await t.json<{ id: string }>('Mira', 'POST', '/api/entities', {
      type: 'Place',
      name: 'Modulort',
      relations: [{ type: 'inLayer', to: eigene.id }],
    });
    expect((await t.repo.getEntity(neu.id))!.relations?.find((r) => r.type === 'inLayer')?.to).toBe(eigene.id);

    const markt = (await t.repo.getEntity('o_markt'))!;
    const verschoben = { ...markt, relations: [{ id: 'o_markt~l', type: 'inLayer', to: eigene.id, props: {} }] };
    expect((await t.als('Mira', 'PUT', '/api/entities/o_markt', { payload: verschoben })).statusCode).toBe(200);
  });

  it('in eine fremde Ebene verschieben bleibt verboten — Leitung und Spielerin', async () => {
    const t = await aufbau();
    const markt = (await t.repo.getEntity('o_markt'))!;
    const nachKibbles = { ...markt, relations: [{ id: 'o_markt~l', type: 'inLayer', to: 'ly_kibbles', props: {} }] };
    expect((await t.als('Mira', 'PUT', '/api/entities/o_markt', { payload: nachKibbles })).statusCode).toBe(403);
    expect((await t.als('Sela', 'PUT', '/api/layers/write', { payload: { layer: 'ly_frei' } })).statusCode).toBe(403);
    expect((await optionen(t, 'Sela')).some((x) => x.id === 'ly_frei' || x.id === 'ly_kibbles')).toBe(false);
  });
});
