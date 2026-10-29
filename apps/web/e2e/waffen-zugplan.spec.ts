/**
 * Waffen in der Hand sind Angriffe (T-354): Mara hält ein Langschwert im
 * Inventar und hat am Statblock keine Aktion dafür — im Zugplan steht es
 * trotzdem als Angriff, mit STR + Übung (+5) und dem Schaden 1d8 + 3, vor
 * dem waffenlosen Schlag. Eigene kleine Testartikel, keine Regelwerksdaten.
 *
 * Das Bild ist 320 × 240 bei 20 px je Feld.
 */
import { test, expect } from './hilfen';

const feld = (x: number, y: number) => ({ x: (x * 20 + 10) / 320, y: (y * 20 + 10) / 240 });

test('a weapon in hand is an attack in the turn plan', async ({ leitung, api, eindeutig }) => {
  const bereit = { 'Status.status': 'ready' };
  const schwert = await api.anlegen('leitung', 'Weapon', eindeutig('Longsword'), {
    fields: { ...bereit, 'Item.itemType': 'melee weapon', 'Weapon.category': 'martial', 'Weapon.damage': '1d8', 'Weapon.damageType': 'slashing' },
  });
  const inventar = await api.anlegen('leitung', 'Inventory', eindeutig('Pack'), {
    fields: bereit,
    relations: [{ type: 'holds', to: schwert.id, props: { slot: 'mainHand' } }],
  });
  const mara = await api.anlegen('leitung', 'PlayerCharacter', eindeutig('Mara'), {
    fields: bereit,
    relations: [{ type: 'carries', to: inventar.id }],
  });
  await api.anlegen('leitung', 'Statblock', eindeutig('Mara stats'), {
    fields: {
      ...bereit, 'Statblock.ac': 13, 'Statblock.hp': 11, 'Statblock.speed': '30 ft.', 'Statblock.prof': 2,
      'Abilities.str': 16, 'Abilities.dex': 10, 'Proficiencies.proficient': ['martial'],
    },
    relations: [{ type: 'belongsTo', to: mara.id }],
  });
  const bild = await api.bild('leitung', eindeutig('field'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Yard'), {
    fields: { ...bereit, 'Image.image': bild, 'Map.gridShape': 'square', 'Map.gridSize': 20 },
    relations: [{ type: 'marker', to: mara.id, props: { ...feld(1, 1), kind: 'play' } }],
  });

  const gm = await api.als('leitung');
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: bereit });
  const genommen = await gm.post('/api/play/take', { data: { session: sitzung.id, map: karte.id } });
  expect(genommen.ok(), await genommen.text()).toBe(true);
  await leitung.goto(`/play?session=${sitzung.id}`);
  await leitung.getByRole('button', { name: 'Plan turn', exact: true }).click();
  const kacheln = leitung.getByRole('toolbar', { name: 'Actions' });
  const schwertKachel = kacheln.getByRole('button', { name: new RegExp(schwert.name) });
  await expect(schwertKachel).toContainText('+5 · 1d8 + 3');
  /* Vor dem waffenlosen Schlag. */
  const namen = await kacheln.locator('button.kachel .n').allTextContents();
  expect(namen.indexOf(schwert.name)).toBeLessThan(namen.indexOf('Unarmed Strike'));
});
