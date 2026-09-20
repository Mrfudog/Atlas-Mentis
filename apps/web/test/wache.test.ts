/**
 * Die Wache vor den Routen.
 *
 * Der Fall, den man beim Bauen nicht sieht: sie muss **warten**, bis die
 * Sitzung gefragt wurde. Fragt sie vorher, schickt sie beim Neuladen jeden
 * einmal kurz auf die Anmeldemaske — und wer das sieht, traut der Anmeldung
 * nicht mehr.
 *
 * Und sie ist Bequemlichkeit, keine Sicherheit. Das steht hier, damit es
 * nicht irgendwann jemand für die Sicherheitsprüfung hält: die Rechte
 * hängen am Server, und der Prüflauf dort prüft sie.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { wache } from '../src/app/kern/wache';
import { Session } from '../src/app/kern/session';

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    async () =>
      ({
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(body),
      }) as Response,
  );
}

describe('wache', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('waits for the session instead of guessing, and then lets a viewer in', async () => {
    stubFetch({ user: { id: 'u', name: 'Basil', isGm: true }, setup: null });
    const ergebnis = await TestBed.runInInjectionContext(() =>
      wache({} as never, { url: '/artikel/x' } as never),
    );
    expect(ergebnis).toBe(true);
    expect(TestBed.inject(Session).stand()).toBe('bereit');
  });

  /* Und wer nicht angemeldet ist, landet auf der Anmeldemaske — mit dem
     Weg im Gepäck, damit er danach dort ankommt, wo er hinwollte. */
  it('sends a stranger to the sign-in page and remembers where they wanted to go', async () => {
    stubFetch({ user: null, setup: null });
    const ergebnis = await TestBed.runInInjectionContext(() =>
      wache({} as never, { url: '/artikel/x' } as never),
    );
    expect(String(ergebnis)).toContain('/login');
    expect(String(ergebnis)).toContain('weiter=');
  });
});
