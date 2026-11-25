/**
 * Freie Aktion mit Notiz (REQ-403, T-453): im Zugplan tippt die Leitung
 * „Other action“, schreibt, was geschieht, und schickt den Zug; ohne Notiz
 * sagt die Zeile, was fehlt. Eigene kleine Testartikel.
 *
 * Das Bild ist 320 × 240 bei 20 px je Feld.
 */
import { test, expect } from './hilfen';

const feld = (x: number, y: number) => ({ x: (x * 20 + 10) / 320, y: (y * 20 + 10) / 240 });

test('a free action with a note goes into the turn and uses its slot', async ({ leitung, api, eindeutig }) => {
  const bereit = { 'Status.status': 'ready' };
  const mara = await api.anlegen('leitung', 'PlayerCharacter', eindeutig('Mara'), { fields: bereit });
  await api.anlegen('leitung', 'Statblock', eindeutig('Mara stats'), {
    fields: { ...bereit, 'Statblock.ac': 13, 'Statblock.hp': 11, 'Statblock.speed': '30 ft.' },
    relations: [{ type: 'belongsTo', to: mara.id }],
  });
  const bild = await api.bild('leitung', eindeutig('field'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Gate'), {
    fields: { ...bereit, 'Image.image': bild, 'Map.gridShape': 'square', 'Map.gridSize': 20 },
    relations: [{ type: 'marker', to: mara.id, props: { ...feld(1, 1), kind: 'play' } }],
  });
  const gm = await api.als('leitung');
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: bereit });
  expect((await gm.post('/api/play/take', { data: { session: sitzung.id, map: karte.id } })).ok()).toBe(true);

  const l = leitung;
  await l.goto(`/play?session=${sitzung.id}`);
  await l.getByRole('button', { name: 'Plan turn', exact: true }).click();
  const kacheln = l.getByRole('toolbar', { name: 'Actions' });
  await kacheln.getByRole('button', { name: /^. ?Other action/ }).click();

  /* Ohne Notiz: die Zeile sagt, was fehlt. */
  await l.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(l.getByRole('alert')).toHaveText('Say in a note what the free action does.');

  await l.getByLabel('Note for the free action').fill('Pull the lever by the gate');
  await l.getByRole('button', { name: 'Add', exact: true }).click();
  const folge = l.getByRole('list', { name: 'Your turn, in order' });
  await expect(folge).toContainText('Other action (Pull the lever by the gate)');
  /* Die Aktion ist verbraucht: eine zweite freie Aktion geht nicht mehr. */
  await expect(kacheln.getByRole('button', { name: /^. ?Other action/ })).toBeDisabled();

  await l.getByRole('button', { name: 'Send turn to GM' }).click();
  await expect(l.getByRole('button', { name: 'Update the turn' })).toBeVisible();
});
