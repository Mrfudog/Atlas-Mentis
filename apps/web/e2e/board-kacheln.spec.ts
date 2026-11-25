/**
 * Board-Kacheln schneiden nichts ab (T-368).
 *
 * Gemeldet am 22.10.: das Netz einer Struktur-Kachel stand nur zur Hälfte
 * in der Kachel, und Notizen zeigten nur einen Teil ihres Texts. Die
 * Ursachen: an Struktur- und Abfrage-Kacheln stand ein leeres zweites
 * Inhaltsfach und nahm ihnen die halbe Höhe; das Netz zeichnete sich in
 * seiner eigenen Grösse statt in der der Kachel; eine Text-Notiz schnitt
 * ab, was nicht in ihren Kasten passte.
 *
 * Geprüft wird bei 1360 und 390 px, als Leitung und als Spielerin.
 */
import { test, expect } from './hilfen';
import type { Locator } from '@playwright/test';

const LANG = Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of the note.`).join('\n\n') + '\n\nThe last sentence.';

async function kasten(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('nicht gezeichnet');
  return b;
}

test('structure web, query card and a long note fit their cards', async ({ leitung, spielerin, api, eindeutig }) => {
  const fertig = { 'Status.status': 'ready' };
  const wacht = await api.anlegen('leitung', 'Faction', eindeutig('Watch'), { fields: fertig });
  await api.anlegen('leitung', 'Creature', eindeutig('Ada with a rather long name'), {
    fields: fertig,
    relations: [{ type: 'memberOf', to: wacht.id, props: { rank: 'Captain' } }],
  });
  await api.anlegen('leitung', 'Faction', eindeutig('Guild'), {
    fields: fertig,
    relations: [{ type: 'regards', to: wacht.id, props: { tags: ['useful'] } }],
  });
  const brett = await api.anlegen('leitung', 'Board', eindeutig('Cards'), {
    fields: {
      ...fertig,
      'Board.shapes': [
        { id: 'sh-notiz', kind: 'text', x: 20, y: 520, w: 320, h: 120, z: 0, rot: 0, color: '', fill: '', stroke: 3, text: LANG, asset: '', points: [], hidden: false },
      ],
    },
  });
  const ctx = await api.als('leitung');
  const b = await (await ctx.get(`/api/entities/${brett.id}`)).json();
  const kacheln = [
    { id: `r-netz-${brett.id}`, type: 'placed', to: brett.id, props: { x: 20, y: 20, w: 340, h: 460, z: 1, title: 'Web', structure: { root: wacht.id, layout: 'net' } } },
    { id: `r-abfrage-${brett.id}`, type: 'placed', to: brett.id, props: { x: 400, y: 20, w: 300, h: 300, z: 1, title: 'Quests', query: { current: ['quests'] }, display: 'list' } },
  ];
  const res = await ctx.put(`/api/entities/${brett.id}`, { data: { ...b, relations: [...(b.relations ?? []), ...kacheln] } });
  expect(res.ok(), await res.text()).toBe(true);

  for (const seite of [leitung, spielerin]) {
    const leinwand = seite.getByLabel('Board canvas');
    const netz = leinwand.getByRole('img', { name: `Relationship web of ${wacht.name}` });
    await expect(async () => {
      await seite.goto(`/boards/${brett.id}`);
      await expect(netz).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 20_000 });

    /* Ein Fach je Kachel: Struktur und Abfrage haben kein leeres zweites. */
    const strukturKachel = leinwand.locator('article.kachel').filter({ has: seite.getByRole('img', { name: `Relationship web of ${wacht.name}` }) });
    await expect(strukturKachel.locator('.kinhalt')).toHaveCount(1);
    const abfrageKachel = leinwand.locator('article.kachel').filter({ hasText: 'Quests' });
    await expect(abfrageKachel.locator('.kinhalt')).toHaveCount(1);

    /* Das Netz steht ganz in der Kachel und nimmt den grössten Teil ihrer Höhe. */
    const k = await kasten(strukturKachel);
    const n = await kasten(netz);
    expect(n.x).toBeGreaterThanOrEqual(k.x - 1);
    expect(n.y).toBeGreaterThanOrEqual(k.y - 1);
    expect(n.x + n.width).toBeLessThanOrEqual(k.x + k.width + 1);
    expect(n.y + n.height).toBeLessThanOrEqual(k.y + k.height + 1);
    expect(n.height).toBeGreaterThan(k.height * 0.5);
    /* Kein Scrollen nötig, um das Netz zu sehen. */
    const fach = strukturKachel.locator('.kinhalt');
    expect(await fach.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);

    /* Die Notiz hat ihren ganzen Text und lässt sich bis zum letzten Satz scrollen. */
    const notiz = leinwand.locator('.form.f-text');
    await expect(notiz).toContainText('The last sentence.');
    const letzte = notiz.getByText('The last sentence.');
    await notiz.evaluate((el) => (el.scrollTop = el.scrollHeight));
    const nk = await kasten(notiz);
    const lk = await kasten(letzte);
    expect(lk.y + lk.height).toBeLessThanOrEqual(nk.y + nk.height + 1);
    expect(lk.y).toBeGreaterThanOrEqual(nk.y - 1);
  }
});
