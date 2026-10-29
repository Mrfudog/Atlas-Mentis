import { describe, expect, it } from 'vitest';
import { discardPiece, shopsHere, undoDiscard } from '../src/discard.js';
import type { Entity } from '../src/types.js';

/* Wegwerfen aus dem Inventar (T-407, REQ-404): erfundene Artikel. */

const e = (id: string, typ: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], components: extra.components ?? {}, relations: extra.relations ?? [],
});

const fackel = e('fackel', 'Item', { components: { Item: { copperPrice: 1 } } });
const stueck = e('st1', 'Item', { relations: [{ id: 'st1~i', type: 'instanceOf', to: 'fackel' }] });
const sack = e('sack', 'Item', { relations: [{ id: 'sack~c', type: 'carries', to: 'sackinv' }] });
const sackinv = e('sackinv', 'Inventory', { relations: [{ id: 'si~1', type: 'holds', to: 'fackel', props: { qty: 1 } }] });
const inv = e('inv', 'Inventory', {
  relations: [
    { id: 'h1', type: 'holds', to: 'st1', props: { qty: 5, tier: 'pack', gx: 1, gy: 2 } },
    { id: 'h2', type: 'holds', to: 'fackel', props: { qty: 1, reservedFor: 'auftrag' } },
    { id: 'h3', type: 'holds', to: 'sack', props: { qty: 1 } },
  ],
});
const alle = new Map([fackel, stueck, sack, sackinv, inv].map((x) => [x.id, x]));

describe('discardPiece (T-407)', () => {
  it('verringert einen Stapel und lässt die Instanz liegen', () => {
    const r = discardPiece(inv, 'h1', 2, alle);
    if ('refused' in r) throw new Error(r.refused);
    expect(r.inventory.relations?.find((x) => x.id === 'h1')?.props?.['qty']).toBe(3);
    expect(r.qty).toBe(2);
    expect(r.orphan).toBeUndefined();
  });

  it('nimmt den ganzen Stapel und nennt die Instanz, die niemand mehr hält', () => {
    const r = discardPiece(inv, 'h1', 5, alle);
    if ('refused' in r) throw new Error(r.refused);
    expect(r.inventory.relations?.some((x) => x.id === 'h1')).toBe(false);
    expect(r.orphan).toBe('st1');
    expect(r.edge).toMatchObject({ id: 'h1', props: { qty: 5, gx: 1 } });
  });

  it('löscht nie einen Grundartikel, auch wenn die Kante direkt auf ihn zeigt', () => {
    const offen = { ...inv, relations: [{ id: 'h9', type: 'holds', to: 'fackel', props: { qty: 1 } }] };
    const r = discardPiece(offen, 'h9', 1, alle);
    if ('refused' in r) throw new Error(r.refused);
    expect(r.orphan).toBeUndefined();
  });

  it('löscht keine Instanz, die noch ein anderes Inventar hält', () => {
    const anderes = e('inv2', 'Inventory', { relations: [{ id: 'x1', type: 'holds', to: 'st1', props: { qty: 1 } }] });
    const r = discardPiece(inv, 'h1', 5, new Map(alle).set('inv2', anderes));
    if ('refused' in r) throw new Error(r.refused);
    expect(r.orphan).toBeUndefined();
  });

  it('verweigert Reserviertes, einen vollen Behälter, zu viele und eine fremde Kante', () => {
    expect(discardPiece(inv, 'h2', 1, alle)).toEqual({ refused: 'reserved' });
    expect(discardPiece(inv, 'h3', 1, alle)).toEqual({ refused: 'notEmpty' });
    expect(discardPiece(inv, 'h1', 6, alle)).toEqual({ refused: 'tooFew' });
    expect(discardPiece(inv, 'nix', 1, alle)).toEqual({ refused: 'missing' });
  });
});

describe('undoDiscard (T-407)', () => {
  it('legt einen ganz weggeworfenen Stapel mit seiner Lage zurück', () => {
    const r = discardPiece(inv, 'h1', 5, alle);
    if ('refused' in r) throw new Error(r.refused);
    const zurueck = undoDiscard(r.inventory, { edge: r.edge, qty: r.qty });
    expect(zurueck.relations?.find((x) => x.id === 'h1')).toEqual(inv.relations?.[0]);
  });

  it('zählt einen Teil zurück auf den Stapel, der noch da ist', () => {
    const r = discardPiece(inv, 'h1', 2, alle);
    if ('refused' in r) throw new Error(r.refused);
    const zurueck = undoDiscard(r.inventory, { edge: r.edge, qty: r.qty });
    expect(zurueck.relations?.find((x) => x.id === 'h1')?.props?.['qty']).toBe(5);
  });
});

describe('shopsHere (T-407)', () => {
  const laden = e('laden', 'Shop', { relations: [{ id: 'l~p', type: 'partOf', to: 'gasse' }] });
  const ferne = e('ferne', 'Shop');
  const gasse = e('gasse', 'Place');
  const szene = e('szene', 'Scene', { relations: [{ id: 'sz~1', type: 'partOf', to: 'gasse' }] });
  const sitzung = e('s1', 'Session', { components: { SessionState: { activeScene: 'szene' } } });
  const reg = { interfaces: { Shop: { name: 'Shop', extends: ['Place'] }, Place: { name: 'Place' } } } as never;

  it('nennt die Läden am Ort der Szene im Spiel', () => {
    const m = new Map([laden, ferne, gasse, szene, sitzung, e('k', 'Campaign')].map((x) => [x.id, x]));
    expect([...shopsHere(reg, m, 'k')]).toEqual(['laden']);
  });

  it('ist leer, wenn nichts im Spiel steht', () => {
    const m = new Map([laden, ferne, gasse, szene, e('k', 'Campaign')].map((x) => [x.id, x]));
    expect(shopsHere(reg, m, 'k').size).toBe(0);
  });
});
