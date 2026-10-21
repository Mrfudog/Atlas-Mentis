/**
 * Charakter anlegen bis Stufe 2 (T-356, T-193, T-319): Abstammung,
 * Hintergrund, Klasse, Standardwerte, Trefferpunkte, Ausrüstung, Name —
 * dann im selben Assistenten eine Stufe höher. Abstammung, Hintergrund und
 * Klasse sind eigene kleine Testartikel der Leitung, keine Regelwerksdaten.
 *
 * Der Entwurf des Assistenten steht je Konto (`characterDraft`): am
 * Telefon legt die Spielerin an, am Desktop die Leitung — so schreiben die
 * zwei Projekte nie in denselben Entwurf. Vorher wird er geleert, damit
 * kein Rest aus einem früheren Lauf zurückkommt.
 */
import { test, expect } from './hilfen';

test('a new character up to level 2', async ({ leitung, spielerin, api, eindeutig }, info) => {
  const rolle = info.project.name === 'phone' ? 'spielerin' : 'leitung';
  const seite = rolle === 'spielerin' ? spielerin : leitung;
  await (await api.als(rolle)).put('/api/me/prefs/characterDraft', { data: { value: null } });
  const herkunft = await api.anlegen('leitung', 'Ancestry', eindeutig('Fenling'), { fields: { 'Status.status': 'ready' } });
  const hintergrund = await api.anlegen('leitung', 'Background', eindeutig('Ferryman'), { fields: { 'Status.status': 'ready' } });
  const klasse = await api.anlegen('leitung', 'Class', eindeutig('Warden'), {
    fields: { 'Status.status': 'ready', 'Class.hitDie': 10 },
  });
  const weiter = seite.getByRole('button', { name: 'Next' });

  await seite.goto('/characters/new');
  await expect(seite.getByRole('heading', { name: 'New character' })).toBeVisible();
  for (const [schritt, name] of [
    ['Ancestry', herkunft.name],
    ['Background', hintergrund.name],
    ['Class', klasse.name],
  ] as const) {
    await expect(seite.getByRole('heading', { level: 2, name: schritt })).toBeVisible();
    await seite.getByText(name, { exact: true }).click();
    await weiter.click();
  }

  await expect(seite.getByRole('heading', { level: 2, name: 'Ability scores' })).toBeVisible();
  await seite.getByText('Standard array').click();
  const werte = { str: '15', dex: '14', con: '13', int: '12', wis: '10', cha: '8' };
  for (const [a, w] of Object.entries(werte)) await seite.getByRole('combobox', { name: a, exact: true }).selectOption(w);
  await weiter.click();

  /* Stufe 1: das Maximum des Trefferwürfels plus KON-Modifikator (13 → +1). */
  await expect(seite.getByText('Hit point maximum: 11')).toBeVisible();
  await weiter.click();
  await seite.getByText('Class and background').click();
  await weiter.click();

  const figur = eindeutig('Tamsin');
  await expect(seite.getByRole('heading', { level: 2, name: 'Name' })).toBeVisible();
  await seite.getByRole('textbox').first().fill(figur);
  await seite.getByRole('button', { name: 'Create character' }).click();
  await expect(seite).toHaveURL(/\/artikel\/e_[0-9a-f]+/);
  const id = /\/artikel\/(e_[0-9a-f]+)/.exec(seite.url())![1]!;

  /* Stufe 2: im Assistenten an der Klasse eine Stufe höher (T-319). */
  await seite.goto(`/characters/${id}/edit`);
  await seite.getByRole('button', { name: 'Class', exact: true }).click();
  await seite.getByRole('button', { name: `Raise ${klasse.name}` }).click();
  await expect(seite.getByLabel(`${klasse.name} level`)).toHaveText('2');
  await seite.getByRole('button', { name: 'Hit points', exact: true }).click();
  await seite.getByRole('button', { name: 'Average 6' }).click();
  /* 11 + 6 + 1 (KON) */
  await expect(seite.getByText(/Hit point maximum: 18/)).toBeVisible();
  /* Gespeichert wird am letzten Schritt. */
  await seite.getByRole('button', { name: 'Name', exact: true }).click();
  await seite.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(seite).toHaveURL(new RegExp(`/artikel/${id}`));

  const gespeichert = (await (await api.als(rolle)).get(`/api/entities/${id}`)).json() as Promise<{
    relations?: { type: string; to: string; props?: { level?: number } }[];
  }>;
  const kante = (await gespeichert).relations?.find((r) => r.type === 'hasClass' && r.to === klasse.id);
  expect(kante?.props?.level).toBe(2);
});
