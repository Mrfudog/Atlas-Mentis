/**
 * Gegenstandsmerkmale (T-324, E-163): was eine Eigenschaft am Bogen
 * bewirkt, steht in ihren Daten (`ItemFeature.mechanics`), nicht in ihrem
 * Namen. Eine Hausregel-Eigenschaft „Long Grip" mit der Wirkung
 * „two-handed" sperrt die Nebenhand wie Two-Handed — vorher fragte der
 * Bogen den Namen und hätte sie übersehen. Und ein Enhancement ist ein
 * Regelartikel unter Rules, kein Gegenstand.
 */
import { test, expect } from './hilfen';
import type { Page } from '@playwright/test';

const keinSeitwaertsScroll = async (seite: Page) =>
  expect(await seite.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test('a house property is two-handed by its data, not its name', async ({ spielerin, api, eindeutig }) => {
  const griff = await api.anlegen('spielerin', 'ItemProperty', eindeutig('Long Grip'), {
    fields: { 'ItemFeature.mechanics': ['two-handed'] },
  });
  const stange = await api.anlegen('spielerin', 'Weapon', eindeutig('Pike Staff'), {
    fields: { 'Item.itemType': 'melee weapon', 'Weapon.damage': '1d10' },
    relations: [{ type: 'hasProperty', to: griff.id }],
  });
  const inventar = await api.anlegen('spielerin', 'Inventory', eindeutig('Pack'), {
    relations: [{ type: 'holds', to: stange.id, props: { gx: 0, gy: 0, tier: 'pack' } }],
  });
  const figur = await api.anlegen('spielerin', 'PlayerCharacter', eindeutig('Rook'), {
    relations: [{ type: 'carries', to: inventar.id }],
  });

  const s = spielerin;
  await s.goto(`/artikel/${figur.id}?tab=gear`);
  await expect(s.getByRole('region', { name: 'Hands' })).toBeVisible();
  await s.locator('.raster .zelle[data-x="0"][data-y="0"]').click();
  /* Die Nebenhand sagt, warum nicht — aus der Wirkung, nicht dem Namen. */
  await expect(s.getByRole('region', { name: 'Item' })).toContainText('two-handed — it takes both hands');
  await keinSeitwaertsScroll(s);
});

test('an enhancement is a rules article with its own fields', async ({ leitung, api, eindeutig }) => {
  const plus = await api.anlegen('leitung', 'Enhancement', eindeutig('+3 Weapon'), {
    fields: { 'ItemFeature.appliesTo': ['weapon'], 'ItemFeature.namePrefix': '+3 ', 'Enhancement.rarity': 'very rare', 'Enhancement.bonusWeapon': 3 },
  });
  await leitung.goto(`/artikel/${plus.id}`);
  await expect(leitung.getByRole('heading', { name: plus.name }).first()).toBeVisible();
  await expect(leitung.getByText('very rare').first()).toBeVisible();
  await keinSeitwaertsScroll(leitung);
});
