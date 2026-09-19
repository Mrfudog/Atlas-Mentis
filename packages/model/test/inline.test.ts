import { describe, expect, it } from 'vitest';
import { parseInline, plainText, resolveVar, varNames } from '../src/inline.js';

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
