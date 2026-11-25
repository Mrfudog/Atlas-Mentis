/**
 * **Text und Stempel** (T-219, REQ-142): die Leitung beschriftet die Karte
 * und setzt einen Stempel auf die Zeichenebene; die Spielerin sieht beides
 * als Text, und Radieren nimmt eine Beschriftung weg. Erfundene Artikel.
 */
import { test, expect } from './hilfen';

test('the GM labels the map and stamps it', async ({ leitung, spielerin, api, eindeutig }) => {
  const bild = await api.bild('leitung', eindeutig('road'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Old road'), {
    fields: { 'Status.status': 'ready', 'Image.image': bild, 'Map.kind': 'region' },
  });
  await leitung.goto(`/artikel/${karte.id}`);
  await expect(leitung.locator('.innen.gemessen').first()).toBeVisible();
  await leitung.getByRole('button', { name: 'Draw', exact: true }).click();
  await leitung.getByRole('button', { name: 'Text', exact: true }).click();
  await leitung.getByRole('textbox', { name: 'Label text' }).fill('Gate');
  /* Vor jedem Klick neu messen: die Werkzeugzeile ändert ihre Höhe (Eingabe, Stempelwahl), und die Bühne rutscht. */
  const tippe = async (fx: number, fy: number) => {
    await leitung.locator('.buehne').first().scrollIntoViewIfNeeded();
    const box = (await leitung.locator('.innen').first().boundingBox())!;
    await leitung.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  };
  await tippe(0.3, 0.4);
  const texte = leitung.locator('svg.striche text.beschriftung');
  await expect(texte).toHaveText(['Gate']);

  await leitung.getByRole('button', { name: 'Stamp', exact: true }).click();
  await leitung.getByRole('button', { name: 'Warning', exact: true }).click();
  await tippe(0.7, 0.6);
  await expect(texte).toHaveText(['Gate', '⚠']);

  await spielerin.goto(`/artikel/${karte.id}`);
  await expect(spielerin.locator('svg.striche text.beschriftung')).toHaveText(['Gate', '⚠']);

  await leitung.getByRole('button', { name: 'Erase', exact: true }).click();
  await tippe(0.3, 0.4);
  await expect(texte).toHaveText(['⚠']);
});
