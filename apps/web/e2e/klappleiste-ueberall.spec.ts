/**
 * Die Klappleiste überall (T-359, REQ-361): in den Filtern von Kompendium
 * und Bereichen, auf der Artikelseite (Admin und Log, am Konto gemerkt) und
 * auf der Typseite des Registers (die geerbten Typen). Die Leiste ist die
 * aus T-220 (`klappleiste.spec.ts`); hier zählt, dass sie dort steht und
 * dort klappt.
 *
 * Am Telefon: die Filter sind ein Blatt, die Leiste steht darin (nicht
 * fest); auf der Artikelseite gibt es keine, weil die Kapitel dort Reiter
 * sind; im Register steht sie unten fest und klappt im gewählten Reiter.
 */
import { test, expect } from './hilfen';

test('compendium filters: collapse and expand every facet', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const seite = telefon ? spielerin : leitung;
  await api.anlegen('leitung', 'Place', eindeutig('Facet Mill'), {
    fields: { 'Place.kind': 'Gebäude', 'Place.environment': 'river', 'Status.status': 'ready' },
  });
  await seite.goto('/compendium?type=Place');
  if (telefon) await seite.getByRole('button', { name: 'Filters' }).click();
  const filter = seite.getByRole('complementary', { name: 'Filters' });
  const leiste = filter.getByRole('toolbar', { name: 'Filter sections' });
  await expect(leiste).toBeVisible();
  const facetten = filter.locator('details.facette[data-bereich]');
  await expect(facetten.first()).toBeVisible();
  /* Die Facetten kommen mit der Liste, nicht alle auf einmal. */
  await expect.poll(() => facetten.count()).toBeGreaterThanOrEqual(3);
  const zahl = await facetten.count();

  await leiste.getByRole('button', { name: 'Collapse all' }).click();
  for (let i = 0; i < zahl; i++) await expect(facetten.nth(i)).not.toHaveAttribute('open', '');
  await leiste.getByRole('button', { name: 'Expand all' }).click();
  for (let i = 0; i < zahl; i++) await expect(facetten.nth(i)).toHaveAttribute('open', '');
  await leiste.getByRole('button', { name: 'Next section' }).click();
  await expect(facetten.first().locator(':scope > summary')).toBeFocused();
});

test('article page: expand all opens Admin and Log, and the account remembers it', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const ort = await api.anlegen('leitung', 'Place', eindeutig('Chapter Mill'), { fields: { 'Status.status': 'ready' } });
  if (telefon) {
    /* Am Telefon sind die Kapitel Reiter — gesprungen wird dort nicht. */
    await spielerin.goto(`/artikel/${ort.id}`);
    await expect(spielerin.getByRole('heading', { name: ort.name })).toBeVisible();
    await expect(spielerin.getByRole('toolbar', { name: 'Article sections' })).toBeHidden();
    return;
  }
  await leitung.goto(`/artikel/${ort.id}`);
  const leiste = leitung.getByRole('toolbar', { name: 'Article sections' });
  await expect(leiste).toBeVisible();
  const admin = leitung.locator('#kapitel-admin');
  const log = leitung.locator('#kapitel-log');
  await expect(admin).toHaveAttribute('data-offen', 'false');

  await leiste.getByRole('button', { name: 'Expand all' }).click();
  await expect(admin).toHaveAttribute('data-offen', 'true');
  await expect(log).toHaveAttribute('data-offen', 'true');
  await leitung.waitForTimeout(600);
  await leitung.reload();
  await expect(leitung.locator('#kapitel-admin')).toHaveAttribute('data-offen', 'true');

  /* Zurück auf zu — der nächste Lauf soll wieder zugeklappt anfangen. */
  await leitung.getByRole('toolbar', { name: 'Article sections' }).getByRole('button', { name: 'Collapse all' }).click();
  await expect(leitung.locator('#kapitel-admin')).toHaveAttribute('data-offen', 'false');
  await leitung.waitForTimeout(600);
  await leitung.reload();
  await expect(leitung.locator('#kapitel-admin')).toHaveAttribute('data-offen', 'false');
});

test('registry type page: expand and collapse the inherited types', async ({ leitung }, info) => {
  const telefon = info.project.name === 'phone';
  await leitung.goto(`/registry?type=Place${telefon ? '&k=inherited' : ''}`);
  const leiste = leitung.getByRole('toolbar', { name: 'Type sections' });
  await expect(leiste).toBeVisible();
  const gruppen = leitung.locator('nw-kapitelteil#kapitel-inherited .teil[data-klappbar]');
  await expect(gruppen.first()).toBeVisible();
  const zahl = await gruppen.count();
  expect(zahl).toBeGreaterThanOrEqual(3);

  await leiste.getByRole('button', { name: 'Expand all' }).click();
  for (let i = 0; i < zahl; i++) await expect(gruppen.nth(i)).toHaveAttribute('data-offen', 'true');
  await expect(gruppen.first().locator('.partfields')).toBeVisible();
  await leiste.getByRole('button', { name: 'Collapse all' }).click();
  for (let i = 0; i < zahl; i++) await expect(gruppen.nth(i)).toHaveAttribute('data-offen', 'false');
});
