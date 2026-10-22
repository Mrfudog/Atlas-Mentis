/**
 * Löschen aus der eigenen Ebene (T-381): in der Galerie mehrere Bilder
 * wählen und löschen — gelöscht wird, was in der Schreibebene liegt, der
 * Rest wird abgewählt, und Undo bringt alles zurück.
 *
 * Am Desktop die Leitung (Schreibebene: die Ebene der Kampagne; das Bild
 * der Spielerin liegt in deren Spielerebene), am Telefon die Spielerin
 * (Schreibebene: ihre Spielerebene; das Bild der Leitung liegt in der
 * Kampagnenebene). So löschen die beiden Projekte nie dasselbe.
 */
import { test, expect } from './hilfen';

test('delete selected images: own layer deleted, others deselected, undo', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const seite = telefon ? spielerin : leitung;
  const ich = telefon ? 'spielerin' : 'leitung';
  const andere = telefon ? 'leitung' : 'spielerin';
  /* Der Name kommt aus dem Dateinamen, und dort werden - und _ zu Leerzeichen. */
  const wort = eindeutig('Del').replace(/[\s_-]+/g, '');
  const eigene = [`${wort} owna`, `${wort} ownb`];
  const fremd = `${wort} other`;
  for (const n of eigene) await api.bild(ich, n, ich === 'leitung');
  await api.bild(andere, fremd, andere === 'leitung');

  await seite.goto('/images');
  if (telefon) await seite.getByText('Filters', { exact: true }).click();
  await seite.getByPlaceholder('Name…').fill(wort);
  const raster = seite.getByRole('list', { name: 'Images' });
  for (const n of [...eigene, fremd]) await expect(raster.getByText(n, { exact: true })).toBeVisible();

  for (const n of [...eigene, fremd]) await seite.getByRole('checkbox', { name: `Select ${n}` }).check();
  const leiste = seite.getByRole('region', { name: 'Selected images' });
  await expect(leiste.getByText('3 selected')).toBeVisible();

  const fragen: string[] = [];
  seite.on('dialog', (d) => {
    fragen.push(d.message());
    void d.accept();
  });
  await leiste.getByRole('button', { name: 'Delete', exact: true }).click();

  const meldung = seite.locator('p.ergebnis');
  await expect(meldung).toContainText('2 deleted, 1 from other layers deselected');
  expect(fragen[0]).toMatch(/Delete 2 articles\?/);
  expect(fragen[0]).toMatch(/1 selected article is not in your write layer/);
  for (const n of eigene) await expect(raster.getByText(n, { exact: true })).toHaveCount(0);
  await expect(raster.getByText(fremd, { exact: true })).toBeVisible();
  /* Abgewählt, nicht gelöscht: die Auswahl ist leer. */
  await expect(seite.getByRole('checkbox', { name: `Select ${fremd}` })).not.toBeChecked();
  await expect(leiste).toHaveCount(0);

  await meldung.getByRole('button', { name: 'Undo' }).click();
  await expect(meldung).toContainText('Undone.');
  for (const n of eigene) await expect(raster.getByText(n, { exact: true })).toBeVisible();
});

test('delete on an article page, with undo', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const seite = telefon ? spielerin : leitung;
  const ich = telefon ? 'spielerin' : 'leitung';
  const ort = await api.anlegen(ich, 'Place', eindeutig('Del place'));

  await seite.goto(`/artikel/${ort.id}`);
  seite.on('dialog', (d) => void d.accept());
  await seite.getByRole('button', { name: 'Delete', exact: true }).click();
  const status = seite.locator('p.geloescht');
  await expect(status).toContainText(`Deleted “${ort.name}”.`);
  expect((await (await api.als(ich)).get(`/api/entities/${ort.id}`)).status()).toBe(404);

  await status.getByRole('button', { name: 'Undo' }).click();
  await expect(seite.getByRole('heading', { name: ort.name }).first()).toBeVisible();
  expect((await (await api.als(ich)).get(`/api/entities/${ort.id}`)).status()).toBe(200);
});
