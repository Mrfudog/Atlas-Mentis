/**
 * **Der Designer überdeckt keine Knöpfe** (T-433): öffnet die Leitung an
 * einem Artikel „Design this view" und den Reiter „Design", bleiben die
 * Knöpfe der Seite (Edit, Delete, die Leiste „Views") frei — am Telefon
 * stand der Kopf des Designers über ihnen (Rückmeldung 28.10., Session).
 */
import type { Locator } from '@playwright/test';
import { test, expect } from './hilfen';

/** Liegt die Mitte des Knopfs oben, oder deckt ihn etwas anderes zu? */
async function frei(knopf: Locator): Promise<string> {
  await knopf.scrollIntoViewIfNeeded();
  return knopf.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return oben && (oben === el || el.contains(oben)) ? 'frei' : `bedeckt von <${oben?.tagName.toLowerCase()} class="${oben?.className}">`;
  });
}

test('opening the view designer on an article leaves the page buttons reachable', async ({ leitung, api, eindeutig }, info) => {
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Harbour night'));
  await leitung.goto(`/artikel/${sitzung.id}`);
  await leitung.getByRole('button', { name: /Design this view/ }).click();
  /* Am Telefon steht der Designer im Reiter „Design". Nicht `isVisible()`
     fragen — das wartet nicht, und stand der Reiter noch nicht da, blieb der
     Designer im verborgenen Reiter (CI zu #462). */
  if (info.project.name === 'phone') await leitung.getByRole('tab', { name: /^Design/ }).click();
  await expect(leitung.getByText('New elements go into the selected container')).toBeVisible();
  await leitung.screenshot({ path: test.info().outputPath('designer.png') });

  for (const knopf of [
    leitung.getByRole('button', { name: 'Edit', exact: true }),
    leitung.getByRole('button', { name: 'Delete', exact: true }),
    leitung.locator('nw-ansichtswahl').getByRole('button').first(),
  ]) {
    expect(await frei(knopf)).toBe('frei');
  }
});
