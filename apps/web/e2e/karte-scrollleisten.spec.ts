/**
 * Die Bühne der Karte flackert nicht (Scrollleisten): füllt die Karte die
 * Bühne genau, schob die auftauchende Scrollleiste sie schmaler, damit
 * niedriger, die Leiste verschwand wieder — und so fort.
 *
 * Playwright startet Chromium mit `--hide-scrollbars`: dort nimmt eine
 * Scrollleiste keinen Platz ein, und das Flackern gäbe es gar nicht. Darum
 * eine eigene Datei — `launchOptions` gilt nur je Datei.
 */
import { test, expect } from './hilfen';

test.use({
  launchOptions: {
    executablePath: process.env['E2E_CHROMIUM'] || undefined,
    ignoreDefaultArgs: ['--hide-scrollbars'],
  },
});

test('the stage does not flicker when the map fills it exactly', async ({
  leitung,
  api,
  eindeutig,
}) => {
  const bild = await api.bild('leitung', eindeutig('flat'));
  const karte = await api.anlegen('leitung', 'Map', eindeutig('Flat'), {
    fields: { 'Status.status': 'ready', 'Image.image': bild },
  });
  await leitung.goto(`/artikel/${karte.id}`);
  const buehne = leitung.locator('.buehne').first();
  await expect(buehne).toBeVisible();
  await expect(leitung.locator('.innen.gemessen').first()).toBeVisible();
  /* Die Bühne ein paar Punkte niedriger stellen als die Karte bei Zoom 1:
     die Scrollleiste taucht auf, die Karte wird schmaler und damit
     niedriger, passt wieder — genau der Fall, in dem es flackerte. */
  await buehne.evaluate((b: HTMLElement) => {
    const innen = b.querySelector('.innen') as HTMLElement;
    const rand = b.offsetHeight - b.clientHeight;
    b.style.height = `${innen.getBoundingClientRect().height + rand - 3}px`;
  });
  const breiten = await buehne.evaluate(
    (b: HTMLElement) =>
      new Promise<number[]>((fertig) => {
        const werte: number[] = [];
        const schritt = () => {
          werte.push(b.clientWidth);
          if (werte.length < 30) requestAnimationFrame(schritt);
          else fertig(werte);
        };
        requestAnimationFrame(schritt);
      }),
  );
  expect(new Set(breiten.slice(5)).size).toBe(1);
});
