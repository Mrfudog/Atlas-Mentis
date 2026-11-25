/**
 * Schaden im Tracker mit Art (T-355): die Leitung wählt bei „− Damage"
 * die Schadensart, und der Server zieht nach der Abwehr ab — ein Ork mit
 * Feuerresistenz verliert von 8 Feuerschaden 4. Die Zeile darüber sagt,
 * warum.
 */
import { test, expect } from './hilfen';

test('damage in the tracker counts its type against resistances', async ({ leitung, api, eindeutig }) => {
  const bereit = { 'Status.status': 'ready' };
  const ork = await api.anlegen('leitung', 'Creature', eindeutig('Orc'), { fields: bereit });
  await api.anlegen('leitung', 'Statblock', eindeutig('Orc stats'), {
    fields: { ...bereit, 'Statblock.ac': 13, 'Statblock.hp': 20, 'Statblock.speed': '30 ft.', 'Statblock.resistances': 'fire' },
    relations: [{ type: 'belongsTo', to: ork.id }],
  });
  const kampf = await api.anlegen('leitung', 'Encounter', eindeutig('Ambush'), {
    fields: bereit,
    relations: [{ type: 'participates', to: ork.id, props: { init: 5, revealed: true } }],
  });
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: bereit });
  const genommen = await (await api.als('leitung')).post('/api/play/take', { data: { session: sitzung.id, encounter: kampf.id } });
  expect(genommen.ok(), await genommen.text()).toBe(true);

  await leitung.goto(`/play?session=${sitzung.id}`);
  const panel = leitung.getByRole('region', { name: 'Initiative' });
  const knopf = leitung.getByRole('button', { name: 'Initiative', exact: true });
  await expect(panel.or(knopf).first()).toBeVisible();
  if (!(await panel.isVisible())) await knopf.click();
  await panel.getByRole('button', { name: /Start/ }).click();
  await expect(panel.getByText('Round 1', { exact: true })).toBeVisible();

  await panel.getByRole('button', { name: /Damage/ }).first().click();
  await panel.getByLabel('Damage', { exact: true }).fill('8');
  await panel.getByLabel('Damage type').selectOption('fire');
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(panel.getByRole('status').filter({ hasText: 'resistant (fire) → 4' })).toBeVisible();
  await expect(panel.getByText(/at 16\/20 HP/)).toBeVisible();
});
