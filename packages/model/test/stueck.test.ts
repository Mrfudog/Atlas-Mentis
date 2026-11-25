import { describe, expect, it } from 'vitest';
import { receivePiece } from '../src/shop.js';
import { baseArticle, followsTemplate, newInstance, resolveInstance } from '../src/instance.js';
import type { Entity } from '../src/types.js';

/* Ein Stück kommt ins Inventar (T-150): als Instanz oder auf einen losen
   Stapel. Erfundene Artikel, kein Buchinhalt. */
const art = (id: string, typ: string, name: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: {}, relations: [], ...extra,
});
const fackel = art('fackel', 'Item', 'Torch');
const sack = art('sack', 'Item', 'Sack', { relations: [{ id: 'sack~c', type: 'carries', to: 'inv-sack', props: {} }] });
const welt = (...es: Entity[]) => new Map([fackel, sack, ...es].map((e) => [e.id, e]));
const inv = (...rel: Entity['relations']) => art('inv', 'Inventory', 'Pack', { relations: rel ?? [] });

describe('receivePiece (T-150)', () => {
  it('legt eine neue Kante auf das neue Stück und sagt, dass es anzulegen ist', () => {
    const r = receivePiece(inv(), 'fackel', 2, { edge: 'k1', to: 'st1' }, welt());
    expect(r.created).toBe(true);
    expect(r.piece).toBe('st1');
    expect(r.inventory.relations).toEqual([{ id: 'k1', type: 'holds', to: 'st1', props: { qty: 2, tier: 'pack' } }]);
  });

  it('legt auf einen losen Stapel einer Instanz, die der Vorlage folgt', () => {
    const st = newInstance(fackel, { id: 'st1', number: 'item-0002' });
    const r = receivePiece(inv({ id: 'h', type: 'holds', to: 'st1', props: { qty: 1 } }), 'fackel', 3, { edge: 'k2', to: 'st2' }, welt(st));
    expect(r.created).toBe(false);
    expect(r.piece).toBe('st1');
    expect(r.inventory.relations?.[0]?.props?.['qty']).toBe(4);
  });

  it('nicht auf ein graviertes, ein reserviertes oder ein hingelegtes Stück', () => {
    const graviert = { ...newInstance(fackel, { id: 'st1', number: 'item-0002' }), components: { Identity: { name: 'Old Flame' } } };
    const frei = newInstance(fackel, { id: 'st3', number: 'item-0004' });
    for (const [h, w] of [
      [{ id: 'h', type: 'holds', to: 'st1', props: { qty: 1 } }, welt(graviert)],
      [{ id: 'h', type: 'holds', to: 'st3', props: { qty: 1, reservedFor: 'auftrag' } }, welt(frei)],
      [{ id: 'h', type: 'holds', to: 'st3', props: { qty: 1, gx: 0, gy: 0 } }, welt(frei)],
    ] as const) {
      expect(receivePiece(inv(h), 'fackel', 1, { edge: 'k2', to: 'st2' }, w).created).toBe(true);
    }
  });
});

describe('ein Stück trägt sein eigenes Inventar (T-150)', () => {
  it('eine Instanz erbt das Inventar der Vorlage nicht', () => {
    const st = newInstance(sack, { id: 'st1', number: 'item-0002' });
    expect(resolveInstance(welt(st), st).relations?.some((r) => r.type === 'carries')).toBe(false);
  });

  it('ein Stück mit eigenem Inhalt folgt der Vorlage nicht mehr', () => {
    const st = newInstance(sack, { id: 'st1', number: 'item-0002' });
    expect(followsTemplate(welt(st), st)).toBe(true);
    const voll = { ...st, relations: [...(st.relations ?? []), { id: 'st1~c', type: 'carries', to: 'inv-2', props: {} }] };
    expect(followsTemplate(welt(voll), voll)).toBe(false);
  });
});

describe('baseArticle (T-150)', () => {
  it('ist die fernste Vorlage, sonst der Artikel selbst', () => {
    const st = newInstance(fackel, { id: 'st1', number: 'item-0002' });
    const st2 = newInstance(st, { id: 'st2', number: 'item-0003' });
    const w = welt(st, st2);
    expect(baseArticle(w, 'st2')).toBe('fackel');
    expect(baseArticle(w, 'st1')).toBe('fackel');
    expect(baseArticle(w, 'fackel')).toBe('fackel');
    expect(baseArticle(w, 'gibts-nicht')).toBe('gibts-nicht');
  });
});
