import { describe, expect, it } from 'vitest';
import { evalRuleExpr, exampleRuleGraphs, isRuleGraph, ruleGraphProblems, runRules, type RuleCreature, type RuleGraph } from '../src/index.js';

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
