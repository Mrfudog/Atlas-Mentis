/**
 * Karten finden und anlegen (T-202). Die Leitung hatte ein Bild mit der
 * Klasse `map` hochgeladen und fand es in der Sitzung unter „Map on the
 * table“ nicht: das Feld nimmt Karten (`target.interfaces: ['Map']`), und
 * ein Bild ist keine. Jetzt bietet die Auswahl Kartenbilder mit an; wer
 * eines wählt, bekommt eine Karte daraus, und die steht im Feld.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import type { Registry } from '@nw/model';
import { Wahl } from '../src/app/artikel/wahl';
import { Api, type KartenZeile } from '../src/app/kern/api';
import { kartenGefiltert } from '../src/app/karten/karten';
import { Bestand } from '../src/app/kern/bestand';
import { Session } from '../src/app/kern/session';

const reg = {
  interfaces: {
    Image: { name: 'Image', abstract: true, schema: { properties: { image: { type: 'string', format: 'asset' } } } },
    Asset: { name: 'Asset', label: 'Asset', area: 'world', extends: ['Image'] },
    Map: {
      name: 'Map',
      label: 'Map',
      area: 'play',
      extends: ['Image'],
      targets: { 'Image.image': { where: { component: 'Asset', property: 'kind', value: 'map' } } },
    },
    Scene: { name: 'Scene', label: 'Scene', area: 'story', extends: ['Image'] },
  },
  views: {},
  relations: {},
} as unknown as Registry;

function aufbauen() {
  const api = {
    list: vi.fn((frage: { type?: string; of?: string[] }) =>
      Promise.resolve(
        frage.type === 'Asset'
          ? { rows: [{ id: 'as_hafen', name: 'Harbour.webp', type: 'Asset' }], total: 1 }
          : { rows: [{ id: 'map_alt', name: 'Old map', type: 'Map' }], total: 1 },
      ),
    ),
    createEntity: vi.fn().mockResolvedValue({ id: 'map_neu', name: 'Harbour', interfaces: ['Map'] }),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Api, useValue: api },
      { provide: Bestand, useValue: { registry: signal(reg), name: signal(() => undefined) } },
      { provide: Session, useValue: { isAdmin: signal(true), load: vi.fn() } },
    ],
  });
  return api;
}

async function tippe(arten: string[], text: string) {
  const fixture = TestBed.createComponent(Wahl);
  /* JIT kennt `input()` nicht (siehe text.test.ts): das Signal vor dem ersten Zeichnen ersetzen. */
  Object.assign(fixture.componentInstance, { arten: signal(arten), anlegbar: signal(false) });
  const gesetzt: string[] = [];
  fixture.componentInstance.wertChange.subscribe((v) => gesetzt.push(v));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const feld = el.querySelector('input') as HTMLInputElement;
  feld.value = text;
  feld.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 260));
  fixture.detectChanges();
  return { fixture, el, gesetzt };
}

describe('Map on the table › images of class map (T-202)', () => {
  it('offers map images next to maps, and choosing one creates a map with that image', async () => {
    const api = aufbauen();
    const { fixture, el, gesetzt } = await tippe(['Map'], 'harb');

    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ type: 'Asset', f: ['Asset.kind:map'], q: 'harb' }));
    const bild = [...el.querySelectorAll('.bild button')];
    expect(bild.map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Harbour.webp Map image → new map']);

    (bild[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    /* Name aus dem Bild, ohne Endung; die Ebene setzt der Server (Schreibebene). */
    expect(api.createEntity).toHaveBeenCalledWith('Map', 'Harbour', { 'Image.image': 'as_hafen' });
    expect(gesetzt).toEqual(['map_neu']);
  });

  it('offers no images where the target takes none', async () => {
    const api = aufbauen();
    const { el } = await tippe(['Scene'], 'harb');
    expect(api.list).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'Asset' }));
    expect(el.querySelectorAll('.bild').length).toBe(0);
  });
});

describe('Play › Maps › filter (T-202)', () => {
  const z = (id: string, depth: number, parent: string | null, extra: Partial<KartenZeile> = {}): KartenZeile => ({
    id,
    name: id,
    image: '',
    kind: 'region',
    tags: [],
    layers: [],
    depth,
    parent,
    ...extra,
  });
  const zeilen = [
    z('World', 0, null, { layers: [{ id: 'L1', name: 'Campaign' }] }),
    z('Region', 1, 'World', { tags: ['north'] }),
    z('Harbour', 2, 'Region', { layers: [{ id: 'L2', name: 'Book' }] }),
    z('Abbey', 0, null),
  ];
  it('keeps the maps above a hit, marked as path, so the indentation holds', () => {
    expect(kartenGefiltert(zeilen, 'harb', '', '').map((x) => [x.zeile.id, x.treffer])).toEqual([
      ['World', false],
      ['Region', false],
      ['Harbour', true],
    ]);
  });
  it('filters by layer and by tag', () => {
    expect(kartenGefiltert(zeilen, '', 'L1', '').map((x) => x.zeile.id)).toEqual(['World']);
    expect(kartenGefiltert(zeilen, '', '', 'north').map((x) => [x.zeile.id, x.treffer])).toEqual([
      ['World', false],
      ['Region', true],
    ]);
    expect(kartenGefiltert(zeilen, '', '', '').length).toBe(4);
  });
});
