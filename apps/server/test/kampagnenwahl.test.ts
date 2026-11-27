/**
 * **Die Kampagne je Konto und die eigene Sicht** (T-496, REQ-408,
 * REQ-412): wer wählt, wählt für sich — ein zweites Konto bleibt in seiner
 * Kampagne; enger filtern ändert die Kampagne nicht; eigene Ebenen nur,
 * soweit lesbar, und die Sichtbarkeit gilt darin wie immer. Erfundene
 * Runden und Artikel.
 */

import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string, extra: Record<string, unknown> = {}) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' }, ...extra });
const ebene = (id: string, n: number, extra: Record<string, unknown> = {}): Entity => ({
  id, name: id, interfaces: ['Layer'], components: ident(id, `layer-000${n}`, { Layer: { kind: 'book', order: n }, ...extra }), relations: [],
});
const regel = (id: string, n: number, ly: string, extra: Record<string, unknown> = {}): Entity => ({
  id, name: id, interfaces: ['Rule'], components: ident(id, `rule-000${n}`, extra), relations: [{ id: `${id}~l`, type: 'inLayer', to: ly }],
});
const kampagne = (id: string, n: number, ebenen: string[]): Entity => ({
  id, name: id === 'camp_a' ? 'Aus Nebel wacht' : 'Der Salzpfad', interfaces: ['Campaign'], components: ident(id, `campaign-000${n}`),
  relations: ebenen.map((to, i) => ({ id: `${id}~a${i}`, type: 'activates', to, props: { order: (i + 1) * 10 } })),
});

const artikel: Entity[] = [
  ebene('ly_rules', 1), ebene('ly_a', 2), ebene('ly_b', 3), ebene('ly_extra', 4),
  ebene('ly_hidden', 5, { Visibility: { audience: 'gm' } }),
  kampagne('camp_a', 1, ['ly_rules', 'ly_a']),
  kampagne('camp_b', 2, ['ly_rules', 'ly_b']),
  regel('r_rules', 1, 'ly_rules'), regel('r_a', 2, 'ly_a'), regel('r_b', 3, 'ly_b'), regel('r_extra', 4, 'ly_extra'),
  regel('r_extra_gm', 5, 'ly_extra', { Visibility: { audience: 'gm' } }),
  regel('r_hidden', 6, 'ly_hidden'),
];
const konten = {
  /* Leitet A, spielt in B. */
  Mira: { roles: { camp_a: 'gm' as const, camp_b: 'player' as const } },
  Sela: { roles: { camp_a: 'player' as const } },
  Bo: { roles: { camp_b: 'player' as const } },
  Admin: { admin: true },
};
const aufbau = () => tisch({ kampagne: 'camp_a', artikel, konten });

type Kampagnen = { current: { id: string; layers: number; view: string } | null; choices: { id: string }[]; default: string | null };
type Sicht = { campaign: { id: string } | null; mode: string; hide: string[]; mine: string[]; stack: { id: string }[]; layers: { id: string; inCampaign: boolean }[] };

const regeln = async (t: Awaited<ReturnType<typeof aufbau>>, wer: string) =>
  (await t.json<{ rows: { id: string }[] }>(wer, 'GET', '/api/list?type=Rule')).rows.map((r) => r.id).sort();

describe('the campaign per account (REQ-408)', () => {
  it('follows the default of the installation until an account chooses', async () => {
    const t = await aufbau();
    for (const wer of ['Mira', 'Sela', 'Bo']) {
      const k = await t.json<Kampagnen>(wer, 'GET', '/api/campaigns');
      expect(k.current?.id).toBe('camp_a');
      expect(k.default).toBe('camp_a');
    }
    expect((await t.json<Kampagnen>('Mira', 'GET', '/api/campaigns')).choices.map((c) => c.id)).toEqual(['camp_a', 'camp_b']);
    expect((await t.json<Kampagnen>('Bo', 'GET', '/api/campaigns')).choices.map((c) => c.id)).toEqual(['camp_b']);
    expect((await t.json<Kampagnen>('Admin', 'GET', '/api/campaigns')).choices).toHaveLength(2);
  });

  it('switches only the account that chooses; a second account stays in its campaign', async () => {
    const t = await aufbau();
    expect(await regeln(t, 'Mira')).toEqual(['r_a', 'r_rules']);
    await t.json('Mira', 'PUT', '/api/me/campaign', { id: 'camp_b' });
    expect((await t.json<Kampagnen>('Mira', 'GET', '/api/campaigns')).current?.id).toBe('camp_b');
    expect(await regeln(t, 'Mira')).toEqual(['r_b', 'r_rules']);
    /* Sela und die Einstellung der Installation bleiben, wie sie sind. */
    expect((await t.json<Kampagnen>('Sela', 'GET', '/api/campaigns')).current?.id).toBe('camp_a');
    expect(await regeln(t, 'Sela')).toEqual(['r_a', 'r_rules']);
    expect((await t.repo.getRegistry()).settings?.['campaign']).toBe('camp_a');
    /* Die Suche folgt ebenso. */
    const s = await t.json<{ rows?: { id: string }[]; hits?: { id: string }[] }>('Mira', 'GET', '/api/search?q=r_');
    const ids = (s.rows ?? s.hits ?? []).map((r) => r.id);
    expect(ids).toContain('r_b');
    expect(ids).not.toContain('r_a');
  });

  it('asks the role in the chosen campaign: Mira leads A, plays in B', async () => {
    const t = await aufbau();
    expect((await t.json<Kampagnen>('Mira', 'GET', '/api/campaigns')).current).toMatchObject({ id: 'camp_a' });
    await t.json('Mira', 'PUT', '/api/me/campaign', { id: 'camp_b' });
    const k = await t.json<{ current: { role: string; may: unknown } }>('Mira', 'GET', '/api/campaigns');
    expect(k.current.role).toBe('player');
  });

  it('refuses a campaign without a role, an unknown one and a malformed body — and says what to do', async () => {
    const t = await aufbau();
    const ohne = await t.als('Sela', 'PUT', '/api/me/campaign', { payload: { id: 'camp_b' } });
    expect(ohne.statusCode).toBe(403);
    expect(ohne.json().error).toMatch(/invitation/);
    expect((await t.als('Sela', 'PUT', '/api/me/campaign', { payload: { id: 'weg' } })).statusCode).toBe(400);
    expect((await t.als('Sela', 'PUT', '/api/me/campaign', { payload: { id: 3 } })).statusCode).toBe(400);
    expect((await t.als(null, 'PUT', '/api/me/campaign', { payload: { id: 'camp_a' } })).statusCode).toBe(401);
    /* Die Verwaltung wählt jede. */
    await t.json('Admin', 'PUT', '/api/me/campaign', { id: 'camp_b' });
    expect((await t.json<Kampagnen>('Admin', 'GET', '/api/campaigns')).current?.id).toBe('camp_b');
  });

  it('falls back to the default when the role goes, and { id: null } follows the default again', async () => {
    const t = await aufbau();
    await t.json('Mira', 'PUT', '/api/me/campaign', { id: 'camp_b' });
    const mira = t.ids.get('Mira')!;
    await t.repo.setRole(mira, 'camp_b', null);
    expect((await t.json<Kampagnen>('Mira', 'GET', '/api/campaigns')).current?.id).toBe('camp_a');
    /* Die Wahl bleibt gemerkt: kommt die Rolle wieder, gilt sie wieder. */
    await t.repo.setRole(mira, 'camp_b', 'player');
    expect((await t.json<Kampagnen>('Mira', 'GET', '/api/campaigns')).current?.id).toBe('camp_b');
    await t.json('Mira', 'PUT', '/api/me/campaign', { id: null });
    expect((await t.json<Kampagnen>('Mira', 'GET', '/api/campaigns')).current?.id).toBe('camp_a');
  });

  it('keeps the default for the administration only', async () => {
    const t = await aufbau();
    expect((await t.als('Mira', 'PUT', '/api/campaigns/current', { payload: { id: 'camp_b' } })).statusCode).toBe(403);
    await t.json('Admin', 'PUT', '/api/campaigns/current', { id: 'camp_b' });
    /* Wer nichts gewählt hat, folgt; wer gewählt hat, bleibt. */
    expect((await t.json<Kampagnen>('Bo', 'GET', '/api/campaigns')).current?.id).toBe('camp_b');
  });

  it('does not take the two keys through the general preferences route', async () => {
    const t = await aufbau();
    expect((await t.als('Sela', 'PUT', '/api/me/prefs/campaign', { payload: { value: 'camp_b' } })).statusCode).toBe(400);
    expect((await t.als('Sela', 'PUT', '/api/me/prefs/stackView', { payload: { value: { camp_a: { mode: 'mine', mine: ['ly_hidden'] } } } })).statusCode).toBe(400);
  });
});

describe('the own view on the stack (REQ-412)', () => {
  it('narrows the campaign view for one account — the campaign, and the GM, stay as they are', async () => {
    const t = await aufbau();
    const v = await t.json<Sicht>('Sela', 'PUT', '/api/me/view', { mode: 'campaign', hide: ['ly_rules'] });
    expect(v.hide).toEqual(['ly_rules']);
    expect(await regeln(t, 'Sela')).toEqual(['r_a']);
    expect(await regeln(t, 'Mira')).toEqual(['r_a', 'r_rules']);
    expect((await t.repo.getEntity('camp_a'))?.relations).toHaveLength(2);
    const k = await t.json<Kampagnen>('Sela', 'GET', '/api/campaigns');
    expect(k.current).toMatchObject({ layers: 1, view: 'narrowed' });
    /* Auch der Artikel selbst ist nicht da. */
    expect((await t.als('Sela', 'GET', '/api/entities/r_rules')).statusCode).toBe(404);
    /* Reset: die Vorgabe der Kampagne. */
    await t.json('Sela', 'DELETE', '/api/me/view');
    expect(await regeln(t, 'Sela')).toEqual(['r_a', 'r_rules']);
    expect((await t.json<Kampagnen>('Sela', 'GET', '/api/campaigns')).current?.view).toBe('campaign');
  });

  it('a narrowed view of the GM does not reach the player', async () => {
    const t = await aufbau();
    await t.json('Mira', 'PUT', '/api/me/view', { mode: 'campaign', hide: ['ly_a'] });
    expect(await regeln(t, 'Mira')).toEqual(['r_rules']);
    expect(await regeln(t, 'Sela')).toEqual(['r_a', 'r_rules']);
  });

  it('own layers: any readable layer, visibility still applies inside', async () => {
    const t = await aufbau();
    const vorher = await t.json<Sicht>('Sela', 'GET', '/api/me/view');
    expect(vorher.stack.map((l) => l.id)).toEqual(['ly_rules', 'ly_a']);
    /* Die verborgene Ebene steht nicht zur Wahl. */
    expect(vorher.layers.map((l) => l.id)).not.toContain('ly_hidden');
    expect(vorher.layers.map((l) => l.id)).toContain('ly_extra');
    expect(vorher.layers.filter((l) => l.inCampaign).map((l) => l.id).sort()).toEqual(['ly_a', 'ly_rules']);

    await t.json('Sela', 'PUT', '/api/me/view', { mode: 'mine', mine: ['ly_extra', 'ly_rules'] });
    expect(await regeln(t, 'Sela')).toEqual(['r_extra', 'r_rules']);
    expect((await t.json<Kampagnen>('Sela', 'GET', '/api/campaigns')).current).toMatchObject({ view: 'mine', layers: 2 });
    /* Die Leitung von A sähe r_extra_gm — in ihrer eigenen Sicht. */
    await t.json('Mira', 'PUT', '/api/me/view', { mode: 'mine', mine: ['ly_extra'] });
    expect(await regeln(t, 'Mira')).toEqual(['r_extra', 'r_extra_gm']);

    const nein = await t.als('Sela', 'PUT', '/api/me/view', { payload: { mode: 'mine', mine: ['ly_hidden'] } });
    expect(nein.statusCode).toBe(400);
    expect(nein.json().error).toMatch(/cannot read/);
  });

  it('remembers the own layers while the campaign view is on', async () => {
    const t = await aufbau();
    await t.json('Sela', 'PUT', '/api/me/view', { mode: 'mine', mine: ['ly_extra'] });
    await t.json('Sela', 'PUT', '/api/me/view', { mode: 'campaign' });
    expect(await regeln(t, 'Sela')).toEqual(['r_a', 'r_rules']);
    const v = await t.json<Sicht>('Sela', 'GET', '/api/me/view');
    expect(v).toMatchObject({ mode: 'campaign', mine: ['ly_extra'] });
    await t.json('Sela', 'PUT', '/api/me/view', { mode: 'mine' });
    expect(await regeln(t, 'Sela')).toEqual(['r_extra']);
  });

  it('keeps a view per campaign', async () => {
    const t = await aufbau();
    await t.json('Mira', 'PUT', '/api/me/view', { mode: 'campaign', hide: ['ly_rules'] });
    await t.json('Mira', 'PUT', '/api/me/campaign', { id: 'camp_b' });
    expect(await regeln(t, 'Mira')).toEqual(['r_b', 'r_rules']);
    await t.json('Mira', 'PUT', '/api/me/campaign', { id: 'camp_a' });
    expect(await regeln(t, 'Mira')).toEqual(['r_a']);
  });

  it('refuses a malformed view, and anything while viewing as someone else', async () => {
    const t = await aufbau();
    expect((await t.als('Sela', 'PUT', '/api/me/view', { payload: { mode: 'all' } })).statusCode).toBe(400);
    expect((await t.als('Sela', 'PUT', '/api/me/view', { payload: { mode: 'mine', mine: 'ly_extra' } })).statusCode).toBe(400);
    const fremd = await t.als('Mira', 'PUT', '/api/me/view', { payload: { mode: 'campaign', hide: ['ly_a'] }, viewAs: 'Sela' });
    expect(fremd.statusCode).toBe(403);
  });

  it('“View as” shows what the member may see, without the member’s own narrowing', async () => {
    const t = await aufbau();
    await t.json('Sela', 'PUT', '/api/me/view', { mode: 'campaign', hide: ['ly_rules'] });
    const r = await t.als('Mira', 'GET', '/api/list?type=Rule', { viewAs: 'Sela' });
    expect((r.json() as { rows: { id: string }[] }).rows.map((x) => x.id).sort()).toEqual(['r_a', 'r_rules']);
  });
});
