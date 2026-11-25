/**
 * Der Klappstand am Konto (T-441, REQ-361): Facetten in einem Bereich
 * (eine aus dem Register, „When & who") und die mit „Expand all" geöffneten Gruppen auf der Typseite
 * des Registers stehen nach dem Neuladen so, wie man sie liess.
 *
 * Der Stand gehört dem Konto: am Desktop prüft die Leitung, am Telefon die
 * Spielerin (Facetten) bzw. die Leitung an einer anderen Art (Register),
 * damit die beiden Projekte einander nichts umklappen.
 */
import { test, expect } from './hilfen';

test('facets stay as they were left after reloading', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const seite = telefon ? spielerin : leitung;
  /* Zwei Orte verschiedener Sorte, damit „Place type" etwas unterscheidet. */
  for (const [n, kind] of [['Remembered Mill', 'Gebäude'], ['Remembered Ford', 'Furt']] as const) {
    await api.anlegen('leitung', 'Place', eindeutig(n), { fields: { 'Place.kind': kind, 'Status.status': 'ready' } });
  }
  const oeffnen = async () => {
    await seite.goto('/world?type=Place');
    if (telefon) await seite.getByRole('button', { name: 'Filters' }).click();
    const filter = seite.getByRole('complementary', { name: 'Filters' });
    const facette = (t: string) =>
      filter.locator('details.facette[data-bereich]').filter({ has: seite.locator(':scope > summary', { hasText: t }) });
    const feld = facette('Place type');
    const wann = facette('When & who');
    await expect(feld).toBeVisible();
    await expect(wann).toBeVisible();
    return { feld, wann };
  };
  let f = await oeffnen();
  /* Vorgabe: die ersten Facetten offen, „When & who" zu. */
  await expect(f.feld).toHaveAttribute('open', '');
  await expect(f.wann).not.toHaveAttribute('open', '');
  await f.feld.locator(':scope > summary').click();
  await f.wann.locator(':scope > summary').click();
  await expect(f.feld).not.toHaveAttribute('open', '');
  await expect(f.wann).toHaveAttribute('open', '');
  await seite.waitForTimeout(600);

  f = await oeffnen();
  await expect(f.feld).not.toHaveAttribute('open', '');
  await expect(f.wann).toHaveAttribute('open', '');
  /* Aufräumen: zurück zur Vorgabe, für den nächsten Lauf. */
  await f.feld.locator(':scope > summary').click();
  await f.wann.locator(':scope > summary').click();
  await expect(f.feld).toHaveAttribute('open', '');
  await expect(f.wann).not.toHaveAttribute('open', '');
  await seite.waitForTimeout(600);
});

test('registry groups opened with Expand all stay open after reloading', async ({ leitung }, info) => {
  const telefon = info.project.name === 'phone';
  const typ = telefon ? 'Deity' : 'Faction';
  const adresse = `/registry?type=${typ}${telefon ? '&k=inherited' : ''}`;
  await leitung.goto(adresse);
  const leiste = leitung.getByRole('toolbar', { name: 'Type sections' });
  const gruppen = leitung.locator('nw-kapitelteil#kapitel-inherited .teil[data-klappbar]');
  await expect(gruppen.first()).toBeVisible();
  const zahl = await gruppen.count();
  await leiste.getByRole('button', { name: 'Expand all' }).click();
  for (let i = 0; i < zahl; i++) await expect(gruppen.nth(i)).toHaveAttribute('data-offen', 'true');
  await leitung.waitForTimeout(600);

  await leitung.reload();
  await expect(gruppen.first()).toBeVisible();
  for (let i = 0; i < zahl; i++) await expect(gruppen.nth(i)).toHaveAttribute('data-offen', 'true');

  /* Aufräumen. */
  await leiste.getByRole('button', { name: 'Collapse all' }).click();
  for (let i = 0; i < zahl; i++) await expect(gruppen.nth(i)).toHaveAttribute('data-offen', 'false');
  await leitung.waitForTimeout(600);
});
