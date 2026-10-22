/**
 * **Die Grössenregel eines Tokens** (T-390, REQ-396): Statblock →
 * Wirkungen → Überschreibung am Token, mit Herkunft. Erfundene Artikel.
 */
import { describe, expect, it } from 'vitest';
import {
  creatureSize,
  creatureSizeEffects,
  effectText,
  sizeEffects,
  sizeWithEffects,
  tokenSizeOf,
  type ActiveEffect,
} from '../src/index.js';
import type { Entity } from '../src/types.js';

const fx = (target: string, op: string, value: number | string | undefined, source = 'q'): ActiveEffect => ({
  effect: { id: `${target}-${op}`, target, op, ...(value === undefined ? {} : { value }) },
  source,
  via: 'condition',
});

describe('creatureSize', () => {
  it('kennt die sechs Grössen, gross oder klein geschrieben', () => {
    expect(creatureSize('Huge')).toBe('huge');
    expect(creatureSize(' tiny ')).toBe('tiny');
    expect(creatureSize('L')).toBeNull();
    expect(creatureSize(null)).toBeNull();
    expect(creatureSize('')).toBeNull();
  });
});

describe('sizeEffects', () => {
  it('ohne Grössen-Wirkung: nichts', () => {
    expect(sizeEffects([])).toEqual({ steps: 0, sources: [] });
    expect(sizeEffects([fx('ac', 'add', 1)])).toEqual({ steps: 0, sources: [] });
  });
  it('zählt Stufen zusammen und nennt die Quellen einmal', () => {
    expect(sizeEffects([fx('size', 'add', 1, 'a'), fx('size', 'add', 1, 'b'), fx('size', 'add', -1, 'a')])).toEqual({ steps: 1, sources: ['a', 'b'] });
  });
  it('eine gesetzte Grösse: die grösste gilt', () => {
    expect(sizeEffects([fx('size', 'set', 'large', 'a'), fx('size', 'set', 'Huge', 'b')]).set).toBe('huge');
  });
  it('überspringt Unsinn: kein Wert, keine Grösse, keine Zahl, 0, unbekannte Art', () => {
    const r = sizeEffects([fx('size', 'add', undefined), fx('size', 'set', 'riesig'), fx('size', 'add', 'viel'), fx('size', 'add', 0), fx('size', 'grant', 'large')]);
    expect(r).toEqual({ steps: 0, sources: [] });
  });
});

describe('sizeWithEffects', () => {
  it('ohne Wirkungen bleibt die Grösse des Statblocks', () => {
    expect(sizeWithEffects('Large', null)).toBe('large');
    expect(sizeWithEffects('Large', { steps: 0, sources: [] })).toBe('large');
    expect(sizeWithEffects(null, undefined)).toBeNull();
  });
  it('Enlarge: eine Stufe grösser; Reduce: eine kleiner', () => {
    expect(sizeWithEffects('medium', { steps: 1, sources: [] })).toBe('large');
    expect(sizeWithEffects('huge', { steps: -1, sources: [] })).toBe('large');
  });
  it('begrenzt auf Tiny … Gargantuan', () => {
    expect(sizeWithEffects('gargantuan', { steps: 2, sources: [] })).toBe('gargantuan');
    expect(sizeWithEffects('small', { steps: -5, sources: [] })).toBe('tiny');
  });
  it('setzt zuerst, verschiebt dann', () => {
    expect(sizeWithEffects('small', { set: 'large', steps: 1, sources: [] })).toBe('huge');
  });
  it('ohne Grösse am Statblock zählt eine Wirkung von Medium aus', () => {
    expect(sizeWithEffects(null, { steps: 1, sources: [] })).toBe('large');
  });
});

describe('tokenSizeOf: Statblock → Wirkungen → Token', () => {
  it('Statblock: Large 2 × 2, Huge 3 × 3, Gargantuan 4 × 4', () => {
    expect(tokenSizeOf(null, 'large', null)).toEqual({ span: 2, size: 'large', from: 'statblock' });
    expect(tokenSizeOf(null, 'huge', null)).toEqual({ span: 3, size: 'huge', from: 'statblock' });
    expect(tokenSizeOf(null, 'gargantuan', null)).toEqual({ span: 4, size: 'gargantuan', from: 'statblock' });
  });
  it('Tiny nach der Regeloption der Kampagne', () => {
    expect(tokenSizeOf(null, 'tiny', null).span).toBe(1);
    expect(tokenSizeOf(null, 'tiny', null, 'tinyHalf').span).toBe(0.5);
  });
  it('Wirkungen vor dem Statblock', () => {
    expect(tokenSizeOf(null, 'medium', { steps: 1, sources: ['x'] })).toEqual({ span: 2, size: 'large', from: 'effects' });
  });
  it('die Leitung am Token schlägt beides', () => {
    expect(tokenSizeOf(1, 'huge', { steps: 1, sources: [] })).toEqual({ span: 1, size: 'gargantuan', from: 'token' });
  });
  it('ohne Grösse: ein Feld, Herkunft default', () => {
    expect(tokenSizeOf(null, undefined, null)).toEqual({ span: 1, size: null, from: 'default' });
    expect(tokenSizeOf(0, 'L', null)).toEqual({ span: 1, size: null, from: 'default' });
  });
});

describe('creatureSizeEffects', () => {
  const ident = (name: string) => ({ Identity: { name, id: name, aliases: [] } });
  const gross: Entity = { id: 'c_gross', name: 'Enlarged', interfaces: ['Condition'], components: { ...ident('Enlarged'), Effects: { effects: [{ id: 'size', target: 'size', op: 'add', value: 1 }] } }, relations: [] };
  const zwerg: Entity = { id: 'cr', name: 'Brakka', interfaces: ['Creature'], components: { ...ident('Brakka'), Vitals: { conditions: ['c_gross'] } }, relations: [] };
  const sb: Entity = { id: 'sb', name: 'Werte', interfaces: ['Statblock'], components: { ...ident('Werte'), Statblock: { size: 'medium' } }, relations: [{ id: 'bt', type: 'belongsTo', to: 'cr', props: {} }] };
  const byId = new Map([gross, zwerg, sb].map((e) => [e.id, e]));

  it('liest Zustände an Vitals', () => {
    expect(creatureSizeEffects(zwerg, byId)).toEqual({ steps: 1, sources: ['c_gross'] });
  });
  it('liest Zustände aus der Initiative, und derselbe Zustand zählt einmal (E-164)', () => {
    expect(creatureSizeEffects(zwerg, byId, { conditions: ['c_gross'] })).toEqual({ steps: 1, sources: ['c_gross'] });
    const ohne = { ...zwerg, components: { ...zwerg.components, Vitals: {} } };
    expect(creatureSizeEffects(ohne, new Map([...byId, ['cr', ohne]]), { conditions: ['c_gross'] }).steps).toBe(1);
  });
});

describe('effectText für die Grösse', () => {
  it('nennt Stufen und gesetzte Grössen', () => {
    expect(effectText({ id: 's', target: 'size', op: 'add', value: 1 })).toBe('one size larger');
    expect(effectText({ id: 's', target: 'size', op: 'add', value: -2 })).toBe('2 sizes smaller');
    expect(effectText({ id: 's', target: 'size', op: 'set', value: 'large' })).toBe('size becomes large');
  });
});
