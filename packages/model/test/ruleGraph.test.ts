import { describe, expect, it } from 'vitest';
import { articleWithGraph, describeRuleGraph, ruleGraphWords, evalRuleExpr, exampleRuleGraphs, graphFromArticle, isRuleGraph, ruleGraphProblems, runRules, RULE_ENGINES, type Entity, type RuleCreature, type RuleGraph } from '../src/index.js';

/* Regel-Builder, Versuch (T-270). Erfundene Kreaturen. */

const kreatur = (id: string, over: Partial<RuleCreature> = {}): RuleCreature => ({
  id,
  name: id.toUpperCase(),
  knows: [],
  values: { reactionFree: 1, reach: 5 },
  x: 0,
  y: 0,
  ...over,
});

describe('evalRuleExpr', () => {
  it('setzt Zahlen ein und rechnet ohne eval', () => {
    expect(evalRuleExpr('self.reach * 2', { 'self.reach': 5 })).toBe(10);
    expect(evalRuleExpr('distance - 5', { distance: -3 })).toBe(-8);
  });
  it('ein unbekannter Name ist nicht zu entscheiden, keine 0', () => {
    expect(evalRuleExpr('self.hp', {})).toBeNull();
  });
  it('Code bleibt Text', () => {
    expect(evalRuleExpr('globalThis.process', {})).toBeNull();
  });
});

describe('runRules', () => {
  const [hellish, snatch] = exampleRuleGraphs() as [RuleGraph, RuleGraph];

  it('Hellish Rebuke: getroffen, kennt den Zauber, Reaktion frei → bietet an', () => {
    const a = kreatur('a', { x: 30 });
    const b = kreatur('b', { knows: ['Hellish Rebuke'] });
    const r = runRules([hellish], { on: 'hit', actor: 'a', target: 'b' }, [a, b]);
    expect(r.firings).toHaveLength(1);
    expect(r.firings[0]!.self).toBe('b');
    expect(r.firings[0]!.text).toBe('B may react with “Hellish Rebuke” against A');
  });

  it('ohne freie Reaktion, zu weit weg oder ohne den Zauber feuert nichts', () => {
    const a = kreatur('a', { x: 30 });
    const ev = { on: 'hit' as const, actor: 'a', target: 'b' };
    expect(runRules([hellish], ev, [a, kreatur('b', { knows: ['Hellish Rebuke'], values: { reactionFree: 0 } })]).firings).toEqual([]);
    expect(runRules([hellish], ev, [kreatur('a', { x: 90 }), kreatur('b', { knows: ['Hellish Rebuke'] })]).firings).toEqual([]);
    expect(runRules([hellish], ev, [a, kreatur('b')]).firings).toEqual([]);
  });

  it('ein anderes Ereignis lässt die Regel liegen, eine abgeschaltete auch', () => {
    const b = kreatur('b', { knows: ['Hellish Rebuke'] });
    expect(runRules([hellish], { on: 'attacked', actor: 'a', target: 'b' }, [kreatur('a'), b]).firings).toEqual([]);
    expect(runRules([{ ...hellish, enabled: false }], { on: 'hit', actor: 'a', target: 'b' }, [kreatur('a'), b]).firings).toEqual([]);
  });

  it('Snatch Punisher: wer in Reichweite aufhebt, fängt sich einen Angriff', () => {
    const dieb = kreatur('dieb', { x: 5 });
    const wache = kreatur('wache', { knows: ['Snatch Punisher'] });
    const fern = kreatur('fern', { knows: ['Snatch Punisher'], x: 40 });
    const r = runRules([snatch], { on: 'picksUpObject', actor: 'dieb' }, [dieb, wache, fern]);
    expect(r.firings.map((f) => f.self)).toEqual(['wache']);
  });

  it('ein fehlender Wert entscheidet nichts und bietet nichts an', () => {
    const b = kreatur('b', { knows: ['Hellish Rebuke'], values: {} });
    const r = runRules([hellish], { on: 'hit', actor: 'a', target: 'b' }, [kreatur('a'), b]);
    expect(r.firings).toEqual([]);
    expect(r.runs.find((x) => x.self === 'b')!.steps.at(-1)!.result).toBeNull();
  });

  it('der Nein-Ausgang einer Bedingung führt weiter', () => {
    const g: RuleGraph = {
      id: 'g',
      name: 'G',
      enabled: true,
      nodes: [
        { id: 't', kind: 'trigger', x: 0, y: 0, on: 'turnStart' },
        { id: 'c', kind: 'condition', x: 0, y: 0, test: { kind: 'compare', left: 'self.hp', op: '>', right: '0' } },
        { id: 'o', kind: 'outcome', x: 0, y: 0, then: { kind: 'blockAction', action: 'act', reason: 'down', to: 'self' } },
      ],
      wires: [{ from: 't', to: 'c' }, { from: 'c', to: 'o', port: 'no' }],
    };
    const r = runRules([g], { on: 'turnStart', actor: 'a' }, [kreatur('a', { values: { hp: 0 } })]);
    expect(r.firings.map((f) => f.text)).toEqual(['A cannot act: down']);
  });

  it('ein Kreis läuft nicht ewig', () => {
    const g: RuleGraph = {
      id: 'k',
      name: 'K',
      enabled: true,
      nodes: [
        { id: 't', kind: 'trigger', x: 0, y: 0, on: 'turnEnd' },
        { id: 'c', kind: 'condition', x: 0, y: 0, test: { kind: 'same', a: 'self', b: 'actor' } },
      ],
      wires: [{ from: 't', to: 'c' }, { from: 'c', to: 'c', port: 'yes' }],
    };
    expect(runRules([g], { on: 'turnEnd', actor: 'a' }, [kreatur('a')]).firings).toEqual([]);
  });
});

describe('ruleGraphProblems und isRuleGraph', () => {
  it('nennt fehlende Auslöser und lose Verbindungen', () => {
    const g: RuleGraph = { id: 'x', name: 'X', enabled: true, nodes: [], wires: [{ from: 'a', to: 'b' }] };
    expect(ruleGraphProblems(g)).toEqual(['X: no trigger', 'X: a wire points at a missing node']);
    expect(ruleGraphProblems(exampleRuleGraphs()[0]!)).toEqual([]);
  });
  it('erkennt Graphen aus den Einstellungen', () => {
    expect(isRuleGraph(exampleRuleGraphs()[0])).toBe(true);
    expect(isRuleGraph({ id: 'x' })).toBe(false);
    expect(isRuleGraph(null)).toBe(false);
  });
});

describe('die Beispielregeln', () => {
  const alle = exampleRuleGraphs();
  const regel = (id: string) => alle.find((g) => g.id === id)!;

  it('sind ohne Mängel, haben eine Engine und eindeutige Ids', () => {
    expect(new Set(alle.map((g) => g.id)).size).toBe(alle.length);
    for (const g of alle) {
      expect(ruleGraphProblems(g), g.id).toEqual([]);
      expect(RULE_ENGINES.map((e) => e.key)).toContain(g.engine);
    }
  });

  it('Counterspell: der Zaubergrad wählt den Zweig', () => {
    const magier = kreatur('m', { x: 40 });
    const wache = kreatur('w', { knows: ['Counterspell'], values: { reactionFree: 1, slots3: 1 } });
    const lauf = (amount: number) => runRules([regel('counterspell')], { on: 'castsSpell', actor: 'm', amount }, [magier, wache]).firings.map((f) => f.text);
    expect(lauf(2)).toEqual(['W may react with “Counterspell: the spell fails” against M']);
    expect(lauf(5)).toEqual(['W may react with “Counterspell: ability check, DC 10 + spell level” against M']);
  });

  it('Konzentration: der SG ist die Hälfte des Schadens, mindestens 10', () => {
    const b = kreatur('b', { values: { concentrating: 1 } });
    const texte = (amount: number) =>
      runRules([regel('concentration')], { on: 'damaged', actor: 'a', target: 'b', amount }, [kreatur('a'), b]).firings.map((f) => f.text);
    expect(texte(30)).toContain('B.concentrationDC becomes 15');
    expect(texte(8)).toContain('B.concentrationDC becomes 10');
  });

  it('auf 0 Trefferpunkte: massiver Schaden tötet', () => {
    const b = kreatur('b', { values: { hp: 5, maxHp: 10 } });
    const texte = (amount: number) =>
      runRules([regel('drop-to-zero')], { on: 'damaged', actor: 'a', target: 'b', amount }, [kreatur('a'), b]).firings.map((f) => f.text);
    expect(texte(20)).toContain('B gets “Dead (massive damage)”');
    expect(texte(8)).toContain('B gets “Unconscious, dying”');
    expect(texte(3)).toEqual([]);
  });

  it('ohne freie Hand sperrt die Regel das Zaubern, War Caster nicht', () => {
    const r = (knows: string[]) =>
      runRules([regel('somatic-hand')], { on: 'castsSpell', actor: 'a' }, [kreatur('a', { knows, values: { freeHands: 0 } })]).firings.map((f) => f.text);
    expect(r([])).toEqual(['A cannot cast a spell with somatic components: no free hand']);
    expect(r(['War Caster'])).toEqual(['A gets “Somatic components with hands full (War Caster)”']);
  });
});

describe('Graph am Regelartikel (T-270)', () => {
  const art: Entity = {
    id: 'r1',
    interfaces: ['Rule'],
    components: { Identity: { name: 'Shield' }, Rule: { kind: 'rule', key: 'shield' } },
    relations: [{ type: 'partOf', to: 'sys-spells' }],
  };
  const sys = (id: string) => (id === 'sys-spells' ? 'spellcasting' : undefined);

  it('liest einen Artikel ohne Graph als leeren, mit System aus partOf', () => {
    expect(graphFromArticle(art, sys)).toEqual({ id: 'r1', name: 'Shield', engine: 'spellcasting', enabled: true, nodes: [], wires: [] });
  });

  it('schreibt Graph und Namen zurück, und liest sie wieder gleich', () => {
    const g = { ...exampleRuleGraphs().find((x) => x.id === 'shield')!, id: 'r1', name: 'Shield (house)', engine: 'spellcasting', enabled: false };
    const neu = articleWithGraph(art, g);
    expect(neu.components['Identity']).toEqual({ name: 'Shield (house)' });
    expect(neu.components['Rule']).toMatchObject({ kind: 'rule', key: 'shield' });
    expect(graphFromArticle(neu, sys)).toEqual(g);
  });

  it('lässt einen Artikel ohne Knoten ohne Graph', () => {
    expect(articleWithGraph(art, graphFromArticle(art, sys)).components['Rule']).toEqual({ kind: 'rule', key: 'shield' });
  });
});

describe('ruleGraphWords (T-270)', () => {
  it('nennt die Begriffe, auf denen eine Regel aufbaut', () => {
    const g = (id: string) => exampleRuleGraphs().find((x) => x.id === id)!;
    expect(ruleGraphWords(g('hellish-rebuke'))).toEqual(['attack roll', 'reach', 'reaction']);
    expect(ruleGraphWords(g('opportunity-attack'))).toEqual(['disengage', 'opportunity attack', 'reach', 'reaction']);
    expect(ruleGraphWords(g('counterspell'))).toEqual(['reach', 'reaction', 'spell slot']);
    expect(ruleGraphWords(g('concentration'))).toEqual(['concentration', 'damage roll', 'hit points']);
    expect(ruleGraphWords(g('somatic-hand'))).toEqual(['somatic component', 'spell slot']);
  });
});

describe('describeRuleGraph (T-270)', () => {
  it('sagt je Folge in einem Satz, wann sie greift', () => {
    const g = (id: string) => exampleRuleGraphs().find((x) => x.id === id)!;
    expect(describeRuleGraph(g('hellish-rebuke'))).toBe(
      'When a creature is hit by an attack, if self is target, self knows “Hellish Rebuke”, self.reactionFree = 1 and distance <= 60: offer reaction “Hellish Rebuke” to self (target: actor).',
    );
    const shield = describeRuleGraph(g('shield'));
    expect(shield).toContain('self.slots1 >= 1: offer reaction “Shield (+5 AC until your next turn)”');
    expect(shield).toContain('not self.slots1 >= 1: apply “Shield unavailable: no 1st-level slot” to self.');
  });
});
