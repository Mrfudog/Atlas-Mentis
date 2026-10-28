/**
 * Die Kampagnenseite und die laufende Kampagne (T-411): die Seite öffnet
 * die Kampagne, die in der Kopfleiste steht, folgt einem Wechsel dort,
 * und eine neu angelegte Kampagne steht sofort in der Auswahl der
 * Kopfleiste — ohne Neuladen. Vorher nahm die Seite die alphabetisch
 * erste, und die Kopfleiste kannte die neue erst nach F5.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { RouterLink, provideRouter } from '@angular/router';
import { LIVE_TRANSPORT } from '../src/app/kern/live';
import { Stapel } from '../src/app/kern/stapel';
import { Verwaltung } from '../src/app/verwaltung/verwaltung';

type Kurz = { id: string; name: string; exists: boolean; role: string | null; may: string };
const kurz = (id: string, name: string): Kurz => ({ id, name, exists: true, role: 'gm', may: 'manage' });

let kampagnen: Kurz[];
let laufend: string;
const gefragt: { url: string; method: string; body?: string }[] = [];

function antwort(url: string, method: string, body?: string): unknown {
  if (url === '/api/campaigns' && method === 'POST') {
    const { name } = JSON.parse(body ?? '{}') as { name: string };
    const neu = kurz(`c-${name.toLowerCase()}`, name);
    kampagnen = [...kampagnen, neu];
    return { id: neu.id, name };
  }
  if (url === '/api/campaigns/current' && method === 'PUT') {
    laufend = (JSON.parse(body ?? '{}') as { id: string }).id;
    return { ok: true, current: laufend };
  }
  if (url === '/api/campaigns') {
    const k = kampagnen.find((c) => c.id === laufend)!;
    return {
      campaigns: [...kampagnen].sort((a, b) => a.name.localeCompare(b.name)),
      canCreate: true,
      isAdmin: true,
      current: { id: k.id, name: k.name, role: 'gm', may: 'manage', layers: 2, compare: 0 },
    };
  }
  const m = /^\/api\/campaigns\/([^/]+)\/members$/.exec(url);
  if (m) {
    const k = kampagnen.find((c) => c.id === decodeURIComponent(m[1]!))!;
    return { campaign: { id: k.id, name: k.name, exists: true }, may: 'manage', members: [], characters: [] };
  }
  if (url === '/api/invites' || url.startsWith('/api/users')) return [];
  if (url.startsWith('/api/me')) return { user: { id: 'u1', name: 'admin', isAdmin: true, actorIds: [], roles: {} }, actors: [] };
  return {};
}

const mitgliederVon = () =>
  gefragt.filter((g) => /\/members$/.test(g.url)).map((g) => decodeURIComponent(g.url.split('/')[3]!));

describe('the campaign page follows the running campaign (T-411)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    gefragt.length = 0;
    /* „Alpha" steht alphabetisch vorn, läuft aber nicht — „Zeta" läuft. */
    kampagnen = [kurz('c-alpha', 'Alpha'), kurz('c-zeta', 'Zeta')];
    laufend = 'c-zeta';
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? init.body : undefined;
      gefragt.push({ url, method, body });
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify(antwort(url, method, body)),
      } as Response;
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LIVE_TRANSPORT, useValue: () => () => undefined }],
    });
    /* Die Reiter und Listen darunter zählen hier nicht; sie bleiben leere Elemente. */
    TestBed.overrideComponent(Verwaltung, {
      set: { styleUrl: undefined, styleUrls: [], styles: [], imports: [FormsModule, NgTemplateOutlet, RouterLink], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  it('opens on the running campaign, not on the first by name', async () => {
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(Verwaltung);
    await vi.waitFor(() => expect(mitgliederVon()).toContain('c-zeta'));
    expect(mitgliederVon()).not.toContain('c-alpha');
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('.uebersicht h2')?.textContent).toBe('Zeta');
  });

  it('follows a switch in the bar without reloading', async () => {
    const s = TestBed.inject(Stapel);
    await s.laden();
    const f = TestBed.createComponent(Verwaltung);
    await vi.waitFor(() => expect(mitgliederVon()).toContain('c-zeta'));
    await s.wechseln('c-alpha');
    await vi.waitFor(() => expect(s.laufend()?.id).toBe('c-alpha'));
    await vi.waitFor(() => expect(mitgliederVon()).toContain('c-alpha'));
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('.uebersicht h2')?.textContent).toBe('Alpha');
  });

  it('puts a new campaign into the bar at once, and offers to make the shown one the running one', async () => {
    const s = TestBed.inject(Stapel);
    await s.laden();
    const f = TestBed.createComponent(Verwaltung);
    await vi.waitFor(() => expect(mitgliederVon()).toContain('c-zeta'));
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    /* Die gezeigte läuft schon: kein Knopf. */
    expect(el.querySelector('.laufend-machen')).toBeNull();

    const feld = el.querySelector<HTMLInputElement>('input[placeholder^="e.g."]')!;
    feld.value = 'Nebel';
    feld.dispatchEvent(new Event('input'));
    await f.whenStable();
    el.querySelector<HTMLFormElement>('form.anlegen, section[aria-label="New campaign"] form')!.dispatchEvent(new Event('submit'));
    /* Die Kopfleiste kennt sie, ohne dass jemand neu lädt. */
    await vi.waitFor(() => expect(s.kampagnen().map((k) => k.id)).toContain('c-nebel'));
    await vi.waitFor(() => expect(mitgliederVon()).toContain('c-nebel'));
    await f.whenStable();

    /* Die neue läuft noch nicht — die Verwaltung kann sie hier laufen lassen. */
    const knopf = el.querySelector<HTMLButtonElement>('.laufend-machen');
    expect(knopf?.textContent).toContain('Make this the running campaign');
    knopf!.click();
    await vi.waitFor(() => expect(s.laufend()?.id).toBe('c-nebel'));
    expect(gefragt.some((g) => g.url === '/api/campaigns/current' && g.method === 'PUT')).toBe(true);
    await f.whenStable();
    expect(el.querySelector('.laufend-machen')).toBeNull();
  });
});
