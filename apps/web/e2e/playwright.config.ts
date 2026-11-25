/**
 * E2E-Prüfungen gegen den gebauten Server mit der gebauten Oberfläche (T-356).
 *
 *   pnpm e2e                      # alle Specs, Desktop und Telefon
 *   pnpm e2e --project=desktop    # nur 1360 px
 *   pnpm e2e anmelden             # nur Specs, deren Datei so heisst
 *
 * Braucht `DATABASE_URL` auf eine eigene Postgres und vorher den Bau
 * (CONTRIBUTING.md › E2E-Prüfungen). In den Sitzungen liegt Chromium unter
 * /opt/pw-browsers/chromium (`E2E_CHROMIUM`); im CI installiert der Job es.
 */
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env['E2E_PORT'] ?? 8091);
/* Immer der eigene Server: eine Adresse von aussen (dev, prod) gibt es
   hier absichtlich nicht — der Aufbau legt Konten und Kampagnen an. */
const baseURL = `http://127.0.0.1:${port}`;
const chromium = process.env['E2E_CHROMIUM'];
const ci = !!process.env['CI'];

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: './.ergebnis',
  globalSetup: './aufbau.ts',
  globalTeardown: './abbau.ts',
  /* Specs teilen eine Datenbank; jede legt ihre Artikel mit eigenem Namen
     an, also dürfen sie nebeneinander laufen. */
  fullyParallel: true,
  workers: ci ? 2 : undefined,
  forbidOnly: ci,
  /* Ein Wiederholungslauf im CI, damit eine Spur entsteht — ein Spec, der
     erst beim zweiten Mal grün wird, steht im Bericht als „flaky". */
  retries: ci ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: ci ? [['github'], ['html', { outputFolder: './.bericht', open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'en-GB',
    ...(chromium ? { launchOptions: { executablePath: chromium } } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } } },
    /* Ein Telefon, aber in Chromium: WebKit gibt es weder in den Sitzungen
       noch braucht es der Job. Breite und Berührung zählen. */
    {
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'node server.mjs',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !ci,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
