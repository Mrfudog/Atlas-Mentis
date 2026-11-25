/**
 * **Ebene immer, Parkplatz „Unassigned“** (T-425, E-182, E-186): nimmt die
 * Verwaltung einen Artikel aus jeder Ebene, liegt er danach in
 * „Unassigned“. Die Werkbank der Leitung führt ihn unter „Unassigned“; die
 * Spielerin findet ihn nicht, denn die Ebene ist nicht aufgeschaltet.
 */
import { test, expect } from './hilfen';

test('an article taken out of every layer waits in Unassigned and shows in the workbench', async ({ leitung, spielerin, api, eindeutig }) => {
  const npc = await api.anlegen('leitung', 'Creature', eindeutig('Drifter'));
  await api.setzen('leitung', npc.id, { Status: { status: 'ready' } });

  const verwaltung = await api.als('verwaltung');
  const e = (await (await verwaltung.get(`/api/entities/${npc.id}`)).json()) as { relations?: { type: string }[] } & Record<string, unknown>;
  const raus = await verwaltung.put(`/api/entities/${npc.id}`, { data: { ...e, relations: (e.relations ?? []).filter((r) => r.type !== 'inLayer') } });
  expect(raus.ok(), await raus.text()).toBe(true);
  const danach = (await (await verwaltung.get(`/api/entities/${npc.id}?allLayers=1`)).json()) as { relations?: { type: string; to: string }[] };
  expect((danach.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual(['ly_unassigned']);

  await leitung.goto('/werkbank');
  const zeile = leitung.getByRole('button', { name: /Unassigned/ }).first();
  await expect(zeile).toBeEnabled();
  await zeile.click();
  await expect(leitung.getByRole('link', { name: npc.name, exact: true })).toBeVisible();

  await spielerin.goto(`/artikel/${npc.id}`);
  await expect(spielerin.getByRole('heading', { name: npc.name })).toHaveCount(0);
});
