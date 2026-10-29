/**
 * **Viele Artikel in einer Anfrage** (T-398): das Board öffnete je Karte
 * einen Artikel und seine Rückbezüge — zwei Anfragen je Karte, und jede las
 * am Server den ganzen Bestand. `oeffnenViele` fragt einmal; eine Kachel,
 * die währenddessen ihren Artikel öffnet, wartet auf diesen Abruf.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { Entity } from '@nw/model';
import { Api } from '../src/app/kern/api';
import { Bestand } from '../src/app/kern/bestand';
import { Live } from '../src/app/kern/live';

const art = (id: string, name: string): Entity => ({ id, interfaces: ['Creature'], name, components: { Identity: { name } }, relations: [] });

function aufbauen() {
  const api = {
    entitiesBatch: vi.fn(async (ids: string[]) => ({
      entities: Object.fromEntries(ids.filter((id) => id !== 'weg').map((id) => [id, { ...art(id, `N ${id}`), refs: { names: {}, links: {} } }])),
      missing: ids.filter((id) => id === 'weg'),
      backlinks: Object.fromEntries(ids.filter((id) => id !== 'weg').map((id) => [id, []])),
    })),
    entity: vi.fn(async (id: string) => ({ ...art(id, `N ${id}`), refs: { names: {}, links: {} } })),
    backlinks: vi.fn(async () => []),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: Api, useValue: api },
      { provide: Live, useValue: { onArtikel: () => undefined, onNeu: () => undefined } },
    ],
  });
  return { api, bestand: TestBed.inject(Bestand) };
}

describe('Bestand.oeffnenViele (T-398)', () => {
  it('opens many articles with their backlinks in one request', async () => {
    const { api, bestand } = aufbauen();
    await bestand.oeffnenViele(['a', 'b', 'c', 'a', 'weg']);
    expect(bestand.fehler()).toBeNull();
    expect(api.entitiesBatch).toHaveBeenCalledTimes(1);
    expect(api.entitiesBatch.mock.calls[0]![0]).toEqual(['a', 'b', 'c', 'weg']);
    expect([...bestand.voll().keys()].sort()).toEqual(['a', 'b', 'c']);
    expect(bestand.rueckbezuege().get('b')).toEqual([]);
    expect(bestand.fehlt().has('weg')).toBe(true);
    expect(bestand.name()('c')).toBe('N c');
  });

  it('does not ask again for what is there, nor for what is missing', async () => {
    const { api, bestand } = aufbauen();
    await bestand.oeffnenViele(['a', 'weg']);
    await bestand.oeffnenViele(['a', 'weg']);
    await bestand.oeffnen('a');
    await bestand.oeffnen('weg');
    expect(api.entitiesBatch).toHaveBeenCalledTimes(1);
    expect(api.entity).not.toHaveBeenCalled();
  });

  it('lets a tile that opens its article meanwhile wait for the batch', async () => {
    const { api, bestand } = aufbauen();
    const viele = bestand.oeffnenViele(['a', 'b']);
    const kachel = bestand.oeffnen('b', false, false);
    await Promise.all([viele, kachel]);
    expect(api.entity).not.toHaveBeenCalled();
    expect(api.backlinks).not.toHaveBeenCalled();
    expect(bestand.voll().has('b')).toBe(true);
  });

  it('asks in pages of 200', async () => {
    const { api, bestand } = aufbauen();
    await bestand.oeffnenViele(Array.from({ length: 450 }, (_, i) => `x${i}`), false);
    expect(api.entitiesBatch.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([200, 200, 50]);
  });
});
