/**
 * Die Sitzung in der Oberfläche.
 *
 * Geprüft wird der Fall, den man beim Bauen nicht sieht: der Zustand hat
 * **drei** Werte, nicht zwei. „Noch nicht gefragt" und „nicht angemeldet"
 * zu verwechseln wirft den Nutzer beim Neuladen für einen Wimpernschlag
 * auf die Anmeldemaske — und wer das einmal gesehen hat, traut der
 * Anmeldung nicht mehr.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Session } from '../src/app/kern/session';

interface Antwort {
  status: number;
  body: unknown;
}
function stubFetch(antworten: Record<string, Antwort>) {
  const gesehen: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    gesehen.push({ url, init });
    const a = antworten[url] ?? { status: 404, body: { error: 'nope' } };
    return {
      ok: a.status >= 200 && a.status < 300,
      status: a.status,
      text: async () => JSON.stringify(a.body),
    } as Response;
  });
  return gesehen;
}

describe('Session', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('starts as “not asked yet”, not as “signed out”', () => {
    stubFetch({});
    const s = TestBed.inject(Session);
    expect(s.stand()).toBe('unbekannt');
    expect(s.angemeldet()).toBe(false);
  });

  it('holds what the server says about the viewer', async () => {
    stubFetch({
      '/api/me': { status: 200, body: { user: { id: 'u', name: 'Basil', isGm: true }, setup: null } },
    });
    const s = TestBed.inject(Session);
    await s.load();
    expect(s.stand()).toBe('bereit');
    expect(s.angemeldet()).toBe(true);
    expect(s.isGm()).toBe(true);
    expect(s.user()?.name).toBe('Basil');
  });

  /* Der frische Server sagt, wie man das erste Konto anlegt — und die Maske
     zeigt dann keinen Anmeldeschlitz, sondern den Satz. Ein Anmeldefeld
     ohne Konto ist eine Sackgasse mit Aufforderung. */
  it('carries the setup hint of a fresh server', async () => {
    stubFetch({ '/api/me': { status: 200, body: { user: null, setup: 'user add <name> --gm' } } });
    const s = TestBed.inject(Session);
    await s.load();
    expect(s.setupHint()).toMatch(/user add/);
    expect(s.angemeldet()).toBe(false);
  });

  it('asks once even when several ask at the same time', async () => {
    const gesehen = stubFetch({
      '/api/me': { status: 200, body: { user: null, setup: null } },
    });
    const s = TestBed.inject(Session);
    await Promise.all([s.load(), s.load(), s.load()]);
    expect(gesehen.filter((g) => g.url === '/api/me')).toHaveLength(1);
  });

  /* Kommt der Server nicht, ist niemand angemeldet — aber die Sitzung ist
     „bereit" und nicht ewig „unbekannt", sonst hängt die Wache. */
  it('settles even when the server does not answer', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('kein Netz');
    });
    const s = TestBed.inject(Session);
    await s.load();
    expect(s.stand()).toBe('bereit');
    expect(s.angemeldet()).toBe(false);
  });

  it('gives back the server’s own words when signing in fails', async () => {
    stubFetch({
      '/api/login': { status: 401, body: { error: 'Name oder Passwort stimmt nicht.' } },
    });
    const s = TestBed.inject(Session);
    expect(await s.login('Basil', 'daneben')).toBe('Name oder Passwort stimmt nicht.');
    expect(s.angemeldet()).toBe(false);
  });

  it('signs in and is ready right away, without asking again', async () => {
    const gesehen = stubFetch({
      '/api/login': { status: 200, body: { user: { id: 'u', name: 'Sela', isGm: false } } },
    });
    const s = TestBed.inject(Session);
    expect(await s.login('Sela', 'nebel-wacht-am-tor')).toBeNull();
    expect(s.angemeldet()).toBe(true);
    expect(s.stand()).toBe('bereit');
    expect(gesehen.some((g) => g.url === '/api/me')).toBe(false);
  });

  /* Der Keks ist httpOnly: die Anwendung sieht ihn nie. Sie muss ihn aber
     mitschicken lassen, und das ist genau eine Zeile, die man vergisst. */
  it('lets the browser send the session cookie', async () => {
    const gesehen = stubFetch({ '/api/me': { status: 200, body: { user: null, setup: null } } });
    await TestBed.inject(Session).load();
    expect(gesehen[0]?.init?.credentials).toBe('include');
  });

  /* Wenn der Server die Abmeldung nicht bestätigt, ist beides falsch:
     weiter so tun, als wäre jemand da — und „abgemeldet" sagen, während die
     Sitzung dort weiterlebt. Also lokal leeren **und** es hinschreiben. */
  it('signs out locally and says so when the server did not confirm', async () => {
    stubFetch({
      '/api/me': { status: 200, body: { user: { id: 'u', name: 'Basil', isGm: true }, setup: null } },
      '/api/logout': { status: 500, body: { error: 'kaputt' } },
    });
    const s = TestBed.inject(Session);
    await s.load();
    const warnung = await s.logout();
    expect(s.angemeldet()).toBe(false);
    expect(warnung).toMatch(/did not confirm/);
  });

  it('says nothing when the sign-out went through', async () => {
    stubFetch({
      '/api/me': { status: 200, body: { user: { id: 'u', name: 'Basil', isGm: true }, setup: null } },
      '/api/logout': { status: 200, body: { ok: true } },
    });
    const s = TestBed.inject(Session);
    await s.load();
    expect(await s.logout()).toBeNull();
    expect(s.angemeldet()).toBe(false);
  });
});
