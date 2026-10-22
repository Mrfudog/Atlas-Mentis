/**
 * Jeder Artikel mit seiner Ebene auf der Kampagnenseite (T-387, REQ-368):
 * die Leitung sieht unter Visibility und Layers die Ebene je Artikel, setzt
 * die Sichtbarkeit einer Zeile und einer Auswahl; die Spielerin sieht den
 * Artikel danach nicht mehr bzw. wieder — gesiebt am Server. Die Liste
 * selbst bekommt die Spielerin nicht.
 */
import { test, expect } from './hilfen';

test('the GM sees each article with its layer and sets its visibility, one or several at once', async ({ leitung, spielerin, api, lauf, eindeutig }) => {
  const name = eindeutig('Watchtower');
  const turm = await api.anlegen('leitung', 'Place', name);
  const zweitName = eindeutig('Watchtower annex');
  const zweiter = await api.anlegen('leitung', 'Place', zweitName);
  /* Fertig, sonst sieht die Spielerin ihn ohnehin nicht (D72). */
  for (const a of [turm, zweiter]) await api.setzen('leitung', a.id, { Status: { status: 'ready' } });
  const sieht = async (id: string) => (await (await api.als('spielerin')).get(`/api/entities/${id}`)).status();
  expect(await sieht(turm.id)).toBe(200);

  await leitung.goto(`/campaign?c=${lauf.campaign.id}&tab=visibility`);
  const liste = leitung.locator('nw-kampagnen-artikel');
  await expect(liste.getByRole('heading', { name: 'Articles and their layers' })).toBeVisible();
  /* Nach dem eindeutigen Namen: im vollen Lauf tragen viele Artikel die Laufkennung, mehr als eine Seite. */
  const suche = liste.getByRole('searchbox', { name: 'Search by name' });
  await suche.fill(name);
  const zeile = liste.locator(`li[data-id="${turm.id}"]`);
  await expect(zeile).toBeVisible();
  /* Die Ebene der Kampagne steht in der Zeile. */
  await expect(zeile.locator('.ebenenmarke')).toContainText(lauf.campaign.name);

  /* Eine Zeile: GM — die Spielerin sieht ihn nicht mehr. */
  await zeile.getByRole('group', { name: `Visibility of ${name}` }).getByRole('button', { name: 'GM' }).click();
  await expect(liste.getByRole('status')).toContainText('1 changed');
  await expect(zeile.locator('.stufe')).toContainText('own setting');
  expect(await sieht(turm.id)).not.toBe(200);

  /* Eine Auswahl: beide auf Players — die Spielerin sieht beide. Die Auswahl bleibt über einen neuen Filter. */
  await zeile.getByRole('checkbox', { name: `Select ${name}` }).check();
  await suche.fill(zweitName);
  await liste.locator(`li[data-id="${zweiter.id}"]`).getByRole('checkbox', { name: `Select ${zweitName}` }).check();
  const massen = liste.getByRole('region', { name: 'Selected articles' });
  await expect(massen).toContainText('2 selected');
  await massen.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(liste.getByRole('status')).toContainText('2 changed');
  expect(await sieht(turm.id)).toBe(200);
  expect(await sieht(zweiter.id)).toBe(200);

  /* Unter Layers dieselbe Liste, nach Ebene gefiltert. */
  await leitung.goto(`/campaign?c=${lauf.campaign.id}&tab=layers`);
  const ebenen = leitung.locator('nw-kampagnen-artikel');
  await ebenen.getByRole('combobox', { name: 'Layer' }).selectOption(lauf.campaign.layer);
  await ebenen.getByRole('searchbox', { name: 'Search by name' }).fill(name);
  await expect(ebenen.locator(`li[data-id="${turm.id}"]`)).toBeVisible();

  /* Die Spielerin bekommt die Liste nicht, auch nicht über die API. */
  await spielerin.goto(`/campaign?c=${lauf.campaign.id}&tab=layers`);
  await expect(spielerin.locator('nw-kampagnen-artikel')).toHaveCount(0);
  expect((await (await api.als('spielerin')).get(`/api/campaigns/${lauf.campaign.id}/visibility/articles`)).status()).toBe(403);
});
