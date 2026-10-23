/**
 * **Dieselbe Ebene in zwei Kampagnen** (T-410). Auf dev schaltete die neue
 * Kampagne keine Ebene auf, die eine andere schon hatte: `withStack`
 * vergab `activates-<ebene>`, und `relation.id` ist in Postgres eindeutig
 * über alle Artikel — 500, die Ebene sprang zurück. Der Speicher im Test
 * prüft dasselbe (`RelationIdTaken`).
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

describe('Ebene aufschalten, die eine andere Kampagne schon hat (T-410)', () => {
  it('die zweite Kampagne bekommt sie auch — als Leitung über alle drei Wege', async () => {
    const t = await tisch({ artikel: [ebene('ly_buch'), ebene('ly_vgl')], konten: { Basil: { admin: true } } });
    const a = await t.json<{ id: string }>('Basil', 'POST', '/api/campaigns', { name: 'Alt', lead: true });
    const b = await t.json<{ id: string }>('Basil', 'POST', '/api/campaigns', { name: 'Neu', lead: true });
    expect((await t.als('Basil', 'POST', `/api/campaigns/${a.id}/layers/ly_buch`)).statusCode).toBe(200);

    const knopf = await t.als('Basil', 'POST', `/api/campaigns/${b.id}/layers/ly_buch`);
    expect(knopf.statusCode).toBe(200);
    expect(knopf.json().layers).toContain('ly_buch');

    const liste = await t.als('Basil', 'PUT', `/api/campaigns/${a.id}/layers`, { payload: { layers: [`ly_${a.id}`, 'ly_buch', 'ly_vgl'] } });
    expect(liste.statusCode).toBe(200);
    const auchHier = await t.als('Basil', 'PUT', `/api/campaigns/${b.id}/layers`, { payload: { layers: [`ly_${b.id}`, 'ly_buch', 'ly_vgl'] } });
    expect(auchHier.statusCode).toBe(200);

    const kampagne = (await t.repo.getEntity(b.id))!;
    expect((kampagne.relations ?? []).filter((r) => r.type === 'activates').map((r) => r.to)).toEqual(
      expect.arrayContaining(['ly_buch', 'ly_vgl']),
    );
  });

  it('eine Spielerin sieht die Ebenen der Kampagne, schaltet aber nicht', async () => {
    const t = await tisch({ artikel: [ebene('ly_buch')], konten: { Basil: { admin: true }, Sela: {} } });
    const k = await t.json<{ id: string }>('Basil', 'POST', '/api/campaigns', { name: 'Neu', lead: true });
    await t.repo.putUser({ ...(await t.repo.getUser(t.ids.get('Sela')!))!, roles: { [k.id]: 'player' } });
    expect((await t.als('Sela', 'POST', `/api/campaigns/${k.id}/layers/ly_buch`)).statusCode).toBe(403);
  });
});

describe('Eine vergebene Kanten-Id gibt 409 mit Ausweg, nicht 500 (T-410)', () => {
  it('PUT eines Artikels mit einer Kanten-Id, die ein anderer trägt', async () => {
    const t = await tisch({ artikel: [ebene('ly_buch'), ebene('ly_zwei')], konten: { Basil: { admin: true } } });
    const a: Entity = { ...ebene('ort_a'), interfaces: ['Place'], components: { Identity: { name: 'A', id: 'place-a', aliases: [] } }, relations: [{ id: 'k_1', type: 'inLayer', to: 'ly_buch', props: {} }] };
    const b: Entity = { ...a, id: 'ort_b', components: { Identity: { name: 'B', id: 'place-b', aliases: [] } } };
    expect((await t.als('Basil', 'PUT', '/api/entities/ort_a', { payload: a })).statusCode).toBeLessThan(300);
    const r = await t.als('Basil', 'PUT', '/api/entities/ort_b', { payload: b });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ relation: 'k_1', entity: 'ort_a' });
    expect(r.json().error).toMatch(/Reload the page/);
  });
});
