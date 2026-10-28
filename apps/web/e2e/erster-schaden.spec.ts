/**
 * T-371: der erste Schaden nach dem Öffnen des Bogens steht sofort in der
 * Anzeige, und der zweite rechnet vom neuen Stand — bei 1360 und 390 px.
 * Den Wettlauf selbst (ein Neuholen nach dem Speichern bekam das noch
 * laufende erste Laden zurück) stellt `oeffnen-neu.test.ts` nach; hier
 * lässt er sich nicht verlässlich erzwingen, weil der Kopf erst mit den
 * Rückbezügen (Statblock) erscheint.
 */
import { test, expect } from './hilfen';

test('the first damage right after opening the sheet shows at once', async ({ leitung, api, eindeutig }) => {
  const bereit = { 'Status.status': 'ready' };
  const figur = await api.anlegen('leitung', 'PlayerCharacter', eindeutig('Barbar'), { fields: { ...bereit, 'Vitals.hp': 34 } });
  await api.anlegen('leitung', 'Statblock', eindeutig('Barbar stats'), {
    fields: { ...bereit, 'Statblock.ac': 14, 'Statblock.hp': 34, 'Statblock.speed': '30 ft.' },
    relations: [{ type: 'belongsTo', to: figur.id }],
  });
  await leitung.goto(`/artikel/${figur.id}`);
  /* Am Telefon steht der Kopf eingeklappt: „34 /34" und „− Dmg". */
  const hp = leitung.locator('nw-bogen').locator('.hpwert b, .khp b').first();
  const schaden = leitung.locator('nw-bogen button.dmg').first();
  await expect(hp).toHaveText('34');
  await leitung.locator('nw-bogen').getByLabel('Amount').first().fill('4');
  await schaden.click();
  await expect(hp).toHaveText('30', { timeout: 3000 });
  /* Und der nächste rechnet vom neuen Stand. */
  await schaden.click();
  await expect(hp).toHaveText('26');
});
