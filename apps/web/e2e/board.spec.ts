/**
 * Board (T-356, REQ-205, T-342): die Leitung legt eine Text- und eine
 * Abfrage-Kachel; die Spielerin sieht den Text und in der Abfrage nur,
 * was sie sehen darf — gesiebt am Server wie jede Liste.
 */
import { test, expect } from './hilfen';

test('a text card and a query card, sieved for the player', async ({ leitung, spielerin, api, eindeutig }) => {
  const marke = eindeutig('rumour').replace(/\s+/g, '-').toLowerCase();
  const offen = await api.anlegen('leitung', 'Place', eindeutig('Tavern'), {
    fields: { 'Status.status': 'ready', 'Tags.tags': [marke] },
  });
  const geheim = await api.anlegen('leitung', 'Place', eindeutig('Hideout'), {
    fields: { 'Status.status': 'ready', 'Tags.tags': [marke], 'Visibility.audience': 'gm' },
  });
  const brett = await api.anlegen('leitung', 'Board', eindeutig('Board'), { fields: { 'Status.status': 'ready' } });

  await leitung.goto(`/boards/${brett.id}`);
  const leinwand = leitung.getByLabel('Board canvas');
  await expect(leinwand).toBeVisible();
  await leitung.getByRole('button', { name: 'Text', exact: true }).click();
  await leinwand.click({ position: { x: 120, y: 120 } });
  const notiz = `Meet at dusk ${marke}`;
  const form = leitung.getByRole('group', { name: 'Selected element' });
  await form.getByRole('textbox', { name: 'Text' }).fill(notiz);
  await form.getByRole('textbox', { name: 'Text' }).blur();
  await expect(leinwand.getByText(notiz)).toBeVisible();

  /* Die Abfrage-Kachel liegt gleich da, mit offenen Einstellungen. */
  await leitung.getByRole('button', { name: 'Query', exact: true }).click();
  const einst = leitung.getByRole('form', { name: 'Query settings' });
  await einst.getByRole('textbox', { name: 'Tags' }).fill(marke);
  await einst.getByRole('textbox', { name: 'Tags' }).blur();
  await expect(leinwand.getByRole('link', { name: offen.name })).toBeVisible();
  await expect(leinwand.getByRole('link', { name: geheim.name })).toBeVisible();

  /* Die Spielerin: Text und Abfrage ja, das Versteck nicht. Gespeichert
     wird im Hintergrund, also lädt sie neu, bis beides da ist. */
  const ihreLeinwand = spielerin.getByLabel('Board canvas');
  await expect(async () => {
    await spielerin.goto(`/boards/${brett.id}`);
    await expect(ihreLeinwand.getByText(notiz)).toBeVisible({ timeout: 2_000 });
    await expect(ihreLeinwand.getByRole('link', { name: offen.name })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await expect(ihreLeinwand.getByRole('link', { name: geheim.name })).toHaveCount(0);
  /* Ändern darf sie das Board nicht: keine Werkzeuge zum Schreiben. */
  await expect(spielerin.getByRole('button', { name: 'Query', exact: true })).toHaveCount(0);
});
