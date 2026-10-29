/**
 * Eigene Token-Ränder (T-302): eine Farbkombination oder ein Rahmenbild
 * zeichnet sich mit demselben Ring wie die festen Ränder — auf der Karte,
 * am Artikel und im Dialog „Adjust token".
 */

import { customRing } from '@nw/model';
import { describe, expect, it } from 'vitest';
import { ringMuster, ringStil } from '../src/app/artikel/token-bild';

const look = (ring?: string) => ({ round: false, frame: { x: 50, y: 50, zoom: 1, ...(ring ? { ring } : {}) } });

describe('own token rings', () => {
  const eigene = [customRing({ id: 'ring-0001', colors: ['#112233', '#445566'], width: 0.1 })!, customRing({ id: 'ring-0002', image: 'img-0042' })!];

  it('paints a colour combination as the ring', () => {
    expect(ringStil(look('ring-0001'), 100, eigene)).toEqual({
      '--ring-w': '10px',
      '--ring-bg': 'linear-gradient(135deg, #112233 0%, #445566 100%)',
    });
  });

  it('lays a frame image into the ring, over its colours', () => {
    const s = ringStil(look('ring-0002'), 100, eigene)!;
    expect(s['--ring-w']).toBe('6px');
    expect(s['--ring-bg']).toMatch(/^url\("\/api\/assets\/img-0042[^"]*"\) center \/ cover no-repeat, transparent$/);
    expect(ringMuster(eigene[1]!)).toBe(s['--ring-bg']);
  });

  it('shows Plain for an own ring the list does not bring (yet)', () => {
    expect(ringStil(look('ring-0001'), 100)).toEqual({ '--ring-w': '4px', '--ring-bg': '#f7f1e3' });
  });
});
