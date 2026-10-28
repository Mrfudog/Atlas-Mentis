/**
 * T-443: nach einem Schaden fragt der Bogen die Übungen nicht neu ab. Auf
 * dev feuerte er nach jedem Neuholen je Übung eine Liste am Server, und
 * Speichern und Neuholen standen dahinter an (T-371 auf dev: über 100 s).
 */
import { test, expect } from './hilfen';

test('damage does not look the proficiencies up again', async ({ leitung, api, eindeutig }) => {
  const bereit = { 'Status.status': 'ready' };
  const figur = await api.anlegen('leitung', 'PlayerCharacter', eindeutig('Brakka'), { fields: { ...bereit, 'Vitals.hp': 31 } });
  await api.anlegen('leitung', 'Statblock', eindeutig('Brakka stats'), {
    fields: {
      ...bereit,
      'Statblock.ac': 14,
      'Statblock.hp': 34,
      'Statblock.speed': '30 ft.',
      'Proficiencies.proficient': ['Athletics', 'Nature', "Smith's Tools"],
    },
    relations: [{ type: 'belongsTo', to: figur.id }],
  });
  await leitung.goto(`/artikel/${figur.id}`);
  const hp = leitung.locator('nw-bogen').locator('.hpwert b, .khp b').first();
  await expect(hp).toHaveText('31');
  /* Was beim Öffnen nachgeschlagen wird, ist da; ab jetzt zählt jede Liste. */
  await leitung.waitForLoadState('networkidle');
  const listen: string[] = [];
  leitung.on('request', (r) => {
    if (r.url().includes('/api/list?')) listen.push(r.url());
  });
  await leitung.locator('nw-bogen').getByLabel('Amount').first().fill('4');
  await leitung.locator('nw-bogen button.dmg').first().click();
  await expect(hp).toHaveText('27');
  await leitung.waitForLoadState('networkidle');
  expect(listen.filter((u) => /q=(Athletics|Nature|Smith)/.test(decodeURIComponent(u)))).toEqual([]);
});
