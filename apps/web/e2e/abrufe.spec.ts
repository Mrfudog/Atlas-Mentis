/**
 * **Wie viele Abrufe eine Seite stellt** (T-398, REQ-397, Leistungsregeln
 * in docs/Performance.md): ein Statblock mit vielen Übungen fragt sie in
 * einem Abruf, ein Board holt seine Karten in einem, und keine Seite fragt
 * dasselbe zweimal gleichzeitig. Auf dev stellte die Artikelseite einer
 * Figur über hundert Abrufe — dieser Spec hält die Zahl, damit sie nicht
 * wieder wächst.
 */
import type { Page, Request } from '@playwright/test';
import { test, expect, type Angelegt } from './hilfen';

/** Die API-Abrufe einer Seite, bis das Netz ruhig ist; der Live-Kanal zählt nicht. */
async function abrufe(seite: Page, weg: string): Promise<string[]> {
  const gesehen: string[] = [];
  const mitschreiben = (r: Request) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/') && u.pathname !== '/api/live') gesehen.push(`${r.method()} ${u.pathname}${u.search}`);
  };
  seite.on('request', mitschreiben);
  await seite.goto(weg);
  await seite.waitForLoadState('networkidle');
  seite.off('request', mitschreiben);
  return gesehen;
}

/** Was zweimal mit genau derselben Adresse gefragt wurde. */
const doppelt = (l: string[]) => [...new Set(l.filter((x, i) => l.indexOf(x) !== i))];

test('a statblock asks for all its proficiencies in one request', async ({ leitung, spielerin, api, eindeutig }) => {
  const fertig = { Status: { status: 'ready' } };
  const namen: string[] = [];
  for (let i = 0; i < 8; i++) {
    const s = await api.anlegen('leitung', 'Language', eindeutig(`Tongue ${i}`));
    await api.setzen('leitung', s.id, fertig);
    namen.push(s.name);
  }
  const sb = await api.anlegen('leitung', 'Statblock', eindeutig('Polyglot'), {
    fields: { 'Proficiencies.proficient': namen, 'Status.status': 'ready' },
  });

  for (const seite of [leitung, spielerin]) {
    const l = await abrufe(seite, `/artikel/${sb.id}`);
    await expect(seite.getByRole('heading', { name: sb.name })).toBeVisible();
    const listen = l.filter((x) => x.startsWith('GET /api/list?') && x.includes('name='));
    expect(listen, l.join('\n')).toHaveLength(1);
    /* Früher je Name eine Suche (`of=…&q=…`). */
    expect(l.filter((x) => x.startsWith('GET /api/list?') && /[?&]q=/.test(x))).toHaveLength(0);
    expect(doppelt(l.filter((x) => x.startsWith('GET /api/list') || x.startsWith('GET /api/entities'))), l.join('\n')).toEqual([]);
    /* Bogen, Kopf und Abschnitte fragen gesammelt (`Bestand.holen`), nicht je für sich. */
    expect(l.filter((x) => x.startsWith('GET /api/entities?ids=')).length, l.join('\n')).toBeLessThanOrEqual(1);
    /* Auf dev dreimal nacheinander (29.10.): die Antwort gilt jetzt einen Seitenaufbau lang. */
    expect(l.filter((x) => x === 'GET /api/me/prefs'), l.join('\n')).toHaveLength(1);
    expect(l.length, l.join('\n')).toBeLessThanOrEqual(25);
  }
});

test('a character page collects the articles its parts need into one request', async ({ leitung, spielerin, api, eindeutig }) => {
  /* Auf dev stellte die Artikelseite einer Figur acht `entities?ids` (29.10.):
     Bogen, Kopf, Abschnitte und Kennzahlen fragten je für sich. */
  const fertig = { 'Status.status': 'ready' };
  const klasse = await api.anlegen('leitung', 'Class', eindeutig('Warden'), { fields: { ...fertig, 'Class.hitDie': 10 } });
  const herkunft = await api.anlegen('leitung', 'Ancestry', eindeutig('Marshfolk'), { fields: fertig });
  const hintergrund = await api.anlegen('leitung', 'Background', eindeutig('Lamplighter'), { fields: fertig });
  const figur = await api.anlegen('spielerin', 'PlayerCharacter', eindeutig('Isolde'), {
    fields: fertig,
    relations: [
      { type: 'hasAncestry', to: herkunft.id },
      { type: 'hasBackground', to: hintergrund.id },
      { type: 'hasClass', to: klasse.id, props: { level: 2 } },
    ],
  });
  await api.anlegen('spielerin', 'Statblock', eindeutig('Isolde stats'), {
    fields: { ...fertig, 'Statblock.hp': 18, 'Statblock.ac': 15 },
    relations: [{ type: 'belongsTo', to: figur.id }],
  });

  for (const seite of [leitung, spielerin]) {
    const l = await abrufe(seite, `/artikel/${figur.id}`);
    await expect(seite.getByRole('heading', { name: figur.name }).first()).toBeVisible();
    expect(l.filter((x) => x.startsWith('GET /api/entities?ids=')).length, l.join('\n')).toBeLessThanOrEqual(2);
    expect(doppelt(l.filter((x) => x.startsWith('GET /api/entities'))), l.join('\n')).toEqual([]);
  }
});

test('a board fetches its cards in one request, not one per card', async ({ leitung, spielerin, api, eindeutig }) => {
  const fertig = { Status: { status: 'ready' } };
  const karten: Angelegt[] = [];
  for (let i = 0; i < 6; i++) {
    const k = await api.anlegen('leitung', 'Scene', eindeutig(`Card ${i}`));
    await api.setzen('leitung', k.id, fertig);
    karten.push(k);
  }
  const brett = await api.anlegen('leitung', 'Board', eindeutig('Many cards'), {
    relations: karten.map((k, i) => ({ type: 'placed', to: k.id, props: { x: 60 + 220 * (i % 3), y: 60 + 220 * Math.floor(i / 3) } })),
  });
  await api.setzen('leitung', brett.id, fertig);

  for (const seite of [leitung, spielerin]) {
    const l = await abrufe(seite, `/boards/${brett.id}`);
    await expect(seite.getByLabel('Board canvas').getByText(karten[5]!.name)).toBeVisible();
    const einzeln = l.filter((x) => karten.some((k) => x.includes(`/api/entities/${k.id}`)));
    expect(einzeln, l.join('\n')).toEqual([]);
    expect(l.filter((x) => x.startsWith('GET /api/entities/batch')), l.join('\n')).toHaveLength(1);
    expect(doppelt(l), l.join('\n')).toEqual([]);
  }
});

test('the help for a page loads only when asked for (T-348)', async ({ leitung }) => {
  await leitung.goto('/compendium');
  await leitung.waitForLoadState('networkidle');
  const knopf = leitung.getByRole('button', { name: 'Help for this page' }).filter({ visible: true });
  /* Am Telefon steht das „?“ womöglich nicht in der Kopfleiste. */
  test.skip((await knopf.count()) === 0, 'no help button at this width');
  await knopf.first().click();
  await expect(leitung.getByRole('dialog', { name: 'Help for this page' })).toBeVisible();
  await expect(leitung.getByRole('dialog', { name: 'Help for this page' }).locator('p').first()).not.toBeEmpty();
});
