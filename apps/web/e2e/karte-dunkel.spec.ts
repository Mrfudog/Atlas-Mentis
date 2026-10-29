/**
 * **Tokens im Dunkeln** (T-219): auf einer dunklen Karte bekommt die
 * Spielerin nur die Tokens, die ihre Figur sieht. Stellt die Leitung eine
 * Laterne neben den Ghul, erscheint er bei ihr — über den Live-Kanal, ohne
 * Neuladen. Erfundene Artikel.
 *
 * Das Bild ist 320 × 240 bei 20 px je Feld und 5 ft.
 */
import { test, expect } from './hilfen';

interface Kante {
  id: string;
  type: string;
  to: string;
  props?: Record<string, unknown>;
}

test('a player sees in the dark only what her character sees', async ({ leitung, spielerin, api, lauf, eindeutig }) => {
  const fertig = { 'Status.status': 'ready' };
  const ghul = await api.anlegen('leitung', 'Creature', eindeutig('Ghoul'), { fields: fertig });
  const bild = await api.bild('leitung', eindeutig('crypt'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Dark crypt'), {
    fields: { ...fertig, 'Image.image': bild, 'Map.gridShape': 'square', 'Map.gridSize': 20, 'Map.scale': '5 ft', 'Map.lighting': 'dark' },
    relations: [
      { type: 'marker', to: lauf.figur.id, props: { kind: 'play', x: 30 / 320, y: 30 / 240 } },
      { type: 'marker', to: ghul.id, props: { kind: 'play', x: 290 / 320, y: 210 / 240 } },
    ],
  });

  await leitung.goto(`/artikel/${karte.id}`);
  await expect(leitung.getByRole('button', { name: ghul.name, exact: true })).toBeVisible();

  await spielerin.goto(`/artikel/${karte.id}`);
  await expect(spielerin.getByRole('button', { name: lauf.figur.name, exact: true })).toBeVisible();
  await expect(spielerin.getByRole('button', { name: ghul.name, exact: true })).toHaveCount(0);
  await expect(spielerin.locator('.live.offen')).toHaveCount(1);

  /* Die Leitung stellt eine Laterne neben den Ghul — die Spielerin sieht ihn. */
  const ctx = await api.als('leitung');
  const e = (await (await ctx.get(`/api/entities/${karte.id}`)).json()) as { relations: Kante[]; refs?: unknown };
  delete e.refs;
  const lampe: Kante = { id: `${karte.id}~marker-lampe`, type: 'marker', to: karte.id, props: { kind: 'light', x: 290 / 320, y: 190 / 240, light: 2, dim: 3 } };
  const res = await ctx.put(`/api/entities/${karte.id}`, { data: { ...e, relations: [...e.relations, lampe] } });
  expect(res.ok(), await res.text()).toBe(true);
  await expect(spielerin.getByRole('button', { name: ghul.name, exact: true })).toBeVisible({ timeout: 10_000 });
});

test('magical darkness hides who stands in it, also on a bright map', async ({ leitung, spielerin, api, lauf, eindeutig }) => {
  const fertig = { 'Status.status': 'ready' };
  const finster = await api.anlegen('leitung', 'ZoneKind', eindeutig('Magical darkness'), { fields: { ...fertig, 'ZoneKind.light': 'dark' } });
  const schatten = await api.anlegen('leitung', 'Creature', eindeutig('Shadow'), { fields: fertig });
  const bild = await api.bild('leitung', eindeutig('hall'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Bright hall'), {
    fields: { ...fertig, 'Image.image': bild, 'Map.gridShape': 'square', 'Map.gridSize': 20, 'Map.scale': '5 ft' },
    relations: [
      { type: 'marker', to: lauf.figur.id, props: { kind: 'play', x: 30 / 320, y: 30 / 240 } },
      { type: 'marker', to: schatten.id, props: { kind: 'play', x: 270 / 320, y: 190 / 240 } },
      { type: 'zone', to: finster.id, props: { kind: 'rect', x: 0.75, y: 0.7, w: 0.25, h: 0.3 } },
    ],
  });
  await leitung.goto(`/artikel/${karte.id}`);
  await expect(leitung.getByRole('button', { name: schatten.name, exact: true })).toBeVisible();
  await expect(leitung.locator('svg.flaechen path.finster')).toHaveCount(0);

  await spielerin.goto(`/artikel/${karte.id}`);
  await expect(spielerin.getByRole('button', { name: lauf.figur.name, exact: true })).toBeVisible();
  await expect(spielerin.getByRole('button', { name: schatten.name, exact: true })).toHaveCount(0);
  /* Die Dunkelheit ist für sie gemalt — auch wenn sie „Areas“ ausblendet. */
  await expect(spielerin.locator('svg.flaechen path.finster')).toHaveCount(1);
  await spielerin.getByRole('button', { name: 'Areas', exact: true }).click();
  await expect(spielerin.locator('svg.flaechen path.finster')).toHaveCount(1);
});
