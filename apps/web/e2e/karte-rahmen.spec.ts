/**
 * Ein Unterkartenrahmen springt nicht, solange ein Werkzeug läuft (T-327).
 * Ein Rahmen ist ein Link: mit *Unlink* angetippt, sprang die Seite in die
 * Unterkarte, bevor die Verknüpfung gelöst war — und zurück war sie noch
 * da. Mit *Link shape* landete ein Punkt im Rahmen statt auf der Karte.
 */
import { test, expect } from './hilfen';

test('unlink and link shape do not enter the sub-map', async ({ leitung, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const bild = await api.bild('leitung', eindeutig('region'));
  const oben = await api.anlegen('leitung', 'Map', eindeutig('Region'), {
    fields: { 'Status.status': 'ready', 'Image.image': bild, 'Map.kind': 'region' },
  });
  const unten = await api.anlegen('leitung', 'Map', eindeutig('Town'), {
    fields: { 'Status.status': 'ready', 'Image.image': bild, 'Map.kind': 'settlement' },
    relations: [{ type: 'insideMap', to: oben.id, props: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 } }],
  });

  await leitung.goto(`/artikel/${oben.id}`);
  const rahmen = leitung.locator('a.rahmen');
  await expect(rahmen).toHaveCount(1);
  if (telefon) await leitung.getByRole('button', { name: 'Tools', exact: false }).first().click().catch(() => undefined);
  await leitung.getByRole('button', { name: 'Sub-maps', exact: true }).click();

  /* Link shape: ein Punkt im Rahmen bleibt auf dieser Karte. */
  await leitung.getByRole('button', { name: 'Link shape' }).click();
  const box = await rahmen.boundingBox();
  if (!box) throw new Error('Der Rahmen hat keine Lage.');
  await leitung.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(leitung).toHaveURL(new RegExp(oben.id));
  /* Die gesetzte Ecke steht da; Undo point und Backspace nehmen sie zurück. */
  const ecken = leitung.locator('.innen span.punkt:not(.fremd)');
  await expect(ecken).toHaveCount(1);
  await leitung.mouse.click(box.x + box.width / 4, box.y + box.height / 4);
  await expect(ecken).toHaveCount(2);
  await leitung.getByRole('button', { name: 'Undo point' }).click();
  await expect(ecken).toHaveCount(1);
  await leitung.keyboard.press('Backspace');
  await expect(ecken).toHaveCount(0);
  await leitung.getByRole('button', { name: 'Cancel' }).click();

  /* Unlink: antippen, bestätigen — die Seite bleibt, der Rahmen geht. */
  await leitung.getByRole('button', { name: 'Unlink' }).click();
  leitung.once('dialog', (d) => void d.accept());
  await rahmen.click();
  await expect(leitung).toHaveURL(new RegExp(oben.id));
  await expect(leitung.locator('a.rahmen')).toHaveCount(0);
  await leitung.reload();
  await expect(leitung.locator('a.rahmen')).toHaveCount(0);
  expect(unten.id).toBeTruthy();
});
