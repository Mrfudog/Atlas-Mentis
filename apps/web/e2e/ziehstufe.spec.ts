/**
 * Ziehstufe und Handaktionen (T-350, REQ-216, REQ-225): was am Gurt hängt,
 * zieht man als freie Aktion; was in dem Beutel am Gurt liegt, eine Stufe
 * langsamer. Die Hände sagen, was Verstauen und Fallenlassen kosten — aus
 * der Einstellung `handActions`, nicht aus einem festen Text. Eigene kleine
 * Testartikel der Spielerin, keine Regelwerksdaten.
 */
import { test, expect } from './hilfen';
import type { Page } from '@playwright/test';

const keinSeitwaertsScroll = async (seite: Page) =>
  expect(await seite.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test('a pouch on the belt draws as a free action, what is inside one step slower; hands name their costs', async ({ spielerin, api, eindeutig }) => {
  const seil = await api.anlegen('spielerin', 'Item', eindeutig('Rope'), { fields: { 'Item.itemType': 'adventuring gear' } });
  const innen = await api.anlegen('spielerin', 'Inventory', eindeutig('Pouch inside'), {
    relations: [{ type: 'holds', to: seil.id, props: { tier: 'pack' } }],
  });
  const beutel = await api.anlegen('spielerin', 'Item', eindeutig('Pouch'), {
    fields: { 'Item.itemType': 'adventuring gear' },
    relations: [{ type: 'carries', to: innen.id }],
  });
  const pack = await api.anlegen('spielerin', 'Inventory', eindeutig('Gear'), {
    relations: [{ type: 'holds', to: beutel.id, props: { tier: 'worn', slot: 'belt' } }],
  });
  const figur = await api.anlegen('spielerin', 'PlayerCharacter', eindeutig('Rook'), {
    relations: [{ type: 'carries', to: pack.id }],
  });

  const s = spielerin;
  await s.goto(`/artikel/${figur.id}?tab=gear`);
  const zeile = s.locator('ul.posten > li').filter({ hasText: beutel.name }).first();
  await expect(zeile).toContainText('free action to draw');

  /* Der Beutel steht im Gear als eigener Bereich (T-365, E-153 V7): das Seil darin ist eine Stufe weiter weg. */
  const seilZeile = s.getByRole('region', { name: beutel.name }).locator('ul.posten > li').filter({ hasText: seil.name }).first();
  await expect(seilZeile).toContainText('bonus action to draw');

  /* Die Hände: was Verstauen und Fallenlassen kosten, aus `handActions`. */
  await expect(s.locator('[data-hand="mainHand"] .hlbl')).toContainText('stow: bonus action · drop: free action');
  await keinSeitwaertsScroll(s);
});
