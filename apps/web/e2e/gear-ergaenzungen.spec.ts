/**
 * Das Gear erklärt sich (T-365, E-153): die Zeile zum Tragraster mit der
 * Stärke, aus der das Zusatzquadrat kommt (V1); die Ziehzeit mit
 * Begründung, auch im Behälter (V2); die Legende statt Kürzeln (V3); kein
 * Zonenmalen im Gear, für die Leitung nur der Weg zu Rules & options (V4);
 * Körperplätze mit Ringen je Hand und Einstimmung (V5); Behälter als
 * eigene, zuklappbare Bereiche (V7). Alles eigene kleine Testartikel der
 * Spielerin, keine Regelwerksdaten.
 */
import { test, expect } from './hilfen';
import type { Locator, Page } from '@playwright/test';

/** In die Mitte holen, damit Kopf- und Fussleiste am Telefon nicht davor liegen. */
const klick = async (l: Locator) => {
  await l.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await l.click();
};

const keinSeitwaertsScroll = async (seite: Page) =>
  expect(await seite.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test('the gear explains its grid and draw times, and wears rings with attunement', async ({ leitung, spielerin, api, eindeutig }, info) => {
  /* Desktop und Telefon teilen das Konto: geklappt wird nur am Desktop, sonst klappt einer dem anderen um. */
  const telefon = info.project.name === 'phone';
  const fertig = {};
  const ring = await api.anlegen('spielerin', 'Item', eindeutig('Ring of Warmth'), {
    fields: { ...fertig, 'Item.itemType': 'ring', 'Item.attunement': true },
  });
  const ruestung = await api.anlegen('spielerin', 'Item', eindeutig('Leather Armor'), { fields: { ...fertig, 'Item.itemType': 'light armor' } });
  const kerze = await api.anlegen('spielerin', 'Item', eindeutig('Candle'), { fields: { ...fertig, 'Item.itemType': 'adventuring gear' } });
  const innen = await api.anlegen('spielerin', 'Inventory', eindeutig('Bag inside'), {
    fields: fertig,
    relations: [{ type: 'holds', to: kerze.id, props: { gx: 0, gy: 0, tier: 'pack' } }],
  });
  const beutel = await api.anlegen('spielerin', 'Item', eindeutig('Bag of Holding'), {
    fields: { ...fertig, 'Item.itemType': 'wondrous item' },
    relations: [{ type: 'carries', to: innen.id }],
  });
  const inventar = await api.anlegen('spielerin', 'Inventory', eindeutig('Carried'), {
    fields: fertig,
    relations: [
      { type: 'holds', to: ring.id, props: { gx: 0, gy: 0, tier: 'pack' } },
      { type: 'holds', to: ruestung.id, props: { gx: 1, gy: 0, tier: 'pack' } },
      { type: 'holds', to: beutel.id, props: { gx: 2, gy: 0, tier: 'pack' } },
    ],
  });
  const figur = await api.anlegen('spielerin', 'PlayerCharacter', eindeutig('Rook'), {
    fields: fertig,
    relations: [{ type: 'carries', to: inventar.id }],
  });
  await api.anlegen('spielerin', 'Statblock', eindeutig('Rook stats'), {
    fields: { ...fertig, 'Statblock.size': 'small', 'Abilities.str': 14 },
    relations: [{ type: 'belongsTo', to: figur.id }],
  });

  const s = spielerin;
  await s.goto(`/artikel/${figur.id}?tab=gear`);

  /* V1: die Herleitung über dem Raster. */
  await expect(s.locator('.tragzeile').first()).toHaveText('Small 4×4 + extra 2×2 (STR 14 → +2)');
  await expect(s.locator('.raster .zelle.naht').first()).toBeAttached();
  await expect(s.locator('.raster .zelle.gesperrt').first()).toBeAttached();
  /* V3: Legende, keine Kürzel in den Zellen. */
  await expect(s.getByLabel('Zones').first()).toContainText('blocked');
  /* V4: kein Zonenmalen im Gear. */
  await expect(s.getByRole('button', { name: 'Shape & zones' })).toHaveCount(0);

  /* V7: der Beutel ist ein eigener Bereich; V2: was darin liegt, nennt den Beutel. */
  const bereich = s.getByRole('region', { name: beutel.name });
  await expect(bereich).toBeVisible();
  await expect(bereich).toContainText(kerze.name);
  await expect(bereich.locator('.zieh').first()).toContainText(`${beutel.name} +1`);
  if (telefon) {
    /* Am Telefon untereinander: der Beutel unter dem Getragenen. */
    const oben = await s.getByRole('region', { name: 'Carried' }).boundingBox();
    const unten = await bereich.boundingBox();
    expect(unten!.y).toBeGreaterThan(oben!.y + oben!.height - 1);
  } else {
    await klick(bereich.getByRole('button', { name: new RegExp(beutel.name) }).first());
    await expect(bereich).not.toContainText(kerze.name);
  }

  /* V5: der Ring an die rechte Hand, die Rüstung an den Rüstungsplatz, einstimmen. */
  const koerper = s.getByRole('region', { name: 'Body' });
  await expect(koerper).toContainText('Attuned 0 / 3');
  await klick(s.getByRole('region', { name: 'Carried' }).locator('.raster .zelle[data-x="0"][data-y="0"]'));
  await klick(koerper.locator('[data-slot="armor"]'));
  await expect(s.getByRole('alert')).toContainText('only armor');
  await klick(koerper.locator('[data-slot="ringR1"]'));
  await expect(koerper.locator('[data-slot="ringR1"]')).toContainText(ring.name);
  await expect(s.getByRole('region', { name: 'Item' })).toContainText('action to draw (Rings · right hand 1)');
  await klick(s.getByRole('button', { name: 'Attune' }));
  await expect(koerper).toContainText('Attuned 1 / 3');

  await klick(s.getByRole('region', { name: 'Carried' }).locator('.raster .zelle[data-x="1"][data-y="0"]'));
  await klick(s.getByRole('region', { name: 'Item' }).getByRole('button', { name: 'Armor' }));
  await expect(koerper.locator('[data-slot="armor"]')).toContainText(ruestung.name);
  await keinSeitwaertsScroll(s);

  /* Nach dem Neuladen bleibt der Beutel zu (Klappstand am Konto). */
  if (!telefon) {
    await s.reload();
    await expect(s.getByRole('region', { name: beutel.name })).not.toContainText(kerze.name);
  }

  /* Die Leitung sieht dieselben Plätze und statt des Malens den Weg zu Rules & options. */
  await leitung.goto(`/artikel/${figur.id}?tab=gear`);
  await expect(leitung.getByRole('region', { name: 'Body' }).locator('[data-slot="ringR1"]')).toContainText(ring.name);
  await expect(leitung.getByRole('link', { name: 'Edit zones' })).toHaveAttribute('href', /\/campaign\?tab=rules/);
  await keinSeitwaertsScroll(leitung);
});
