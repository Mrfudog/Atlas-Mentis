/**
 * **Design-Tokens** (T-425, REQ-437, E-170 a): unter Registry › Tokens stehen
 * die Farben mit hellem und dunklem Wert und ihrem Kontrast; die Leitung
 * legt ein Token an und löscht es wieder. Im Designer wählt sie an einem
 * Element für die Fläche ein Token — keine Farbe. Gespeichert wird im
 * Designer nichts.
 */
import { test, expect } from './hilfen';

test('registry › tokens lists colours with contrast, and the designer offers them per slot', async ({
  leitung,
  eindeutig,
}) => {
  await leitung.goto('/registry?tab=tokens');
  const tabelle = leitung.getByRole('region', { name: 'Design tokens' });
  const papier = tabelle.getByRole('row', { name: 'Paper' });
  await expect(papier).toBeVisible();
  await expect(tabelle.getByRole('row', { name: 'Ink' })).toContainText('☀');

  /* Ein Token anlegen und wieder löschen — es nutzt noch keine Ansicht. */
  const name = eindeutig('Danger');
  await tabelle.getByRole('textbox', { name: 'Name of the new token' }).fill(name);
  await tabelle.getByRole('button', { name: 'Add token' }).click();
  const neu = tabelle.getByRole('row', { name });
  await expect(neu).toBeVisible();
  await neu.getByRole('button', { name: `Delete ${name}` }).click();
  await expect(neu).toHaveCount(0);

  /* Im Designer: ein Element einfügen und seiner Fläche ein Token geben. */
  await leitung.goto('/registry?tab=views&view=quick');
  await leitung.getByTitle('Insert Text').click();
  await leitung.getByRole('menuitem', { name: 'Heading' }).click();
  const design = leitung.locator('details.design');
  await design.locator('summary').click();
  const flaeche = leitung.getByRole('combobox', { name: 'Design: Surface' });
  await expect(flaeche.locator('option', { hasText: 'Paper' })).toHaveCount(1);
  await flaeche.selectOption({ label: 'Paper' });
  await expect(design.locator('summary')).toContainText('own');
});
