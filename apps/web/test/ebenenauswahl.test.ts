/**
 * Gespeicherte Ebenenauswahlen (T-186): festgehalten wird der Stapel von
 * unten nach oben und was trotz Gruppe aus ist; geladen wird, was davon noch
 * da ist und sich aufschalten lässt — der Rest wird gezählt.
 */

import { describe, expect, it } from 'vitest';
import type { KampagnenEbene } from '../src/app/kern/api';
import { auswahlAnwenden, auswahlAusStand, auswahlGilt } from '../src/app/verwaltung/ebenen';

const ebene = (id: string, x: Partial<KampagnenEbene> = {}): KampagnenEbene =>
  ({ id, name: id, active: false, off: false, canActivate: true, inPlay: false, ...x }) as KampagnenEbene;

describe('saved layer selections (T-186)', () => {
  const stand = [ebene('phb', { active: true }), ebene('dmg', { off: true }), ebene('camp', { active: true }), ebene('xge')];

  it('keeps the stack in order and what is off', () => {
    expect(auswahlAusStand(stand)).toEqual({ layers: ['phb', 'camp'], off: ['dmg'] });
    expect(auswahlGilt({ layers: ['phb', 'camp'], off: ['dmg'] }, stand)).toBe(true);
    expect(auswahlGilt({ layers: ['camp', 'phb'], off: ['dmg'] }, stand)).toBe(false);
    expect(auswahlGilt({ layers: ['phb', 'camp'], off: [] }, stand)).toBe(false);
  });

  it('loads what is still there and counts the rest', () => {
    const hier = [...stand, ebene('fremd', { canActivate: false })];
    expect(auswahlAnwenden({ layers: ['xge', 'weg', 'fremd', 'camp'], off: ['dmg', 'auch-weg'] }, hier)).toEqual({
      layers: ['xge', 'camp'],
      off: ['dmg'],
      fehlt: 3,
    });
  });
});
