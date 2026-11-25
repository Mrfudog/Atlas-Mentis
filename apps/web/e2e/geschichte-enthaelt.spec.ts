/**
 * **Arc, Szene und Session zeigen, was zu ihnen gehört** (T-422, REQ-427):
 * die Leitung hängt eine Szene (Encounter group) an ihr Kapitel (Arc) und
 * eine Begegnung an die Szene und an die Session — Arc und Szene zeigen sie
 * unter „Contains", die Session unter ihrer eigenen. Seit T-425 (Schnitt 3)
 * ist „Contains" eine Collection an `Story`: Kacheln in der Kurzansicht
 * ihrer Art, nach Art gruppiert. Ein Ort zeigt seine Unterorte und
 * Bewohner. Die Spielerin sieht eine geheime Szene nicht (gesiebt am
 * Server).
 */
import { test, expect } from './hilfen';

test('arc, scene and session show what hangs on them as tiles', async ({ leitung, spielerin, api, eindeutig }) => {
  const fertig = { Status: { status: 'ready' } };
  const arc = await api.anlegen('leitung', 'Arc', eindeutig('Escape from the mountain'));
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session 2'));
  const gruppe = await api.anlegen('leitung', 'Scene', eindeutig('Old mine'), { relations: [{ type: 'partOf', to: arc.id }] });
  const geheim = await api.anlegen('leitung', 'Scene', eindeutig('Hidden shaft'), { relations: [{ type: 'partOf', to: arc.id }] });
  const ratten = await api.anlegen('leitung', 'Encounter', eindeutig('Rats'), {
    fields: { 'Encounter.kind': ['combat', 'resource'] },
    relations: [{ type: 'partOf', to: gruppe.id }, { type: 'partOf', to: sitzung.id }],
  });
  for (const a of [arc, sitzung, gruppe, geheim, ratten]) await api.setzen('leitung', a.id, fertig);
  await api.setzen('leitung', geheim.id, { Visibility: { audience: 'gm' } });

  await leitung.goto(`/artikel/${arc.id}`);
  const enthaelt = leitung.getByRole('region', { name: 'Contains' });
  await expect(enthaelt.getByRole('link', { name: gruppe.name, exact: true })).toBeVisible();
  await expect(enthaelt.getByRole('link', { name: geheim.name, exact: true })).toBeVisible();
  /* Eine Kachel je Szene, in der Kurzansicht der Szene. */
  await expect(enthaelt.locator('.sammelkachel')).toHaveCount(2);

  await leitung.goto(`/artikel/${gruppe.id}`);
  const inSzene = leitung.getByRole('region', { name: 'Contains' });
  await expect(inSzene.getByRole('link', { name: ratten.name, exact: true })).toBeVisible();
  await expect(inSzene.getByRole('heading', { level: 4 })).toContainText('Encounter');

  /* Die Session zeigt ihre seit T-425 über eine Collection (sitzung-sammlung.spec.ts), nicht mehr unter „Contains". */
  await leitung.goto(`/artikel/${sitzung.id}`);
  const inSitzung = leitung.getByRole('region', { name: 'Scenes and encounters' });
  await expect(inSitzung.getByRole('link', { name: ratten.name, exact: true })).toBeVisible();
  await expect(inSitzung.getByRole('link', { name: gruppe.name })).toHaveCount(0);
  await expect(leitung.getByRole('region', { name: 'Contains' })).toHaveCount(0);

  await spielerin.goto(`/artikel/${arc.id}`);
  const ihre = spielerin.getByRole('region', { name: 'Contains' });
  await expect(ihre.getByRole('link', { name: gruppe.name, exact: true })).toBeVisible();
  await expect(ihre.getByRole('link', { name: geheim.name, exact: true })).toHaveCount(0);
});

test('a place shows the places within it and who lives there', async ({ leitung, api, eindeutig }) => {
  const fertig = { Status: { status: 'ready' } };
  const stadt = await api.anlegen('leitung', 'Place', eindeutig('Harbour town'));
  const gasse = await api.anlegen('leitung', 'Place', eindeutig('Fish lane'), { relations: [{ type: 'partOf', to: stadt.id }] });
  const wirtin = await api.anlegen('leitung', 'Creature', eindeutig('Marta'), { relations: [{ type: 'livesIn', to: stadt.id }] });
  for (const a of [stadt, gasse, wirtin]) await api.setzen('leitung', a.id, fertig);

  await leitung.goto(`/artikel/${stadt.id}`);
  await expect(leitung.getByRole('region', { name: 'Places within' }).getByRole('link', { name: gasse.name, exact: true })).toBeVisible();
  await expect(leitung.getByRole('region', { name: 'Residents' }).getByRole('link', { name: wirtin.name, exact: true })).toBeVisible();
});
