/**
 * **Kampagne je Konto und Globalfilter** (REQ-408, REQ-412, T-496): zwei
 * Kampagnen, je mit ihrer Ebene, dazu ein Regelbuch, das nur Nebel
 * aufschaltet, und ein Buch, das keine aufschaltet. Jedes Konto wählt seine
 * Kampagne selbst; ein Wechsel nimmt die anderen nicht mit. Campaign view
 * filtert enger, My view stellt lesbare Ebenen frei zusammen; die Kampagne
 * selbst ändert sich dabei nie.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const id = (name: string, nr: string, status = 'ready') => ({ Identity: { name, id: nr, aliases: [] }, Status: { status } });
const ebene = (eid: string, name: string, nr: string, layer: Record<string, unknown>): Entity => ({
  id: eid,
  name,
  interfaces: ['Layer'],
  components: { ...id(name, nr), Layer: layer },
  relations: [],
});
const wesen = (eid: string, name: string, nr: string, inLayer: string, extra: Record<string, unknown> = {}): Entity => ({
  id: eid,
  name,
  interfaces: ['Creature'],
  components: { ...id(name, nr), ...extra },
  relations: [{ id: `${eid}~in`, type: 'inLayer', to: inLayer, props: {} }],
});
const ARTIKEL = (): Entity[] => [
  ebene('ly_nebel', 'Nebel', 'layer-0001', { kind: 'campaign', order: 100 }),
  ebene('ly_salz', 'Salz', 'layer-0002', { kind: 'campaign', order: 100 }),
  ebene('ly_regeln', 'Regeln', 'layer-0003', { kind: 'book', order: 5 }),
  ebene('ly_frei', 'Bestiarium', 'layer-0004', { kind: 'book', order: 6 }),
  {
    id: 'camp_nebel',
    name: 'Aus Nebel wacht',
    interfaces: ['Campaign'],
    components: id('Aus Nebel wacht', 'campaign-0001'),
    relations: [
      { id: 'camp_nebel~r', type: 'activates', to: 'ly_regeln', props: { order: 10 } },
      { id: 'camp_nebel~n', type: 'activates', to: 'ly_nebel', props: { order: 100 } },
      { id: 'camp_nebel~in', type: 'inLayer', to: 'ly_nebel', props: {} },
    ],
  },
  {
    id: 'camp_salz',
    name: 'Der Salzpfad',
    interfaces: ['Campaign'],
    components: id('Der Salzpfad', 'campaign-0002'),
    relations: [
      { id: 'camp_salz~s', type: 'activates', to: 'ly_salz', props: { order: 100 } },
      { id: 'camp_salz~in', type: 'inLayer', to: 'ly_salz', props: {} },
    ],
  },
  wesen('n_wirt', 'Wirt', 'creature-0001', 'ly_nebel'),
  wesen('n_spion', 'Spion', 'creature-0002', 'ly_nebel', { Visibility: { audience: 'gm' } }),
  wesen('s_faehrmann', 'Fährmann', 'creature-0003', 'ly_salz'),
  wesen('r_goblin', 'Goblin', 'creature-0004', 'ly_regeln'),
  wesen('f_drache', 'Drache', 'creature-0005', 'ly_frei'),
];
const konten = {
  Vera: { admin: true },
  Mira: { roles: { camp_nebel: 'gm' as const, camp_salz: 'player' as const } },
  Sela: { roles: { camp_nebel: 'player' as const } },
  Tom: { roles: { camp_salz: 'gm' as const } },
};

const namen = async (t: Awaited<ReturnType<typeof tisch>>, wer: string) =>
  (await t.json<{ rows: { id: string }[] }>(wer, 'GET', '/api/list?type=Creature')).rows.map((r) => r.id).sort();

interface Kampagnen {
  choices: { id: string; role: string | null }[];
  current: { id: string; layers: number; campaignLayers: number; view: string | null } | null;
  chosen: boolean;
  defaultCampaign: string | null;
}

describe('Kampagne je Konto wählen (REQ-408)', () => {
  it('bietet jedem Konto seine Kampagnen an, der Verwaltung alle, und setzt die einzige ohne Wahl', async () => {
    const t = await tisch({ kampagne: 'camp_nebel', artikel: ARTIKEL(), konten });
    expect((await t.json<Kampagnen>('Mira', 'GET', '/api/campaigns')).choices.map((c) => c.id)).toEqual(['camp_nebel', 'camp_salz']);
    expect((await t.json<Kampagnen>('Sela', 'GET', '/api/campaigns')).choices.map((c) => c.id)).toEqual(['camp_nebel']);
    expect((await t.json<Kampagnen>('Vera', 'GET', '/api/campaigns')).choices).toHaveLength(2);
    /* Tom hat nur den Salzpfad: er ist ohne Wahl darin, nicht in der Vorgabe. */
    const tom = await t.json<Kampagnen>('Tom', 'GET', '/api/campaigns');
    expect(tom.current?.id).toBe('camp_salz');
    expect(tom.defaultCampaign).toBe('camp_nebel');
    expect(await namen(t, 'Tom')).toEqual(['s_faehrmann']);
  });

  it('ein Wechsel wirkt nur für dieses Konto, auf Liste, Rolle und Sieb', async () => {
    const t = await tisch({ kampagne: 'camp_nebel', artikel: ARTIKEL(), konten });
    expect(await namen(t, 'Mira')).toEqual(['n_spion', 'n_wirt', 'r_goblin']);
    const ok = await t.als('Mira', 'PUT', '/api/me/campaign', { payload: { id: 'camp_salz' } });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(await namen(t, 'Mira')).toEqual(['s_faehrmann']);
    const mira = await t.json<Kampagnen>('Mira', 'GET', '/api/campaigns');
    expect(mira.current?.id).toBe('camp_salz');
    expect(mira.chosen).toBe(true);
    /* Die anderen bleiben, wo sie sind — und die Einstellung der Installation auch. */
    expect(await namen(t, 'Sela')).toEqual(['n_wirt', 'r_goblin']);
    expect(await namen(t, 'Vera')).toEqual(['n_spion', 'n_wirt', 'r_goblin']);
    expect((await t.repo.getRegistry()).settings?.['campaign']).toBe('camp_nebel');
    /* Zurück zur Vorgabe. */
    await t.json('Mira', 'PUT', '/api/me/campaign', { id: null });
    expect(await namen(t, 'Mira')).toEqual(['n_spion', 'n_wirt', 'r_goblin']);
  });

  it('weist eine Kampagne ohne Rolle ab und sagt, was zu tun ist; die Verwaltung wählt jede', async () => {
    const t = await tisch({ kampagne: 'camp_nebel', artikel: ARTIKEL(), konten });
    const nein = await t.als('Sela', 'PUT', '/api/me/campaign', { payload: { id: 'camp_salz' } });
    expect(nein.statusCode).toBe(403);
    expect((nein.json() as { error: string }).error).toMatch(/Ask its GM/);
    expect((await t.als('Sela', 'PUT', '/api/me/campaign', { payload: { id: 'ly_nebel' } })).statusCode).toBe(404);
    expect((await t.als('Vera', 'PUT', '/api/me/campaign', { payload: { id: 'camp_salz' } })).statusCode).toBe(200);
    expect(await namen(t, 'Vera')).toEqual(['s_faehrmann']);
    /* Über die allgemeinen Einstellungen geht es nicht vorbei an der Prüfung. */
    expect((await t.als('Sela', 'PUT', '/api/me/prefs/campaign', { payload: { value: 'camp_salz' } })).statusCode).toBe(400);
    expect((await t.als('Sela', 'PUT', '/api/me/prefs/layerView', { payload: { value: {} } })).statusCode).toBe(400);
  });

  it('die gewählte Kampagne gilt nicht mehr, wenn die Rolle weg ist', async () => {
    const t = await tisch({ kampagne: 'camp_nebel', artikel: ARTIKEL(), konten });
    await t.json('Mira', 'PUT', '/api/me/campaign', { id: 'camp_salz' });
    await t.repo.setRole(t.ids.get('Mira')!, 'camp_salz', null);
    expect(await namen(t, 'Mira')).toEqual(['n_spion', 'n_wirt', 'r_goblin']);
  });
});

interface Sicht {
  campaign: { id: string } | null;
  mode: string;
  off: string[];
  layers: string[];
  fixed: string | null;
  stack: { id: string; inCampaign: boolean }[];
  available: { id: string; inCampaign: boolean }[];
}

describe('Globalfilter: Campaign view und My view (REQ-412)', () => {
  it('Campaign view filtert enger, ohne die Kampagne zu ändern; Reset stellt die Vorgabe her', async () => {
    const t = await tisch({ kampagne: 'camp_nebel', artikel: ARTIKEL(), konten });
    const vorher = structuredClone(await t.repo.getEntity('camp_nebel'));
    const s = await t.json<Sicht>('Sela', 'GET', '/api/me/layer-view');
    expect(s.stack.map((l) => l.id)).toEqual(['ly_nebel', 'ly_regeln']);
    expect(s.fixed).toBe('ly_nebel');
    const eng = await t.json<Sicht>('Sela', 'PUT', '/api/me/layer-view', { mode: 'campaign', off: ['ly_regeln'] });
    expect(eng.off).toEqual(['ly_regeln']);
    expect(await namen(t, 'Sela')).toEqual(['n_wirt']);
    expect((await t.json<Kampagnen>('Sela', 'GET', '/api/campaigns')).current).toMatchObject({ layers: 1, campaignLayers: 2, view: 'campaign' });
    /* Die Leitung sieht weiter den ganzen Stapel, und die Kampagne ist dieselbe. */
    expect(await namen(t, 'Mira')).toEqual(['n_spion', 'n_wirt', 'r_goblin']);
    expect(await t.repo.getEntity('camp_nebel')).toEqual(vorher);
    /* Reset. */
    await t.json('Sela', 'DELETE', '/api/me/layer-view');
    expect(await namen(t, 'Sela')).toEqual(['n_wirt', 'r_goblin']);
    expect((await t.json<Kampagnen>('Sela', 'GET', '/api/campaigns')).current?.view).toBeNull();
  });

  it('Campaign view nimmt nur aus dem Stapel der Kampagne; die Kampagnenebene bleibt an', async () => {
    const t = await tisch({ kampagne: 'camp_nebel', artikel: ARTIKEL(), konten });
    const fremd = await t.als('Sela', 'PUT', '/api/me/layer-view', { payload: { mode: 'campaign', off: ['ly_frei'] } });
    expect(fremd.statusCode).toBe(400);
    expect((fremd.json() as { error: string }).error).toMatch(/My view/);
    await t.json('Sela', 'PUT', '/api/me/layer-view', { mode: 'campaign', off: ['ly_nebel'] });
    expect(await namen(t, 'Sela')).toEqual(['n_wirt', 'r_goblin']);
  });

  it('My view stellt lesbare Ebenen zusammen; Sichtbarkeit und Wissen gelten weiter', async () => {
    const t = await tisch({ kampagne: 'camp_nebel', artikel: ARTIKEL(), konten });
    const s = await t.json<Sicht>('Sela', 'GET', '/api/me/layer-view');
    expect(s.available.map((l) => l.id)).toEqual(expect.arrayContaining(['ly_frei', 'ly_salz', 'ly_regeln', 'ly_nebel']));
    expect(s.available.find((l) => l.id === 'ly_frei')?.inCampaign).toBe(false);
    const meine = await t.json<Sicht>('Sela', 'PUT', '/api/me/layer-view', { mode: 'mine', layers: ['ly_frei'] });
    expect(meine.mode).toBe('mine');
    /* Die Kampagnenebene bleibt dabei; das Regelbuch nicht mehr, das Bestiarium dazu. */
    expect(await namen(t, 'Sela')).toEqual(['f_drache', 'n_wirt']);
    /* Der Spion bleibt der Leitung vorbehalten, auch in My view. */
    await t.json('Sela', 'PUT', '/api/me/layer-view', { mode: 'mine', layers: ['ly_frei', 'ly_regeln'] });
    expect(await namen(t, 'Sela')).toEqual(['f_drache', 'n_wirt', 'r_goblin']);
    /* Die Kampagne selbst hat nichts davon. */
    expect((await t.repo.getEntity('camp_nebel'))?.relations?.some((r) => r.to === 'ly_frei')).toBe(false);
    expect(await namen(t, 'Mira')).toEqual(['n_spion', 'n_wirt', 'r_goblin']);
  });

  it('My view nimmt nur Ebenen, und die Sicht gilt je Kampagne', async () => {
    const t = await tisch({ kampagne: 'camp_nebel', artikel: ARTIKEL(), konten });
    expect((await t.als('Mira', 'PUT', '/api/me/layer-view', { payload: { mode: 'mine', layers: ['n_wirt'] } })).statusCode).toBe(400);
    expect((await t.als('Mira', 'PUT', '/api/me/layer-view', { payload: { mode: 'kaputt' } })).statusCode).toBe(400);
    await t.json('Mira', 'PUT', '/api/me/layer-view', { mode: 'mine', layers: ['ly_frei'] });
    await t.json('Mira', 'PUT', '/api/me/campaign', { id: 'camp_salz' });
    /* Im Salzpfad gilt ihre Sicht aus Nebel nicht. */
    expect(await namen(t, 'Mira')).toEqual(['s_faehrmann']);
    await t.json('Mira', 'PUT', '/api/me/campaign', { id: 'camp_nebel' });
    expect(await namen(t, 'Mira')).toEqual(['f_drache', 'n_spion', 'n_wirt']);
  });

  it('die Suche folgt der Sicht', async () => {
    const t = await tisch({ kampagne: 'camp_nebel', artikel: ARTIKEL(), konten });
    const such = async () => (await t.json<{ rows: { id: string }[] }>('Sela', 'GET', '/api/search?q=Drache')).rows.map((h) => h.id);
    expect(await such()).not.toContain('f_drache');
    await t.json('Sela', 'PUT', '/api/me/layer-view', { mode: 'mine', layers: ['ly_frei'] });
    expect(await such()).toContain('f_drache');
  });
});
