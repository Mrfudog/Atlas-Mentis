import { describe, expect, it } from 'vitest';
import { buybackFor, sellPiece, shopWares } from '../src/shop.js';
import { collectionMemberIds } from '../src/collection.js';
import { materialFit } from '../src/substitutes.js';
import { newInstance } from '../src/instance.js';
import type { Entity, Registry } from '../src/types.js';

/* T-425, REQ-439, E-175: ein Laden verkauft und kauft nach Kanten auf
   Gegenstände und Collections. Erfundene Artikel, kein Buchinhalt. */
const art = (id: string, typ: string, name: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: {}, relations: [], ...extra,
});
const registry: Pick<Registry, 'interfaces'> = {
  interfaces: {
    Item: { name: 'Item', label: 'Item' },
    Weapon: { name: 'Weapon', label: 'Weapon', extends: ['Item'] },
    Rule: { name: 'Rule', label: 'Rule' },
    Collection: { name: 'Collection', label: 'Collection', extends: ['Rule'] },
    MaterialGroup: { name: 'MaterialGroup', label: 'Material group', extends: ['Collection'] },
    Shop: { name: 'Shop', label: 'Shop' },
  } as unknown as Registry['interfaces'],
};

const dolch = art('dolch', 'Weapon', 'Dagger', { components: { Item: { copperPrice: 200 }, Tags: { tags: ['simple'] } } });
const keule = art('keule', 'Weapon', 'Club', { components: { Item: { copperPrice: 10 }, Tags: { tags: ['simple'] } } });
const schwert = art('schwert', 'Weapon', 'Longsword', { components: { Item: { copperPrice: 1500 }, Tags: { tags: ['martial'] } } });
const seil = art('seil', 'Item', 'Rope', { components: { Item: { copperPrice: 100 } } });
/* Eine Collection nach Regel: Waffen mit Marke simple. */
const einfach = art('einfach', 'Collection', 'Simple weapons', { components: { Collection: { types: ['Weapon'], tags: ['simple'] } } });
/* Eine nach Regel: alle Waffen. */
const waffen = art('waffen', 'Collection', 'Weapons', { components: { Collection: { types: ['Weapon'] } } });
/* Eine von Hand: nur über inCollection. */
const kram = art('kram', 'Collection', 'Odds and ends');
const seilDrin = { ...seil, relations: [{ id: 'ic1', type: 'inCollection', to: 'kram' }] };

const welt = (...es: Entity[]) => {
  const m = new Map<string, Entity>();
  for (const e of [dolch, keule, schwert, seilDrin, einfach, waffen, kram, ...es]) m.set(e.id, e);
  return m;
};

describe('collectionMemberIds: die Mitglieder einer Collection im Bestand', () => {
  it('nimmt, was die Regel trifft — Arten mit Untertypen, Marken —, sortiert nach Name', () => {
    expect(collectionMemberIds(registry, einfach, welt())).toEqual(['keule', 'dolch']);
    expect(collectionMemberIds(registry, waffen, welt())).toEqual(['keule', 'dolch', 'schwert']);
  });
  it('nimmt, wer über inCollection hineinzeigt, und lässt aus, wessen Kante exclude sagt', () => {
    expect(collectionMemberIds(registry, kram, welt())).toEqual(['seil']);
    const ohne = { ...keule, relations: [{ id: 'x', type: 'inCollection', to: 'waffen', props: { exclude: true } }] };
    expect(collectionMemberIds(registry, waffen, welt(ohne))).toEqual(['dolch', 'schwert']);
  });
  it('lässt Instanzen und die Collection selbst weg', () => {
    const stueck = newInstance(dolch, { id: 'dolch-1', number: 'item-0901' });
    expect(collectionMemberIds(registry, waffen, welt(stueck))).not.toContain('dolch-1');
  });
  it('liest Feldbedingungen wie das Kompendium: Wert oder Spanne', () => {
    const teuer = art('teuer', 'Collection', 'Pricey', { components: { Collection: { types: ['Item'], fields: ['Item.copperPrice:150..'] } } });
    expect(collectionMemberIds(registry, teuer, welt())).toEqual(['dolch', 'schwert']);
  });
});

describe('shopWares mit sells auf eine Collection (REQ-439)', () => {
  const laden = (rel: Entity['relations']) => art('laden', 'Shop', 'Forge', { relations: rel });
  it('bietet die Mitglieder einer Collection an, mit der Collection als Herkunft', () => {
    const w = shopWares(laden([{ id: 's1', type: 'sells', to: 'einfach', props: { mod: '-10%' } }]), { entities: welt(), registry });
    expect(w.map((x) => [x.item, x.edge, x.via, x.price])).toEqual([
      ['keule', 's1', 'einfach', 9],
      ['dolch', 's1', 'einfach', 180],
    ]);
    expect(w[0]!.steps[0]).toMatchObject({ by: 'collection', giver: 'einfach', mod: '-10%' });
    /* Eine Menge an einer Collection-Kante gälte für alle zusammen — das wäre keine. */
    expect(w.every((x) => x.qty === undefined)).toBe(true);
  });
  it('eine einzelne Kante schlägt die Collection, gleich wo sie steht', () => {
    const w = shopWares(
      laden([
        { id: 's1', type: 'sells', to: 'waffen' },
        { id: 's2', type: 'sells', to: 'dolch', props: { qty: 2, price: 150 } },
      ]),
      { entities: welt(), registry },
    );
    expect(w.map((x) => [x.item, x.edge, x.price])).toEqual([
      ['keule', 's1', 10],
      ['schwert', 's1', 1500],
      ['dolch', 's2', 150],
    ]);
  });
  it('zwei Collections mit demselben Mitglied: die erste Kante gilt', () => {
    const w = shopWares(
      laden([
        { id: 's1', type: 'sells', to: 'einfach', props: { mod: '-10%' } },
        { id: 's2', type: 'sells', to: 'waffen' },
      ]),
      { entities: welt(), registry },
    );
    expect(w.map((x) => [x.item, x.edge])).toEqual([
      ['keule', 's1'],
      ['dolch', 's1'],
      ['schwert', 's2'],
    ]);
  });
  it('nicht verfügbar an der Collection-Kante: kein Mitglied ist zu haben', () => {
    const w = shopWares(laden([{ id: 's1', type: 'sells', to: 'einfach', props: { available: false } }]), { entities: welt(), registry });
    expect(w.every((x) => !x.available)).toBe(true);
  });
  it('bestehende sells-Kanten auf Gegenstände bleiben, wie sie waren', () => {
    const w = shopWares(laden([{ id: 's1', type: 'sells', to: 'seil', props: { qty: 3 } }]), { entities: welt() });
    expect(w).toEqual([{ edge: 's1', item: 'seil', name: 'Rope', qty: 3, available: true, list: 100, base: 100, price: 100, steps: [] }]);
  });
});

describe('buybackFor: was ein Laden für ein Stück zahlt (E-175 a)', () => {
  it('ohne buys-Kante kauft er alles zum Ankaufssatz, leer 50 %', () => {
    expect(buybackFor(art('l', 'Shop', 'L'), schwert, welt(), registry)).toEqual({ unit: 750, rate: 50, from: 'shop', steps: [] });
    const satz = art('l', 'Shop', 'L', { components: { Shop: { buyRate: 30 } } });
    expect(buybackFor(satz, schwert, welt(), registry)).toMatchObject({ unit: 450, rate: 30, from: 'shop' });
  });
  it('mit buys-Kanten kauft er nur das Genannte, zu dessen Satz', () => {
    const l = art('l', 'Shop', 'Forge', {
      components: { Shop: { buyRate: 20 } },
      relations: [{ id: 'b1', type: 'buys', to: 'waffen', props: { rate: 40 } }],
    });
    expect(buybackFor(l, schwert, welt(), registry)).toEqual({ unit: 600, rate: 40, from: 'collection', via: 'waffen', steps: [] });
    expect(buybackFor(l, seil, welt(), registry)).toEqual({ refused: 'notBought' });
  });
  it('eine Kante auf den Gegenstand schlägt die Collection; ohne Satz gilt der des Ladens', () => {
    const l = art('l', 'Shop', 'Forge', {
      components: { Shop: { buyRate: 20 } },
      relations: [
        { id: 'b1', type: 'buys', to: 'waffen', props: { rate: 40 } },
        { id: 'b2', type: 'buys', to: 'schwert', props: { mod: '+1 gp' } },
      ],
    });
    expect(buybackFor(l, schwert, welt(), registry)).toEqual({
      unit: 400,
      rate: 20,
      from: 'edge',
      via: 'schwert',
      steps: [{ by: 'ware', mod: '+1 gp', delta: 100 }],
    });
  });
  it('ein Stück zählt mit seinem Grundartikel', () => {
    const stueck = newInstance(schwert, { id: 'schwert-1', number: 'item-0902' });
    const l = art('l', 'Shop', 'Forge', { relations: [{ id: 'b1', type: 'buys', to: 'waffen', props: { rate: 40 } }] });
    expect(buybackFor(l, stueck, welt(stueck), registry)).toMatchObject({ unit: 600, from: 'collection' });
  });
  it('ohne Preis gibt es keinen Ankauf', () => {
    expect(buybackFor(art('l', 'Shop', 'L'), art('x', 'Item', 'Pebble'), welt(), registry)).toEqual({ refused: 'noPrice' });
  });
});

describe('sellPiece nach buys (E-175 a)', () => {
  const inventar = art('inv', 'Inventory', 'Pack', {
    components: { Inventory: { copper: 0 } },
    relations: [
      { id: 'h1', type: 'holds', to: 'schwert', props: { qty: 1 } },
      { id: 'h2', type: 'holds', to: 'seil', props: { qty: 1 } },
    ],
  });
  const l = art('l', 'Shop', 'Forge', { relations: [{ id: 'b1', type: 'buys', to: 'waffen', props: { rate: 40 } }] });
  it('zahlt den Satz der Collection', () => {
    const r = sellPiece(l, inventar, 'h1', 1, welt(), registry);
    expect(r).toMatchObject({ unit: 600, total: 600, rate: 40, from: 'collection', via: 'waffen' });
  });
  it('lehnt ab, was der Laden nicht ankauft', () => {
    expect(sellPiece(l, inventar, 'h2', 1, welt(), registry)).toEqual({ refused: 'notBought' });
  });
});

describe('Materialgruppe liest inCollection (REQ-438)', () => {
  const ctx = { rarities: [], substitutions: [] };
  const gruppe = art('mg', 'MaterialGroup', 'Metals', { components: { MaterialGroup: { materialTypes: ['metal'] } } });
  it('ein Stück mit inCollection auf die Gruppe passt, auch ohne Materialart', () => {
    const drin = { ...seil, relations: [{ id: 'i', type: 'inCollection', to: 'mg' }] };
    expect(materialFit(gruppe, drin, ctx, true)).toEqual({ ok: true, ratio: 1 });
    expect(materialFit(gruppe, seil, ctx, true).ok).toBe(false);
  });
  it('exclude nimmt ein Stück aus, das die Regel träfe', () => {
    const eisen = art('eisen', 'Item', 'Iron', { components: { Material: { materialType: 'metal' } } });
    expect(materialFit(gruppe, eisen, ctx, true).ok).toBe(true);
    const raus = { ...eisen, relations: [{ id: 'i', type: 'inCollection', to: 'mg', props: { exclude: true } }] };
    expect(materialFit(gruppe, raus, ctx, true)).toMatchObject({ ok: false });
  });
});
