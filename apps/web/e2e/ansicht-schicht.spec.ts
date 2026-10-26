/**
 * **Schichten** (T-425, E-168, E-173): eine Schicht für genau einen
 * Artikel legt ein Element über seine Artikelseite, ohne die Ansicht zu
 * ersetzen. Leitung und Spielerin sehen es; im Designer steht die Schicht
 * als „this layer", und gespeichert wird nur der Unterschied mit Priorität.
 *
 * Die Schicht gilt nur für den eigenen Testartikel — andere Specs sehen
 * sie nicht. Desktop und Telefon schreiben das Register nebeneinander, also
 * wird nach dem Schreiben nachgesehen und notfalls wiederholt.
 */
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './hilfen';

/* Das Register wird als Ganzes geschrieben: zwei Projekte, die zugleich
   lesen und schreiben, verlören die Änderung des anderen. Eine Sperre im
   Dateisystem macht den Abschnitt nacheinander. */
const SPERRE = join(tmpdir(), 'atlas-e2e-register-sperre');
async function mitSperre<T>(fn: () => Promise<T>): Promise<T> {
  const bis = Date.now() + 120_000;
  for (;;) {
    try {
      mkdirSync(SPERRE, { recursive: false });
      break;
    } catch {
      /* Eine Sperre aus einem abgebrochenen Lauf gilt nach zwei Minuten als frei. */
      try {
        if (Date.now() - statSync(SPERRE).mtimeMs > 120_000) rmSync(SPERRE, { recursive: true, force: true });
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

type Views = Record<string, Record<string, unknown>>;

async function schichtSetzen(
  api: APIRequestContext,
  key: string,
  def: Record<string, unknown> | null,
): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const views = ((await (await api.get('/api/registry')).json()) as { views: Views }).views;
    if (def) views[key] = def;
    else delete views[key];
    const res = await api.put('/api/registry/views', { data: views });
    expect(res.ok(), await res.text()).toBe(true);
    const nach = ((await (await api.get('/api/registry')).json()) as { views: Views }).views;
    if (def ? !!nach[key] : !nach[key]) return;
  }
  throw new Error(`Schicht ${key} liess sich nicht schreiben`);
}

test('a layer for one article adds an element to its page, and the designer saves only the difference', async ({
  leitung,
  spielerin,
  api,
  eindeutig,
}, info) => {
  const sitzung = await api.anlegen('leitung', 'Session', eindeutig('Session layered'));
  await api.setzen('leitung', sitzung.id, { Status: { status: 'ready' } });
  const key = `e2eLayer${info.project.name}${info.workerIndex}${Date.now()}`;
  const als = await api.als('leitung');
  test.setTimeout(180_000);
  await mitSperre(async () => {
    await schichtSetzen(als, key, {
      label: 'Note on top',
      fields: 'all',
      group: 'full',
      applies: { types: ['Session'], article: sitzung.id },
      adjust: { extra: [{ id: 'e2e-note', el: 'text', text: 'Read this first', pos: 5 }] },
    });

    try {
      await leitung.goto(`/artikel/${sitzung.id}`);
      await expect(leitung.getByText('Read this first')).toBeVisible();
      await spielerin.goto(`/artikel/${sitzung.id}`);
      await expect(spielerin.getByText('Read this first')).toBeVisible();

      await leitung.goto(`/registry?tab=views&view=${key}`);
      await expect(leitung.getByRole('radio', { name: /this overlay/ })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      const baum = leitung.getByRole('tree', { name: 'Elements of the view' });
      await expect(baum.getByRole('treeitem').filter({ hasText: 'Read this first' })).toContainText(
        'Note on top',
      );
      await leitung.getByRole('spinbutton', { name: 'Priority' }).fill('3');
      await leitung.getByRole('spinbutton', { name: 'Priority' }).blur();
      await leitung.getByRole('button', { name: 'Save', exact: true }).click();
      await expect
        .poll(
          async () =>
            ((await (await als.get('/api/registry')).json()) as { views: Views }).views[key],
        )
        .toMatchObject({
          priority: 3,
          adjust: { extra: [expect.objectContaining({ id: 'e2e-note' })] },
        });
      const gespeichert = ((await (await als.get('/api/registry')).json()) as { views: Views })
        .views[key]!;
      expect(gespeichert['layout']).toBeUndefined();
    } finally {
      await schichtSetzen(als, key, null);
    }
  });
});
