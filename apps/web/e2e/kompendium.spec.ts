/**
 * Kompendium (T-356, T-174, T-343): suchen, nach einem Feld filtern und
 * eine Spalte dazuwählen. Gerechnet wird am Server (`GET /api/list`); hier
 * zählt, dass die Seite das Gewählte zeigt.
 *
 * Die Spaltenwahl steht je Konto: am Desktop wählt die Leitung, am Telefon
 * die Spielerin — so ändern zwei parallele Projekte nie dieselbe Wahl.
 */
import { test, expect } from './hilfen';

test('search, a field filter and a chosen column', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const seite = telefon ? spielerin : leitung;
  const wort = eindeutig('Kp').replace(/\s+/g, '-');
  const muehle = await api.anlegen('leitung', 'Place', `${wort} Mill`, {
    fields: { 'Place.kind': 'Gebäude', 'Place.environment': 'river', 'Status.status': 'ready' },
  });
  const furt = await api.anlegen('leitung', 'Place', `${wort} Ford`, {
    fields: { 'Place.kind': 'Wildnis', 'Place.environment': 'marsh', 'Status.status': 'ready' },
  });

  await seite.goto('/compendium?type=Place');
  if (telefon) await seite.getByRole('button', { name: 'Filters' }).click();
  const filter = seite.getByRole('complementary', { name: 'Filters' });
  await filter.getByRole('searchbox').fill(wort);
  if (telefon) await seite.getByRole('button', { name: 'Hide filters' }).click();

  const zeilen = seite.getByRole('table');
  await expect(zeilen.getByText(muehle.name)).toBeVisible();
  await expect(zeilen.getByText(furt.name)).toBeVisible();

  if (telefon) await seite.getByRole('button', { name: 'Filters' }).click();
  /* Welche Facette offen steht, rechnet die Seite (gewählte und die
     ersten); zugeklappt wird sie über ihre Überschrift geöffnet. */
  const art = filter.locator('details', { has: seite.getByText('Place type', { exact: true }) });
  await expect(art).toBeVisible();
  const gebaeude = art.getByRole('checkbox', { name: /^Gebäude/ });
  if (!(await gebaeude.isVisible())) await art.getByText('Place type', { exact: true }).click();
  await gebaeude.check();
  if (telefon) await seite.getByRole('button', { name: 'Hide filters' }).click();
  await expect(zeilen.getByText(muehle.name)).toBeVisible();
  await expect(zeilen.getByText(furt.name)).toHaveCount(0);

  await seite.getByRole('button', { name: 'Columns' }).click();
  const wahl = seite.getByRole('dialog', { name: 'Columns' });
  await wahl.getByRole('searchbox').fill('Environment');
  const haken = wahl.getByRole('checkbox', { name: 'Environment' });
  if (!(await haken.isChecked())) await haken.check();
  /* Am Telefon zeigt die Tabelle nur Name und die erste Spalte
     (kompendium.scss) — also kommt die gewählte nach vorn. */
  const quelle = wahl.getByRole('button', { name: 'Remove Source' });
  if (await quelle.isVisible()) await quelle.click();
  await wahl.getByRole('button', { name: 'Apply' }).click();
  await expect(wahl).toBeHidden();
  await expect(zeilen.getByRole('columnheader', { name: /Environment/ })).toBeVisible();
  await expect(zeilen.getByRole('cell', { name: 'river' })).toBeVisible();

  /* Zurück auf die Vorgabe, damit der nächste Lauf nicht mit dieser Wahl beginnt. */
  await seite.getByRole('button', { name: 'Columns' }).click();
  await wahl.getByRole('button', { name: 'Reset to default' }).click();
});
