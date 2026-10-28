/**
 * Das Raster des Zugplans (T-349): durch eine Verbündete geht der Weg,
 * enden darf er dort nicht; Schlamm aus den Zonen der Karte kostet
 * doppelt, und der Server zählt die Fuss selbst. Im Browser zeigt der
 * Bereich das schwierige Gelände erdfarben.
 *
 * Das Bild ist 320 × 240 bei 20 px je Feld: 16 Felder breit, je 5 ft.
 */
import { test, expect } from './hilfen';

/** Die Mitte eines Feldes als Anteil der Karte. */
const feld = (x: number, y: number) => ({ x: (x * 20 + 10) / 320, y: (y * 20 + 10) / 240 });
/** Ein Weg in der ersten Reihe, mit den Fuss, die die Maske behauptet. */
const weg = (bis: number, feet: number) => ({
  id: 'm', kind: 'move', feet,
  path: Array.from({ length: bis + 1 }, (_, i) => ({ x: i, y: 0 })),
  to: feld(bis, 0),
});

test('the turn plan passes through allies and counts difficult terrain', async ({ leitung, api, lauf, eindeutig }) => {
  const bereit = { 'Status.status': 'ready' };
  const freundin = await api.anlegen('leitung', 'PlayerCharacter', eindeutig('Mara'), { fields: bereit });
  /* Mara hat Zahlen — so plant die Leitung im Browser für sie. */
  await api.anlegen('leitung', 'Statblock', eindeutig('Mara stats'), {
    fields: { ...bereit, 'Statblock.ac': 13, 'Statblock.hp': 11, 'Statblock.speed': '30 ft.' },
    relations: [{ type: 'belongsTo', to: freundin.id }],
  });
  const schlamm = await api.anlegen('leitung', 'ZoneKind', eindeutig('Mud'), { fields: { ...bereit, 'ZoneKind.moveCost': 2 } });
  const bild = await api.bild('leitung', eindeutig('field'));
  /* Die Figur links, die Verbündete daneben, Schlamm auf den Feldern 2 und 3. */
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Mud field'), {
    fields: { ...bereit, 'Image.image': bild, 'Map.gridShape': 'square', 'Map.gridSize': 20 },
    relations: [
      { type: 'marker', to: lauf.figur.id, props: { ...feld(0, 0), kind: 'play' } },
      { type: 'marker', to: freundin.id, props: { ...feld(1, 0), kind: 'play' } },
      { type: 'zone', to: schlamm.id, props: { kind: 'rect', x: 40 / 320, y: 0, w: 40 / 320, h: 20 / 240 } },
    ],
  });
  const plan = `/api/maps/${karte.id}/turn-plan`;
  const nat = { w: 320, h: 240 };

  const sie = await api.als('spielerin');
  const lage = (await (await sie.get(`${plan}?actor=${lauf.figur.id}&nat=320x240`)).json()) as { passable: string[]; terrain: { cost: number }[] };
  expect(lage.passable).toHaveLength(1);
  expect(lage.terrain.map((t) => t.cost)).toEqual([2]);

  /* 5 durch Mara, 10 + 10 durch den Schlamm, 5 heraus — die Maske sagt 20. */
  const durch = await sie.post(plan, { data: { actor: lauf.figur.id, steps: [weg(4, 20)], nat } });
  expect(durch.ok(), await durch.text()).toBe(true);
  expect(((await durch.json()) as { steps: { feet: number }[] }).steps[0]!.feet).toBe(30);
  /* Auf Mara stehen bleiben geht nicht; 40 ft sind zu weit. */
  expect((await sie.post(plan, { data: { actor: lauf.figur.id, steps: [weg(1, 5)], nat } })).status()).toBe(422);
  expect((await sie.post(plan, { data: { actor: lauf.figur.id, steps: [weg(6, 30)], nat } })).status()).toBe(422);

  /* Im Browser: der Bereich zeigt den Schlamm, auch für Mara. */
  const gm = await api.als('leitung');
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: bereit });
  const genommen = await gm.post('/api/play/take', { data: { session: sitzung.id, map: karte.id } });
  expect(genommen.ok(), await genommen.text()).toBe(true);
  await leitung.goto(`/play?session=${sitzung.id}`);
  await leitung.getByRole('button', { name: 'Plan turn', exact: true }).click();
  /* Mara ist die einzige Figur mit Zahlen: der Plan gilt ihr ohne Wahl. */
  await expect(leitung.getByRole('region', { name: 'Plan turn' }).getByText(freundin.name)).toBeVisible();
  await leitung.getByRole('button', { name: /Move \d+ ft/ }).click();
  const bereich = leitung.locator('svg.plan rect.reich');
  await expect(bereich.first()).toBeVisible();
  await expect(leitung.locator('svg.plan rect.reich[style*="fill"]')).toHaveCount(2);
});
