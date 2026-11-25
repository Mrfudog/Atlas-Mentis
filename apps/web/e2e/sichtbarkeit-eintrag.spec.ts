/**
 * Das Regelwerk je Artikel (T-401, E-162 a): ein Artikel aus einer
 * geteilten Ebene, die die Leitung nicht schreibt — in „Articles and their
 * layers" ist seine Zeile trotzdem setzbar; „GM" verbirgt ihn vor der
 * Spielerin als Regel dieser Kampagne („campaign (this article)"), das Buch
 * bleibt, und ↺ nimmt den Eintrag wieder weg.
 */
import { test, expect } from './hilfen';

test('the GM hides one article of a shared rulebook for this campaign only', async ({ leitung, api, lauf, eindeutig }) => {
  const verwaltung = await api.als('verwaltung');
  const ok = async <R extends { ok(): boolean; status(): number; text(): Promise<string> }>(r: R) => {
    expect(r.ok(), `${r.status()} ${await r.text()}`).toBe(true);
    return r;
  };
  const ebene = (await (await ok(await verwaltung.post('/api/layers', { data: { name: eindeutig('Shared book') } }))).json()) as { id: string };
  const andere = (await (await ok(await verwaltung.post('/api/campaigns', { data: { name: eindeutig('Other table') } }))).json()) as { id: string };
  await ok(await verwaltung.post(`/api/campaigns/${andere.id}/layers/${ebene.id}`));
  await ok(await verwaltung.post(`/api/campaigns/${lauf.campaign.id}/layers/${ebene.id}`));
  const name = eindeutig('Hidden shrine');
  const neu = (await (await ok(await verwaltung.post('/api/entities', { data: { type: 'Place', name, fields: { 'Status.status': 'ready' } } }))).json()) as { id: string };
  const e = (await (await verwaltung.get(`/api/entities/${neu.id}`)).json()) as {
    relations?: { id: string; type: string; to: string }[];
    components?: Record<string, unknown>;
  };
  const relations = [...(e.relations ?? []).filter((r) => r.type !== 'inLayer'), { id: `${neu.id}~inLayer-1`, type: 'inLayer', to: ebene.id, props: {} }];
  /* Ohne eigenes Feld: das schlüge jeden Eintrag. */
  const { Visibility: _v, ...components } = e.components ?? {};
  await ok(await verwaltung.put(`/api/entities/${neu.id}`, { data: { ...e, refs: undefined, relations, components } }));
  const sieht = async () => (await (await api.als('spielerin')).get(`/api/entities/${neu.id}`)).status();
  expect(await sieht()).toBe(200);

  await leitung.goto(`/campaign?c=${lauf.campaign.id}&tab=visibility`);
  const liste = leitung.locator('nw-kampagnen-artikel');
  await liste.getByRole('searchbox', { name: 'Search by name' }).fill(name);
  const zeile = liste.locator(`li[data-id="${neu.id}"]`);
  await expect(zeile).toContainText('a rule of this campaign');
  await zeile.getByRole('group', { name: `Visibility of ${name}` }).getByRole('button', { name: 'GM' }).click();
  await expect(liste.getByRole('status')).toContainText('1 changed');
  await expect(zeile.locator('.stufe')).toContainText('campaign (this article)');
  expect(await sieht()).not.toBe(200);
  const buch = (await (await verwaltung.get(`/api/entities/${neu.id}`)).json()) as { components?: Record<string, unknown> };
  expect(buch.components?.['Visibility']).toBeUndefined();

  await zeile.getByRole('button', { name: `${name}: follow the group` }).click();
  await expect(zeile.locator('.stufe')).not.toContainText('this article');
  expect(await sieht()).toBe(200);
});
