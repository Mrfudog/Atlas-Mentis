/**
 * Vorgabeformen (T-394, REQ-333): die Verwaltung schaltet Inventory auf
 * und legt eine Gruppe an; ein „+1“-Gegenstand erbt die Form seines
 * Referenzgegenstands. Die Übersicht unter /inventory/shapes zeigt Gruppe
 * und Herkunft, das Element Shape am Gegenstand sagt, woher seine Form
 * kommt, und der Filter „hat Shape“ der Liste findet ihn — für die
 * Leitung und die Spielerin, auf dem Desktop wie am Telefon.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './hilfen';

async function reiter(seite: Page, name: RegExp): Promise<void> {
  const tab = seite.getByRole('tab', { name });
  if (await tab.isVisible()) await tab.click();
}

test('an item takes its shape from its reference item, and the overview says so', async ({ leitung, spielerin, api, lauf, eindeutig }) => {
  const verwaltung = await api.als('verwaltung');
  const auf = await verwaltung.post(`/api/campaigns/${lauf.campaign.id}/layers/ly_rs_inventory`);
  expect(auf.ok(), await auf.text()).toBeTruthy();

  const schwert = await api.anlegen('verwaltung', 'Item', eindeutig('Shape Sword'));
  const plus = await api.anlegen('verwaltung', 'Item', eindeutig('Shape Sword +1'));
  for (const id of [schwert.id, plus.id]) await api.setzen('verwaltung', id, { Status: { status: 'ready' } });
  const gruppe = `E2E${schwert.id.slice(-6)}`;
  expect((await verwaltung.put(`/api/inventory/shapes/groups/${gruppe}`, { data: { name: `Blades ${gruppe}`, rows: '.#./###', stackSize: 1 } })).ok()).toBeTruthy();
  expect((await verwaltung.put(`/api/inventory/shapes/items/${schwert.id}`, { data: { group: gruppe, rows: ['#', '#', '#'] } })).ok()).toBeTruthy();
  expect((await verwaltung.put(`/api/inventory/shapes/items/${plus.id}`, { data: { group: gruppe, ref: schwert.id } })).ok()).toBeTruthy();

  for (const seite of [leitung, spielerin]) {
    /* Die Übersicht: Gruppe links, der Gegenstand rechts mit seiner Herkunft. */
    await seite.goto('/inventory/shapes');
    await expect(seite.getByRole('heading', { name: 'Item shapes' })).toBeVisible();
    await seite.locator(`[data-gruppe="${gruppe}"]`).click();
    const zeile = seite.locator(`[data-item="${plus.id}"]`);
    await expect(zeile).toBeVisible();
    await expect(zeile.getByText(`from ${schwert.name}`)).toBeVisible();
    await expect(zeile.getByText('local')).toBeVisible();

    /* Am Gegenstand: das Element Shape sagt, woher die Form kommt. */
    await seite.goto(`/artikel/${plus.id}`);
    await expect(seite.getByRole('heading', { name: plus.name, exact: true }).first()).toBeVisible();
    await reiter(seite, /^Fields/);
    const herkunft = seite.locator('[data-ref="shape-origin"]');
    await expect(herkunft).toContainText('Shape from its reference item');
    await expect(herkunft.getByRole('link', { name: schwert.name })).toBeVisible();

    /* In der Liste: „hat Shape" findet beide, auch den, dessen Form nur
       vom Referenzgegenstand kommt — gerechnet wie am Artikel. */
    await seite.goto(`/compendium?type=Item&f=${encodeURIComponent('@has:Item.rows')}`);
    const tabelle = seite.getByRole('table');
    await expect(tabelle.getByText(plus.name, { exact: true })).toBeVisible();
    await expect(tabelle.getByText(schwert.name, { exact: true })).toBeVisible();
  }
});
