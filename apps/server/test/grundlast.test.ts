/**
 * **Ein Grundabruf baut den Bestand nicht neu** (T-398, P4 in
 * docs/Performance.md): jede Seite fragt `me`, `home`, `layers/write`,
 * `sources`, `campaigns` — und jede dieser Routen baute sich je Anfrage eine
 * eigene Nachschlagetafel über alle Artikel, auf dev über 200 000 Zeilen.
 * Gezählt wird, wie oft eine Anfrage den Bestand neu vom Repository holt
 * (`listEntities`); die Tafel je Stand (`entityMap`) ist dafür da.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const art = (id: string, type: string, name: string, relations: Entity['relations'] = []): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name }, Status: { status: 'ready' } },
  relations,
});

const ebene = art('ly_k', 'Layer', 'Kampagnenebene');
const kampagne = art('camp', 'Campaign', 'Nebel', [{ id: 'camp~a', type: 'activates', to: 'ly_k', props: {} }]);
const orte = Array.from({ length: 20 }, (_, i) => art(`o${i}`, 'Place', `Ort ${i}`, [{ id: `o${i}~l`, type: 'inLayer', to: 'ly_k', props: {} }]));

const WEGE = ['/api/me', '/api/home', '/api/layers/write', '/api/sources', '/api/campaigns', '/api/me/prefs', '/api/filters', '/api/list?limit=5', '/api/entities/o3'];

describe('base requests do not rebuild the whole stock (T-398, P4)', () => {
  for (const wer of ['Mira', 'Sela', 'Admin'] as const) {
    it(`fetches the stock at most once per request — ${wer}`, async () => {
      const t = await tisch({
        kampagne: 'camp',
        artikel: [ebene, kampagne, ...orte],
        konten: { Mira: { roles: { camp: 'gm' } }, Sela: { roles: { camp: 'player' } }, Admin: { admin: true } },
      });
      /* Vor dem ersten Abruf: der Live-Kanal bindet die Methoden beim ersten Gebrauch. */
      const lesen = vi.spyOn(t.repo, 'listEntities');
      /* Einmal warm: der erste Abruf nach dem Start darf lesen. */
      for (const w of WEGE) await t.als(wer, 'GET', w);
      const je: Record<string, number> = {};
      for (const w of WEGE) {
        const vorher = lesen.mock.calls.length;
        const res = await t.als(wer, 'GET', w);
        expect(res.statusCode, `${w}: ${res.body.slice(0, 200)}`).toBeLessThan(500);
        je[w] = lesen.mock.calls.length - vorher;
      }
      expect(je).toEqual(Object.fromEntries(WEGE.map((w) => [w, 0])));
    });
  }
});
