/**
 * Bildwähler auf dem Telefon (T-369): der Knopf öffnet das ganze
 * Datei-Menü des Systems — **ohne `accept` und ohne `capture`**, denn
 * jedes `accept` aus Bildtypen lässt Android nur die Fotoauswahl zeigen —,
 * ein Bild aus den Dateien geht hoch, und was kein Bild ist, sagt nach der
 * Wahl, was zu tun ist.
 */
import { test, expect } from './hilfen';

/** Ein PNG mit einem Pixel — genug, damit der Server es als Bild liest. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('the image picker opens the whole file menu and checks after the choice', async ({ leitung, eindeutig }) => {
  await leitung.goto('/images');
  const eingabe = leitung.locator('input[type=file][multiple]');
  await expect(eingabe).toHaveCount(1);
  expect(await eingabe.getAttribute('capture')).toBeNull();
  expect(await eingabe.getAttribute('accept')).toBeNull();

  /* Der Knopf öffnet den Dateiwähler des Systems … */
  const [wahl] = await Promise.all([leitung.waitForEvent('filechooser'), leitung.getByText('Upload images').click()]);
  expect(wahl.isMultiple()).toBe(true);

  /* … eine Datei, die kein Bild ist, und eine HEIC gehen nicht hoch und sagen, was zu tun ist … */
  await wahl.setFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
  await expect(leitung.getByRole('alert')).toContainText('not a supported image');
  await eingabe.setInputFiles({ name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: Buffer.from([0]) });
  await expect(leitung.getByRole('alert')).toContainText('HEIC');

  /* … ein Bild aus den Dateien schon. */
  await eingabe.setInputFiles({ name: `${eindeutig('onedrive')}.png`, mimeType: 'image/png', buffer: PNG });
  await expect(leitung.getByText(/Uploaded 1 image/)).toBeVisible();
});
