/**
 * Die Suche, mit der man Artikel aufs Board legt (W4, W7).
 *
 * Geprüft wird, was am 13.10. auf dev fehlte: ohne Suchwort stand nichts
 * da, und ein Fehler am Server las sich als „Nothing matches" — übrig blieb
 * die Seitenleiste mit Kampagne und Ebene, und es sah aus, als könne man
 * nur die ablegen.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BoardSuche } from '../src/app/boards/suche';
import { Bestand } from '../src/app/kern/bestand';

const zeile = (id: string, name: string, type: string) => ({ id, name, type, layers: [], cols: {} });

async function erzeuge(liste: ReturnType<typeof vi.fn>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: Bestand,
        useValue: {
          registry: signal({ interfaces: { Statblock: { name: 'Statblock', label: 'Statblock', area: 'rules' } } }),
          liste,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(BoardSuche);
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('nw-board-suche', () => {
  it('lists articles before anything is typed, and says how many more there are', async () => {
    const liste = vi.fn().mockResolvedValue({ total: 120, rows: [zeile('a', 'Goblin', 'Statblock'), zeile('b', 'Orc', 'Statblock')] });
    const el = await erzeuge(liste);
    expect(liste).toHaveBeenCalledWith(expect.objectContaining({ q: undefined }));
    expect([...el.querySelectorAll('li b')].map((b) => b.textContent)).toEqual(['Goblin', 'Orc']);
    expect(el.textContent).toContain('118 more');
  });

  it('shows a failed search as a failure, not as an empty result', async () => {
    const el = await erzeuge(vi.fn().mockRejectedValue(new Error('500 Internal Server Error')));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('500');
    expect(el.textContent).not.toContain('Nothing matches');
  });
});
