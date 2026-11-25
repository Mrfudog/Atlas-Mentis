/**
 * „View as" im Kopf (T-269, REQ-241): die Leitung sieht den Knopf, die
 * Liste nennt, wen der Server anbietet (`viewAs`), nach Rolle und mit
 * Figur; ein Klick setzt den Kopf `X-View-As`. Spielende sehen keinen
 * Knopf. Gesiebt wird am Server — hier nur, was die Maske anbietet.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../src/app/kern/api';
import { LIVE_TRANSPORT } from '../src/app/kern/live';
import { Stapel } from '../src/app/kern/stapel';
import { SichtKnopf } from '../src/app/verwaltung/sicht-knopf';

let rolle: string;
const gefragt: { url: string; sicht: string | null }[] = [];
const mitglieder = {
  campaign: { id: 'camp', name: 'Aus Nebel wacht', exists: true },
  may: 'manage',
  members: [
    { id: 'u_gm', name: 'Basil', role: 'gm', isAdmin: false, disabled: false, self: true, actors: [], viewAs: false },
    { id: 'u_sela', name: 'Sela', role: 'player', isAdmin: false, disabled: false, self: false, actors: [{ id: 'pc', name: 'Rook' }, { id: 'weg', name: null }], viewAs: true },
    { id: 'u_zu', name: 'Zuschauer', role: 'spectator', isAdmin: false, disabled: false, self: false, actors: [], viewAs: true },
    { id: 'u_admin', name: 'Admin', role: 'player', isAdmin: true, disabled: false, self: false, actors: [], viewAs: false },
  ],
};

describe('View as in the header (T-269)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    gefragt.length = 0;
    rolle = 'gm';
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      gefragt.push({ url, sicht: h.get('x-view-as') });
      const body = url.startsWith('/api/campaigns/camp/members')
        ? mitglieder
        : url === '/api/campaigns'
          ? { campaigns: [], canCreate: false, isAdmin: false, current: { id: 'camp', name: 'Aus Nebel wacht', role: rolle, may: rolle === 'gm' ? 'manage' : null, layers: 3 } }
          : url === '/api/me'
            ? { user: { id: 'u_gm', name: 'Basil', isAdmin: false, roles: { camp: rolle }, actorIds: [] } }
            : {};
      return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(body) } as Response;
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LIVE_TRANSPORT, useValue: () => () => undefined }],
    });
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {
      /* ohne Speicher auch gut */
    }
  });

  it('offers the members the server allows, by role and with their character, and switches with one click', async () => {
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(SichtKnopf);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const knopf = el.querySelector<HTMLButtonElement>('.knopf')!;
    expect(knopf.textContent).toContain('View as');
    knopf.click();
    await f.whenStable();
    f.detectChanges();
    const menue = el.querySelector('.menue')!;
    expect(menue.textContent).toContain('Players');
    expect(menue.textContent).toContain('Spectators');
    const personen = [...menue.querySelectorAll<HTMLButtonElement>('.person')].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
    /* Sich selbst und wen der Server nicht anbietet, gibt es nicht; eine verschwundene Figur fällt weg. */
    expect(personen).toEqual(['Sela Rook', 'Zuschauer']);
    menue.querySelector<HTMLButtonElement>('.person')!.click();
    await f.whenStable();
    expect(TestBed.inject(Api).viewAs()).toBe('u_sela');
    expect(gefragt.some((g) => g.url === '/api/me' && g.sicht === 'u_sela')).toBe(true);
  });

  it('shows nothing to a player', async () => {
    rolle = 'player';
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(SichtKnopf);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('.knopf')).toBeNull();
  });
});
