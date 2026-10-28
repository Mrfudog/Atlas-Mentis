/**
 * Fassung, Variante oder Kopie in einer anderen Ebene (T-405, REQ-400): am
 * Artikel „Copy…", der Weg mit einem Satz, die Zielebene vorgewählt, die
 * Teile mit Häkchen — danach steht die Kopie in der Zielebene, mit ihrem
 * Teil, und das Original bleibt.
 */
import { test, expect } from './hilfen';

test('copying an article with its part into the campaign layer', async ({ leitung, api, lauf, eindeutig }) => {
  const name = eindeutig('Mill');
  const muehle = await api.anlegen('spielerin', 'Place', name);
  const rad = await api.anlegen('spielerin', 'Place', eindeutig('Wheel'), { relations: [{ type: 'partOf', to: muehle.id }] });

  await leitung.goto(`/artikel/${muehle.id}`);
  await leitung.getByRole('button', { name: 'Copy…' }).click();
  const dialog = leitung.getByRole('dialog', { name: 'Version, variant or copy in another layer' });
  await expect(dialog.getByRole('radio', { name: /Copy/ })).toBeChecked();
  await dialog.getByRole('combobox', { name: 'Into layer' }).selectOption(lauf.campaign.layer);
  const zeile = dialog.locator(`li[data-id="${rad.id}"]`);
  await expect(zeile.getByRole('checkbox')).toBeChecked();
  const breite = await leitung.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(breite).toBeLessThanOrEqual(1);
  await dialog.getByRole('button', { name: 'Copy with 1 more' }).click();

  await expect(leitung.getByRole('status').filter({ hasText: 'Copy with 1 more created in' })).toBeVisible();
  await expect(leitung).not.toHaveURL(new RegExp(`/artikel/${muehle.id}$`));
  const neu = leitung.url().split('/artikel/')[1]!.split(/[?#]/)[0]!;
  const ctx = await api.als('leitung');
  const kopie = (await (await ctx.get(`/api/entities/${neu}`)).json()) as { name: string; relations?: { type: string; to: string }[] };
  expect(kopie.name).toBe(`${name} (copy)`);
  expect((kopie.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual([lauf.campaign.layer]);
  const original = (await (await ctx.get(`/api/entities/${muehle.id}`)).json()) as { name: string };
  expect(original.name).toBe(name);
});
