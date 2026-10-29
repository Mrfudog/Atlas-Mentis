/**
 * **Die Sitzung auf einen Blick** (T-151, REQ-282): unter dem, was läuft,
 * stehen die Szenen und Begegnungen der Sitzung, die Leute darin, wer
 * kämpft, die Orte und die Karten — über Collections zwei Schritte vom
 * Abend weg. Die Spielerin sieht nicht, was nur eine geheime Szene nennt.
 */
import { test, expect } from './hilfen';

test('a session shows the people, places and maps of its scenes and encounters', async ({ leitung, spielerin, api, eindeutig }) => {
  const fertig = { Status: { status: 'ready' } };
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session 4'));
  const volo = await api.anlegen('leitung', 'Creature', eindeutig('Volo'));
  const spitzel = await api.anlegen('leitung', 'Creature', eindeutig('The informer'));
  const ratte = await api.anlegen('leitung', 'Creature', eindeutig('Hired blade'));
  const hafen = await api.anlegen('leitung', 'Place', eindeutig('Harbour'));
  const keller = await api.anlegen('leitung', 'Map', eindeutig('Cellar'));
  const szene = await api.anlegen('leitung', 'Scene', eindeutig('At the docks'), {
    relations: [
      { type: 'partOf', to: sitzung.id },
      { type: 'features', to: volo.id },
      { type: 'happensAt', to: hafen.id },
    ],
  });
  const geheim = await api.anlegen('leitung', 'Scene', eindeutig('The meeting'), {
    relations: [
      { type: 'partOf', to: sitzung.id },
      { type: 'features', to: spitzel.id },
    ],
  });
  const kampf = await api.anlegen('leitung', 'Encounter', eindeutig('Rats in the cellar'), {
    relations: [
      { type: 'partOf', to: sitzung.id },
      /* Ein Verbündeter, aufgedeckt und erkannt: einen Gegner siebt der Server vor Kampfbeginn heute auch für eine Leitung ohne Verwaltungsrecht weg (T-455, E-208). */
      { type: 'participates', to: ratte.id, props: { revealed: true, identified: true, ally: true } },
      { type: 'onMap', to: keller.id },
    ],
  });
  for (const a of [sitzung, volo, spitzel, ratte, hafen, keller, szene, geheim, kampf]) await api.setzen('leitung', a.id, fertig);
  await api.setzen('leitung', geheim.id, { Visibility: { audience: 'gm' } });

  await leitung.goto(`/artikel/${sitzung.id}`);
  const leute = leitung.getByRole('region', { name: 'People in the scenes' });
  for (const a of [volo, spitzel]) await expect(leute.getByRole('link', { name: a.name, exact: true })).toBeVisible();
  await expect(leitung.getByRole('region', { name: 'In the fights' }).getByRole('link', { name: ratte.name, exact: true })).toBeVisible();
  await expect(leitung.getByRole('region', { name: 'Places' }).getByRole('link', { name: hafen.name, exact: true })).toBeVisible();
  await expect(leitung.getByRole('region', { name: 'Maps' }).getByRole('link', { name: keller.name, exact: true })).toBeVisible();
  /* Oben auf der Seite: die Sammlungen stehen vor der Vorbereitung und der Beschreibung. */
  const reihenfolge = await leitung.locator('[data-el^="se-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-el')));
  expect(reihenfolge.slice(0, 5)).toEqual(['se-contains', 'se-people', 'se-fight', 'se-places', 'se-maps']);

  await leute.getByRole('link', { name: volo.name, exact: true }).click();
  await expect(leitung).toHaveURL(new RegExp(`/artikel/${volo.id}`));

  await spielerin.goto(`/artikel/${sitzung.id}`);
  const ihre = spielerin.getByRole('region', { name: 'People in the scenes' });
  await expect(ihre.getByRole('link', { name: volo.name, exact: true })).toBeVisible();
  await expect(ihre.getByRole('link', { name: spitzel.name, exact: true })).toHaveCount(0);
  await expect(spielerin.getByRole('region', { name: 'Maps' }).getByRole('link', { name: keller.name, exact: true })).toBeVisible();
});
