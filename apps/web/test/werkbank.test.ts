/**
 * Die Werkbank (W9): aus dem Formular wird der Auftrag, den der Server
 * liest — ohne leere Teile, und so, dass `BulkRequestSchema` ihn nimmt.
 */

import { describe, expect, it } from 'vitest';
import { BulkRequestSchema } from '@nw/model';
import { auftragAus, formularFehlt, idsAus, leeresFormular } from '../src/app/werkbank/auftrag';
import { routes } from '../src/app/app.routes';

describe('Werkbank-Auftrag', () => {
  it('builds the Ogre example the server accepts', () => {
    const f = { ...leeresFormular(), type: 'Statblock', field: 'Statblock.combatRole', value: 'Brute' };
    f.where = [{ field: 'name', op: 'endsWith', value: 'Ogre' }];
    const a = auftragAus(f);
    expect(a).toEqual({
      select: { types: ['Statblock'], where: [{ field: 'name', op: 'endsWith', value: 'Ogre' }] },
      ops: [{ op: 'set', field: 'Statblock.combatRole', value: 'Brute' }],
    });
    expect(BulkRequestSchema.safeParse(a).success).toBe(true);
  });

  it('drops empty conditions but keeps those without a value', () => {
    const f = leeresFormular();
    f.where = [
      { field: 'name', op: 'contains', value: '' },
      { field: 'Statblock.cr', op: 'empty', value: 'egal' },
    ];
    expect(auftragAus(f).select).toEqual({ where: [{ field: 'Statblock.cr', op: 'empty' }] });
  });

  it('merges a duplicate group by ids, keeping the given one', () => {
    const f = { ...leeresFormular(), ids: 'e1\ne2, e3', where: [], op: 'merge' as const, by: 'name' as const, keep: 'e1' };
    const a = auftragAus(f);
    expect(a.select).toEqual({ ids: ['e1', 'e2', 'e3'] });
    expect(a.ops).toEqual([{ op: 'merge', mode: 'delete', by: 'name', keep: 'e1' }]);
    expect(BulkRequestSchema.safeParse(a).success).toBe(true);
  });

  it('says what is missing', () => {
    expect(formularFehlt(leeresFormular())).toMatch(/Choose which articles/);
    expect(formularFehlt({ ...leeresFormular(), type: 'Statblock' })).toMatch(/Which field/);
    expect(formularFehlt({ ...leeresFormular(), type: 'Statblock', op: 'addRelation', relType: 'composedOf' })).toMatch(/Edge to/);
  });

  it('reads ids separated by lines, commas and spaces, once each', () => {
    expect(idsAus(' a,b\n c ; a ')).toEqual(['a', 'b', 'c']);
  });

  it('has a route for the workbench and the account', () => {
    expect(routes.some((r) => r.path === 'werkbank')).toBe(true);
    expect(routes.some((r) => r.path === 'account')).toBe(true);
  });
});
