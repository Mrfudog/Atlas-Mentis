import { describe, expect, it } from 'vitest';
import { applyPriceMods, buyWare, buybackPrice, parsePriceMod, sellPiece, shopWares } from '../src/shop.js';
import { newInstance } from '../src/instance.js';
import type { Entity } from '../src/types.js';

/* Erfundene Artikel: ein Laden, zwei Waren, eine Fraktion mit Leiter,
   eine Gruppe und eine Figur. Kein Buchinhalt. */
const art = (id: string, typ: string, name: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: {}, relations: [], ...extra,
});
const seil = art('seil', 'Item', 'Rope', { components: { Item: { copperPrice: 100 } } });
const laterne = art('laterne', 'Item', 'Lantern', { components: { Item: { copperPrice: 1000 } } });
const gilde = art('gilde', 'Faction', 'Lamplighters', {
  components: { Faction: { ranks: ['Wick', 'Flame', 'Beacon'] } },
});

function welt(...es: Entity[]) {
  return new Map([seil, laterne, gilde, ...es].map((e) => [e.id, e]));
}

describe('parsePriceMod (T-129): ein Abschlag ist ein Wort', () => {
  it('liest Münzen und Prozent, mit und ohne Vorzeichen', () => {
    expect(parsePriceMod('−10 gp')).toEqual({ kind: 'flat', cp: -1000 });
    expect(parsePriceMod('-10%')).toEqual({ kind: 'pct', pct: -10 });
    expect(parsePriceMod('+5 sp')).toEqual({ kind: 'flat', cp: 50 });
    expect(parsePriceMod('10 %')).toEqual({ kind: 'pct', pct: 10 });
    expect(parsePriceMod('2,5 gp')).toEqual({ kind: 'flat', cp: 250 });
  });
  it('rät nicht: ohne Einheit oder Unsinn gibt es null', () => {
    expect(parsePriceMod('-10')).toBeNull();
    expect(parsePriceMod('cheap')).toBeNull();
    expect(parsePriceMod(5)).toBeNull();
  });
});

describe('applyPriceMods: Prozent auf den Grundpreis, nie unter null', () => {
  it('addiert Prozent statt sie zu verketten', () => {
    const r = applyPriceMods(1000, [{ by: 'shop', mod: '-10%' }, { by: 'ware', mod: '-10%' }]);
    expect(r.price).toBe(800);
    expect(r.steps.map((s) => s.delta)).toEqual([-100, -100]);
  });
  it('zählt einen unlesbaren Abschlag als null und sagt es', () => {
    const r = applyPriceMods(100, [{ by: 'ware', mod: 'half' }, { by: 'shop', mod: '-5 gp' }]);
    expect(r.price).toBe(0);
    expect(r.steps[0]).toMatchObject({ invalid: true, delta: 0 });
  });
  it('ohne Grundpreis kein Preis, die Herkunft bleibt', () => {
    expect(applyPriceMods(undefined, [{ by: 'shop', mod: '-10%' }])).toEqual({ steps: [{ by: 'shop', mod: '-10%', delta: 0 }] });
  });
});

describe('shopWares: Waren, Menge, und woher jeder Abschlag kommt', () => {
  const laden = (extra: Partial<Entity> = {}) =>
    art('laden', 'Shop', 'The Wick & Wire', {
      components: { Shop: { priceMod: '-10%' } },
      relations: [
        { id: 's1', type: 'sells', to: 'laterne', props: { qty: 3, mod: '-1 gp' } },
        { id: 's2', type: 'sells', to: 'seil', props: { qty: 0, price: 150 } },
      ],
      ...extra,
    });

  it('am Tisch: Laden und Ware, Menge und Verfügbarkeit', () => {
    const [l, s] = shopWares(laden(), { entities: welt() });
    // 10 gp − 10 % − 1 gp = 8 gp
    expect(l).toMatchObject({ name: 'Lantern', qty: 3, available: true, list: 1000, base: 1000, price: 800 });
    expect(l!.steps.map((x) => [x.by, x.delta])).toEqual([['shop', -100], ['ware', -100]]);
    // Eigener Preis statt Listenpreis; Menge 0 ist ausverkauft.
    expect(s).toMatchObject({ list: 100, base: 150, price: 135, available: false });
  });

  it('eine Fraktion, die den Laden kontrolliert, gibt ihren Mitgliedern ab einem Rang Rabatt', () => {
    const g = { ...gilde, relations: [
      { id: 'c', type: 'controls', to: 'laden' },
      { id: 'd', type: 'discount', to: 'gilde', props: { mod: '-10%', rank: 'Flame' } },
    ] };
    const novize = art('nov', 'Creature', 'Tam', { relations: [{ id: 'm', type: 'memberOf', to: 'gilde', props: { rank: 'Wick' } }] });
    const meisterin = art('mei', 'Creature', 'Ysolde', { relations: [{ id: 'm', type: 'memberOf', to: 'gilde', props: { rank: 'Beacon' } }] });
    const tippfehler = { ...g, relations: [g.relations[0]!, { id: 'd', type: 'discount', to: 'gilde', props: { mod: '-10%', rank: 'Flam' } }] };
    const e = welt(g, novize, meisterin, laden());
    expect(shopWares(laden(), { entities: e, buyer: novize })[0]!.price).toBe(800);
    const [l] = shopWares(laden(), { entities: e, buyer: meisterin });
    expect(l!.price).toBe(700);
    expect(l!.steps[1]).toEqual({ by: 'discount', giver: 'gilde', target: 'gilde', rank: 'Flame', mod: '-10%', delta: -100 });
    // Ein Rang, der nicht in der Leiter steht, gewährt nichts.
    expect(shopWares(laden(), { entities: welt(tippfehler, meisterin), buyer: meisterin })[0]!.price).toBe(800);
  });

  it('der Laden gibt der Gruppe der Kampagne Rabatt, der Ladenhalter einer Figur', () => {
    const gruppe = art('grp', 'Party', 'The Lanterns');
    const wirt = art('wirt', 'Creature', 'Odo', {
      relations: [{ id: 'g', type: 'discount', to: 'rook', props: { mod: '-2 gp', note: 'owes us' } }],
    });
    const rook = art('rook', 'PlayerCharacter', 'Rook', { relations: [{ id: 'p', type: 'memberOfParty', to: 'grp' }] });
    const l = laden({
      relations: [
        { id: 's1', type: 'sells', to: 'laterne' },
        { id: 'd', type: 'discount', to: 'grp', props: { mod: '-5%' } },
        { id: 'k', type: 'shopkeeper', to: 'wirt' },
      ],
    });
    const [w] = shopWares(l, { entities: welt(gruppe, wirt, rook, l), buyer: rook });
    // 10 gp − 10 % − 5 % − 2 gp = 6 gp 5 sp
    expect(w!.price).toBe(650);
    expect(w!.steps.map((s) => [s.by, s.giver, s.target])).toEqual([
      ['shop', 'laden', undefined],
      ['discount', 'laden', 'grp'],
      ['discount', 'wirt', 'rook'],
    ]);
    // Wer nicht in der Gruppe ist und dem der Wirt nichts gibt, zahlt den Ladenpreis.
    const fremd = art('fremd', 'Creature', 'Stranger');
    expect(shopWares(l, { entities: welt(gruppe, wirt, rook, fremd, l), buyer: fremd })[0]!.price).toBe(900);
  });
});

describe('buyWare / sellPiece (T-133): Menge, Inventar, Münzen', () => {
  const laden = art('laden', 'Shop', 'Wick & Wire', {
    relations: [
      { id: 'l~1', type: 'sells', to: 'laterne', props: { qty: 2 } },
      { id: 'l~2', type: 'sells', to: 'seil', props: {} },
    ],
  });
  const beutel = (copper: number, relations: Entity['relations'] = []) =>
    art('inv', 'Inventory', 'Pack', { components: { Inventory: { copper } }, relations });

  const stueck = { edge: 'neu', to: 'inst' };
  it('zieht Menge und Münzen ab und legt auf den losen Stapel', () => {
    const [ware] = shopWares(laden, { entities: welt(laden) });
    const r = buyWare(laden, beutel(2500, [{ id: 'h1', type: 'holds', to: 'laterne', props: { qty: 1, tier: 'pack' } }]), ware!, 2, stueck, welt(laden));
    if ('refused' in r) throw new Error(r.refused);
    expect(r.created).toBe(false);
    expect(r.total).toBe(2000);
    expect(r.shop.relations?.[0]?.props?.['qty']).toBe(0);
    expect(r.inventory.components['Inventory']?.['copper']).toBe(500);
    expect(r.inventory.relations).toEqual([{ id: 'h1', type: 'holds', to: 'laterne', props: { qty: 3, tier: 'pack' } }]);
  });

  it('lässt eine unbegrenzte Ware unbegrenzt und legt eine neue Instanz an (T-150)', () => {
    const ware = shopWares(laden, { entities: welt(laden) })[1]!;
    const r = buyWare(laden, beutel(100), ware, 1, stueck, welt(laden));
    if ('refused' in r) throw new Error(r.refused);
    expect(r.shop).toBe(laden);
    expect(r).toMatchObject({ created: true, piece: 'inst' });
    expect(r.inventory.relations).toEqual([{ id: 'neu', type: 'holds', to: 'inst', props: { qty: 1, tier: 'pack' } }]);
  });

  it('legt auf eine Instanz, die nicht abweicht, und nicht auf eine gravierte', () => {
    const ware = shopWares(laden, { entities: welt(laden) })[1]!;
    const glatt = newInstance(seil, { id: 'i1', number: 'item-0002', layer: 'ebene' });
    const graviert: Entity = { ...newInstance(seil, { id: 'i2', number: 'item-0003' }), components: { Identity: { name: 'Lucky Rope', id: 'item-0003' } } };
    const w = welt(laden, glatt, graviert);
    const inv = beutel(500, [{ id: 'h2', type: 'holds', to: 'i2', props: { qty: 1 } }, { id: 'h1', type: 'holds', to: 'i1', props: { qty: 1 } }]);
    const r = buyWare(laden, inv, ware, 2, stueck, w);
    if ('refused' in r) throw new Error(r.refused);
    expect(r).toMatchObject({ created: false, piece: 'i1' });
    expect(r.inventory.relations?.[1]?.props?.['qty']).toBe(3);
    const ohne = buyWare(laden, beutel(500, [{ id: 'h2', type: 'holds', to: 'i2', props: { qty: 1 } }]), ware, 1, stueck, w);
    expect(ohne).toMatchObject({ created: true, piece: 'inst' });
  });

  it('lehnt ab: zu wenig Geld, zu viele, ausverkauft, ohne Preis', () => {
    const [ware] = shopWares(laden, { entities: welt(laden) });
    const w = welt(laden);
    expect(buyWare(laden, beutel(999), ware!, 1, stueck, w)).toEqual({ refused: 'tooPoor' });
    expect(buyWare(laden, beutel(9999), ware!, 3, stueck, w)).toEqual({ refused: 'tooFew' });
    expect(buyWare(laden, beutel(9999), { ...ware!, qty: 0, available: false }, 1, stueck, w)).toEqual({ refused: 'soldOut' });
    const { price: _p, ...ohne } = ware!;
    expect(buyWare(laden, beutel(9999), ohne, 1, stueck, w)).toEqual({ refused: 'noPrice' });
  });

  it('kauft die Hälfte des Listenpreises an und füllt eine gezählte Ware auf', () => {
    expect(buybackPrice(laterne)).toBe(500);
    const inv = beutel(0, [{ id: 'h1', type: 'holds', to: 'laterne', props: { qty: 2 } }]);
    const r = sellPiece(laden, inv, 'h1', 1, welt(laden));
    if ('refused' in r) throw new Error(r.refused);
    expect(r).toMatchObject({ item: 'laterne', qty: 1, unit: 500, total: 500 });
    expect(r.shop.relations?.[0]?.props?.['qty']).toBe(3);
    expect(r.inventory.relations?.[0]?.props?.['qty']).toBe(1);
    expect(r.inventory.components['Inventory']?.['copper']).toBe(500);
  });

  it('verkauft kein reserviertes Stück und keinen vollen Behälter', () => {
    const inv = beutel(0, [{ id: 'h1', type: 'holds', to: 'laterne', props: { qty: 1, reservedFor: 'auftrag' } }]);
    expect(sellPiece(laden, inv, 'h1', 1, welt(laden))).toEqual({ refused: 'reserved' });
    const sack = art('sack', 'Item', 'Sack', { components: { Item: { copperPrice: 10 } }, relations: [{ id: 's~1', type: 'carries', to: 'innen' }] });
    const innen = art('innen', 'Inventory', 'Inside', { relations: [{ id: 'i~1', type: 'holds', to: 'seil' }] });
    const inv2 = beutel(0, [{ id: 'h2', type: 'holds', to: 'sack', props: { qty: 1 } }]);
    expect(sellPiece(laden, inv2, 'h2', 1, welt(laden, sack, innen))).toEqual({ refused: 'notEmpty' });
  });

  it('verkauft eine Instanz zum Preis der Vorlage: eine beliebige fällt weg, eine eigene führt der Laden', () => {
    const glatt = newInstance(laterne, { id: 'i1', number: 'item-0002' });
    const r = sellPiece(laden, beutel(0, [{ id: 'h1', type: 'holds', to: 'i1', props: { qty: 1 } }]), 'h1', 1, welt(laden, glatt));
    if ('refused' in r) throw new Error(r.refused);
    expect(r).toMatchObject({ item: 'laterne', unit: 500, orphan: 'i1' });
    expect(r.shop.relations?.[0]?.props?.['qty']).toBe(3);
    const eigen: Entity = { ...newInstance(laterne, { id: 'i2', number: 'item-0003' }), components: { Identity: { name: 'Grandma’s Lantern', id: 'item-0003' } } };
    const r2 = sellPiece(laden, beutel(0, [{ id: 'h2', type: 'holds', to: 'i2', props: { qty: 1 } }]), 'h2', 1, welt(laden, eigen));
    if ('refused' in r2) throw new Error(r2.refused);
    expect(r2.orphan).toBeUndefined();
    expect(r2.item).toBe('i2');
    expect(r2.shop.relations?.at(-1)).toMatchObject({ type: 'sells', to: 'i2', props: { qty: 1 } });
    expect(shopWares(r2.shop, { entities: welt(r2.shop, eigen) }).at(-1)).toMatchObject({ item: 'i2', list: 1000 });
  });
});
