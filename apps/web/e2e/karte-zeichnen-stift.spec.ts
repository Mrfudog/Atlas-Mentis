/**
 * **Auf der Karte zeichnen** (T-219, REQ-142): Stift und Rechteck legen
 * Striche auf eine eigene Zeichenebene; die Spielerin sieht sie über den
 * Live-Kanal, bis die Leitung die Ebene „GM only“ macht. Radieren nimmt
 * einen Strich weg. Erfundene Artikel.
 */
import { test, expect } from './hilfen';

test('the GM draws on a drawing layer; players see it unless it is GM only', async ({ leitung, spielerin, api, eindeutig }) => {
  const fertig = { 'Status.status': 'ready' };
  const bild = await api.bild('leitung', eindeutig('field'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Sketch field'), {
    fields: { ...fertig, 'Image.image': bild, 'Map.kind': 'battle' },
  });

  await leitung.goto(`/artikel/${karte.id}`);
  await expect(leitung.locator('.innen.gemessen').first()).toBeVisible();
  await spielerin.goto(`/artikel/${karte.id}`);
  await expect(spielerin.locator('.live.offen')).toHaveCount(1);

  await leitung.getByRole('button', { name: 'Draw', exact: true }).click();
  await leitung.getByRole('button', { name: 'Pen', exact: true }).click();
  await leitung.locator('.buehne').first().scrollIntoViewIfNeeded();
  const box = (await leitung.locator('.innen').first().boundingBox())!;
  const p = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
  const zieh = async (punkte: Array<[number, number]>) => {
    const a = p(...punkte[0]!);
    await leitung.mouse.move(a.x, a.y);
    await leitung.mouse.down();
    for (const q of punkte.slice(1)) {
      const z = p(...q);
      await leitung.mouse.move(z.x, z.y, { steps: 4 });
    }
    await leitung.mouse.up();
  };
  await zieh([[0.1, 0.2], [0.2, 0.3], [0.3, 0.2], [0.4, 0.3]]);
  const striche = leitung.locator('svg.striche:not(.vorschau-strich) path.strich');
  await expect(striche).toHaveCount(1);

  await leitung.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await zieh([[0.5, 0.5], [0.8, 0.8]]);
  await expect(striche).toHaveCount(2);

  /* Die Spielerin sieht beide — ohne Neuladen. */
  const bei = spielerin.locator('svg.striche path.strich');
  await expect(bei).toHaveCount(2, { timeout: 10_000 });

  /* Der Leitung vorbehalten: bei ihr verschwindet die Ebene. */
  await leitung.getByRole('checkbox', { name: 'GM only' }).check();
  await expect(bei).toHaveCount(0, { timeout: 10_000 });
  await expect(striche).toHaveCount(2);

  /* Radieren: den Rand des Rechtecks antippen. */
  await leitung.getByRole('button', { name: 'Erase', exact: true }).click();
  const rand = p(0.8, 0.65);
  await leitung.mouse.click(rand.x, rand.y);
  await expect(striche).toHaveCount(1);
});
