/**
 * Die übergreifende Suche (T-138): tippen fragt den Server, Enter öffnet,
 * Shift+Enter zeigt die Kurzansicht, das „+" klappt auf, ein Filter geht
 * mit der Frage hinaus, und das Zuletzt bleibt.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal, ɵresolveComponentResources as stileAufloesen } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SucheComponent } from '../src/app/suche/suche';
import { Suche, tipptGerade } from '../src/app/kern/suche';
import { Api, type SuchFrage, type Suchergebnis } from '../src/app/kern/api';
import { Kurzansicht } from '../src/app/kern/kurzansicht';
import { Bestand } from '../src/app/kern/bestand';

const antwort = (q: string): Suchergebnis => ({
  q,
  total: 2,
  offset: 0,
  limit: 12,
  rows: [
    {
      id: 's1',
      name: 'Fireball',
      type: 'Spell',
      typeLabel: 'Spell',
      area: 'rules',
      layers: ['Player Handbook'],
      publishers: ['Wizards'],
      source: 'PHB p. 241',
    },
    {
      id: 'c1',
      name: 'Fire Sorcerer',
      type: 'Class',
      typeLabel: 'Class',
      area: 'rules',
      layers: [],
      publishers: [],
      source: '',
    },
  ],
  facets: {
    types: [
      { type: 'Class', label: 'Class', area: 'rules', count: 1 },
      { type: 'Spell', label: 'Spell', area: 'rules', count: 1 },
    ],
    layers: [{ id: 'l1', name: 'Player Handbook', count: 1 }],
    publishers: [{ name: 'Wizards', count: 1 }],
  },
});

function taste(el: Element, key: string, mehr: KeyboardEventInit = {}): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mehr });
  el.dispatchEvent(ev);
  return ev;
}

describe('the search everywhere (T-138)', () => {
  let fragen: SuchFrage[];
  beforeEach(async () => {
    /* Die Vorschau zeichnet mit dem Baum (T-310), und der mit Statblock und
       Zauber — deren Stildateien liest diese Prüfumgebung nicht; leer reicht. */
    await stileAufloesen(() => Promise.resolve(''));
    vi.useFakeTimers();
    localStorage.clear();
    fragen = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SucheComponent],
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        provideRouter([]),
        { provide: Bestand, useValue: { voll: signal(new Map()), fehlt: signal(new Set()) } },
        {
          provide: Api,
          useValue: {
            search: (f: SuchFrage) => {
              fragen.push(f);
              return Promise.resolve(antwort(f.q));
            },
          },
        },
      ],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  async function offen() {
    const f = TestBed.createComponent(SucheComponent);
    TestBed.inject(Suche).oeffnen();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const feld = el.querySelector('input')!;
    const tippe = async (text: string) => {
      feld.value = text;
      feld.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(200);
      f.detectChanges();
    };
    return { f, el, feld, tippe, router: TestBed.inject(Router), suche: TestBed.inject(Suche) };
  }

  it('asks the server while typing, once the typing pauses', async () => {
    const { el, feld, tippe } = await offen();
    await tippe('fi');
    expect(document.activeElement).toBe(feld);
    await tippe('fire');
    expect(fragen.map((x) => x.q)).toEqual(['fi', 'fire']);
    const namen = [...el.querySelectorAll('[role="option"] .name')].map((a) =>
      a.textContent?.trim(),
    );
    expect(namen).toEqual(['Fireball', 'Fire Sorcerer']);
    expect(el.querySelector('[role="option"] .name')?.getAttribute('href')).toBe('/artikel/s1');
    /* Auch eine Klasse öffnet auf ihrer Artikelseite — die Übersicht ist dort ein Element (T-191). */
    expect(el.querySelectorAll('[role="option"] .name')[1]?.getAttribute('href')).toBe(
      '/artikel/c1',
    );
  });

  it('opens with Enter, remembers it, and shows the quick view with Shift+Enter', async () => {
    const { feld, tippe, router, suche } = await offen();
    await tippe('fire');
    const kurz = TestBed.inject(Kurzansicht);
    taste(feld, 'Enter', { shiftKey: true });
    expect(kurz.offen()?.id).toBe('s1');
    expect(suche.offen()).toBe(true);
    const weg = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    taste(feld, 'ArrowDown');
    taste(feld, 'Enter');
    expect(weg).toHaveBeenCalledWith(['/artikel', 'c1']);
    expect(suche.offen()).toBe(false);
    expect(suche.zuletzt()[0]).toMatchObject({ id: 'c1', type: 'Class' });
    expect(JSON.parse(localStorage.getItem('atlas.suche.v1')!).zuletzt[0].id).toBe('c1');
  });

  it('unfolds a hit with + into type, layer, publisher and source', async () => {
    const { f, el, tippe } = await offen();
    await tippe('fire');
    (el.querySelector('.plus') as HTMLButtonElement).click();
    f.detectChanges();
    const mehr = el.querySelector('.mehr-info')!.textContent!;
    expect(mehr).toContain('Player Handbook');
    expect(mehr).toContain('Wizards');
    expect(mehr).toContain('PHB p. 241');
    expect(el.querySelector('.plus')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('sends a filter with the question and keeps it as recently used', async () => {
    const { f, el, tippe, suche } = await offen();
    await tippe('fire');
    const spell = [...el.querySelectorAll('.chip')].find((b) =>
      b.textContent?.includes('Spell'),
    ) as HTMLButtonElement;
    spell.click();
    await vi.advanceTimersByTimeAsync(0);
    f.detectChanges();
    expect(fragen.at(-1)).toMatchObject({ q: 'fire', type: ['Spell'] });
    const verlag = [...el.querySelectorAll('.chip')].find((b) =>
      b.textContent?.includes('Wizards'),
    ) as HTMLButtonElement;
    verlag.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(fragen.at(-1)).toMatchObject({ type: ['Spell'], publisher: ['Wizards'] });
    expect(suche.filterZuletzt().map((x) => x.value)).toEqual(['Wizards', 'Spell']);
  });

  it('closes with Esc', async () => {
    const { feld, suche } = await offen();
    taste(feld, 'Escape');
    expect(suche.offen()).toBe(false);
  });

  it('leaves / to a field that is being typed in', () => {
    const feld = document.createElement('textarea');
    expect(tipptGerade(feld)).toBe(true);
    expect(tipptGerade(document.createElement('button'))).toBe(false);
  });
});
