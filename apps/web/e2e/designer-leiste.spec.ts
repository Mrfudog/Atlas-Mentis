/**
 * **Die Leiste im Ansichtsdesigner** (T-425, REQ-436, E-171): oben einfügen
 * nach Gruppe, am gewählten Element die schwebende Leiste mit Duplizieren
 * und Kopieren, Rückgängig und Wiederholen über den Entwurf. Gespeichert
 * wird hier nichts — der Entwurf geht mit der Seite.
 */
import { test, expect } from './hilfen';

test('the designer bar inserts, duplicates, copies, undoes and redoes', async ({ leitung }) => {
  await leitung.goto('/registry?tab=views&view=quick');
  const baum = leitung.getByRole('tree', { name: 'Elements of the view' });
  await expect(baum).toBeVisible();
  const ueberschriften = baum.getByRole('treeitem').filter({ hasText: 'Heading' });
  const vorher = await ueberschriften.count();

  /* Einfügen über die Gruppe „Text". */
  await leitung.getByTitle('Insert Text').click();
  await leitung.getByRole('menuitem', { name: 'Heading' }).click();
  await expect(ueberschriften).toHaveCount(vorher + 1);

  /* Das neue ist gewählt: die schwebende Leiste trägt seinen Namen. */
  const leiste = leitung.getByRole('toolbar', { name: 'Selected element' });
  await expect(leiste).toContainText('Heading');
  await leiste.getByRole('button', { name: 'Duplicate' }).click();
  await expect(ueberschriften).toHaveCount(vorher + 2);

  const oben = leitung.getByRole('toolbar', { name: 'Insert and edit' });
  await oben.getByRole('button', { name: 'Undo' }).click();
  await expect(ueberschriften).toHaveCount(vorher + 1);
  await oben.getByRole('button', { name: 'Redo' }).click();
  await expect(ueberschriften).toHaveCount(vorher + 2);

  /* Nach Rückgängig ist nichts gewählt, was es nicht mehr gab — also wieder wählen. */
  await ueberschriften.last().locator('.knoten').click();
  await leiste.getByRole('button', { name: 'Copy' }).click();
  await oben.getByRole('button', { name: 'Paste' }).click();
  await expect(ueberschriften).toHaveCount(vorher + 3);

  await leiste.getByRole('button', { name: 'Remove' }).click();
  await expect(ueberschriften).toHaveCount(vorher + 2);

  /* Die Suche der Leiste findet ein Element jeder Gruppe. */
  await oben.getByRole('searchbox', { name: 'Find an element' }).fill('collect');
  await expect(
    leitung
      .getByRole('menu', { name: 'Elements found' })
      .getByRole('menuitem', { name: /Collection/ }),
  ).toBeVisible();
});
