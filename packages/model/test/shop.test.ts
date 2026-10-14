import { describe, expect, it } from 'vitest';
import { applyPriceMods, parsePriceMod, shopWares } from '../src/shop.js';
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

describe('shopWares liest die geltende Fassung (T-139)', () => {
  it('nimmt Preis und Herkunft aus der Fassung, die `resolve` nennt', () => {
    const ring = art('ring', 'Item', 'Ring of Warmth', { components: { Item: { rarity: 'uncommon' } } });
    const ki = art('ring-ai', 'Item', 'Ring of Warmth', {
      components: { Item: { copperPrice: 40000, priceNote: 'estimated: uncommon' } },
    });
    const laden = art('laden', 'Shop', 'Wick', { relations: [{ id: 's~1', type: 'sells', to: 'ring' }] });
    const entities = welt(ring, ki, laden);
    expect(shopWares(laden, { entities })[0]).toMatchObject({ item: 'ring' });
    expect(shopWares(laden, { entities })[0]!.list).toBeUndefined();
    const w = shopWares(laden, { entities, resolve: (e) => (e.id === 'ring' ? ki : e) })[0]!;
    expect(w).toMatchObject({ item: 'ring-ai', list: 40000, listNote: 'estimated: uncommon', price: 40000 });
  });
});
