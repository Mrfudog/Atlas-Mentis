/**
 * Zeichnen auf der Karte (T-304, T-327): nach Drücken und Halten verschiebt
 * die Maus die Karte (die Lupe ist für den Finger), Punkte und Wände lassen
 * sich zurücknehmen, und das Rad betritt eine Unterkarte nur, wenn der
 * Zeiger in ihr liegt.
 */
import { test, expect } from './hilfen';

test('walls: pan after a pause, undo a point and the last wall', async ({
  leitung,
  api,
  eindeutig,
}, info) => {
  test.skip(info.project.name === 'phone', 'Maus und Tastatur');
  const bild = await api.bild('leitung', eindeutig('cellar'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Cellar'), {
    fields: { 'Status.status': 'ready', 'Image.image': bild, 'Map.kind': 'battle' },
  });
  await leitung.goto(`/artikel/${karte.id}`);
  const buehne = leitung.locator('.buehne').first();
  await expect(leitung.locator('.innen.gemessen').first()).toBeVisible();
  /* Hineinzoomen, damit es etwas zu verschieben gibt. */
  for (let i = 0; i < 3; i++) await leitung.getByRole('button', { name: 'Zoom in' }).click();
  await leitung.getByRole('button', { name: 'Walls', exact: true }).click();
  await leitung.getByRole('button', { name: 'Draw', exact: true }).click();
  /* Die Bühne ganz ins Fenster, sonst gehen Klicks ins Leere. */
  await buehne.scrollIntoViewIfNeeded();
  const box = (await buehne.boundingBox())!;
  const unten = Math.min(box.y + box.height, (leitung.viewportSize()?.height ?? 900) - 10);
  const p = (fx: number, fy: number) => ({
    x: box.x + box.width * fx,
    y: box.y + (unten - box.y) * fy,
  });
  for (const [fx, fy] of [
    [0.3, 0.3],
    [0.5, 0.3],
    [0.5, 0.5],
  ] as const) {
    const q = p(fx, fy);
    await leitung.mouse.click(q.x, q.y);
  }
  const fertig = leitung.getByRole('button', { name: /^Finish \(\d+\)$/ });
  const anzahl = async () => Number(((await fertig.textContent()) ?? '').replace(/\D/g, ''));
  /* Erst zählen, wenn die Seite den letzten Klick verarbeitet hat: sonst
     liest der Test „2", der dritte Punkt kommt danach, und „Undo point"
     landet bei 2 statt bei 1 (T-381, in der CI rot). */
  let gesetzt = await anzahl();
  await expect
    .poll(async () => {
      const vorher = gesetzt;
      await leitung.waitForTimeout(150);
      gesetzt = await anzahl();
      return gesetzt === vorher;
    })
    .toBe(true);
  expect(gesetzt).toBeGreaterThanOrEqual(2);
  await leitung.getByRole('button', { name: 'Undo point' }).click();
  await expect(fertig).toHaveText(`Finish (${gesetzt - 1})`);
  if (gesetzt - 1 < 2) {
    const q = p(0.3, 0.5);
    await leitung.mouse.click(q.x, q.y);
  }

  /* Drücken, halten, dann ziehen: die Karte wandert, statt dass eine Lupe aufgeht. */
  const vorher = await buehne.evaluate((b) => [b.scrollLeft, b.scrollTop]);
  const a = p(0.7, 0.7);
  await leitung.mouse.move(a.x, a.y);
  await leitung.mouse.down();
  await leitung.waitForTimeout(450);
  await leitung.mouse.move(a.x - 120, a.y - 80, { steps: 8 });
  await leitung.mouse.up();
  const nachher = await buehne.evaluate((b) => [b.scrollLeft, b.scrollTop]);
  expect(nachher).not.toEqual(vorher);

  await fertig.click();
  await expect(leitung.locator('svg.sperren line.sperre')).toHaveCount(1);
  /* Erst die Wand am Server abwarten: sonst trifft „0 Wände“ unten schon
     vor diesem Schreiben zu (die Karte war leer), und das Neuladen kommt,
     bevor das Zurücknehmen abgeschickt ist. */
  const ctx = await api.als('leitung');
  const waendeAmServer = async (): Promise<number> =>
    (
      (
        (await (await ctx.get(`/api/entities/${karte.id}`)).json()) as {
          components?: { Map?: { walls?: unknown[] } };
        }
      ).components?.Map?.walls ?? []
    ).length;
  await expect.poll(waendeAmServer).toBe(1);
  await expect(leitung.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await leitung.keyboard.press('Control+z');
  await expect(leitung.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(leitung.locator('svg.sperren line.sperre')).toHaveCount(0);
  /* Gespeichert, nicht nur gezeichnet: nach dem Neuladen bleibt sie weg. */
  await expect.poll(waendeAmServer).toBe(0);
  await leitung.reload();
  await leitung.getByRole('button', { name: 'Walls', exact: true }).click();
  await expect(leitung.locator('svg.sperren line.sperre')).toHaveCount(0);
});

test('the wheel enters a sub-map only where the cursor is', async ({
  leitung,
  api,
  eindeutig,
}, info) => {
  test.skip(info.project.name === 'phone', 'Mausrad');
  const bild = await api.bild('leitung', eindeutig('land'));
  const oben = await api.anlegen('leitung', 'Map', eindeutig('Land'), {
    fields: { 'Status.status': 'ready', 'Image.image': bild, 'Map.kind': 'region' },
  });
  const unten = await api.anlegen('leitung', 'Map', eindeutig('Town'), {
    fields: { 'Status.status': 'ready', 'Image.image': bild, 'Map.kind': 'settlement' },
    relations: [{ type: 'insideMap', to: oben.id, props: { x: 0.05, y: 0.05, w: 0.38, h: 0.38 } }],
  });
  await leitung.goto(`/artikel/${oben.id}`);
  const buehne = leitung.locator('.buehne').first();
  await expect(leitung.locator('a.rahmen')).toHaveCount(1);
  await buehne.scrollIntoViewIfNeeded();
  const box = (await buehne.boundingBox())!;
  /* Knapp neben dem Rahmen, der dabei sichtbar bleibt: das Rad zoomt nur. */
  await leitung.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
  for (let i = 0; i < 12; i++) {
    await leitung.mouse.wheel(0, -200);
    await leitung.waitForTimeout(260);
  }
  await expect(leitung).toHaveURL(new RegExp(oben.id));
  expect(unten.id).toBeTruthy();
});
