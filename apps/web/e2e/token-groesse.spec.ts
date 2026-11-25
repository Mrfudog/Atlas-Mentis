/**
 * Token-Grösse (T-390, REQ-396): ein Monster, das nur ein Statblock ist
 * (der Drache aus dem Demo-Video), steht auf der Karte nach seiner Grösse —
 * Huge 3 × 3, nicht ein Feld; ein Zustand mit Wirkung `size +1` (Enlarge)
 * macht eine mittelgrosse Figur Large. Leitung und Spielerin sehen dieselbe
 * Grösse; woher sie kommt, sagt der Tooltip. Erfundene Artikel.
 */
import { test, expect } from './hilfen';

test('a dragon statblock covers 3 × 3 squares, Enlarge makes a medium creature large', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const fertig = { 'Status.status': 'ready' };
  const drache = await api.anlegen('leitung', 'Statblock', eindeutig('Red Dragon'), { fields: { ...fertig, 'Statblock.size': 'huge' } });
  const oger = await api.anlegen('leitung', 'Statblock', eindeutig('Ogre'), { fields: { ...fertig, 'Statblock.size': 'large' } });
  const gross = await api.anlegen('leitung', 'Condition', eindeutig('Enlarged'), {
    fields: { ...fertig, 'Effects.effects': [{ id: 'size', target: 'size', op: 'add', value: 1 }] },
  });
  const zwergin = await api.anlegen('leitung', 'Creature', eindeutig('Dwarf'), { fields: { ...fertig, 'Vitals.conditions': [gross.id] } });
  await api.anlegen('leitung', 'Statblock', eindeutig('Dwarf stats'), {
    fields: { ...fertig, 'Statblock.size': 'medium' },
    relations: [{ type: 'belongsTo', to: zwergin.id }],
  });
  const bild = await api.bild('leitung', eindeutig('lair'));
  const vorlage = await api.anlegen('leitung', 'Map', eindeutig('Lair'), {
    fields: { ...fertig, 'Image.image': bild, 'Map.gridSize': 16 },
    relations: [
      { type: 'marker', to: drache.id, props: { x: 0.3, y: 0.35 } },
      { type: 'marker', to: oger.id, props: { x: 0.75, y: 0.35 } },
      { type: 'marker', to: zwergin.id, props: { x: 0.5, y: 0.75 } },
    ],
  });
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: fertig });
  const genommen = await (await api.als('leitung')).post('/api/play/take', { data: { session: sitzung.id, map: vorlage.id } });
  expect(genommen.ok()).toBe(true);

  await leitung.goto(`/play?session=${sitzung.id}`);
  const marke = (name: string) => leitung.getByRole('button', { name, exact: true });
  await expect(marke(drache.name)).toBeVisible();
  const breite = async (name: string) => (await marke(name).boundingBox())?.width ?? 0;
  /* Huge 3 Felder, Large 2: dasselbe Verhältnis, wie gross die Karte auch gezeichnet ist. */
  await expect.poll(async () => (await breite(drache.name)) / (await breite(oger.name))).toBeCloseTo(1.5, 1);
  await expect.poll(async () => (await breite(zwergin.name)) / (await breite(oger.name))).toBeCloseTo(1, 1);
  await expect(marke(drache.name)).toHaveAttribute('title', /Huge 3 × 3 · statblock/);
  await expect(marke(zwergin.name)).toHaveAttribute('title', new RegExp(`Large 2 × 2 · ${gross.name} \\(statblock Medium\\)`));

  /* Freigeben (am Telefon im Menü „View"), dann sieht die Spielerin dieselben Grössen. */
  await leitung.getByRole('button', { name: 'Fog', exact: true }).click();
  await leitung.getByRole('button', { name: 'Reveal all' }).click();
  await leitung.getByRole('button', { name: 'Select', exact: true }).click();
  const menue = leitung.getByRole('button', { name: 'View', exact: true });
  if (telefon) await menue.click();
  await leitung.getByRole('button', { name: 'Release to players' }).click();
  await expect(leitung.getByRole('button', { name: 'Released' })).toBeVisible();

  await spielerin.goto(`/play?session=${sitzung.id}`);
  const ihre = (name: string) => spielerin.getByRole('button', { name, exact: true });
  await expect(ihre(drache.name)).toBeVisible();
  const ihreBreite = async (name: string) => (await ihre(name).boundingBox())?.width ?? 0;
  await expect.poll(async () => (await ihreBreite(drache.name)) / (await ihreBreite(oger.name))).toBeCloseTo(1.5, 1);
  /* Die Quelle der Wirkung nennt der Server nur der Leitung. */
  await expect(ihre(zwergin.name)).toHaveAttribute('title', /Large 2 × 2 · an effect/);
});
