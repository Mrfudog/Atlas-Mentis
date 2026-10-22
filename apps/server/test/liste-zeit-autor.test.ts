/**
 * Filter nach Zeit und Autor in den Übersichten (T-382): „kürzlich
 * hinzugefügt", „kürzlich geändert", „hinzugefügt von" und Sortierung
 * danach — gerechnet am Server über die gesiebte Liste, also verrät die
 * Facette „Added by" keine Artikel, die der Betrachter nicht sieht.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ebene: Entity = {
  id: 'ly_nebel',
  interfaces: ['Layer'],
  name: 'Nebel',
  components: { Identity: { name: 'Nebel', id: 'layer-0001', aliases: [] } },
  relations: [],
};
const runde: Entity = {
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
  relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
};
const alt: Entity = {
  id: 'p_alt',
  interfaces: ['Place'],
  name: 'Old Mill',
  components: { Identity: { name: 'Old Mill', id: 'place-0001', aliases: [] } },
  relations: [{ id: 'p_alt~l', type: 'inLayer', to: 'ly_nebel', props: {} }],
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
};

interface Liste {
  rows: { id: string; name: string; createdAt?: string; addedBy?: string; cols: Record<string, unknown> }[];
  facets: { addedBy: { id: string; name: string; count: number }[] };
}

async function aufbau() {
  const t = await tisch({
    kampagne: 'camp_nebel',
    artikel: [ebene, runde, alt],
    konten: { Mira: { roles: { camp_nebel: 'gm' } }, Sela: { roles: { camp_nebel: 'player' } } },
  });
  const anlegen = async (wer: string, name: string, fields: Record<string, unknown> = {}) =>
    (await t.json<{ id: string }>(wer, 'POST', '/api/entities', { type: 'Place', name, fields, relations: [{ type: 'inLayer', to: 'ly_nebel' }] })).id;
  const markt = await anlegen('Mira', 'Market', { 'Status.status': 'ready' });
  const gruft = await anlegen('Mira', 'Crypt', { 'Visibility.audience': 'gm' });
  const hafen = await anlegen('Sela', 'Harbour');
  return { t, markt, gruft, hafen };
}

const liste = (t: Awaited<ReturnType<typeof aufbau>>['t'], wer: string, q: string) => t.json<Liste>(wer, 'GET', `/api/list?type=Place&limit=50&${q}`);

describe('/api/list: Zeit und Autor (T-382)', () => {
  it('kürzlich hinzugefügt: today und 7d lassen das Alte weg, ein Zeitraum nimmt es', async () => {
    const { t, markt } = await aufbau();
    const heute = (await liste(t, 'Mira', 'added=today')).rows.map((r) => r.id);
    expect(heute).toContain(markt);
    expect(heute).not.toContain('p_alt');
    expect((await liste(t, 'Mira', 'added=7d&tz=-120')).rows.map((r) => r.id)).not.toContain('p_alt');
    expect((await liste(t, 'Mira', 'added=2026-01-01..2026-01-01')).rows.map((r) => r.id)).toEqual(['p_alt']);
    /* Unsinn filtert nicht. */
    expect((await liste(t, 'Mira', 'added=gestern')).rows.map((r) => r.id)).toContain('p_alt');
  });

  it('kürzlich geändert liest updatedAt', async () => {
    const { t } = await aufbau();
    expect((await liste(t, 'Mira', 'changed=..2026-01-05')).rows.map((r) => r.id)).toEqual(['p_alt']);
  });

  it('hinzugefügt von: je Konto, Unbekanntes als ∅, Facette ohne eigenen Filter', async () => {
    const { t, markt, gruft, hafen } = await aufbau();
    const mira = t.ids.get('Mira')!;
    const r = await liste(t, 'Mira', `by=${mira}`);
    expect(r.rows.map((z) => z.id).sort()).toEqual([gruft, markt].sort());
    expect(r.rows[0]?.addedBy).toBe('Mira');
    expect(r.facets.addedBy).toEqual([
      { id: mira, name: 'Mira', count: 2 },
      { id: t.ids.get('Sela')!, name: 'Sela', count: 1 },
      { id: '∅', name: 'Unknown', count: 1 },
    ]);
    expect((await liste(t, 'Mira', 'by=∅')).rows.map((z) => z.id)).toEqual(['p_alt']);
    expect((await liste(t, 'Mira', `by=${t.ids.get('Sela')}`)).rows.map((z) => z.id)).toEqual([hafen]);
  });

  it('die Spielerin sieht in der Facette nur, was sie sieht', async () => {
    const { t, markt, hafen } = await aufbau();
    const r = await liste(t, 'Sela', '');
    expect(r.rows.map((z) => z.id).sort()).toEqual([hafen, markt, 'p_alt'].sort());
    /* Die verborgene Gruft zählt nicht mit: Mira hat für sie einen Artikel. */
    expect(r.facets.addedBy.find((a) => a.name === 'Mira')?.count).toBe(1);
  });

  it('sortiert nach Hinzufügen und zeigt Angaben als Spalten', async () => {
    const { t } = await aufbau();
    const neu = await liste(t, 'Mira', 'sort=-created&cols=@created,@addedBy');
    expect(neu.rows.at(-1)?.id).toBe('p_alt');
    expect(neu.rows.at(-1)?.cols).toEqual({ '@created': '2026-01-01' });
    expect(neu.rows[0]?.cols['@addedBy']).toBeTruthy();
    const alt = await liste(t, 'Mira', 'sort=created');
    expect(alt.rows[0]?.id).toBe('p_alt');
  });

  it('die Herkunft entsteht beim Anlegen, nicht beim Schreiben', async () => {
    const { t } = await aufbau();
    const regeln: Entity = { ...ebene, id: 'ly_regeln', name: 'Regeln', components: { Identity: { name: 'Regeln', id: 'layer-0002', aliases: [] } } };
    await t.repo.putEntity(regeln);
    expect((await t.repo.creators()).size).toBe(3);
  });
});

describe('Zeit und Autor als Facetten in f= (T-382)', () => {
  it('liest @added, @changed und @by aus f wie die eigenen Parameter', async () => {
    const { t, hafen } = await aufbau();
    const sela = t.ids.get('Sela')!;
    expect((await liste(t, 'Mira', `f=${encodeURIComponent(`@by:${sela}`)}`)).rows.map((r) => r.id)).toEqual([hafen]);
    expect((await liste(t, 'Mira', `f=${encodeURIComponent('@added:2026-01-01..2026-01-01')}`)).rows.map((r) => r.id)).toEqual(['p_alt']);
    expect((await liste(t, 'Mira', `f=${encodeURIComponent('@changed:..2026-01-05')}`)).rows.map((r) => r.id)).toEqual(['p_alt']);
  });
});
