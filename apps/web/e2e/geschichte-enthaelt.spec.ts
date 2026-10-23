/**
 * **Arc, Szene und Session zeigen, was zu ihnen gehört** (T-422, REQ-427):
 * die Leitung hängt eine Szene (Encounter group) an ihr Kapitel (Arc) und
 * eine Begegnung an die Szene und an die Session — die Seiten zeigen sie
 * unter „Contains", die Session nur ihre. Die Spielerin sieht eine
 * geheime Szene nicht (gesiebt am Server).
 */
import { test, expect } from './hilfen';

test('arc, scene and session list what hangs on them under Contains', async ({ leitung, spielerin, api, eindeutig }) => {
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
  await expect(enthaelt.getByRole('link', { name: gruppe.name })).toBeVisible();
  await expect(enthaelt.getByRole('link', { name: geheim.name })).toBeVisible();

  await leitung.goto(`/artikel/${gruppe.id}`);
  await expect(leitung.getByRole('region', { name: 'Contains' })).toContainText('combat, resource');

  await leitung.goto(`/artikel/${sitzung.id}`);
  const inSitzung = leitung.getByRole('region', { name: 'Contains' });
  await expect(inSitzung.getByRole('link', { name: ratten.name })).toBeVisible();
  await expect(inSitzung.getByRole('link', { name: gruppe.name })).toHaveCount(0);

  await spielerin.goto(`/artikel/${arc.id}`);
  const ihre = spielerin.getByRole('region', { name: 'Contains' });
  await expect(ihre.getByRole('link', { name: gruppe.name })).toBeVisible();
  await expect(ihre.getByRole('link', { name: geheim.name })).toHaveCount(0);
});
