/**
 * Wer sieht was, je Gruppe (T-252): die Übersicht zeigt, was der Server
 * zählt, und setzt Regeln über die API — gerechnet wird hier nichts.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, RouterLink } from '@angular/router';
import { KampagnenSichtbarkeit } from '../src/app/verwaltung/sichtbarkeit';
import { Api, type SichtUebersicht } from '../src/app/kern/api';
import { Session } from '../src/app/kern/session';

const knoten = (key: string, label: string, extra: Partial<SichtUebersicht['nodes'][number]> = {}) => ({
  key,
  dim: 'layer',
  value: key.split(':')[1]!,
  label,
  depth: 0,
  count: 4,
  cells: { public: 4, table: 4, 'u:ana': 3, gm: 4 },
  levels: { public: 3, gm: 1 },
  sources: { default: 3, article: 1 },
  exceptions: { count: 1, items: [{ id: 'it2', name: 'Cursed ring', own: 'gm' }] },
  children: [],
  ...extra,
});

const UEBERSICHT: SichtUebersicht = {
  campaign: { id: 'c1', name: 'Probe' },
  may: 'manage',
  columns: [
    { key: 'public', label: 'Public', kind: 'public' },
    { key: 'table', label: 'Table', kind: 'table' },
    { key: 'u:ana', label: 'Rook', kind: 'player', bearers: ['pc_rook'] },
    { key: 'gm', label: 'GM', kind: 'gm' },
  ],
  dimensions: [{ key: 'layer', label: 'Layer' }, { key: 'type', label: 'Type' }],
  steps: [{ group: 'layer' }],
  unknown: [],
  total: 7,
  levels: ['public', 'campaign', 'players', 'gm'],
  rules: [],
  nodes: [knoten('layer:dnd', 'D&D 5e (2014)'), knoten('layer:brew', 'Homebrew', { count: 3, cells: { public: 0, table: 0, 'u:ana': 0, gm: 3 }, levels: { gm: 3 }, sources: { layer: 3 }, exceptions: { count: 0, items: [] } })],
};

function aufbau() {
  const api = {
    campaignVisibility: vi.fn(async () => UEBERSICHT),
    setVisibilityRule: vi.fn(async () => ({ ok: true, rules: [] })),
    followGroup: vi.fn(async () => ({ ok: true, done: ['it2'], refused: [] })),
    prefs: vi.fn(async () => ({})),
    setPref: vi.fn(async () => ({ ok: true })),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: Api, useValue: api }, { provide: Session, useValue: { viewAsUser: vi.fn() } }],
  });
  /* JIT kennt `input()` nicht (text.test.ts): Eingaben als Signale, ohne die Leiste. */
  TestBed.overrideComponent(KampagnenSichtbarkeit, { set: { imports: [RouterLink] } });
  const f = TestBed.createComponent(KampagnenSichtbarkeit);
  Object.assign(f.componentInstance, { kampagne: signal('c1') });
  f.detectChanges();
  return { f, api, el: f.nativeElement as HTMLElement };
}

describe('nw-kampagnen-sichtbarkeit (T-252)', () => {
  it('zeigt je Gruppe die Zahlen der Spalten und woher die Stufe kommt', async () => {
    const { f, el, api } = aufbau();
    await f.whenStable();
    f.detectChanges();
    expect(api.campaignVisibility).toHaveBeenCalledWith('c1', 'group:layer,group:type');
    const zeilen = [...el.querySelectorAll('tbody tr')].map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim());
    expect(zeilen[0]).toContain('D&D 5e (2014)');
    expect(zeilen[0]).toContain('3/4');
    expect(zeilen[1]).toContain('layer default');
    expect(zeilen[1]).toContain('—');
  });

  it('setzt eine Stufe, zeigt einer Spielerin die Gruppe und lässt Ausnahmen folgen', async () => {
    const { f, el, api } = aufbau();
    await f.whenStable();
    f.detectChanges();
    const knopf = (sel: string, text: string) => [...el.querySelectorAll(sel)].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
    knopf('[aria-label="Audience for Homebrew"] button', 'Table').click();
    await f.whenStable();
    expect(api.setVisibilityRule).toHaveBeenCalledWith('c1', { id: 'layer:brew', audience: 'campaign' });
    (el.querySelector('button.zelle') as HTMLButtonElement).click();
    await f.whenStable();
    expect(api.setVisibilityRule).toHaveBeenLastCalledWith('c1', { id: 'layer:dnd', show: ['pc_rook'], hide: [] });
    knopf('button', '1 own').click();
    f.detectChanges();
    knopf('button', 'Follow the group').click();
    await f.whenStable();
    expect(api.followGroup).toHaveBeenCalledWith('c1', ['it2']);
  });
});
