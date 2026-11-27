/**
 * **Der Globalfilter je Konto** (REQ-412, REQ-408, T-496): im Popup der
 * Kopfleiste stellt ein Konto in My view eine Ebene dazu, die die Kampagne
 * nicht aufschaltet — danach findet es deren Artikel, das andere Konto
 * nicht. „Reset“ stellt den Stapel der Kampagne wieder her. Die Kampagne
 * selbst ändert sich nicht.
 *
 * Desktop und Telefon laufen parallel und teilen die Konten: am Desktop
 * filtert die Leitung, am Telefon die Spielerin — so stellt nie ein Lauf
 * die Sicht des anderen um. My view nimmt den Stapel der Kampagne mit,
 * darum fehlt anderen Specs dabei nichts.
 */
import { test, expect } from './hilfen';

test('my view adds a layer outside the campaign, only for me, and Reset brings the campaign back', async ({ leitung, spielerin, api, lauf, eindeutig }, info) => {
  const telefon = info.project.name === 'phone';
  const ich = telefon ? spielerin : leitung;
  const ichRolle = telefon ? 'spielerin' : 'leitung';
  const andereRolle = telefon ? 'leitung' : 'spielerin';

  /* Eine Ebene der Leitung, die die Kampagne nicht aufschaltet, mit einem Ort darin. */
  const leit = await api.als('leitung');
  const ebenenName = eindeutig('Side book');
  const ebene = (await (await leit.post('/api/layers', { data: { name: ebenenName } })).json()) as { id: string };
  const wort = eindeutig('Gf').replace(/\s+/g, '-');
  const ort = (await (await leit.post('/api/entities', {
    data: { type: 'Place', name: `${wort} Lighthouse`, fields: { 'Status.status': 'ready' }, relations: [{ type: 'inLayer', to: ebene.id }] },
  })).json()) as { id: string; name: string };
  const findet = async (rolle: 'leitung' | 'spielerin') =>
    ((await (await (await api.als(rolle)).get(`/api/search?q=${encodeURIComponent(wort)}`)).json()) as { rows: { id: string }[] }).rows.some((r) => r.id === ort.id);
  const kampagneVorher = await (await leit.get(`/api/entities/${lauf.campaign.id}`)).json();
  expect(await findet(ichRolle)).toBe(false);

  try {
    await ich.goto('/compendium');
    await ich.locator('nw-stapel button.knopf').click();
    const popup = ich.getByRole('dialog', { name: 'Campaign & layers' });
    await expect(popup.getByRole('tab', { name: 'Campaign view' })).toHaveAttribute('aria-selected', 'true');
    /* Die Ebene der Kampagne bleibt an. */
    await expect(popup.locator('nw-globalfilter label.option', { hasText: 'campaign layer — always on' }).getByRole('checkbox')).toBeDisabled();

    await popup.getByRole('tab', { name: 'My view' }).click();
    await expect(popup.getByText(/Outside the campaign/)).toBeVisible();
    const option = popup.locator('nw-globalfilter label.option', { hasText: ebenenName });
    await expect(option).toContainText('not in campaign');
    const gespeichert = ich.waitForResponse((r) => r.url().endsWith('/api/me/layer-view') && r.request().method() === 'PUT');
    await option.getByRole('checkbox').check();
    expect((await gespeichert).status()).toBe(200);

    /* Die Kopfleiste sagt, welche Sicht gilt. */
    await expect(ich.locator('nw-stapel .knopf .sicht')).toHaveText('My view');
    await expect.poll(() => findet(ichRolle)).toBe(true);
    /* Nur für mich: das andere Konto findet ihn nicht, und die Kampagne ist dieselbe. */
    expect(await findet(andereRolle)).toBe(false);
    expect(await (await leit.get(`/api/entities/${lauf.campaign.id}`)).json()).toEqual(kampagneVorher);

    /* Reset: wieder der Stapel der Kampagne. */
    const zurueck = ich.waitForResponse((r) => r.url().endsWith('/api/me/layer-view') && r.request().method() === 'DELETE');
    await popup.getByRole('button', { name: 'Reset' }).click();
    expect((await zurueck).status()).toBe(200);
    await expect(popup.getByRole('tab', { name: 'Campaign view' })).toHaveAttribute('aria-selected', 'true');
    await expect(ich.locator('nw-stapel .knopf .sicht')).toHaveCount(0);
    await expect.poll(() => findet(ichRolle)).toBe(false);
  } finally {
    await (await api.als(ichRolle)).delete('/api/me/layer-view');
    await leit.delete(`/api/entities/${ort.id}`);
  }
});

test('choosing a campaign is refused without a role, and names what to do', async ({ api, eindeutig }) => {
  const verwaltung = await api.als('verwaltung');
  const fremd = (await (await verwaltung.post('/api/campaigns', { data: { name: eindeutig('Elsewhere') } })).json()) as { id: string };
  try {
    const r = await (await api.als('spielerin')).put('/api/me/campaign', { data: { id: fremd.id } });
    expect(r.status()).toBe(403);
    expect(((await r.json()) as { error: string }).error).toMatch(/Ask its GM/);
  } finally {
    for (const id of [`bd_${fremd.id}`, `pt_${fremd.id}`, fremd.id, `ly_${fremd.id}`]) await verwaltung.delete(`/api/entities/${id}`);
  }
});
