/**
 * **Gefolge und Villain Actions im Bogen** (T-497): ein Gefolgsmann folgt
 * mit Stufe 5, sein Statblock rechnet HP und Übungsbonus aus der Stufe und
 * dimmt die Aktion, die erst auf Stufe 7 kommt; ein Schurke zeigt seine
 * Villain Actions nach Runde. Leitung am Desktop, Spielerin am Telefon —
 * beide sehen denselben Bogen. Erfundene Artikel, kein Buchtext.
 */
import { test, expect } from './hilfen';

test('a follower’s statblock shows level actions, and a villain its villain actions', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const seite = info.project.name === 'phone' ? spielerin : leitung;
  const fertig = { 'Status.status': 'ready' };

  const art = await api.anlegen('leitung', 'ActionType', eindeutig('Villain Action'), { fields: { ...fertig, 'ActionType.per': 'round' } });
  const aktion = await api.anlegen('leitung', 'ActionType', eindeutig('Action'), { fields: fertig });
  const runde = (n: number, name: string) =>
    api.anlegen('leitung', 'Action', eindeutig(name), { fields: { ...fertig, 'Action.actionType': art.id, 'Action.round': n } });
  const [v3, v1, v2] = [await runde(3, 'Finale'), await runde(1, 'Opening'), await runde(2, 'Turn')];
  const schurke = await api.anlegen('leitung', 'Statblock', eindeutig('Villain stats'), {
    fields: { ...fertig, 'Statblock.prof': 3 },
    relations: [v3, v1, v2].map((v) => ({ type: 'composedOf', to: v.id })),
  });

  const anfuehrer = await api.anlegen('leitung', 'Creature', eindeutig('Mentor'), { fields: fertig });
  const knappe = await api.anlegen('leitung', 'Creature', eindeutig('Squire'), {
    fields: { ...fertig, 'Creature.kind': 'retainer' },
    relations: [{ type: 'follows', to: anfuehrer.id, props: { as: 'retainer', level: 5 } }],
  });
  const ruf = await api.anlegen('leitung', 'Action', eindeutig('Rally'), { fields: { ...fertig, 'Action.actionType': aktion.id, 'Action.saveDc': 10, 'Action.saveAbility': 'wis' } });
  const sturm = await api.anlegen('leitung', 'Action', eindeutig('Storm'), { fields: { ...fertig, 'Action.actionType': aktion.id } });
  const bogen = await api.anlegen('leitung', 'Statblock', eindeutig('Squire stats'), {
    fields: { ...fertig, 'Statblock.ac': 13, 'Statblock.hp': 0, 'Statblock.hpPerLevel': 6, 'Statblock.pbFrom': 'level', 'Statblock.addPb': ['dc'] },
    relations: [
      { type: 'belongsTo', to: knappe.id },
      { type: 'composedOf', to: ruf.id, props: { level: 3 } },
      { type: 'composedOf', to: sturm.id, props: { level: 7 } },
    ],
  });

  /* Der Gefolgsmann: Stufe 5 → HP 30, Übungsbonus +3, SG 10 + 3. */
  await seite.goto(`/artikel/${bogen.id}`);
  await expect(seite.locator('p', { hasText: 'Hit Points' }).first()).toContainText('30');
  await expect(seite.locator('p', { hasText: 'Proficiency Bonus' }).first()).toContainText('+3');
  const rally = seite.locator('nw-abschnitte nw-text', { hasText: `${ruf.name} (level 3)` });
  await expect(rally).toContainText('DC 13 Wisdom saving throw.');
  await expect(rally).not.toHaveClass(/gesperrt/);
  await expect(seite.locator('nw-abschnitte nw-text', { hasText: `${sturm.name} (level 7)` })).toHaveClass(/gesperrt/);

  /* Der Schurke: ein Abschnitt der Aktionsart, nach Runde. */
  await seite.goto(`/artikel/${schurke.id}`);
  const abschnitte = seite.locator('nw-abschnitte');
  await expect(abschnitte.getByRole('heading', { name: `${art.name}s` })).toBeVisible();
  await expect(abschnitte.locator('nw-text')).toHaveText([
    new RegExp(`^Round 1: ${v1.name}`),
    new RegExp(`^Round 2: ${v2.name}`),
    new RegExp(`^Round 3: ${v3.name}`),
  ]);
});
