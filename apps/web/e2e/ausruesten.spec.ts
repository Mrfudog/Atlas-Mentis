/**
 * Ausrüsten in die Hände (T-244): die Spielerin legt eine Waffe aus dem
 * Raster in die Haupthand, einen Schild in die Nebenhand, bekommt beim
 * Verdrängen die Warnung, und „Your turn" sperrt das Zaubern mit Grund.
 * Die Leitung sieht dieselben Hände. Gegenstände, Zauber und Figur sind
 * eigene kleine Testartikel der Spielerin, keine Regelwerksdaten.
 */
import { test, expect } from './hilfen';
import type { Page } from '@playwright/test';

const keinSeitwaertsScroll = async (seite: Page) =>
  expect(await seite.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test('equip a weapon and a shield from the grid, displace, and see spellcasting blocked', async ({ leitung, spielerin, api, eindeutig }) => {
  /* Was sie selbst anlegt, sieht sie in jedem Stand; `ready` setzt die Leitung (D72). */
  const fertig = {};
  const rapier = await api.anlegen('spielerin', 'Weapon', eindeutig('Rapier'), {
    fields: { ...fertig, 'Item.itemType': 'melee weapon', 'Weapon.damage': '1d8' },
  });
  const dolch = await api.anlegen('spielerin', 'Weapon', eindeutig('Dagger'), {
    fields: { ...fertig, 'Item.itemType': 'melee weapon', 'Weapon.damage': '1d4' },
  });
  const schild = await api.anlegen('spielerin', 'Item', eindeutig('Shield'), { fields: { ...fertig, 'Item.itemType': 'shield' } });
  const zauber = await api.anlegen('spielerin', 'Spell', eindeutig('Spark'), {
    fields: { ...fertig, 'Spell.level': 0, 'Spell.components': ['v', 's'] },
  });
  const inventar = await api.anlegen('spielerin', 'Inventory', eindeutig('Pack'), {
    fields: fertig,
    relations: [
      { type: 'holds', to: rapier.id, props: { gx: 0, gy: 0, tier: 'pack' } },
      { type: 'holds', to: schild.id, props: { gx: 2, gy: 0, tier: 'pack' } },
      { type: 'holds', to: dolch.id, props: { gx: 4, gy: 0, tier: 'pack' } },
    ],
  });
  const figur = await api.anlegen('spielerin', 'PlayerCharacter', eindeutig('Rook'), {
    fields: fertig,
    relations: [
      { type: 'carries', to: inventar.id },
      { type: 'casts', to: zauber.id },
    ],
  });

  const s = spielerin;
  const haupt = s.locator('[data-hand="mainHand"]');
  const neben = s.locator('[data-hand="offHand"]');
  const zelle = (x: number) => s.locator(`.raster .zelle[data-x="${x}"][data-y="0"]`);

  await s.goto(`/artikel/${figur.id}?tab=gear`);
  await expect(s.getByRole('region', { name: 'Hands' })).toBeVisible();
  await expect(haupt).toContainText('free');

  /* Antippen, dann Platz: die Waffe in die Haupthand. */
  await zelle(0).click();
  await expect(s.getByRole('region', { name: 'Item' })).toContainText('Where it can go');
  await haupt.locator('.hstueck').click();
  await expect(haupt).toContainText(rapier.name);

  /* Der Schild nur in die Nebenhand — die Haupthand sagt warum nicht. */
  await zelle(2).click();
  await expect(s.getByRole('region', { name: 'Item' })).toContainText('a shield goes on the off hand');
  await neben.locator('.hstueck').click();
  await expect(neben).toContainText(schild.name);
  await expect(s.getByRole('region', { name: 'Hands' })).toContainText('Spellcasting blocked');

  /* Verdrängen: der Dolch in die Haupthand fragt zuerst. */
  await zelle(4).click();
  await haupt.locator('.hstueck').click();
  const warnung = s.getByRole('alertdialog', { name: 'Something has to move' });
  await expect(warnung).toBeVisible();
  await expect(warnung).toContainText(rapier.name);
  await warnung.getByRole('button', { name: /^Stow/ }).click();
  await expect(haupt).toContainText(dolch.name);
  /* Die Waffe liegt wieder im Raster. */
  await expect(s.locator(`.raster .zelle[aria-label*="${rapier.name}"]`).first()).toBeAttached();
  await keinSeitwaertsScroll(s);

  /* „Your turn": der Zauber gesperrt, mit Grund. */
  await s.goto(`/artikel/${figur.id}?tab=combat`);
  await expect(s.getByText(/🔒 shield without training/).first()).toBeVisible();
  await keinSeitwaertsScroll(s);

  /* Die Leitung sieht dieselben Hände. */
  await leitung.goto(`/artikel/${figur.id}?tab=gear`);
  await expect(leitung.locator('[data-hand="offHand"]')).toContainText(schild.name);
  await expect(leitung.locator('[data-hand="mainHand"]')).toContainText(dolch.name);
  await keinSeitwaertsScroll(leitung);
});
