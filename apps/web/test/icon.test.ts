/**
 * Das Icon und sein Wähler (T-461, REQ-460): ein bekannter Name zeichnet
 * ein SVG, ein unbekannter nichts; mit Beschriftung ist es ein Bild mit
 * Namen, ohne eine Zierde; der Wähler findet nach Name und Tag und gibt den
 * Namen zurück, „None“ den leeren.
 *
 * Die Prüfumgebung übersetzt JIT, und JIT kennt `input()` nicht — die
 * Signale werden vor dem ersten Zeichnen ersetzt (wie in `text.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Icon } from '../src/app/muster/icon';
import { IconWahl } from '../src/app/muster/icon-wahl';

function icon(name: string | undefined, label = '') {
  const f = TestBed.createComponent(Icon);
  Object.assign(f.componentInstance, { name: signal(name), label: signal(label) });
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement };
}

function wahl(wert = '', geerbt = 'map-pin') {
  const f = TestBed.createComponent(IconWahl);
  const w = signal(wert);
  Object.assign(f.componentInstance, { wert: w, geerbt: signal(geerbt), label: signal('Icon'), disabled: signal(false) });
  const gewaehlt: string[] = [];
  f.componentInstance.wertChange.subscribe((v) => {
    gewaehlt.push(v);
    w.set(v);
  });
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, w, gewaehlt };
}

describe('nw-icon', () => {
  it('draws a known icon as decoration beside a name and as an image on its own', () => {
    const zier = icon('globe').el;
    expect(zier.querySelector('svg path')?.getAttribute('d')).toMatch(/^[Mm]/);
    expect(zier.getAttribute('aria-hidden')).toBe('true');
    expect(zier.getAttribute('data-icon')).toBe('globe');
    expect(zier.getAttribute('role')).toBeNull();
    const allein = icon('map-pin', 'Place').el;
    expect(allein.getAttribute('role')).toBe('img');
    expect(allein.getAttribute('aria-label')).toBe('Place');
    expect(allein.getAttribute('aria-hidden')).toBeNull();
  });

  it('draws nothing for a name the set does not know, and nothing for none', () => {
    const fremd = icon('nope', 'Nothing').el;
    expect(fremd.querySelector('svg')).toBeNull();
    expect(fremd.classList.contains('leer')).toBe(true);
    expect(fremd.getAttribute('role')).toBeNull();
    expect(fremd.getAttribute('aria-hidden')).toBe('true');
    expect(icon(undefined).el.querySelector('svg')).toBeNull();
  });
});

describe('nw-icon-wahl', () => {
  it('shows the inherited icon, searches by tag and returns the chosen name', () => {
    const { el, f, gewaehlt } = wahl();
    const knopf = el.querySelector<HTMLButtonElement>('.jetzt')!;
    expect(knopf.textContent).toContain('inherited — map-pin');
    /* Das Bild im Knopf zeichnet `nw-icon` über ein `input()` — in JIT nicht
       prüfbar; der E2E-Lauf sieht es. */
    knopf.click();
    f.detectChanges();
    const suche = el.querySelector<HTMLInputElement>('input[type=search]')!;
    suche.value = 'weapon';
    suche.dispatchEvent(new Event('input'));
    f.detectChanges();
    const treffer = [...el.querySelectorAll<HTMLButtonElement>('.raster .icon')].map((b) => b.textContent?.trim());
    expect(treffer).toContain('sword');
    expect(treffer).not.toContain('globe');
    el.querySelector<HTMLButtonElement>('.raster .icon[title^="Sword"]')!.click();
    f.detectChanges();
    expect(gewaehlt).toEqual(['sword']);
    expect(el.querySelector('.katalog')).toBeNull();
    expect(el.querySelector('.jetzt')!.textContent).toContain('sword');
  });

  it('offers None only with an own choice and returns the empty name', () => {
    const { el, f, w, gewaehlt } = wahl();
    el.querySelector<HTMLButtonElement>('.jetzt')!.click();
    f.detectChanges();
    expect(el.querySelector('.keins')).toBeNull();
    w.set('sword');
    f.detectChanges();
    el.querySelector<HTMLButtonElement>('.keins')!.click();
    f.detectChanges();
    expect(gewaehlt).toEqual(['']);
    expect(el.querySelector('.jetzt')!.textContent).toContain('inherited — map-pin');
  });

  it('names an unknown choice as unknown instead of hiding it', () => {
    const { el } = wahl('nope', '');
    expect(el.querySelector('.jetzt')!.textContent).toContain('nope (unknown)');
  });
});
