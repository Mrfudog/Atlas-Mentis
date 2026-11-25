/**
 * Die Klappleiste (T-220, REQ-361): auf der Kampagnenseite (Layers) alles
 * zu- und aufklappen und von Bereich zu Bereich springen, in der
 * Leseansicht von Abschnitt zu Abschnitt und am Ende ins nächste Kapitel.
 * Am Telefon steht die Leiste unten fest.
 *
 * Die Leiste ändert nichts am Server; der Stand der Ebenengruppen wird am
 * Konto gemerkt wie bei einem Klick (`layerGroups`). Die Kampagnenseite
 * prüft darum die Leitung (sie schaltet die Ebenen), die Leseansicht beide
 * Rollen — dort siebt der Server, und die Spielerin liest dasselbe Buch.
 */
import { test, expect, type Api } from './hilfen';
import type { Page } from '@playwright/test';
import type { Lauf } from './stand';

async function leiste(seite: Page, telefon: boolean, name: string) {
  const l = seite.getByRole('toolbar', { name });
  await expect(l).toBeVisible();
  if (telefon) {
    /* Am Telefon unten fest — bei Spielenden über ihrer eigenen Leiste,
       also nicht ganz am Rand, aber im unteren Teil und nicht verdeckt. */
    const box = (await l.boundingBox())!;
    const hoehe = seite.viewportSize()!.height;
    expect(box.y + box.height).toBeLessThanOrEqual(hoehe + 1);
    expect(box.y).toBeGreaterThan(hoehe - 160);
    const oben = await seite.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('nw-klappleiste'),
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(oben).toBe(true);
  }
  return l;
}

test('campaign layers: collapse all, expand all and jump between sections', async ({ leitung, lauf }, info) => {
  const telefon = info.project.name === 'phone';
  await leitung.goto(`/campaign?c=${lauf.campaign.id}&tab=layers`);
  const l = await leiste(leitung, telefon, 'Layer sections');
  const bereiche = leitung.locator('nw-kampagnen-ebenen details[data-bereich]');
  await expect(bereiche.first()).toBeVisible();
  const zahl = await bereiche.count();
  expect(zahl).toBeGreaterThanOrEqual(4);

  await l.getByRole('button', { name: 'Collapse all' }).click();
  for (let i = 0; i < zahl; i++) await expect(bereiche.nth(i)).not.toHaveAttribute('open', '');
  await l.getByRole('button', { name: 'Expand all' }).click();
  for (let i = 0; i < zahl; i++) await expect(bereiche.nth(i)).toHaveAttribute('open', '');

  /* Mit der Tastatur: Alt+Shift+↑ klappt alles zu, Alt+↓ springt in den
     nächsten Bereich und klappt ihn auf. */
  await leitung.keyboard.press('Alt+Shift+ArrowUp');
  await expect(bereiche.first()).not.toHaveAttribute('open', '');
  await leitung.keyboard.press('Alt+ArrowDown');
  const erster = bereiche.first();
  await expect(erster).toHaveAttribute('open', '');
  await expect(erster.locator(':scope > summary')).toBeFocused();
  await l.getByRole('button', { name: 'Next section' }).click();
  await expect(bereiche.nth(1).locator(':scope > summary')).toBeFocused();
  await l.getByRole('button', { name: 'Previous section' }).click();
  await expect(erster.locator(':scope > summary')).toBeFocused();

  /* Gemerkt am Konto: nach dem Neuladen steht „Extra content" so, wie es
     verlassen wurde (zugeklappt). Nur am Desktop — beide Projekte sind
     dieselbe Leitung, und ihr Stand ist einer. */
  if (telefon) return;
  const extra = leitung.locator('details[data-bereich]', { hasText: 'Extra content' });
  await expect(extra).not.toHaveAttribute('open', '');
  await leitung.waitForTimeout(600);
  await leitung.reload();
  await expect(extra).toBeVisible();
  await expect(extra).not.toHaveAttribute('open', '');
  /* Aufräumen für den nächsten Lauf. */
  await (await leiste(leitung, telefon, 'Layer sections')).getByRole('button', { name: 'Expand all' }).click();
  await leitung.waitForTimeout(600);
});

/** Ein Buch in einer eigenen Ebene: zwei Kapitel (Arcs), das erste mit drei Szenen. */
async function buch(api: Api, lauf: Lauf, eindeutig: (n: string) => string) {
  const ctx = await api.als('leitung');
  const res = await ctx.post('/api/layers', { data: { name: eindeutig('Book') } });
  expect(res.ok()).toBe(true);
  const ebene = ((await res.json()) as { id: string }).id;
  expect((await ctx.post(`/api/campaigns/${lauf.campaign.id}/layers/${ebene}`)).ok()).toBe(true);
  const fertig = { 'Status.status': 'ready' };
  const inEbene = { type: 'inLayer', to: ebene };
  const eins = await api.anlegen('leitung', 'Arc', eindeutig('Chapter One'), { fields: fertig, relations: [inEbene] });
  const szenen = [];
  for (const n of ['Gate', 'Hall', 'Vault']) {
    szenen.push(
      await api.anlegen('leitung', 'Scene', eindeutig(n), {
        fields: fertig,
        relations: [inEbene, { type: 'partOf', to: eins.id }],
      }),
    );
  }
  const zwei = await api.anlegen('leitung', 'Arc', eindeutig('Chapter Two'), { fields: fertig, relations: [inEbene] });
  return { ebene, eins, szenen, zwei };
}

test('reader: previous and next section, and on into the next chapter', async ({ leitung, spielerin, api, lauf, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const b = await buch(api, lauf, eindeutig);
  for (const seite of [leitung, spielerin]) {
    await seite.goto(`/read/${b.ebene}?at=${b.szenen[0]!.id}`);
    const abschnitt = (id: string) => seite.locator(`section.abschnitt[data-id="${id}"]`);
    await expect(abschnitt(b.szenen[0]!.id)).toBeVisible();
    /* Die Leseansicht scrollt nach den Bildern ein zweites Mal hin (bis 1,5 s);
       danach von oben, damit „Next" ohne Fokus beim ersten Abschnitt anfängt. */
    await seite.waitForTimeout(1700);
    await seite.evaluate(() => window.scrollTo(0, 0));
    const l = await leiste(seite, telefon, 'Sections of this chapter');
    /* Ohne Klappbares stehen nur die Sprünge da. */
    await expect(l.getByRole('button', { name: 'Expand all' })).toHaveCount(0);

    await l.getByRole('button', { name: 'Next section' }).click();
    await expect(abschnitt(b.eins.id)).toBeFocused();
    await l.getByRole('button', { name: 'Next section' }).click();
    await expect(abschnitt(b.szenen[0]!.id)).toBeFocused();
    await seite.keyboard.press('Alt+ArrowDown');
    await expect(abschnitt(b.szenen[1]!.id)).toBeFocused();
    await seite.keyboard.press('Alt+ArrowUp');
    await expect(abschnitt(b.szenen[0]!.id)).toBeFocused();
    await seite.keyboard.press('Alt+ArrowDown');
    await seite.keyboard.press('Alt+ArrowDown');
    await expect(abschnitt(b.szenen[2]!.id)).toBeFocused();

    /* Hinter dem letzten Abschnitt: das nächste Kapitel. */
    await l.getByRole('button', { name: 'Next section' }).click();
    await expect(abschnitt(b.zwei.id)).toBeVisible();
    await expect(abschnitt(b.szenen[0]!.id)).toHaveCount(0);
  }
});
