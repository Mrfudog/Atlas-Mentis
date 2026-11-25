/**
 * **Zonen und Gebiete ziehen** (T-219, REQ-193): die Leitung wählt unter
 * Zones eine Zonenart, zieht ein Rechteck und bekommt die Felder darunter;
 * eine versteckte Zone markiert sie mit Found als gefunden und nimmt sie
 * mit Remove wieder weg. Erfundene Artikel.
 */
import { test, expect } from './hilfen';

interface Kante {
  id: string;
  type: string;
  to: string;
  props?: Record<string, unknown>;
}

test('the GM draws a zone, marks it found and removes it', async ({ leitung, api, eindeutig }) => {
  const fertig = { 'Status.status': 'ready' };
  const grube = await api.anlegen('leitung', 'ZoneKind', eindeutig('Spike pit'), { fields: { ...fertig, 'ZoneKind.hiddenUntil': 14 } });
  const bild = await api.bild('leitung', eindeutig('hall'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Hall'), {
    fields: { ...fertig, 'Image.image': bild, 'Map.kind': 'battle', 'Map.gridShape': 'square', 'Map.gridSize': 20 },
  });
  const ctx = await api.als('leitung');
  const flaechen = async () =>
    (((await (await ctx.get(`/api/entities/${karte.id}`)).json()) as { relations: Kante[] }).relations ?? []).filter((r) => r.type === 'zone');

  await leitung.goto(`/artikel/${karte.id}`);
  await expect(leitung.locator('.innen.gemessen').first()).toBeVisible();
  await leitung.getByRole('button', { name: 'Zones', exact: true }).click();
  const wahl = leitung.getByRole('combobox', { name: 'What the area stands for' });
  await expect(wahl.locator('option', { hasText: grube.name })).toHaveCount(1);
  await wahl.selectOption({ label: grube.name });
  await leitung.getByRole('button', { name: 'Rectangle', exact: true }).click();

  const buehne = leitung.locator('.buehne').first();
  await buehne.scrollIntoViewIfNeeded();
  const box = (await leitung.locator('.innen').first().boundingBox())!;
  const p = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
  const a = p(0.2, 0.2);
  const b = p(0.45, 0.45);
  await leitung.mouse.move(a.x, a.y);
  await leitung.mouse.down();
  await leitung.mouse.move(b.x, b.y, { steps: 6 });
  await leitung.mouse.up();

  const pfad = leitung.locator('svg.flaechen path.flaeche');
  await expect(pfad).toHaveCount(1);
  await expect(leitung.locator('svg.flaechen path.versteckt')).toHaveCount(1);
  await expect.poll(async () => (await flaechen()).map((r) => r.to)).toEqual([grube.id]);

  /* Gefunden: Spielende sehen sie hier ab jetzt. */
  const mitte = p(0.32, 0.32);
  await leitung.getByRole('button', { name: 'Found', exact: true }).click();
  await leitung.mouse.click(mitte.x, mitte.y);
  await expect(leitung.locator('svg.flaechen path.versteckt')).toHaveCount(0);
  await expect.poll(async () => (await flaechen())[0]?.props?.['found']).toBe(true);

  /* Wegnehmen: die Kante geht, die Zonenart bleibt. */
  await leitung.getByRole('button', { name: 'Remove', exact: true }).click();
  await leitung.mouse.click(mitte.x, mitte.y);
  await expect(pfad).toHaveCount(0);
  await expect.poll(async () => (await flaechen()).length).toBe(0);
  expect((await ctx.get(`/api/entities/${grube.id}`)).ok()).toBe(true);
});
