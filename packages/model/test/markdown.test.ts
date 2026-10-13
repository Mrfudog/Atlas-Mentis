import { describe, expect, it } from 'vitest';
import { blockTexts, parseMarkdown, splitRow } from '../src/markdown.js';

describe('parseMarkdown', () => {
  it('reads headings, paragraphs and rules', () => {
    expect(parseMarkdown('# Goblin\n\nKlein und\nfies.\n\n---\n### Aktionen ###')).toEqual([
      { kind: 'heading', level: 1, text: 'Goblin' },
      { kind: 'paragraph', text: 'Klein und fies.' },
      { kind: 'rule' },
      { kind: 'heading', level: 3, text: 'Aktionen' },
    ]);
  });

  it('keeps a hard break as a newline', () => {
    expect(parseMarkdown('Zeile eins  \nZeile zwei\\\nZeile drei')).toEqual([
      { kind: 'paragraph', text: 'Zeile eins\nZeile zwei\nZeile drei' },
    ]);
  });

  it('reads bullet and numbered lists, nested by indentation', () => {
    const [list] = parseMarkdown('- eins\n- zwei\n  - zwei a\n  - zwei b\n- drei');
    expect(list).toEqual({
      kind: 'list',
      ordered: false,
      start: 1,
      items: [
        [{ kind: 'paragraph', text: 'eins' }],
        [
          { kind: 'paragraph', text: 'zwei' },
          {
            kind: 'list',
            ordered: false,
            start: 1,
            items: [[{ kind: 'paragraph', text: 'zwei a' }], [{ kind: 'paragraph', text: 'zwei b' }]],
          },
        ],
        [{ kind: 'paragraph', text: 'drei' }],
      ],
    });
    const [num] = parseMarkdown('3. drei\n4. vier');
    expect(num).toMatchObject({ kind: 'list', ordered: true, start: 3 });
  });

  it('ends a paragraph where a list begins, and a list where text resumes', () => {
    const blocks = parseMarkdown('Du kannst:\n- laufen\n- springen\n\nDanach Ruhe.');
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'list', 'paragraph']);
  });

  it('keeps a loose list together across blank lines', () => {
    const blocks = parseMarkdown('- eins\n\n- zwei');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'list' });
  });

  it('reads tables with alignment, padding short rows', () => {
    const [table] = parseMarkdown('| d6 | Ergebnis |\n|:-:|---:|\n| 1 | Nichts |\n| 2 |');
    expect(table).toEqual({
      kind: 'table',
      head: ['d6', 'Ergebnis'],
      align: ['center', 'right'],
      rows: [
        ['1', 'Nichts'],
        ['2', ''],
      ],
    });
  });

  it('reads quotes as nested blocks', () => {
    expect(parseMarkdown('> **Achtung.** Falle\n> - Nadel')).toEqual([
      {
        kind: 'quote',
        blocks: [
          { kind: 'paragraph', text: '**Achtung.** Falle' },
          { kind: 'list', ordered: false, start: 1, items: [[{ kind: 'paragraph', text: 'Nadel' }]] },
        ],
      },
    ]);
  });

  it('leaves HTML as text — a block is data, not markup', () => {
    expect(parseMarkdown('<script>alert(1)</script>')).toEqual([
      { kind: 'paragraph', text: '<script>alert(1)</script>' },
    ]);
  });

  it('reads plain prose exactly as before', () => {
    expect(parseMarkdown('Nur gewöhnlicher Text.')).toEqual([
      { kind: 'paragraph', text: 'Nur gewöhnlicher Text.' },
    ]);
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown(undefined as unknown as string)).toEqual([]);
  });

  it('does not take arithmetic or a lone pipe for markup', () => {
    expect(parseMarkdown('2 * 3 | 4')).toEqual([{ kind: 'paragraph', text: '2 * 3 | 4' }]);
  });
});

describe('splitRow', () => {
  it('honours an escaped pipe', () => {
    expect(splitRow('| a \\| b | c |')).toEqual(['a | b', 'c']);
  });

  it('keeps the pipe inside a link in its cell', () => {
    expect(splitRow('| 4–6 | [[npc-0001|Volo]] notices |')).toEqual(['4–6', '[[npc-0001|Volo]] notices']);
  });
});

describe('blockTexts', () => {
  it('collects every inline text in order', () => {
    expect(blockTexts(parseMarkdown('# A\n- b\n\n| c |\n|---|\n| d |'))).toEqual(['A', 'b', 'c', 'd']);
  });
});
