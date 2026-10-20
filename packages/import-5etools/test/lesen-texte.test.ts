import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { liesAbenteuer, liesBuecher } from '../src/lesen.js';

/* T-296: der Text steht je nach Stand in einer Hülle (`adventureData`,
   `bookData`) oder ohne (`{ data }`, Kürzel im Dateinamen). Beide Formen
   müssen Kapitel bringen. Erfundene Daten, keine aus 5e.tools. */
function stand(): string {
  const d = mkdtempSync(join(tmpdir(), 'texte-'));
  mkdirSync(join(d, 'adventure'));
  mkdirSync(join(d, 'book'));
  writeFileSync(join(d, 'adventures.json'), JSON.stringify({ adventure: [{ id: 'ALT', source: 'ALT', name: 'Old' }, { id: 'NEU', source: 'NEU', name: 'New' }] }));
  writeFileSync(join(d, 'books.json'), JSON.stringify({ book: [{ id: 'BK', source: 'BK', name: 'Book' }] }));
  const kapitel = [{ type: 'section', name: 'One', entries: ['x'] }];
  writeFileSync(join(d, 'adventure', 'adventure-alt.json'), JSON.stringify({ data: kapitel }));
  writeFileSync(join(d, 'adventure', 'adventure-neu.json'), JSON.stringify({ adventureData: [{ id: 'NEU', data: kapitel }] }));
  writeFileSync(join(d, 'book', 'book-bk.json'), JSON.stringify({ data: kapitel }));
  return d;
}

describe('Buch- und Abenteuertext lesen', () => {
  it('nimmt die Hülle und den älteren Stand ohne Hülle', () => {
    const d = stand();
    const a = liesAbenteuer(d);
    expect([...a.keys()].sort()).toEqual(['alt', 'neu']);
    expect(a.get('alt')!.id).toBe('ALT');
    expect(a.get('alt')!.daten).toHaveLength(1);
    const b = liesBuecher(d);
    expect(b.get('bk')!.id).toBe('BK');
    expect(b.get('bk')!.daten[0]!['name']).toBe('One');
  });
});
