/**
 * Struktur (T-341): die Leitung legt eine Struktur-Kachel auf ein Board,
 * wählt die Fraktion und sieht Mitglied mit Rang, den verborgenen Zirkel
 * und die Beziehung mit ihren Marken, als Baum und als Netz; die
 * Spielerin sieht dieselbe Kachel ohne den Zirkel und ohne, wer nur an
 * ihm hängt. Die Seite der Fraktion zeigt dieselbe Struktur.
 */
import { test, expect } from './hilfen';

test('a structure card: tree and web, sieved for the player', async ({ leitung, spielerin, api, eindeutig }) => {
  const fertig = { 'Status.status': 'ready' };
  const wacht = await api.anlegen('leitung', 'Faction', eindeutig('Watch'), { fields: fertig });
  const zirkel = await api.anlegen('leitung', 'Faction', eindeutig('Circle'), {
    fields: { ...fertig, 'Visibility.audience': 'gm' },
    relations: [{ type: 'partOf', to: wacht.id }],
  });
  const ada = await api.anlegen('leitung', 'Creature', eindeutig('Ada'), {
    fields: fertig,
    relations: [{ type: 'memberOf', to: wacht.id, props: { rank: 'Captain' } }],
  });
  const bo = await api.anlegen('leitung', 'Creature', eindeutig('Bo'), {
    fields: fertig,
    relations: [{ type: 'memberOf', to: zirkel.id, props: { rank: 'Novice' } }],
  });
  const gilde = await api.anlegen('leitung', 'Faction', eindeutig('Guild'), {
    fields: fertig,
    relations: [{ type: 'regards', to: wacht.id, props: { tags: ['useful'] } }],
  });
  const brett = await api.anlegen('leitung', 'Board', eindeutig('Board'), { fields: fertig });

  /* Auf dem Telefon legt die API die Kachel hin: die Wahl über die Suche
     in der schmalen Kachel blieb im CI hängen, lokal nie (T-341, PR #348).
     Der Ablauf über Werkzeug und Suche läuft im Desktop-Projekt; Baum,
     Netz, Siebung und Seite prüfen beide. */
  const telefon = test.info().project.name === 'phone';
  if (telefon) {
    const ctx = await api.als('leitung');
    const b = await (await ctx.get(`/api/entities/${brett.id}`)).json();
    const kachel = { id: 'r-struktur', type: 'placed', to: brett.id, props: { x: 20, y: 20, w: 360, h: 460, z: 1, title: 'Structure', structure: { root: wacht.id } } };
    const res = await ctx.put(`/api/entities/${brett.id}`, { data: { ...b, relations: [...(b.relations ?? []), kachel] } });
    expect(res.ok()).toBe(true);
  }
  await leitung.goto(`/boards/${brett.id}`);
  const leinwand = leitung.getByLabel('Board canvas');
  await expect(leinwand).toBeVisible();
  if (!telefon) {
    /* Die Kachel liegt gleich da, mit offenen Einstellungen. */
    await leitung.getByRole('button', { name: 'Structure', exact: true }).click();
    const einst = leitung.getByRole('form', { name: 'Structure settings' });
    await einst.getByRole('button', { name: 'Choose…' }).click();
    const suche = einst.getByRole('searchbox', { name: 'Search articles' }).or(einst.getByRole('textbox', { name: 'Search articles' }));
    /* Die Treffer kommen beim Tippen und zeichnen sich neu; ein Klick auf
       einen ersetzten Knopf geht verloren. Und unter Last kennt die Liste am
       Server die eben angelegte Fraktion vielleicht noch nicht — also neu
       tippen (neu fragen) und klicken, bis der Start dasteht. */
    /* Der gewählte Start steht als `.start > b`; die Treffer der Suche
       stehen im selben Block und tragen ihr eigenes <b>. */
    const start = einst.locator('.start > b');
    await expect(async () => {
      if ((await start.count()) && (await start.textContent()) === wacht.name) return;
      if (!(await suche.isVisible())) await einst.getByRole('button', { name: 'Choose…' }).click();
      await suche.fill('');
      await suche.fill(wacht.name);
      await einst.getByRole('button', { name: `${wacht.name} Faction` }).click({ timeout: 3_000 });
      await expect(start).toHaveText(wacht.name, { timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  }

  const baum = leinwand.getByRole('tree', { name: `Structure of ${wacht.name}` });
  await expect(baum.getByRole('link', { name: ada.name })).toBeVisible();
  await expect(baum.getByText('Captain')).toBeVisible();
  await expect(baum.getByRole('link', { name: zirkel.name })).toBeVisible();
  await expect(baum.getByRole('link', { name: bo.name })).toBeVisible();
  await expect(baum.getByRole('link', { name: gilde.name }).first()).toBeVisible();
  await expect(baum.getByText('useful').first()).toBeVisible();
  /* Zuklappen nimmt den Zweig weg. */
  await baum.getByRole('button', { name: `Collapse ${zirkel.name}` }).click();
  await expect(baum.getByRole('link', { name: bo.name })).toHaveCount(0);
  /* Als Netz. */
  await leinwand.getByRole('button', { name: 'Web' }).click();
  await expect(leinwand.getByRole('img', { name: `Relationship web of ${wacht.name}` })).toBeVisible();

  /* Die Spielerin: die Wacht, Ada und die Gilde — der Zirkel nicht, und Bo, der nur an ihm hängt, auch nicht. */
  const ihreLeinwand = spielerin.getByLabel('Board canvas');
  const ihrBaum = ihreLeinwand.getByRole('tree', { name: `Structure of ${wacht.name}` });
  await expect(async () => {
    await spielerin.goto(`/boards/${brett.id}`);
    await expect(ihrBaum.getByRole('link', { name: ada.name })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await expect(ihrBaum.getByRole('link', { name: gilde.name }).first()).toBeVisible();
  await expect(ihrBaum.getByRole('link', { name: zirkel.name })).toHaveCount(0);
  await expect(ihrBaum.getByRole('link', { name: bo.name })).toHaveCount(0);
  await expect(spielerin.getByRole('button', { name: 'Structure', exact: true })).toHaveCount(0);

  /* Die Seite der Fraktion zeigt dieselbe Struktur (Element `structure`). */
  await spielerin.goto(`/artikel/${wacht.id}`);
  const platz = spielerin.getByText('Structure…');
  if (await platz.count()) await platz.first().scrollIntoViewIfNeeded();
  const seitenBaum = spielerin.getByRole('tree', { name: `Structure of ${wacht.name}` });
  await expect(seitenBaum.getByRole('link', { name: ada.name })).toBeVisible();
  await expect(seitenBaum.getByRole('link', { name: zirkel.name })).toHaveCount(0);
});
