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
import { Text } from '../src/app/artikel/text';
import { Bestand } from '../src/app/kern/bestand';


/* Die Prüfumgebung übersetzt JIT, und JIT kennt `input()` nicht — `setInput`
   scheitert mit NG0303. Also wird das Signal vor dem ersten Zeichnen
   ersetzt; die Komponente liest es ohnehin nur als Funktion. */
function erzeuge(text: string, mehr: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(Text);
  Object.assign(fixture.componentInstance, {
    text: signal(text), scopes: signal({}), inline: signal(false), vorspann: signal(''), vorspannZiel: signal(''),
    ...mehr,
  });
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
          /* Die Treffer rechnet der Server (`refs.links`, W7); hier stehen
             sie, wie er sie schicken würde. */
          useValue: {
            verweise: signal(
              new Map([
                ['npc-0001', [{ id: 'p1', name: 'Volo' }]],
                ['Goblin', [{ id: 'p2', name: 'Goblin' }, { id: 'p3', name: 'Goblin' }]],
              ]),
            ),
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

  /* W1: Tabellenzeilen und kurze Felder hatten Verweise, die als
     „[[item-0263|Black opal]]" dastanden oder die Zelle zerschnitten. */
  it('resolves links inside table cells, the bar of the link is no cell border', () => {
    const el = zeichne('| d8 | Stone |\n|---|---|\n| 1 | [[npc-0001|Volo]] (translucent) |');
    const zellen = el.querySelectorAll('table td');
    expect(zellen).toHaveLength(2);
    expect(zellen[1]?.querySelector('a')?.textContent?.trim()).toBe('Volo');
  });

  it('draws one line without blocks when asked, links and placeholders included', () => {
    const el = erzeuge('[[npc-0001|slaad tadpoles]], {CREATURE}', {
      inline: signal(true),
      scopes: signal({ reference: { CREATURE: 'the dragon' } }),
    }).nativeElement as HTMLElement;
    expect(el.querySelector('p')).toBeNull();
    expect(el.querySelector('a')?.textContent?.trim()).toBe('slaad tadpoles');
    expect(el.textContent).toContain('the dragon');
  });

  it('capitalises a placeholder at the start of a sentence', () => {
    const el = erzeuge('{CREATURE} can breathe air and water.', {
      scopes: signal({ reference: { CREATURE: 'the dragon' } }),
    }).nativeElement as HTMLElement;
    expect(el.textContent?.replace(/\s+/g, ' ').trim()).toBe('The dragon can breathe air and water.');
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

  /* W2: eine Kopfzeile des Statblocks ist ein Satzteil, kein Absatz — und
     ohne Leerzeichen, die der Zeilenumbruch im Template setzen würde. */
  it('draws one line without paragraphs or stray spaces', () => {
    const fixture = TestBed.createComponent(Text);
    Object.assign(fixture.componentInstance, {
      text: signal('7 ({{2d6}})'), scopes: signal({}), inline: signal(true),
      vorspann: signal(''), vorspannZiel: signal(''),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p')).toBeNull();
    expect(el.textContent).toBe('7 (2d6)');
  });

  it('runs the name into the first paragraph, as the book does', () => {
    const fixture = TestBed.createComponent(Text);
    Object.assign(fixture.componentInstance, {
      text: signal('The goblin hides.\n\nSecond.'), scopes: signal({}), inline: signal(false),
      vorspann: signal('Nimble Escape.'), vorspannZiel: signal('p1'),
    });
    fixture.detectChanges();
    const ps = (fixture.nativeElement as HTMLElement).querySelectorAll('p');
    expect(ps).toHaveLength(2);
    expect(ps[0]?.querySelector('.vorspann a')?.getAttribute('href')).toBe('/artikel/p1');
    expect(ps[0]?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Nimble Escape. The goblin hides.');
  });
});
