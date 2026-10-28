/**
 * Übungen einmal nachschlagen (T-443): der Statblock fragt je Übungsname
 * die Liste am Server. Auf dev feuerte er nach jedem Neuholen des Artikels
 * alle Anfragen von vorn — nach einem Schaden Dutzende, und PUT und
 * Neuholen standen dahinter an. `nachschlagen` fragt dieselbe Frage je
 * Sitzung einmal; scheitert sie, darf sie wieder gefragt werden.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Bestand } from '../src/app/kern/bestand';
import { LIVE_TRANSPORT } from '../src/app/kern/live';

let gefragt: string[];
let scheitern: boolean;

describe('looking a proficiency up once (T-443)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    gefragt = [];
    scheitern = false;
    vi.stubGlobal('fetch', async (url: string) => {
      gefragt.push(url);
      if (scheitern) return { ok: false, status: 400, headers: new Headers(), text: async () => '{"error":"x"}' } as Response;
      const body = { total: 1, offset: 0, limit: 20, columns: [], rows: [{ id: 'sk_athletics', name: 'Athletics', type: 'Skill', layers: [], source: '', status: 'ready', cols: {} }] };
      return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(body) } as Response;
    });
    TestBed.configureTestingModule({ providers: [{ provide: LIVE_TRANSPORT, useValue: () => () => undefined }] });
  });

  it('asks the same question once, also when asked again at once', async () => {
    const b = TestBed.inject(Bestand);
    const frage = { of: ['Skill', 'Language'], q: 'Athletics', limit: 20 };
    await Promise.all([b.nachschlagen(frage), b.nachschlagen({ ...frage })]);
    await b.nachschlagen({ ...frage, of: [...frage.of] });
    expect(gefragt.filter((u) => u.startsWith('/api/list'))).toHaveLength(1);
    expect(b.kurz().has('sk_athletics')).toBe(true);
    /* Eine andere Frage geht hinaus. */
    await b.nachschlagen({ ...frage, q: 'Nature' });
    expect(gefragt.filter((u) => u.startsWith('/api/list'))).toHaveLength(2);
  });

  it('asks again after a failure', async () => {
    const b = TestBed.inject(Bestand);
    scheitern = true;
    await b.nachschlagen({ of: ['Skill'], q: 'Stealth', limit: 20 }).catch(() => undefined);
    scheitern = false;
    await b.nachschlagen({ of: ['Skill'], q: 'Stealth', limit: 20 });
    expect(gefragt.filter((u) => u.startsWith('/api/list'))).toHaveLength(2);
  });
});
