/**
 * Der Papierkorb (T-400, REQ-394, E-160 a): ein gelöschter Artikel steht
 * unter „Deleted" und kommt mit „Restore" zurück; „Empty trash" ist
 * endgültig. Am Desktop die Leitung, am Telefon die Spielerin — jede mit
 * eigenen Artikeln. „Empty trash" leert nur, was die Spielerin selbst
 * gelöscht hat; darum leert nur sie (am Telefon), damit die Leitung am
 * Desktop nicht den Korb eines parallel laufenden Specs leert.
 */
import { test, expect } from './hilfen';

test('deleted articles wait in Deleted and come back with Restore', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const seite = telefon ? spielerin : leitung;
  const ich = telefon ? 'spielerin' : 'leitung';
  const bleibt = await api.anlegen(ich, 'Place', eindeutig('Trash keep'));
  const geht = await api.anlegen(ich, 'Place', eindeutig('Trash gone'));

  /* Löschen auf der Artikelseite; die Meldung führt in den Papierkorb. */
  seite.on('dialog', (d) => void d.accept());
  for (const o of [bleibt, geht]) {
    await seite.goto(`/artikel/${o.id}`);
    await seite.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(seite.locator('p.geloescht')).toContainText(`Deleted “${o.name}”.`);
  }
  await seite.locator('p.geloescht').getByRole('link', { name: 'In Deleted for 30 days' }).click();
  await expect(seite).toHaveURL(/\/trash$/);
  await expect(seite.getByRole('heading', { name: 'Deleted', level: 1 })).toBeVisible();

  /* Zurück holen: einer kommt, der andere bleibt im Korb. */
  await seite.getByRole('button', { name: `Restore ${bleibt.name}` }).click();
  await expect(seite.locator('p.ergebnis')).toContainText(`Restored “${bleibt.name}”.`);
  /* Sein Lauf hatte nur ihn — der ist jetzt ganz zurück und steht nicht mehr da. */
  await expect(seite.getByRole('button', { name: `Restore ${bleibt.name}` })).toHaveCount(0);
  expect((await (await api.als(ich)).get(`/api/entities/${bleibt.id}`)).status()).toBe(200);
  await expect(seite.getByRole('button', { name: `Restore ${geht.name}` })).toBeVisible();
  /* Kein Stück der Seite steht über den Rand (390 px). */
  expect(await seite.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  if (telefon) {
    await seite.getByRole('button', { name: 'Empty trash' }).click();
    await expect(seite.locator('p.ergebnis')).toContainText('Trash emptied.');
    await expect(seite.getByRole('button', { name: `Restore ${geht.name}` })).toHaveCount(0);
    expect((await (await api.als(ich)).get(`/api/entities/${geht.id}`)).status()).toBe(404);
  } else {
    await seite.getByRole('button', { name: `Restore ${geht.name}` }).click();
    await expect(seite.locator('p.ergebnis')).toContainText(`Restored “${geht.name}”.`);
    expect((await (await api.als(ich)).get(`/api/entities/${geht.id}`)).status()).toBe(200);
  }
});
