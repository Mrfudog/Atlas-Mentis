/**
 * **Frei mit Vorschlag** (T-423): `GET /api/suggest?field=Typ.feld` nennt,
 * was die Liste des Feldes kennt und was an sichtbaren Artikeln schon
 * dasteht — die Maske bietet beides an, ein eigenes Wort darf stehen.
 * Gesiebt wie alles: was die Spielerin nicht sieht, schlägt ihr nichts vor.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ebene: Entity = { id: 'ly_n', interfaces: ['Layer'], name: 'N', components: { Identity: { name: 'N', id: 'layer-1', aliases: [] }, Layer: { order: 10 } }, relations: [] };
const kampagne: Entity = {
  id: 'camp_n', interfaces: ['Campaign'], name: 'N', components: { Identity: { name: 'N', id: 'campaign-1', aliases: [] } },
  relations: [{ id: 'camp_n~a', type: 'activates', to: 'ly_n', props: { order: 10 } }],
};
const enc = (id: string, kind: string[], extra: Record<string, unknown> = {}): Entity => ({
  id, interfaces: ['Encounter'], name: id,
  components: { Identity: { name: id, id: `encounter-${id}`, aliases: [] }, Status: { status: 'ready' }, Encounter: { kind }, ...extra },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: 'ly_n', props: {} }],
});

async function aufbau() {
  return tisch({
    kampagne: 'camp_n',
    artikel: [ebene, kampagne, enc('e1', ['combat', 'obstacle']), enc('e2', ['obstacle']), enc('e3', ['secretthing'], { Visibility: { audience: 'gm' } })],
    konten: { Mira: { roles: { camp_n: 'gm' } }, Sela: { roles: { camp_n: 'player' } } },
  });
}

describe('Vorschläge für ein freies Feld (T-423)', () => {
  it('die Liste und was dasteht, das Häufigste zuerst', async () => {
    const t = await aufbau();
    const r = await t.json<{ values: { value: string; count: number; listed: boolean }[] }>('Mira', 'GET', '/api/suggest?field=Encounter.kind');
    const werte = r.values.map((v) => v.value);
    expect(werte.slice(0, 2)).toEqual(['obstacle', 'combat']);
    expect(r.values.find((v) => v.value === 'obstacle')).toMatchObject({ count: 2, listed: false });
    expect(r.values.find((v) => v.value === 'puzzle')).toMatchObject({ count: 0, listed: true });
    expect(werte).toContain('secretthing');
  });

  it('die Spielerin bekommt nur, was an Sichtbarem steht', async () => {
    const t = await aufbau();
    const r = await t.json<{ values: { value: string }[] }>('Sela', 'GET', '/api/suggest?field=Encounter.kind');
    expect(r.values.map((v) => v.value)).not.toContain('secretthing');
  });

  it('ein eigenes Wort lässt sich speichern; ein Feld ohne suggest hält weiter', async () => {
    const t = await aufbau();
    const e = (await t.repo.getEntity('e1'))!;
    const neu = { ...e, components: { ...e.components, Encounter: { kind: ['rest'] } } };
    expect((await t.als('Mira', 'PUT', '/api/entities/e1', { payload: neu })).statusCode).toBe(200);
    const falsch = { ...e, components: { ...e.components, Encounter: { kind: ['combat'], phase: 'kaputt' } } };
    expect((await t.als('Mira', 'PUT', '/api/entities/e1', { payload: { ...falsch, revision: (await t.repo.getEntity('e1'))!.revision } })).statusCode).toBe(422);
  });

  it('ein Feld ohne Vorschlag oder ein unbekanntes sagt, was zu tun ist', async () => {
    const t = await aufbau();
    const r = await t.als('Mira', 'GET', '/api/suggest?field=Encounter.phase');
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/does not suggest/);
    expect((await t.als('Mira', 'GET', '/api/suggest?field=Nope.x')).statusCode).toBe(400);
  });
});
