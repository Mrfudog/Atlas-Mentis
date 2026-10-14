import { describe, expect, it } from 'vitest';
import { craftCheck } from '../src/crafting.js';
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
