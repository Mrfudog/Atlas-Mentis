/**
 * Ein langes Textfeld in der Oberfläche (M10–M12).
 *
 * Geprüft wird, was man beim Hinschauen leicht übersieht: dass HTML im
 * Feld **Text** bleibt, dass ein mehrdeutiger Name nicht still zum ersten
 * Treffer führt, und dass ein Würfel tatsächlich würfelt.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import type { Entity } from '@nw/model';
import { Text } from '../src/app/artikel/text';
import { Bestand } from '../src/app/kern/bestand';

const art = (id: string, name: string, nr: string) =>
  ({ id, name, interfaces: ['Creature'], components: { Identity: { name, id: nr } } }) as unknown as Entity;

/* Die Prüfumgebung übersetzt JIT, und JIT kennt `input()` nicht — `setInput`
   scheitert mit NG0303. Also wird das Signal vor dem ersten Zeichnen
   ersetzt; die Komponente liest es ohnehin nur als Funktion. */
function erzeuge(text: string) {
  const fixture = TestBed.createComponent(Text);
  Object.assign(fixture.componentInstance, { text: signal(text), scopes: signal({}) });
  fixture.detectChanges();
  return fixture;
}
function zeichne(text: string): HTMLElement {
  return erzeuge(text).nativeElement as HTMLElement;
}

describe('nw-text', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Bestand,
          useValue: {
            entities: signal([art('p1', 'Volo', 'npc-0001'), art('p2', 'Goblin', 'sb-1'), art('p3', 'Goblin', 'sb-2')]),
          },
        },
      ],
    });
  });

  it('draws lists, tables and headings as elements', () => {
    const el = zeichne('## Aktionen\n\n- eins\n- zwei\n\n| d6 | Was |\n|---|---|\n| 1 | Nichts |');
    expect(el.querySelector('.h2')?.textContent?.trim()).toBe('Aktionen');
    expect(el.querySelectorAll('ul > li')).toHaveLength(2);
    expect(el.querySelectorAll('table td')).toHaveLength(2);
  });

  it('keeps HTML in the field as text', () => {
    const el = zeichne('<img src=x onerror=alert(1)> **fett**');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(el.querySelector('.b')?.textContent?.trim()).toBe('fett');
  });

  it('links by id, and does not guess between two of the same name', () => {
    const el = zeichne('[[npc-0001|der Alte]] und [[Goblin]]');
    const a = el.querySelector('a');
    expect(a?.textContent?.trim()).toBe('der Alte');
    expect(a?.getAttribute('href')).toBe('/artikel/p1');
    expect(el.querySelector('.tot')?.getAttribute('title')).toContain('Ambiguous');
  });

  it('rolls a dice expression on click and shows the result', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const fixture = erzeuge('Schaden {{1d6+2}}');
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('button.wurf') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('output')?.textContent?.trim()).toBe('6 (4 +2)');
    vi.restoreAllMocks();
  });
});
