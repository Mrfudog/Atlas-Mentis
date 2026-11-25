/**
 * **Würfe aus dem Statblock** (T-181, REQ-070): Rettungswurf und
 * Attributsprobe sind Würfelknöpfe; der Server würfelt, und das Log nennt,
 * was gewürfelt wurde („DEX save", „DEX check"). Erfundener Statblock,
 * keine Regelwerksdaten.
 */
import { test, expect } from './hilfen';

test('a statblock rolls its saves and ability checks into the log', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const seite = info.project.name === 'phone' ? spielerin : leitung;
  const sb = await api.anlegen('leitung', 'Statblock', eindeutig('Marsh lurker stats'), {
    fields: {
      'Status.status': 'ready',
      'Statblock.prof': 2,
      'Abilities.dex': 14,
      'Abilities.str': 10,
      'Proficiencies.saves': ['dex'],
    },
  });

  await seite.goto(`/artikel/${sb.id}`);
  const saves = seite.locator('p', { hasText: 'Saving Throws' });
  await expect(saves).toContainText('Dex');
  await saves.getByRole('button', { name: '+4' }).click();
  await expect(saves.locator('output.ergebnis')).toHaveText(/\d+/);

  /* Die Probe am Attribut: DEX 14 (+2). */
  await seite.getByRole('listitem').filter({ hasText: 'DEX' }).getByRole('button', { name: '+2' }).click();

  /* Das Log ist ein Kapitel der Artikelseite (T-277): am Telefon ein
     Reiter, am Desktop ein zugeklappter Abschnitt. */
  if (info.project.name === 'phone') await seite.getByRole('tab', { name: 'Log' }).click();
  else await seite.getByRole('region', { name: 'Log' }).getByRole('button', { name: 'Log' }).click();
  const log = seite.locator('nw-wuerfe');
  await expect(log).toContainText('DEX save');
  await expect(log).toContainText('DEX check');
});
