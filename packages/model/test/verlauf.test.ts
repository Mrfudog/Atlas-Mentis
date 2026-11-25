import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, emptyHistory, historyPush, historyRedo, historyUndo } from '../src/history.js';
import { duplicateElement, pasteElement } from '../src/viewScope.js';
import type { LayoutElement } from '../src/types.js';

/**
 * **Rückgängig, Wiederholen, Duplizieren, Einfügen** (T-425, REQ-436,
 * E-171): Muster für jede Leiste — der Verlauf weiss nichts von dem, was er
 * hält; Duplizieren und Einfügen geben jedem Element eine freie Id.
 */
describe('history', () => {
  it('push, undo, redo — und ein neuer Schritt nach Undo wirft das Wiederholbare weg', () => {
    let h = emptyHistory<number>();
    h = historyPush(h, 1);
    h = historyPush(h, 2);
    const u = historyUndo(h, 3)!;
    expect(u.state).toBe(2);
    const u2 = historyUndo(u.history, 2)!;
    expect(u2.state).toBe(1);
    const r = historyRedo(u2.history, 1)!;
    expect(r.state).toBe(2);
    const neu = historyPush(r.history, 2);
    expect(historyRedo(neu, 9)).toBeNull();
  });
  it('nichts zu tun gibt null', () => {
    expect(historyUndo(emptyHistory<number>(), 1)).toBeNull();
    expect(historyRedo(emptyHistory<number>(), 1)).toBeNull();
  });
  it('hält höchstens HISTORY_LIMIT Schritte, die ältesten gehen zuerst', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = historyPush(h, i);
    expect(h.past.length).toBe(HISTORY_LIMIT);
    expect(h.past[0]).toBe(5);
  });
});

describe('duplicate and paste', () => {
  const tree: LayoutElement[] = [
    { id: 'a', el: 'text', text: 'A' },
    { id: 's', el: 'section', children: [{ id: 'b', el: 'text', text: 'B' }] },
  ];
  it('Duplizieren setzt die Kopie gleich dahinter, mit freien Ids auch innen', () => {
    const d = duplicateElement(tree, 's');
    expect(d.tree.map((e) => e.id)).toEqual(['a', 's', 's-2']);
    expect(d.id).toBe('s-2');
    expect(d.tree[2]!.children![0]!.id).toBe('b-2');
    expect(tree.length).toBe(2);
  });
  it('Duplizieren in einem Behälter bleibt im Behälter', () => {
    const d = duplicateElement(tree, 'b');
    expect(d.tree[1]!.children!.map((e) => e.id)).toEqual(['b', 'b-2']);
  });
  it('Einfügen nach dem gewählten oder in den gewählten Behälter, mit freier Id', () => {
    const p = pasteElement(tree, { id: 'a', el: 'text', text: 'A' }, 'a');
    expect(p.tree.map((e) => e.id)).toEqual(['a', 'a-2', 's']);
    const q = pasteElement(tree, { id: 'x', el: 'text' }, 's');
    expect(q.tree[1]!.children!.map((e) => e.id)).toEqual(['b', 'x']);
    expect(pasteElement(tree, { id: 'y', el: 'text' }, null).tree.map((e) => e.id)).toEqual(['a', 's', 'y']);
  });
  it('ein unbekanntes Element zu duplizieren ändert nichts', () => {
    expect(duplicateElement(tree, 'zz')).toEqual({ tree, id: null });
  });
});
