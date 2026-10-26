/**
 * **Die Kurzansicht eines Boards** (T-425, Schnitt 4): unter dem „+" eines
 * Suchtreffers steht die Tafel klein — wo die Kacheln liegen und wie sie
 * heissen. Eine Kachel „GM only" fehlt in der Skizze der Spielerin (der
 * Server nimmt sie vorher weg).
 */
import { test, expect } from './hilfen';

test('the quick view of a board shows a sketch of its cards', async ({
  leitung,
  spielerin,
  api,
  eindeutig,
}) => {
  const fertig = { Status: { status: 'ready' } };
  const alter = await api.anlegen('leitung', 'Scene', eindeutig('The old man'));
  const falle = await api.anlegen('leitung', 'Scene', eindeutig('The trap'));
  const brett = await api.anlegen('leitung', 'Board', eindeutig('Board sketch'), {
    relations: [
      { type: 'placed', to: alter.id, props: { x: 100, y: 100 } },
      { type: 'placed', to: falle.id, props: { x: 600, y: 300, hidden: true } },
    ],
  });
  for (const a of [alter, falle, brett]) await api.setzen('leitung', a.id, fertig);

  for (const [seite, karten] of [
    [leitung, 2],
    [spielerin, 1],
  ] as const) {
    await seite.goto('/');
    await seite.keyboard.press('Control+k');
    await seite.getByRole('combobox', { name: 'Search articles' }).fill(brett.name);
    await seite.getByRole('button', { name: `More about ${brett.name}` }).click();
    await expect(seite.getByRole('img', { name: `Board with ${karten} cards` })).toBeVisible();
  }
});
