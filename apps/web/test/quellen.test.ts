/**
 * Quellenkürzel erklären sich (T-088, REQ-245): „XGE p. 12" zeigt den
 * vollen Titel beim Darüberfahren und beim Antippen, dahinter den
 * Herausgeber als Marke (T-094).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Quellen, QuelleText } from '../src/app/kern/quellen';

function stubQuellen() {
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () =>
      JSON.stringify({
        sources: { XGE: "Xanathar's Guide to Everything", EGW: "Explorer's Guide to Wildemount" },
        publishers: { XGE: 'Official', EGW: 'Partnered' },
      }),
  }) as Response);
}

const warte = () => new Promise((r) => setTimeout(r, 0));

describe('source abbreviations', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    stubQuellen();
  });

  it('splits a known abbreviation off and leaves an unknown one as it is', async () => {
    const q = TestBed.inject(Quellen);
    await warte();
    expect(q.zerlege('XGE p. 12')).toEqual({ kuerzel: 'XGE', rest: ' p. 12', titel: "Xanathar's Guide to Everything", verlag: 'Official' });
    expect(q.zerlege('ZZZ p. 3')).toEqual({ kuerzel: '', rest: 'ZZZ p. 3', titel: '', verlag: '' });
  });

  it('shows the full title on hover and on a tap', async () => {
    TestBed.inject(Quellen);
    await warte();
    const f = TestBed.createComponent(QuelleText);
    /* JIT kennt `input()` nicht (siehe text.test.ts): das Signal vor dem ersten Zeichnen ersetzen. */
    Object.assign(f.componentInstance, { text: signal('XGE p. 12') });
    f.detectChanges();
    const abbr = f.nativeElement.querySelector('abbr') as HTMLElement;
    expect(abbr.getAttribute('title')).toBe("Xanathar's Guide to Everything");
    expect(f.nativeElement.textContent).toContain('p. 12');
    abbr.click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.titel')?.textContent).toBe("Xanathar's Guide to Everything");
  });

  it('marks the publisher behind the abbreviation (T-094)', async () => {
    TestBed.inject(Quellen);
    await warte();
    const f = TestBed.createComponent(QuelleText);
    Object.assign(f.componentInstance, { text: signal('EGW p. 5') });
    f.detectChanges();
    expect(f.nativeElement.querySelector('.verlag')?.textContent?.trim()).toBe('Partnered');
  });
});
