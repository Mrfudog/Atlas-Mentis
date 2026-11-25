/**
 * **Frei mit Vorschlag und Farbwähler** (T-423): die Art eines Orts bietet
 * ihre Liste an und nimmt ein eigenes Wort, die Begegnungsart nimmt ein
 * eigenes Wort als Chip, und die Farbe einer Fraktion hat einen
 * Farbwähler. Vorschläge kommen gesiebt vom Server — die Spielerin sieht
 * kein Wort, das nur an einer geheimen Begegnung steht.
 */
import { test, expect } from './hilfen';

test('kind fields take own words with suggestions; a colour field has a picker', async ({ leitung, api, eindeutig }) => {
  const ort = await api.anlegen('leitung', 'Place', eindeutig('Old mine'), { fields: { 'Place.kind': 'Stadt' } });
  const kampf = await api.anlegen('leitung', 'Encounter', eindeutig('Rockfall'), { fields: { 'Encounter.kind': ['combat'] } });
  const fraktion = await api.anlegen('leitung', 'Faction', eindeutig('Watch'), { fields: { 'Faction.color': '#8b5cf6' } });

  /* Ort: Vorschläge aus der Liste, ein eigenes Wort wird gespeichert. */
  await leitung.goto(`/artikel/${ort.id}`);
  await leitung.getByRole('button', { name: 'Edit', exact: true }).click();
  const art = leitung.locator('label[data-ref="Place.kind"] input');
  await art.focus();
  await expect(leitung.locator('datalist option[value="Gebäude"]')).toHaveCount(1);
  await art.fill('Höhle');
  await leitung.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => ((await (await (await api.als('leitung')).get(`/api/entities/${ort.id}`)).json()) as { components: { Place?: { kind?: string } } }).components.Place?.kind).toBe('Höhle');

  /* Begegnung: ein eigenes Wort als Chip. */
  await leitung.goto(`/artikel/${kampf.id}`);
  await leitung.getByRole('button', { name: 'Edit', exact: true }).click();
  const chips = leitung.locator('label[data-ref="Encounter.kind"] nw-mehrfach input');
  await chips.fill('obstacle');
  await chips.press('Enter');
  await leitung.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => ((await (await (await api.als('leitung')).get(`/api/entities/${kampf.id}`)).json()) as { components: { Encounter?: { kind?: string[] } } }).components.Encounter?.kind).toEqual(['combat', 'obstacle']);

  /* Fraktion: Farbwähler. */
  await leitung.goto(`/artikel/${fraktion.id}`);
  await leitung.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(leitung.locator('label[data-ref="Faction.color"] input[type="color"]')).toHaveValue('#8b5cf6');
});

test('a player gets no suggestion that only a hidden article carries', async ({ api, eindeutig }) => {
  const geheim = await api.anlegen('leitung', 'Encounter', eindeutig('Secret'), { fields: { 'Encounter.kind': [eindeutig('secretkind')] } });
  await api.setzen('leitung', geheim.id, { Visibility: { audience: 'gm' }, Status: { status: 'ready' } });
  const wort = ((await (await (await api.als('leitung')).get(`/api/entities/${geheim.id}`)).json()) as { components: { Encounter: { kind: string[] } } }).components.Encounter.kind[0]!;
  const fuer = async (rolle: 'leitung' | 'spielerin') =>
    ((await (await (await api.als(rolle)).get('/api/suggest?field=Encounter.kind')).json()) as { values: { value: string }[] }).values.map((v) => v.value);
  expect(await fuer('leitung')).toContain(wort);
  expect(await fuer('spielerin')).not.toContain(wort);
});
