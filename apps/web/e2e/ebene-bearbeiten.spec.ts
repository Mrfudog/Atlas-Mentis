/**
 * Die Ebene im Bearbeiten (T-383): das erste Feld der Maske, auf dem
 * Telefon wie am Desktop; die Leitung legt einen Artikel der Spielerin in
 * die Ebene der Kampagne, die Spielerin bekommt nur ihre eigenen Ebenen
 * angeboten.
 */
import { test, expect } from './hilfen';

test('the layer is the first field when editing, and saving moves the article', async ({ leitung, spielerin, api, lauf, eindeutig }) => {
  const versteck = await api.anlegen('spielerin', 'Place', eindeutig('Hideout'));

  /* Die Spielerin: das Feld steht oben, ihre Ebene ist gewählt, die der Kampagne nicht im Angebot. */
  await spielerin.goto(`/artikel/${versteck.id}`);
  await spielerin.getByRole('button', { name: 'Edit', exact: true }).click();
  const ihrFeld = spielerin.locator('.maske > label').first();
  await expect(ihrFeld).toHaveAttribute('data-ref', 'layer');
  const ihreWahl = ihrFeld.getByRole('combobox');
  await expect(ihreWahl).toBeVisible();
  await expect(ihreWahl.locator(`option[value="${lauf.campaign.layer}"]`)).toHaveCount(0);
  await spielerin.getByRole('button', { name: 'Cancel' }).click();

  /* Die Leitung legt ihn in die Ebene der Kampagne. */
  await leitung.goto(`/artikel/${versteck.id}`);
  await leitung.getByRole('button', { name: 'Edit', exact: true }).click();
  const feld = leitung.locator('.maske > label').first();
  await expect(feld).toHaveAttribute('data-ref', 'layer');
  await feld.getByRole('combobox').selectOption(lauf.campaign.layer);
  await expect(feld.getByText('Saving moves this article')).toBeVisible();
  await leitung.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(leitung.getByRole('status').filter({ hasText: 'Moved to' })).toBeVisible();

  const gelesen = await (await api.als('leitung')).get(`/api/entities/${versteck.id}`);
  const e = (await gelesen.json()) as { relations?: { type: string; to: string }[] };
  expect((e.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual([lauf.campaign.layer]);
});
