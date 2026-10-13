/**
 * Die Routen samt Router, so wie `main.ts` sie aufbaut.
 *
 * Die Artikelseite liest ihre Id als Eingabe (`input.required`). Das geht
 * nur, wenn der Router Pfadteile an Eingaben bindet
 * (`withComponentInputBinding`). Fehlte das, warf Angular NG0950 und die
 * Seite stand weiss da — bemerkt erst auf dev, weil kein Test den echten
 * `appConfig` aufbaute.
 *
 * Gefragt wird der Router selbst und nicht die gezeichnete Seite: ohne den
 * Angular-Übersetzer kennt der JIT-Aufbau hier Signal-Eingaben nicht, und
 * die Seite fiele aus einem Grund durch, den es im Browser nicht gibt.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { appConfig } from '../src/app/app.config';
import { routes } from '../src/app/app.routes';

describe('routes', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: appConfig.providers });
  });

  it('binds path parameters to component inputs', () => {
    expect(TestBed.inject(Router).componentInputBindingEnabled).toBe(true);
  });

  it('names the article id the way the article page reads it', () => {
    expect(routes.some((r) => r.path === 'artikel/:id')).toBe(true);
  });
});
