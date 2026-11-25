import { describe, expect, it } from 'vitest';
import {
  materialsOf,
  recipesOfTool,
  recipesOfTrade,
  recipeTools,
  tradeKeys,
  tradeOfRecipe,
  tradesOfTool,
} from '../src/crafting.js';
import type { Entity } from '../src/types.js';

/* Erfundene Berufe und Rezepte (T-196) — kein Buchinhalt. */
const beruf = (id: string, name: string, tools: string[], aliases: string[] = []): Entity => ({
  id,
  interfaces: ['Trade'],
  components: { Identity: { name, id, aliases }, Trade: { tools } },
  relations: [],
});
const rezept = (id: string, trade: string, tool = '', needs: [string, number][] = []): Entity => ({
  id,
  interfaces: ['Recipe'],
  components: { Identity: { name: id, id }, Recipe: { trade, ...(tool ? { tool } : {}) } },
  relations: needs.map(([to, qty], i) => ({ id: `${id}~n${i}`, type: 'needs', to, props: { qty } })),
});

const schmieden = beruf('t1', 'Smithing', ["Smith's Tools"], ['Crafting: Smithing']);
const brauen = beruf('t2', 'Brewing', ["Brewer's Kit", "Cook's Pot"]);
const berufe = [schmieden, brauen];
const nagel = rezept('nagel', 'smithing', '', [['eisen', 1]]);
const klinge = rezept('klinge', 'Smithing', '', [['eisen', 3], ['kohle', 1]]);
const ale = rezept('ale', 'Brewing', '', [['malz', 2]]);
const suppe = rezept('suppe', 'Brewing', "Cook's Pot");
const fremd = rezept('fremd', 'Weaving');
const rezepte = [nagel, klinge, ale, suppe, fremd];

describe('Berufe und Werkzeuge (T-196)', () => {
  it('ein Beruf findet seine Rezepte über Name und Alias, ohne Gross und klein', () => {
    expect([...tradeKeys(schmieden)]).toEqual(['smithing', 'crafting: smithing']);
    expect(recipesOfTrade(rezepte, schmieden).map((r) => r.id)).toEqual(['nagel', 'klinge']);
    expect(tradeOfRecipe(berufe, fremd)).toBeNull();
  });

  it('das Werkzeug des Rezepts schlägt die Werkzeuge seines Berufs', () => {
    expect(recipeTools(ale, berufe)).toEqual(["Brewer's Kit", "Cook's Pot"]);
    expect(recipeTools(suppe, berufe)).toEqual(["Cook's Pot"]);
    expect(recipeTools(fremd, berufe)).toEqual([]);
  });

  it('ein Werkzeug zeigt seine Berufe und was es möglich macht', () => {
    expect(tradesOfTool(berufe, "cook's pot").map((b) => b.id)).toEqual(['t2']);
    expect(recipesOfTool(rezepte, berufe, "Brewer's Kit").map((r) => r.id)).toEqual(['ale']);
    expect(recipesOfTool(rezepte, berufe, "Cook's Pot").map((r) => r.id)).toEqual(['ale', 'suppe']);
    expect(recipesOfTool(rezepte, berufe, '')).toEqual([]);
  });

  it('das Material zählt Rezepte und Menge', () => {
    expect(materialsOf([nagel, klinge])).toEqual([
      { item: 'eisen', recipes: 2, qty: 4 },
      { item: 'kohle', recipes: 1, qty: 1 },
    ]);
  });
});
