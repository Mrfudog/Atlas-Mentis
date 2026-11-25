import { describe, expect, it } from 'vitest';
import { stackOutcomes, withStack } from '../src/stack.js';
import type { Entity, EntityId } from '../src/types.js';

/* T-188: was die Reihenfolge bewirkt. Ein Regelwerk unten, darüber ein
   Ergänzungsband und die Kampagnenebene. Beide oberen bringen eine Fassung
   desselben Zaubers; der Band nimmt einen Artikel heraus, die
   Kampagnenebene bringt einen anderen zurück. */
const L = (id: string): Entity => ({ id, name: id, interfaces: ['Layer'], components: { Layer: {} } });
const A = (id: string, rel: { type: string; to: string; mode?: string }[]): Entity => ({
  id,
  name: id,
  interfaces: ['Rule'],
  relations: rel.map((r, i) => ({ id: `${id}-${i}`, type: r.type, to: r.to, ...(r.mode ? { props: { mode: r.mode } } : {}) })),
});
const welt = (stapel: string[]): Map<EntityId, Entity> => {
  const camp: Entity = withStack({ id: 'camp', name: 'camp', interfaces: ['Campaign'], relations: [] }, stapel);
  return new Map(
    [
      L('ly_regel'),
      L('ly_band'),
      L('ly_kamp'),
      camp,
      A('zauber', [{ type: 'inLayer', to: 'ly_regel' }]),
      A('zauber_band', [{ type: 'inLayer', to: 'ly_band' }, { type: 'overrides', to: 'zauber' }]),
      A('zauber_kamp', [{ type: 'inLayer', to: 'ly_kamp' }, { type: 'overrides', to: 'zauber' }]),
      A('weg', [{ type: 'inLayer', to: 'ly_regel' }, { type: 'inLayer', to: 'ly_band', mode: 'removes' }]),
      A('zurueck', [
        { type: 'inLayer', to: 'ly_regel' },
        { type: 'inLayer', to: 'ly_band', mode: 'removes' },
        { type: 'inLayer', to: 'ly_kamp' },
      ]),
      A('frei', []),
      A('frei_kamp', [{ type: 'inLayer', to: 'ly_kamp' }, { type: 'overrides', to: 'frei' }]),
    ].map((e) => [e.id, e]),
  );
};

describe('what the order does (T-188)', () => {
  it('counts who wins over whom, by articles', () => {
    const w = welt(['ly_regel', 'ly_band', 'ly_kamp']);
    const o = stackOutcomes(w, w.get('camp')!);
    expect(o.get('ly_kamp')?.wins).toEqual(
      expect.arrayContaining([
        { layer: 'ly_regel', how: 'version', n: 1 },
        { layer: '', how: 'version', n: 1 },
      ]),
    );
    /* Die Fassung des Bands verliert gegen die höhere Kampagnenebene. */
    expect(o.get('ly_band')?.loses).toEqual(
      expect.arrayContaining([
        { layer: 'ly_kamp', how: 'version', n: 1 },
        { layer: 'ly_kamp', how: 'removal', n: 1 },
      ]),
    );
    expect(o.get('ly_band')?.wins).toEqual([{ layer: 'ly_regel', how: 'removal', n: 1 }]);
  });

  it('turns around when the order does', () => {
    const w = welt(['ly_regel', 'ly_kamp', 'ly_band']);
    const o = stackOutcomes(w, w.get('camp')!);
    expect(o.get('ly_band')?.wins).toEqual(
      expect.arrayContaining([
        { layer: 'ly_regel', how: 'version', n: 1 },
        { layer: 'ly_regel', how: 'removal', n: 1 },
        { layer: 'ly_kamp', how: 'removal', n: 1 },
      ]),
    );
    expect(o.get('ly_kamp')?.loses).toEqual([{ layer: 'ly_band', how: 'version', n: 1 }]);
  });

  it('leaves out layers that are not in play', () => {
    const w = welt(['ly_regel', 'ly_kamp']);
    const o = stackOutcomes(w, w.get('camp')!);
    expect(o.has('ly_band')).toBe(false);
    expect(o.get('ly_kamp')?.loses ?? []).toEqual([]);
    expect(stackOutcomes(w, null).size).toBe(0);
  });
});
