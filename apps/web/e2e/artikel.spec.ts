/**
 * Artikel ansehen (T-356): die Seite (`full`), die Kurzansicht (`quick`)
 * an einem Verweis im Text, die Leiste „View" — und was die Leitung
 * zurückhält, kommt bei der Spielerin nicht an (D72, `redactEntity`).
 */
import { test, expect } from './hilfen';

test('a reference opens the quick view, and from there the full article', async ({ leitung, api, eindeutig }) => {
  const markt = await api.anlegen('leitung', 'Place', eindeutig('Market'), {
    fields: { 'Description.description': 'Stalls under the old bridge.', 'Status.status': 'ready' },
  });
  const hafen = await api.anlegen('leitung', 'Place', eindeutig('Harbour'), {
    fields: { 'Description.description': `Ships unload for [[${markt.id}|the market]].`, 'Status.status': 'ready' },
  });

  await leitung.goto(`/artikel/${hafen.id}`);
  await expect(leitung.getByRole('heading', { level: 1, name: hafen.name })).toBeVisible();
  await expect(leitung.getByRole('group', { name: 'View' })).toBeVisible();

  await leitung.getByText('the market', { exact: true }).click();
  const kurz = leitung.getByRole('dialog', { name: 'Quick view' });
  await expect(kurz).toBeVisible();
  await expect(kurz.getByText(markt.name)).toBeVisible();
  await kurz.getByRole('link', { name: 'Open article' }).click();

  await expect(leitung).toHaveURL(new RegExp(`/artikel/${markt.id}`));
  await expect(leitung.getByRole('heading', { level: 1, name: markt.name })).toBeVisible();
  await expect(leitung.getByText('Stalls under the old bridge.')).toBeVisible();
});

test('what the GM holds back does not reach the player', async ({ leitung, spielerin, api, eindeutig }) => {
  const offen = await api.anlegen('leitung', 'Place', eindeutig('Square'), { fields: { 'Status.status': 'ready' } });
  const gruft = await api.anlegen('leitung', 'Place', eindeutig('Crypt'), {
    fields: { 'Visibility.audience': 'gm', 'Status.status': 'ready' },
  });

  await leitung.goto(`/artikel/${gruft.id}`);
  await expect(leitung.getByRole('heading', { level: 1, name: gruft.name })).toBeVisible();

  await spielerin.goto(`/artikel/${offen.id}`);
  await expect(spielerin.getByRole('heading', { level: 1, name: offen.name })).toBeVisible();
  /* Erst die Antwort abwarten, dann prüfen, dass nichts dasteht — sonst
     hiesse „nicht zu sehen" nur „noch nicht geladen". */
  const antwort = spielerin.waitForResponse((r) => r.url().includes(`/api/entities/${gruft.id}`));
  await spielerin.goto(`/artikel/${gruft.id}`);
  expect((await antwort).status()).toBe(404);
  await expect(spielerin.getByRole('heading', { level: 1, name: offen.name })).toHaveCount(0);
  await expect(spielerin.getByText(gruft.name)).toHaveCount(0);
});
