/**
 * **Die Leiste oben im Designer** (T-425, REQ-436, E-171): jedes Element
 * der Palette steht in genau einer Gruppe — sonst wäre es nur noch über
 * die Suche zu finden.
 */
import { describe, expect, it } from 'vitest';
import { LEISTE, PALETTE, leistenGruppen } from '../src/app/ansichten/palette';

describe('insert groups of the designer bar', () => {
  it('every palette element stands in exactly one group', () => {
    const alle = PALETTE.flatMap((g) => g.items.map((p) => p.el));
    const inGruppen = leistenGruppen().flatMap((g) => g.items.map((p) => p.el));
    expect([...inGruppen].sort()).toEqual([...alle].sort());
    expect(new Set(inGruppen).size).toBe(inGruppen.length);
  });
  it('a group names only elements the palette has', () => {
    const alle = new Set(PALETTE.flatMap((g) => g.items.map((p) => p.el as string)));
    for (const g of LEISTE) for (const el of g.els) expect(alle.has(el), `${g.name}: ${el}`).toBe(true);
  });
});
