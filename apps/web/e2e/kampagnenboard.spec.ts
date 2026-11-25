/**
 * **Das Kampagnenboard als Startpunkt** (T-342), so, wie Spielerin und
 * Leitung es erleben: die Spielerin landet nach der Anmeldung auf dem
 * Board, sieht nur die offenen Aufträge, die für sie freigegeben sind, und
 * wechselt über die Basis-Leiste zu ihrer Figur und zurück. Die Leitung
 * behält ihren Start und sieht auf demselben Board auch, was sie
 * zurückhält.
 *
 * Auf dem Gerüst aus T-356: die Testkampagne des Laufs (ihr Board ist
 * `bd_<kampagne>`), die Figur der Spielerin aus dem Aufbau; die Aufträge
 * legt der Spec mit eigenem Namen an.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './hilfen';
import { KONTEN, PASSWORT } from './stand';

test.use({ storageState: { cookies: [], origins: [] } });

async function anmelden(page: Page, name: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Password').fill(PASSWORT);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('the player lands on the campaign board and finds her way back', async ({ page, api, eindeutig, lauf }) => {
  const board = `bd_${lauf.campaign.id}`;
  /* An die Kampagne gehängt: ein Auftrag ohne Kampagne zählt für jede. */
  const offen = await api.anlegen('leitung', 'Quest', eindeutig('Find the miller'), {
    fields: { 'Status.status': 'ready', 'Quest.progress': 'accepted' },
    relations: [{ type: 'partOf', to: lauf.campaign.id }],
  });
  const geheim = await api.anlegen('leitung', 'Quest', eindeutig('Kill the baron'), {
    fields: { 'Status.status': 'ready', 'Quest.progress': 'offered', 'Visibility.audience': 'gm' },
    relations: [{ type: 'partOf', to: lauf.campaign.id }],
  });

  await anmelden(page, KONTEN.spielerin);
  await expect(page).toHaveURL(new RegExp(`/boards/${board}$`));
  await expect(page.getByText(offen.name)).toBeVisible();
  await expect(page.getByText(geheim.name)).toHaveCount(0);
  const leiste = page.getByRole('navigation', { name: 'Table' });
  await leiste.getByRole('link', { name: /My character/ }).click();
  await expect(page).toHaveURL(new RegExp(`/artikel/${lauf.figur.id}`));
  await leiste.getByRole('link', { name: /Board/ }).click();
  await expect(page).toHaveURL(new RegExp(`/boards/${board}$`));
});

test('the GM keeps her start and sees more on the board', async ({ page, api, eindeutig, lauf }) => {
  const geheim = await api.anlegen('leitung', 'Quest', eindeutig('Kill the baron'), {
    fields: { 'Status.status': 'ready', 'Quest.progress': 'offered', 'Visibility.audience': 'gm' },
    relations: [{ type: 'partOf', to: lauf.campaign.id }],
  });
  await anmelden(page, KONTEN.leitung);
  await expect(page).toHaveURL(/\/compendium/);
  await expect(page.getByRole('navigation', { name: 'Table' })).toHaveCount(0);
  await page.goto(`/boards/bd_${lauf.campaign.id}`);
  await expect(page.getByText(geheim.name)).toBeVisible();
});
