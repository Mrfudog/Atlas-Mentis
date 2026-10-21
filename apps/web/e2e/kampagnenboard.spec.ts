/**
 * **Das Kampagnenboard als Startpunkt** (T-342), so, wie Spielerin und
 * Leitung es erleben: die Spielerin landet nach der Anmeldung auf dem
 * Board, sieht die laufende Szene, ihre Gruppe und nur die offenen
 * Aufträge, die für sie freigegeben sind, und wechselt über die
 * Basis-Leiste zu ihrer Figur und zurück. Die Leitung behält ihren Start
 * und sieht auf demselben Board auch, was sie zurückhält.
 *
 * Eigenständig, bis das Gerüst aus T-356 steht: die Testdaten legt die
 * Spec über die API an (eine eigene Kampagne je Lauf). Erwartet einen
 * laufenden Server samt gebauter Oberfläche unter `E2E_BASE_URL` und drei
 * Konten mit demselben Passwort (`E2E_PASSWORD`): Verwaltung
 * (`E2E_ADMIN`), Leitung (`E2E_GM`), Spielerin (`E2E_PLAYER`).
 * Ohne `E2E_BASE_URL` wird übersprungen.
 */

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const BASE = process.env['E2E_BASE_URL'] ?? '';
const PASSWORT = process.env['E2E_PASSWORD'] ?? 'nebel-wacht-am-tor';
const ADMIN = process.env['E2E_ADMIN'] ?? 'admin';
const GM = process.env['E2E_GM'] ?? 'gwen';
const PLAYER = process.env['E2E_PLAYER'] ?? 'sela';

test.skip(!BASE, 'E2E_BASE_URL fehlt — kein Server, gegen den geprüft würde.');

const GROESSEN = [
  { name: 'desktop', width: 1360, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

interface Lauf {
  campaign: string;
  board: string;
  character: string;
}
let lauf: Lauf;

async function anmelden(request: APIRequestContext, name: string): Promise<void> {
  const r = await request.post(`${BASE}/api/login`, { data: { name, password: PASSWORT } });
  expect(r.ok(), `Anmeldung ${name}`).toBe(true);
}

/** Einen Artikel anlegen und mit seinen Karten fertig schreiben. */
async function artikel(
  request: APIRequestContext,
  type: string,
  name: string,
  karten: Record<string, Record<string, unknown>>,
  relations: { type: string; to: string }[] = [],
): Promise<string> {
  const neu = await (await request.post(`${BASE}/api/entities`, { data: { type, name, fields: {}, relations } })).json();
  const e = await (await request.get(`${BASE}/api/entities/${neu.id}`)).json();
  const components = { ...e.components, Status: { status: 'ready' } };
  for (const [k, v] of Object.entries(karten)) components[k] = { ...(components[k] ?? {}), ...v };
  delete e.refs;
  const r = await request.put(`${BASE}/api/entities/${neu.id}`, { data: { ...e, components } });
  expect(r.ok(), `${type} ${name}`).toBe(true);
  return neu.id as string;
}

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext();
  await anmelden(request, ADMIN);
  const c = (await (await request.post(`${BASE}/api/campaigns`, { data: { name: `E2E board ${Date.now()}` } })).json()).id as string;
  await request.put(`${BASE}/api/campaigns/current`, { data: { id: c } });
  const arc = await artikel(request, 'Arc', 'The drowned mill', {}, [{ type: 'partOf', to: c }]);
  const szene = await artikel(request, 'Scene', 'At the millwheel', {}, [{ type: 'partOf', to: arc }]);
  await artikel(request, 'Session', 'Evening one', { Time: { sort: 1 }, Session: { activeScene: szene } }, [{ type: 'partOf', to: c }]);
  await artikel(request, 'Session', 'Evening two', { Time: { sort: 2 } }, [{ type: 'partOf', to: c }]);
  const figur = await artikel(request, 'PlayerCharacter', 'Rook', {});
  /* An die Kampagne gehängt: ein Auftrag ohne Kampagne zählt für jede. */
  await artikel(request, 'Quest', 'Find the miller', { Quest: { progress: 'accepted' } }, [{ type: 'partOf', to: c }]);
  await artikel(request, 'Quest', 'Kill the baron', { Quest: { progress: 'offered' }, Visibility: { audience: 'gm' } }, [{ type: 'partOf', to: c }]);
  const konten = (await (await request.get(`${BASE}/api/users`)).json()) as { users?: { id: string; name: string }[] } | { id: string; name: string }[];
  const liste = Array.isArray(konten) ? konten : (konten.users ?? []);
  const id = (n: string) => liste.find((u) => u.name === n)!.id;
  await request.put(`${BASE}/api/campaigns/${c}/members/${id(GM)}`, { data: { role: 'gm' } });
  await request.put(`${BASE}/api/campaigns/${c}/members/${id(PLAYER)}`, { data: { role: 'player' } });
  await request.put(`${BASE}/api/campaigns/${c}/members/${id(PLAYER)}/actors`, { data: { actorIds: [figur] } });
  lauf = { campaign: c, board: `bd_${c}`, character: figur };
  await request.dispose();
});

async function anmeldenImBrowser(page: Page, name: string): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="text"], input[name="name"]').first().fill(name);
  await page.locator('input[type="password"]').first().fill(PASSWORT);
  await page.keyboard.press('Enter');
}

for (const g of GROESSEN) {
  test.describe(`Kampagnenboard ${g.name}`, () => {
    test.use({ viewport: { width: g.width, height: g.height } });

    test('die Spielerin landet auf dem Board und findet zurück', async ({ page }) => {
      await anmeldenImBrowser(page, PLAYER);
      await expect(page).toHaveURL(new RegExp(`/boards/${lauf.board}$`));
      await expect(page.getByText('At the millwheel')).toBeVisible();
      await expect(page.getByText('Find the miller')).toBeVisible();
      await expect(page.getByText('Kill the baron')).toHaveCount(0);
      const leiste = page.locator('nav.basis');
      await expect(leiste).toBeVisible();
      await leiste.getByText('My character').click();
      await expect(page).toHaveURL(new RegExp(`/artikel/${lauf.character}`));
      await leiste.getByText('Board').click();
      await expect(page).toHaveURL(new RegExp(`/boards/${lauf.board}$`));
    });

    test('die Leitung behält ihren Start und sieht auf dem Board mehr', async ({ page }) => {
      await anmeldenImBrowser(page, GM);
      await expect(page).toHaveURL(/\/compendium/);
      await expect(page.locator('nav.basis')).toHaveCount(0);
      await page.goto(`${BASE}/boards/${lauf.board}`);
      await expect(page.getByText('Kill the baron')).toBeVisible();
    });
  });
}
