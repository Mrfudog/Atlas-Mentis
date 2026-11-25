/**
 * Wann und von wem (T-382): in einer Übersicht nach „Added", „Added by"
 * filtern und nach dem Hinzufügen sortieren. Die Wahl steht in der Adresse
 * (`f=@added:today`), gerechnet wird am Server — also sieht die Spielerin
 * unter „Added by" nur, was sie sieht.
 *
 * Am Desktop schaut die Leitung, am Telefon die Spielerin; angelegt haben
 * beide, je mit eigenem Namen.
 */
import { test, expect } from './hilfen';
import { KONTEN } from './stand';

test('filter by added today and by who added it, newest first', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const seite = telefon ? spielerin : leitung;
  const wort = eindeutig('Wz').replace(/\s+/g, '-');
  const vonLeitung = await api.anlegen('leitung', 'Place', `${wort} Tower`, { fields: { 'Status.status': 'ready' } });
  const vonSpielerin = await api.anlegen('spielerin', 'Place', `${wort} Camp`);

  await seite.goto('/compendium?type=Place');
  const filterKnopf = async () => {
    if (telefon) await seite.getByRole('button', { name: 'Filters' }).click();
  };
  const zu = async () => {
    if (telefon) await seite.getByRole('button', { name: 'Hide filters' }).click();
  };
  await filterKnopf();
  const filter = seite.getByRole('complementary', { name: 'Filters' });
  await filter.getByRole('searchbox').fill(wort);
  await filter.getByText('When & who', { exact: true }).click();
  await filter.getByRole('combobox', { name: 'Added', exact: true }).selectOption('today');
  await expect(seite).toHaveURL(/f=%40added%3Atoday|f=@added:today/);
  await filter.getByRole('combobox', { name: 'Sort by' }).selectOption('-created');
  await zu();

  const tabelle = seite.getByRole('table');
  await expect(tabelle.getByText(vonLeitung.name)).toBeVisible();
  await expect(tabelle.getByText(vonSpielerin.name)).toBeVisible();
  /* Neueste zuerst: was die Spielerin danach anlegte, steht oben. */
  await expect(tabelle.locator('tbody tr').first()).toContainText(vonSpielerin.name);

  await filterKnopf();
  await filter.getByRole('checkbox', { name: KONTEN.leitung }).check();
  await zu();
  await expect(tabelle.getByText(vonLeitung.name)).toBeVisible();
  await expect(tabelle.getByText(vonSpielerin.name)).toHaveCount(0);

  /* Ein Zeitraum in der Vergangenheit lässt beide weg. */
  await filterKnopf();
  await filter.getByRole('checkbox', { name: KONTEN.leitung }).uncheck();
  await filter.getByRole('combobox', { name: 'Added', exact: true }).selectOption('custom');
  await filter.getByLabel('Added to').fill('2020-01-01');
  await zu();
  await expect(tabelle.getByText(vonLeitung.name)).toHaveCount(0);
  await expect(seite.getByText(vonSpielerin.name)).toHaveCount(0);
});
