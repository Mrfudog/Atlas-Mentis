/**
 * Die Kapitel einer Seite (T-277): am Telefon Reiter, nur was dasteht, mit
 * Zahl; gewählt ist, was die URL sagt, sonst die Vorgabe, sonst das erste.
 */

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/app/kern/api';
import { Kapitel, Kapitelteil, kapitelReiter, kapitelWahl } from '../src/app/muster/kapitel';

describe('kapitelReiter', () => {
  it('leaves out empty chapters and puts the count after the title', () => {
    const r = kapitelReiter([
      { key: 'fields', titel: 'Fields', zahl: null, zeigen: true },
      { key: 'relations', titel: 'Relations', zahl: 0, zeigen: false },
      { key: 'linked', titel: 'Linked here', zahl: 154, zeigen: true },
      { key: 'admin', titel: 'Admin', zahl: null, zeigen: true },
    ]);
    expect(r).toEqual([
      { id: 'fields', label: 'Fields' },
      { id: 'linked', label: 'Linked here · 154' },
      { id: 'admin', label: 'Admin' },
    ]);
  });
});

describe('kapitelWahl', () => {
  const ids = ['fields', 'linked', 'admin'];
  it('takes the first wish that is there', () => {
    expect(kapitelWahl(ids, [null, 'admin', 'linked'])).toBe('admin');
  });
  it('skips a chapter that does not stand there (?k=relations without edges)', () => {
    expect(kapitelWahl(ids, [null, 'relations', null])).toBe('fields');
  });
  it('without chapters there is nothing to choose', () => {
    expect(kapitelWahl([], ['admin'])).toBeNull();
  });
});

/* T-359: Ein Kapitel, das am Desktop zugeklappt anfängt (Admin, Log), ist
   ein Bereich der Klappleiste — „Expand all" öffnet es —, und die Seite
   merkt sich am Konto, wie es verlassen wurde.

   Die Prüfumgebung übersetzt JIT, und JIT kennt `input()` nicht (siehe
   text.test.ts): die Signale werden vor dem ersten Zeichnen ersetzt, und
   das Kapitel steht als Rahmen für sein Teil bereit. */
describe('Kapitelteil und die Klappleiste (T-359)', () => {
  function aufbauen(gemerkt: Record<string, unknown> = {}) {
    const setPref = vi.fn(async () => ({ ok: true as const }));
    const halter: { k?: Kapitel } = {};
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Api, useValue: { prefs: async () => gemerkt, setPref } },
        /* Erst gefragt, wenn ein Teil entsteht — dann steht der Rahmen. */
        { provide: Kapitel, useFactory: () => halter.k },
      ],
    });
    const rahmenF = TestBed.createComponent(Kapitel);
    Object.assign(rahmenF.componentInstance, { merke: signal('test'), vorgabe: signal(null) });
    rahmenF.detectChanges();
    const rahmen = rahmenF.componentInstance;
    halter.k = rahmen;
    const teil = (key: string, zu: boolean) => {
      const f = TestBed.createComponent(Kapitelteil);
      Object.assign(f.componentInstance, {
        key: signal(key), titel: signal(key), zu: signal(zu), zahl: signal(null), hinweis: signal(''), zeigen: signal(true), lage: signal('haupt'),
      });
      f.detectChanges();
      return f;
    };
    return { rahmen, rahmenF, teil, setPref };
  }

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('marks every chapter as a section, and the collapsible ones with their state', () => {
    const { teil } = aufbauen();
    const felder = teil('felder', false).nativeElement as HTMLElement;
    const admin = teil('admin', true).nativeElement as HTMLElement;
    expect(felder.hasAttribute('data-bereich')).toBe(true);
    expect(felder.hasAttribute('data-klappbar')).toBe(false);
    expect(admin.hasAttribute('data-klappbar')).toBe(true);
    expect(admin.getAttribute('data-offen')).toBe('false');
  });

  it('opens on “klappen” and remembers it for the account', async () => {
    vi.useFakeTimers();
    const { teil, setPref } = aufbauen();
    await vi.runAllTimersAsync();
    const f = teil('admin', true);
    const el = f.nativeElement as HTMLElement;
    el.dispatchEvent(new CustomEvent('klappen', { detail: true }));
    f.detectChanges();
    expect(el.getAttribute('data-offen')).toBe('true');
    expect(el.classList.contains('zu')).toBe(false);
    await vi.runAllTimersAsync();
    expect(setPref).toHaveBeenCalledWith('kapitel.test', { admin: true });
  });

  it('starts the way the account left it', async () => {
    const { teil, rahmen } = aufbauen({ 'kapitel.test': { admin: true } });
    await vi.waitFor(() => expect(rahmen.gemerkt()).not.toBeNull());
    const f = teil('admin', true);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).getAttribute('data-offen')).toBe('true');
  });
});
