/**
 * Regelsysteme als Ebenen (E-166, T-394): Inventory steht als Regelsystem
 * da, Grid als seine Mechanik, die sagt, dass sie mit Weight zusammen gilt
 * — für die Leitung wie für die Spielerin, auf dem Desktop wie am Telefon
 * (dort stehen die Kanten im Reiter, T-277).
 */
import type { Page } from '@playwright/test';
import { test, expect } from './hilfen';

async function reiter(seite: Page, name: RegExp): Promise<void> {
  const tab = seite.getByRole('tab', { name });
  if (await tab.isVisible()) await tab.click();
}

test('the grid mechanic shows its rule system and that it works with weight', async ({ leitung, spielerin }) => {
  for (const seite of [leitung, spielerin]) {
    await seite.goto('/artikel/ly_rm_grid');
    await expect(seite.getByRole('heading', { name: 'Grid', exact: true }).first()).toBeVisible();
    await reiter(seite, /^Relations/);
    await expect(seite.getByRole('link', { name: 'Weight', exact: true }).first()).toBeVisible();
    await expect(seite.getByRole('link', { name: 'Inventory', exact: true }).first()).toBeVisible();

    /* Die Gegenrichtung ist eine Abfrage: Weight nennt Grid, ohne eigene Kante. */
    await seite.goto('/artikel/ly_rm_weight');
    await expect(seite.getByRole('heading', { name: 'Weight', exact: true }).first()).toBeVisible();
    await reiter(seite, /^Linked here/);
    await expect(seite.getByRole('link', { name: 'Grid', exact: true }).first()).toBeVisible();
  }
});
