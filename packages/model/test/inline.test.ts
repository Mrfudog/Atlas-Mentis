import { describe, expect, it } from 'vitest';
import { idLinks, parseInline, plainText, resolveVar, varNames } from '../src/inline.js';
import { linkCandidates } from '../src/entity.js';
import type { Entity } from '../src/types.js';

describe('varNames', () => {
  it('lists each placeholder once, in order', () => {
    expect(varNames('**{NAME}.** {AB} zum Treffer, {DMG} Schaden, {NAME} trifft.')).toEqual([
      'NAME',
      'AB',
      'DMG',
    ]);
  });

  it('accepts umlauts in names and ignores lowercase', () => {
    expect(varNames('{GRÖSSE} und {klein}')).toEqual(['GRÖSSE']);
  });
});

describe('resolveVar', () => {
  const scopes = {
    reference: { DMG: '2W6 + 3' },
    entity: { DMG: '1W4', DC: '12' },
    campaign: { DC: '10', TYP: 'wuchtig' },
  };

  it('prefers the reference, then the entity, then the campaign', () => {
    expect(resolveVar('DMG', scopes)).toBe('2W6 + 3');
    expect(resolveVar('DC', scopes)).toBe('12');
    expect(resolveVar('TYP', scopes)).toBe('wuchtig');
    expect(resolveVar('NICHTS', scopes)).toBeUndefined();
  });
});

describe('parseInline', () => {
  it('keeps an unresolved placeholder visible instead of blanking it', () => {
    const segments = parseInline('{AB} zum Treffer');
    expect(segments[0]).toEqual({ kind: 'var', name: 'AB', text: '{AB}', resolved: false });
  });

  it('substitutes from the reference scope without touching the source', () => {
    const source = '**{NAME}.** {DMG} Schaden.';
    const scopes = { reference: { NAME: 'Pseudopod', DMG: '2W6 + 3' } };

    // plainText drops the bold markers and keeps the resolved values.
    expect(plainText(source, scopes)).toBe('Pseudopod. 2W6 + 3 Schaden.');
    expect(parseInline(source, scopes).some((s) => s.kind === 'var' && s.resolved)).toBe(true);

    // The template itself is never rewritten. Baking values into the stored
    // text is exactly the loss the old app's statblock export could not undo.
    expect(source).toContain('{NAME}');
  });

  it('parses both wikilink forms', () => {
    const segments = parseInline('siehe [[Verstrickt]] und [[npc/volo|Volo]]');
    const links = segments.filter((s) => s.kind === 'link');
    expect(links).toEqual([
      { kind: 'link', target: 'Verstrickt', text: 'Verstrickt' },
      { kind: 'link', target: 'npc/volo', text: 'Volo' },
    ]);
  });

  it('round-trips plain text unchanged', () => {
    const text = 'Nur gewöhnlicher Text, ohne Auszeichnung.';
    expect(plainText(text)).toBe(text);
  });

  it('handles an empty or nullish body', () => {
    expect(parseInline('')).toEqual([]);
    expect(plainText(undefined as unknown as string)).toBe('');
  });
});

describe('parseInline — dice (M12)', () => {
  it('makes {{…}} a dice segment and leaves {VAR} alone', () => {
    const segments = parseInline('Treffer {{+4}}, Schaden {{1d6+2}} {DMG}');
    expect(segments.filter((s) => s.kind === 'dice')).toEqual([
      { kind: 'dice', expr: '+4', text: '+4' },
      { kind: 'dice', expr: '1d6+2', text: '1d6+2' },
    ]);
    expect(segments.at(-1)).toEqual({ kind: 'var', name: 'DMG', text: '{DMG}', resolved: false });
  });

  it('resolves a placeholder inside the expression first', () => {
    const segments = parseInline('{{1d8+{STR}}}', { entity: { STR: '3' } });
    expect(segments).toEqual([{ kind: 'dice', expr: '1d8+3', text: '1d8+3' }]);
  });

  it('keeps an expression that is not one as written', () => {
    expect(parseInline('{{1d8+{STR}}}')).toEqual([{ kind: 'text', text: '{{1d8+{STR}}}' }]);
    expect(parseInline('{{Unsinn}}')).toEqual([{ kind: 'text', text: '{{Unsinn}}' }]);
  });
});

describe('parseInline — emphasis', () => {
  it('reads italics and nests them in bold', () => {
    expect(parseInline('*leise* und **laut *sehr* laut**')).toEqual([
      { kind: 'text', text: 'leise', italic: true },
      { kind: 'text', text: ' und ' },
      { kind: 'text', text: 'laut ', bold: true },
      { kind: 'text', text: 'sehr', bold: true, italic: true },
      { kind: 'text', text: ' laut', bold: true },
    ]);
  });

  it('does not take arithmetic for italics', () => {
    expect(plainText('2 * 3 * 4')).toBe('2 * 3 * 4');
  });
});

describe('idLinks (M11)', () => {
  const art = (id: string, name: string, nr: string, aliases: string[] = []) =>
    ({
      id,
      name,
      interfaces: ['Creature'],
      components: { Identity: { name, id: nr, aliases } },
    }) as unknown as Entity;
  const bestand = [
    art('p1', 'Volo', 'npc-0001', ['Volothamp']),
    art('p2', 'Goblin', 'sb-0417'),
    art('p3', 'Goblin', 'sb-0418'),
  ];

  it('rewrites a unique name to its id and keeps the shown text', () => {
    expect(idLinks('[[Volo]] und [[volothamp|der Alte]]', bestand)).toEqual({
      text: '[[npc-0001|Volo]] und [[npc-0001|der Alte]]',
      open: [],
    });
  });

  it('leaves ambiguous and missing names alone and reports them', () => {
    expect(idLinks('[[Goblin]] und [[Niemand]]', bestand)).toEqual({
      text: '[[Goblin]] und [[Niemand]]',
      open: ['Goblin', 'Niemand'],
    });
  });

  it('leaves a link that already names an id untouched', () => {
    const text = '[[sb-0418|Goblin]]';
    expect(idLinks(text, bestand)).toEqual({ text, open: [] });
  });

  it('resolves the id before any name', () => {
    expect(linkCandidates(bestand, 'sb-0417').map((e) => e.id)).toEqual(['p2']);
    expect(linkCandidates(bestand, 'goblin').map((e) => e.id)).toEqual(['p2', 'p3']);
    expect(linkCandidates(bestand, '')).toEqual([]);
  });

  it('does not count an instance as a namesake of its template', () => {
    const instanz = { ...art('p4', 'Goblin', 'sb-0419'), relations: [{ id: 'r', type: 'instanceOf', to: 'p2' }] };
    expect(linkCandidates([bestand[0]!, bestand[1]!, instanz as Entity], 'Goblin').map((e) => e.id)).toEqual([
      'p2',
    ]);
  });
});
