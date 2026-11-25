/**
 * Initiative (T-356, T-203, T-334): die Leitung startet eine Begegnung,
 * die Spielerin beendet ihren eigenen Zug, die Leitung gibt weiter. Wer
 * dran ist, rechnet der Server; die Spielerin bekommt „End turn" nur,
 * wenn ihre Figur (`app_user_actor`) dran ist.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './hilfen';

/**
 * Die Initiative auf dem Play-Schirm: neben der Karte als Panel (auf- und
 * zuklappbar über die Leiste, am Telefon zu), ohne Karte darüber. Gewartet
 * wird, bis eines von beiden da ist — nicht eine feste Zeit.
 */
async function initiative(seite: Page) {
  const panel = seite.getByRole('region', { name: 'Initiative' });
  const knopf = seite.getByRole('button', { name: 'Initiative', exact: true });
  await expect(panel.or(knopf).first()).toBeVisible();
  if (!(await panel.isVisible())) await knopf.click();
  await expect(panel).toBeVisible();
  return panel;
}

test('start, the player ends her turn, the GM moves on', async ({ leitung, spielerin, api, eindeutig, lauf }) => {
  const ork = await api.anlegen('leitung', 'Creature', eindeutig('Orc'), { fields: { 'Status.status': 'ready' } });
  const bild = await api.bild('leitung', eindeutig('pass'));
  const vorlage = await api.anlegen('leitung', 'Map', eindeutig('Pass'), {
    fields: { 'Status.status': 'ready', 'Image.image': bild, 'Map.gridSize': 40 },
  });
  /* Feste Initiative: die Figur zuerst, dann der Ork — gewürfelt wird nur, wo keine steht. */
  const kampf = await api.anlegen('leitung', 'Encounter', eindeutig('Ambush'), {
    fields: { 'Status.status': 'ready' },
    relations: [
      { type: 'onMap', to: vorlage.id },
      { type: 'participates', to: lauf.figur.id, props: { init: 20 } },
      { type: 'participates', to: ork.id, props: { init: 5 } },
    ],
  });
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: { 'Status.status': 'ready' } });
  const genommen = await (await api.als('leitung')).post('/api/play/take', { data: { session: sitzung.id, encounter: kampf.id } });
  expect(genommen.ok(), await genommen.text()).toBe(true);

  await leitung.goto(`/play?session=${sitzung.id}`);
  let gmTracker = await initiative(leitung);
  await gmTracker.getByRole('button', { name: /Start/ }).click();
  await expect(gmTracker.getByText('Round 1', { exact: true })).toBeVisible();
  await expect(gmTracker.getByText('Turn 1/2')).toBeVisible();

  await spielerin.goto(`/play?session=${sitzung.id}`);
  let ihrTracker = await initiative(spielerin);
  await ihrTracker.getByRole('button', { name: /End turn/ }).click();
  /* Jetzt ist der Ork dran: kein „End turn" mehr für sie. */
  await expect(ihrTracker.getByRole('button', { name: /End turn/ })).toHaveCount(0);

  await leitung.reload();
  gmTracker = await initiative(leitung);
  await expect(gmTracker.getByText('Turn 2/2')).toBeVisible();
  await gmTracker.getByRole('button', { name: /Next turn/ }).click();
  await expect(gmTracker.getByText('Round 2', { exact: true })).toBeVisible();

  await spielerin.reload();
  ihrTracker = await initiative(spielerin);
  await expect(ihrTracker.getByRole('button', { name: /End turn/ })).toBeVisible();
});
