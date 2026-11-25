/**
 * **Laden nach Kategorien** (T-425, REQ-439, E-175): die Leitung legt eine
 * Collection mit einer Regel (Marke) an und einen Laden, der sie verkauft
 * (`sells` → Collection). Unter „Wares" stehen ihre Mitglieder mit der
 * Herkunft „from …"; die Spielerin sieht den verborgenen Gegenstand nicht.
 */
import { test, expect } from './hilfen';

test('a shop that sells a collection lists its items, sieved for the player', async ({
  leitung,
  spielerin,
  api,
  eindeutig,
}) => {
  const fertig = { Status: { status: 'ready' } };
  const marke = eindeutig('e2e-ware')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  const sammlung = await api.anlegen('leitung', 'Collection', eindeutig('Forge stock'), {
    fields: { 'Collection.tags': [marke] },
  });
  const hammer = await api.anlegen('leitung', 'Item', eindeutig('Hammer'), {
    fields: { 'Tags.tags': [marke], 'Item.copperPrice': 100 },
  });
  const geheim = await api.anlegen('leitung', 'Item', eindeutig('Rune blade'), {
    fields: { 'Tags.tags': [marke], 'Item.copperPrice': 5000 },
  });
  const laden = await api.anlegen('leitung', 'Shop', eindeutig('The Anvil'), {
    relations: [
      { type: 'sells', to: sammlung.id, props: { mod: '-10%' } },
      { type: 'buys', to: sammlung.id, props: { rate: 40 } },
    ],
  });
  for (const a of [sammlung, hammer, geheim, laden]) await api.setzen('leitung', a.id, fertig);
  await api.setzen('leitung', geheim.id, { Visibility: { audience: 'gm' } });

  await leitung.goto(`/artikel/${laden.id}`);
  const waren = leitung.getByRole('region', { name: 'Wares' });
  await expect(waren.getByRole('link', { name: hammer.name, exact: true })).toBeVisible();
  await expect(waren.getByRole('link', { name: geheim.name, exact: true })).toBeVisible();
  await expect(waren.getByText(`from ${sammlung.name}`).first()).toBeVisible();
  /* Der Abschlag der Collection steht in der Herkunft. */
  await expect(waren.getByText(`collection ${sammlung.name}`).first()).toBeVisible();

  await spielerin.goto(`/artikel/${laden.id}`);
  const ihre = spielerin.getByRole('region', { name: 'Wares' });
  await expect(ihre.getByRole('link', { name: hammer.name, exact: true })).toBeVisible();
  await expect(ihre.getByRole('link', { name: geheim.name, exact: true })).toHaveCount(0);
});
