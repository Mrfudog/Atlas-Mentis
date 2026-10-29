/**
 * **Sicht aufdecken** (T-219): die Leitung tippt unter Fog › Reveal sight
 * ein Token an und deckt auf, was es von seinem Platz aus sieht — eine
 * Wand begrenzt es. Erfundene Artikel.
 */
import { test, expect } from './hilfen';

interface Form {
  kind: string;
  pts?: Array<[number, number]>;
}

test('the GM reveals what a token sees', async ({ leitung, api, eindeutig }) => {
  const fertig = { 'Status.status': 'ready' };
  const wache = await api.anlegen('leitung', 'Creature', eindeutig('Sentry'), { fields: fertig });
  const bild = await api.bild('leitung', eindeutig('keep'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Keep'), {
    fields: {
      ...fertig,
      'Image.image': bild,
      'Map.kind': 'battle',
      'Map.fog': true,
      /* Eine Wand senkrecht durch die Mitte. */
      'Map.walls': [{ id: 'w1', kind: 'wall', x1: 0.5, y1: 0, x2: 0.5, y2: 1 }],
    },
    relations: [{ type: 'marker', to: wache.id, props: { kind: 'play', x: 0.25, y: 0.5 } }],
  });
  const ctx = await api.als('leitung');
  const formen = async () =>
    ((((await (await ctx.get(`/api/entities/${karte.id}`)).json()) as { components: { Map: { reveal?: Form[] } } }).components.Map.reveal ?? []) as Form[]);

  await leitung.goto(`/artikel/${karte.id}`);
  /* Erst mit Bildgrösse rechnet die Sicht. */
  await expect(leitung.locator('.innen.gemessen').first()).toBeVisible();
  await leitung.getByRole('button', { name: 'Fog', exact: true }).click();
  await leitung.getByRole('button', { name: 'Reveal sight', exact: true }).click();
  await leitung.getByRole('button', { name: wache.name, exact: true }).click();

  await expect.poll(async () => (await formen()).length).toBe(1);
  const [f] = await formen();
  expect(f!.kind).toBe('poly');
  /* Die Wand hält den Blick: nichts rechts von der Mitte. */
  expect(Math.max(...f!.pts!.map((p) => p[0]))).toBeLessThanOrEqual(0.5001);
});
