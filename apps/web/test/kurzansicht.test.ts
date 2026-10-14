/**
 * Die Kurzansicht als Popup (T-093, REQ-248).
 *
 * Geprüft wird, was beim Klicken leicht kaputtgeht: ein schlichter Klick
 * auf einen Verweis öffnet die Karte und verlässt die Seite nicht, mit
 * gedrückter Taste bleibt er ein Link; Esc schliesst und gibt den Fokus
 * zurück; das Darüberfahren öffnet erst nach einer Weile und schlägt keine
 * angeklickte Karte.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { Router, provideRouter, RouterLink } from '@angular/router';
import { HOVER_AUF_MS, HOVER_ZU_MS, KurzLink, Kurzansicht } from '../src/app/kern/kurzansicht';
import { KurzPopup } from '../src/app/artikel/kurzpopup';
import { Bestand } from '../src/app/kern/bestand';

@Component({
  imports: [RouterLink, KurzLink, KurzPopup],
  template: `
    <p>
      <a id="volo" [routerLink]="['/artikel', 'p1']" nwQuick="p1">Volo</a>
      <button id="info" type="button" nwQuick="layer-1">i</button>
      <span id="draussen">elsewhere</span>
    </p>
    <nw-kurzpopup />
  `,
})
class Wirt {}

function klick(el: Element, mehr: MouseEventInit = {}): MouseEvent {
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...mehr });
  el.dispatchEvent(ev);
  return ev;
}

function aufbauen() {
  const f = TestBed.createComponent(Wirt);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { f, el, kurz: TestBed.inject(Kurzansicht), router: TestBed.inject(Router) };
}

describe('quick view popup', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Wirt],
      /* Die Vorschau selbst wird nachgeladen; geprüft wird das Popup um sie. */
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        provideRouter([]),
        { provide: Bestand, useValue: { voll: signal(new Map()), fehlt: signal(new Set()) } },
      ],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('opens on a plain click and does not leave the page', () => {
    const { f, el, kurz, router } = aufbauen();
    const weg = vi.spyOn(router, 'navigateByUrl');
    const ev = klick(el.querySelector('#volo')!);
    f.detectChanges();
    expect(ev.defaultPrevented).toBe(true);
    expect(weg).not.toHaveBeenCalled();
    expect(kurz.offen()?.id).toBe('p1');
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    /* Der Link bleibt ein Link: er sagt, wohin er führt. */
    expect(el.querySelector('#volo')?.getAttribute('href')).toBe('/artikel/p1');
    expect(el.querySelector('#volo')?.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('leaves a click with Ctrl, ⌘ or Shift to the link', () => {
    const { el, kurz } = aufbauen();
    /* Am Knopf statt am Link: jsdom kann keinen neuen Reiter öffnen. */
    for (const taste of ['ctrlKey', 'metaKey', 'shiftKey'] as const) {
      const ev = klick(el.querySelector('#info')!, { [taste]: true });
      expect(kurz.offen()).toBeNull();
      /* Den Standard nimmt dann der `routerLink` bzw. der Browser — hier nicht. */
      expect(ev.defaultPrevented).toBe(false);
    }
  });

  it('a second click on the same trigger closes, another trigger replaces', () => {
    const { el, kurz } = aufbauen();
    klick(el.querySelector('#volo')!);
    klick(el.querySelector('#info')!);
    expect(kurz.offen()?.id).toBe('layer-1');
    klick(el.querySelector('#info')!);
    expect(kurz.offen()).toBeNull();
  });

  it('Escape closes and gives the focus back to the trigger', () => {
    const { f, el, kurz } = aufbauen();
    document.body.appendChild(el);
    const info = el.querySelector<HTMLElement>('#info')!;
    klick(info);
    f.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(kurz.offen()).toBeNull();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(info);
  });

  it('a press next to it closes', () => {
    const { el, kurz } = aufbauen();
    klick(el.querySelector('#volo')!);
    el.querySelector('#draussen')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(kurz.offen()).toBeNull();
  });

  it('closes when the page changes', async () => {
    const { kurz, router, el } = aufbauen();
    klick(el.querySelector('#volo')!);
    await router.navigateByUrl('/');
    expect(kurz.offen()).toBeNull();
  });

  it('hovering opens after a while, leaving closes, and a clicked card stays', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      (q: string) => ({ matches: q.includes('hover'), media: q }) as MediaQueryList,
    );
    const { el, kurz } = aufbauen();
    const volo = el.querySelector('#volo')!;
    volo.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(HOVER_AUF_MS - 50);
    expect(kurz.offen()).toBeNull();
    vi.advanceTimersByTime(100);
    expect(kurz.offen()).toMatchObject({ id: 'p1', hover: true });
    volo.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(HOVER_ZU_MS + 10);
    expect(kurz.offen()).toBeNull();

    /* Angeklickt: das Darüberfahren über einen anderen Auslöser ersetzt sie nicht. */
    klick(el.querySelector('#info')!);
    volo.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(HOVER_AUF_MS + 10);
    volo.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(HOVER_ZU_MS + 10);
    expect(kurz.offen()).toMatchObject({ id: 'layer-1', hover: false });
  });

  it('a link inside the card shows its target in the same place', () => {
    const kurz = TestBed.inject(Kurzansicht);
    const a = document.createElement('a');
    document.body.appendChild(a);
    kurz.oeffnen('p1', a);
    const anker = kurz.offen()!.anker;
    kurz.ersetzen('p2');
    expect(kurz.offen()).toMatchObject({ id: 'p2', anker, ausloeser: a, hover: false });
  });
});
