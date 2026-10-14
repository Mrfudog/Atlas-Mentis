/**
 * Schnell anlegen aus einer Auswahl (T-131): wer im Verweisfeld einen Namen
 * tippt, den es nicht gibt, legt ihn an, ohne die Seite zu verlassen — und
 * der neue Artikel steht sofort im Feld.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import type { Registry } from '@nw/model';
import { Wahl } from '../src/app/artikel/wahl';
import { SCHNELL_KONTEXT, Schnell, anlegbareArten } from '../src/app/artikel/schnell';
import { Api } from '../src/app/kern/api';
import { Bestand } from '../src/app/kern/bestand';
import { Session } from '../src/app/kern/session';
import { Stapel } from '../src/app/kern/stapel';

const reg = {
  interfaces: {
    Status: { name: 'Status', abstract: true, schema: { properties: { status: { type: 'string' } } } },
    Visibility: {
      name: 'Visibility',
      abstract: true,
      schema: { properties: { audience: { type: 'string', enum: ['public', 'campaign', 'players', 'gm'] } } },
    },
    Creature: { name: 'Creature', label: 'Creature', area: 'world', extends: ['Visibility'] },
    PlayerCharacter: { name: 'PlayerCharacter', label: 'Player character', extends: ['Creature', 'Status'] },
    Location: { name: 'Location', label: 'Location', area: 'world', extends: ['Status'] },
    Armor: { name: 'Armor', label: 'Armor', area: 'rules' },
  },
  views: {},
  relations: {},
} as unknown as Registry;

describe('anlegbareArten (T-131)', () => {
  it('takes the named type and its subtypes, the named one first', () => {
    expect(anlegbareArten(reg, ['Creature'], false).map((a) => a.name)).toEqual(['Creature', 'PlayerCharacter']);
  });
  it('offers players only types that carry a state (REQ-237)', () => {
    expect(anlegbareArten(reg, ['Creature'], true).map((a) => a.name)).toEqual(['PlayerCharacter']);
  });
  it('without a target, any creatable type with an area', () => {
    expect(anlegbareArten(reg, [], false).map((a) => a.name)).toEqual(['Armor', 'Creature', 'Location', 'PlayerCharacter']);
  });
});

const herkunft = () => ({
  id: 'e_ort',
  interfaces: ['Location'],
  components: { Visibility: { audience: 'gm' } },
  relations: [{ id: 'r1', type: 'inLayer', to: 'L1' }],
});

function aufbauen(schreib: { id: string; name: string } | null = null) {
  const api = {
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    myLayers: vi.fn().mockResolvedValue({
      layers: [
        { id: 'L1', name: 'Campaign', inPlay: true },
        { id: 'L2', name: 'Mine', inPlay: true },
      ],
      campaign: null,
    }),
    createEntity: vi.fn().mockResolvedValue({ id: 'e_neu', name: 'Gobbo', interfaces: ['Creature'] }),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Api, useValue: api },
      { provide: Bestand, useValue: { registry: signal(reg), name: signal(() => undefined) } },
      { provide: Session, useValue: { isAdmin: signal(true), load: vi.fn() } },
      { provide: SCHNELL_KONTEXT, useValue: { herkunft } },
      { provide: Stapel, useValue: { schreib: signal(schreib ? { layer: schreib } : null) } },
    ],
  });
  return api;
}

describe('nw-wahl › Create … as …', () => {
  it('offers to create the typed name as each type the field takes, and puts the new one in the field', async () => {
    aufbauen();
    const fixture = TestBed.createComponent(Wahl);
    /* JIT kennt `input()` nicht (siehe text.test.ts): das Signal vor dem ersten Zeichnen ersetzen. */
    Object.assign(fixture.componentInstance, { arten: signal(['Creature']) });
    const gesetzt: string[] = [];
    fixture.componentInstance.wertChange.subscribe((v) => gesetzt.push(v));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const feld = el.querySelector('input') as HTMLInputElement;
    feld.value = 'Gobbo';
    feld.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 260));
    fixture.detectChanges();

    const knoepfe = [...el.querySelectorAll('.neu button')].map((b) => b.textContent?.trim());
    expect(knoepfe).toEqual(['Create “Gobbo” as Creature', 'Create “Gobbo” as Player character']);
    (el.querySelector('.neu button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('nw-schnell')).not.toBeNull();

    /* Was das Popup meldet, steht sofort im Feld. */
    (fixture.componentInstance as unknown as { eingetragen(a: unknown): void }).eingetragen({
      id: 'e_neu',
      name: 'Gobbo',
      type: 'Creature',
      entity: {},
    });
    expect(gesetzt).toEqual(['e_neu']);
  });
});

describe('nw-schnell', () => {
  it('creates in the layer and audience of the article it came from, then offers Open and Done', async () => {
    const api = aufbauen();
    const fixture = TestBed.createComponent(Schnell);
    Object.assign(fixture.componentInstance, {
      vorschlag: signal('Gobbo'),
      ziele: signal(['Creature']),
      vorgabe: signal('Creature'),
    });
    const angelegt: string[] = [];
    fixture.componentInstance.angelegt.subscribe((a) => angelegt.push(a.id));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect((el.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('Gobbo');
    const save = [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Save')!;
    save.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.createEntity).toHaveBeenCalledWith('Creature', 'Gobbo', { 'Visibility.audience': 'gm' }, [
      { type: 'inLayer', to: 'L1' },
    ]);
    expect(angelegt).toEqual(['e_neu']);
    expect([...el.querySelectorAll('[role="dialog"] button')].map((b) => b.textContent?.trim())).toEqual(['Open', 'Done']);
  });

  it('starts in the write layer when there is one (T-161)', async () => {
    const api = aufbauen({ id: 'L2', name: 'Mine' });
    const fixture = TestBed.createComponent(Schnell);
    Object.assign(fixture.componentInstance, { vorschlag: signal('Gobbo'), ziele: signal(['Creature']), vorgabe: signal('Creature') });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('option')].find((o) => o.value === 'L2')?.textContent).toContain('(write layer)');
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Save')!.click();
    await fixture.whenStable();
    expect(api.createEntity).toHaveBeenCalledWith('Creature', 'Gobbo', { 'Visibility.audience': 'gm' }, [{ type: 'inLayer', to: 'L2' }]);
  });
});
