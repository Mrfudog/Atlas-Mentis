/**
 * Reise an der Gruppe (T-350, REQ-170): die Leitung lässt eine Wache
 * vergehen und zieht einen Knoten weiter — Tag und Wache laufen, nach dem
 * dritten Knoten ist eine Ration fällig (Einstellung `travelRationEvery`).
 * Eine eigene kleine Testgruppe, keine Kampagnendaten.
 */
import { test, expect } from './hilfen';
import type { Page } from '@playwright/test';

const keinSeitwaertsScroll = async (seite: Page) =>
  expect(await seite.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test('a watch passes and the party moves on; rations fall due', async ({ leitung, api, eindeutig }) => {
  const gruppe = await api.anlegen('leitung', 'Party', eindeutig('Wayfarers'), {
    fields: { 'Party.day': 1, 'Party.watch': 3, 'Party.sinceRation': 2, 'Party.sinceLight': 0 },
  });
  const l = leitung;
  await l.goto(`/artikel/${gruppe.id}`);
  const reise = l.getByRole('region', { name: 'Travel' });
  await expect(reise).toContainText('Day 1, watch 3 of 3 · rations in 1 · light in 4');

  await reise.getByRole('button', { name: 'Next node' }).click();
  await expect(reise).toContainText('Day 2, watch 1 of 3 · rations in 3 · light in 3');
  await expect(reise.getByRole('status')).toHaveText('Day 2 begins. A ration is used up.');

  await reise.getByRole('button', { name: 'Wait a watch' }).click();
  await expect(reise).toContainText('Day 2, watch 2 of 3 · rations in 3 · light in 3');
  await keinSeitwaertsScroll(l);
});
