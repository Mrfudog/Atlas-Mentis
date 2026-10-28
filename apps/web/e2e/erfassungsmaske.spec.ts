/**
 * **Erfassungsmasken** (T-425, REQ-432, E-169): gestaltet eine Art ihre
 * ausführliche Maske `createFull`, öffnet „New article“ den neuen Artikel
 * im Bearbeiten mit genau deren Feldern vorn — auch leer, die übrigen
 * hinter „+ Add field“. Ohne Gestaltung bleibt es beim Heutigen.
 *
 * Die Maske steht an `Deity` und wird danach wieder entfernt; das Register
 * schreibt nur, wer die Sperre hält.
 */
import type { APIRequestContext } from '@playwright/test';
import { test, expect, mitSperre } from './hilfen';

type Ifs = Record<string, Record<string, unknown>>;

async function maskeSetzen(api: APIRequestContext, an: boolean): Promise<void> {
  const ifs = ((await (await api.get('/api/registry')).json()) as { interfaces: Ifs }).interfaces;
  const deity = ifs['Deity']!;
  const views = { ...((deity['views'] as Record<string, unknown> | undefined) ?? {}) };
  if (an) views['createFull'] = [{ id: 'cf-deity', el: 'fields', fields: ['Deity.symbol', 'Deity.pantheon'] }];
  else delete views['createFull'];
  deity['views'] = views;
  const res = await api.put('/api/registry/interfaces', { data: ifs });
  expect(res.ok(), await res.text()).toBe(true);
}

test('a type with a designed full create form opens new articles in that form', async ({ leitung, api, eindeutig }) => {
  const als = await api.als('leitung');
  await mitSperre(async () => {
    await maskeSetzen(als, true);
    try {
      const name = eindeutig('Keeper of tides');
      await leitung.goto('/compendium?type=Deity');
      await leitung.getByRole('button', { name: 'New article', exact: true }).click();
      const dialog = leitung.getByRole('dialog');
      await dialog.locator('select').first().selectOption('Deity');
      await dialog.getByRole('textbox').first().fill(name);
      await dialog.getByRole('button', { name: 'Create', exact: true }).click();

      await expect(leitung).toHaveURL(/edit=create/);
      const symbol = leitung.locator('.maske label[data-ref="Deity.symbol"]');
      const pantheon = leitung.locator('.maske label[data-ref="Deity.pantheon"]');
      await expect(symbol).toBeVisible();
      await expect(pantheon).toBeVisible();
      /* In der Reihenfolge der Maske, und was sie nicht nennt, bleibt hinter „+ Add field“. */
      const reihe = await leitung.locator('.maske label[data-ref]').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-ref')));
      expect(reihe.filter((r) => r !== 'layer').slice(0, 2)).toEqual(['Deity.symbol', 'Deity.pantheon']);
      await expect(leitung.locator('.maske label[data-ref="Deity.province"]')).toHaveCount(0);
      /* Die Masken sind keine Leseansicht: die Leiste „Views" bietet sie nicht an. */
      await expect(leitung.locator('nw-ansichtswahl').getByRole('button', { name: /^Create/ })).toHaveCount(0);

      await symbol.locator('input').fill('A shell');
      await leitung.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(leitung.getByText('A shell').first()).toBeVisible();
    } finally {
      await maskeSetzen(als, false);
    }
  });
});
