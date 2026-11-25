import { describe, expect, it } from 'vitest';
import {
  applyRoll,
  blueprintKnown,
  craftCheck,
  craftRuleSentences,
  craftRulesOf,
  nextMark,
  orderChecks,
  orderNeed,
  reserveIn,
  rollResult,
  setCheck,
  settlePieces,
  tallyChecks,
  type OrderCheck,
} from '../src/crafting.js';
import type { Entity } from '../src/types.js';

/* Erfundene Artikel: ein Kräuterset, zwei Rezepte, eine Runde mit Gruppe
   und Figur. Kein Buchinhalt (T-122). */
const art = (id: string, typ: string, name: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: {}, relations: [], ...extra,
});
const kit = art('kit', 'Item', 'Herbal kit');
const salbe = art('salbe', 'Recipe', 'Salve', { components: { Recipe: { tool: 'Herbal kit', ability: 'int', dc: 12 } } });
const leer = art('leer', 'Recipe', 'Plain');

function welt(...es: Entity[]) {
  const m = new Map([kit, salbe, leer, ...es].map((e) => [e.id, e]));
  return (id: string) => m.get(id);
}

describe('craftCheck (T-122): die Vorgabe der Quelle und wer davon abweicht', () => {
  it('liest ohne Kontext das Rezept, ohne Angabe die Vorgaben', () => {
    expect(craftCheck(salbe, { get: welt() })).toMatchObject({ tool: 'Herbal kit', ability: 'int', dc: 12, source: { ability: { by: 'recipe' } } });
    expect(craftCheck(leer, { get: welt() })).toMatchObject({ tool: '', ability: 'int', dc: 12 });
  });

  it('eine Kampagne stellt alles mit dem Werkzeug auf ein anderes Attribut', () => {
    const k = art('k', 'Campaign', 'Run', { relations: [{ id: 'r', type: 'craftsWith', to: 'kit', props: { ability: 'wis' } }] });
    const c = craftCheck(salbe, { get: welt(k), campaign: k });
    expect(c).toMatchObject({ tool: 'Herbal kit', ability: 'wis', dc: 12 });
    expect(c.source.ability).toEqual({ by: 'campaign', holder: 'k', on: 'tool' });
    // Ein Rezept ohne dieses Werkzeug bleibt, wie es ist.
    expect(craftCheck(leer, { get: welt(k), campaign: k }).ability).toBe('int');
  });

  it('Spezifischeres schlägt: Gruppe vor Kampagne, Figur vor Gruppe, Rezept vor Werkzeug', () => {
    const k = art('k', 'Campaign', 'Run', { relations: [{ id: 'r1', type: 'craftsWith', to: 'kit', props: { ability: 'wis', dc: 10 } }] });
    const g = art('g', 'Party', 'Band', { relations: [{ id: 'r2', type: 'craftsWith', to: 'salbe', props: { dc: 14 } }] });
    const f = art('f', 'Creature', 'Ash', {
      relations: [
        { id: 'r3', type: 'memberOfParty', to: 'g' },
        { id: 'r4', type: 'craftsWith', to: 'salbe', props: { ability: 'dex', tool: 'Mortar' } },
        { id: 'r5', type: 'craftsWith', to: 'kit', props: { ability: 'cha' } },
      ],
    });
    const c = craftCheck(salbe, { get: welt(k, g, f), campaign: k, actor: f });
    expect(c).toMatchObject({ tool: 'Mortar', ability: 'dex', dc: 14 });
    expect(c.source.dc).toEqual({ by: 'party', holder: 'g', on: 'recipe' });
    expect(c.source.ability).toEqual({ by: 'actor', holder: 'f', on: 'recipe' });
  });

  it('eine Kante am Werkzeug tauscht das Werkzeug nicht', () => {
    const k = art('k', 'Campaign', 'Run', { relations: [{ id: 'r', type: 'craftsWith', to: 'kit', props: { tool: 'Mortar' } }] });
    expect(craftCheck(salbe, { get: welt(k), campaign: k }).tool).toBe('Herbal kit');
  });
});

describe('Fertigungsauftrag (T-128): Regeln, Probe, Abrechnung', () => {
  const regeln = craftRulesOf(null);
  const proben = { unit: 'checks' as const, needed: 3 };

  it('Vorgaben ohne Kampagne, Unsinn fällt auf die Vorgabe', () => {
    expect(regeln).toEqual({ failure: 'halfLost', critSuccess: 'asSuccess', critFailure: 'asFailure', confirm: 'gm', learning: 'taught', learnRarity: 'common' });
    const k = art('k', 'Campaign', 'Run', { components: { Campaign: { craftFailure: 'quatsch', craftConfirm: 'player' } } });
    expect(craftRulesOf(k)).toMatchObject({ failure: 'halfLost', confirm: 'player' });
    // Das alte „dem Rezept folgen" gibt es nicht mehr (T-165).
    const alt = art('k', 'Campaign', 'Run', { components: { Campaign: { craftFailure: 'recipe' } } });
    expect(craftRulesOf(alt).failure).toBe('halfLost');
  });

  it('Proben zählen, sonst Tage mit einer Probe am Ende', () => {
    expect(orderNeed(art('r', 'Recipe', 'R', { components: { Recipe: { checks: 4, days: 2 } } }))).toEqual({ unit: 'checks', needed: 4 });
    expect(orderNeed(art('r', 'Recipe', 'R', { components: { Recipe: { days: 2 } } }))).toEqual({ unit: 'days', needed: 2 });
    expect(orderNeed(leer)).toEqual({ unit: 'days', needed: 1 });
    expect(rollResult(12, 12)).toBe('success');
    expect(rollResult(30, 12, 1)).toBe('critFailure');
  });

  it('eine misslungene Probe nach der Regel der Kampagne', () => {
    const st = { progress: 2, outcome: 'open' as const };
    expect(applyRoll(st, 'failure', proben, { ...regeln, failure: 'nothingLost' })).toMatchObject({ outcome: 'failed', settle: 'all' });
    expect(applyRoll(st, 'failure', proben, regeln)).toMatchObject({ outcome: 'failed', settle: 'half' });
    expect(applyRoll(st, 'failure', proben, { ...regeln, failure: 'progressLost' })).toMatchObject({ outcome: 'open', progress: 0 });
    expect(applyRoll(st, 'critFailure', proben, { ...regeln, failure: 'noProgress', critFailure: 'materialsLost' })).toMatchObject({ outcome: 'failed', settle: 'none' });
    expect(applyRoll(st, 'critSuccess', { unit: 'checks', needed: 5 }, { ...regeln, critSuccess: 'double' })).toMatchObject({ progress: 4, outcome: 'open' });
    expect(applyRoll(st, 'success', proben, regeln)).toMatchObject({ progress: 3, outcome: 'succeeded', settle: 'success' });
  });

  it('die Regeln in Sätzen, einer je Regel', () => {
    expect(craftRuleSentences(regeln)).toEqual([
      'On a failed check: the work fails and half the materials are lost.',
      'On a natural 20: an ordinary success.',
      'On a natural 1: counts as a failed check.',
      'Checks by players count once the GM accepts them.',
      'Known: only blueprints that were taught.',
    ]);
    expect(craftRuleSentences({ failure: 'noProgress', critSuccess: 'double', critFailure: 'materialsLost', confirm: 'player', learning: 'rarity', learnRarity: 'common' })).toEqual([
      'On a failed check: the check simply does not count.',
      'On a natural 20: the check counts twice.',
      'On a natural 1: the work fails and the materials are lost.',
      'Checks by players count at once.',
      'Known: every blueprint up to common for a tool the character is proficient in, and what was taught.',
    ]);
  });

  it('abrechnen: nicht Verbrauchtes kommt immer zurück, die Hälfte abgerundet', () => {
    const stuecke = [{ inventory: 'i', edge: 'a', item: 'kraut', qty: 3 }, { inventory: 'i', edge: 'b', item: 'moerser', qty: 1 }];
    const verbraucht = (item: string) => item !== 'moerser';
    expect(settlePieces(stuecke, verbraucht, 'success').map((x) => x.keep)).toEqual([0, 1]);
    expect(settlePieces(stuecke, verbraucht, 'half').map((x) => x.keep)).toEqual([1, 1]);
    expect(settlePieces(stuecke, verbraucht, 'all').map((x) => x.keep)).toEqual([3, 1]);
  });

  it('reservieren teilt den Stapel und sagt nein, wo es nicht geht', () => {
    const inv = art('i', 'Inventory', 'Pack', { relations: [{ id: 'h', type: 'holds', to: 'kraut', props: { qty: 5, gx: 1, gy: 0 } }] });
    const r = reserveIn(inv, 'h', 2, 'o', 'neu');
    if ('refused' in r) throw new Error(r.refused);
    expect(r.edge).toBe('neu');
    expect(r.inventory.relations).toEqual([
      { id: 'h', type: 'holds', to: 'kraut', props: { qty: 3, gx: 1, gy: 0 } },
      { id: 'neu', type: 'holds', to: 'kraut', props: { qty: 2, reservedFor: 'o' } },
    ]);
    expect(reserveIn(r.inventory, 'neu', 1, 'p', 'x')).toEqual({ refused: 'reserved' });
    expect(reserveIn(inv, 'h', 6, 'o', 'x')).toEqual({ refused: 'short' });
  });
});

describe('Proben als Kreise (T-165): Zyklus, Anwenden und Zurücknehmen je Regel', () => {
  const regeln = craftRulesOf(null);
  const drei = { unit: 'checks' as const, needed: 3 };
  const k = (mark: OrderCheck['mark'], extra: Partial<OrderCheck> = {}): OrderCheck => ({ mark, ...extra });
  const marken = (t: ReturnType<typeof tallyChecks>) => t.circles.map((c) => c.mark ?? '·').join(' ');

  it('der Klick: leer → ✓ → ✗ → leer, ein Wurf geht wie sein Zeichen weiter', () => {
    expect(nextMark(null)).toBe('success');
    expect(nextMark('success')).toBe('failure');
    expect(nextMark('failure')).toBeNull();
    expect(nextMark('critSuccess')).toBe('failure');
    expect(nextMark('critFailure')).toBeNull();
  });

  it('setzen und leeren; leere Kreise am Ende fallen weg, Unsinn wird leer', () => {
    expect(setCheck([], 2, k('success'))).toEqual([null, null, k('success')]);
    expect(setCheck([k('success'), k('failure')], 1, null)).toEqual([k('success')]);
    expect(orderChecks({ checks: [k('success'), { mark: 'quatsch' }, 3, null] })).toEqual([k('success'), null, null, null]);
    expect(orderChecks({})).toEqual([]);
  });

  it('je fehlende Probe ein leerer Kreis', () => {
    const t = tallyChecks([], drei, regeln);
    expect(marken(t)).toBe('· · ·');
    expect(t.circles.every((c) => c.open)).toBe(true);
    const zwei = tallyChecks([k('success'), k('success')], drei, regeln);
    expect(marken(zwei)).toBe('success success ·');
    expect(zwei).toMatchObject({ progress: 2, outcome: 'open', settle: null });
    // Eine Lücke zählt als leerer Kreis — es kommen keine weiteren dazu.
    expect(marken(tallyChecks([null, k('success')], drei, regeln))).toBe('· success ·');
  });

  it('Verlustregel: ein ✗ entscheidet, Kreise danach zählen nicht; ohne ✗ ist alles zurück', () => {
    const checks = [k('success'), k('failure'), k('success')];
    const t = tallyChecks(checks, drei, regeln);
    expect(t).toMatchObject({ outcome: 'failed', settle: 'half', progress: 1 });
    expect(t.circles.map((c) => c.ignored)).toEqual([false, false, true]);
    expect(t.lines.map((l) => l.index)).toEqual([0, 1]);
    const zurueck = tallyChecks(setCheck(checks, 1, null), drei, regeln);
    expect(zurueck).toMatchObject({ outcome: 'open', settle: null, progress: 2 });
    expect(tallyChecks(checks, drei, { ...regeln, failure: 'materialsLost' }).settle).toBe('none');
    expect(tallyChecks(checks, drei, { ...regeln, failure: 'nothingLost' }).settle).toBe('all');
  });

  it('kein Fortschritt: der ✗ zählt nicht, ein Kreis mehr', () => {
    const t = tallyChecks([k('success'), k('failure')], drei, { ...regeln, failure: 'noProgress' });
    expect(t).toMatchObject({ outcome: 'open', progress: 1 });
    expect(marken(t)).toBe('success failure · ·');
  });

  it('Fortschritt verloren: von vorn, und zurückgeklickt wieder da', () => {
    const r = { ...regeln, failure: 'progressLost' as const };
    const t = tallyChecks([k('success'), k('success'), k('failure')], drei, r);
    expect(t).toMatchObject({ outcome: 'open', progress: 0 });
    expect(marken(t)).toBe('success success failure · · ·');
    expect(tallyChecks([k('success'), k('success'), null], drei, r).progress).toBe(2);
  });

  it('die Leitung entscheidet: der Auftrag hält an, die Proben zählen weiter', () => {
    const t = tallyChecks([k('failure')], drei, { ...regeln, failure: 'custom' });
    expect(t).toMatchObject({ outcome: 'open', lines: [{ index: 0, note: 'Failure — the GM decides.' }] });
  });

  it('natürliche 20 doppelt, natürliche 1 nach eigener Regel', () => {
    expect(tallyChecks([k('critSuccess'), k('success')], drei, { ...regeln, critSuccess: 'double' })).toMatchObject({ outcome: 'succeeded', settle: 'success', progress: 3 });
    expect(tallyChecks([k('critFailure')], drei, { ...regeln, failure: 'noProgress', critFailure: 'materialsLost' })).toMatchObject({ outcome: 'failed', settle: 'none' });
    expect(tallyChecks([k('critFailure')], drei, { ...regeln, failure: 'noProgress' }).outcome).toBe('open');
  });

  it('wartende Kreise zählen erst angenommen — und nur, solange die Regel es verlangt', () => {
    const checks = [k('success', { pending: true }), k('success')];
    const t = tallyChecks(checks, drei, regeln);
    expect(t).toMatchObject({ progress: 1, waiting: 1 });
    expect(t.circles[0]).toMatchObject({ pending: true });
    expect(marken(t)).toBe('success success ·');
    expect(tallyChecks(checks, drei, { ...regeln, confirm: 'player' })).toMatchObject({ progress: 2, waiting: 0 });
  });

  it('nach Tagen: der Kreis wartet auf die Tage; Fortschritt verloren verlangt neue', () => {
    const tage = { unit: 'days' as const, needed: 2 };
    expect(tallyChecks([], tage, regeln, 1)).toMatchObject({ daysLeft: 1, progress: 1 });
    expect(tallyChecks([], tage, regeln, 1).circles).toEqual([expect.objectContaining({ mark: null, open: false })]);
    expect(tallyChecks([k('success')], tage, regeln, 1).circles[0]).toMatchObject({ ignored: true });
    expect(tallyChecks([k('success')], tage, regeln, 2)).toMatchObject({ outcome: 'succeeded', settle: 'success' });
    const r = { ...regeln, failure: 'progressLost' as const };
    const verloren = tallyChecks([k('failure')], tage, r, 2);
    expect(verloren).toMatchObject({ outcome: 'open', daysLeft: 2, progress: 0 });
    expect(verloren.circles[1]).toMatchObject({ mark: null, open: false });
    expect(tallyChecks([k('failure'), k('success')], tage, r, 4)).toMatchObject({ outcome: 'succeeded' });
  });
});

describe('known blueprints (T-280, REQ-349)', () => {
  const regeln = (learning: 'all' | 'taught' | 'rarity', learnRarity = 'common') => ({ learning, learnRarity });
  it('knows everything under Kibbles, only what was taught otherwise', () => {
    expect(blueprintKnown(regeln('all'), { taught: false, toolOk: false, rarity: 'legendary' })).toBe(true);
    expect(blueprintKnown(regeln('taught'), { taught: false, toolOk: true, rarity: 'none' })).toBe(false);
    expect(blueprintKnown(regeln('taught'), { taught: true, toolOk: false, rarity: 'rare' })).toBe(true);
  });
  it('by rarity: up to the campaign’s rarity, for a tool the character is proficient in', () => {
    expect(blueprintKnown(regeln('rarity'), { taught: false, toolOk: true, rarity: 'common' })).toBe(true);
    expect(blueprintKnown(regeln('rarity'), { taught: false, toolOk: true, rarity: 'none' })).toBe(true);
    expect(blueprintKnown(regeln('rarity'), { taught: false, toolOk: true, rarity: 'uncommon' })).toBe(false);
    expect(blueprintKnown(regeln('rarity'), { taught: false, toolOk: false, rarity: 'common' })).toBe(false);
    expect(blueprintKnown(regeln('rarity', 'rare'), { taught: false, toolOk: true, rarity: 'uncommon' })).toBe(true);
    expect(blueprintKnown(regeln('rarity'), { taught: false, toolOk: true, rarity: 'varies' })).toBe(false);
    expect(blueprintKnown(regeln('rarity'), { taught: true, toolOk: false, rarity: 'legendary' })).toBe(true);
  });
  it('reads the rule at the campaign, taught when it says nothing', () => {
    expect(craftRulesOf(null)).toMatchObject({ learning: 'taught', learnRarity: 'common' });
    const k = { id: 'k', interfaces: ['Campaign'], name: 'k', components: { Campaign: { craftLearning: 'rarity', craftLearnRarity: 'uncommon' } }, relations: [] };
    expect(craftRulesOf(k)).toMatchObject({ learning: 'rarity', learnRarity: 'uncommon' });
  });
});
