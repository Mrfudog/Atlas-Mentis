/**
 * Bildwähler auf dem Telefon (T-369): die Auswahl öffnet das Datei-Menü
 * des Systems — ohne `capture`, mit konkreten Typen statt `image/*`,
 * sonst bietet Android nur die Fotos an —, ein Bild aus den Dateien geht
 * hoch, und eine HEIC-Datei sagt, was zu tun ist.
 */
import { test, expect } from './hilfen';

/** Ein PNG mit einem Pixel — genug, damit der Server es als Bild liest. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('the image picker opens files, not only photos, and uploads from them', async ({
  leitung,
  eindeutig,
}) => {
  await leitung.goto('/images');
  const eingabe = leitung.locator('input[type=file][multiple]');
  await expect(eingabe).toHaveCount(1);
  expect(await eingabe.getAttribute('capture')).toBeNull();
  const accept = (await eingabe.getAttribute('accept')) ?? '';
  expect(accept).not.toContain('image/*');
  expect(accept.split(',')).toEqual(
    expect.arrayContaining(['image/jpeg', '.jpg', 'image/png', '.png']),
  );

  /* Der Knopf öffnet den Dateiwähler des Systems … */
  const [wahl] = await Promise.all([
    leitung.waitForEvent('filechooser'),
    leitung.getByText('Upload images').click(),
  ]);
  expect(wahl.isMultiple()).toBe(true);

  /* … eine HEIC-Datei geht nicht hoch und sagt, was zu tun ist … */
  await wahl.setFiles({ name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: Buffer.from([0]) });
  await expect(leitung.getByRole('alert')).toContainText('HEIC');

  /* … eine Datei ohne Medientyp, wie sie aus einer Cloud kommt, schon. */
  const name = `${eindeutig('onedrive')}.png`;
  await eingabe.setInputFiles({ name, mimeType: '', buffer: PNG });
  await expect(leitung.getByText(/Uploaded 1 image/)).toBeVisible();
});
