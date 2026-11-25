/**
 * Jeder Artikel mit seiner Ebene (T-387, REQ-368): die Liste zeigt, was
 * der Server rechnet, und schreibt über die API — einzeln und für eine
 * Auswahl. Gerechnet wird hier nichts.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KampagnenArtikel } from '../src/app/verwaltung/artikel-sicht';
import { Api, type SichtArtikel, type SichtArtikelListe } from '../src/app/kern/api';

const zeile = (id: string, name: string, extra: Partial<SichtArtikel> = {}): SichtArtikel => ({
  id,
  name,
  type: 'Item',
  typeLabel: 'Item',
  layers: [{ id: 'ly_brew', name: 'Homebrew', publisher: 'Homebrew', groups: [] }],
  audience: 'public',
  source: 'default',
  own: { revealedTo: 0, hiddenFrom: 0 },
  players: {},
  seenBy: ['public', 'table', 'u:ana', 'gm'],
  writable: true,
  ...extra,
});

const LISTE = (may: 'manage' | 'see' = 'manage'): SichtArtikelListe => ({
  may,
  columns: [
    { key: 'public', label: 'Public', kind: 'public' },
    { key: 'table', label: 'Table', kind: 'table' },
    { key: 'u:ana', label: 'Rook', kind: 'player', bearers: ['pc_rook'] },
    { key: 'gm', label: 'GM', kind: 'gm' },
  ],
  total: 3,
  all: 3,
  offset: 0,
  limit: 50,
  facets: {
    layers: [
      { id: 'ly_brew', name: 'Homebrew', publisher: 'Homebrew', groups: [], n: 2 },
      { id: 'ly_srd', name: 'Basic rules', publisher: 'Official', groups: [], n: 1 },
    ],
    types: [{ key: 'Item', label: 'Item', n: 3 }],
    levels: { public: 2, gm: 1 },
  },
  rows: [
    zeile('it1', 'Rope'),
    zeile('it2', 'Cursed ring', { audience: 'gm', source: 'article', own: { audience: 'gm', revealedTo: 0, hiddenFrom: 0 }, seenBy: ['gm'] }),
    zeile('it3', 'Longsword', { layers: [{ id: 'ly_srd', name: 'Basic rules', publisher: 'Official', groups: [] }], writable: false }),
  ],
});

function aufbau(may: 'manage' | 'see' = 'manage') {
  const api = {
    campaignVisibilityArticles: vi.fn(async () => LISTE(may)),
    setArticleVisibility: vi.fn(async (_c: string, ids: string[]) => ({
      ok: true as const,
      done: ids.filter((x) => x !== 'it3'),
      unchanged: [],
      refused: ids.includes('it3') ? [{ id: 'it3', name: 'Longsword', error: 'In a layer you do not write' }] : [],
    })),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: Api, useValue: api }] });
  const f = TestBed.createComponent(KampagnenArtikel);
  /* JIT kennt `input()` nicht (text.test.ts): Eingaben als Signale. */
  Object.assign(f.componentInstance, { kampagne: signal('c1'), sortierung: signal('layer') });
  f.detectChanges();
  return { f, api, el: f.nativeElement as HTMLElement };
}

async function fertig(f: ReturnType<typeof aufbau>['f']) {
  await f.whenStable();
  f.detectChanges();
}

describe('nw-kampagnen-artikel (T-387)', () => {
  it('zeigt je Artikel Ebene, Herausgeber, Stufe und Herkunft; sortiert zuerst wie verlangt', async () => {
    const { f, el, api } = aufbau();
    await fertig(f);
    expect(api.campaignVisibilityArticles).toHaveBeenCalledWith('c1', { sort: 'layer', offset: 0, limit: 50 });
    const zeilen = [...el.querySelectorAll('li.zeile')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(zeilen[0]).toContain('Homebrew');
    expect(zeilen[1]).toContain('GM');
    expect(zeilen[1]).toContain('own setting');
    expect(zeilen[2]).toContain('Basic rules');
    expect(zeilen[2]).toContain('Official');
    /* Was die Leitung nicht schreibt, ist gesperrt und sagt warum. */
    const gesperrt = el.querySelector('li[data-id="it3"] .seg button') as HTMLButtonElement;
    expect(gesperrt.disabled).toBe(true);
    expect(el.querySelector('li[data-id="it3"] .hinweis')?.textContent).toContain('layer you do not write');
  });

  it('filtert über den Server', async () => {
    const { f, el, api } = aufbau();
    await fertig(f);
    const ebene = el.querySelector('select[aria-label="Layer"]') as HTMLSelectElement;
    ebene.value = 'ly_srd';
    ebene.dispatchEvent(new Event('change'));
    await fertig(f);
    expect(api.campaignVisibilityArticles).toHaveBeenLastCalledWith('c1', { sort: 'layer', layer: 'ly_srd', offset: 0, limit: 50 });
  });

  it('setzt die Stufe einer Zeile und schaltet eine Spielerin um', async () => {
    const { f, el, api } = aufbau();
    await fertig(f);
    const gm = [...el.querySelectorAll('li[data-id="it1"] .seg button')].find((b) => b.textContent?.trim() === 'GM') as HTMLButtonElement;
    gm.click();
    await fertig(f);
    expect(api.setArticleVisibility).toHaveBeenCalledWith('c1', ['it1'], { audience: 'gm' });
    expect(el.querySelector('.meldung')?.textContent).toContain('1 changed');
    (el.querySelector('li[data-id="it1"] button.zelle') as HTMLButtonElement).click();
    await fertig(f);
    expect(api.setArticleVisibility).toHaveBeenLastCalledWith('c1', ['it1'], { player: { key: 'u:ana', mode: 'show' } });
  });

  it('setzt für eine Auswahl und nennt, was blieb', async () => {
    const { f, el, api } = aufbau();
    await fertig(f);
    (el.querySelector('input[aria-label="Select all shown"]') as HTMLInputElement).click();
    f.detectChanges();
    expect(el.querySelector('.massen b')?.textContent).toContain('3 selected');
    const verbergen = [...el.querySelectorAll('.massen button')].find((b) => b.textContent?.includes('Hide from Rook')) as HTMLButtonElement;
    verbergen.click();
    await fertig(f);
    expect(api.setArticleVisibility).toHaveBeenCalledWith('c1', ['it1', 'it2', 'it3'], { player: { key: 'u:ana', mode: 'hide' } });
    expect(el.querySelector('.meldung')?.textContent).toContain('2 changed, 1 not changed (Longsword');
    /* Die Auswahl bleibt für den nächsten Schritt. */
    expect(el.querySelector('.massen b')?.textContent).toContain('3 selected');
  });

  it('die Mitleitung sieht die Liste ohne Knöpfe', async () => {
    const { f, el } = aufbau('see');
    await fertig(f);
    expect(el.querySelectorAll('li.zeile').length).toBe(3);
    expect(el.querySelector('.seg')).toBeNull();
    expect(el.querySelector('input.waehler')).toBeNull();
  });
});
