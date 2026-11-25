/**
 * Die Übernahme dev ↔ prod in der Werkbank (T-130): Auftrag, Gruppen nach
 * Ebene, Art und Artikel, offene Konflikte und der Lauf, wie der Server ihn
 * liest.
 */

import { describe, expect, it } from 'vitest';
import { TransferRequestSchema, TransferRunSchema } from '@nw/model';
import type { TransferEintrag } from '../src/app/kern/api';
import {
  gruppieren,
  leeresUebernahmeFormular,
  offeneKonflikte,
  uebernahmeAuftrag,
  uebernahmeFehlt,
  uebernahmeLauf,
  vonHand,
  vorgewaehlt,
  zeigeWert,
  type Wahl,
} from '../src/app/werkbank/uebernahme-logik';

const eintrag = (id: string, status: TransferEintrag['status'], layers: string[], type = 'Rule', konflikt = false): TransferEintrag => ({
  id,
  kind: 'entity',
  name: id.toUpperCase(),
  type,
  number: '',
  layers,
  status,
  fields: konflikt ? [{ key: 'Description.description', kind: 'field', base: 'a', source: 'b', target: 'c', state: 'conflict' }] : [],
  sourceKey: `s-${id}`,
  targetKey: `t-${id}`,
});

describe('Übernahme in der Werkbank', () => {
  it('builds a request the server accepts, and says when it would hit nothing', () => {
    const f = { ...leeresUebernahmeFormular(), ids: 'rule-0001\nrule-0002', registry: 'interfaces:Spell, views:*', dependencies: true };
    const a = uebernahmeAuftrag(f);
    expect(a).toEqual({ direction: 'push', select: { ids: ['rule-0001', 'rule-0002'] }, registry: ['interfaces:Spell', 'views:*'], dependencies: true });
    expect(TransferRequestSchema.safeParse(a).success).toBe(true);
    expect(uebernahmeFehlt(leeresUebernahmeFormular())).toMatch(/Choose/);
  });

  it('groups by layer, then type, then article — registry last', () => {
    const g = gruppieren([
      eintrag('b', 'new', ['Campaign']),
      eintrag('a', 'new', ['Campaign'], 'Creature'),
      eintrag('c', 'new', []),
      { ...eintrag('views:quick', 'changed', []), kind: 'registry', type: 'views' },
      eintrag('d', 'new', ['Book']),
    ]);
    expect(g.map((x) => [x.ebene, x.arten.map((a) => a.art), x.zahl])).toEqual([
      ['Book', ['Rule'], 1],
      ['Campaign', ['Creature', 'Rule'], 2],
      ['No layer', ['Rule'], 1],
      ['Registry', ['views'], 1],
    ]);
  });

  it('counts open conflicts of chosen items and builds the run', () => {
    const items = [eintrag('x', 'conflict', [], 'Rule', true), eintrag('y', 'unchanged', [])];
    const gewaehlt = new Set(items.filter(vorgewaehlt).map((e) => e.id));
    expect([...gewaehlt]).toEqual(['x']);
    const wahl = new Map<string, Wahl>();
    expect(offeneKonflikte(items, gewaehlt, wahl)).toBe(1);
    wahl.set('x\u0000Description.description', { art: 'hand', text: '{"a":1}' });
    expect(offeneKonflikte(items, gewaehlt, wahl)).toBe(0);
    const lauf = uebernahmeLauf({ direction: 'push', select: { ids: ['x', 'y'] } }, items, gewaehlt, wahl);
    expect(lauf).toEqual({
      direction: 'push',
      select: { ids: ['x', 'y'] },
      apply: ['x'],
      choices: { x: { 'Description.description': { value: { a: 1 } } } },
      expect: { x: ['s-x', 't-x'] },
    });
    expect(TransferRunSchema.safeParse(lauf).success).toBe(true);
  });

  it('reads values by hand and shows edges as type → target', () => {
    expect(vonHand('plain words')).toBe('plain words');
    expect(vonHand('12')).toBe(12);
    expect(zeigeWert({ kind: 'edge' }, { type: 'knows', to: 'e_1' })).toBe('knows → e_1');
    expect(zeigeWert({ kind: 'field' }, undefined)).toBe('—');
  });
});
