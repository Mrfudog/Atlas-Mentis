/**
 * Kampagne und Ebenen in der Kopfleiste (T-143): der Knopf nennt die
 * laufende Kampagne und wie viele Ebenen im Spiel sind; das Popup sagt
 * Spielenden, dass die Leitung wählt, und schliesst mit Escape. Ein
 * Häkchen zählt `stand` weiter — daran fragen die Listen neu.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LIVE_TRANSPORT } from '../src/app/kern/live';
import { Stapel } from '../src/app/kern/stapel';
import { StapelKnopf } from '../src/app/verwaltung/stapel-knopf';

let antwort: unknown;
const gefragt: string[] = [];

describe('the campaign in the bar (T-143)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    gefragt.length = 0;
    antwort = {
      campaigns: [],
      canCreate: false,
      isAdmin: false,
      current: { id: 'camp', name: 'Aus Nebel wacht', role: 'player', may: null, layers: 4 },
    };
    vi.stubGlobal('fetch', async (url: string) => {
      gefragt.push(url);
      return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(antwort) } as Response;
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LIVE_TRANSPORT, useValue: () => () => undefined }],
    });
  });

  it('names the running campaign and its layers, and tells a player who chooses', async () => {
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(StapelKnopf);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const knopf = el.querySelector<HTMLButtonElement>('.knopf')!;
    expect(knopf.textContent).toContain('Aus Nebel wacht');
    expect(knopf.textContent).toContain('4 layers');
    knopf.click();
    await f.whenStable();
    expect(el.querySelector('[role="dialog"]')?.textContent).toContain('The GM chooses which');
    /* Die Ebenenliste fragt nur, wer sie sehen darf. */
    expect(el.querySelector('nw-kampagnen-ebenen')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await f.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('counts every change, so the lists ask again, and fetches the count anew', async () => {
    const s = TestBed.inject(Stapel);
    await s.laden();
    const vorher = s.stand();
    antwort = { ...(antwort as object), current: { id: 'camp', name: 'Aus Nebel wacht', role: 'gm', may: 'manage', layers: 1 } };
    s.geaendert();
    expect(s.stand()).toBe(vorher + 1);
    await vi.waitFor(() => expect(s.laufend()?.layers).toBe(1));
    expect(gefragt.filter((u) => u === '/api/campaigns')).toHaveLength(2);
  });

  it('shows nothing without a running campaign', async () => {
    antwort = { campaigns: [], canCreate: false, isAdmin: false, current: null };
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(StapelKnopf);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('.knopf')).toBeNull();
  });
});
