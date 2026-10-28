/**
 * **Live-Abgleich** (T-399, REQ-398): was die Leitung auf der Karte
 * ändert, sieht die Spielerin ohne Neuladen — in einem zweiten Browser.
 * Ein verborgener Marker kommt bei ihr nicht an. Reisst ihre Verbindung
 * ab, holt die Seite nach, was dazwischen geschah. Erfundene Artikel.
 */
import { test, expect } from './hilfen';

interface Kante {
  id: string;
  type: string;
  to: string;
  props?: Record<string, unknown>;
}

test('a token the GM moves moves for the player — also after the connection dropped', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const fertig = { 'Status.status': 'ready' };
  const wache = await api.anlegen('leitung', 'Statblock', eindeutig('Gate guard'), { fields: fertig });
  const lauer = await api.anlegen('leitung', 'Statblock', eindeutig('Lurker'), { fields: fertig });
  const bild = await api.bild('leitung', eindeutig('yard'));
  const vorlage = await api.anlegen('leitung', 'Map', eindeutig('Yard'), {
    fields: { ...fertig, 'Image.image': bild, 'Map.gridSize': 16 },
    relations: [{ type: 'marker', to: wache.id, props: { x: 0.25, y: 0.5 } }],
  });
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: fertig });
  const gm = await api.als('leitung');
  expect((await gm.post('/api/play/take', { data: { session: sitzung.id, map: vorlage.id } })).ok()).toBe(true);
  const karte = ((await (await gm.get(`/api/play?session=${sitzung.id}`)).json()) as { map: string }).map;

  /* Aufdecken und freigeben (am Telefon im Menü „View"). */
  await leitung.goto(`/play?session=${sitzung.id}`);
  await expect(leitung.getByRole('button', { name: wache.name, exact: true })).toBeVisible();
  await leitung.getByRole('button', { name: 'Fog', exact: true }).click();
  await leitung.getByRole('button', { name: 'Reveal all' }).click();
  await leitung.getByRole('button', { name: 'Select', exact: true }).click();
  const menue = leitung.getByRole('button', { name: 'View', exact: true });
  if (telefon) await menue.click();
  await leitung.getByRole('button', { name: 'Release to players' }).click();
  await expect(leitung.getByRole('button', { name: 'Released' })).toBeVisible();

  await spielerin.goto(`/play?session=${sitzung.id}`);
  const token = spielerin.getByRole('button', { name: wache.name, exact: true });
  await expect(token).toBeVisible();
  await expect(spielerin.locator('.live.offen')).toHaveCount(1);
  const links = async () => (await token.boundingBox())?.x ?? 0;
  const vorher = await links();

  /** Die Karte als Leitung ändern, wie es jede Seite tut: lesen, ändern, mit der Revision schreiben. */
  const aendere = async (f: (kanten: Kante[]) => Kante[]) => {
    const e = (await (await gm.get(`/api/entities/${karte}`)).json()) as { relations: Kante[]; refs?: unknown };
    delete e.refs;
    const res = await gm.put(`/api/entities/${karte}`, { data: { ...e, relations: f(e.relations) } });
    expect(res.ok(), await res.text()).toBe(true);
  };
  const zieh = (x: number) => (kanten: Kante[]) =>
    kanten.map((k) => (k.type === 'marker' && k.to === wache.id ? { ...k, props: { ...k.props, x } } : k));

  /* Die Leitung zieht — die Spielerin sieht es ohne Neuladen. */
  await aendere(zieh(0.75));
  await expect.poll(links, { timeout: 5_000 }).toBeGreaterThan(vorher + 20);
  const mitte = await links();

  /* Ein verborgener Lauerer kommt bei ihr nicht an. */
  await aendere((k) => [...k, { id: `mk-${Date.now()}`, type: 'marker', to: lauer.id, props: { x: 0.5, y: 0.5, hidden: true } }]);
  await expect(leitung.getByRole('button', { name: `${lauer.name} — hidden from the players`, exact: true })).toBeVisible();
  await expect(spielerin.getByRole('button', { name: new RegExp(lauer.name) })).toHaveCount(0);

  /* Die Verbindung reisst ab; inzwischen zieht die Leitung zurück. Wieder
     online, holt die Seite das nach — ohne Neuladen. */
  await spielerin.context().setOffline(true);
  await aendere(zieh(0.25));
  await spielerin.context().setOffline(false);
  await expect.poll(links, { timeout: 20_000 }).toBeLessThan(mitte - 20);
  await expect(spielerin.locator('.live.offen')).toHaveCount(1, { timeout: 20_000 });
});
