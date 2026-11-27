/**
 * **Kampagne und Sicht je Konto** (T-496, REQ-395, REQ-396): eine Spielerin
 * in zwei Runden wählt im Globalfilter die zweite — ihre Mitspielerin
 * bleibt in der ersten. Danach blendet sie in „Campaign view" eine Ebene
 * nur für sich aus und setzt zurück, und in „My view" sieht sie eine Ebene,
 * die ihre Kampagne nicht aufschaltet.
 *
 * Eigene Konten, über eine Einladung angelegt: Kampagne und Sicht gelten je
 * Konto, und die festen Konten der übrigen Specs laufen parallel — eine
 * Wahl an ihnen sähen alle anderen mit.
 */
import type { APIRequestContext, Browser, Page, TestInfo } from '@playwright/test';
import { test, expect } from './hilfen';
import { PASSWORT } from './stand';

async function ok(res: { ok(): boolean; status(): number; text(): Promise<string> }, was: string) {
  if (!res.ok()) throw new Error(`${was}: ${res.status()} ${await res.text()}`);
  return res;
}

/** Ein Konto über eine Einladung in die Kampagne, angemeldet als Seite und als API. */
async function konto(browser: Browser, admin: APIRequestContext, kampagne: string, name: string, info: TestInfo): Promise<{ seite: Page; api: APIRequestContext }> {
  const { code } = (await (await ok(await admin.post('/api/invites', { data: { campaignId: kampagne, role: 'player', uses: 1 } }), 'Einladung')).json()) as { code: string };
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, locale, baseURL } = info.project.use;
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, locale, baseURL });
  await ok(await ctx.request.post('/api/register', { data: { name, password: PASSWORT, invite: code } }), `Konto ${name}`);
  return { seite: await ctx.newPage(), api: ctx.request };
}

test('each account chooses its campaign and its own view; the other stays in hers', async ({ browser, api, lauf, eindeutig }, info) => {
  const admin = await api.als('verwaltung');
  const kennung = eindeutig('k').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  /* Eine zweite Runde mit ihrer Ebene. */
  const zweite = (await (await ok(await admin.post('/api/campaigns', { data: { name: eindeutig('Saltpath') } }), 'Kampagne')).json()) as { id: string; name: string };
  const ebeneB = `ly_${zweite.id}`;
  const regel = async (name: string, ebene: string) => {
    /* Gleich fertig: die Verwaltung liest die zweite Runde nicht (nicht ihr Stapel), also kein Nachsetzen. */
    const r = await ok(
      await admin.post('/api/entities', { data: { type: 'Rule', name, fields: { 'Status.status': 'ready' }, relations: [{ type: 'inLayer', to: ebene }] } }),
      name,
    );
    return ((await r.json()) as { id: string }).id;
  };
  const nameA = eindeutig('Fog rule');
  const nameB = eindeutig('Salt rule');
  const idA = await regel(nameA, lauf.campaign.layer);
  const idB = await regel(nameB, ebeneB);

  const mara = await konto(browser, admin, lauf.campaign.id, `e2e-mara-${kennung}`, info);
  const juno = await konto(browser, admin, lauf.campaign.id, `e2e-juno-${kennung}`, info);
  await ok(await admin.post(`/api/campaigns/${zweite.id}/members`, { data: { name: `e2e-mara-${kennung}`, role: 'player' } }), 'Mitglied');
  const sieht = async (wer: APIRequestContext, id: string) => (await wer.get(`/api/entities/${id}`)).status();

  try {
    const p = mara.seite;
    await p.goto('/compendium');
    const knopf = p.locator('nw-stapel button.knopf');
    await expect(knopf.locator('.kname')).toHaveText(lauf.campaign.name);
    await knopf.click();
    const popup = p.getByRole('dialog', { name: 'Campaign & layers' });
    await expect(popup.getByRole('tab', { name: 'Campaign view' })).toHaveAttribute('aria-selected', 'true');

    /* REQ-395: die zweite Runde wählen — nur für dieses Konto. */
    const wahl = popup.getByLabel('Running campaign');
    await expect(wahl.locator('option')).toHaveCount(2);
    await wahl.selectOption(zweite.id);
    await expect(knopf.locator('.kname')).toHaveText(zweite.name);
    expect(await sieht(mara.api, idB)).toBe(200);
    expect(await sieht(mara.api, idA)).toBe(404);
    /* Juno bleibt in ihrer Runde, auch in der Oberfläche. */
    await juno.seite.goto('/compendium');
    await expect(juno.seite.locator('nw-stapel .kname')).toHaveText(lauf.campaign.name);
    expect(await sieht(juno.api, idA)).toBe(200);
    expect(await sieht(juno.api, idB)).toBe(404);

    /* REQ-396, Campaign view: die eigene Ebene der Runde für mich ausblenden — die Runde ändert sich nicht. */
    /* Genau die Ebene der Runde — daneben steht Maras Spielerebene mit dem Namen der Runde darin. */
    const haken = popup.locator('nw-meine-sicht').getByRole('checkbox', { name: zweite.name, exact: true });
    await expect(haken).toBeChecked();
    await haken.uncheck();
    await expect(knopf.locator('.sichtmarke')).toHaveText('narrowed');
    await expect.poll(() => sieht(mara.api, idB)).toBe(404);
    const stapel = (await (await admin.get(`/api/entities/${zweite.id}`)).json()) as { relations?: { type: string; to: string }[] };
    expect(stapel.relations?.some((r) => r.type === 'activates' && r.to === ebeneB)).toBe(true);
    await popup.getByRole('button', { name: 'Reset' }).click();
    await expect(knopf.locator('.sichtmarke')).toHaveCount(0);
    await expect.poll(() => sieht(mara.api, idB)).toBe(200);

    /* My view: die Ebene der ersten Runde dazu — eine, die diese Kampagne nicht aufschaltet. */
    await popup.getByRole('tab', { name: 'My view' }).click();
    await expect(popup.getByRole('tab', { name: 'My view' })).toHaveAttribute('aria-selected', 'true');
    await expect(knopf.locator('.sichtmarke')).toHaveText('my view');
    await popup.getByRole('searchbox', { name: 'Filter layers' }).fill(lauf.campaign.name);
    const fremd = popup.locator('nw-meine-sicht label.option').filter({ has: p.getByRole('checkbox', { name: new RegExp(`^${lauf.campaign.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} not in this campaign`) }) });
    await expect(fremd).toHaveCount(1);
    await fremd.getByRole('checkbox').check();
    await expect.poll(() => sieht(mara.api, idA)).toBe(200);
    expect(await sieht(mara.api, idB)).toBe(200);
    /* Die Seite zeigt den Artikel aus der anderen Ebene. */
    await popup.getByRole('button', { name: 'Close' }).click();
    await p.goto(`/artikel/${idA}`);
    await expect(p.getByRole('heading', { name: nameA }).first()).toBeVisible();

    /* Zurück: Campaign view, und Juno hat von allem nichts gemerkt. */
    await p.locator('nw-stapel button.knopf').click();
    await p.getByRole('dialog', { name: 'Campaign & layers' }).getByRole('tab', { name: 'Campaign view' }).click();
    await expect.poll(() => sieht(mara.api, idA)).toBe(404);
    expect(await sieht(juno.api, idA)).toBe(200);
    expect(((await (await juno.api.get('/api/campaigns')).json()) as { current: { id: string; view: string } }).current).toMatchObject({ id: lauf.campaign.id, view: 'campaign' });
  } finally {
    for (const id of [idA, idB, `bd_${zweite.id}`, `pt_${zweite.id}`, zweite.id, ebeneB]) await admin.delete(`/api/entities/${id}`);
    await mara.seite.context().close();
    await juno.seite.context().close();
  }
});
