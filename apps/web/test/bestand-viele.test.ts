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
    entitiesById: vi.fn(async (ids: string[]) => ids.filter((id) => id !== 'weg').map((id) => art(id, `N ${id}`))),
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

describe('Bestand.holen collects what one pass asks for (T-398, P1)', () => {
  it('asks once for ids several parts ask for in the same pass', async () => {
    const { api, bestand } = aufbauen();
    /* Bogen, Kopf, Abschnitte und Kennzahlen fragen je für sich — auf dev achtmal entities?ids. */
    await Promise.all([bestand.holen(['a', 'b']), bestand.holen(['b', 'c']), bestand.holen(['weg']), bestand.holen([])]);
    expect(api.entitiesById).toHaveBeenCalledTimes(1);
    expect([...api.entitiesById.mock.calls[0]![0]].sort()).toEqual(['a', 'b', 'c', 'weg']);
    expect([...bestand.voll().keys()].sort()).toEqual(['a', 'b', 'c']);
    expect(bestand.fehlt().has('weg')).toBe(true);
  });

  it('resolves each caller only once its articles are there', async () => {
    const { bestand } = aufbauen();
    const p = bestand.holen(['a']);
    expect(bestand.voll().has('a')).toBe(false);
    await p;
    expect(bestand.voll().has('a')).toBe(true);
  });

  it('asks in pages of at most 200', async () => {
    const { api, bestand } = aufbauen();
    await bestand.holen(Array.from({ length: 450 }, (_, i) => `x${i}`));
    expect(api.entitiesById.mock.calls.map((c) => c[0].length)).toEqual([200, 200, 50]);
  });

  it('asks again in the next pass, for what is not there yet', async () => {
    const { api, bestand } = aufbauen();
    await bestand.holen(['a']);
    await bestand.holen(['a', 'd']);
    expect(api.entitiesById.mock.calls.map((c) => c[0])).toEqual([['a'], ['d']]);
  });
});

