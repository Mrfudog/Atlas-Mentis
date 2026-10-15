import { describe, expect, it } from 'vitest';
import { coverage, materialFit, substitutionOf, substitutionsOf, substitutionText, type Entity } from '../src/index.js';

/* Ersatzmaterialien und Materialgruppen (T-197). Erfundene Artikel. */

const RAR = ['none', 'common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', 'varies', 'unknown'];
const stoff = (id: string, name: string, materialType: string, rarity: string, tags: string[] = []): Entity => ({
  id,
  interfaces: ['Material'],
  components: { Identity: { name }, Material: { materialType }, Item: { rarity }, Tags: { tags } },
});
const gruppe = (felder: Record<string, unknown>): Entity => ({
  id: 'grp',
  interfaces: ['MaterialGroup'],
  components: { Identity: { name: 'Any reagent' }, MaterialGroup: felder },
});
const ersatz = (felder: Record<string, unknown>, id = 'sub'): Entity => ({
  id,
  interfaces: ['Substitution'],
  components: { Identity: { name: 'Herbs for reagents' }, Substitution: felder },
});

const reagenz = stoff('r-u', 'Uncommon Glow Reagent', 'reagent', 'uncommon');
const reagenzSelten = stoff('r-r', 'Rare Glow Reagent', 'reagent', 'rare');
const reagenzGewoehnlich = stoff('r-c', 'Common Glow Reagent', 'reagent', 'common');
const kraut = stoff('k-u', 'Uncommon Bitterleaf', 'herb', 'uncommon');
const krautGewoehnlich = stoff('k-c', 'Common Bitterleaf', 'herb', 'common');
const barren = stoff('b', 'Iron Bar', 'ingot', 'common');
const ohne = { rarities: RAR, substitutions: [] };

describe('materialFit', () => {
  it('nimmt den genannten Gegenstand und sagt bei anderem, warum nicht', () => {
    expect(materialFit(reagenz, reagenz, ohne)).toEqual({ ok: true, ratio: 1 });
    const nein = materialFit(reagenz, reagenzSelten, ohne);
    expect(nein).toEqual({ ok: false, reason: 'not Uncommon Glow Reagent' });
  });

  it('eine Gruppe prüft Materialart, Seltenheit und Marken', () => {
    const g = gruppe({ materialTypes: ['reagent'], rarityMin: 'uncommon' });
    expect(materialFit(g, reagenz, ohne).ok).toBe(true);
    expect(materialFit(g, reagenzSelten, ohne).ok).toBe(true);
    expect(materialFit(g, reagenzGewoehnlich, ohne)).toEqual({ ok: false, reason: 'rarity common, below uncommon' });
    expect(materialFit(g, barren, ohne)).toEqual({ ok: false, reason: 'material type ingot, not reagent; rarity common, below uncommon' });
    const mitMarke = gruppe({ tags: ['glowing'] });
    expect(materialFit(mitMarke, stoff('x', 'X', 'ore', 'none', ['glowing']), ohne).ok).toBe(true);
    expect(materialFit(mitMarke, barren, ohne)).toEqual({ ok: false, reason: 'not tagged glowing' });
  });

  it('eine Gruppe nimmt, was sie beim Namen nennt, und „varies" lässt sich nicht vergleichen', () => {
    const g = gruppe({ materialTypes: ['reagent'], rarityMax: 'uncommon', items: ['Iron Bar'] });
    expect(materialFit(g, barren, ohne).ok).toBe(true);
    expect(materialFit(g, stoff('v', 'Odd Reagent', 'reagent', 'varies'), ohne)).toEqual({ ok: false, reason: 'rarity varies cannot be compared' });
    expect(materialFit(g, reagenzSelten, ohne)).toEqual({ ok: false, reason: 'rarity rare, above uncommon' });
  });

  it('eine Ersatzregel lässt eine andere Materialart in gleicher Seltenheit einspringen', () => {
    const regel = substitutionOf(ersatz({ replaces: ['Reagent'], with: ['herb'] }));
    const ctx = { rarities: RAR, substitutions: [regel] };
    expect(materialFit(reagenz, kraut, ctx)).toEqual({ ok: true, via: { id: 'sub', name: 'Herbs for reagents' }, ratio: 1 });
    expect(materialFit(reagenz, krautGewoehnlich, ctx)).toEqual({
      ok: false,
      reason: 'not Uncommon Glow Reagent; as Herbs for reagents: rarity common, needs uncommon',
    });
    // Was die Regel nicht ersetzt, bleibt beim Rezept.
    expect(materialFit(barren, kraut, ctx)).toEqual({ ok: false, reason: 'not Iron Bar' });
  });

  it('„atLeast" und „ratio" — und an einer Gruppe gilt deren Untergrenze', () => {
    const regel = substitutionOf(ersatz({ replaces: ['reagent'], with: ['herb'], rarity: 'atLeast', ratio: 2 }));
    const ctx = { rarities: RAR, substitutions: [regel] };
    expect(materialFit(reagenzGewoehnlich, kraut, ctx)).toMatchObject({ ok: true, ratio: 2 });
    const g = gruppe({ materialTypes: ['reagent'], rarityMin: 'uncommon' });
    expect(materialFit(g, kraut, ctx)).toMatchObject({ ok: true, ratio: 2 });
    expect(materialFit(g, krautGewoehnlich, ctx).ok).toBe(false);
  });
});

describe('Ersatzregeln an der Kampagne', () => {
  it('liest die Kanten allowsSubstitution und beschreibt die Regel in einem Satz', () => {
    const e = ersatz({ replaces: ['reagent'], with: ['herb'], withTags: ['plant'], ratio: 2 });
    const kampagne: Entity = { id: 'k', interfaces: ['Campaign'], components: {}, relations: [{ type: 'allowsSubstitution', to: 'sub' }, { type: 'allowsSubstitution', to: 'weg' }] };
    const regeln = substitutionsOf(kampagne, (id) => (id === 'sub' ? e : undefined));
    expect(regeln.map((r) => r.id)).toEqual(['sub']);
    expect(substitutionText(regeln[0]!)).toBe('2 pieces of herb or anything tagged plant of the same rarity may stand in for one reagent.');
    expect(substitutionsOf(null, () => undefined)).toEqual([]);
  });
});

describe('coverage', () => {
  it('zählt Ersatz nach seinem Verhältnis und sagt, was fehlt oder zu viel ist', () => {
    const needs = [{ key: 'n1', name: 'Reagent', qty: 2, consumed: true }];
    expect(coverage(needs, [{ need: 'n1', qty: 1, ratio: 1 }, { need: 'n1', qty: 2, ratio: 2 }])[0]).toMatchObject({ covered: 2, short: 0, over: false });
    expect(coverage(needs, [{ need: 'n1', qty: 1, ratio: 2 }])[0]).toMatchObject({ covered: 0.5, short: 1.5, over: false });
    expect(coverage(needs, [{ need: 'n1', qty: 3, ratio: 1 }])[0]).toMatchObject({ over: true });
  });
});
