import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ABILITY_METHODS,
  abilityMethodOf,
  allowedMethods,
  answerChoice,
  assignScore,
  assignmentProblem,
  builderSteps,
  campaignLanguages,
  chosenResult,
  optionEffects,
  choicesOf,
  gainedFeatures,
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
      'choice:background-1#origin-feat', 'choice:class-1#skills', 'equipment', 'details',
    ]);
  });

  it('shows a changed or new class without a code change, and drops answers nobody asks any more', () => {
    let d = setPick(leer, 'hasClass', 'class-1');
    const skills = builderSteps(d, bestand).find((s) => s.id === 'choice:class-1#skills');
    if (skills?.kind !== 'choice') throw new Error('kein Schritt');
    d = answerChoice(d, skills.at, ['Athletics', 'Survival']);
    d = pruneAnswers(setPick(d, 'hasClass', 'class-2'), bestand);
    /* Die Ausrüstungswahl steht gesammelt im Schritt `equipment` (T-096). */
    const ausr = builderSteps(d, bestand).find((s) => s.id === 'equipment');
    expect(ausr?.kind === 'equipment' && ausr.choices.map((c) => c.choice.id)).toEqual(['mist-gift']);
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

describe('the fixes after the first test on dev (T-095)', () => {
  const ab = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const [reihe, kauf] = DEFAULT_ABILITY_METHODS;

  it('gives every score of the standard array once: a taken score swaps', () => {
    let s: Record<string, number | undefined> = {};
    s = assignScore(s, ab, 'str', 15, reihe!);
    s = assignScore(s, ab, 'dex', 14, reihe!);
    /* 15 ist vergeben: DEX nimmt sie, STR bekommt die 14. */
    s = assignScore(s, ab, 'dex', 15, reihe!);
    expect([s['str'], s['dex']]).toEqual([14, 15]);
    /* Wer noch keinen Wert hatte, nimmt ihn, und der andere wird leer. */
    s = assignScore(s, ab, 'con', 15, reihe!);
    expect([s['dex'], s['con']]).toEqual([undefined, 15]);
    for (const [a, w] of [['str', 15], ['dex', 14], ['con', 13], ['int', 12], ['wis', 10], ['cha', 8]] as const) s = assignScore(s, ab, a, w, reihe!);
    expect(assignmentProblem(s, ab, reihe!)).toBeNull();
    expect(new Set(Object.values(s)).size).toBe(6);
  });

  it('swaps in a rolled pool only when a value is used up, and never in point buy', () => {
    const m = abilityMethodOf(art('m', 'AbilityMethod', { AbilityMethod: { method: 'roll', dice: '4d6kh3', scope: 'party' } }))!;
    const pool = [12, 12, 15, 10, 9, 8];
    let s: Record<string, number | undefined> = { str: 12 };
    s = assignScore(s, ab, 'dex', 12, m, pool);
    expect([s['str'], s['dex']]).toEqual([12, 12]);
    s = assignScore(s, ab, 'con', 12, m, pool);
    expect([s['str'], s['dex'], s['con']]).toEqual([undefined, 12, 12]);
    const k = assignScore({ str: 13 }, ab, 'dex', 13, kauf!);
    expect([k['str'], k['dex']]).toEqual([13, 13]);
  });

  it('reads a language choice without a list as a choice from the languages', () => {
    const alt = art('bg', 'Background', {
      Choices: {
        choices: [
          { id: 'proficiencies', kind: 'proficiency', note: '2 any standard languages of your choice' },
          { id: 'languages', kind: 'proficiency', count: 1, note: 'one exotic language' },
          { id: 'tools', kind: 'proficiency', note: 'one tool of your choice' },
          { id: 'skills', kind: 'proficiency', from: { values: ['Arcana'] } },
        ],
      },
    });
    const [a, b, c, d] = choicesOf(alt);
    expect(a).toMatchObject({ from: { enumRef: ['Language'] }, count: 2 });
    expect(b).toMatchObject({ from: { enumRef: ['Language'] }, count: 1 });
    expect(c?.from).toBeUndefined();
    expect(d?.from).toEqual({ values: ['Arcana'] });
    expect(choicesOf(art('x', 'Background', { Choices: { choices: [{ id: 'languages', kind: 'proficiency', note: 'two standard languages' }] } }))[0]?.count).toBe(2);
  });

  it('names the languages of the campaign, nothing meaning every one (REQ-251)', () => {
    expect(campaignLanguages(art('c', 'Campaign'))).toEqual([]);
    expect(campaignLanguages(art('c', 'Campaign', { Campaign: { languages: ['Common', 'Elvish', 'Common', ''] } }))).toEqual(['Common', 'Elvish']);
  });

  it('names what the new level brings: the features of class and subclass at exactly that level', () => {
    const klasse = art('k', 'Class', {}, [
      { id: 'g1', type: 'grants', to: 'rage', props: { level: 1 } },
      { id: 'g2', type: 'grants', to: 'reckless', props: { level: 2 } },
      { id: 'g3', type: 'grants', to: 'danger', props: { level: 2 } },
      { id: 'g4', type: 'grants', to: 'path', props: { level: 3 } },
    ]);
    const pfad = art('s', 'Subclass', {}, [{ id: 'g5', type: 'grants', to: 'frenzy', props: { level: 3 } }]);
    const byId = new Map([klasse, pfad].map((e) => [e.id, e]));
    let pc = setClassLevel(setPick(leer, 'hasClass', 'k'), 'k', 2);
    expect(gainedFeatures(pc, byId, 'k').map((f) => f.id)).toEqual(['reckless', 'danger']);
    pc = setClassLevel(pc, 'k', 3);
    pc = { ...pc, relations: pc.relations!.map((r) => (r.type === 'hasClass' ? { ...r, props: { ...r.props, subclass: 's' } } : r)) };
    expect(gainedFeatures(pc, byId, 'k')).toEqual([
      { id: 'path', source: 'k', level: 3 },
      { id: 'frenzy', source: 's', level: 3 },
    ]);
    expect(gainedFeatures(pc, byId, 'nicht-da')).toEqual([]);
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

describe('effects, sub-ancestries and nested choices (T-193)', () => {
  const grund = art('anc-elf', 'Ancestry', {
    Ancestry: { abilityBonus: { dex: 2 }, size: ['medium'], speed: '30 ft.', darkvision: 60 },
    Proficiencies: { proficient: ['Perception', 'Elvish'] },
    Choices: { choices: [{ id: 'cantrip', kind: 'spell', from: { interfaces: ['Spell'] } }] },
  }, [{ id: 'g1', type: 'grants', to: 'feat-trance' }]);
  const hoch = art('anc-high', 'Ancestry', {
    Ancestry: { abilityBonus: { int: 1 } },
    Proficiencies: { proficient: ['Elvish', 'Longsword'] },
  }, [{ id: 'h1', type: 'subraceOf', to: 'anc-elf' }, { id: 'h2', type: 'grants', to: 'feat-training' }]);
  const b = new Map([...bestand, [grund.id, grund], [hoch.id, hoch]]);

  it('reads the base of a sub-ancestry: bonuses add up, the sub-ancestry wins, lists unite', () => {
    const w = optionEffects('anc-high', b)!;
    expect(w.line).toEqual(['anc-high', 'anc-elf']);
    expect(w.abilityBonus).toEqual({ int: 1, dex: 2 });
    expect(w.speed).toBe('30 ft.');
    expect(w.darkvision).toBe(60);
    expect(w.proficient).toEqual(['Elvish', 'Longsword', 'Perception']);
    expect(w.features.map((f) => f.id)).toEqual(['feat-training', 'feat-trance']);
    expect(w.choices.map((c) => `${c.by}#${c.choice.id}`)).toEqual(['anc-elf#cantrip']);
  });

  it('counts the base ancestry for the character: its bonus and its choices', () => {
    const d = setPick(leer, 'hasAncestry', 'anc-high');
    expect(chosenResult(d, b).abilityBonus).toEqual({ int: 1, dex: 2 });
    expect(builderSteps(d, b).map((s) => s.id)).toContain('choice:anc-elf#cantrip');
  });

  it('class features up to level 1 only, no multiclass or equipment choices', () => {
    const k = art('class-x', 'Class', {
      Class: { hitDie: 12 },
      Proficiencies: { saves: ['str', 'con'] },
      Choices: {
        choices: [
          { id: 'skills', kind: 'proficiency', count: 2, when: 'start', from: { values: ['A', 'B', 'C'] } },
          { id: 'mc', kind: 'proficiency', when: 'multiclass', from: { values: ['A'] } },
          { id: 'gear', kind: 'equipment', from: { options: [{ key: 'a', label: 'x' }] } },
          { id: 'path', kind: 'subclass', level: 3, from: { interfaces: ['Subclass'] } },
        ],
      },
    }, [{ id: 'k1', type: 'grants', to: 'rage', props: { level: 1 } }, { id: 'k2', type: 'grants', to: 'later', props: { level: 2 } }]);
    const w = optionEffects('class-x', new Map([[k.id, k]]))!;
    expect(w.hitDie).toBe(12);
    expect(w.saves).toEqual(['str', 'con']);
    expect(w.features.map((f) => f.id)).toEqual(['rage']);
    expect(w.choices.map((c) => c.choice.id)).toEqual(['skills']);
  });

  it('with nest, the choices of a pick stand inside its step; a chosen feat keeps its own', () => {
    let d = setPick(leer, 'hasClass', 'class-1');
    d = setPick(d, 'hasBackground', 'background-1');
    const s = builderSteps(d, bestand, { nest: true });
    const klasse = s.find((x) => x.id === 'class');
    expect(klasse?.kind === 'pick' && klasse.nested?.map((c) => c.choice.id)).toEqual(['skills']);
    expect(s.map((x) => x.id)).not.toContain('choice:class-1#skills');
    const hg = s.find((x) => x.id === 'background');
    if (hg?.kind !== 'pick' || !hg.nested?.[0]) throw new Error('keine Wahl');
    d = answerChoice(d, hg.nested[0], ['feat-1']);
    /* Das gewählte Talent fragt selbst — als eigener Schritt (`chose`). */
    expect(builderSteps(d, bestand, { nest: true }).map((x) => x.id)).toContain('choice:feat-1#ability');
  });
});
