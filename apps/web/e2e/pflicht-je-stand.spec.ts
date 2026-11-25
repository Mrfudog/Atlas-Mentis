/**
 * **Pflicht je Stand** (T-425, REQ-441, E-177, E-178): ist an einer Art
 * die Beschreibung für `ready` Pflicht, lässt die Maske eine Idee ohne
 * Beschreibung nicht auf `ready` setzen und sagt, was fehlt. Mit
 * Beschreibung geht es, und erst dann sieht die Spielerin den Artikel.
 *
 * Die Pflicht steht an `Deity`, die kein anderer Spec anlegt, und wird
 * danach wieder entfernt; das Register schreibt nur, wer die Sperre hält.
 */
import type { APIRequestContext } from '@playwright/test';
import { test, expect, mitSperre } from './hilfen';

type Ifs = Record<string, Record<string, unknown>>;

async function pflichtSetzen(api: APIRequestContext, an: boolean): Promise<void> {
  const ifs = ((await (await api.get('/api/registry')).json()) as { interfaces: Ifs }).interfaces;
  const deity = ifs['Deity']!;
  if (an) deity['requiredFor'] = { 'Description.description': 'ready' };
  else delete deity['requiredFor'];
  const res = await api.put('/api/registry/interfaces', { data: ifs });
  expect(res.ok(), await res.text()).toBe(true);
}

test('a type that needs a description to be ready refuses ready without one and says what is missing', async ({
  leitung,
  spielerin,
  api,
  eindeutig,
}) => {
  const als = await api.als('leitung');
  await mitSperre(async () => {
    await pflichtSetzen(als, true);
    try {
      const gott = await api.anlegen('leitung', 'Deity', eindeutig('Lantern-keeper'));

      await leitung.goto(`/artikel/${gott.id}`);
      await leitung.getByRole('button', { name: 'Edit', exact: true }).click();
      await leitung.locator('label[data-ref="Status.status"] select').selectOption('ready');
      await leitung.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(leitung.getByText('To set ready, fill in: Description.').first()).toBeVisible();

      await spielerin.goto(`/artikel/${gott.id}`);
      await expect(spielerin.getByRole('heading', { name: gott.name })).toHaveCount(0);

      await api.setzen('leitung', gott.id, { Description: { description: 'Keeps the lamps of the dead.' } });
      await api.setzen('leitung', gott.id, { Status: { status: 'ready' } });
      await spielerin.goto(`/artikel/${gott.id}`);
      await expect(spielerin.getByRole('heading', { name: gott.name }).first()).toBeVisible();
    } finally {
      await pflichtSetzen(als, false);
    }
  });
});
