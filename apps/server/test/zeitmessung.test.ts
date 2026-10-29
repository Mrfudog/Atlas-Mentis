/**
 * **Server-Timing sagt, wo die Zeit bleibt** (T-398, P8 in
 * docs/Performance.md): auf dev brauchte ein einzelner Artikel neun
 * Sekunden, und `app;dur=` sagte nur, dass es lange dauerte. Je Anfrage
 * stehen jetzt die Abschnitte dabei — Datenbank, Bestand, Sieb, Index —
 * mit Zeit und Zahl der Aufrufe, ohne Inhalte.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';
import { zeitenAus } from '../src/zeitmessung.js';

const art = (id: string, type: string, name: string): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name }, Status: { status: 'ready' } },
  relations: [],
});

describe('Server-Timing per section (T-398)', () => {
  it('names the database, the stock and the sieve for an article', async () => {
    const t = await tisch({ artikel: [art('o1', 'Place', 'Ort')], konten: { Admin: { admin: true } } });
    const res = await t.als('Admin', 'GET', '/api/entities/o1');
    expect(res.statusCode).toBe(200);
    const kopf = String(res.headers['server-timing'] ?? '');
    const z = zeitenAus(kopf);
    expect(Object.keys(z)).toEqual(expect.arrayContaining(['app', 'db', 'sieb']));
    expect(z['db']!.n).toBeGreaterThan(0);
    for (const v of Object.values(z)) expect(v.dur).toBeGreaterThanOrEqual(0);
  });

  it('keeps requests apart: one request does not count the other’s sections', async () => {
    const t = await tisch({ artikel: [art('o1', 'Place', 'Ort')], konten: { Admin: { admin: true } } });
    const [a, b] = await Promise.all([t.als('Admin', 'GET', '/api/health'), t.als('Admin', 'GET', '/api/entities/o1')]);
    expect(Object.keys(zeitenAus(String(a.headers['server-timing'])))).toEqual(['app']);
    expect(Object.keys(zeitenAus(String(b.headers['server-timing'])))).toContain('sieb');
  });
});
