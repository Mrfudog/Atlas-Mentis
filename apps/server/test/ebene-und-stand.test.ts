/**
 * **Ebene und Stand sind immer da** (T-425, E-179, E-182, E-183, E-186):
 * Neues ohne Wahl kommt in die Kampagnenebene, ohne Kampagne nach
 * „Unassigned“; die Verwaltung nimmt einen Artikel aus jeder Ebene nur
 * nach „Unassigned“; wer den Stand leert, wird abgewiesen; eine neue
 * Kampagne liegt in ihrer eigenen Ebene. Was in „Unassigned“ liegt, steht
 * in keiner laufenden Kampagne — auch nicht für die Spielerin — und in der
 * Werkbank.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const id = (name: string, nr: string, status = 'ready') => ({ Identity: { name, id: nr, aliases: [] }, Status: { status } });
const ARTIKEL = (): Entity[] => [
  { id: 'ly_a', name: 'Runde A', interfaces: ['Layer'], components: { ...id('Runde A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'camp_a', name: 'Nebel', interfaces: ['Campaign'], components: id('Nebel', 'campaign-0001'), relations: [{ id: 'camp_a~ac', type: 'activates', to: 'ly_a', props: { order: 10 } }] },
  { id: 'n_1', name: 'Wirt', interfaces: ['Creature'], components: id('Wirt', 'creature-0001'), relations: [{ id: 'n_1~in', type: 'inLayer', to: 'ly_a', props: {} }] },
];
const konten = { Vera: { admin: true }, Mira: { roles: { camp_a: 'gm' as const } }, Sela: { roles: { camp_a: 'player' as const } } };
const ebenen = (e: Entity) => (e.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => r.to);

describe('Ebene und Stand immer (T-425, E-179, E-182)', () => {
  it('die Verwaltung legt ohne Wahl in die Kampagnenebene an, ohne laufende Kampagne nach Unassigned', async () => {
    const mit = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten });
    const a = await mit.json<Entity>('Vera', 'POST', '/api/entities', { type: 'Creature', name: 'Neu' });
    expect(ebenen(a)).toEqual(['ly_a']);

    const ohne = await tisch({ artikel: ARTIKEL().filter((e) => e.id !== 'camp_a'), konten });
    const b = await ohne.json<Entity>('Vera', 'POST', '/api/entities', { type: 'Creature', name: 'Neu' });
    expect(ebenen(b)).toEqual(['ly_unassigned']);
    expect((await ohne.repo.getEntity('ly_unassigned'))?.components?.['Identity']).toMatchObject({ name: 'Unassigned' });
  });

  it('aus jeder Ebene heraus heisst nach Unassigned; dort sieht ihn keine Runde, die Werkbank schon', async () => {
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten });
    const e = await t.json<Entity>('Vera', 'GET', '/api/entities/n_1');
    const ok = await t.als('Vera', 'PUT', '/api/entities/n_1', { payload: { ...e, relations: [] } });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ebenen((await t.repo.getEntity('n_1'))!)).toEqual(['ly_unassigned']);
    /* Nicht aufgeschaltet: weder die Leitung noch die Spielerin finden ihn in der Liste. */
    for (const wer of ['Mira', 'Sela']) {
      const liste = await t.json<{ rows: { id: string }[] }>(wer, 'GET', '/api/list?type=Creature');
      expect(liste.rows.map((z) => z.id)).not.toContain('n_1');
    }
    const pruefung = await t.json<{ checks: { key: string; hits: { id: string; reason: string }[] }[] }>('Vera', 'GET', '/api/checks?check=unassigned&allLayers=1');
    expect(pruefung.checks.find((c) => c.key === 'unassigned')?.hits).toContainEqual(expect.objectContaining({ id: 'n_1', reason: 'in Unassigned' }));
  });

  it('wer den Stand leert, wird abgewiesen und erfährt, was zu tun ist', async () => {
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten });
    const e = await t.json<Entity>('Mira', 'GET', '/api/entities/n_1');
    const { Status: _weg, ...rest } = e.components ?? {};
    const nein = await t.als('Mira', 'PUT', '/api/entities/n_1', { payload: { ...e, components: rest } });
    expect(nein.statusCode).toBe(422);
    expect((nein.json() as { error: string }).error).toBe('Every article needs a state. Set idea, prepared or ready instead of clearing it.');
  });

  it('eine neue Kampagne liegt in ihrer eigenen Ebene und bleibt sichtbar, wenn eine andere läuft (E-183)', async () => {
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten });
    const res = await t.als('Vera', 'POST', '/api/campaigns', { payload: { name: 'Zweite Runde' } });
    expect(res.statusCode, res.body).toBeLessThan(300);
    const neu = (res.json() as { id: string }).id;
    const k = (await t.repo.getEntity(neu))!;
    expect(ebenen(k)).toEqual([`ly_${neu}`]);
    expect((await t.als('Vera', 'GET', `/api/entities/${neu}`)).statusCode).toBe(200);
  });
});
