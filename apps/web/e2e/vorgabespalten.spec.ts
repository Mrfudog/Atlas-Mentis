/**
 * Vorgabespalten der Übersicht (T-344): Arten, deren `overview` nichts
 * sagte, zeigten in Kompendium und Bereichen nur Name und Beschreibung.
 * Jetzt bringt die Art ihre Spalten mit — ein Auftrag Stand und Lohn, eine
 * Fraktion ihre Art —, ohne dass jemand eine Spalte wählt.
 *
 * Am Telefon zeigt die Tabelle Name und die erste Spalte (kompendium.scss);
 * also steht dort die erste Vorgabespalte.
 */
import { test, expect } from './hilfen';

test('a quest list shows progress and reward without choosing columns', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const seite = telefon ? spielerin : leitung;
  const wort = eindeutig('Vs').replace(/\s+/g, '-');
  const auftrag = await api.anlegen('leitung', 'Quest', `${wort} Lost Bell`, {
    fields: { 'Quest.progress': 'accepted', 'Quest.reward': '40 gp', 'Status.status': 'ready' },
  });

  await seite.goto('/compendium?type=Quest');
  if (telefon) await seite.getByRole('button', { name: 'Filters' }).click();
  await seite.getByRole('complementary', { name: 'Filters' }).getByRole('searchbox').fill(wort);
  if (telefon) await seite.getByRole('button', { name: 'Hide filters' }).click();

  const tabelle = seite.getByRole('table');
  const zeile = tabelle.getByRole('row', { name: new RegExp(auftrag.name) });
  await expect(zeile).toBeVisible();
  await expect(tabelle.getByRole('columnheader', { name: /Progress/ })).toBeVisible();
  await expect(zeile.getByRole('cell', { name: 'accepted' })).toBeVisible();
  if (!telefon) {
    await expect(tabelle.getByRole('columnheader', { name: /Reward/ })).toBeVisible();
    await expect(zeile.getByRole('cell', { name: '40 gp' })).toBeVisible();
  }
});

test('a faction list shows its kind', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const seite = telefon ? spielerin : leitung;
  const wort = eindeutig('Vf').replace(/\s+/g, '-');
  const gilde = await api.anlegen('leitung', 'Faction', `${wort} Lamplighters`, {
    fields: { 'Faction.kind': 'guild', 'Status.status': 'ready' },
  });

  await seite.goto('/compendium?type=Faction');
  if (telefon) await seite.getByRole('button', { name: 'Filters' }).click();
  await seite.getByRole('complementary', { name: 'Filters' }).getByRole('searchbox').fill(wort);
  if (telefon) await seite.getByRole('button', { name: 'Hide filters' }).click();

  const tabelle = seite.getByRole('table');
  const zeile = tabelle.getByRole('row', { name: new RegExp(gilde.name) });
  await expect(tabelle.getByRole('columnheader', { name: /Kind/ })).toBeVisible();
  await expect(zeile.getByRole('cell', { name: 'guild' })).toBeVisible();
});
