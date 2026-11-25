/**
 * Icons im Register (T-461, REQ-460): die Art trägt eines, die Liste und
 * die Kurzansicht zeigen es vor dem Namen, der Kopf der Artikelseite
 * ebenso; ein Artikel wählt im Bearbeiten ein eigenes über den Wähler
 * (Suche nach Tag), und die Spielerin sieht dasselbe Icon. Im Register
 * setzt die Leitung das Icon einer Art über denselben Wähler.
 *
 * Das Register schreibt nur, wer die Sperre hält; `Deity` bekommt ein
 * Icon und danach wieder das alte.
 */
import type { APIRequestContext } from '@playwright/test';
import { test, expect, mitSperre } from './hilfen';

type Ifs = Record<string, Record<string, unknown>>;

async function typIconSetzen(api: APIRequestContext, typ: string, icon: string | null): Promise<string | null> {
  const ifs = ((await (await api.get('/api/registry')).json()) as { interfaces: Ifs }).interfaces;
  const def = ifs[typ]!;
  const vorher = (def['icon'] as string | undefined) ?? null;
  if (icon) def['icon'] = icon;
  else delete def['icon'];
  const res = await api.put('/api/registry/interfaces', { data: ifs });
  expect(res.ok(), await res.text()).toBe(true);
  return vorher;
}

test('a type icon shows in the list, the quick view and the title; an article picks its own', async ({ leitung, spielerin, api, eindeutig }) => {
  const als = await api.als('leitung');
  const name = eindeutig('Tidemother');
  const gott = await api.anlegen('leitung', 'Deity', name);
  await mitSperre(async () => {
    const vorher = await typIconSetzen(als, 'Deity', 'star');
    try {
      /* Die Liste: das Icon der Art vor dem Namen. */
      await leitung.goto(`/compendium?type=Deity&q=${encodeURIComponent(name)}`);
      const zeile = leitung.locator('tr', { has: leitung.getByRole('link', { name, exact: true }) }).first();
      await expect(zeile.locator('nw-icon[data-icon="star"]')).toBeVisible();

      /* Die Kurzansicht: dasselbe Icon in der Überschrift. Am Telefon
         öffnet sie der Knopf der Zeile, am Desktop die Zeile selbst (T-093). */
      const info = zeile.getByRole('button', { name: `Quick view of ${name}` });
      if (await info.isVisible()) await info.click();
      else await zeile.click();
      const karte = leitung.locator('nw-vorschau').first();
      await expect(karte.locator('h2 nw-icon[data-icon="star"]')).toBeVisible();

      /* Der Kopf der Artikelseite. */
      await leitung.goto(`/artikel/${gott.id}`);
      await expect(leitung.locator('h1 nw-icon[data-icon="star"]')).toBeVisible();

      /* Ein eigenes Icon: Bearbeiten › + Add field › Icon, der Wähler sucht nach Tag. */
      await leitung.getByRole('button', { name: 'Edit', exact: true }).click();
      await leitung.getByRole('button', { name: /Add field/ }).click();
      const wahl = leitung.getByRole('dialog').or(leitung.locator('.feldwahl'));
      await wahl.getByRole('searchbox').or(wahl.getByRole('textbox')).first().fill('Icon');
      await wahl.getByRole('button', { name: /^Icon\b/ }).first().click();
      const feld = leitung.locator('.maske label[data-ref="Identity.icon"]');
      await expect(feld).toBeVisible();
      await expect(feld.locator('.jetzt')).toContainText('inherited — star');
      await feld.locator('.jetzt').click();
      await feld.getByRole('searchbox').fill('world');
      await feld.locator('.raster .icon', { hasText: 'globe' }).click();
      await expect(feld.locator('.jetzt')).toContainText('globe');
      await leitung.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(leitung.locator('h1 nw-icon[data-icon="globe"]')).toBeVisible();

      /* Die Spielerin sieht dasselbe eigene Icon — gesiebt wie jedes Feld,
         also erst, wenn der Artikel fertig ist (D72). */
      await api.setzen('leitung', gott.id, { Status: { status: 'ready' } });
      await spielerin.goto(`/artikel/${gott.id}`);
      await expect(spielerin.locator('h1 nw-icon[data-icon="globe"]')).toBeVisible();
    } finally {
      await typIconSetzen(als, 'Deity', vorher);
    }
  });
});

test('the registry sets the icon of a type with the picker and shows it on the type', async ({ leitung, api }) => {
  const als = await api.als('leitung');
  await mitSperre(async () => {
    const vorher = await typIconSetzen(als, 'Deity', null);
    try {
      await leitung.goto('/registry?type=Deity');
      const wahl = leitung.locator('nw-reg-typ nw-icon-wahl').first();
      await expect(wahl.locator('.jetzt')).toContainText('none');
      await wahl.locator('.jetzt').click();
      await wahl.getByRole('searchbox').fill('deity');
      await wahl.locator('.raster .icon', { hasText: 'star' }).click();
      await expect(wahl.locator('.jetzt')).toContainText('star');
      await expect(leitung.locator('nw-reg-typ h2 nw-icon[data-icon="star"]')).toBeVisible();
      /* Gespeichert: die API trägt es. */
      await expect
        .poll(async () => ((await (await als.get('/api/registry')).json()) as { interfaces: Ifs }).interfaces['Deity']!['icon'])
        .toBe('star');
    } finally {
      await typIconSetzen(als, 'Deity', vorher);
    }
  });
});
