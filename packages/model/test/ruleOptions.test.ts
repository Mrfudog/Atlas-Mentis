import { describe, expect, it } from 'vitest';
import { indexRuleArticles, missingRuleArticles, ruleOptionsOf, withRuleVariant, RULE_OPTIONS, RULE_SORTS, type Entity } from '../src/index.js';

/* Die Regeloptionen einer Kampagne (T-190). Erfundene Artikel. */

const kampagne = (felder: Record<string, unknown>, relations: Entity['relations'] = []): Entity => ({
  id: 'k',
  interfaces: ['Campaign'],
  components: { Campaign: felder },
  relations,
});

/* Regelartikel (T-270): ein Artikel je System, Regel und Option, wie die Einfuhr sie anlegt. */
const artikel = (kind: string, key: string, name: string, eltern?: string, text?: string): Entity => ({
  id: `r-${kind}-${eltern ?? ''}-${key}`,
  interfaces: ['Rule'],
  components: { Identity: { name }, Rule: { kind, key }, ...(text ? { Description: { description: text } } : {}) },
  relations: eltern ? [{ type: 'partOf', to: eltern }] : [],
});
/** Alle Artikel zum Katalog; `ohne` lässt Schlüssel weg (`regel` oder `regel:option`). */
function alleArtikel(ohne: string[] = []): Entity[] {
  const raus: Entity[] = [];
  for (const s of RULE_SORTS) if (!ohne.includes(s.key)) raus.push(artikel('system', s.key, s.label));
  for (const o of RULE_OPTIONS) {
    if (ohne.includes(o.key)) continue;
    const r = artikel('rule', o.key, o.label, `r-system--${o.sort}`);
    raus.push(r);
    for (const v of o.variants ?? []) if (!ohne.includes(`${o.key}:${v.key}`)) raus.push(artikel('option', v.key, v.label, r.id));
  }
  return raus;
}
const ctx = (byId = new Map<string, Entity>(), settings: Record<string, string> = {}, articles: Entity[] = alleArtikel()) => ({
  byId,
  settings,
  articles,
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

  it('nimmt Namen und Text aus den Artikeln und verweist auf sie (T-270)', () => {
    const arts = alleArtikel().map((e) =>
      e.id === 'r-option-r-rule-r-system--inventory-inventory-weight'
        ? { ...e, components: { ...e.components, Identity: { name: 'Encumbrance' }, Description: { description: 'Carry by weight.' } } }
        : e,
    );
    const inv = option(ruleOptionsOf(null, ctx(undefined, undefined, arts)), 'inventory');
    const w = inv.variants!.find((v) => v.key === 'weight')!;
    expect(w).toMatchObject({ label: 'Encumbrance', does: 'Carry by weight.' });
    expect(w.rule?.id).toBe('r-option-r-rule-r-system--inventory-inventory-weight');
    expect(inv.rule?.name).toBe('Inventory rules');
  });

  it('zeigt nur, wofür ein Artikel steht — die gewählte Option immer', () => {
    const s = ruleOptionsOf(kampagne({ inventory: 'weight' }), ctx(undefined, undefined, alleArtikel(['units', 'doors', 'inventory:slots', 'inventory:weight'])));
    expect(s.some((x) => x.key === 'units')).toBe(false);
    expect(s.flatMap((x) => x.options).some((o) => o.key === 'doors')).toBe(false);
    const inv = option(s, 'inventory');
    expect(inv.variants!.map((v) => v.key)).toEqual(['grid', 'weight']);
    expect(inv.variants!.find((v) => v.key === 'weight')!.rule).toBeUndefined();
  });

  it('ohne Artikel steht nichts da, und missingRuleArticles nennt alles', () => {
    expect(ruleOptionsOf(null, ctx(undefined, undefined, []))).toEqual([]);
    const fehlt = missingRuleArticles([]);
    expect(fehlt.filter((f) => f.kind === 'system')).toHaveLength(RULE_SORTS.length);
    expect(fehlt).toContainEqual(expect.objectContaining({ kind: 'option', key: 'weight', parent: 'inventory', basedOn: ['Variant: Encumbrance', 'Encumbrance'] }));
    expect(missingRuleArticles(alleArtikel())).toEqual([]);
    expect(missingRuleArticles(alleArtikel(['fog:player']))).toEqual([expect.objectContaining({ kind: 'option', key: 'player', parent: 'fog' })]);
  });

  it('hält gleiche Optionsschlüssel verschiedener Regeln auseinander', () => {
    const idx = indexRuleArticles(alleArtikel());
    expect(idx.options.get('doors:gm')).not.toBe(idx.options.get('playerRolls:gm'));
    expect(idx.options.get('doors:gm')).toBeDefined();
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
