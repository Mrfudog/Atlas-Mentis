/**
 * Eine Karte teilen (T-289, T-312, REQ-178): die Vorlage ist in
 * Vorbereitung und nur für die Leitung, ihr Bild ebenso, und sie trägt
 * einen Decknamen. „Release" allein muss reichen: die Spielerin sieht die
 * Karte, ihr Bild unter dem Nebel und den Decknamen — bis die Leitung den
 * Namen aufdeckt.
 */
import { test, expect } from './hilfen';

test('release shares the map, its image under the fog and its cover name', async ({
  leitung,
  spielerin,
  api,
  eindeutig,
}, info) => {
  const telefon = info.project.name === 'phone';
  const bild = await api.bild('leitung', eindeutig('vault'));
  /* Das Bild selbst geht niemanden ausser der Leitung an — die Karte gibt es frei. */
  await api.setzen('leitung', bild, { Visibility: { audience: 'gm' } });
  const name = eindeutig('Sunken vault');
  const deckname = eindeutig('Old ruin');
  const vorlage = await api.anlegen('leitung', 'Map', name, {
    fields: {
      'Status.status': 'prepared',
      'Image.image': bild,
      'Identity.cover': deckname,
      'Visibility.audience': 'gm',
    },
  });
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), {
    fields: { 'Status.status': 'ready' },
  });
  const genommen = await (
    await api.als('leitung')
  ).post('/api/play/take', { data: { session: sitzung.id, map: vorlage.id } });
  expect(genommen.ok()).toBe(true);

  await leitung.goto(`/play?session=${sitzung.id}`);
  const menue = leitung.getByRole('button', { name: 'View', exact: true });
  if (telefon) await menue.click();
  await leitung.getByRole('button', { name: 'Release to players' }).click();
  if (telefon && (await menue.getAttribute('aria-expanded')) !== 'true') await menue.click();
  await expect(leitung.getByRole('button', { name: 'Released' })).toBeVisible();

  /* Die Spielerin sieht die Karte mit Bild — beschnitten, aber geladen. */
  await spielerin.goto(`/play?session=${sitzung.id}`);
  const grund = spielerin.locator('img.blatt.grund');
  await expect(grund).toHaveAttribute('src', /\/api\/maps\/.+\/image\?sheet=__base&fog=/);
  await expect
    .poll(() => grund.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth))
    .toBeGreaterThan(0);
  const pfad = spielerin.getByRole('navigation', { name: 'Map breadcrumb' });
  await expect(pfad).toContainText(deckname);
  await expect(spielerin.getByText(name)).toHaveCount(0);

  /* Die Leitung deckt den Namen auf; nach dem Neuladen steht er da. */
  await leitung.getByRole('button', { name: 'Reveal name' }).click();
  await expect(leitung.getByText(/The name is now known to/)).toBeVisible();
  await spielerin.reload();
  await expect(pfad).toContainText(name);
});
