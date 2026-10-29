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
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as basis, expect, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test';
import { leseLauf, sitzungDatei, type Lauf, type Rolle } from './stand';

export { expect };

/* Das Register wird als Ganzes geschrieben: zwei Projekte, die zugleich
   lesen und schreiben, verlören die Änderung des anderen. Eine Sperre im
   Dateisystem macht den Abschnitt nacheinander. */
const SPERRE = join(tmpdir(), 'atlas-e2e-register-sperre');
export async function mitSperre<T>(fn: () => Promise<T>): Promise<T> {
  const bis = Date.now() + 120_000;
  for (;;) {
    try {
      mkdirSync(SPERRE, { recursive: false });
      break;
    } catch {
      /* Eine Sperre aus einem abgebrochenen Lauf gilt nach zwei Minuten als frei. */
      try {
        if (Date.now() - statSync(SPERRE).mtimeMs > 120_000)
          rmSync(SPERRE, { recursive: true, force: true });
      } catch {
        /* schon weg */
      }
      if (Date.now() > bis) throw new Error('Registersperre nicht frei');
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(SPERRE, { recursive: true, force: true });
  }
}


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
  /**
   * Karten eines Artikels ändern (`GET`, dann `PUT /api/entities/:id`):
   * je Karte werden die genannten Felder überschrieben, der Rest bleibt.
   */
  setzen(rolle: Rolle, id: string, karten: Record<string, Record<string, unknown>>): Promise<void>;
  /**
   * Ein Bild hochladen (`POST /api/assets`) — eine einfarbige Fläche
   * 320 × 240, genug für eine Karte — und auf `ready` setzen, damit es
   * auch die Spielerin bekommt. Gibt die Id des Asset-Artikels.
   * `fertig: false` lässt den Stand — so lädt eine Spielerin hoch, die
   * `ready` nicht setzen darf.
   */
  bild(rolle: Rolle, name: string, fertig?: boolean): Promise<string>;
}

/* Eine einfarbige PNG-Fläche 320 × 240 (Pergament), hier erzeugt statt als
   Datei im Repo: ein Bild aus einer Kampagne oder einem Buch gehört nie
   hierher. */
const FLAECHE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAUAAAADwCAIAAAD+Tyo8AAACEElEQVR42u3TQQkAAAgEweufwiS+jWUHf8LAJFjYTBfwVCQAAwMGBgwMBgYMDBgYMDAYGDAwYGAwMGBgwMCAgcHAgIEBAwMGBgMDBgYMDAYGDAwYGDAwGBgwMGBgwMBgYMDAgIHBwICBAQMDBgYDAwYGDAwGVgEMDBgYMDAYGDAwYGDAwGBgwMCAgcHAgIEBAwMGBgMDBgYMDBgYDAwYGDAwGBgwMGBgwMBgYMDAgIEBA4OBAQMDBgYDAwYGDAwYGAwMGBgwMBgYMDBgYMDAYGDAwICBAQODgQEDAwYGAwMGBgwMGBgMDBgYMDBgYDAwYGDAwGBgwMCAgQEDg4EBAwMGBgwMBgYMDBgYDAwYGDAwYGAwMGBgwMBgYMDAgIEBA4OBAQMDBgYMDAYGDAwYGAwMGBgwMGBgMDBgYMDAgIHBwICBAQODgQEDAwYGDAwGBgwMGBgMrAIYGDAwYGAwMGBgwMCAgcHAgIEBA4OBAQMDBgYMDAYGDAwYGDAwGBgwMGBgMDBgYMDAgIHBwICBAQMDBgYDAwYGDAwGBgwMGBgwMBgYMDBgYDAwYGDAwICBwcCAgQEDAwYGAwMGBgwMBgYMDBgYMDAYGDAwYGDAwGBgwMCAgcHAgIEBAwMGBgMDBgYMDBgYDAwYGDAwGBgwMGBgwMBgYMDAgIHBwICBAQMDBgYDAwYGDAwYGAwMGBi4Wzq2rb2/F5tbAAAAAElFTkSuQmCC',
  'base64',
);

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

export const test = basis.extend<{ lauf: Lauf; leitung: Page; spielerin: Page; verwaltung: Page; api: Api; eindeutig: (name: string) => string }>({
  // eslint-disable-next-line no-empty-pattern
  lauf: async ({}, use) => use(leseLauf()),

  eindeutig: async ({ lauf }, use, info) => {
    use((name) => `${name} ${lauf.id}-${info.project.name}-${info.workerIndex}-${++zaehler}`);
  },

  leitung: async ({ browser }, use, info) => rollenSeite(browser, 'leitung', use, info),
  spielerin: async ({ browser }, use, info) => rollenSeite(browser, 'spielerin', use, info),
  verwaltung: async ({ browser }, use, info) => rollenSeite(browser, 'verwaltung', use, info),

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
      async setzen(rolle, id, karten) {
        const ctx = await als(rolle);
        const e = (await (await ctx.get(`/api/entities/${id}`)).json()) as {
          components?: Record<string, Record<string, unknown>>;
          refs?: unknown;
        };
        const components = { ...(e.components ?? {}) };
        for (const [k, v] of Object.entries(karten)) components[k] = { ...(components[k] ?? {}), ...v };
        delete e.refs;
        const res = await ctx.put(`/api/entities/${id}`, { data: { ...e, components } });
        if (!res.ok()) throw new Error(`${id} ändern: ${res.status()} ${await res.text()}`);
      },
      async bild(rolle, name, fertig = true) {
        const res = await (await als(rolle)).post('/api/assets', {
          multipart: { file: { name: `${name}.png`, mimeType: 'image/png', buffer: FLAECHE } },
        });
        if (!res.ok()) throw new Error(`Bild „${name}" hochladen: ${res.status()} ${await res.text()}`);
        const id = ((await res.json()) as { id: string }).id;
        if (fertig) await this.setzen(rolle, id, { Status: { status: 'ready' } });
        return id;
      },
    });
    await Promise.all(offen.map((c) => c.dispose()));
  },
});
