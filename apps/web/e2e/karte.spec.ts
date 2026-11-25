/**
 * Karte in Play (T-356, T-289, T-115): die Leitung nimmt eine Karte ins
 * Spiel, gibt sie frei und zieht einen Token; die Spielerin sieht den
 * offenen Marker — und den versteckten nicht (`redactMap` am Server).
 *
 * Jede Prüfung hat ihre eigene Sitzung: die laufende Kampagne ist eine
 * für alle Specs, eine Sitzung je Test hält die Tische auseinander.
 */
import { test, expect } from './hilfen';

test('a map in play: released, sieved for the player, a token dragged', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const wache = await api.anlegen('leitung', 'Creature', eindeutig('Guard'), { fields: { 'Status.status': 'ready' } });
  const lauerer = await api.anlegen('leitung', 'Creature', eindeutig('Lurker'), { fields: { 'Status.status': 'ready' } });
  const bild = await api.bild('leitung', eindeutig('yard'));
  const vorlage = await api.anlegen('leitung', 'Map', eindeutig('Yard'), {
    fields: { 'Status.status': 'ready', 'Image.image': bild, 'Map.gridSize': 40 },
    relations: [
      { type: 'marker', to: wache.id, props: { x: 0.25, y: 0.3 } },
      { type: 'marker', to: lauerer.id, props: { x: 0.7, y: 0.6, hidden: true } },
    ],
  });
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: { 'Status.status': 'ready' } });
  const genommen = await (await api.als('leitung')).post('/api/play/take', { data: { session: sitzung.id, map: vorlage.id } });
  expect(genommen.ok()).toBe(true);

  /* Vor der Freigabe liegt für die Spielerin keine Karte auf dem Tisch. */
  await spielerin.goto(`/play?session=${sitzung.id}`);
  await expect(spielerin.getByText(/No map is on the table/)).toBeVisible();
  await expect(spielerin.getByRole('button', { name: wache.name })).toHaveCount(0);

  await leitung.goto(`/play?session=${sitzung.id}`);
  const marke = leitung.getByRole('button', { name: wache.name, exact: true });
  await expect(marke).toBeVisible();
  await expect(leitung.getByRole('button', { name: `${lauerer.name} — hidden from the players` })).toBeVisible();
  /* Eine Karte im Spiel beginnt im Nebel (`newPlayInstance`); hier geht es
     um die Siebung der Marker, also deckt die Leitung alles auf. */
  await leitung.getByRole('button', { name: 'Fog', exact: true }).click();
  await leitung.getByRole('button', { name: 'Reveal all' }).click();
  await leitung.getByRole('button', { name: 'Select', exact: true }).click();
  /* Am Telefon stehen Sicht und Freigabe im Menü „View" (T-320). */
  const menue = leitung.getByRole('button', { name: 'View', exact: true });
  if (telefon) await menue.click();
  await leitung.getByRole('button', { name: 'Release to players' }).click();
  if (telefon && (await menue.getAttribute('aria-expanded')) !== 'true') await menue.click();
  await expect(leitung.getByRole('button', { name: 'Released' })).toBeVisible();
  if (telefon) await menue.click();

  /* Die Freigabe kommt über den Live-Kanal; neu laden prüft dasselbe ohne ihn. */
  await spielerin.reload();
  const ihreMarke = spielerin.getByRole('button', { name: wache.name, exact: true });
  await expect(ihreMarke).toBeVisible();
  await expect(spielerin.getByRole('button', { name: new RegExp(lauerer.name) })).toHaveCount(0);

  /* Ziehen: Maus auf die Mitte, ein Stück nach rechts unten, loslassen. */
  const vorher = await marke.boundingBox();
  if (!vorher) throw new Error('Der Token hat keine Lage.');
  const mitte = { x: vorher.x + vorher.width / 2, y: vorher.y + vorher.height / 2 };
  await leitung.mouse.move(mitte.x, mitte.y);
  await leitung.mouse.down();
  await leitung.mouse.move(mitte.x + 40, mitte.y + 30, { steps: 8 });
  await leitung.mouse.move(mitte.x + 80, mitte.y + 60, { steps: 8 });
  await leitung.mouse.up();
  await expect.poll(async () => (await marke.boundingBox())?.x ?? 0).toBeGreaterThan(vorher.x + 40);

  /* Gespeichert an der Instanz: die Spielerin sieht ihn nach dem Neuladen dort. */
  const ihreVorher = await ihreMarke.boundingBox();
  await expect
    .poll(async () => {
      await spielerin.reload();
      return (await ihreMarke.boundingBox())?.x ?? 0;
    })
    .toBeGreaterThan((ihreVorher?.x ?? 0) + 10);
});
