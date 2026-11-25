import { describe, expect, it } from 'vitest';
import { planRestore, trashExpired, trashExpires, trashItems, trashParts, TRASH_DAYS, type Entity, type TrashChange } from '../src/index.js';

const art = (id: string, rel: { type: string; to: string }[] = [], typ = 'Place'): Entity => ({
  id,
  interfaces: [typ],
  name: `Name ${id}`,
  components: { Identity: { name: `Name ${id}` } },
  relations: rel.map((r, i) => ({ id: `${id}~${r.type}-${i}`, ...r })),
});

const registry = {
  relations: {
    carries: { type: 'carries', from: ['Creature'], to: ['Inventory'], cardinality: 'one' as const, asField: 'from' as const },
    belongsTo: { type: 'belongsTo', from: ['Statblock'], to: ['Creature'], cardinality: 'one' as const, asField: 'to' as const },
  },
};

/* Ein Lauf: Markt und Hafen gelöscht, der Hafen trug ein Inventar (Teil),
   und der Tempel verlor seine Kanten auf beide. */
const markt = art('p_markt', [{ type: 'inLayer', to: 'ly' }, { type: 'near', to: 'p_hafen' }]);
const hafen = art('p_hafen', [{ type: 'inLayer', to: 'ly' }, { type: 'carries', to: 'inv_hafen' }]);
const inventar = art('inv_hafen', [{ type: 'inLayer', to: 'ly' }], 'Inventory');
const tempelVorher = art('p_tempel', [{ type: 'near', to: 'p_markt' }, { type: 'near', to: 'p_hafen' }]);
const tempelNachher: Entity = { ...tempelVorher, relations: [] };
const lauf: TrashChange[] = [
  { id: 'p_markt', before: markt, after: null },
  { id: 'p_hafen', before: hafen, after: null },
  { id: 'inv_hafen', before: inventar, after: null },
  { id: 'p_tempel', before: tempelVorher, after: tempelNachher },
];
const haupt = ['p_markt', 'p_hafen'];
/* Die Ebene steht immer da; sie geht nie über diesen Weg. */
const jetzt = (...es: Entity[]) => new Map([art('ly', [], 'Layer'), ...es].map((e) => [e.id, e]));

describe('Papierkorb (T-400)', () => {
  it('Frist: 30 Tage ab dem Löschen, danach endgültig', () => {
    expect(TRASH_DAYS).toBe(30);
    expect(trashExpires('2026-10-01T10:00:00.000Z')).toBe('2026-10-31T10:00:00.000Z');
    expect(trashExpired('2026-10-01T10:00:00.000Z', Date.parse('2026-10-31T09:59:59Z'))).toBe(false);
    expect(trashExpired('2026-10-01T10:00:00.000Z', Date.parse('2026-10-31T10:00:00Z'))).toBe(true);
  });

  it('ein Teil gehört zu dem Artikel, mit dem es ging', () => {
    expect(trashParts(registry, lauf, haupt)).toEqual(new Map([['inv_hafen', 'p_hafen']]));
  });

  it('die Liste nennt je gelöschten Artikel seine Teile und ob er schon zurück ist', () => {
    const items = trashItems(registry, lauf, haupt, (id) => id === 'p_markt');
    expect(items).toEqual([
      expect.objectContaining({ id: 'p_markt', name: 'Name p_markt', type: 'Place', parts: 0, restored: true }),
      expect.objectContaining({ id: 'p_hafen', parts: 1, restored: false, layers: ['ly'] }),
    ]);
  });

  it('einzeln zurück: der Artikel samt Teil, und nur seine Kanten kommen zurück', () => {
    const p = planRestore(registry, lauf, haupt, ['p_hafen'], jetzt(tempelNachher, inventar));
    expect(p.restored).toEqual(['p_hafen']);
    const nach = new Map(p.changes.map((c) => [c.id, c.after]));
    /* Das Inventar steht schon wieder da und wird nicht doppelt angelegt. */
    expect(nach.has('inv_hafen')).toBe(false);
    expect(nach.get('p_hafen')).toEqual(hafen);
    /* Der Tempel bekommt die Kante auf den Hafen, nicht die auf den Markt. */
    expect(nach.get('p_tempel')!.relations!.map((r) => r.to)).toEqual(['p_hafen']);
  });

  it('eine Kante auf einen noch gelöschten Artikel kommt nicht mit — und später, wenn er kommt', () => {
    const erst = planRestore(registry, lauf, haupt, ['p_markt'], jetzt(tempelNachher));
    const m = erst.changes.find((c) => c.id === 'p_markt')!.after!;
    expect(m.relations!.map((r) => r.to)).toEqual(['ly']);
    /* Jetzt steht der Markt ohne Kante zum Hafen; der Hafen kommt nach. */
    const tempel = erst.changes.find((c) => c.id === 'p_tempel')!.after!;
    const dann = planRestore(registry, lauf, haupt, ['p_hafen'], jetzt(tempel, m));
    const nach = new Map(dann.changes.map((c) => [c.id, c.after]));
    expect(nach.get('p_markt')!.relations!.map((r) => r.to)).toEqual(['ly', 'p_hafen']);
    expect(nach.get('p_tempel')!.relations!.map((r) => r.to)).toEqual(['p_markt', 'p_hafen']);
    expect(nach.get('inv_hafen')).toEqual(inventar);
  });

  it('ohne Auswahl alles; was schon da ist, zählt nicht', () => {
    const p = planRestore(registry, lauf, haupt, undefined, jetzt(tempelNachher, markt));
    expect(p.restored).toEqual(['p_hafen']);
    expect(planRestore(registry, lauf, haupt, ['p_fremd'], jetzt()).restored).toEqual([]);
  });
});
