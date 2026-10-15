import { describe, expect, it } from 'vitest';
import {
  answerChoice,
  answeredKeys,
  builderSteps,
  campaignAllowsFeats,
  choiceKey,
  choicesAtCharacter,
  chosenResult,
  offeredOptions,
  orphanAnswers,
  pruneAnswers,
  setClassLevel,
  type Choice,
  type ChoiceAtCharacter,
  type Entity,
} from '../src/index.js';

/* T-107, E-027: ein Merkmal, das die Klasse mehrfach gewährt, fragt je
   Gewährung — hier eine Attributssteigerung in der Form des Importers. */
const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});

const ASI: Choice[] = [
  {
    id: 'improvement', kind: 'option', default: ['asi'],
    from: { options: [{ key: 'asi', label: 'Increase ability scores' }, { key: 'feat', label: 'Take a feat instead' }] },
  },
  { id: 'ability-scores', kind: 'ability', count: 2, bonus: [1, 1], repeat: true, from: { values: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }, onlyIf: { choice: 'improvement', pick: 'asi' } },
  { id: 'feat', kind: 'feat', count: 1, from: { interfaces: ['Feat'] }, onlyIf: { choice: 'improvement', pick: 'feat' } },
];
const asi = art('feature-asi', 'Feature', { Choices: { choices: ASI } });
const kaempfer = art('class-f', 'Class', {}, [4, 6, 8].map((l) => ({ id: `g${l}`, type: 'grants', to: 'feature-asi', props: { level: l } })));
const magier = art('class-w', 'Class', {}, [{ id: 'gw4', type: 'grants', to: 'feature-asi', props: { level: 4 } }]);
const wach = art('feat-alert', 'Feat', { Choices: { choices: [{ id: 'ability', kind: 'ability', bonus: [1], from: { values: ['dex', 'wis'] } }] } });
const byId = new Map([asi, kaempfer, magier, wach].map((e) => [e.id, e] as const));

const figur = (stufe: number, relations: Entity['relations'] = []): Entity =>
  art('pc-1', 'PlayerCharacter', {}, [{ id: 'k', type: 'hasClass', to: 'class-f', props: { level: stufe } }, ...(relations ?? [])]);

const wahl = (e: Entity, id: string, level: number, by = 'class-f'): ChoiceAtCharacter =>
  choicesAtCharacter(e, byId).find((c) => c.choice.id === id && c.source.grant?.level === level && c.source.grant.by === by)!;

describe('Ein Merkmal, mehrfach gewährt, fragt je Stufe (T-107)', () => {
  it('Stufe 3 kennt keine Steigerung, Stufe 8 zwei', () => {
    expect(choicesAtCharacter(figur(3), byId)).toEqual([]);
    const auf8 = choicesAtCharacter(figur(8), byId).filter((c) => c.choice.id === 'improvement');
    expect(auf8.map((c) => c.source.grant)).toEqual([
      { by: 'class-f', level: 4 },
      { by: 'class-f', level: 6 },
      { by: 'class-f', level: 8 },
    ]);
  });

  it('die Vorgabe zeigt die Attributspunkte sofort, das Talent erst auf Wahl', () => {
    const l = choicesAtCharacter(figur(4), byId);
    expect(l.map((c) => c.choice.id)).toEqual(['improvement', 'ability-scores']);
    expect(l[0]).toMatchObject({ picks: ['asi'], assumed: true });
  });

  it('Stufe 4 und 8 mit verschiedenen Antworten: +2 STR, dann +1 DEX/+1 CON', () => {
    let f = figur(8);
    f = answerChoice(f, wahl(f, 'ability-scores', 4), ['str', 'str']);
    f = answerChoice(f, wahl(f, 'ability-scores', 8), ['dex', 'con']);
    const kanten = f.relations!.filter((r) => r.type === 'chose');
    expect(kanten.map((r) => r.props)).toEqual([
      { choice: 'ability-scores', picks: ['str', 'str'], by: 'class-f', level: 4 },
      { choice: 'ability-scores', picks: ['dex', 'con'], by: 'class-f', level: 8 },
    ]);
    expect(chosenResult(f, byId).abilityBonus).toEqual({ str: 2, dex: 1, con: 1 });
    /* Die Antwort auf 4 ändern lässt die auf 8 stehen. */
    f = answerChoice(f, wahl(f, 'ability-scores', 4), ['wis', 'cha']);
    expect(chosenResult(f, byId).abilityBonus).toEqual({ wis: 1, cha: 1, dex: 1, con: 1 });
  });

  it('das Talent statt der Steigerung, und es fragt selbst', () => {
    let f = figur(4);
    f = answerChoice(f, wahl(f, 'improvement', 4), ['feat']);
    expect(choicesAtCharacter(f, byId).map((c) => c.choice.id)).toEqual(['improvement', 'feat']);
    f = answerChoice(f, wahl(f, 'feat', 4), ['feat-alert']);
    const offen = choicesAtCharacter(f, byId).filter((c) => !c.picks);
    expect(offen.map((c) => `${c.source.entity.id}#${c.choice.id}`)).toEqual(['feat-alert#ability']);
    expect(chosenResult(f, byId).articles).toEqual([{ kind: 'feat', id: 'feat-alert', source: 'feature-asi' }]);
  });

  it('zurück zur Steigerung: das Talent fällt aus dem Entwurf', () => {
    let f = figur(4);
    f = answerChoice(f, wahl(f, 'improvement', 4), ['feat']);
    f = answerChoice(f, wahl(f, 'feat', 4), ['feat-alert']);
    f = pruneAnswers(answerChoice(f, wahl(f, 'improvement', 4), ['asi']), byId);
    expect(f.relations!.filter((r) => r.type === 'chose').map((r) => r.props?.['choice'])).toEqual(['improvement']);
  });

  it('zwei Klassen, die dasselbe Merkmal gewähren, fragen getrennt', () => {
    const f = { ...figur(4), relations: [...figur(4).relations!, { id: 'k2', type: 'hasClass', to: 'class-w', props: { level: 4 } }] };
    const quellen = choicesAtCharacter(f, byId).filter((c) => c.choice.id === 'ability-scores').map(choiceKey);
    expect(quellen).toEqual(['feature-asi#ability-scores@class-f:4', 'feature-asi#ability-scores@class-w:4']);
  });

  it('eine ältere Antwort ohne Stufe gilt für die erste Gewährung', () => {
    const f = figur(8, [{ id: 'alt', type: 'chose', to: 'feature-asi', props: { choice: 'ability-scores', picks: ['con', 'con'] } }]);
    const l = choicesAtCharacter(f, byId).filter((c) => c.choice.id === 'ability-scores');
    expect(l.map((c) => c.picks)).toEqual([['con', 'con'], undefined, undefined]);
    expect(orphanAnswers(f, byId)).toEqual([]);
    expect(pruneAnswers(f, byId)).toBe(f);
  });

  it('eine Antwort zu einer Gewährung, die es nicht mehr gibt, ist verwaist', () => {
    const f = figur(8, [{ id: 'x', type: 'chose', to: 'feature-asi', props: { choice: 'ability-scores', picks: ['str'], by: 'class-f', level: 12 } }]);
    expect(orphanAnswers(f, byId).map((a) => a.relationId)).toEqual(['x']);
  });

  it('der Aufstieg auf 8 fragt neu, obwohl 4 und 6 beantwortet sind', () => {
    let f = figur(6);
    f = answerChoice(f, wahl(f, 'ability-scores', 4), ['str', 'dex']);
    f = answerChoice(f, wahl(f, 'ability-scores', 6), ['str', 'dex']);
    const done = answeredKeys(f, byId);
    const auf7 = builderSteps(setClassLevel(f, 'class-f', 7), byId, { levelUp: true, done });
    expect(auf7.map((s) => s.id)).toEqual(['level', 'hitpoints']);
    const auf8 = builderSteps(setClassLevel(f, 'class-f', 8), byId, { levelUp: true, done });
    expect(auf8.map((s) => s.id)).toEqual(['level', 'choice:feature-asi#improvement@class-f:8', 'choice:feature-asi#ability-scores@class-f:8', 'hitpoints']);
    const ohneTalente = builderSteps(setClassLevel(f, 'class-f', 8), byId, { levelUp: true, done, rules: { feats: false } });
    expect(ohneTalente.map((s) => s.id)).toEqual(['level', 'choice:feature-asi#ability-scores@class-f:8', 'hitpoints']);
  });

  it('ohne Talente am Tisch bleibt nur die Steigerung', () => {
    expect(offeredOptions(ASI[0]!, ASI, { feats: false }).map((o) => o.key)).toEqual(['asi']);
    expect(offeredOptions(ASI[0]!, ASI).map((o) => o.key)).toEqual(['asi', 'feat']);
    expect(campaignAllowsFeats(art('c', 'Campaign', { Campaign: { feats: false } }))).toBe(false);
    expect(campaignAllowsFeats(art('c', 'Campaign'))).toBe(true);
  });
});
