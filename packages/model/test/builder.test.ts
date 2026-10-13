import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ABILITY_METHODS,
  abilityMethodOf,
  allowedMethods,
  answerChoice,
  assignmentProblem,
  builderSteps,
  partyPool,
  pointBuySpent,
  pruneAnswers,
  rollAbilityScores,
  rollDice,
  setClassLevel,
  setPick,
  type Entity,
} from '../src/index.js';

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});

const fighter = art('class-1', 'Class', {
  Choices: {
    choices: [
      { id: 'skills', kind: 'proficiency', count: 2, when: 'start', from: { values: ['Athletics', 'Perception', 'Survival'] } },
      { id: 'martial-archetype', kind: 'subclass', level: 3, from: { interfaces: ['Subclass'], edge: { type: 'subclassOf', to: 'class-1' } } },
    ],
  },
});
/* Eine selbst angelegte Klasse: keine Zeile Code kennt sie. */
const nebelgaenger = art('class-2', 'Class', {
  Choices: { choices: [{ id: 'mist-gift', kind: 'equipment', from: { options: [{ key: 'a', label: 'Lantern' }, { key: 'b', label: 'Cloak' }] } }] },
});
const champion = art('sub-1', 'Subclass', {
  Choices: { choices: [{ id: 'style', kind: 'feature', level: 3, from: { interfaces: ['Feature'] } }] },
}, [{ id: 's1', type: 'subclassOf', to: 'class-1' }]);
const elf = art('ancestry-1', 'Ancestry', {
  Choices: { choices: [{ id: 'fixed', kind: 'ability', from: { values: ['dex'] } }] },
});
const sage = art('background-1', 'Background', {
  Choices: { choices: [{ id: 'origin-feat', kind: 'feat', from: { interfaces: ['Feat'] } }] },
});
const tough = art('feat-1', 'Feat', {
  Choices: { choices: [{ id: 'ability', kind: 'ability', bonus: [1], from: { values: ['con', 'str'] } }] },
});
const bestand = new Map([fighter, nebelgaenger, champion, elf, sage, tough].map((e) => [e.id, e]));
const leer = art('draft', 'PlayerCharacter');

describe('the character builder reads its steps from the articles (T-080)', () => {
  it('builds ancestry, background, class, abilities, one step per open choice, details', () => {
    let d = setPick(leer, 'hasAncestry', 'ancestry-1');
    d = setPick(d, 'hasBackground', 'background-1');
    d = setPick(d, 'hasClass', 'class-1');
    expect(builderSteps(d, bestand).map((s) => s.id)).toEqual([
      'ancestry', 'background', 'class', 'abilities',
      'choice:background-1#origin-feat', 'choice:class-1#skills', 'details',
    ]);
  });

  it('shows a changed or new class without a code change, and drops answers nobody asks any more', () => {
    let d = setPick(leer, 'hasClass', 'class-1');
    const skills = builderSteps(d, bestand).find((s) => s.id === 'choice:class-1#skills');
    if (skills?.kind !== 'choice') throw new Error('kein Schritt');
    d = answerChoice(d, skills.at, ['Athletics', 'Survival']);
    d = pruneAnswers(setPick(d, 'hasClass', 'class-2'), bestand);
    expect(builderSteps(d, bestand).map((s) => s.id)).toContain('choice:class-2#mist-gift');
    expect(d.relations?.filter((r) => r.type === 'chose')).toEqual([]);
  });

  it('appends the step a choice opens: a feat with its own choice', () => {
    let d = setPick(leer, 'hasBackground', 'background-1');
    const feat = builderSteps(d, bestand).find((s) => s.id === 'choice:background-1#origin-feat');
    if (feat?.kind !== 'choice') throw new Error('kein Schritt');
    d = answerChoice(d, feat.at, ['feat-1']);
    const ids = builderSteps(d, bestand).map((s) => s.id);
    expect(ids.indexOf('choice:feat-1#ability')).toBeGreaterThan(ids.indexOf('choice:background-1#origin-feat'));
  });

  it('levels up with the same mechanism: the subclass at 3 and what it opens', () => {
    let pc = setPick(leer, 'hasClass', 'class-1');
    const done = new Set(['class-1#skills']);
    pc = setClassLevel(pc, 'class-1', 3);
    const sub = builderSteps(pc, bestand, { levelUp: true, done });
    expect(sub.map((s) => s.id)).toEqual(['level', 'choice:class-1#martial-archetype']);
    const st = sub[1];
    if (st?.kind !== 'choice') throw new Error('kein Schritt');
    pc = answerChoice(pc, st.at, ['sub-1']);
    expect(pc.relations?.find((r) => r.type === 'hasClass')?.props?.['subclass']).toBe('sub-1');
    expect(builderSteps(pc, bestand, { levelUp: true, done }).map((s) => s.id)).toContain('choice:sub-1#style');
  });
});

describe('ability score methods are data (E-016 a)', () => {
  it('falls back to standard array and point buy, and reads what the campaign allows', () => {
    expect(allowedMethods(undefined, new Map()).map((m) => m.id)).toEqual(['standard-array', 'point-buy']);
    const pool = art('m-1', 'AbilityMethod', { AbilityMethod: { method: 'roll', dice: '4d6kh3', count: 6, scope: 'party' } });
    const kampagne = art('c-1', 'Campaign', {}, [{ id: 'x', type: 'allowsMethod', to: 'm-1' }]);
    expect(allowedMethods(kampagne, new Map([[pool.id, pool]]))).toEqual([
      { id: 'm-1', name: 'm-1', method: 'roll', dice: '4d6kh3', count: 6, scope: 'party' },
    ]);
  });

  it('checks an assignment against the array, the point budget and a rolled pool', () => {
    const ab = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const [reihe, kauf] = DEFAULT_ABILITY_METHODS;
    const s = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    expect(assignmentProblem(s, ab, reihe!)).toBeNull();
    expect(assignmentProblem({ ...s, cha: 15 }, ab, reihe!)).toMatch(/exactly once/);
    expect(pointBuySpent([15, 15, 15, 8, 8, 8], kauf!)).toBe(27);
    expect(assignmentProblem({ str: 15, dex: 15, con: 15, int: 9, wis: 8, cha: 8 }, ab, kauf!)).toMatch(/28 of 27/);
    expect(assignmentProblem({ ...s, str: 16 }, ab, kauf!)).toMatch(/outside/);
    const m = abilityMethodOf(art('m', 'AbilityMethod', { AbilityMethod: { method: 'roll', dice: '4d6kh3', scope: 'party' } }))!;
    expect(assignmentProblem(s, ab, m, [8, 10, 12, 13, 14, 15])).toBeNull();
    expect(assignmentProblem(s, ab, m)).toBe('Roll first.');
  });

  it('rolls 4d6 keep highest 3 and reads a party pool', () => {
    const folge = [0.99, 0.5, 0.0, 0.7];
    let i = 0;
    const r = rollDice('4d6kh3', () => folge[i++ % folge.length]!);
    expect(r?.total).toBe(6 + 4 + 5);
    expect(r?.rolls.filter((x) => 'drop' in x)).toEqual([{ d: 6, v: 1, vz: 1, drop: true }]);
    const m = { id: 'm', name: 'm', method: 'roll' as const, dice: '4d6kh3', count: 6, scope: 'party' as const };
    expect(rollAbilityScores(m, () => 0.99)?.values).toEqual([18, 18, 18, 18, 18, 18]);
    const gruppe = art('p', 'Party', {}, [{ id: 'q', type: 'abilityPool', to: 'm', props: { values: [15, 12], rolls: ['15 (6, 5, 4, ~1~)'] } }]);
    expect(partyPool(gruppe, 'm')).toEqual({ values: [15, 12], rolls: ['15 (6, 5, 4, ~1~)'] });
  });
});

describe('a player receives the choices whole (T-080)', () => {
  it('keeps the shape of an entry through redactEntity', async () => {
    const { redactEntity } = await import('../src/index.js');
    const { seedRegistry } = await import('@nw/registry');
    const sieb = redactEntity(seedRegistry, new Map([[fighter.id, fighter]]), fighter, 'pc-x');
    expect(sieb.components?.['Choices']?.['choices']).toEqual(fighter.components?.['Choices']?.['choices']);
  });
});
