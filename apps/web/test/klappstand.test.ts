/**
 * Der Klappstand am Konto (T-441, REQ-361): Facetten und Registergruppen
 * stehen nach dem Neuladen so, wie man sie liess. Gespeichert wird einmal
 * nach dem letzten Klappen, und nie mehr als der Server nimmt (8000
 * Zeichen je Einstellung).
 */
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/app/kern/api';
import { KLAPP_MAX, Klappstand, klappStandAus, kuerzeKlappstand } from '../src/app/kern/klappstand';

describe('klappStandAus / kuerzeKlappstand', () => {
  it('nimmt nur Wahrheitswerte', () => {
    expect(klappStandAus({ a: true, b: false, c: 'x', d: 1 })).toEqual({ a: true, b: false });
    expect(klappStandAus(['a'])).toEqual({});
    expect(klappStandAus(null)).toEqual({});
  });
  it('wirft die ältesten weg, bis es passt', () => {
    const viel: Record<string, boolean> = {};
    for (let i = 0; i < 2000; i++) viel[`Typ${i}::Gruppe`] = true;
    const kurz = kuerzeKlappstand(viel);
    expect(JSON.stringify(kurz).length).toBeLessThanOrEqual(KLAPP_MAX);
    expect(kurz['Typ1999::Gruppe']).toBe(true);
    expect(kurz['Typ0::Gruppe']).toBeUndefined();
  });
});

describe('Klappstand', () => {
  afterEach(() => vi.useRealTimers());

  function aufbau(gemerkt: Record<string, unknown>) {
    const api = { prefs: vi.fn(async () => gemerkt), setPref: vi.fn(async () => ({ ok: true as const })) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: api }] });
    return { api, k: TestBed.inject(Klappstand) };
  }

  it('lädt einmal und gibt je Name den gemerkten Stand', async () => {
    const { api, k } = aufbau({ 'facets.world|Item': { 'Item.rarity': false }, registerGroups: { 'Creature::Abilities': true } });
    expect(k.stand('facets.world|Item')).toEqual({});
    await k.geladen();
    expect(k.stand('facets.world|Item')).toEqual({ 'Item.rarity': false });
    expect(k.stand('registerGroups')).toEqual({ 'Creature::Abilities': true });
    expect(k.stand('facets.world|')).toEqual({});
    expect(api.prefs).toHaveBeenCalledTimes(1);
  });

  it('speichert einmal nach dem letzten Klappen', async () => {
    vi.useFakeTimers();
    const { api, k } = aufbau({});
    await k.geladen();
    k.setze('registerGroups', 'A::x', true);
    k.setze('registerGroups', 'A::y', true);
    k.setze('registerGroups', 'A::x', false);
    expect(api.setPref).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(api.setPref).toHaveBeenCalledTimes(1);
    expect(api.setPref).toHaveBeenCalledWith('registerGroups', { 'A::y': true, 'A::x': false });
    expect(k.stand('registerGroups')).toEqual({ 'A::y': true, 'A::x': false });
  });

  it('lässt ein frühes Klappen nicht vom Laden überschreiben', async () => {
    const { k } = aufbau({ registerGroups: { 'A::x': true, 'A::z': true } });
    k.setze('registerGroups', 'A::x', false);
    await k.geladen();
    expect(k.stand('registerGroups')).toEqual({ 'A::x': false, 'A::z': true });
  });
});
