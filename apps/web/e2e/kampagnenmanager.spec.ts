/**
 * T-141: der Kampagnenmanager — auf der Kampagnenseite steht jede
 * Entscheidung als Zeile mit Stand und Folgen, und „Change" öffnet genau
 * den Ort, an dem sie neu getroffen wird.
 */
import { test, expect } from './hilfen';
import { sitzungDatei } from './stand';

test('the campaign page lists its decisions, and Change opens the place for one of them', async ({ browser, lauf }, info) => {
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, locale, baseURL } = info.project.use;
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, locale, baseURL, storageState: sitzungDatei('verwaltung') });
  const p = await ctx.newPage();
  try {
    await p.goto('/campaign');
    await expect(p.locator('.uebersicht h2')).toHaveText(lauf.campaign.name);
    const liste = p.getByRole('region', { name: 'Decisions' });
    await expect(liste).toBeVisible();

    /* Der Tisch zuerst: Ebenen, Vergleich, Mitglieder — je mit dem, was eine Änderung tut. */
    const ebenen = liste.locator('[data-key="layers"]');
    await expect(ebenen).toContainText('Layers in play');
    await expect(ebenen.locator('.folge')).toContainText('nothing is deleted');
    await expect(liste.locator('[data-key="members"]')).toContainText(/\d+ leads?/);

    /* Nichts ragt über den Rand, auch nicht auf dem Telefon. */
    const breit = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(breit).toBeLessThanOrEqual(0);

    /* „Change" öffnet den Reiter, in dem genau diese Entscheidung fällt. */
    await liste.getByRole('button', { name: 'Change Members and roles' }).click();
    await expect(p).toHaveURL(/tab=members/);
    await expect(p.getByRole('region', { name: 'Members' })).toBeVisible();

    await p.goto('/campaign');
    await p.getByRole('region', { name: 'Decisions' }).getByRole('button', { name: 'Change Layers in play' }).click();
    await expect(p).toHaveURL(/tab=layers/);
    await expect(p.getByRole('heading', { name: 'Layers in play' })).toBeVisible();
  } finally {
    await ctx.close();
  }
});
