/**
 * Nach Beziehungen (T-389): in einer Übersicht „Relations" öffnen, eine
 * Bedingung hinzufügen — Gegenstände mit Rasterform, Kreaturen in einer
 * Fraktion. Die Wahl steht in der Adresse (`f=@has:…`), gerechnet wird am
 * Server — also findet die Spielerin keine Mitgliedschaft in einer
 * Fraktion, die nur die Leitung sieht.
 *
 * Am Desktop schaut die Leitung, am Telefon die Spielerin.
 */
import { test, expect } from './hilfen';

test('filter by relations and fields: items with a grid shape, members of a faction', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const seite = telefon ? spielerin : leitung;
  const wort = eindeutig('Bz').replace(/\s+/g, '-');
  const fertig = { 'Status.status': 'ready' };
  const bogen = await api.anlegen('leitung', 'Item', `${wort} Bow`, { fields: { ...fertig, 'Item.rows': ['#', '#', '#'] } });
  const seil = await api.anlegen('leitung', 'Item', `${wort} Rope`, { fields: fertig });
  const zirkel = await api.anlegen('leitung', 'Faction', `${wort} Circle`, { fields: { ...fertig, 'Visibility.audience': 'gm' } });
  const ada = await api.anlegen('leitung', 'Creature', `${wort} Ada`, { fields: fertig, relations: [{ type: 'memberOf', to: zirkel.id }] });

  const filterKnopf = async () => {
    if (telefon) await seite.getByRole('button', { name: 'Filters' }).click();
  };
  const zu = async () => {
    if (telefon) await seite.getByRole('button', { name: 'Hide filters' }).click();
  };
  const filter = seite.getByRole('complementary', { name: 'Filters' });
  const bedingung = async (ref: string) => {
    await filter.getByText('Relations', { exact: true }).click();
    await filter.getByRole('combobox', { name: 'Relation or field' }).selectOption(ref);
    await filter.getByRole('combobox', { name: 'Condition' }).selectOption('has');
    await filter.getByRole('button', { name: 'Add', exact: true }).click();
  };

  /* Gegenstände mit Rasterform: ein Feld, keine Kante. */
  await seite.goto('/compendium?type=Item');
  await filterKnopf();
  await filter.getByRole('searchbox').fill(wort);
  await bedingung('Item.rows');
  await expect(seite).toHaveURL(/f=%40has%3AItem\.rows|f=@has:Item\.rows/);
  await zu();
  const tabelle = seite.getByRole('table');
  await expect(tabelle.getByText(bogen.name)).toBeVisible();
  await expect(tabelle.getByText(seil.name)).toHaveCount(0);

  /* Wieder weg mit ×: beide stehen da. */
  await filterKnopf();
  await filter.getByRole('button', { name: 'Remove Has Shape' }).click();
  await zu();
  await expect(tabelle.getByText(seil.name)).toBeVisible();

  /* Mitglied einer Fraktion: die Leitung sieht den Zirkel, die Spielerin nicht. */
  await seite.goto('/compendium?type=Creature');
  await filterKnopf();
  await filter.getByRole('searchbox').fill(wort);
  await bedingung('out.memberOf');
  await expect(seite).toHaveURL(/out\.memberOf/);
  if (telefon) {
    await zu();
    await expect(seite.getByText(ada.name)).toHaveCount(0);
  } else {
    await expect(filter.getByRole('combobox', { name: 'Target of member of' })).toContainText(zirkel.name);
    await filter.getByRole('combobox', { name: 'Target of member of' }).selectOption(zirkel.id);
    await expect(seite).toHaveURL(new RegExp(`memberOf(%3D|=)${zirkel.id}`));
    await expect(seite.getByRole('table').getByText(ada.name)).toBeVisible();
  }
});
