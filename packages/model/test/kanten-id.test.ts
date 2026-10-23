/**
 * **Kanten-Ids einer Kampagne sind über die ganze Installation eindeutig**
 * (T-410). In Postgres ist `relation.id` der Primärschlüssel über alle
 * Artikel; `withStack` vergab `activates-<ebene>` ohne die Kampagne darin.
 * Schaltete eine zweite Kampagne dieselbe Ebene auf, stiess die Id auf die
 * der ersten — 500, und die Ebene sprang zurück.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../src/types.js';
import { withCompare, withOff, withStack } from '../src/stack.js';

const kampagne = (id: string): Entity => ({ id, name: id, interfaces: ['Campaign'], relations: [] });
const ids = (e: Entity) => (e.relations ?? []).map((r) => r.id);

describe('Kanten-Ids beim Aufschalten (T-410)', () => {
  it('zwei Kampagnen, dieselbe Ebene: verschiedene Ids', () => {
    const a = withStack(kampagne('camp_a'), ['ly_buch']);
    const b = withStack(kampagne('camp_b'), ['ly_buch']);
    expect(ids(a)).toHaveLength(1);
    expect(ids(a)[0]).not.toBe(ids(b)[0]);
  });

  it('Vergleich und Abschaltung ebenso', () => {
    const a = withOff(withCompare(withStack(kampagne('camp_a'), ['ly_gruppe']), ['ly_vgl']), ['ly_aus']);
    const b = withOff(withCompare(withStack(kampagne('camp_b'), ['ly_gruppe']), ['ly_vgl']), ['ly_aus']);
    const gemeinsam = ids(a).filter((id) => ids(b).includes(id));
    expect(gemeinsam).toEqual([]);
  });

  it('eine Kante, die bleibt, behält ihre Id — auch eine alte ohne Kampagne', () => {
    const alt: Entity = {
      ...kampagne('camp_a'),
      relations: [{ id: 'activates-ly_buch', type: 'activates', to: 'ly_buch', props: { order: 10 } }],
    };
    const neu = withStack(alt, ['ly_neu', 'ly_buch']);
    expect(ids(neu)).toContain('activates-ly_buch');
    expect(new Set(ids(neu)).size).toBe(ids(neu).length);
  });
});
