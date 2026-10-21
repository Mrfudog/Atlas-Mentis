/**
 * Reichweite im Zugplan (T-351): der Server lehnt einen Angriff ausser
 * Reichweite ab — für die Spielerin wie für die Leitung —, und ein Schuss
 * auf langer Reichweite würfelt mit Nachteil, sichtbar im Ergebnis, das
 * die Leitung nach „Confirm & roll" liest.
 *
 * Das Bild ist 320 × 240 bei 20 px je Feld: 16 Felder breit, je 5 ft.
 */
import { test, expect } from './hilfen';

/** Die Mitte eines Feldes als Anteil der Karte. */
const feld = (x: number, y: number) => ({ x: (x * 20 + 10) / 320, y: (y * 20 + 10) / 240 });

test('the turn plan checks range at the server; long range rolls with disadvantage', async ({ leitung, api, lauf, eindeutig }) => {
  const bereit = { 'Status.status': 'ready' };
  /* Ein Bogen 20/60 ft und ein Schütze, der ihn führt. */
  const art = await api.anlegen('leitung', 'ActionType', eindeutig('Action'), { fields: bereit });
  const bogen = await api.anlegen('leitung', 'Action', eindeutig('Shortbow'), {
    fields: { ...bereit, 'Action.actionType': art.id, 'Action.attack': ['ranged weapon'], 'Action.range': '20/60', 'Action.ability': 'dex', 'Action.damageDice': '4', 'Action.damageType': 'piercing' },
  });
  const schuetze = await api.anlegen('leitung', 'Creature', eindeutig('Archer'), { fields: bereit });
  await api.anlegen('leitung', 'Statblock', eindeutig('Archer stats'), {
    fields: { ...bereit, 'Statblock.ac': 13, 'Statblock.hp': 11, 'Statblock.speed': '30 ft.', 'Statblock.prof': 2, 'Abilities.dex': 16 },
    relations: [{ type: 'belongsTo', to: schuetze.id }, { type: 'composedOf', to: bogen.id }],
  });
  const ziel = await api.anlegen('leitung', 'Creature', eindeutig('Goblin'), { fields: bereit });
  await api.anlegen('leitung', 'Statblock', eindeutig('Goblin stats'), {
    fields: { ...bereit, 'Statblock.ac': 15, 'Statblock.hp': 7, 'Statblock.speed': '30 ft.' },
    relations: [{ type: 'belongsTo', to: ziel.id }],
  });
  const bild = await api.bild('leitung', eindeutig('field'));
  /* Schütze und Figur der Spielerin links, der Goblin 8 Felder (40 ft) weiter. */
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Range field'), {
    fields: { ...bereit, 'Image.image': bild, 'Map.gridShape': 'square', 'Map.gridSize': 20 },
    relations: [
      { type: 'marker', to: schuetze.id, props: { ...feld(0, 0), kind: 'play' } },
      { type: 'marker', to: lauf.figur.id, props: { ...feld(0, 2), kind: 'play' } },
      { type: 'marker', to: ziel.id, props: { ...feld(8, 0), kind: 'play' } },
    ],
  });
  const plan = `/api/maps/${karte.id}/turn-plan`;
  const schritt = (tile: string, name: string) => ({ id: 's1', kind: 'act', tile, name, cost: 'action', target: ziel.id, targetName: ziel.name });

  /* Die Spielerin: ihr waffenloser Schlag reicht 5 ft, der Goblin steht 40 ft weg. */
  const sie = await api.als('spielerin');
  const nein = await sie.post(plan, { data: { actor: lauf.figur.id, steps: [schritt('std:unarmed', 'Unarmed Strike')] } });
  expect(nein.status()).toBe(422);
  expect(((await nein.json()) as { error: string }).error).toContain('out of range for Unarmed Strike');

  /* Die Leitung nimmt die Karte ins Spiel (der Zugplan steht in Play) … */
  const gm = await api.als('leitung');
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session'), { fields: bereit });
  const genommen = await gm.post('/api/play/take', { data: { session: sitzung.id, map: karte.id } });
  expect(genommen.ok(), await genommen.text()).toBe(true);
  const imSpiel = `/api/maps/${((await genommen.json()) as { map: string }).map}/turn-plan`;
  /* … und dort reicht der Schlag des Schützen ebenso wenig … */
  const auchNein = await gm.post(imSpiel, { data: { actor: schuetze.id, steps: [schritt('std:unarmed', 'Unarmed Strike')] } });
  expect(auchNein.status()).toBe(422);
  /* … 40 ft sind für den Bogen lange Reichweite: eingereicht, bestätigt wird im Browser. */
  const lang = await gm.post(imSpiel, { data: { actor: schuetze.id, steps: [schritt(bogen.id, bogen.name)] } });
  expect(lang.ok(), await lang.text()).toBe(true);
  const lageGm = (await (await gm.get(`${imSpiel}?actor=${schuetze.id}`)).json()) as { targets: { id: string; feet?: number; long?: Record<string, number> }[] };
  const t = lageGm.targets.find((x) => x.id === ziel.id);
  expect(t?.feet).toBe(40);
  expect(t?.long?.[bogen.id]).toBeGreaterThan(0);

  await leitung.goto(`/play?session=${sitzung.id}`);
  await leitung.getByRole('button', { name: 'Plan turn', exact: true }).click();
  const liste = leitung.getByLabel('Turns sent to you');
  await expect(liste).toBeVisible();
  await liste.getByRole('button', { name: 'Confirm & roll' }).click();
  await expect(liste.getByText(new RegExp(`${bogen.name} → ${ziel.name}: .*with disadvantage`))).toBeVisible();
});
