/**
 * **Begegnungen Teil 3** (T-215, REQ-085): ein Gespräch zeigt, wer
 * beteiligt ist und was er von der Gruppe hält; die Leitung gibt einen
 * Hinweis mit einem Klick frei, und die Spielerin liest genau diesen.
 * Erfundene Artikel, keine Regelwerksdaten.
 */
import { test, expect } from './hilfen';

test('an encounter shows who stands where, and the GM reveals one hint with a click', async ({ verwaltung, spielerin, api, lauf, eindeutig }) => {
  const gruppe = `pt_${lauf.campaign.id}`;
  const vogt = await api.anlegen('leitung', 'Creature', eindeutig('Reeve Ansel'), {
    fields: { 'Status.status': 'ready' },
    relations: [{ type: 'regards', to: gruppe, props: { tags: ['distrusts'], note: 'They broke the toll gate' } }],
  });
  const begegnung = await api.anlegen('leitung', 'Encounter', eindeutig('At the toll gate'), {
    fields: {
      'Status.status': 'ready',
      'Encounter.kind': ['social', 'puzzle'],
    },
    relations: [{ type: 'features', to: vogt.id }],
  });
  /* Je Hinweis ein Eintrag mit eigener Id — an ihr hängt die Freigabe. */
  await api.setzen('verwaltung', begegnung.id, {
    Encounter: {
      hint: [
        { id: 'h-ledger', value: 'The reeve keeps a ledger.' },
        { id: 'h-seal', value: 'The seal on the writ is forged.' },
      ],
    },
  });

  /* Freigegeben wird als Verwaltung: eine Leitung ohne eigene Figur
     bekommt die Hinweise ihrer Runde heute nicht (T-447, E-204). */
  const leitung = verwaltung;
  await leitung.goto(`/artikel/${begegnung.id}`);
  const stand = leitung.locator('nw-haltung');
  await expect(stand).toContainText('Who stands where');
  await expect(stand).toContainText(vogt.name);
  await expect(stand).toContainText('distrusts');
  await expect(stand).toContainText('They broke the toll gate');

  /* Der zweite Hinweis, und nur er. */
  const zweiter = leitung.locator('section.block', { hasText: 'The seal on the writ is forged.' });
  await zweiter.getByRole('button', { name: 'Reveal to the party' }).click();
  await expect(zweiter).toContainText('The party knows this hint');
  await expect(leitung.locator('section.block', { hasText: 'The reeve keeps a ledger.' }).getByRole('button', { name: 'Reveal to the party' })).toBeVisible();

  await spielerin.goto(`/artikel/${begegnung.id}`);
  await expect(spielerin.getByText('The seal on the writ is forged.')).toBeVisible();
  await expect(spielerin.getByText('The reeve keeps a ledger.')).toHaveCount(0);
  await expect(spielerin.getByRole('button', { name: 'Reveal to the party' })).toHaveCount(0);
  await expect(spielerin.locator('nw-haltung')).toContainText(vogt.name);
});
