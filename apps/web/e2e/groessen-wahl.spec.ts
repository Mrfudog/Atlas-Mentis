/**
 * **Überlappende Grössen-Zustände** (T-428, E-164): Enlarged und Reduced
 * an derselben Figur werden nicht summiert. Ohne Wahl gilt der zuletzt
 * hinzugekommene, und der Tooltip sagt „2 size effects — choose"; die
 * Leitung wählt am Token, welcher gilt. Die Spielerin sieht die Grösse,
 * aber keine Namen. Erfundene Artikel.
 */
import { test, expect } from './hilfen';

test('overlapping size effects: the latest applies, the GM chooses at the token', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const fertig = { 'Status.status': 'ready' };
  const gross = await api.anlegen('leitung', 'Condition', eindeutig('Enlarged'), {
    fields: { ...fertig, 'Effects.effects': [{ id: 'size', target: 'size', op: 'add', value: 1 }] },
  });
  const klein = await api.anlegen('leitung', 'Condition', eindeutig('Reduced'), {
    fields: { ...fertig, 'Effects.effects': [{ id: 'size', target: 'size', op: 'add', value: -1 }] },
  });
  const figur = await api.anlegen('leitung', 'Creature', eindeutig('Gnome'), { fields: { ...fertig, 'Vitals.conditions': [gross.id, klein.id] } });
  await api.anlegen('leitung', 'Statblock', eindeutig('Gnome stats'), {
    fields: { ...fertig, 'Statblock.size': 'medium' },
    relations: [{ type: 'belongsTo', to: figur.id }],
  });
  const bild = await api.bild('leitung', eindeutig('field'));
  const vorlage = await api.anlegen('leitung', 'Map', eindeutig('Field'), {
    fields: { ...fertig, 'Image.image': bild, 'Map.gridSize': 16 },
    relations: [{ type: 'marker', to: figur.id, props: { x: 0.5, y: 0.5 } }],
  });
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: fertig });
  expect((await (await api.als('leitung')).post('/api/play/take', { data: { session: sitzung.id, map: vorlage.id } })).ok()).toBe(true);

  await leitung.goto(`/play?session=${sitzung.id}`);
  const token = leitung.getByRole('button', { name: figur.name, exact: true });
  /* Ohne Wahl: Reduced kam zuletzt dazu, Enlarged ist übergangen. */
  await expect(token).toHaveAttribute('title', new RegExp(`Small 1 × 1 · ${klein.name} \\(statblock Medium\\) · over ${gross.name} · 2 size effects — choose`));

  await token.click();
  const wahl = leitung.getByRole('combobox', { name: 'Size effect that applies' });
  await wahl.selectOption({ label: gross.name });
  await expect(token).toHaveAttribute('title', new RegExp(`Large 2 × 2 · ${gross.name} \\(statblock Medium\\) · over ${klein.name}$`));

  /* Freigeben, dann sieht die Spielerin dieselbe Grösse, aber keine Namen. */
  await leitung.keyboard.press('Escape');
  await leitung.getByRole('button', { name: 'Fog', exact: true }).click();
  await leitung.getByRole('button', { name: 'Reveal all' }).click();
  await leitung.getByRole('button', { name: 'Select', exact: true }).click();
  if (telefon) await leitung.getByRole('button', { name: 'View', exact: true }).click();
  await leitung.getByRole('button', { name: 'Release to players' }).click();
  await expect(leitung.getByRole('button', { name: 'Released' })).toBeVisible();

  await spielerin.goto(`/play?session=${sitzung.id}`);
  const ihres = spielerin.getByRole('button', { name: figur.name, exact: true });
  await expect(ihres).toHaveAttribute('title', /Large 2 × 2 · an effect \(statblock Medium\)$/);
});
