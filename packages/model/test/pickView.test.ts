import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { seedRegistry } from '@nw/registry';
import { drawnByTree, pickView } from '../src/viewScope.js';
import { rollTableOf, rowForRoll, rowRange } from '../src/rollTable.js';
import type { Entity, Registry, ViewDef } from '../src/types.js';

const tabelle: Entity = {
  id: 'table-0001',
  interfaces: ['Table'],
  name: 'Gems',
  components: {
    Table: {
      die: '1d8',
      columns: ['d8', 'Stone'],
      rows: [
        { cells: ['1', 'Opal'], weight: 1 },
        { cells: ['2–3', 'Ruby'], weight: 1 },
        { cells: ['4-8', 'Glass'], weight: 1 },
      ],
    },
  },
};
const varo: Entity = { id: 'npc-0002', interfaces: ['Creature'], name: 'Varo', components: {} };

const tabellenQuick: ViewDef = {
  label: 'Table card',
  fields: 'none',
  group: 'quick',
  applies: { types: ['Table'] },
  layout: [{ id: 'k', el: 'collapsible', text: 'Rows', children: [{ id: 't', el: 'table' }] }],
};
const mit: Registry = { ...seedRegistry, views: { ...seedRegistry.views, tableCard: tabellenQuick } };

describe('pickView (T-310)', () => {
  it('ein Ort wählt die genaueste Ansicht seiner Gruppe', () => {
    const p = pickView(tabelle, mit, 'quick');
    expect(p.key).toBe('tableCard');
    expect(p.designed).toBe(true);
    expect(p.layout[0]?.el).toBe('collapsible');
    /* Für eine Kreatur gilt sie nicht: dort bleibt es Quick. */
    expect(pickView(varo, mit, 'quick').key).toBe('quick');
  });

  it('exact nimmt die Ortsansicht beim Wort, eine gestaltete gilt immer genau', () => {
    expect(pickView(tabelle, mit, 'quick', { exact: true }).key).toBe('quick');
    expect(pickView(varo, mit, 'tableCard').key).toBe('tableCard');
  });

  it('fehlt die Ansicht, gilt die Rückfalle', () => {
    expect(pickView(varo, mit, 'gibtsnicht', { fallback: 'quick' }).key).toBe('quick');
  });

  it('die Suche liest quick (T-346): wer noch search nennt, bekommt quick', () => {
    expect(seedRegistry.views['search']).toBeUndefined();
    const p = pickView(varo, seedRegistry, 'search');
    expect(p.key).toBe('quick');
    /* Werte oben, das Bild zuletzt — dort darf der Rahmen abschneiden. */
    expect(p.layout[0]?.id).toBe('c-q-stats');
    expect(p.layout.at(-1)?.el).toBe('image');
    /* Eine gestaltete der Gruppe quick gilt auch dort. */
    expect(pickView(tabelle, mit, 'search').key).toBe('tableCard');
    /* Steht eine eigene Ansicht search noch da, gilt sie. */
    const alt: Registry = { ...seedRegistry, views: { ...seedRegistry.views, search: { label: 'Search', fields: 'none', layout: [] } } };
    expect(pickView(varo, alt, 'search').key).toBe('search');
  });

  it('quick: bei jeder Art steht das Bild zuletzt (T-346)', () => {
    for (const art of Object.keys(seedRegistry.interfaces)) {
      const { layout } = pickView({ id: 'x', interfaces: [art], components: {} } as Entity, seedRegistry, 'quick');
      const i = layout.findIndex((el) => el.el === 'image');
      if (i >= 0) expect(i, art).toBe(layout.length - 1);
    }
  });

  it('die Anordnung der Art zählt wie bisher (layoutFor)', () => {
    const p = pickView(tabelle, seedRegistry, 'full');
    expect(p.from).toBe('Table');
    expect(p.layout.some((el) => el.el === 'table')).toBe(true);
  });

  it('Behälter und die Werte des Designers zeichnet der Baum', () => {
    expect(['collapsible', 'columns', 'edgeTable', 'table', 'quote'].every((el) => drawnByTree({ el: el as never }))).toBe(true);
    expect(drawnByTree({ el: 'fields' })).toBe(false);
  });
});

describe('Tabellenzeilen (T-310)', () => {
  it('liest Spannen aus der ersten Zelle', () => {
    expect(rowRange('2–3')).toEqual({ lo: 2, hi: 3 });
    expect(rowRange('96-00')).toEqual({ lo: 96, hi: 100 });
    expect(rowRange('11+')?.lo).toBe(11);
    expect(rowRange('Opal')).toBeNull();
    const t = rollTableOf(tabelle)!;
    expect(t.counted).toBe(false);
    expect(t.columns).toEqual(['d8', 'Stone']);
    expect(rowForRoll(t, 3)).toBe(1);
    expect(rowForRoll(t, 9)).toBe(-1);
  });

  it('zählt einen Würfeltopf aus den Gewichten', () => {
    const topf = rollTableOf({ components: { Table: { die: '1d4', rows: [{ text: 'A', weight: 3 }, { text: 'B' }] } } })!;
    expect(topf.counted).toBe(true);
    expect(topf.columns[0]).toBe('d4');
    expect(topf.rows.map((z) => [z.lo, z.hi])).toEqual([
      [1, 3],
      [4, 4],
    ]);
    expect(rowForRoll(topf, 4)).toBe(1);
    expect(rollTableOf({ components: {} })).toBeNull();
  });
});

/**
 * **Wer `layoutFor` direkt ruft** (T-310): gezeichnet wird über `pickView`.
 * Was hier steht, fragt nach dem Typ, nicht nach einem Artikel — der
 * Designer und die Typseite bearbeiten die Anordnung einer Art, Kennzahlen
 * und verknüpfte Bögen fragen, ob die Art ein Element hat, und die
 * Listenspalten gelten für alle Zeilen einer Liste.
 */
describe('layoutFor nur noch, wo nach dem Typ gefragt wird (T-310)', () => {
  const wurzel = join(__dirname, '..', '..', '..');
  const erlaubt = new Set([
    'apps/server/src/liste.ts',
    'apps/web/src/app/register/typ.ts',
    'apps/web/src/app/ansichten/designer.ts',
    'apps/web/src/app/artikel/kennzahlen.ts',
    'apps/web/src/app/artikel/verlinkt.ts',
  ]);
  const dateien = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? dateien(p) : p.endsWith('.ts') ? [p] : [];
    });
  it('jede Zeichenstelle fragt pickView', () => {
    const rufer = [join(wurzel, 'apps/web/src'), join(wurzel, 'apps/server/src')]
      .flatMap(dateien)
      .filter((p) => /\blayoutFor\s*\(|layoutFor as /.test(readFileSync(p, 'utf8')))
      .map((p) => relative(wurzel, p).replaceAll('\\', '/'));
    expect(rufer.filter((p) => !erlaubt.has(p))).toEqual([]);
  });
});
