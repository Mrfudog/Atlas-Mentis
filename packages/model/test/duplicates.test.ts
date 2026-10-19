import { describe, expect, it } from 'vitest';
import { choiceDuplicates, choicesAtCharacter, duplicateText, heldBefore, heldValue, newChoiceDuplicates, type Entity } from '../src/index.js';

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});

/* Der Fall der Leitung (19.10.): Hintergrund gibt Insight, die Herkunft
   lässt eine Sprache wählen, die Klasse zwei Fertigkeiten. */
const elf = art('anc-elf', 'Ancestry', {
  Proficiencies: { proficient: ['Elvish'] },
  Choices: { choices: [
    { id: 'language', kind: 'proficiency', from: { values: ['Dwarvish', 'Elvish', 'Giant'] } },
    { id: 'skill', kind: 'proficiency', from: { values: ['Perception', 'Insight', 'Stealth'] } },
  ] },
});
const sage = art('bg-sage', 'Background', {
  Proficiencies: { proficient: ['Insight', 'Arcana'] },
  Choices: { choices: [
    { id: 'language', kind: 'proficiency', from: { values: ['Dwarvish', 'Giant', 'Orc'] } },
    { id: 'feat', kind: 'feat', from: { interfaces: ['Feat'] } },
  ] },
}, [{ id: 'g-alert', type: 'grants', to: 'feat-alert', props: { level: 1 } }]);
const rogue = art('class-rogue', 'Class', {
  Choices: { choices: [
    { id: 'skills', kind: 'proficiency', when: 'start', count: 2, from: { values: ['Perception', 'Insight', 'Stealth', 'Arcana'] } },
    { id: 'expertise', kind: 'proficiency', count: 1, from: { values: ['Perception', 'Stealth', 'Insight'] } },
  ] },
});
const alert = art('feat-alert', 'Feat');
const skilled = art('feat-skilled', 'Feat', { Feat: { repeatable: true } });
const tough = art('feat-tough', 'Feat');
const bestand = new Map([elf, sage, rogue, alert, skilled, tough].map((e) => [e.id, e]));

const figur = (chose: Entity['relations'] = []): Entity =>
  art('pc-1', 'PlayerCharacter', {}, [
    /* Die Klasse steht zuerst — gezählt wird trotzdem in der Reihenfolge des Assistenten. */
    { id: 'c1', type: 'hasClass', to: 'class-rogue', props: { level: 1 } },
    { id: 'a1', type: 'hasAncestry', to: 'anc-elf' },
    { id: 'b1', type: 'hasBackground', to: 'bg-sage' },
    ...(chose ?? []),
  ]);
const wahl = (to: string, choice: string, picks: string[]): Entity['relations'][number] => ({ id: `w-${to}-${choice}`, type: 'chose', to, props: { choice, picks } });
const an = (c: Entity, to: string, id: string) => choicesAtCharacter(c, bestand).find((a) => a.source.entity.id === to && a.choice.id === id)!;

describe('heldBefore (T-299)', () => {
  it('locks what a fixed source gives, with its origin', () => {
    const c = figur();
    const h = heldBefore(c, bestand, an(c, 'anc-elf', 'language'));
    expect(heldValue(h, 'Elvish', bestand)?.from).toBe('Ancestry (anc-elf)');
    expect(heldValue(h, 'insight', bestand)).toMatchObject({ from: 'Background (bg-sage)', fixed: true });
    expect(heldValue(h, 'Giant', bestand)).toBeUndefined();
  });

  it('locks what an earlier step chose — ancestry before background, whatever the edge order', () => {
    const c = figur([wahl('anc-elf', 'language', ['Dwarvish']), wahl('bg-sage', 'language', ['Giant'])]);
    const imHintergrund = heldBefore(c, bestand, an(c, 'bg-sage', 'language'));
    expect(heldValue(imHintergrund, 'Dwarvish', bestand)).toMatchObject({ from: 'Ancestry (anc-elf)', fixed: false });
    /* Die Herkunft kommt zuerst: der Hintergrund sperrt dort nichts. */
    const inDerHerkunft = heldBefore(c, bestand, an(c, 'anc-elf', 'language'));
    expect(heldValue(inDerHerkunft, 'Giant', bestand)).toBeUndefined();
  });

  it('lets expertise pick what is proficient, but not what has expertise already', () => {
    const c = figur([wahl('class-rogue', 'skills', ['Perception', 'Stealth'])]);
    const h = heldBefore(c, bestand, an(c, 'class-rogue', 'expertise'));
    expect(heldValue(h, 'Perception', bestand)).toBeUndefined();
  });

  it('locks feats unless repeatable, including one a source grants', () => {
    const c = figur([wahl('bg-sage', 'feat', ['feat-skilled'])]);
    const h = heldBefore(c, bestand, an(c, 'bg-sage', 'feat'));
    expect(heldValue(h, 'feat-alert', bestand)).toMatchObject({ fixed: true, from: 'Background (bg-sage)' });
    expect(heldValue(h, 'feat-skilled', bestand)).toBeUndefined();
  });
});

describe('choiceDuplicates (T-299)', () => {
  it('marks a later duplicate after an earlier choice changes, instead of clearing it', () => {
    const c = figur([wahl('anc-elf', 'skill', ['Stealth']), wahl('class-rogue', 'skills', ['Perception', 'Stealth'])]);
    const d = choiceDuplicates(c, bestand);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ choice: 'class-rogue#skills', pick: 'Stealth', held: { fixed: false } });
    expect(duplicateText(d[0]!, bestand)).toBe('Stealth is already chosen at Ancestry (anc-elf).');
  });

  it('says “choose another” when a fixed source gives what was chosen', () => {
    const c = figur([wahl('anc-elf', 'skill', ['Insight'])]);
    const [d] = choiceDuplicates(c, bestand);
    expect(d?.held.fixed).toBe(true);
    expect(duplicateText(d!, bestand)).toMatch(/choose another/);
  });

  it('marks a duplicate feat but not a repeatable one', () => {
    expect(choiceDuplicates(figur([wahl('bg-sage', 'feat', ['feat-alert'])]), bestand)).toHaveLength(1);
    expect(choiceDuplicates(figur([wahl('bg-sage', 'feat', ['feat-tough'])]), bestand)).toHaveLength(0);
  });

  it('rejects only new duplicates on save', () => {
    const alt = figur([wahl('anc-elf', 'skill', ['Insight'])]);
    const neu = figur([wahl('anc-elf', 'skill', ['Insight']), wahl('class-rogue', 'skills', ['Arcana', 'Stealth'])]);
    const d = newChoiceDuplicates(alt, neu, bestand);
    expect(d.map((x) => x.pick)).toEqual(['Arcana']);
    expect(newChoiceDuplicates(alt, alt, bestand)).toEqual([]);
    expect(newChoiceDuplicates(undefined, alt, bestand)).toHaveLength(1);
  });
});

describe('spells are locked too (T-309)', () => {
  const klasse = art('class-w', 'Class', {
    Class: { spellAbility: 'int', casterProgression: 'full' },
    Choices: { choices: [{ id: 'cantrips', kind: 'spell', count: 2, from: { interfaces: ['Spell'] } }] },
  });
  const herkunft = art(
    'anc-t',
    'Ancestry',
    { Choices: { choices: [{ id: 'cantrip', kind: 'spell', count: 1, from: { interfaces: ['Spell'] } }] } },
    [{ id: 'k', type: 'casts', to: 'sp-thaum', props: { mode: 'innate', ability: 'cha' } }],
  );
  const zauber = ['sp-thaum', 'sp-light', 'sp-bolt'].map((id) => art(id, 'Spell', { Spell: { level: 0 } }));
  const b = new Map([klasse, herkunft, ...zauber].map((e) => [e.id, e]));
  const c = (picks: string[]): Entity =>
    art('pc', 'PlayerCharacter', {}, [
      { id: 'a', type: 'hasAncestry', to: 'anc-t' },
      { id: 'k', type: 'hasClass', to: 'class-w', props: { level: 1 } },
      { id: 'w1', type: 'chose', to: 'anc-t', props: { choice: 'cantrip', picks: ['sp-light'] } },
      { id: 'w2', type: 'chose', to: 'class-w', props: { choice: 'cantrips', picks } },
    ]);

  it('locks a spell the origin casts and one an earlier choice took', () => {
    const f = c([]);
    const at = choicesAtCharacter(f, b).find((x) => x.source.entity.id === 'class-w')!;
    const h = heldBefore(f, b, at);
    expect(heldValue(h, 'sp-thaum', b)).toMatchObject({ fixed: true, from: 'Ancestry (anc-t)' });
    expect(heldValue(h, 'sp-light', b)).toMatchObject({ fixed: false });
    expect(heldValue(h, 'sp-bolt', b)).toBeUndefined();
    expect(choiceDuplicates(c(['sp-light', 'sp-bolt']), b).map((d) => d.pick)).toEqual(['sp-light']);
  });
});
