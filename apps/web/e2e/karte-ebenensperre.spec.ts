/**
 * **Kartenebene festhalten** (REQ-132, T-219): mit dem Schloss in der
 * Zoomgruppe zoomt „+“ nur näher und betritt keine Unterkarte; „−“ führt
 * nicht zur Karte darüber. Ohne Schloss betritt dasselbe Zoomen die
 * Unterkarte. Der Schalter bleibt nach dem Neuladen.
 */
import { test, expect } from './hilfen';

test('a locked map level keeps zooming on this map', async ({ leitung, api, eindeutig }) => {
  const fertig = { 'Status.status': 'ready' };
  const bild = await api.bild('leitung', eindeutig('realm'));
  const oben = await api.anlegen('leitung', 'Map', eindeutig('Realm'), { fields: { ...fertig, 'Image.image': bild, 'Map.kind': 'region' } });
  const unten = await api.anlegen('leitung', 'Map', eindeutig('Harbour'), {
    fields: { ...fertig, 'Image.image': bild, 'Map.kind': 'settlement' },
    relations: [{ type: 'insideMap', to: oben.id, props: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } }],
  });

  await leitung.goto(`/artikel/${oben.id}`);
  await expect(leitung.locator('a.rahmen')).toHaveCount(1);
  const schloss = leitung.getByRole('button', { name: 'Lock map level' });
  await expect(schloss).toHaveAttribute('aria-pressed', 'false');
  await schloss.click();
  await expect(schloss).toHaveAttribute('aria-pressed', 'true');

  const hinein = leitung.getByRole('button', { name: 'Zoom in' });
  for (let i = 0; i < 8; i++) await hinein.click();
  await expect(leitung).toHaveURL(new RegExp(oben.id));
  /* Kein Rahmen sagt „zoom in to enter“ an. */
  await expect(leitung.locator('a.rahmen.nah')).toHaveCount(0);

  /* Bleibt nach dem Neuladen; dann lösen, und dasselbe Zoomen führt hinein. */
  await leitung.reload();
  await expect(schloss).toHaveAttribute('aria-pressed', 'true');
  await schloss.click();
  await expect(schloss).toHaveAttribute('aria-pressed', 'false');
  for (let i = 0; i < 8 && !leitung.url().includes(unten.id); i++) await hinein.click();
  await expect(leitung).toHaveURL(new RegExp(unten.id));
});
