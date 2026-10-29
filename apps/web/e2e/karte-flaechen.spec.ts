/**
 * **Zonen und Gebiete auf der Karte** (T-219, REQ-193, REQ-208): aufs
 * Gitter gerastert gezeichnet, eine versteckte Zone nur für die Leitung,
 * und was die Leitung findet, erscheint bei der Spielerin über den
 * Live-Kanal (T-399) — ohne Neuladen. Erfundene Artikel.
 *
 * Das Bild ist 320 × 240 bei 20 px je Feld.
 */
import { test, expect } from './hilfen';

interface Kante {
  id: string;
  type: string;
  to: string;
  props?: Record<string, unknown>;
}

test('zones and territories lie on the grid; a hidden zone reaches the player once found', async ({ leitung, spielerin, api, eindeutig }) => {
  const fertig = { 'Status.status': 'ready' };
  const eis = await api.anlegen('leitung', 'ZoneKind', eindeutig('Ice'), { fields: { ...fertig, 'ZoneKind.moveCost': 2 } });
  const falle = await api.anlegen('leitung', 'ZoneKind', eindeutig('Pit'), { fields: { ...fertig, 'ZoneKind.hiddenUntil': 15 } });
  const bande = await api.anlegen('leitung', 'Faction', eindeutig('Wolves'), { fields: fertig });
  const bild = await api.bild('leitung', eindeutig('frozen yard'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Frozen yard'), {
    fields: { ...fertig, 'Image.image': bild, 'Map.gridShape': 'square', 'Map.gridSize': 20 },
    relations: [
      /* Zwei Felder Eis oben links. */
      { type: 'zone', to: eis.id, props: { kind: 'rect', x: 40 / 320, y: 0, w: 40 / 320, h: 20 / 240 } },
      { type: 'zone', to: falle.id, props: { kind: 'rect', x: 0.5, y: 0.5, w: 40 / 320, h: 40 / 240 } },
      { type: 'territory', to: bande.id, props: { kind: 'circle', x: 0.75, y: 0.3, r: 0.1, color: '#336699' } },
    ],
  });

  await leitung.goto(`/artikel/${karte.id}`);
  const gm = leitung.locator('svg.flaechen path.flaeche');
  await expect(gm).toHaveCount(3);
  await expect(leitung.locator('svg.flaechen path.versteckt')).toHaveCount(1);
  /* Das Eis sind zwei Felder, beschriftet mit seiner Regel. */
  const eisPfad = leitung.locator(`svg.flaechen path[data-name^="${eis.name}"]`);
  await expect(eisPfad).toHaveAttribute('data-name', `${eis.name} (difficult terrain)`);
  expect(((await eisPfad.getAttribute('d')) ?? '').match(/Z/g)).toHaveLength(2);
  /* Ausblenden ist eine Sache der Sicht. */
  const knopf = leitung.getByRole('button', { name: 'Areas', exact: true });
  await knopf.click();
  await expect(gm).toHaveCount(0);
  await knopf.click();
  await expect(gm).toHaveCount(3);

  await spielerin.goto(`/artikel/${karte.id}`);
  const sie = spielerin.locator('svg.flaechen path.flaeche');
  await expect(sie).toHaveCount(2);
  await expect(spielerin.locator(`svg.flaechen path[data-name^="${falle.name}"]`)).toHaveCount(0);
  await expect(spielerin.locator('.live.offen')).toHaveCount(1);

  /* Die Leitung findet die Grube — die Spielerin sieht sie ohne Neuladen. */
  const ctx = await api.als('leitung');
  const e = (await (await ctx.get(`/api/entities/${karte.id}`)).json()) as { relations: Kante[]; refs?: unknown };
  delete e.refs;
  const gefunden = e.relations.map((k) => (k.type === 'zone' && k.to === falle.id ? { ...k, props: { ...k.props, found: true } } : k));
  const res = await ctx.put(`/api/entities/${karte.id}`, { data: { ...e, relations: gefunden } });
  expect(res.ok(), await res.text()).toBe(true);
  await expect(sie).toHaveCount(3, { timeout: 10_000 });
  await expect(leitung.locator('svg.flaechen path.versteckt')).toHaveCount(0);
});
