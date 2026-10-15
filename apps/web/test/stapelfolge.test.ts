/**
 * Die Reihenfolge im Spiel (T-188): Zeilen von oben nach unten, Gruppen mit
 * dem, was sie bringen, darunter; verschieben, herauslösen, als Satz.
 */

import { describe, expect, it } from 'vitest';
import type { KampagnenEbene } from '../src/app/kern/api';
import { folgeZeilen, herausgeloest, trefferText, verschoben } from '../src/app/verwaltung/stapelfolge';

const ebene = (id: string, x: Partial<KampagnenEbene> = {}): KampagnenEbene =>
  ({ id, name: id, kind: 'book', groups: [], active: false, off: false, inPlay: false, canActivate: true, ...x }) as KampagnenEbene;

/* Stapel von unten nach oben: die Gruppe „2014" (PHB, DMG, XGE), darüber
   das herausgelöste XGE, oben die Kampagnenebene. DMG ist abgeschaltet. */
const layers = [
  ebene('g2014', { kind: 'group', active: true, inPlay: true, members: ['phb', 'dmg', 'xge'] }),
  ebene('xge', { active: true, inPlay: true, groups: ['g2014'] }),
  ebene('camp', { kind: 'campaign', active: true, inPlay: true }),
  ebene('phb', { inPlay: true, groups: ['g2014'] }),
  ebene('dmg', { off: true, groups: ['g2014'] }),
];

describe('order in play (T-188)', () => {
  it('lists the stack top first, with what a group brings beneath it', () => {
    const z = folgeZeilen(layers);
    expect(z.map((x) => [x.ebene.id, x.platz, x.ueber ?? null, x.herausgeloest ?? null])).toEqual([
      ['camp', 1, null, null],
      ['xge', 2, null, 'g2014'],
      ['g2014', 3, null, null],
      ['phb', 3, 'g2014', null],
    ]);
  });

  it('moves a layer to a place counted from the top', () => {
    expect(verschoben(['a', 'b', 'c'], 'a', 0)).toEqual(['b', 'c', 'a']);
    expect(verschoben(['a', 'b', 'c'], 'c', 2)).toEqual(['c', 'a', 'b']);
    expect(verschoben(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'b', 'x', 'c']);
  });

  it('pulls a book out right above its group', () => {
    expect(herausgeloest(['g2014', 'xge', 'camp'], 'phb', 'g2014')).toEqual(['g2014', 'phb', 'xge', 'camp']);
  });

  it('says what a clash does', () => {
    expect(trefferText({ layer: 'phb', name: 'PHB', how: 'version', n: 12 }, 'wins')).toBe('replaces 12 articles of PHB');
    expect(trefferText({ layer: 'c', name: 'Camp', how: 'version', n: 1 }, 'loses')).toBe('1 version loses to Camp');
    expect(trefferText({ layer: 'c', name: 'Camp', how: 'removal', n: 2 }, 'wins')).toBe('takes out 2 articles of Camp');
  });
});
