/**
 * **Eine Ebene, die andere Kampagnen schon haben** (T-410): auf dev sprang
 * jedes Häkchen in der neuen Kampagne mit „Internal server error" zurück —
 * `relation.id` ist in Postgres eindeutig über alle Artikel, und die Kante
 * `activates` hiess in jeder Kampagne gleich. Darum läuft der Ablauf hier
 * gegen Postgres; die Integrationstests sehen nur den Speicher.
 */
import { test, expect } from './hilfen';

test('the GM turns on a layer that two other campaigns already use, and it stays on', async ({ leitung, spielerin, api, lauf, eindeutig }) => {
  const verwaltung = await api.als('verwaltung');
  /* Generisch, damit die Antwort ihr `json()` behält (T-429). */
  const ok = async <R extends { ok(): boolean; status(): number; text(): Promise<string> }>(r: R) => {
    expect(r.ok(), `${r.status()} ${await r.text()}`).toBe(true);
    return r;
  };
  const name = eindeutig('Shared rules');
  const ebene = (await (await ok(await verwaltung.post('/api/layers', { data: { name } }))).json()) as { id: string };
  for (const andere of [eindeutig('Other table A'), eindeutig('Other table B')]) {
    const k = (await (await ok(await verwaltung.post('/api/campaigns', { data: { name: andere } }))).json()) as { id: string };
    await ok(await verwaltung.post(`/api/campaigns/${k.id}/layers/${ebene.id}`));
  }

  await leitung.goto(`/campaign?c=${lauf.campaign.id}&tab=layers`);
  const liste = leitung.getByRole('region', { name: 'Layers in play' });
  /* Das Häkchen trägt auch den Knopf der Kurzansicht im Namen; das erste in der Zeile schaltet auf. */
  const hakenIn = (l: typeof liste) => l.locator('li', { hasText: name }).getByRole('checkbox').first();
  const haken = hakenIn(liste);
  await expect(haken).not.toBeChecked();
  await haken.check();
  await expect(haken).toBeChecked();
  await expect(liste.getByRole('alert')).toHaveCount(0);
  /* Nach dem Neuladen noch an — der Server hat geschrieben. */
  await leitung.reload();
  await expect(hakenIn(leitung.getByRole('region', { name: 'Layers in play' }))).toBeChecked();

  /* Die Spielerin schaltet nicht. */
  const r = await (await api.als('spielerin')).post(`/api/campaigns/${lauf.campaign.id}/layers/${ebene.id}`);
  expect(r.status()).toBe(403);
  void spielerin;
});
