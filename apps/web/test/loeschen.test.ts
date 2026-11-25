/**
 * Löschen aus der eigenen Ebene (T-381): erst die Vorschau, dann die
 * Bestätigung mit der Zahl, dann der Lauf mit `confirmDelete` — und was
 * nicht in der Schreibebene liegt, kommt als abgewählt zurück.
 */
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Api, type LoeschAntwort } from '../src/app/kern/api';
import { Loeschen } from '../src/app/kern/loeschen';

const antwort = (deleted: number, deselected: LoeschAntwort['deselected'], id: string | null = null): LoeschAntwort => ({
  dryRun: false, selected: deleted, changed: 0, deleted, examples: [], rejected: [], rejectedCount: 0,
  skipped: [], skippedCount: 0, ms: 1, id, deselected, layer: { id: 'ly_meine', name: 'Mine' },
});

function mitApi(deleteArticles: ReturnType<typeof vi.fn>): Loeschen {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: { deleteArticles } }] });
  return TestBed.inject(Loeschen);
}

describe('Loeschen (T-381)', () => {
  it('previews, asks with the number and deletes with confirmDelete', async () => {
    const fremd = [{ id: 'b', name: 'B', reason: 'other-layer' as const, layers: ['ly_regeln'] }];
    const api = vi.fn()
      .mockResolvedValueOnce(antwort(2, fremd))
      .mockResolvedValueOnce(antwort(2, fremd, 'lauf-1'));
    const frage = vi.fn(() => true);
    const r = await mitApi(api).loeschen(['a', 'b', 'c'], frage);
    expect(frage).toHaveBeenCalledWith(2, 1);
    expect(api).toHaveBeenNthCalledWith(1, ['a', 'b', 'c'], { dryRun: true });
    expect(api).toHaveBeenNthCalledWith(2, ['a', 'b', 'c'], { confirmDelete: 2 });
    expect(r).toEqual(expect.objectContaining({ text: '2 deleted, 1 from other layers deselected', lauf: 'lauf-1', geloescht: ['a', 'c'], abgewaehlt: ['b'] }));
    expect(r?.hinweis).toMatch(/write layer \(Mine\)/);
  });

  it('a single article needs no confirmDelete', async () => {
    const api = vi.fn().mockResolvedValueOnce(antwort(1, [])).mockResolvedValueOnce(antwort(1, [], 'l'));
    await mitApi(api).loeschen(['a'], () => true);
    expect(api).toHaveBeenNthCalledWith(2, ['a'], {});
  });

  it('asks nothing when nothing would be deleted', async () => {
    const api = vi.fn().mockResolvedValueOnce(antwort(0, [{ id: 'b', name: 'B', reason: 'other-layer' }]));
    const frage = vi.fn(() => true);
    const r = await mitApi(api).loeschen(['b'], frage);
    expect(frage).not.toHaveBeenCalled();
    expect(api).toHaveBeenCalledTimes(1);
    expect(r?.lauf).toBeNull();
    expect(r?.abgewaehlt).toEqual(['b']);
  });

  it('stops when the question is declined', async () => {
    const api = vi.fn().mockResolvedValueOnce(antwort(1, []));
    expect(await mitApi(api).loeschen(['a'], () => false)).toBeNull();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('an empty selection does not ask the server', async () => {
    const api = vi.fn();
    expect((await mitApi(api).loeschen([]))?.text).toBe('Nothing selected.');
    expect(api).not.toHaveBeenCalled();
  });
});
