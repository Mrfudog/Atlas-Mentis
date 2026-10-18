import { describe, expect, it } from 'vitest';
import { ownRuleName, ruleOptionRuleNames, ruleOptionsOf, withRuleVariant, RULE_OPTIONS, RULE_SORTS, type Entity, type RuleRef } from '../src/index.js';

/* Die Regeloptionen einer Kampagne (T-190). Erfundene Artikel. */

const kampagne = (felder: Record<string, unknown>, relations: Entity['relations'] = []): Entity => ({
  id: 'k',
  interfaces: ['Campaign'],
  components: { Campaign: felder },
  relations,
});

const regeln = new Map<string, RuleRef>([
  ['encumbrance', { id: 'r-enc', name: 'Encumbrance' }],
  ['inventory rules: slots', { id: 'r-slots', name: 'Inventory rules: Slots' }],
]);
const ctx = (byId = new Map<string, Entity>(), settings: Record<string, string> = {}) => ({
  byId,
  settings,
  ruleNamed: (names: readonly string[]) => names.map((n) => regeln.get(n.toLowerCase())).find(Boolean),
});

const option = (s: ReturnType<typeof ruleOptionsOf>, key: string) => s.flatMap((x) => x.options).find((o) => o.key === key)!;

describe('ruleOptionsOf', () => {
  it('zeigt jede Sorte, auch ohne Kampagne, mit den Vorgaben', () => {
    const s = ruleOptionsOf(null, ctx());
    expect(s.map((x) => x.key)).toEqual(RULE_SORTS.map((x) => x.key));
    expect(option(s, 'inventory').variants!.find((v) => v.chosen)?.key).toBe('grid');
    expect(option(s, 'feats').variants!.find((v) => v.chosen)?.key).toBe('true');
    expect(option(s, 'craftFailure').variants!.find((v) => v.chosen)?.key).toBe('halfLost');
    expect(option(s, 'abilityMethods').methods!.map((m) => m.builtIn)).toEqual([true, true]);
  });

  it('liest, was die Kampagne gewählt hat, über die Funktion des Teilsystems', () => {
    const s = ruleOptionsOf(kampagne({ inventory: 'weight', feats: false, craftFailure: 'quatsch', languages: ['Common', 'Elvish'] }), ctx());
    expect(option(s, 'inventory').variants!.find((v) => v.chosen)?.key).toBe('weight');
    expect(option(s, 'feats').variants!.find((v) => v.chosen)?.key).toBe('false');
    /* Ein Unsinn im Feld gilt nicht — die Seite sagt, was gilt. */
    expect(option(s, 'craftFailure').variants!.find((v) => v.chosen)?.key).toBe('halfLost');
    expect(option(s, 'languages').value).toEqual(['Common', 'Elvish']);
  });

  it('verweist auf den importierten Regelartikel, sonst auf die eigene Erklärung', () => {
    const inv = option(ruleOptionsOf(null, ctx()), 'inventory');
    expect(inv.variants!.find((v) => v.key === 'weight')?.rule?.id).toBe('r-enc');
    expect(inv.variants!.find((v) => v.key === 'slots')?.rule?.id).toBe('r-slots');
    expect(inv.variants!.find((v) => v.key === 'grid')?.rule).toBeUndefined();
    expect(inv.variants!.find((v) => v.key === 'grid')?.ownName).toBe("Inventory rules: Grid (Basil's sheet)");
  });

  it('nennt die gewählten Verfahren mit einem Satz', () => {
    const m: Entity = { id: 'm1', interfaces: ['AbilityMethod'], components: { Identity: { name: '4d6' }, AbilityMethod: { method: 'roll', dice: '4d6kh3', scope: 'party' } } };
    const s = ruleOptionsOf(kampagne({}, [{ type: 'allowsMethod', to: 'm1' }]), ctx(new Map([['m1', m]])));
    const am = option(s, 'abilityMethods').methods!;
    expect(am).toHaveLength(1);
    expect(am[0]).toMatchObject({ id: 'm1', builtIn: false });
    expect(am[0]!.does).toContain('whole party');
  });

  it('schreibt Einstellungen der Installation aus und sagt, dass sie für alle gelten', () => {
    const s = ruleOptionsOf(null, ctx(undefined, { units: 'metric', 'container:Backpack': '###', carrySquares: '' }));
    expect(option(s, 'units')).toMatchObject({ scope: 'installation', value: ['units: metric'] });
    expect(option(s, 'carrying').value).toEqual(['Backpack: ###']);
  });

  it('zeigt Basils Raster nur, wenn die Kampagne nach Raster zählt (T-248)', () => {
    const setz = { 'container:Backpack': '###' };
    expect(option(ruleOptionsOf(null, ctx(undefined, setz)), 'carrying')).toBeDefined();
    expect(option(ruleOptionsOf(kampagne({ inventory: 'grid' }), ctx(undefined, setz)), 'carrying')).toBeDefined();
    for (const inventory of ['weight', 'slots']) {
      const s = ruleOptionsOf(kampagne({ inventory }), ctx(undefined, setz));
      expect(s.flatMap((x) => x.options).some((o) => o.key === 'carrying')).toBe(false);
      /* Die übrigen Optionen der Sorte bleiben. */
      expect(option(s, 'inventory')).toBeDefined();
      expect(option(s, 'stowing')).toBeDefined();
    }
  });

  it('nennt in `when` nur Felder mit Varianten, die es gibt', () => {
    for (const o of RULE_OPTIONS.filter((x) => x.when)) {
      const ziel = RULE_OPTIONS.find((x) => 'field' in x.source && x.source.field === o.when!.field);
      expect(ziel?.variants?.map((v) => v.key)).toEqual(expect.arrayContaining([...o.when!.is]));
    }
  });

  it('sucht jeden Namen, den die Seite verwendet', () => {
    const namen = ruleOptionRuleNames();
    for (const o of RULE_OPTIONS) for (const v of o.variants ?? []) expect(namen).toContain(ownRuleName(o, v));
    expect(namen).toContain('Encumbrance');
  });
});

describe('withRuleVariant', () => {
  it('setzt das Feld der Kampagne, als Wahrheitswert, wo es einer ist', () => {
    const k = kampagne({ inventory: 'grid' });
    expect(withRuleVariant(k, 'inventory', 'slots')!.components['Campaign']).toEqual({ inventory: 'slots' });
    expect(withRuleVariant(k, 'feats', 'false')!.components['Campaign']).toMatchObject({ feats: false });
    expect(withRuleVariant(k, 'revealOnMove', 'true')!.components['Campaign']).toMatchObject({ revealOnMove: true });
    const s = ruleOptionsOf(withRuleVariant(k, 'craftFailure', 'nothingLost'), ctx());
    expect(option(s, 'craftFailure').variants!.find((v) => v.chosen)?.key).toBe('nothingLost');
  });
  it('lässt Kanten, Einstellungen und fremde Varianten', () => {
    const k = kampagne({});
    expect(withRuleVariant(k, 'abilityMethods', 'x')).toBeNull();
    expect(withRuleVariant(k, 'units', 'metric')).toBeNull();
    expect(withRuleVariant(k, 'inventory', 'bag')).toBeNull();
  });
});
