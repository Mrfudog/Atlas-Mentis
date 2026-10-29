/**
 * Zielmodus im Zugplan (T-391): ein Angriff auf ein grosses Token zählt bis
 * zu seinem nächsten Feld, nicht bis zu seiner Mitte. Kira steht neben
 * einem Drachen auf 3 × 3 — der waffenlose Schlag (5 ft) reicht, auch nach
 * einer geplanten Bewegung dorthin. Vorher nahm der Zielmodus den Klick
 * auf den Drachen nicht an (10 ft bis zur Mitte) und sagte nicht warum.
 *
 * Das Bild ist 320 × 240 bei 20 px je Feld: 16 Felder breit, je 5 ft.
 */
import { test, expect } from './hilfen';

/** Die Mitte eines Feldes als Anteil der Karte. */
const feld = (x: number, y: number) => ({ x: (x * 20 + 10) / 320, y: (y * 20 + 10) / 240 });
/** Die Mitte eines Platzes von n × n Feldern ab (x, y) — so steht ein grosses Token (D58). */
const platz = (x: number, y: number, n: number) => ({ x: ((x + n / 2) * 20) / 320, y: ((y + n / 2) * 20) / 240 });

test('a target touching a big token is in reach, after a planned move too', async ({ leitung, api, eindeutig }, info) => {
  const bereit = { 'Status.status': 'ready' };
  const kira = await api.anlegen('leitung', 'Creature', eindeutig('Kira'), { fields: bereit });
  await api.anlegen('leitung', 'Statblock', eindeutig('Kira stats'), {
    fields: { ...bereit, 'Statblock.ac': 14, 'Statblock.hp': 20, 'Statblock.speed': '30 ft.', 'Statblock.size': 'medium' },
    relations: [{ type: 'belongsTo', to: kira.id }],
  });
  const drache = await api.anlegen('leitung', 'Creature', eindeutig('Dragon'), { fields: bereit });
  await api.anlegen('leitung', 'Statblock', eindeutig('Dragon stats'), {
    fields: { ...bereit, 'Statblock.ac': 19, 'Statblock.hp': 200, 'Statblock.speed': '40 ft.', 'Statblock.size': 'huge' },
    relations: [{ type: 'belongsTo', to: drache.id }],
  });
  const bild = await api.bild('leitung', eindeutig('lair'));
  /* Der Drache belegt die Felder 5–7 × 0–2; Kira steht auf (2, 1), drei Felder links davon. */
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Lair'), {
    fields: { ...bereit, 'Image.image': bild, 'Map.gridShape': 'square', 'Map.gridSize': 20 },
    relations: [
      { type: 'marker', to: kira.id, props: { ...feld(2, 1), kind: 'play' } },
      { type: 'marker', to: drache.id, props: { ...platz(5, 0, 3), kind: 'play' } },
    ],
  });
  const gm = await api.als('leitung');
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: bereit });
  const genommen = await gm.post('/api/play/take', { data: { session: sitzung.id, map: karte.id } });
  expect(genommen.ok(), await genommen.text()).toBe(true);
  const plan = `/api/maps/${((await genommen.json()) as { map: string }).map}/turn-plan`;
  const schlag = { id: 's2', kind: 'act', tile: 'std:unarmed', name: 'Unarmed Strike', cost: 'action', target: drache.id, targetName: drache.name };

  /* In der Oberfläche: Move zwei Felder weiter, Unarmed Strike, auf den Drachen tippen. */
  await leitung.goto(`/play?session=${sitzung.id}`);
  await leitung.getByRole('button', { name: 'Plan turn', exact: true }).click();
  const leiste = leitung.getByLabel('Turn planner');
  const wer = leiste.getByLabel('Who plans');
  if (await wer.count()) await wer.selectOption({ label: `${kira.name} (GM)` });
  await leiste.getByRole('button', { name: /Move/ }).click();
  /* Das Feld (4, 1) unter den blauen Feldern der Reichweite (`rect.reich`, in Kartenanteilen). */
  const felder = leitung.locator('rect.reich');
  await expect(felder.first()).toBeAttached();
  const i = await felder.evaluateAll((rs) =>
    rs.findIndex((r) => Math.abs(Number(r.getAttribute('x')) - 80 / 320) < 1e-3 && Math.abs(Number(r.getAttribute('y')) - 20 / 240) < 1e-3),
  );
  expect(i).toBeGreaterThanOrEqual(0);
  /* In die Mitte des Schirms: am Telefon liegt sonst die feste Werkzeugleiste darüber. */
  await felder.nth(i).evaluate((r) => r.scrollIntoView({ block: 'center' }));
  if (info.project.use.hasTouch) await felder.nth(i).tap({ force: true });
  else await felder.nth(i).click({ force: true });
  await expect(leiste.getByLabel('Your turn, in order')).toContainText('Move 10 ft');
  await leiste.getByRole('button', { name: 'Done' }).click();
  await leiste.getByRole('button', { name: /Unarmed Strike/ }).click();
  await leitung.getByRole('button', { name: new RegExp(`^${drache.name}`) }).click();
  await expect(leiste.getByLabel('Your turn, in order')).toContainText(`Unarmed Strike → ${drache.name}`);

  /* Und der Server rechnet gleich: von (2, 1) aus 15 ft — zu weit; nach dem Weg auf (4, 1) 5 ft. */
  expect((await gm.post(plan, { data: { actor: kira.id, steps: [{ ...schlag, id: 's1' }] } })).status()).toBe(422);
  const weg = { id: 's1', kind: 'move', path: [{ x: 3, y: 1 }, { x: 4, y: 1 }], feet: 10, to: feld(4, 1) };
  const ja = await gm.post(plan, { data: { actor: kira.id, steps: [weg, schlag] } });
  expect(ja.ok(), await ja.text()).toBe(true);

});
