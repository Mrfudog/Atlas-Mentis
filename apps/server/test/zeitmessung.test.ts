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

  it('splits the sieve into its parts for a player', async () => {
    const t = await tisch({ kampagne: 'camp', artikel: [art('camp', 'Campaign', 'Nebel'), art('o1', 'Place', 'Ort')], konten: { Sela: { roles: { camp: 'player' } } } });
    const res = await t.als('Sela', 'GET', '/api/entities/o1');
    const z = zeitenAus(String(res.headers['server-timing'] ?? ''));
    expect(Object.keys(z)).toEqual(expect.arrayContaining(['s.stapel', 's.auge', 's.sichtbar', 's.wissen']));
  });

  it('works out whose eyes the sieve uses once per stock and viewer (T-398)', async () => {
    const t = await tisch({ kampagne: 'camp', artikel: [art('camp', 'Campaign', 'Nebel'), art('o1', 'Place', 'Ort')], konten: { Sela: { roles: { camp: 'player' } } } });
    const neu = async () => zeitenAus(String((await t.als('Sela', 'GET', '/api/entities/o1')).headers['server-timing'] ?? ''))['s.auge.neu']?.n ?? 0;
    expect(await neu()).toBeGreaterThan(0);
    /* Derselbe Stand, dieselbe Spielerin: nichts neu zu rechnen. */
    expect(await neu()).toBe(0);
    /* Ändert sich der Bestand, gilt es neu. */
    await t.repo.putEntity(art('o2', 'Place', 'Anderer Ort'));
    expect(await neu()).toBeGreaterThan(0);
  });

  it('reuses the eyes for routes that read the whole stock as a list (entities?ids, suggest, checks)', async () => {
    const t = await tisch({ kampagne: 'camp', artikel: [art('camp', 'Campaign', 'Nebel'), art('o1', 'Place', 'Ort')], konten: { Sela: { roles: { camp: 'player' } } } });
    const neu = async (weg: string) => zeitenAus(String((await t.als('Sela', 'GET', weg)).headers['server-timing'] ?? ''))['s.auge.neu']?.n ?? 0;
    expect(await neu('/api/entities/o1')).toBeGreaterThan(0);
    /* Auf dev rechnete jeder der acht `entities?ids` einer Artikelseite neu (29.10.). */
    expect(await neu('/api/entities?ids=o1')).toBe(0);
    expect(await neu('/api/entities?ids=o1,camp')).toBe(0);
    expect(await neu('/api/suggest?field=Place.kind')).toBe(0);
  });

  it('keeps requests apart: one request does not count the other’s sections', async () => {
    const t = await tisch({ artikel: [art('o1', 'Place', 'Ort')], konten: { Admin: { admin: true } } });
    const [a, b] = await Promise.all([t.als('Admin', 'GET', '/api/health'), t.als('Admin', 'GET', '/api/entities/o1')]);
    expect(Object.keys(zeitenAus(String(a.headers['server-timing'])))).toEqual(['app']);
    expect(Object.keys(zeitenAus(String(b.headers['server-timing'])))).toContain('sieb');
  });
});
