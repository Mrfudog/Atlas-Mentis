/**
 * **In eine Ebene schreiben, die die Kampagne nicht aufschaltet** (T-418,
 * REQ-417): die Leitung legt eine eigene Ebene an, wählt sie unter
 * „Writes to" zugeklappt unter „Layers not in this campaign", als „not in
 * play" gekennzeichnet und wählbar, und ein neuer Artikel landet dort. Die
 * Spielerin darf in eine fremde Ebene nicht schreiben — am Server.
 */
import { test, expect } from './hilfen';

test('the GM writes into an own layer outside the campaign, marked “not in play”', async ({ leitung, api, eindeutig }) => {
  const leit = await api.als('leitung');
  const name = eindeutig('Module drafts');
  const ebene = (await (await leit.post('/api/layers', { data: { name } })).json()) as { id: string };

  await leitung.goto('/compendium');
  const knopf = leitung.locator('nw-stapel button.knopf');
  await knopf.click();
  const popup = leitung.getByRole('dialog', { name: 'Campaign & layers' });
  await popup.getByText(/Layers not in this campaign/).click();
  const option = popup.locator('label.option', { hasText: name });
  await expect(option).toContainText('not in play');
  /* Wählbar — gewählt wird hier nicht: die Schreibebene gilt für das Konto, und
     andere Specs legen gleichzeitig als Leitung an (das Wählen prüft
     apps/server/test/schreiben-ausserhalb.test.ts). */
  await expect(option.getByRole('radio')).toBeEnabled();
  await popup.getByRole('button', { name: 'Close' }).click();

  /* Angelegt mit Nennung: dort, auch ausserhalb des Stapels (bis T-418 ging es in die Kampagnenebene).
     Ohne Nennung ginge es in die gewählte — die teilen sich Desktop und Telefon, die parallel laufen. */
  const neu = (await (await leit.post('/api/entities', {
    data: { type: 'Place', name: eindeutig('Draft tower'), relations: [{ type: 'inLayer', to: ebene.id }] },
  })).json()) as {
    relations?: { type: string; to: string }[];
  };
  expect(neu.relations?.filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual([ebene.id]);

});

test('a player cannot choose a layer she does not write in', async ({ api, eindeutig }) => {
  const leit = await api.als('leitung');
  const fremd = (await (await leit.post('/api/layers', { data: { name: eindeutig('GM only') } })).json()) as { id: string };
  const r = await (await api.als('spielerin')).put('/api/layers/write', { data: { layer: fremd.id } });
  expect(r.status()).toBe(403);
});
