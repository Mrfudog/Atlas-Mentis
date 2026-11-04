/**
 * **Ein Pfadschritt über mehrere Kantenarten** (T-454, REQ-430): im Designer
 * nimmt „Also via" dem letzten Schritt einer Sammlung eine zweite Kantenart
 * dazu, der Pfad schreibt `a | b`, und × am Chip lässt sie wieder weg.
 * Gespeichert wird hier nichts — der Entwurf geht mit der Seite.
 */
import { test, expect } from './hilfen';

test('the last step of a collection can follow a second edge kind', async ({ leitung }) => {
  await leitung.goto('/registry?tab=views&view=quick&type=Session');
  const baum = leitung.getByRole('tree', { name: 'Elements of the view' });
  await expect(baum).toBeVisible();

  /* Eine Sammlung einfügen — sie ist danach gewählt. */
  await leitung.getByTitle('Insert Links').click();
  await leitung.getByRole('menuitem', { name: 'Collection' }).click();
  const leiste = leitung.getByRole('toolbar', { name: 'Selected element' });
  await expect(leiste).toContainText('Collection');

  /* Erster Schritt: zurück über partOf — die Szenen und Begegnungen der Session. */
  const folgen = leitung.getByLabel('Follow an edge');
  const schritte = await folgen.locator('option').allTextContents();
  const zurueck = schritte.findIndex((t) => /←.*part/i.test(t));
  expect(zurueck, schritte.join('\n')).toBeGreaterThan(0);
  await folgen.selectOption({ index: zurueck });
  const pfad = leitung.locator('.pfad code');
  await expect(pfad).toContainText('← partOf');

  /* Zweiter Weg im selben Schritt: „Also via". */
  const auch = leitung.getByLabel('Also follow an edge in the last step');
  await expect(auch).toBeVisible();
  const weitere = await auch.locator('option').allTextContents();
  expect(weitere.length, weitere.join('\n')).toBeGreaterThan(1);
  await auch.selectOption({ index: 1 });
  await expect(pfad).toContainText(' | ');
  const chips = leitung.getByRole('group', { name: 'Edges of the last step' });
  await expect(chips.locator('.chipb')).toHaveCount(2);

  /* Der Chip nimmt die Art wieder weg — hier die erste, partOf; die letzte
     bleibt ohne ×. (Am Telefon steht die schwebende Leiste über dem zweiten Chip.) */
  const zweite = (await chips.locator('.chipb').last().textContent())?.replace('×', '').trim() ?? '';
  await chips.getByRole('button', { name: /^Drop part of/ }).click();
  await expect(pfad).not.toContainText(' | ');
  await expect(pfad).not.toContainText('partOf');
  await expect(chips.locator('.chipb')).toHaveCount(1);
  await expect(chips.locator('.chipb')).toContainText(zweite);
  await expect(chips.getByRole('button', { name: /^Drop / })).toHaveCount(0);
});
