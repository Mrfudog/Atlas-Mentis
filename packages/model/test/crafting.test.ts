import { describe, expect, it } from 'vitest';
import { applyRoll, craftCheck, craftRulesOf, orderNeed, reserveIn, rollResult, settlePieces } from '../src/crafting.js';
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
    expect(regeln).toEqual({ failure: 'recipe', critSuccess: 'asSuccess', critFailure: 'asFailure', confirm: 'gm' });
    const k = art('k', 'Campaign', 'Run', { components: { Campaign: { craftFailure: 'quatsch', craftConfirm: 'player' } } });
    expect(craftRulesOf(k)).toMatchObject({ failure: 'recipe', confirm: 'player' });
  });

  it('Proben zählen, sonst Tage mit einer Probe am Ende', () => {
    expect(orderNeed(art('r', 'Recipe', 'R', { components: { Recipe: { checks: 4, days: 2 } } }))).toEqual({ unit: 'checks', needed: 4 });
    expect(orderNeed(art('r', 'Recipe', 'R', { components: { Recipe: { days: 2 } } }))).toEqual({ unit: 'days', needed: 2 });
    expect(orderNeed(leer)).toEqual({ unit: 'days', needed: 1 });
    expect(rollResult(12, 12)).toBe('success');
    expect(rollResult(30, 12, 1)).toBe('critFailure');
  });

  it('eine misslungene Probe nach der Regel', () => {
    const st = { progress: 2, outcome: 'open' as const };
    expect(applyRoll(st, 'failure', proben, regeln, 'nothingLost')).toMatchObject({ outcome: 'failed', settle: 'all' });
    expect(applyRoll(st, 'failure', proben, regeln, undefined)).toMatchObject({ outcome: 'failed', settle: 'half' });
    expect(applyRoll(st, 'failure', proben, { ...regeln, failure: 'progressLost' }, 'materialsLost')).toMatchObject({ outcome: 'open', progress: 0 });
    expect(applyRoll(st, 'critFailure', proben, { ...regeln, failure: 'noProgress', critFailure: 'materialsLost' }, null)).toMatchObject({ outcome: 'failed', settle: 'none' });
    expect(applyRoll(st, 'critSuccess', { unit: 'checks', needed: 5 }, { ...regeln, critSuccess: 'double' }, null)).toMatchObject({ progress: 4, outcome: 'open' });
    expect(applyRoll(st, 'success', proben, regeln, null)).toMatchObject({ progress: 3, outcome: 'succeeded', settle: 'success' });
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
