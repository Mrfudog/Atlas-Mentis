/**
 * **Zwei Geräte an derselben Kampagne** (T-449, REQ-192). Desktop und
 * Telefon änderten die Kampagne gleichzeitig, und eine Änderung ging
 * verloren (gefunden bei T-401/T-403). Jetzt:
 *
 * - Ändert ein anderes Gerät die Kampagne, kommt die Ebenenseite über den
 *   Live-Kanal neu — das nächste Häkchen geht gegen den frischen Stand
 *   durch, und beide Änderungen stehen.
 * - Kommt etwas genau zwischen Lesen und Schreiben dazwischen, sagt die
 *   Seite es (409) und zeigt den Stand, der gilt; nichts wird still
 *   überschrieben.
 *
 * Eine eigene Kampagne je Lauf: die gemeinsame schreiben andere Tests
 * parallel, und ein echtes Rennen dort wäre hier ein falscher Fehler.
 */
import { test, expect } from './hilfen';

test('a second device changes the campaign, and the layers page keeps both changes', async ({ verwaltung: seite, api, eindeutig }) => {
  /* Die Verwaltung: sie schaltet jede Kampagne, ohne Mitglied zu werden —
     eine Rolle für ein geteiltes Konto anzulegen liefe parallel zu anderen
     Läufen in einen eigenen Fehler (T-452). */
  const verwaltung = await api.als('verwaltung');
  const anderesGeraet = await api.als('verwaltung');
  const leitung = seite;
  const ok = async <R extends { ok(): boolean; status(): number; text(): Promise<string> }>(r: R) => {
    expect(r.ok(), `${r.status()} ${await r.text()}`).toBe(true);
    return r;
  };
  const name = eindeutig('Tomb notes');
  const ebene = (await (await ok(await verwaltung.post('/api/layers', { data: { name } }))).json()) as { id: string };
  const k = (await (await ok(await verwaltung.post('/api/campaigns', { data: { name: eindeutig('Two devices') } }))).json()) as { id: string };
  const regel = (id: string, audience: string | null) =>
    anderesGeraet.put(`/api/campaigns/${k.id}/visibility/rules`, { data: { id, audience } });
  const regeln = async () => {
    const e = (await (await anderesGeraet.get(`/api/entities/${k.id}`)).json()) as {
      components?: { VisibilityRules?: { visibilityRules?: { id: string }[] } };
    };
    return (e.components?.VisibilityRules?.visibilityRules ?? []).map((r) => r.id);
  };
  const vergleich = async () =>
    ((await (await anderesGeraet.get(`/api/campaigns/${k.id}/layers`)).json()) as { layers: { id: string; compare?: boolean }[] }).layers.find(
      (l) => l.id === ebene.id,
    )?.compare ?? false;

  const geschrieben = () => leitung.waitForResponse((r) => r.url().includes(`/api/campaigns/${k.id}/compare`) && r.request().method() === 'PUT');

  await leitung.goto(`/campaign?c=${k.id}&tab=layers`);
  const zeile = leitung.locator('li', { hasText: name }).filter({ visible: true }).first();
  const haken = zeile.getByRole('checkbox', { name: 'compare', exact: true });
  await expect(haken).not.toBeChecked();

  /* 1. Das andere Gerät setzt eine Regel; die Seite holt den Stand über den Live-Kanal. */
  const neuGeholt = leitung.waitForResponse((r) => r.url().includes(`/api/campaigns/${k.id}/layers`) && r.request().method() === 'GET');
  await ok(await regel('rule:one', 'players'));
  await neuGeholt;
  let antwort = geschrieben();
  await haken.check();
  expect((await antwort).status()).toBe(200);
  await expect(haken).toBeChecked();
  await expect(leitung.getByRole('alert')).toHaveCount(0);
  expect(await vergleich()).toBe(true);
  expect(await regeln()).toContain('rule:one');

  /* 2. Genau zwischen Lesen und Schreiben: die Seite schickt ihren Stand
     (`If-Match`), das andere Gerät war schneller — 409, die Seite sagt es
     und zeigt den Stand, der gilt; die Regel des anderen bleibt. */
  await leitung.route(`**/api/campaigns/${k.id}/compare`, async (route) => {
    await ok(await regel('rule:two', 'gm'));
    await route.continue();
  });
  antwort = geschrieben();
  await haken.uncheck();
  expect((await antwort).status()).toBe(409);
  await expect(leitung.getByText(/changed this campaign at the same moment/)).toBeVisible();
  await leitung.unroute(`**/api/campaigns/${k.id}/compare`);
  expect(await regeln()).toEqual(expect.arrayContaining(['rule:one', 'rule:two']));
  expect(await vergleich()).toBe(true);
  await expect(haken).toBeChecked();

  /* Danach geht es gegen den frischen Stand. */
  antwort = geschrieben();
  await haken.uncheck();
  expect((await antwort).status()).toBe(200);
  await expect(haken).not.toBeChecked();
  expect(await vergleich()).toBe(false);

  const breite = await leitung.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(breite).toBeLessThanOrEqual(1);
});
