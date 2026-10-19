/**
 * Die Kapitel einer Seite (T-277): am Telefon Reiter, nur was dasteht, mit
 * Zahl; gewählt ist, was die URL sagt, sonst die Vorgabe, sonst das erste.
 */

import { describe, expect, it } from 'vitest';
import { kapitelReiter, kapitelWahl } from '../src/app/muster/kapitel';

describe('kapitelReiter', () => {
  it('leaves out empty chapters and puts the count after the title', () => {
    const r = kapitelReiter([
      { key: 'fields', titel: 'Fields', zahl: null, zeigen: true },
      { key: 'relations', titel: 'Relations', zahl: 0, zeigen: false },
      { key: 'linked', titel: 'Linked here', zahl: 154, zeigen: true },
      { key: 'admin', titel: 'Admin', zahl: null, zeigen: true },
    ]);
    expect(r).toEqual([
      { id: 'fields', label: 'Fields' },
      { id: 'linked', label: 'Linked here · 154' },
      { id: 'admin', label: 'Admin' },
    ]);
  });
});

describe('kapitelWahl', () => {
  const ids = ['fields', 'linked', 'admin'];
  it('takes the first wish that is there', () => {
    expect(kapitelWahl(ids, [null, 'admin', 'linked'])).toBe('admin');
  });
  it('skips a chapter that does not stand there (?k=relations without edges)', () => {
    expect(kapitelWahl(ids, [null, 'relations', null])).toBe('fields');
  });
  it('without chapters there is nothing to choose', () => {
    expect(kapitelWahl([], ['admin'])).toBeNull();
  });
});
