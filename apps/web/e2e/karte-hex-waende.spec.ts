/**
 * **Wände auf Hexfeldern einrasten** (T-219): auf einer Hexkarte rastet ein
 * Wandpunkt an die nächste Ecke des Hexfelds, wie auf Quadraten an die
 * Gitterecke. Bild 320 × 240, Hex 40 px breit, spitze Seite oben: Feld
 * (2,2) (axial) hat die Mitte bei (140, 92,4), die obere Ecke bei
 * (140, 69,3) und die rechte obere bei (160, 80,8).
 */
import { test, expect } from './hilfen';

interface Wand {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

test('wall points snap to hex corners', async ({ leitung, api, eindeutig }, info) => {
  test.skip(info.project.name === 'phone', 'Maus: am Telefon rastet die Lupe');
  const bild = await api.bild('leitung', eindeutig('hexfield'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Hex field'), {
    fields: { 'Status.status': 'ready', 'Image.image': bild, 'Map.kind': 'battle', 'Map.gridShape': 'hex', 'Map.gridSize': 40 },
  });
  await leitung.goto(`/artikel/${karte.id}`);
  await expect(leitung.locator('.innen.gemessen').first()).toBeVisible();
  await leitung.getByRole('button', { name: 'Walls', exact: true }).click();
  await leitung.getByRole('toolbar', { name: 'Walls' }).getByRole('button', { name: 'Draw', exact: true }).click();
  await leitung.locator('.buehne').first().scrollIntoViewIfNeeded();
  const box = (await leitung.locator('.innen').first().boundingBox())!;
  const bei = (px: number, py: number) => ({ x: box.x + (box.width * px) / 320, y: box.y + (box.height * py) / 240 });
  for (const [px, py] of [
    [141, 71],
    [159, 79],
  ] as const) {
    const q = bei(px, py);
    await leitung.mouse.click(q.x, q.y);
  }
  await leitung.getByRole('button', { name: /^Finish \(\d+\)$/ }).click();
  await expect(leitung.locator('svg.sperren line.sperre')).toHaveCount(1);

  const ctx = await api.als('leitung');
  await expect
    .poll(async () => (((await (await ctx.get(`/api/entities/${karte.id}`)).json()) as { components: { Map: { walls?: Wand[] } } }).components.Map.walls ?? []).length)
    .toBe(1);
  const [w] = ((await (await ctx.get(`/api/entities/${karte.id}`)).json()) as { components: { Map: { walls: Wand[] } } }).components.Map.walls;
  expect(w!.x1 * 320).toBeCloseTo(140, 0);
  expect(w!.y1 * 240).toBeCloseTo(69.28, 0);
  expect(w!.x2 * 320).toBeCloseTo(160, 0);
  expect(w!.y2 * 240).toBeCloseTo(80.83, 0);
});
