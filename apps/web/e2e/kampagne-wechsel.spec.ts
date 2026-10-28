/**
 * T-411: die Kampagnenseite und die Kopfleiste zeigen dieselbe laufende
 * Kampagne, und eine neu angelegte steht sofort zur Wahl im Popup der
 * Kopfleiste — ohne Neuladen. Der Wechsel selbst ist global (er gälte für
 * die parallel laufenden Specs mit); ihn prüft `kampagnenseite.test.ts`.
 */
import { test, expect } from './hilfen';
import { sitzungDatei } from './stand';

test('a new campaign is offered in the bar at once, and the campaign page opens on the running one', async ({ browser, lauf, eindeutig }, info) => {
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, locale, baseURL } = info.project.use;
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, locale, baseURL, storageState: sitzungDatei('verwaltung') });
  const p = await ctx.newPage();
  const name = eindeutig('Campaign');
  let neu: string | null = null;
  try {
    await p.goto('/campaign');
    await expect(p.locator('nw-stapel .kname')).toHaveText(lauf.campaign.name);
    /* Die Seite zeigt die laufende Kampagne, nicht die erste nach Namen. */
    await expect(p.locator('.uebersicht h2')).toHaveText(lauf.campaign.name);
    await expect(p.locator('.nicht-laufend')).toHaveCount(0);

    await p.getByPlaceholder('e.g. Aus Nebel wacht').fill(name);
    const antwort = p.waitForResponse((r) => r.url().endsWith('/api/campaigns') && r.request().method() === 'POST');
    await p.getByRole('button', { name: 'Create campaign' }).click();
    neu = ((await (await antwort).json()) as { id: string }).id;
    await expect(p.locator('.uebersicht h2')).toHaveText(name);
    /* Sie läuft nicht — das sagt die Seite, mit dem Knopf für die Verwaltung. */
    await expect(p.locator('.nicht-laufend')).toContainText(lauf.campaign.name);
    await expect(p.getByRole('button', { name: 'Make this the running campaign' })).toBeVisible();

    /* Im Popup der Kopfleiste steht sie schon zur Wahl. */
    await p.locator('nw-stapel .knopf').click();
    await expect(p.getByLabel('Running campaign').locator('option', { hasText: name })).toHaveCount(1);
  } finally {
    if (neu) for (const id of [`bd_${neu}`, `pt_${neu}`, neu, `ly_${neu}`]) await p.request.delete(`/api/entities/${id}`);
    await ctx.close();
  }
});
