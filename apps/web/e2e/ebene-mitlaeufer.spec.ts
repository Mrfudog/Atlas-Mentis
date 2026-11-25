/**
 * Ebene wechseln mit Mitläufern (T-402, E-161 a+c): im Bearbeiten fragt
 * vor dem Speichern eine Liste, was mitgeht — ein Teil aus derselben
 * Ebene ist vorgewählt und geht mit; „Undo move" bringt es zurück.
 */
import { test, expect } from './hilfen';

test('moving an article asks what goes along, and takes the ticked part with it', async ({ leitung, api, lauf, eindeutig }) => {
  const haus = await api.anlegen('spielerin', 'Place', eindeutig('House'));
  const zimmer = await api.anlegen('spielerin', 'Place', eindeutig('Room'), { relations: [{ type: 'partOf', to: haus.id }] });
  const ebeneVon = async (id: string) => {
    const e = (await (await (await api.als('leitung')).get(`/api/entities/${id}`)).json()) as { relations?: { type: string; to: string }[] };
    return (e.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => r.to);
  };
  const vorher = await ebeneVon(zimmer.id);

  await leitung.goto(`/artikel/${haus.id}`);
  await leitung.getByRole('button', { name: 'Edit', exact: true }).click();
  await leitung.locator('.maske > label').first().getByRole('combobox').selectOption(lauf.campaign.layer);
  await leitung.getByRole('button', { name: 'Save', exact: true }).click();

  const liste = leitung.getByRole('dialog', { name: /what goes along/ });
  await expect(liste).toBeVisible();
  const zeile = liste.locator(`li[data-id="${zimmer.id}"]`);
  await expect(zeile).toContainText('part of');
  await expect(zeile.getByRole('checkbox')).toBeChecked();
  /* Nichts steht über den Rand, auch nicht auf dem Telefon. */
  const breite = await leitung.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(breite).toBeLessThanOrEqual(1);

  await liste.getByRole('button', { name: 'Move with 1 more' }).click();
  await expect(leitung.getByRole('status').filter({ hasText: 'with 1 more' })).toBeVisible();
  expect(await ebeneVon(haus.id)).toEqual([lauf.campaign.layer]);
  expect(await ebeneVon(zimmer.id)).toEqual([lauf.campaign.layer]);

  await leitung.getByRole('button', { name: 'Undo move' }).click();
  await expect(leitung.getByRole('status').filter({ hasText: 'back' })).toBeVisible();
  expect(await ebeneVon(zimmer.id)).toEqual(vorher);
});

test('a selection on the campaign page moves with what goes along, and undo takes it back', async ({ leitung, api, lauf, eindeutig }) => {
  const name = eindeutig('Tower');
  const turm = await api.anlegen('spielerin', 'Place', name);
  const keller = await api.anlegen('spielerin', 'Place', eindeutig('Cellar'), { relations: [{ type: 'partOf', to: turm.id }] });
  const ebeneVon = async (id: string) => {
    const e = (await (await (await api.als('leitung')).get(`/api/entities/${id}`)).json()) as { relations?: { type: string; to: string }[] };
    return (e.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => r.to);
  };
  const vorher = await ebeneVon(turm.id);

  await leitung.goto(`/campaign?c=${lauf.campaign.id}&tab=layers`);
  const liste = leitung.locator('nw-kampagnen-artikel');
  await liste.getByRole('searchbox', { name: 'Search by name' }).fill(name);
  await liste.locator(`li[data-id="${turm.id}"]`).getByRole('checkbox', { name: `Select ${name}` }).check();
  const massen = liste.getByRole('region', { name: 'Selected articles' });
  await massen.getByRole('combobox', { name: 'Move the selection to layer' }).selectOption(lauf.campaign.layer);
  await massen.getByRole('button', { name: 'Move…' }).click();

  const plan = liste.getByRole('dialog', { name: /what goes along/ });
  await expect(plan.locator(`li[data-id="${keller.id}"]`).getByRole('checkbox')).toBeChecked();
  await plan.getByRole('button', { name: 'Move with 1 more' }).click();
  await expect(liste.getByRole('status').filter({ hasText: '2 moved' })).toBeVisible();
  expect(await ebeneVon(keller.id)).toEqual([lauf.campaign.layer]);

  await liste.getByRole('button', { name: 'Undo move' }).click();
  await expect(liste.getByRole('status').filter({ hasText: 'Move undone' })).toBeVisible();
  expect(await ebeneVon(turm.id)).toEqual(vorher);
  expect(await ebeneVon(keller.id)).toEqual(vorher);
});
