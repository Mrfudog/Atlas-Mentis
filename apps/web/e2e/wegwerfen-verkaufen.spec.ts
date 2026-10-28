/**
 * Wegwerfen und Verkaufen direkt am Stück (T-407, REQ-404): die Spielerin
 * wirft zwei von drei Laternen weg, nimmt es zurück, verkauft eine an
 * einen Laden und bekommt die Münzen; die Leitung wirft am selben
 * Inventar weg. Eigene kleine Testartikel, keine Regelwerksdaten.
 */
import { test, expect } from './hilfen';
import type { Page } from '@playwright/test';

const keinSeitwaertsScroll = async (seite: Page) =>
  expect(await seite.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test('discard with undo and sell to a shop, right at the piece', async ({ leitung, spielerin, api, eindeutig }) => {
  const fertig = { Status: { status: 'ready' } };
  const laterne = await api.anlegen('spielerin', 'Item', eindeutig('Lantern'), { fields: { 'Item.copperPrice': 1000 } });
  const inventar = await api.anlegen('spielerin', 'Inventory', eindeutig('Pack'), {
    relations: [{ type: 'holds', to: laterne.id, props: { qty: 3, tier: 'pack' } }],
  });
  const figur = await api.anlegen('spielerin', 'PlayerCharacter', eindeutig('Wren'), {
    relations: [{ type: 'carries', to: inventar.id }],
  });
  const laden = await api.anlegen('leitung', 'Shop', eindeutig('Wick and Wire'));
  for (const a of [laterne, laden]) await api.setzen('leitung', a.id, fertig);

  const s = spielerin;
  const posten = s.locator('.posten');
  await s.goto(`/artikel/${figur.id}?tab=gear`);
  await posten.getByRole('button', { name: laterne.name }).click();

  /* Wegwerfen: Rückfrage mit Anzahl, dann Rückgängig. */
  await s.getByRole('button', { name: 'Discard', exact: true }).click();
  const frage = s.getByRole('dialog', { name: `Discard ${laterne.name}` });
  await expect(frage).toContainText('You can undo it right after');
  await frage.getByLabel('Qty').fill('2');
  await frage.getByLabel('Qty').dispatchEvent('change');
  await frage.getByRole('button', { name: 'Discard 2' }).click();
  await expect(s.locator('.zuletzt')).toContainText(`Discarded 2 × ${laterne.name}`);
  await expect(posten.locator('li', { hasText: laterne.name }).first()).not.toContainText('×');
  await s.getByRole('button', { name: 'Undo' }).click();
  await expect(posten.locator('li', { hasText: laterne.name }).first()).toContainText('×3');
  await keinSeitwaertsScroll(s);

  /* Verkaufen: der Laden mit seinem Ankaufspreis, die Münzen kommen in den Beutel. */
  await posten.getByRole('button', { name: laterne.name }).click();
  await s.getByRole('button', { name: 'Sell', exact: true }).click();
  const verkauf = s.getByRole('dialog', { name: `Sell ${laterne.name}` });
  await verkauf.getByLabel(new RegExp(laden.name)).check();
  await expect(verkauf.getByLabel(new RegExp(laden.name))).toBeChecked();
  await verkauf.getByRole('button', { name: 'Sell for 5 gp' }).click();
  await expect(s.locator('.zuletzt')).toContainText(`Sold 1 × ${laterne.name} to ${laden.name} for 5 gp`);
  await expect(s.getByLabel('gp', { exact: true })).toHaveValue('5');
  await keinSeitwaertsScroll(s);

  /* Die Leitung wirft am selben Inventar weg. */
  await leitung.goto(`/artikel/${figur.id}?tab=gear`);
  await leitung.locator('.posten').getByRole('button', { name: laterne.name }).click();
  await leitung.getByRole('button', { name: 'Discard', exact: true }).click();
  await leitung.getByRole('dialog', { name: `Discard ${laterne.name}` }).getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(leitung.locator('.zuletzt')).toContainText(`Discarded 1 × ${laterne.name}`);
  await keinSeitwaertsScroll(leitung);
});
