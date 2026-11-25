import { describe, expect, it } from 'vitest';
import { applyVisibilityChange, filterArticleRows, playerSetting, type ArticleVisibilityRow } from '../src/index.js';

/* T-387, REQ-368: Sichtbarkeit je Artikel an der Kampagne. */
describe('applyVisibilityChange', () => {
  it('setzt eine Stufe und lässt anderes im Feld stehen', () => {
    expect(applyVisibilityChange({ revealedTo: ['a'], note: 'x' }, { audience: 'gm' })).toEqual({ revealedTo: ['a'], note: 'x', audience: 'gm' });
  });
  it('audience null folgt der Gruppe; ein leeres Feld fällt weg', () => {
    expect(applyVisibilityChange({ audience: 'gm' }, { audience: null })).toBeNull();
    expect(applyVisibilityChange(undefined, { audience: null })).toBeNull();
    expect(applyVisibilityChange({ audience: 'gm', hiddenFrom: ['b'] }, { audience: null })).toEqual({ hiddenFrom: ['b'] });
  });
  it('zeigen nimmt aus hiddenFrom und gibt frei, ohne Doppel', () => {
    expect(applyVisibilityChange({ hiddenFrom: ['a', 'c'], revealedTo: ['a'] }, { player: { bearers: ['a'], mode: 'show' } })).toEqual({
      hiddenFrom: ['c'],
      revealedTo: ['a'],
    });
  });
  it('verbergen nimmt aus revealedTo, mehrere Figuren einer Spielerin zugleich', () => {
    expect(applyVisibilityChange({ revealedTo: ['a', 'b', 'x'] }, { player: { bearers: ['a', 'b'], mode: 'hide' } })).toEqual({
      revealedTo: ['x'],
      hiddenFrom: ['a', 'b'],
    });
  });
  it('folgen nimmt beides weg', () => {
    expect(applyVisibilityChange({ revealedTo: ['a'], hiddenFrom: ['a'] }, { player: { bearers: ['a'], mode: 'follow' } })).toBeNull();
    expect(applyVisibilityChange({ audience: 'players', revealedTo: ['a'] }, { player: { bearers: ['a'], mode: 'follow' } })).toEqual({ audience: 'players' });
  });
  it('follow nimmt alles Eigene, Fremdes bleibt', () => {
    expect(applyVisibilityChange({ audience: 'gm', revealedTo: ['a'], hiddenFrom: ['b'], note: 1 }, { follow: true })).toEqual({ note: 1 });
  });
});

describe('playerSetting', () => {
  it('verborgen schlägt freigegeben; ohne Figuren nichts', () => {
    expect(playerSetting({ revealedTo: ['a'], hiddenFrom: ['b'] }, ['a', 'b'])).toBe('hide');
    expect(playerSetting({ revealedTo: ['a'] }, ['a'])).toBe('show');
    expect(playerSetting({ audience: 'gm' }, ['a'])).toBeNull();
    expect(playerSetting({ hiddenFrom: ['a'] }, [])).toBeNull();
    expect(playerSetting(undefined, ['a'])).toBeNull();
  });
});

describe('filterArticleRows', () => {
  const z = (id: string, name: string, layers: string[], audience: ArticleVisibilityRow['audience'], type = 'Item'): ArticleVisibilityRow => ({
    id,
    name,
    type,
    typeLabel: type,
    layers: layers.map((l) => ({ id: l, name: l.toUpperCase() })),
    audience,
    source: 'default',
  });
  const rows = [z('1', 'Zeta', ['b'], 'gm'), z('2', 'alpha', ['a'], 'public', 'Spell'), z('3', 'Beta', [], 'players'), z('4', 'Alpha', ['a', 'b'], 'campaign')];

  it('sortiert nach Name ohne Gross/klein, Gleichstand nach Id', () => {
    expect(filterArticleRows(rows, {}).map((r) => r.id)).toEqual(['2', '4', '3', '1']);
  });
  it('nach Ebene: ohne Ebene zuletzt, absteigend zuerst', () => {
    expect(filterArticleRows(rows, { sort: 'layer' }).map((r) => r.id)).toEqual(['2', '4', '1', '3']);
    expect(filterArticleRows(rows, { sort: 'layer', dir: 'desc' }).map((r) => r.id)[0]).toBe('3');
  });
  it('nach Stufe von aussen nach innen', () => {
    expect(filterArticleRows(rows, { sort: 'level' }).map((r) => r.audience)).toEqual(['public', 'campaign', 'players', 'gm']);
  });
  it('filtert nach Ebene, ohne Ebene, Art, Stufe, Herkunft und Name', () => {
    expect(filterArticleRows(rows, { layer: 'b' }).map((r) => r.id)).toEqual(['4', '1']);
    expect(filterArticleRows(rows, { layer: 'none' }).map((r) => r.id)).toEqual(['3']);
    expect(filterArticleRows(rows, { type: 'Spell' }).map((r) => r.id)).toEqual(['2']);
    expect(filterArticleRows(rows, { level: 'gm' }).map((r) => r.id)).toEqual(['1']);
    expect(filterArticleRows(rows, { source: 'article' })).toEqual([]);
    expect(filterArticleRows(rows, { q: ' ALP ' }).map((r) => r.id)).toEqual(['2', '4']);
  });
  it('leer bleibt leer', () => {
    expect(filterArticleRows([], { sort: 'type' })).toEqual([]);
  });
});
