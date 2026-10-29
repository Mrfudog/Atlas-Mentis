/**
 * Die Klappleiste (T-220): alles auf und zu über `<details>` mit
 * `data-bereich`, vor und zurück zum nächsten Bereich, Alt+↑/↓.
 */

import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Klappleiste, alleKlappen, bereicheIn, nachbarIndex, sprungZiel, tasteAktion } from '../src/app/muster/klappleiste';

function seite(): HTMLElement {
  const w = document.createElement('div');
  w.innerHTML = `
    <details data-bereich id="a" open><summary>A</summary>
      <details data-bereich id="a1"><summary>A1</summary></details>
      <details id="innen"><summary>not a section</summary></details>
    </details>
    <details data-bereich id="b"><summary>B</summary>
      <details data-bereich id="b1"><summary>B1</summary></details>
    </details>
    <h3 data-bereich id="c">C</h3>
  `;
  return w;
}

describe('sprungZiel', () => {
  it('goes to the first section below the top edge', () => {
    expect(sprungZiel([-300, -20, 150, 900], 1)).toBe(2);
  });
  it('goes back to the start of the section one is in', () => {
    expect(sprungZiel([-300, -20, 150, 900], -1)).toBe(1);
  });
  it('does not hit the section that was just jumped to again', () => {
    expect(sprungZiel([-300, 1, 400], 1)).toBe(2);
    expect(sprungZiel([-300, -1, 400], -1)).toBe(0);
  });
  it('says null at either end and without sections', () => {
    expect(sprungZiel([-300, -20], 1)).toBeNull();
    expect(sprungZiel([10, 300], -1)).toBeNull();
    expect(sprungZiel([], 1)).toBeNull();
    expect(sprungZiel([], -1)).toBeNull();
  });
});

describe('nachbarIndex', () => {
  it('steps from the section that holds the focus', () => {
    expect(nachbarIndex(1, 4, 1)).toBe(2);
    expect(nachbarIndex(1, 4, -1)).toBe(0);
  });
  it('says null past either end and without a focused section', () => {
    expect(nachbarIndex(3, 4, 1)).toBeNull();
    expect(nachbarIndex(0, 4, -1)).toBeNull();
    expect(nachbarIndex(-1, 4, 1)).toBeNull();
  });
});

describe('tasteAktion', () => {
  const ev = (key: string, mehr: Partial<KeyboardEvent> = {}) =>
    ({ altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, key, target: document.body, ...mehr }) as KeyboardEvent;
  it('Alt+↓ and Alt+↑ jump, with Shift they expand and collapse', () => {
    expect(tasteAktion(ev('ArrowDown'))).toBe('vor');
    expect(tasteAktion(ev('ArrowUp'))).toBe('zurueck');
    expect(tasteAktion(ev('ArrowDown', { shiftKey: true }))).toBe('auf');
    expect(tasteAktion(ev('ArrowUp', { shiftKey: true }))).toBe('zu');
  });
  it('ignores other keys, missing Alt and Ctrl/Cmd combinations', () => {
    expect(tasteAktion(ev('ArrowLeft'))).toBeNull();
    expect(tasteAktion(ev('ArrowDown', { altKey: false }))).toBeNull();
    expect(tasteAktion(ev('ArrowDown', { ctrlKey: true }))).toBeNull();
    expect(tasteAktion(ev('ArrowDown', { metaKey: true }))).toBeNull();
  });
  it('leaves fields alone — Alt+arrow moves by word there', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(tasteAktion(ev('ArrowDown', { target: document.createElement(tag) }))).toBeNull();
    }
  });
});

describe('bereicheIn', () => {
  it('lists the sections one can reach, skipping those inside a closed one', () => {
    expect(bereicheIn(seite()).map((e) => e.id)).toEqual(['a', 'a1', 'b', 'c']);
  });
  it('takes a selector of its own', () => {
    expect(bereicheIn(seite(), 'h3').map((e) => e.id)).toEqual(['c']);
  });
});

describe('alleKlappen', () => {
  it('opens every section, nested ones too, and leaves other details alone', () => {
    const w = seite();
    expect(alleKlappen(w, true)).toBe(3);
    expect(['a', 'a1', 'b', 'b1'].map((id) => (w.querySelector('#' + id) as HTMLDetailsElement).open)).toEqual([true, true, true, true]);
    expect((w.querySelector('#innen') as HTMLDetailsElement).open).toBe(false);
  });
  it('closes them again and counts only what changed', () => {
    const w = seite();
    expect(alleKlappen(w, false)).toBe(1);
    expect(alleKlappen(w, false)).toBe(0);
  });
});

@Component({
  imports: [Klappleiste],
  template: `
    <div class="w">
      <nw-klappleiste />
      <details data-bereich id="x"><summary>X</summary></details>
      <details data-bereich id="y"><summary>Y</summary></details>
    </div>
  `,
})
class Wirt {}

describe('Klappleiste', () => {
  afterEach(() => vi.restoreAllMocks());

  function aufbauen() {
    const f = TestBed.createComponent(Wirt);
    f.detectChanges();
    document.body.appendChild(f.nativeElement);
    const el = f.nativeElement as HTMLElement;
    const knopf = (text: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent)!.includes(text))!;
    return { f, el, knopf };
  }

  it('expands and collapses every section of its parent', () => {
    const { el, knopf } = aufbauen();
    knopf('Expand all').click();
    expect(Array.from(el.querySelectorAll('details')).every((d) => d.open)).toBe(true);
    knopf('Collapse all').click();
    expect(Array.from(el.querySelectorAll('details')).some((d) => d.open)).toBe(false);
  });

  it('jumps to the next section, opens it and moves the focus there', () => {
    const { el, knopf } = aufbauen();
    const x = el.querySelector<HTMLDetailsElement>('#x')!;
    const y = el.querySelector<HTMLDetailsElement>('#y')!;
    vi.spyOn(x, 'getBoundingClientRect').mockReturnValue({ top: -50 } as DOMRect);
    vi.spyOn(y, 'getBoundingClientRect').mockReturnValue({ top: 400 } as DOMRect);
    knopf('Next section').click();
    expect(y.open).toBe(true);
    expect(document.activeElement).toBe(y.querySelector('summary'));
    knopf('Previous section').click();
    expect(x.open).toBe(true);
    expect(document.activeElement).toBe(x.querySelector('summary'));
  });

  it('steps on from the focused section even where the page cannot scroll it to the top', () => {
    const { el, knopf } = aufbauen();
    const x = el.querySelector<HTMLDetailsElement>('#x')!;
    const y = el.querySelector<HTMLDetailsElement>('#y')!;
    /* Beide unter der Linie: nach der Lage allein bliebe es bei X. */
    vi.spyOn(x, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
    vi.spyOn(y, 'getBoundingClientRect').mockReturnValue({ top: 300 } as DOMRect);
    knopf('Next section').click();
    expect(document.activeElement).toBe(x.querySelector('summary'));
    /* Ein Klick legt den Fokus auf den Knopf — die Leiste weiss trotzdem, wo man steht. */
    knopf('Next section').focus();
    knopf('Next section').click();
    expect(document.activeElement).toBe(y.querySelector('summary'));
  });

  /* Die Vorlage bindet Signal-Ausgaben im JIT der Tests nicht — also direkt gehört. */
  it('says when nothing comes any more', () => {
    const { f, el, knopf } = aufbauen();
    for (const d of Array.from(el.querySelectorAll('details'))) {
      vi.spyOn(d, 'getBoundingClientRect').mockReturnValue({ top: -50 } as DOMRect);
    }
    const leiste = f.debugElement.query(By.directive(Klappleiste)).componentInstance as Klappleiste;
    const gesagt: number[] = [];
    leiste.ende.subscribe((r) => gesagt.push(r));
    knopf('Next section').click();
    expect(gesagt).toEqual([1]);
  });

  it('answers Alt+Shift+↓ on the page', () => {
    const { el } = aufbauen();
    const leiste = el.querySelector('nw-klappleiste')!;
    vi.spyOn(leiste, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, shiftKey: true }));
    expect(Array.from(el.querySelectorAll('details')).every((d) => d.open)).toBe(true);
  });

  it('stays quiet while it is not shown (a hidden tab)', () => {
    const { el } = aufbauen();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, shiftKey: true }));
    expect(Array.from(el.querySelectorAll('details')).some((d) => d.open)).toBe(false);
  });
});

/* T-359: Was kein `<details>` ist, aber klappt (ein Kapitel, eine Gruppe im
   Register), sagt es mit `data-klappbar` und seinem Stand in `data-offen`;
   die Leiste bittet es mit dem Ereignis `klappen`, und es klappt selbst. */
describe('klappbare Bereiche ohne <details> (T-359)', () => {
  function teil(offen: boolean): { el: HTMLElement; bitten: boolean[] } {
    const el = document.createElement('section');
    el.setAttribute('data-bereich', '');
    el.setAttribute('data-klappbar', '');
    el.setAttribute('data-offen', String(offen));
    const bitten: boolean[] = [];
    el.addEventListener('klappen', (e) => {
      const auf = (e as CustomEvent<boolean>).detail;
      bitten.push(auf);
      el.setAttribute('data-offen', String(auf));
    });
    return { el, bitten };
  }

  it('asks a closed one to open and leaves an open one alone', () => {
    const w = document.createElement('div');
    const zu = teil(false);
    const auf = teil(true);
    w.append(zu.el, auf.el);
    expect(alleKlappen(w, true)).toBe(1);
    expect(zu.bitten).toEqual([true]);
    expect(auf.bitten).toEqual([]);
    expect(alleKlappen(w, false)).toBe(2);
  });

  it('skips the sections inside a closed one', () => {
    const w = document.createElement('div');
    const zu = teil(false);
    const innen = document.createElement('h3');
    innen.setAttribute('data-bereich', '');
    zu.el.append(innen);
    w.append(zu.el);
    expect(bereicheIn(w)).toEqual([zu.el]);
    zu.el.setAttribute('data-offen', 'true');
    expect(bereicheIn(w)).toEqual([zu.el, innen]);
  });
});

/* T-359: Eine Leiste in einer Leiste — die Leseansicht steht in der
   Ebenenseite, und beide haben eine. Die Tasten gehören der innersten, in
   deren Bereich der Fokus steht; sonst sprängen beide. */
@Component({
  imports: [Klappleiste],
  template: `
    <div class="aussen">
      <nw-klappleiste id="la" />
      <details data-bereich id="p"><summary>P</summary></details>
      <div class="innen">
        <nw-klappleiste id="li" />
        <details data-bereich id="q"><summary>Q</summary></details>
        <details data-bereich id="r"><summary>R</summary></details>
        <details data-bereich id="s"><summary>S</summary></details>
      </div>
    </div>
  `,
})
class Verschachtelt {}

describe('Klappleiste in einer Klappleiste (T-359)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('leaves the keys to the innermost bar around the focus', () => {
    const f = TestBed.createComponent(Verschachtelt);
    f.detectChanges();
    document.body.appendChild(f.nativeElement);
    const el = f.nativeElement as HTMLElement;
    for (const l of Array.from(el.querySelectorAll('nw-klappleiste'))) {
      vi.spyOn(l, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    }
    const q = el.querySelector<HTMLDetailsElement>('#q')!;
    q.querySelector('summary')!.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));
    /* Nur die innere ist gesprungen: von Q nach R, nicht weiter. */
    expect(document.activeElement).toBe(el.querySelector('#r summary'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }));
    expect(document.activeElement).toBe(q.querySelector('summary'));
    /* Steht der Fokus ausserhalb der inneren, antwortet die äussere. */
    el.querySelector<HTMLElement>('#p summary')!.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));
    expect(document.activeElement).toBe(q.querySelector('summary'));
    f.destroy();
  });
});
