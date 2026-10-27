/**
 * **Collection als Artikel** (T-425, REQ-438, E-174): die Leitung legt eine
 * Collection mit einer Regel (Marke) an; die Gegenstände mit der Marke
 * stehen auf ihrer Seite unter „Members", einer von Hand dazu, einer per
 * `exclude` heraus. Die Spielerin sieht den geheimen nicht.
 */
import { test, expect } from './hilfen';

test('a collection lists its members by rule and by hand, sieved for the player', async ({
  leitung,
  spielerin,
  api,
  eindeutig,
}) => {
  const fertig = { Status: { status: 'ready' } };
  const marke = eindeutig('e2e-set')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  const sammlung = await api.anlegen('leitung', 'Collection', eindeutig('Camp gear'), {
    fields: { 'Collection.tags': [marke] },
  });
  const seil = await api.anlegen('leitung', 'Item', eindeutig('Rope'), {
    fields: { 'Tags.tags': [marke] },
  });
  const geheim = await api.anlegen('leitung', 'Item', eindeutig('Hidden map'), {
    fields: { 'Tags.tags': [marke] },
  });
  const fackel = await api.anlegen('leitung', 'Item', eindeutig('Torch'), {
    relations: [{ type: 'inCollection', to: sammlung.id }],
  });
  const kette = await api.anlegen('leitung', 'Item', eindeutig('Chain'), {
    fields: { 'Tags.tags': [marke] },
    relations: [{ type: 'inCollection', to: sammlung.id, props: { exclude: true } }],
  });
  for (const a of [sammlung, seil, geheim, fackel, kette])
    await api.setzen('leitung', a.id, fertig);
  await api.setzen('leitung', geheim.id, { Visibility: { audience: 'gm' } });

  await leitung.goto(`/artikel/${sammlung.id}`);
  const mitglieder = leitung.getByRole('region', { name: 'Members' });
  for (const a of [seil, geheim, fackel])
    await expect(mitglieder.getByRole('link', { name: a.name, exact: true })).toBeVisible();
  await expect(mitglieder.getByRole('link', { name: kette.name, exact: true })).toHaveCount(0);

  await spielerin.goto(`/artikel/${sammlung.id}`);
  const ihre = spielerin.getByRole('region', { name: 'Members' });
  await expect(ihre.getByRole('link', { name: seil.name, exact: true })).toBeVisible();
  await expect(ihre.getByRole('link', { name: fackel.name, exact: true })).toBeVisible();
  await expect(ihre.getByRole('link', { name: geheim.name, exact: true })).toHaveCount(0);
});
