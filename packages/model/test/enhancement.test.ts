import { describe, expect, it } from 'vitest';
import {
  buybackPrice,
  enhanceItem,
  enhancementFits,
  enhancementRefusal,
  entityName,
  featureMechanics,
  isEnhancement,
  itemFeaturesOf,
  followsTemplate,
  itemPricingOf,
  newInstance,
  pieceName,
  thinInstance,
  withEnhancement,
  readInstance,
} from '../src/index.js';
import type { Entity } from '../src/types.js';

/* Das Rechenbeispiel aus „How it works" (T-300): ein Dolch (2 gp), daran
   „+1 Weapon" (1,000 gp als Aufpreis) und „Silvered" (+100 gp). */
const dolch: Entity = {
  id: 'dagger',
  name: 'Dagger',
  interfaces: ['Weapon'],
  components: {
    Identity: { name: 'Dagger', id: 'weapon-0001' },
    Item: { itemType: 'melee weapon', rarity: 'none', copperPrice: 200 },
    Weapon: { category: 'simple', damage: '1d4' },
    Tags: { tags: ['dagger'] },
  },
  relations: [],
};
const plus1: Entity = {
  id: 'plus1',
  name: '+1 Weapon',
  interfaces: ['Item'],
  components: {
    Identity: { name: '+1 Weapon', id: 'item-0001' },
    Item: { appliesTo: ['weapon'], namePrefix: '+1 ', rarity: 'uncommon', bonusWeapon: 1, priceAdd: 100000 },
  },
  relations: [],
};
const versilbert: Entity = {
  id: 'silvered',
  name: 'Silvered Weapon',
  interfaces: ['Item'],
  components: {
    Identity: { name: 'Silvered Weapon', id: 'item-0002' },
    Item: { appliesTo: ['weapon'], namePrefix: 'Silvered ', priceAdd: 10000 },
  },
  relations: [],
};
const ruestung: Entity = {
  id: 'adamantine',
  name: 'Adamantine Armor',
  interfaces: ['Item'],
  components: {
    Identity: { name: 'Adamantine Armor', id: 'item-0003' },
    Item: { appliesTo: ['armor'], nameSuffix: ' (adamantine)', rarity: 'uncommon' },
  },
  relations: [],
};

function stueck(...props: string[]): Entity {
  const s = newInstance(dolch, { id: 'p1', number: 'weapon-0002' });
  s.relations = [...(s.relations ?? []), ...props.map((p) => ({ id: `p1~${p}`, type: 'enchantedWith', to: p, props: {} }))];
  return s;
}

const bestand = (...mehr: Entity[]) => new Map([dolch, plus1, versilbert, ruestung, ...mehr].map((e) => [e.id, e]));

describe('Enhancements (T-300, E-107)', () => {
  it('rechnet Dolch + +1 + versilbert: Name, Preis, Seltenheit, Bonus', () => {
    const s = stueck('plus1', 'silvered');
    const e = enhanceItem(bestand(s), s)!;
    expect(e.name).toBe('+1 Silvered Dagger');
    expect(e.price).toBe(200 + 100000 + 10000);
    expect(e.priceNote).toContain('Dagger 2 gp');
    expect(e.rarity).toBe('uncommon');
    expect(e.bonusWeapon).toBe(1);
    expect(e.properties.map((p) => p.fits)).toEqual([true, true]);
  });

  it('folgt der Preisregel der Kampagne', () => {
    const s = stueck('plus1', 'silvered');
    expect(enhanceItem(bestand(s), s, 'base')!.price).toBe(200);
    expect(enhanceItem(bestand(s), s, 'none')!.price).toBeUndefined();
    expect(itemPricingOf({ id: 'c', interfaces: ['Campaign'], components: { Campaign: { itemPricing: 'base' } }, relations: [] })).toBe('base');
    expect(itemPricingOf(null)).toBe('combined');
  });

  it('rechnet einen Faktor vor den Beträgen', () => {
    const doppelt: Entity = { ...versilbert, id: 'x2', components: { Item: { appliesTo: ['weapon'], priceMult: 2, priceAdd: 50 } } };
    const s = stueck('x2');
    expect(enhanceItem(bestand(s, doppelt), s)!.price).toBe(200 * 2 + 50);
  });

  it('ohne Aufpreis kein Preis — ein +1-Dolch zum Dolchpreis wäre falsch', () => {
    const s = stueck('adamantine');
    const e = enhanceItem(bestand(s), s)!;
    expect(e.price).toBeUndefined();
    expect(e.priceNote).toContain('no surcharge');
    expect(e.properties[0]!.fits).toBe(false);
  });

  it('nimmt einen eigenen Namen des Stücks', () => {
    const s = stueck('plus1');
    s.components!['Identity'] = { ...s.components!['Identity'], name: 'Sting' };
    expect(enhanceItem(bestand(s), s)!.name).toBe('Sting');
  });

  it('prüft gegen appliesTo und nur an einem Stück', () => {
    const s = stueck();
    expect(enhancementRefusal(bestand(s), s, 'plus1')).toBeNull();
    expect(enhancementRefusal(bestand(s), s, 'adamantine')).toMatch(/applies to armor/);
    expect(enhancementRefusal(bestand(s), dolch, 'plus1')).toMatch(/only a piece/);
    expect(enhancementRefusal(bestand(s), s, 'dagger')).toMatch(/not an enhancement/);
    expect(enhancementFits({ ...plus1, components: { Item: { appliesTo: ['weaponCategory:martial'] } } }, dolch)).toBe(false);
    expect(enhancementFits({ ...plus1, components: { Item: { appliesTo: ['dmgType:slashing'] } } }, dolch)).toBe(true);
  });

  it('wird nie gespeichert: das Stück trägt nur die Kante', () => {
    const s = stueck('plus1');
    const m = bestand(s);
    const aus = withEnhancement(m, readInstance(m, s), s, 'combined');
    expect(entityName(aus)).toBe('+1 Dagger');
    expect(pieceName(m, s)).toBe('+1 Dagger');
    const zurueck = thinInstance(m, aus);
    expect(zurueck.components?.['Item']).toBeUndefined();
    expect(zurueck.relations?.some((r) => r.type === 'enchantedWith')).toBe(true);
    /* Ein +1-Dolch ist kein beliebiger Dolch: er stapelt nicht mit anderen. */
    expect(followsTemplate(m, s)).toBe(false);
  });

  it('der Laden kauft zum gerechneten Preis an', () => {
    const s = stueck('plus1', 'silvered');
    expect(buybackPrice(s, bestand(s))).toBe(Math.floor(110200 / 2));
  });
});

/* T-324, E-163: das Enhancement ist ein Regelartikel mit eigenen Karten. */
describe('Gegenstandsmerkmale (T-324, E-163)', () => {
  const regel: Entity = {
    id: 'plus2',
    name: '+2 Weapon',
    interfaces: ['Enhancement'],
    components: {
      Identity: { name: '+2 Weapon', id: 'item-0004' },
      ItemFeature: { appliesTo: ['weapon'], namePrefix: '+2 ', priceAdd: 400000 },
      Enhancement: { rarity: 'rare', bonusWeapon: 2 },
    },
    relations: [],
  };
  const versilbertNeu: Entity = {
    id: 'silv2',
    name: 'Silvered',
    interfaces: ['Enhancement'],
    components: { Identity: { name: 'Silvered' }, ItemFeature: { appliesTo: ['weapon'], namePrefix: 'Silvered ', priceAdd: 10000 } },
    relations: [],
  };

  it('rechnet aus ItemFeature und Enhancement wie vorher aus Item', () => {
    const s = stueck('plus2', 'silv2');
    const e = enhanceItem(bestand(s, regel, versilbertNeu), s)!;
    expect(e.name).toBe('+2 Silvered Dagger');
    expect(e.price).toBe(200 + 400000 + 10000);
    expect(e.rarity).toBe('rare');
    expect(e.bonusWeapon).toBe(2);
  });

  it('erkennt ein Enhancement an seiner Art, auch ohne eigene Enhancement-Karte', () => {
    expect(isEnhancement(versilbertNeu)).toBe(true);
    expect(isEnhancement(plus1)).toBe(true); // noch als Gegenstand (vor Migration 162)
    expect(isEnhancement(dolch)).toBe(false);
    const s = stueck();
    expect(enhancementRefusal(bestand(s, versilbertNeu), s, 'silv2')).toBeNull();
  });

  it('ein Enhancement ohne Aufpreis hat keinen Preis — sein Name ist kein Preis', () => {
    const ohne: Entity = { ...versilbertNeu, id: 'ohne', components: { Identity: { name: 'Plain' }, ItemFeature: { appliesTo: ['weapon'] } } };
    const s = stueck('ohne');
    expect(enhanceItem(bestand(s, ohne), s)!.price).toBeUndefined();
  });

  it('liest die Wirkung einer Eigenschaft aus ihren Daten, nicht aus ihrem Namen', () => {
    const lang: Entity = { id: 'lg', name: 'Long Grip', interfaces: ['ItemProperty'], components: { ItemFeature: { mechanics: ['two-handed'] } }, relations: [] };
    const namensgleich: Entity = { id: 'v', name: 'Versatile', interfaces: ['ItemProperty'], components: {}, relations: [] };
    expect(featureMechanics(lang)).toEqual(['two-handed']);
    expect(featureMechanics(namensgleich)).toEqual([]);
    const vielseitig: Entity = { id: 'vs', name: 'Vielseitig', interfaces: ['ItemProperty'], components: { ItemFeature: { mechanics: ['versatile'] } }, relations: [] };
    const schwert: Entity = {
      id: 'ls', name: 'Longsword', interfaces: ['Weapon'], components: {},
      relations: [
        { id: 'ls~1', type: 'hasProperty', to: 'vs', props: { damage: '1d10' } },
        { id: 'ls~2', type: 'hasProperty', to: 'lg', props: {} },
      ],
    };
    const m = new Map([lang, namensgleich, vielseitig].map((e) => [e.id, e]));
    expect(itemFeaturesOf(schwert, (id) => m.get(id))).toEqual({ mechanics: ['versatile', 'two-handed'], versatileDamage: '1d10' });
  });
});
