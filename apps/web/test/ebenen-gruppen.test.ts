/**
 * Das Häkchen einer Gruppe (T-185): gerechnet aus dem Stand ihrer Bücher,
 * nicht aus der Kante der Gruppe — „Core rules" mit drei einzeln
 * aufgeschalteten Büchern ist ganz an. Was ein Klick schaltet, prüfen
 * `groupSwitched` (Modell) und die Route (`ebenen.test.ts` am Server).
 *
 * Dazu der Rückweg: nach „Zurück" steht die Seite wieder dort, wo man sie
 * verlassen hat — auch wenn die Liste erst nach dem Navigieren wächst.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, provideRouter } from '@angular/router';
import { gruppenHaken } from '../src/app/verwaltung/ebenen';
import { GEDULD, Rueckweg } from '../src/app/kern/rueckweg';

describe('the tick of a group (T-185)', () => {
  const an = { inPlay: true };
  const aus = { inPlay: false };

  it('is fully on when every book is on, even without the group itself in play', () => {
    /* „Core rules" auf dev: drei Bücher einzeln an, die Gruppe nicht im Stapel. */
    expect(gruppenHaken(aus, [an, an, an])).toBe('an');
  });

  it('is partly on with one book out, and off with none on', () => {
    expect(gruppenHaken(an, [an, aus])).toBe('teils');
    expect(gruppenHaken(aus, [aus, aus])).toBe('aus');
  });

  it('follows the group itself when it holds nothing', () => {
    expect(gruppenHaken(an, [])).toBe('an');
    expect(gruppenHaken(aus, [])).toBe('aus');
  });
});

@Component({ template: '' })
class Leer {}

describe('back to the same place (T-185)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'campaign', component: Leer },
          { path: 'artikel/:id', component: Leer },
        ]),
        provideLocationMocks(),
      ],
    });
  });

  it('waits for the list to grow and scrolls back to where it was, only on back', async () => {
    let hoehe = 400;
    let y = 0;
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockImplementation(() => hoehe);
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => y);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(((o: ScrollToOptions) => {
      y = o.top ?? 0;
    }) as typeof window.scrollTo);
    TestBed.inject(Rueckweg);
    const router = TestBed.inject(Router);
    /* Erst damit hört der Router auf „Zurück" (sonst beim Start der App). */
    router.initialNavigation();
    await router.navigateByUrl('/campaign');
    y = 1800;
    await router.navigateByUrl('/artikel/x');
    /* Die neue Seite fängt oben an; ein Link setzt nichts zurück. */
    y = 0;
    expect(scroll).not.toHaveBeenCalled();
    TestBed.inject(Location).back();
    await vi.advanceTimersByTimeAsync(0);
    /* Die Liste ist noch kurz: gewartet, nicht gesprungen. */
    await vi.advanceTimersByTimeAsync(200);
    expect(scroll).not.toHaveBeenCalled();
    hoehe = 3000;
    await vi.advanceTimersByTimeAsync(100);
    expect(scroll).toHaveBeenCalledWith({ top: 1800 });
    expect(y).toBe(1800);
    expect(GEDULD).toBeGreaterThan(1000);
    vi.useRealTimers();
  });
});
