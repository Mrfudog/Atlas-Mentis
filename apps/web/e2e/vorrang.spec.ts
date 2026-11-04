/**
 * Vorrang an der Kampagne (T-403, E-111 a): zwei Fassungen derselben Sache
 * aus zwei Ebenen im Spiel — die Liste der Kampagnenseite sagt, welche
 * gezeigt wird, und „Prefer this version" zieht die andere nach vorn. Unter
 * Order in play steht eine Ebene für eine Art vorn und geht wieder weg.
 */
import { test, expect } from './hilfen';

test('the GM prefers a version in the campaign list, and puts a layer first for a type', async ({ leitung, api, lauf, eindeutig }, info) => {
  /* Nicht Place: ein Vorrang für Orte änderte nebenher, welche der beiden
     Fassungen oben gezeigt wird. Vor dem Laden angelegt, denn die Arten der
     Auswahl kommen aus dem Inhalt der Ebenen. */
  const art = 'Faction';
  await api.anlegen('leitung', art, eindeutig('Something'));
  const name = eindeutig('Old well');
  const eins = await api.anlegen('leitung', 'Place', name);
  const zwei = await api.anlegen('spielerin', 'Place', name, { relations: [{ type: 'variantOf', to: eins.id }] });

  await leitung.goto(`/campaign?c=${lauf.campaign.id}&tab=layers`);
  const liste = leitung.locator('nw-kampagnen-artikel');
  await liste.getByRole('searchbox', { name: 'Search by name' }).fill(name);
  const zeilen = [liste.locator(`li[data-id="${eins.id}"]`), liste.locator(`li[data-id="${zwei.id}"]`)];
  for (const z of zeilen) await expect(z).toContainText('2 versions');
  /* Die nicht gezeigte bekommt den Knopf. */
  const ohne = (await zeilen[0]!.getByRole('button', { name: 'Prefer this version' }).count()) ? zeilen[0]! : zeilen[1]!;
  const mit = ohne === zeilen[0] ? zeilen[1]! : zeilen[0]!;
  await expect(mit).toContainText('shown in lists');
  await ohne.getByRole('button', { name: 'Prefer this version' }).click();
  await expect(liste.getByRole('status')).toContainText('Preferred');
  await expect(ohne).toContainText('preferred');
  await expect(mit.getByRole('button', { name: 'Prefer this version' })).toBeVisible();
  const breite = await leitung.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(breite).toBeLessThanOrEqual(1);
  await ohne.getByRole('button', { name: 'Stop preferring' }).click();
  await expect(liste.getByRole('status')).toContainText('No longer preferred');

  /* Je Art: eine Ebene vorn, und wieder weg. Desktop und Telefon teilen die
     Kampagne, und beide schrieben dieselbe Kante — gesetzt wird nur am
     Desktop, das Telefon sieht die Auswahl. */
  /* Dieselbe Liste steht auch im Popup der Kopfleiste — gemeint ist die sichtbare. */
  /* Ob „Order in play" offen steht, merkt sich das Konto — und klappleiste.spec
     klappt nebenher bei derselben Leitung alles zu. Also selbst aufklappen. */
  const folge = leitung.locator('nw-kampagnen-ebenen details[data-bereich]', { hasText: 'Order in play' }).filter({ visible: true }).first();
  if ((await folge.getAttribute('open')) === null) await folge.locator(':scope > summary').click();
  await expect(folge).toHaveAttribute('open', '');
  const vorrang = leitung.getByLabel('First for some types').filter({ visible: true });
  await expect(vorrang.getByRole('button', { name: 'Put first' })).toBeVisible();
  if (info.project.name !== 'desktop') return;
  await vorrang.getByRole('combobox', { name: 'Type', exact: true }).selectOption(art);
  await vorrang.getByRole('combobox', { name: 'Layer first for that type' }).selectOption(lauf.campaign.layer);
  await vorrang.getByRole('button', { name: 'Put first' }).click();
  const eintrag = vorrang.getByRole('listitem').filter({ hasText: `${art}:` });
  await expect(eintrag).toContainText('first');
  await eintrag.getByRole('button').click();
  await expect(vorrang.getByRole('listitem').filter({ hasText: `${art}:` })).toHaveCount(0);
});
