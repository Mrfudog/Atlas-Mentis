/**
 * Behälter als eigene Bereiche auch ausserhalb des Gear (T-365, Nachtrag der
 * Leitung 22.10.): die Seite eines Inventars oder Behälters zeigt, was darin
 * an Behältern liegt, als zuklappbare Bereiche — nebeneinander am Desktop,
 * untereinander am Telefon —, mit der Ziehzeit durch den Behälter hindurch.
 * Eigene kleine Testartikel der Spielerin, keine Regelwerksdaten.
 */
import { test, expect } from './hilfen';
import type { Page } from '@playwright/test';

const keinSeitwaertsScroll = async (seite: Page) =>
  expect(await seite.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test('the page of a chest shows the pouch inside as its own box, named after the chest', async ({ spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const kerze = await api.anlegen('spielerin', 'Item', eindeutig('Candle'), { fields: { 'Item.itemType': 'adventuring gear' } });
  const innen = await api.anlegen('spielerin', 'Inventory', eindeutig('Pouch inside'), {
    relations: [{ type: 'holds', to: kerze.id, props: { gx: 0, gy: 0, tier: 'pack' } }],
  });
  const beutel = await api.anlegen('spielerin', 'Item', eindeutig('Pouch'), {
    fields: { 'Item.itemType': 'adventuring gear' },
    relations: [{ type: 'carries', to: innen.id }],
  });
  const truheInnen = await api.anlegen('spielerin', 'Inventory', eindeutig('Chest inside'), {
    relations: [{ type: 'holds', to: beutel.id, props: { gx: 0, gy: 0, tier: 'pack' } }],
  });
  await api.anlegen('spielerin', 'Item', eindeutig('Chest'), {
    fields: { 'Item.itemType': 'adventuring gear' },
    relations: [{ type: 'carries', to: truheInnen.id }],
  });

  const s = spielerin;
  await s.goto(`/artikel/${truheInnen.id}`);

  /* Der oberste Bereich heisst wie das Inventar, nicht „Carried": niemand trägt die Truhe. */
  const oben = s.getByRole('region', { name: truheInnen.name });
  await expect(oben).toBeVisible();
  await expect(oben).toContainText(beutel.name);
  await expect(s.getByRole('region', { name: 'Carried' })).toHaveCount(0);

  /* Der Beutel ist ein eigener Bereich mit der Kerze darin. Eine Ziehzeit gibt es hier nicht:
     niemand trägt die Truhe, also hat kein Feld eine Zone (die Rechnung prüft gear-ergaenzungen). */
  const bereich = s.getByRole('region', { name: beutel.name });
  await expect(bereich).toBeVisible();
  await expect(bereich).toContainText(kerze.name);

  if (telefon) {
    const o = await oben.boundingBox();
    const u = await bereich.boundingBox();
    expect(u!.y).toBeGreaterThan(o!.y + o!.height - 1);
  } else {
    /* Zuklappen nimmt den Inhalt weg und bleibt nach dem Neuladen. */
    await bereich.getByRole('button', { name: new RegExp(beutel.name) }).first().click();
    await expect(bereich).not.toContainText(kerze.name);
    await s.reload();
    await expect(s.getByRole('region', { name: beutel.name })).not.toContainText(kerze.name);
  }
  await keinSeitwaertsScroll(s);
});
