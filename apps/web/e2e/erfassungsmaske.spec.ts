/**
 * **Erfassungsmasken** (T-425, REQ-432, E-169): gestaltet eine Art ihre
 * ausführliche Maske `createFull`, öffnet „New article“ den neuen Artikel
 * im Bearbeiten mit genau deren Feldern vorn — auch leer, die übrigen
 * hinter „+ Add field“. Ohne Gestaltung bleibt es beim Heutigen.
 *
 * Die Maske steht an `Deity` und wird danach wieder entfernt; das Register
 * schreibt nur, wer die Sperre hält.
 */
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, mitSperre } from './hilfen';

type Ifs = Record<string, Record<string, unknown>>;

const MASKE = [{ id: 'cf-deity', el: 'fields', fields: ['Deity.symbol', 'Deity.pantheon'] }];
/* Ein Ablauf (REQ-440, E-176): zwei Seiten, je ein Abschnitt. */
const ABLAUF = [
  {
    id: 'cf-steps',
    el: 'steps',
    children: [
      { id: 'cf-s1', el: 'section', text: 'Signs', children: [{ id: 'cf-f1', el: 'fields', fields: ['Deity.symbol'] }] },
      { id: 'cf-s2', el: 'section', text: 'Realm', children: [{ id: 'cf-f2', el: 'fields', fields: ['Deity.pantheon'] }] },
    ],
  },
];

async function maskeSetzen(api: APIRequestContext, maske: unknown[] | null): Promise<void> {
  const ifs = ((await (await api.get('/api/registry')).json()) as { interfaces: Ifs }).interfaces;
  const deity = ifs['Deity']!;
  const views = { ...((deity['views'] as Record<string, unknown> | undefined) ?? {}) };
  if (maske) views['createFull'] = maske;
  else delete views['createFull'];
  deity['views'] = views;
  const res = await api.put('/api/registry/interfaces', { data: ifs });
  expect(res.ok(), await res.text()).toBe(true);
}

test('a type with a designed full create form opens new articles in that form', async ({ leitung, api, eindeutig }) => {
  const als = await api.als('leitung');
  await mitSperre(async () => {
    await maskeSetzen(als, MASKE);
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
      await maskeSetzen(als, null);
    }
  });
});

async function neuerGott(seite: Page, name: string): Promise<void> {
  await seite.goto('/compendium?type=Deity');
  await seite.getByRole('button', { name: 'New article', exact: true }).click();
  const dialog = seite.getByRole('dialog');
  await dialog.locator('select').first().selectOption('Deity');
  await dialog.getByRole('textbox').first().fill(name);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(seite).toHaveURL(/edit=create/);
}

test('a create form with steps shows one page at a time, with Back and Next', async ({ leitung, api, eindeutig }) => {
  const als = await api.als('leitung');
  await mitSperre(async () => {
    await maskeSetzen(als, ABLAUF);
    try {
      await neuerGott(leitung, eindeutig('Warden of roads'));
      const schritte = leitung.getByRole('navigation', { name: 'Steps' });
      await expect(schritte.getByRole('button', { name: '1. Signs' })).toHaveAttribute('aria-current', 'step');
      await expect(leitung.locator('.maske label[data-ref="Deity.symbol"]')).toBeVisible();
      await expect(leitung.locator('.maske label[data-ref="Deity.pantheon"]')).toHaveCount(0);

      await leitung.locator('.maske label[data-ref="Deity.symbol"] input').fill('A milestone');
      await leitung.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(schritte.getByRole('button', { name: '2. Realm' })).toHaveAttribute('aria-current', 'step');
      await expect(leitung.locator('.maske label[data-ref="Deity.pantheon"]')).toBeVisible();
      await leitung.locator('.maske label[data-ref="Deity.pantheon"] input').fill('Wayfarers');
      await leitung.getByRole('button', { name: 'Save', exact: true }).click();
      /* Was auf der ersten Seite stand, ist mit gespeichert. */
      await expect(leitung.getByText('A milestone').first()).toBeVisible();
      await expect(leitung.getByText('Wayfarers').first()).toBeVisible();
    } finally {
      await maskeSetzen(als, null);
    }
  });
});

test('New article for a player character opens the character builder (E-169)', async ({ leitung, eindeutig }) => {
  const name = eindeutig('Tamsin');
  await leitung.goto('/compendium?type=PlayerCharacter');
  await leitung.getByRole('button', { name: 'New article', exact: true }).click();
  const dialog = leitung.getByRole('dialog');
  await dialog.locator('select').first().selectOption('PlayerCharacter');
  await dialog.getByRole('textbox').first().fill(name);
  await dialog.getByRole('button', { name: 'Open the builder', exact: true }).click();
  await expect(leitung).toHaveURL(/\/characters\/new/);
  await expect(leitung.getByRole('heading', { name: 'New character' })).toBeVisible();
});
