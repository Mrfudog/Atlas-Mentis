import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '@nw/model';
import { inline, klartext, markdown } from '../src/text.js';
import type { TextKontext } from '../src/text.js';

/** Ein Kontext, der genau `fireball` und `goblin|MM` kennt und den Rest zählt. */
function kontext() {
  const leer: string[] = [];
  const unbekannt: string[] = [];
  const ctx: TextKontext = {
    finde: (tag, t) => {
      const name = (t[0] ?? '').toLowerCase();
      if (tag === 'spell' && name === 'fireball') return 'spell-0001';
      if (tag === 'creature' && name === 'goblin' && (!t[1] || t[1].toLowerCase() === 'mm')) return 'statblock-0001';
      return undefined;
    },
    insLeere: (tag, ziel) => leer.push(`${tag}:${ziel}`),
    unbekannt: (w) => unbekannt.push(w),
  };
  return { ctx, leer, unbekannt };
}

describe('Inline-Marken (Abgleich §4.2, Schritt 15)', () => {
  it('macht aus einer Verweismarke einen Verweis auf die Nummer, mit der Anzeige', () => {
    const { ctx } = kontext();
    expect(inline('Cast {@spell fireball} at a {@creature Goblin|MM|goblin}.', ctx)).toBe(
      'Cast [[spell-0001|fireball]] at a [[statblock-0001|goblin]].',
    );
  });

  it('lässt einen Verweis ins Leere als Text stehen und zählt ihn', () => {
    const { ctx, leer } = kontext();
    expect(inline('a {@creature Goblin Warrior|XMM}', ctx)).toBe('a Goblin Warrior');
    expect(leer).toEqual(['creature:Goblin Warrior|XMM']);
  });

  it('schreibt Würfel und Angriffe in unsere Zeichen (M12)', () => {
    const { ctx } = kontext();
    expect(inline('{@atk mw} {@hit 4} to hit. {@h}5 ({@damage 1d6 + 2}) slashing, {@dc 15} Dex', ctx)).toBe(
      '*Melee Weapon Attack:* {{+4}} to hit. *Hit:* 5 ({{1d6 + 2}}) slashing, DC 15 Dex',
    );
    expect(inline('{@dice 1d6 × 10|60}', ctx)).toBe('60');
    expect(inline('{@scaledamage 8d6|3-9|1d6}', ctx)).toBe('{{1d6}}');
    expect(inline('Fire Breath {@recharge 5}', ctx)).toBe('Fire Breath (Recharge 5–6)');
  });

  it('löst verschachtelte Marken von aussen nach innen', () => {
    const { ctx } = kontext();
    expect(inline('{@b Note: {@spell fireball} burns}', ctx)).toBe('**Note: [[spell-0001|fireball]] burns**');
  });

  it('zählt Marken, die es nicht kennt, und behält ihren Text', () => {
    const { ctx, unbekannt } = kontext();
    expect(inline('{@neverheard Something|x}', ctx)).toBe('Something');
    expect(unbekannt).toEqual(['@neverheard']);
  });

  it('macht aus einem Namen mit Marken Klartext', () => {
    expect(klartext('Bite {@recharge 6}')).toBe('Bite (Recharge 6)');
  });
});

describe('Der Textbaum als Markdown (M10)', () => {
  it('schreibt benannte Einträge, Listen, Tabellen und Einschübe, die parseMarkdown liest', () => {
    const { ctx } = kontext();
    const md = markdown(
      [
        'Intro with {@spell fireball}.',
        { type: 'entries', name: 'Section', entries: ['Body.', { type: 'list', items: ['one', { type: 'item', name: 'Two', entry: 'second' }] }] },
        {
          type: 'table',
          caption: 'Roll',
          colLabels: ['{@dice d6}', 'Result'],
          rows: [
            ['1-3', 'a | b'],
            [{ type: 'cell', roll: { min: 4, max: 6 } }, 'see {@creature goblin}'],
          ],
        },
        { type: 'inset', name: 'Aside', entries: ['Inner.'] },
      ],
      ctx,
    );
    const bloecke = parseMarkdown(md);
    expect(bloecke.map((b) => b.kind)).toEqual(['paragraph', 'heading', 'paragraph', 'list', 'paragraph', 'table', 'quote']);
    const tabelle = bloecke.find((b) => b.kind === 'table');
    expect(tabelle && tabelle.kind === 'table' ? tabelle.rows : []).toEqual([
      ['1-3', 'a | b'],
      ['4–6', 'see [[statblock-0001|goblin]]'],
    ]);
    expect(md).toContain('- **Two.** second');
  });

  it('setzt tief im Baum den Namen als fetten Satzanfang statt einer Überschrift', () => {
    const { ctx } = kontext();
    expect(markdown([{ type: 'entries', name: 'Trait', entries: ['Does a thing.'] }], ctx, 5)).toBe('**Trait.** Does a thing.');
  });

  it('zählt Eintragsarten, die es nicht kennt', () => {
    const { ctx, unbekannt } = kontext();
    markdown([{ type: 'hologram', entries: ['x'] }], ctx);
    expect(unbekannt).toContain('Eintrag hologram');
  });
});
