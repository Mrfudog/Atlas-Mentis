/**
 * **Die Session zeigt ihre Szenen und Begegnungen über eine Collection**
 * (T-425, REQ-430): je Treffer eine Kachel mit seiner eigenen Kurzansicht,
 * nach Art gruppiert. Die Spielerin sieht eine geheime Szene nicht (gesiebt
 * am Server); ein Klick auf den Namen öffnet den Artikel.
 */
import { test, expect } from './hilfen';

test('a session shows its scenes and encounters as tiles in their own quick view', async ({ leitung, spielerin, api, eindeutig }) => {
  const fertig = { Status: { status: 'ready' } };
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session 3'));
  const alter = await api.anlegen('leitung', 'Scene', eindeutig('The old man'), {
    fields: { 'Description.description': 'He waits at the crossroads.' },
    relations: [{ type: 'partOf', to: sitzung.id }],
  });
  const geheim = await api.anlegen('leitung', 'Scene', eindeutig('The mine'), { relations: [{ type: 'partOf', to: sitzung.id }] });
  const ratten = await api.anlegen('leitung', 'Encounter', eindeutig('Rats'), { relations: [{ type: 'partOf', to: sitzung.id }] });
  for (const a of [sitzung, alter, geheim, ratten]) await api.setzen('leitung', a.id, fertig);
  await api.setzen('leitung', geheim.id, { Visibility: { audience: 'gm' } });

  await leitung.goto(`/artikel/${sitzung.id}`);
  const sammlung = leitung.getByRole('region', { name: 'Scenes and encounters' });
  await expect(sammlung.getByRole('heading', { level: 3 })).toContainText('3');
  await expect(sammlung.getByRole('heading', { level: 4 })).toHaveCount(2);
  for (const a of [alter, geheim, ratten]) await expect(sammlung.getByRole('link', { name: a.name, exact: true })).toBeVisible();
  /* Die Kachel ist die Kurzansicht der Szene: ihre Beschreibung steht darin. */
  await expect(sammlung.locator('.sammelkachel', { hasText: alter.name })).toContainText('He waits at the crossroads.');

  await sammlung.getByRole('link', { name: alter.name, exact: true }).click();
  await expect(leitung).toHaveURL(new RegExp(`/artikel/${alter.id}`));

  await spielerin.goto(`/artikel/${sitzung.id}`);
  const ihre = spielerin.getByRole('region', { name: 'Scenes and encounters' });
  await expect(ihre.getByRole('link', { name: alter.name, exact: true })).toBeVisible();
  await expect(ihre.getByRole('link', { name: ratten.name, exact: true })).toBeVisible();
  await expect(ihre.getByRole('link', { name: geheim.name, exact: true })).toHaveCount(0);
});
