/**
 * Der Statblock am Ort der Kreatur (T-125, Element `linked`): was über eine
 * `asField`-Kante hängt, steht auf ihrer Seite, „Edit" schreibt in seinen
 * Artikel, und fehlt er, stehen „Create" und „From a template" da — das
 * zweite legt eine Instanz an, nicht einen Verweis auf die Vorlage.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import type { Entity, Registry } from '@nw/model';
import { anordnen } from '../src/app/artikel/anordnung';
import { Verlinkt } from '../src/app/artikel/verlinkt';
import { Statblock } from '../src/app/artikel/statblock';
import { Wahl } from '../src/app/artikel/wahl';
import { Api } from '../src/app/kern/api';
import { Bestand } from '../src/app/kern/bestand';
import { Session } from '../src/app/kern/session';

const reg = {
  interfaces: {
    Identity: { name: 'Identity', abstract: true, schema: { properties: { name: { type: 'string' } } } },
    Creature: { name: 'Creature', label: 'Creature', area: 'world', extends: ['Identity'] },
    Statblock: {
      name: 'Statblock',
      label: 'Statblock',
      area: 'rules',
      extends: ['Identity'],
      schema: { properties: { ac: { type: 'number', title: 'Armor Class' }, hp: { type: 'number', title: 'Hit Points' } } },
    },
    Inventory: { name: 'Inventory', label: 'Inventory', extends: ['Identity'], views: { full: [{ id: 'i', el: 'inventory' }] } },
    Item: { name: 'Item', label: 'Item', extends: ['Identity'] },
  },
  relations: {
    belongsTo: { type: 'belongsTo', label: 'belongs to', inverseLabel: 'statblock', from: ['Statblock'], to: ['Creature'], cardinality: 'one', asField: 'to' },
    carries: { type: 'carries', label: 'carries', inverseLabel: 'carried by', from: ['Creature', 'Item'], to: ['Inventory'], cardinality: 'one', asField: 'from' },
    instanceOf: { type: 'instanceOf', label: 'instance of', from: ['Statblock', 'Item'], to: ['same'] },
  },
  views: {},
  units: {},
  vars: {},
  enums: {},
} as unknown as Registry;

const kreatur: Entity = { id: 'c1', interfaces: ['Creature'], name: 'Goblin Boss', components: { Identity: { name: 'Goblin Boss' } }, relations: [] };

@Component({ selector: 'nw-statblock', template: '<p class="bogen">statblock</p>' })
class BogenAttrappe {
  readonly artikel = input<Entity>();
}

@Component({ selector: 'nw-wahl', template: '<input class="wahl" />' })
class WahlAttrappe {
  readonly wert = input<string>('');
  readonly arten = input<string[]>([]);
  readonly label = input<string>('');
  readonly anlegbar = input<boolean>(true);
}

function aufbauen(opt: { rueck: { from: Entity; relation: { id: string; type: string; to: string } }[]; voll?: Entity[] }) {
  const api = {
    createEntity: vi.fn().mockResolvedValue({ id: 'sb_neu', interfaces: ['Statblock'] }),
    putEntity: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    myLayers: vi.fn().mockResolvedValue({ layers: [], campaign: null }),
  };
  const bestand = {
    registry: signal(reg),
    name: signal((id: string) => (id === 'sb_vorlage' ? 'Goblin' : undefined)),
    rueckbezuege: signal(new Map([['c1', opt.rueck]])),
    voll: signal(new Map((opt.voll ?? []).map((e) => [e.id, e] as const))),
    oeffnen: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Api, useValue: api },
      { provide: Bestand, useValue: bestand },
      {
        provide: Session,
        useValue: {
          isAdmin: signal(true),
          darfAnlegen: signal(true),
          darfSchreiben: signal(() => true),
          load: vi.fn(),
        },
      },
    ],
  });
  /* Der Bogen hat eine Stildatei, die JIT nicht lädt, und die Wahl einen
     Kreis mit dem Popup (forwardRef), den JIT nicht auflöst; hier zählt
     nur, dass beide gezeichnet werden. */
  TestBed.overrideComponent(Verlinkt, { remove: { imports: [Statblock, Wahl] }, add: { imports: [BogenAttrappe, WahlAttrappe] } });
  const fixture = TestBed.createComponent(Verlinkt);
  /* JIT kennt `input()` nicht (siehe text.test.ts): die Signale vor dem ersten Zeichnen ersetzen. */
  Object.assign(fixture.componentInstance, { artikel: signal(kreatur), nur: signal([]), ausser: signal(['Inventory']) });
  fixture.detectChanges();
  return { api, bestand, fixture, el: fixture.nativeElement as HTMLElement };
}

describe('anordnen › linked and inventory (T-125)', () => {
  it('turns both elements into the linked piece, with what each takes', () => {
    const st = anordnen(
      [
        { id: 'l', el: 'linked', except: ['Inventory'] },
        { id: 'i', el: 'inventory' },
      ],
      [],
      [],
      { beschreibung: null, rest: false },
    );
    expect(st.map((s) => [s.art, s.ausser ?? null, s.nur ?? null])).toEqual([
      ['verlinkt', ['Inventory'], null],
      ['verlinkt', null, ['Inventory']],
    ]);
  });
});

describe('nw-verlinkt', () => {
  it('without a statblock offers Create and From a template — and no empty inventory at the overview', () => {
    const { el } = aufbauen({ rueck: [] });
    const knoepfe = [...el.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(knoepfe).toEqual(['Create “Goblin Boss”', 'From a template']);
    expect(el.textContent).toContain('No statblock yet');
    expect(el.textContent).not.toContain('Inventory');
  });

  it('from a template creates an instance named after the creature, belonging to it', async () => {
    const { el, api, fixture } = aufbauen({ rueck: [] });
    (el.querySelectorAll('button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.vorlagenwahl')).not.toBeNull();
    await (fixture.componentInstance as unknown as { ausVorlage: (g: unknown, v: string) => Promise<void> }).ausVorlage(
      { relation: 'belongsTo', direction: 'in', type: 'Statblock' },
      'sb_vorlage',
    );
    expect(api.createEntity).toHaveBeenCalledWith('Statblock', 'Goblin Boss', {}, [
      { type: 'instanceOf', to: 'sb_vorlage' },
      { type: 'belongsTo', to: 'c1' },
    ]);
  });

  it('shows the statblock of the creature, and ↺ lets a field follow the template again', async () => {
    const sb: Entity = {
      id: 'sb1',
      interfaces: ['Statblock'],
      name: 'Goblin Boss',
      components: { Identity: { name: 'Goblin Boss' }, Statblock: { ac: 17, hp: 21 } },
      relations: [
        { id: 'x1', type: 'instanceOf', to: 'sb_vorlage' },
        { id: 'x2', type: 'belongsTo', to: 'c1' },
      ],
      fromTemplate: { template: 'sb_vorlage', fields: ['Statblock.hp'] },
      revision: 3,
    };
    const { el, api, fixture } = aufbauen({ rueck: [{ from: sb, relation: { id: 'x2', type: 'belongsTo', to: 'c1' } }], voll: [sb] });
    expect(el.textContent).toContain('from the template');
    expect(el.textContent).toContain('Goblin');
    expect(el.querySelector('.geerbt dt')?.textContent).toBe('Hit Points');

    (el.querySelector('.vkopf button') as HTMLButtonElement).click();
    fixture.detectChanges();
    /* ↺ steht nur am eigenen Wert (AC), nicht am geerbten (HP). */
    const zurueck = el.querySelectorAll('.zurueck');
    expect(zurueck.length).toBe(1);
    (zurueck[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.textContent).toContain('follows the template');

    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await new Promise((r) => setTimeout(r, 0));
    const geschickt = api.putEntity.mock.calls[0]![0] as Entity;
    expect(geschickt.id).toBe('sb1');
    expect(geschickt.revision).toBe(3);
    expect(geschickt.components?.['Statblock']).toEqual({ hp: 21 });
    expect('fromTemplate' in geschickt).toBe(false);
  });
});
