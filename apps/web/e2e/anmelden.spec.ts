/**
 * Anmelden (REQ-031, T-356): die Maske, ein falsches Passwort, und wer
 * angemeldet ist, landet in der laufenden Kampagne.
 */
import { test, expect } from './hilfen';
import { KONTEN, PASSWORT } from './stand';

test.use({ storageState: { cookies: [], origins: [] } });

test('signing in as the GM lands in the running campaign', async ({ page, lauf }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Atlas Mentis' })).toBeVisible();

  await page.getByLabel('Name').fill(KONTEN.leitung);
  await page.getByLabel('Password').fill('not-the-password-at-all');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  await page.getByLabel('Password').fill(PASSWORT);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeHidden();
  await expect(page.getByText(lauf.campaign.name).first()).toBeVisible();
});

test('the player signs in and sees the same campaign', async ({ page, lauf }) => {
  await page.goto('/');
  await page.getByLabel('Name').fill(KONTEN.spielerin);
  await page.getByLabel('Password').fill(PASSWORT);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(lauf.campaign.name).first()).toBeVisible();
});

test('a saved session opens straight into the campaign', async ({ leitung, spielerin, lauf }) => {
  for (const seite of [leitung, spielerin]) {
    await seite.goto('/');
    await expect(seite.getByText(lauf.campaign.name).first()).toBeVisible();
    await expect(seite.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
  }
});
