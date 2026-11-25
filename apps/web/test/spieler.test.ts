/**
 * Spieler in „Revealed to"/„Hidden from" (T-100, E-007): wer einen Spieler
 * wählt, wählt seine Figuren — im Artikel landet nie ein Konto (REQ-199).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Mehrfach } from '../src/app/artikel/mehrfach';

const SPIELER = {
  campaign: { id: 'camp_a', name: 'Runde A' },
  players: [{ name: 'Sela', actors: [{ id: 'pc_rook', name: 'Rook' }, { id: 'pc_wren', name: 'Wren' }] }],
};

const warte = () => new Promise((r) => setTimeout(r, 0));

describe('players in the visibility picker', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', async (url: string) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify(String(url).includes('/api/players') ? SPIELER : { rows: [], total: 0 }),
    }) as Response);
  });

  it('offers a player by name and adds their characters', async () => {
    const f = TestBed.createComponent(Mehrfach);
    /* JIT kennt `input()` nicht (siehe text.test.ts): die Signale vor dem ersten Zeichnen ersetzen. */
    Object.assign(f.componentInstance, { verweise: signal(true), spieler: signal(true), werte: signal(['pc_wren']) });
    const raus: string[][] = [];
    f.componentInstance.werteChange.subscribe((w) => raus.push(w));
    f.detectChanges();
    await warte();
    await warte();
    const suche = f.nativeElement.querySelector('input') as HTMLInputElement;
    suche.value = 'se';
    suche.dispatchEvent(new Event('input'));
    f.detectChanges();
    const knopf = f.nativeElement.querySelector('.treffer button') as HTMLButtonElement;
    expect(knopf.textContent).toContain('Sela');
    expect(knopf.textContent).toContain('Rook');
    expect(knopf.textContent).not.toContain('Wren');
    knopf.click();
    expect(raus.at(-1)).toEqual(['pc_wren', 'pc_rook']);
    /* Die gewählte Figur trägt den Namen ihres Spielers. */
    Object.assign(f.componentInstance, { werte: signal(['pc_wren', 'pc_rook']) });
    f.detectChanges();
    expect([...f.nativeElement.querySelectorAll('.chip span')].map((x: Element) => x.textContent?.trim()))
      .toEqual(['Wren (Sela)', 'Rook (Sela)']);
  });
});
