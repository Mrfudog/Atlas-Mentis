/* T-162: Wahlen benennen, offene Stellen füllen, Werkzeugwahl aus ihrer Sorte.
   Erfundene Minimalbeispiele — keine Inhalte aus 5e.tools. */
import { describe, expect, it } from 'vitest';
import {
  answerChoice,
  builderSteps,
  choiceLabel,
  choiceText,
  choiceTitle,
  choicesAtCharacter,
  choicesOf,
  itemSlotIn,
  optionSlots,
  setPick,
  slotAccepts,
  slotQuery,
  startingBundle,
  type Entity,
} from '../src/index.js';

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: '', components, relations,
});

/* Wie eingelesen: `name` leer, der Name in `Identity`. */
const klasse = art('class-1', 'Class', {
  Identity: { name: 'Mistwarden' },
  Choices: {
    choices: [
      { id: 'skills', kind: 'proficiency', when: 'start', count: 2, from: { values: ['Stealth', 'Lore', 'Survival'] } },
      {
        id: 'equipment',
        kind: 'equipment',
        when: 'start',
        from: {
          options: [
            { key: 'a', label: '[[weapon-0001|fogblade]]', items: [{ id: 'weapon-0001', qty: 1 }] },
            { key: 'b', label: 'two weapon martial melee of your choice' },
          ],
        },
      },
      { id: 'warden-style', kind: 'feature', note: 'Warden Style', from: { interfaces: ['Feature'] } },
    ],
  },
});
const herkunft = art('background-1', 'Background', {
  Identity: { name: 'Lamplighter' },
  Choices: {
    choices: [
      { id: 'tools', kind: 'proficiency', count: 1, from: { enumRef: ['Item'] }, note: '1 any artisans tool tool of your choice' },
      { id: 'other-proficiencies', kind: 'proficiency', note: 'three [[item-0009|musical instruments]] of your choice' },
    ],
  },
});
const waffe = (id: string, category: string, itemType: string, rarity = 'none') =>
  art(id, 'Weapon', { Identity: { name: id }, Item: { itemType, rarity }, Weapon: { category } });
const bestand = new Map(
  [
    klasse,
    herkunft,
    waffe('w-axe', 'martial', 'melee weapon'),
    waffe('w-bow', 'martial', 'ranged weapon'),
    waffe('w-club', 'simple', 'melee weapon'),
    waffe('w-magic', 'martial', 'melee weapon', 'rare'),
  ].map((e) => [e.id, e]),
);

const entwurf = (): Entity =>
  setPick(setPick({ id: 'pc', interfaces: ['PlayerCharacter'], name: '', components: {}, relations: [] }, 'hasClass', 'class-1'), 'hasBackground', 'background-1');

describe('Wahlen benennen (T-162)', () => {
  it('nennt Quelle und Wahl statt „: equipment"', () => {
    const titel = choicesAtCharacter(entwurf(), bestand).map(choiceTitle);
    expect(titel).toEqual([
      'Mistwarden · Skill proficiencies (choose 2)',
      'Mistwarden · Starting equipment',
      'Mistwarden · Warden Style',
      'Lamplighter · Tool proficiencies',
      'Lamplighter · Tool proficiencies (choose 3)',
    ]);
  });

  it('ein langer Satz ist kein Name, eine Sorte schon', () => {
    expect(choiceLabel({ id: 'languages', kind: 'proficiency', count: 2, note: '2 any standard languages of your choice' })).toBe('Languages (choose 2)');
    expect(choiceLabel({ id: 'spells', kind: 'spell', count: 2 })).toBe('Spells (choose 2)');
    expect(choiceLabel({ id: 'martial-path', kind: 'subclass' })).toBe('Martial path');
    expect(choiceLabel({ id: 'multiclass-skills', kind: 'proficiency', when: 'multiclass' })).toBe('Skill proficiencies (multiclass)');
  });
});

describe('Offene Stellen (T-162)', () => {
  it('liest beide Wortstellungen und die Zahl', () => {
    expect(itemSlotIn('two weapon martial melee of your choice')).toMatchObject({ count: 2, type: 'Weapon', category: 'martial', itemTypes: ['melee weapon'] });
    expect(itemSlotIn('a simple weapon')).toMatchObject({ count: 1, type: 'Weapon', category: 'simple' });
    expect(itemSlotIn("any two simple weapons")).toMatchObject({ count: 2, category: 'simple' });
    expect(itemSlotIn("an artisan's tools")).toMatchObject({ count: 1, type: 'Item', itemTypes: ['artisan tools'] });
    expect(itemSlotIn('one instrument musical of your choice')?.itemTypes).toEqual(['instrument']);
    expect(itemSlotIn("one type of [[item-1|artisan's tools]] or one [[item-2|musical instrument]]")?.itemTypes).toEqual(['artisan tools', 'instrument']);
    expect(itemSlotIn('set of weighted dice')).toBeUndefined();
  });

  it('prüft Art, Kategorie, Reichweite und Seltenheit', () => {
    const s = itemSlotIn('a martial melee weapon')!;
    expect(['w-axe', 'w-bow', 'w-club', 'w-magic'].filter((id) => slotAccepts(s, bestand.get(id)))).toEqual(['w-axe']);
    expect(slotQuery(s)).toEqual({ type: 'Weapon', f: ['Weapon.category:martial'] });
  });

  it('füllt die Stellen aus der Antwort und prüft sie', () => {
    const d0 = entwurf();
    const wahl = choicesAtCharacter(d0, bestand).find((c) => c.choice.id === 'equipment')!;
    expect(optionSlots(wahl.choice.from!.options![1]!)).toHaveLength(1);
    /* Die Keule ist keine Kriegswaffe: sie kommt nicht ins Paket. */
    const d = answerChoice(d0, wahl, ['b'], ['w-axe', 'w-club']);
    expect(d.relations?.find((r) => r.type === 'chose')?.props?.['items']).toEqual(['w-axe', 'w-club']);
    const paket = startingBundle(d, bestand);
    expect(paket.items).toEqual([{ id: 'w-axe', qty: 1 }]);
    const voll = startingBundle(answerChoice(d0, wahl, ['b'], ['w-axe', 'w-axe']), bestand);
    expect(voll.items).toEqual([{ id: 'w-axe', qty: 2 }]);
    expect(voll.rest).toEqual([]);
  });
});

describe('Werkzeugwahl aus ihrer Sorte (T-162)', () => {
  it('zieht aus den Gegenständen der Sorte, mit der Zahl aus dem Satz', () => {
    const [tools, andere] = choicesOf(herkunft);
    expect(tools?.from).toEqual({ enumRef: ['Item'], where: { component: 'Item', property: 'itemType', value: ['artisan tools'] } });
    expect(andere?.from?.where?.value).toEqual(['instrument']);
    expect(andere?.count).toBe(3);
    expect(choiceText(andere!)).toBe('three [[item-0009|musical instruments]] of your choice');
  });
});

describe('Aufstieg ohne Startausrüstung (T-162)', () => {
  it('fragt eine offene Ausrüstungswahl nicht als Schritt', () => {
    const ids = builderSteps(entwurf(), bestand, { levelUp: true }).map((s) => s.id);
    expect(ids.some((i) => i.includes('#equipment'))).toBe(false);
  });
});
