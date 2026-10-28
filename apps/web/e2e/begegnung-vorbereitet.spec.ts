/**
 * **Ein Encounter trägt, was vorbereitet ist** (T-333): Ort und Beute
 * stehen als Gruppen auf seiner Seite, und im Tracker legt die Leitung
 * einen Gegner an, den es noch nicht gibt, und setzt ihn dreimal ein —
 * drei Zeilen, durchgezählt. Bei 1360 und 390 px (beide Projekte).
 * Erfundene Artikel, keine Regelwerksdaten.
 */
import { test, expect } from './hilfen';

test('an encounter shows its place and loot, and the GM creates a foe and adds three at once', async ({ leitung, api, eindeutig }) => {
  const bereit = { 'Status.status': 'ready' };
  const muehle = await api.anlegen('leitung', 'Place', eindeutig('Old mill'), { fields: bereit });
  const silber = await api.anlegen('leitung', 'Item', eindeutig('Silver piece'), { fields: bereit });
  const begegnung = await api.anlegen('leitung', 'Encounter', eindeutig('Mill yard ambush'), {
    fields: bereit,
    relations: [
      { type: 'happensAt', to: muehle.id },
      { type: 'loot', to: silber.id, props: { qty: 30, chance: 50 } },
    ],
  });

  await leitung.goto(`/artikel/${begegnung.id}`);
  await expect(leitung.locator('section.sammlung[data-el="e-place"]')).toContainText(muehle.name);
  const beute = leitung.locator('section.sammlung[data-el="e-loot"]');
  await expect(beute).toContainText(silber.name);
  await expect(beute.locator('tbody tr').first()).toContainText('30');
  await expect(beute.locator('tbody tr').first()).toContainText('50');

  /* Anlegen aus der Auswahl im Tracker (T-131), dann drei auf einmal. */
  const tracker = leitung.locator('nw-initiative');
  const wolf = eindeutig('Dire wolf');
  await tracker.getByLabel('Add a combatant').fill(wolf);
  await tracker.getByRole('button', { name: `Create “${wolf}” as …` }).click();
  const dialog = leitung.getByRole('dialog');
  await dialog.getByLabel('Type').selectOption({ label: 'Creature' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toContainText('is created and linked here');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await tracker.getByLabel('How many').fill('3');
  await tracker.getByRole('button', { name: 'Add', exact: true }).click();
  for (const n of [1, 2, 3]) await expect(tracker.getByText(`${wolf} ${n}`, { exact: true })).toBeVisible();

  /* Nichts steht über den Rand. */
  const breit = await leitung.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(breit).toBeLessThanOrEqual(1);
});
