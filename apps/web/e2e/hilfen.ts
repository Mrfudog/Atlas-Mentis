/**
 * Hilfen für die Specs (T-356): angemeldete Seiten je Rolle, die API als
 * dieselbe Rolle und Testartikel mit eigenem Namen.
 *
 *   import { test, expect } from './hilfen';
 *   test('…', async ({ leitung, spielerin, api, lauf }) => { … });
 *
 * `leitung` und `spielerin` sind je eine eigene Browser-Sitzung — beide in
 * einem Test zeigen, was die eine sieht und die andere nicht.
 */
import { test as basis, expect, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test';
import { leseLauf, sitzungDatei, type Lauf, type Rolle } from './stand';

export { expect };

export interface Angelegt {
  id: string;
  name: string;
}

export interface Api {
  /** Die API als diese Rolle — dieselbe Siebung wie in der Oberfläche. */
  als(rolle: Rolle): Promise<APIRequestContext>;
  /**
   * Einen Testartikel anlegen (`POST /api/entities`). Der Name bekommt die
   * Kennung des Laufs und eine laufende Nummer, damit parallele Specs und
   * die Projekte desktop/phone einander nicht finden.
   */
  anlegen(
    rolle: Rolle,
    art: string,
    name: string,
    mehr?: { fields?: Record<string, unknown>; relations?: { type: string; to: string; props?: Record<string, unknown> }[] },
  ): Promise<Angelegt>;
}

let zaehler = 0;

/**
 * Eine angemeldete Seite je Rolle, in eigenem Kontext und mit derselben
 * Ausstattung wie das Projekt — `browser.newContext` erbt die Angaben aus
 * `use` nicht, ohne sie wäre „phone" ein Desktop-Fenster. Spur und Bild
 * bei einem Fehler nimmt Playwright für jeden Kontext des Tests selbst auf.
 */
async function rollenSeite(browser: Browser, rolle: Rolle, use: (p: Page) => Promise<void>, info: TestInfo): Promise<void> {
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, locale, baseURL } = info.project.use;
  const ctx = await browser.newContext({
    viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, locale, baseURL,
    storageState: sitzungDatei(rolle),
  });
  const seite = await ctx.newPage();
  await use(seite);
  await ctx.close();
}

export const test = basis.extend<{ lauf: Lauf; leitung: Page; spielerin: Page; api: Api; eindeutig: (name: string) => string }>({
  // eslint-disable-next-line no-empty-pattern
  lauf: async ({}, use) => use(leseLauf()),

  eindeutig: async ({ lauf }, use, info) => {
    use((name) => `${name} ${lauf.id}-${info.project.name}-${info.workerIndex}-${++zaehler}`);
  },

  leitung: async ({ browser }, use, info) => rollenSeite(browser, 'leitung', use, info),
  spielerin: async ({ browser }, use, info) => rollenSeite(browser, 'spielerin', use, info),

  api: async ({ playwright, baseURL }, use) => {
    const offen: APIRequestContext[] = [];
    const als = async (rolle: Rolle) => {
      const ctx = await playwright.request.newContext({ baseURL, storageState: sitzungDatei(rolle) });
      offen.push(ctx);
      return ctx;
    };
    await use({
      als,
      async anlegen(rolle, art, name, mehr = {}) {
        const res = await (await als(rolle)).post('/api/entities', { data: { type: art, name, ...mehr } });
        if (!res.ok()) throw new Error(`${art} „${name}" anlegen: ${res.status()} ${await res.text()}`);
        const e = (await res.json()) as { id: string };
        return { id: e.id, name };
      },
    });
    await Promise.all(offen.map((c) => c.dispose()));
  },
});
