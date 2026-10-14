import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EQUIPMENT_METHODS,
  allowedEquipmentMethods,
  answerChoice,
  builderSteps,
  checkPurchase,
  equipmentFromText,
  equipmentMethodOf,
  fixedEquipmentLines,
  formatCopper,
  plainEquipmentText,
  resolveEquipment,
  rollGold,
  setPick,
  startingBundle,
  startingGoldOf,
  type Entity,
  type EquipmentMethod,
} from '../src/index.js';

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});

/* Wie der Importer vor T-096 schrieb: Varianten als Text mit Verweisen,
   das Feste nur im Text von `startingEquipment`, das Startgold im Satz. */
const kaempfer = art('class-1', 'Class', {
  Class: {
    startingEquipment:
      '- (a) [[item-1|chain mail]] or (b) [[item-2|leather armor]]\n- an [[item-3|explorer\'s pack]], and [[item-4|four javelins]]\n\nAlternatively, {{5d4 × 10}} gp to buy your own equipment.',
  },
  Choices: {
    choices: [
      { id: 'equipment', kind: 'equipment', when: 'start', from: { options: [{ key: 'a', label: '[[item-1|chain mail]]' }, { key: 'b', label: '[[item-2|leather armor]], [[item-5|arrow]] (20)' }] } },
    ],
  },
});
/* Wie er jetzt schreibt: das Feste als Wahl mit einer Möglichkeit, mit Stücken. */
const weise = art('background-1', 'Background', {
  Background: { startingEquipment: '- [[item-6|ink]]\n- (a) [[item-7|book]] or (b) 15 gp' },
  Choices: {
    choices: [
      { id: 'equipment', kind: 'equipment', from: { options: [{ key: 'a', label: 'ink, a pouch', items: [{ id: 'item-6', qty: 1 }], gold: 10 }] } },
      { id: 'equipment-2', kind: 'equipment', from: { options: [{ key: 'a', label: '[[item-7|book]]' }, { key: 'b', label: '15 gp' }] } },
    ],
  },
});
const bestand = new Map([kaempfer, weise].map((e) => [e.id, e]));

const gegenstand = (id: string, item: Record<string, unknown>) => art(id, 'Item', { Item: item });
const laden = new Map(
  [
    gegenstand('rope', { itemType: 'adventuring gear', rarity: 'none', copperPrice: 100 }),
    gegenstand('sword', { itemType: 'melee weapon', rarity: 'none', copperPrice: 1500 }),
    gegenstand('potion', { itemType: 'potion', rarity: 'common', copperPrice: 5000 }),
    gegenstand('cloak', { itemType: 'wondrous item', rarity: 'uncommon' }),
    gegenstand('trinket', { itemType: 'other', rarity: 'none' }),
  ].map((e) => [e.id, e]),
);

describe('Startausrüstung (T-096, REQ-250)', () => {
  it('liest Verfahren aus Artikeln; ohne Kante gilt die Vorgabe', () => {
    const frei = art('m-1', 'EquipmentMethod', { EquipmentMethod: { method: 'free', budget: 200, magic: { Uncommon: 1 }, itemTypes: ['potion'] } });
    expect(equipmentMethodOf(frei)).toEqual({ id: 'm-1', name: 'm-1', method: 'free', budget: 200, magic: { uncommon: 1 }, itemTypes: ['potion'] });
    expect(equipmentMethodOf(art('x', 'EquipmentMethod', { EquipmentMethod: { method: 'wish' } }))).toBeUndefined();
    const kampagne = art('c', 'Campaign', {}, [{ id: 'r', type: 'allowsEquipment', to: 'm-1' }]);
    expect(allowedEquipmentMethods(kampagne, new Map([['m-1', frei]])).map((m) => m.id)).toEqual(['m-1']);
    expect(allowedEquipmentMethods(art('c2', 'Campaign'), new Map()).map((m) => m.id)).toEqual(DEFAULT_EQUIPMENT_METHODS.map((m) => m.id));
  });

  it('liest Stücke, Mengen und Geld aus dem Text, wie der Importer ihn schreibt', () => {
    expect(equipmentFromText('[[item-2|leather armor]], [[item-5|arrow]] (20), a [[item-8|pouch]] containing 15 gp, one simple weapon of your choice')).toEqual({
      items: [{ id: 'item-2', qty: 1 }, { id: 'item-5', qty: 20 }, { id: 'item-8', qty: 1 }],
      copper: 1500,
      rest: ['one simple weapon of your choice'],
    });
    expect(equipmentFromText('an [[item-3|explorer\'s pack]], and [[item-4|four javelins]]').items).toEqual([
      { id: 'item-3', qty: 1 },
      { id: 'item-4', qty: 4 },
    ]);
    expect(plainEquipmentText('[[item-5|arrow]] (20)')).toBe('arrow (20)');
  });

  it('nach Regeln: das Feste und die gewählten Varianten von Klasse und Hintergrund', () => {
    let d = setPick(art('draft', 'PlayerCharacter'), 'hasClass', 'class-1');
    d = setPick(d, 'hasBackground', 'background-1');
    const schritt = builderSteps(d, bestand).find((s) => s.kind === 'equipment');
    if (schritt?.kind !== 'equipment') throw new Error('kein Schritt');
    /* Die Wahl mit einer Möglichkeit fragt niemanden. */
    expect(schritt.choices.map((c) => `${c.source.entity.id}#${c.choice.id}`)).toEqual(['class-1#equipment', 'background-1#equipment-2']);
    d = answerChoice(d, schritt.choices[0]!, ['b']);
    d = answerChoice(d, schritt.choices[1]!, ['b']);
    expect(startingBundle(d, bestand)).toEqual({
      items: [
        { id: 'item-3', qty: 1 },
        { id: 'item-4', qty: 4 },
        { id: 'item-2', qty: 1 },
        { id: 'item-5', qty: 20 },
        { id: 'item-6', qty: 1 },
      ],
      copper: 2500,
      rest: [],
    });
  });

  it('eine zweite Klasse bringt keine Ausrüstung', () => {
    const d = setPick(setPick(art('draft', 'PlayerCharacter'), 'hasBackground', 'background-1'), 'hasClass', 'class-x');
    const mit = { ...d, relations: [...(d.relations ?? []), { id: 'k2', type: 'hasClass', to: 'class-1', props: { level: 1 } }] };
    expect(startingBundle(mit, bestand).items.map((i) => i.id)).toEqual(['item-6']);
  });

  it('Startgold: aus dem Feld, sonst aus dem Text; gewürfelt mit Faktor', () => {
    expect(startingGoldOf(kaempfer)).toBe('5d4 × 10');
    expect(startingGoldOf(art('k', 'Class', { Class: { startingGold: '2d4×10' } }))).toBe('2d4×10');
    const vier = () => 0.99;
    expect(rollGold('5d4 × 10', vier)).toEqual({ gp: 200, roll: '20 (4, 4, 4, 4, 4) × 10' });
    expect(rollGold('150')).toEqual({ gp: 150, roll: '' });
    expect(rollGold('ein Sack')).toBeNull();
  });

  it('prüft den Einkauf: Preis, Budget, Arten, magische Gegenstände je Seltenheit', () => {
    const gold: EquipmentMethod = { id: 'g', name: 'g', method: 'gold' };
    expect(checkPurchase([{ id: 'rope', qty: 2 }, { id: 'potion', qty: 1 }], laden, gold, 10000)).toMatchObject({ problem: null, spent: 5200 });
    expect(checkPurchase([{ id: 'sword', qty: 1 }], laden, gold, 1000).problem).toBe('That costs 15 gp of 10 gp.');
    expect(checkPurchase([{ id: 'trinket', qty: 1 }], laden, gold, 1000).problem).toBe('trinket has no price.');
    expect(checkPurchase([{ id: 'cloak', qty: 1 }], laden, gold, 1000).problem).toBe('cloak has no price.');
    expect(checkPurchase([{ id: 'rope', qty: 0 }], laden, gold).problem).toMatch(/whole number/);
    expect(checkPurchase([{ id: 'nope', qty: 1 }], laden, gold).problem).toMatch(/Not an item/);

    const frei: EquipmentMethod = { id: 'f', name: 'f', method: 'free', magic: { uncommon: 1 }, itemTypes: ['wondrous item', 'adventuring gear'] };
    expect(checkPurchase([{ id: 'cloak', qty: 1 }, { id: 'rope', qty: 1 }], laden, frei)).toEqual({ problem: null, spent: 100, magic: { uncommon: 1 } });
    expect(checkPurchase([{ id: 'cloak', qty: 2 }], laden, frei).problem).toBe('At most 1 uncommon magic item.');
    expect(checkPurchase([{ id: 'sword', qty: 1 }], laden, frei).problem).toBe('sword: melee weapon is not allowed here.');
    expect(checkPurchase([{ id: 'potion', qty: 1 }], laden, { ...frei, itemTypes: undefined }).problem).toBe('No common magic items here.');
    expect(checkPurchase([{ id: 'rope', qty: 1 }], laden, { id: 'r', name: 'r', method: 'rules' }).problem).toBe('This method buys nothing.');
  });

  it('nennt Kupfer als Münzen', () => {
    expect(formatCopper(1234)).toBe('12 gp 3 sp 4 cp');
    expect(formatCopper(0)).toBe('0 gp');
  });
});

describe('Verweise der Startausrüstung', () => {
  it('löst Nummern zu Peg-Ids auf und nennt, was fehlt', () => {
    const seil = { id: 'e_1', interfaces: ['Item'], components: { Identity: { id: 'item-0001' } } } as Entity;
    expect(resolveEquipment({ items: [{ id: 'item-0001', qty: 2 }, { id: 'e_1', qty: 1 }, { id: 'item-9' , qty: 1 }], copper: 5, rest: [] }, [seil])).toEqual({
      items: [{ id: 'e_1', qty: 3 }],
      copper: 5,
      rest: [],
      missing: ['item-9'],
    });
  });
});

describe('was ohne Wahl dazukommt', () => {
  it('nennt das Feste als Satz, aus der Wahl oder aus dem Text', () => {
    const d = setPick(setPick(art('draft', 'PlayerCharacter'), 'hasClass', 'class-1'), 'hasBackground', 'background-1');
    expect(fixedEquipmentLines(d, bestand)).toEqual([
      { source: 'class-1', text: "an explorer's pack, and four javelins" },
      { source: 'background-1', text: 'ink, a pouch' },
    ]);
  });
});
