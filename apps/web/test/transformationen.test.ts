/**
 * Transformationen als Muster (T-253): die Leiste hält die Kette, der
 * Baum zeigt Knoten mit Zahl und klappt nach Schlüssel auf.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { applyTransform, type TransformStep } from '@nw/model';
import { Transformationen, Transformbaum } from '../src/app/muster/transformationen';
import { Unterblatt } from '../src/app/muster/werkzeugleiste';
import { Api } from '../src/app/kern/api';

const DIMS = [
  { key: 'layer', label: 'Layer' },
  { key: 'type', label: 'Type' },
  { key: 'area', label: 'Area' },
];

function leiste(steps: TransformStep[], ort = '') {
  const api = { prefs: vi.fn(async () => ({ 'transforms.probe': [{ name: 'Mine', steps: 'group:area' }] })), setPref: vi.fn(async () => ({ ok: true })) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: Api, useValue: api }] });
  /* JIT kennt `input()` nicht (text.test.ts): die Eingaben als Signale. */
  TestBed.overrideComponent(Transformationen, { set: { imports: [Unterblatt] } });
  const f = TestBed.createComponent(Transformationen);
  Object.assign(f.componentInstance, {
    dimensionen: signal(DIMS),
    steps: signal(steps),
    ort: signal(ort),
    vorlagen: signal([]),
    adresse: signal(false),
  });
  f.detectChanges();
  return { f, api, el: f.nativeElement as HTMLElement };
}

describe('nw-transformationen (T-253)', () => {
  it('zeigt je Schritt einen Chip, ordnet um und entfernt', () => {
    const { f, el } = leiste([{ group: 'layer' }, { group: 'type' }]);
    const chips = () => [...el.querySelectorAll('.chip .was')].map((x) => x.textContent?.trim());
    expect(chips()).toEqual(['Group by Layer', 'Group by Type']);
    (el.querySelector('[aria-label="Move Group by Type up"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(chips()).toEqual(['Group by Type', 'Group by Layer']);
    (el.querySelector('[aria-label="Remove Group by Layer"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(f.componentInstance.steps()).toEqual([{ group: 'type' }]);
  });

  it('bietet nur an, wonach noch nicht gruppiert wird, und hängt an', () => {
    const { f, el } = leiste([{ group: 'layer' }]);
    const sel = el.querySelector('select') as HTMLSelectElement;
    expect([...sel.options].map((o) => o.value)).toEqual(['', 'type', 'area']);
    sel.value = 'area';
    sel.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(f.componentInstance.steps()).toEqual([{ group: 'layer' }, { group: 'area' }]);
  });

  it('lädt gespeicherte Ketten des Kontos und wendet eine an', async () => {
    const { f, el, api } = leiste([{ group: 'layer' }], 'probe');
    await f.whenStable();
    f.detectChanges();
    const b = [...el.querySelectorAll('.kette button')].find((x) => x.textContent?.trim() === 'Mine') as HTMLButtonElement;
    expect(b).toBeTruthy();
    b.click();
    expect(f.componentInstance.steps()).toEqual([{ group: 'area' }]);
    (el.querySelector('[aria-label="Delete saved Mine"]') as HTMLButtonElement).click();
    await f.whenStable();
    expect(api.setPref).toHaveBeenCalledWith('transforms.probe', []);
  });
});

describe('nw-transformbaum (T-253)', () => {
  it('zeigt die oberste Ebene mit Zahl und klappt auf', () => {
    const rows = [{ l: 'a', t: 'x' }, { l: 'a', t: 'y' }, { l: 'b', t: 'x' }];
    const dims = [
      { key: 'layer', label: 'Layer', values: (r: { l: string }) => [r.l] },
      { key: 'type', label: 'Type', values: (r: { t: string }) => [r.t] },
    ];
    const { nodes } = applyTransform(rows, [{ group: 'layer' }, { group: 'type' }], dims);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const f = TestBed.createComponent(Transformbaum);
    Object.assign(f.componentInstance, {
      knoten: signal(nodes),
      dimensionen: signal([]),
      offen: signal(new Set()),
      zellen: signal(null),
      beschriftung: signal('Groups'),
    });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const zeilen = () => [...el.querySelectorAll('[role=treeitem] b')].map((x) => x.textContent);
    expect(zeilen()).toEqual(['a', 'b']);
    expect(el.querySelector('.zahl')?.textContent).toBe('2');
    (el.querySelector('[aria-label="Expand a"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(zeilen()).toEqual(['a', 'x', 'y', 'b']);
  });
});
