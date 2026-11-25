import { describe, expect, it } from 'vitest';
import {
  choiceId,
  choiceText,
  choicesAtCharacter,
  chosenResult,
  fixedPicks,
  orphanAnswers,
  pendingChoices,
  type Choice,
  type Entity,
} from '../src/index.js';

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});

const fighter = art('class-1', 'Class', {
  Choices: {
    choices: [
      { id: 'skills', kind: 'proficiency', count: 2, from: { values: ['Athletics', 'Perception', 'Survival'] } },
      { id: 'equipment', kind: 'equipment', from: { options: [{ key: 'a', label: 'Chain mail' }, { key: 'b', label: 'Leather armor, longbow' }] } },
      { id: 'martial-archetype', kind: 'subclass', level: 3, from: { interfaces: ['Subclass'], edge: { type: 'subclassOf', to: 'class-1' } } },
    ],
  },
});
const elf = art('ancestry-1', 'Ancestry', {
  Ancestry: { abilityBonus: { dex: 2 } },
  Choices: { choices: [{ id: 'ability', kind: 'ability', count: 1, bonus: [1], from: { values: ['int', 'wis'] } }] },
});
const sage = art('background-1', 'Background', {
  Choices: { choices: [{ id: 'origin-feat', kind: 'feat', from: { interfaces: ['Feat'], tags: ['origin'] } }] },
});
const resilient = art('feat-1', 'Feat', {
  Choices: { choices: [{ id: 'ability', kind: 'ability', count: 1, bonus: [1], from: { values: ['con'] } }] },
});

const held = (stufe: number, antworten: [string, string, string[]][]): Entity =>
  art('pc-1', 'PlayerCharacter', {}, [
    { id: 'r1', type: 'hasClass', to: 'class-1', props: { level: stufe } },
    { id: 'r2', type: 'hasAncestry', to: 'ancestry-1' },
    { id: 'r3', type: 'hasBackground', to: 'background-1' },
    ...antworten.map(([to, choice, picks], i) => ({ id: `a${i}`, type: 'chose', to, props: { choice, picks } })),
  ]);

const bestand = new Map([fighter, elf, sage, resilient].map((e) => [e.id, e]));

describe('choices as a field (REQ-238, E-015 a)', () => {
  it('lists what is still to choose, up to the class level', () => {
    const offen = pendingChoices(held(1, []), bestand).map((c) => `${c.source.entity.id}#${c.choice.id}`);
    expect(offen).toEqual(['class-1#skills', 'class-1#equipment', 'ancestry-1#ability', 'background-1#origin-feat']);
    expect(pendingChoices(held(3, []), bestand).map((c) => c.choice.id)).toContain('martial-archetype');
  });

  it('follows a chosen feat to its own choice, and answers a choice without leeway itself', () => {
    const pc = held(1, [['background-1', 'origin-feat', ['feat-1']]]);
    const feat = choicesAtCharacter(pc, bestand).find((c) => c.source.entity.id === 'feat-1');
    expect(feat).toMatchObject({ picks: ['con'], fixed: true, source: { via: 'chose' } });
  });

  it('computes proficiencies, ability bonuses and articles on read (D8)', () => {
    const pc = held(1, [
      ['class-1', 'skills', ['Athletics', 'Survival']],
      ['class-1', 'equipment', ['b']],
      ['ancestry-1', 'ability', ['int']],
      ['background-1', 'origin-feat', ['feat-1']],
    ]);
    const r = chosenResult(pc, bestand);
    expect(r.proficiencies).toEqual(['Athletics', 'Survival']);
    expect(r.abilityBonus).toEqual({ dex: 2, int: 1, con: 1 });
    expect(r.articles).toEqual([{ kind: 'feat', id: 'feat-1', source: 'background-1' }]);
    expect(r.equipment).toEqual([{ source: 'class-1', choice: 'equipment', key: 'b', label: 'Leather armor, longbow' }]);
    expect(pendingChoices(pc, bestand)).toEqual([]);
  });

  /* Ändert die Leitung den Artikel, ändert sich die Figur mit — und eine
     Antwort auf eine Wahl, die es nicht mehr gibt, ist verwaist. */
  it('follows a change to the article and keeps orphaned answers visible', () => {
    const pc = held(1, [['ancestry-1', 'ability', ['wis']], ['ancestry-1', 'old-choice', ['x']]]);
    const staerker = new Map(bestand);
    staerker.set('ancestry-1', {
      ...elf,
      components: { ...elf.components, Choices: { choices: [{ id: 'ability', kind: 'ability', count: 1, bonus: [2], from: { values: ['int', 'wis'] } }] } },
    });
    expect(chosenResult(pc, staerker).abilityBonus).toEqual({ dex: 2, wis: 2 });
    expect(orphanAnswers(pc, staerker).map((a) => a.choice)).toEqual(['old-choice']);
  });

  /* Die Startwahl einer Klasse gilt nur für die erste Klasse der Figur,
     die beim Mehrklassen-Einstieg nur für jede weitere. */
  it('asks start choices of the first class only, and multiclass ones of the others', () => {
    const rogue = art('class-2', 'Class', {
      Choices: {
        choices: [
          { id: 'skills', kind: 'proficiency', when: 'start', count: 4, from: { enumRef: ['Skill'] } },
          { id: 'multiclass-skills', kind: 'proficiency', when: 'multiclass', count: 1, from: { enumRef: ['Skill'] } },
        ],
      },
    });
    const pc = art('pc-2', 'PlayerCharacter', {}, [
      { id: 'r1', type: 'hasClass', to: 'class-1', props: { level: 1 } },
      { id: 'r2', type: 'hasClass', to: 'class-2', props: { level: 1 } },
    ]);
    const mit = new Map([...bestand, ['class-2', rogue]]);
    const ids = pendingChoices(pc, mit).map((c) => `${c.source.entity.id}#${c.choice.id}`);
    expect(ids).toContain('class-2#multiclass-skills');
    expect(ids).not.toContain('class-2#skills');
  });

  it('answers only what leaves no room', () => {
    expect(fixedPicks({ id: 'a', kind: 'ability', from: { values: ['con'] } })).toEqual(['con']);
    expect(fixedPicks({ id: 'a', kind: 'ability', from: { values: ['con', 'str'] } })).toBeUndefined();
    expect(fixedPicks({ id: 'e', kind: 'equipment', from: { options: [{ key: '_', label: 'A pack' }] } })).toEqual(['_']);
    expect(fixedPicks({ id: 'f', kind: 'feat', from: { interfaces: ['Feat'] } } as Choice)).toBeUndefined();
  });

  it('reads a choice as a sentence', () => {
    expect(choiceText({ id: 's', kind: 'proficiency', count: 2, when: 'start', from: { values: ['Athletics', 'Perception'] } }))
      .toBe('Choose 2 from Athletics, Perception (first class only)');
    expect(choiceText({ id: 'a', kind: 'ability', count: 2, bonus: [2, 1], from: { values: ['str', 'dex', 'con'] } }))
      .toBe('+2/+1 from str, dex, con');
    expect(choiceText({ id: 'e', kind: 'equipment', from: { options: [{ key: 'a', label: 'Chain mail' }, { key: 'b', label: 'Bow' }] } }))
      .toBe('(a) Chain mail or (b) Bow');
    expect(choiceText({ id: 'f', kind: 'feat', from: { interfaces: ['Feat'], tags: ['origin'] } })).toBe('Choose 1 origin feat');
  });

  it('makes ids from the text, and counts only on a clash', () => {
    expect(choiceId('Fighting Style')).toBe('fighting-style');
    expect(choiceId('Fighting Style', ['fighting-style'])).toBe('fighting-style-2');
    expect(choiceId('')).toBe('choice');
  });
});
