/**
 * Die Spielerseite (T-247): Reiter auf der Artikelseite, der Kopf mit
 * Schaden, Heilung, zeitweiligen, Punkten, Statuszeile und
 * Konzentrationsprobe, und die schwebende Werkzeugleiste als Muster.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, Directive, Input, signal } from '@angular/core';
import { provideRouter, RouterLink } from '@angular/router';
import { handState, turnActions, turnRows } from '@nw/model';
import type { Entity, SheetHeader } from '@nw/model';
import { anordnen, reiterVon } from '../src/app/artikel/anordnung';
import { Bogen } from '../src/app/bogen/kopf';
import { Zug } from '../src/app/bogen/zug';
import { Zauberliste } from '../src/app/bogen/zauberliste';
import { FigurDaten } from '../src/app/bogen/daten';
import { Werkzeugleiste } from '../src/app/muster/werkzeugleiste';
import { Api } from '../src/app/kern/api';
import { Bestand } from '../src/app/kern/bestand';
import { Session } from '../src/app/kern/session';
import { Glossar } from '../src/app/kern/glossar';

@Directive({ selector: '[nwQuick]' })
class QuickAttrappe {
  @Input() nwQuick: string | null = null;
}
@Directive({ selector: '[nwBegriff]' })
class BegriffAttrappe {
  @Input() nwBegriff: string | null = null;
}

describe('anordnen › tabs (T-247)', () => {
  const layout = [
    { id: 's', el: 'sheet' as const },
    {
      id: 't',
      el: 'tabs' as const,
      tabs: [
        { id: 'about', label: 'Overview', layout: [{ id: 'f', el: 'fields' as const, fields: 'all' as const }] },
        { id: 'combat', label: 'Combat', layout: [{ id: 'z', el: 'turn' as const }] },
      ],
    },
  ];
  it('keeps the header above the tabs and tags every piece with its tab', () => {
    const st = anordnen(layout, [], [], { beschreibung: null, rest: false });
    expect(st.map((x) => [x.art, x.reiter ?? null])).toEqual([
      ['bogen', null],
      ['zug', 'combat'],
    ]);
    expect(reiterVon(layout).map((t) => t.id)).toEqual(['about', 'combat']);
  });
  it('puts the rest into the first tab, not under every one', () => {
    const zelle = { comp: 'X', prop: 'y', ref: 'X.y', label: 'Y', wert: '1', key: 'X.y' };
    const st = anordnen([layout[1]!], [zelle as never], [], { beschreibung: null, rest: true });
    expect(st.find((x) => x.id === 'f')?.reiter).toBe('about');
  });
});

const kopf = (mehr: Partial<SheetHeader> = {}): SheetHeader => ({
  hp: 18,
  max: 22,
  temp: 3,
  vitals: [{ key: 'ac', label: 'AC', value: '15' }, { key: 'init', label: 'Init', value: '+4' }],
  casting: [{ key: 'dc', label: 'Save DC', value: '12' }],
  hitDice: { die: 'd8', max: 3, left: 2 },
  slots: [{ level: 1, max: 2, used: 1 }],
  inspiration: false,
  abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((key) => ({ key, label: key.toUpperCase(), score: 10, mod: 0, save: key === 'con' ? 1 : 0, saveProficient: false })),
  ...mehr,
});

function aufbauen(vitals: Record<string, unknown> = {}, opt: { darf?: boolean; k?: SheetHeader } = {}) {
  const figur: Entity = { id: 'pc', interfaces: ['PlayerCharacter'], name: 'Pc', components: { Vitals: { hp: 18, hpTemp: 3, ...vitals } }, relations: [] };
  const daten = {
    fuer: () => ({
      figur: signal(figur),
      statblock: signal(undefined),
      ohneStatblock: signal(false),
      kopf: signal(opt.k ?? kopf()),
      gehalten: signal([]),
      haende: signal(handState([])),
      zauber: signal([]),
      kupfer: signal({ beiDir: 3712, gruppe: 15000 }),
    }),
    vitals: vi.fn().mockResolvedValue(undefined),
  };
  const api = { roll: vi.fn().mockResolvedValue({ total: 14 }), list: vi.fn().mockResolvedValue({ rows: [{ id: 'cond-p', name: 'Poisoned' }] }) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: FigurDaten, useValue: daten },
      { provide: Api, useValue: api },
      { provide: Bestand, useValue: { name: signal((id: string) => ({ 'sp-1': 'Silent Image', 'cond-p': 'Poisoned' })[id]), holen: vi.fn() } },
      { provide: Session, useValue: { darfSchreiben: signal(() => opt.darf ?? true) } },
      { provide: Glossar, useValue: { begriffZu: () => null } },
    ],
  });
  /* JIT lädt keine Stildatei und kennt `input()` nicht (text.test.ts). */
  TestBed.overrideComponent(Bogen, { set: { styleUrl: undefined, styleUrls: [], styles: [], imports: [RouterLink, QuickAttrappe, BegriffAttrappe] } });
  const fixture = TestBed.createComponent(Bogen);
  Object.assign(fixture.componentInstance, { artikel: signal(figur) });
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const knopf = (text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
  return { fixture, el, daten, api, knopf, figur };
}

describe('nw-bogen (T-247)', () => {
  it('shows hit points, temp, the carousel and gold on you and with the party', () => {
    const { el } = aufbauen();
    expect(el.querySelector('.hpwert')?.textContent).toContain('18');
    expect(el.querySelector('.hpwert')?.textContent).toContain('/ 22');
    expect((el.querySelector('.temp input') as HTMLInputElement).value).toBe('3');
    expect(el.querySelector('.karussell')?.textContent).toContain('Vitals');
    expect(el.querySelector('.goldwert')?.textContent).toContain('37 gp 12 cp');
    expect(el.querySelector('.goldwert')?.textContent).toContain('party 150 gp');
    expect(el.querySelectorAll('.attr').length).toBe(6);
  });

  it('turns the carousel to spellcasting', () => {
    const { el, fixture } = aufbauen();
    (el.querySelector('.pfeil[aria-label="Next"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.karussell')?.textContent).toContain('Save DC');
  });

  it('writes damage through the model: temp first', async () => {
    const { knopf, daten } = aufbauen();
    knopf('− Damage').click();
    await Promise.resolve();
    const aendern = daten.vitals.mock.calls[0]![1] as (v: Record<string, unknown>) => Record<string, unknown>;
    expect(aendern({ hp: 18, hpTemp: 3 })).toEqual({ hp: 17, hpTemp: undefined });
  });

  it('asks for the concentration check after damage while concentrating, and Failed ends it', async () => {
    const { knopf, daten, fixture, el } = aufbauen({ concentration: 'sp-1', durations: { concentration: '9 min' } });
    expect(el.querySelector('.status')?.textContent).toContain('Concentrating · Silent Image');
    expect(el.querySelector('.status')?.textContent).toContain('9 min');
    await (fixture.componentInstance as unknown as { schaden: () => Promise<void> }).schaden();
    fixture.detectChanges();
    expect(el.querySelector('.probe')?.textContent).toContain('CON save DC 10');
    knopf('Failed').click();
    await Promise.resolve();
    const aendern = daten.vitals.mock.calls.at(-1)![1] as (v: Record<string, unknown>) => Record<string, unknown>;
    expect(aendern({ concentration: 'sp-1', durations: { concentration: '9 min' } })).toEqual({ concentration: undefined, durations: undefined });
  });

  it('collapses from the status row and keeps HP, damage and heal', () => {
    const { knopf, fixture, el } = aufbauen();
    knopf('▴ Less').click();
    fixture.detectChanges();
    expect(el.querySelector('.kompakt')).not.toBeNull();
    expect(knopf('− Dmg')).toBeTruthy();
    expect(knopf('▾ More')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('adds a condition with a duration', async () => {
    const { knopf, fixture, el, daten } = aufbauen();
    knopf('+ Condition').click();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { zustandDazu: (id: string, d: string) => Promise<void> }).zustandDazu('cond-p', '1 h');
    await Promise.resolve();
    const aendern = daten.vitals.mock.calls.at(-1)![1] as (v: Record<string, unknown>) => Record<string, unknown>;
    expect(aendern({})).toEqual({ conditions: ['cond-p'], durations: { 'cond-p': '1 h' } });
    expect(el.querySelector('select option[value="cond-p"]')).not.toBeNull();
  });

  it('shows values without buttons to those who may not write', () => {
    const { el } = aufbauen({}, { darf: false });
    expect(el.textContent).not.toContain('Damage');
    expect(el.textContent).not.toContain('+ Condition');
    expect(el.querySelector('.hpwert')?.textContent).toContain('18');
  });
});

describe('nw-werkzeugleiste (T-247)', () => {
  it('emits its actions, undo only when possible, and done', () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(Werkzeugleiste);
    Object.assign(fixture.componentInstance, {
      titel: signal('Rapier'),
      beschriftung: signal(''),
      hinweis: signal(''),
      aktionen: signal([{ id: 'use', icon: '✓', label: 'Use' }]),
      rueckgaengigMoeglich: signal(false),
      mitDetails: signal(true),
      detailsOffen: signal(false),
    });
    const aktion = vi.fn();
    const undo = vi.fn();
    const fertig = vi.fn();
    fixture.componentInstance.aktion.subscribe(aktion);
    fixture.componentInstance.rueckgaengig.subscribe(undo);
    fixture.componentInstance.fertig.subscribe(fertig);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="toolbar"]')?.textContent).toContain('Rapier');
    (el.querySelector('[aria-label="Use"]') as HTMLButtonElement).click();
    (el.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click();
    (el.querySelector('.fertig') as HTMLButtonElement).click();
    expect(aktion).toHaveBeenCalledWith('use');
    expect(undo).not.toHaveBeenCalled();
    expect(fertig).toHaveBeenCalled();
  });
});

/* JIT kennt `input()` nicht: Leiste und Blatt als Attrappen mit @Input. */
@Component({ selector: 'nw-werkzeugleiste', template: '<div class="leiste">{{ titel }}</div>' })
class LeisteAttrappe {
  @Input() titel = '';
  @Input() beschriftung = '';
  @Input() hinweis = '';
  @Input() aktionen: unknown[] = [];
  @Input() rueckgaengigMoeglich: boolean | null = null;
  @Input() mitDetails = false;
  @Input() detailsOffen = false;
}
@Component({ selector: 'nw-unterblatt', template: '<ng-content />' })
class BlattAttrappe {
  @Input() titel = '';
  @Input() offen = false;
}

describe('nw-zug (T-247)', () => {
  function zug(turnUsed?: string[]) {
    const figur: Entity = { id: 'pc', interfaces: ['PlayerCharacter'], name: 'Pc', components: { Vitals: turnUsed ? { turnUsed } : {} }, relations: [] };
    const haende = handState([
      { id: 'w', name: 'Blade', slot: 'mainHand', properties: [], damage: '1d6' },
      { id: 'w2', name: 'Club', slot: 'offHand', properties: [] },
    ]);
    const zeilen = turnRows(
      turnActions({ hands: haende, spells: [{ id: 's', name: 'Spark', level: 0, actionTypeName: 'Action', components: ['v', 's'] }] }),
      haende,
    );
    const daten = {
      fuer: () => ({ zug: signal(zeilen) }),
      vitals: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: FigurDaten, useValue: daten }, { provide: Session, useValue: { darfSchreiben: signal(() => true) } }],
    });
    TestBed.overrideComponent(Zug, { set: { styleUrl: undefined, styleUrls: [], styles: [], imports: [RouterLink, LeisteAttrappe, BlattAttrappe] } });
    const fixture = TestBed.createComponent(Zug);
    Object.assign(fixture.componentInstance, { artikel: signal(figur) });
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, daten };
  }

  it('lists every action by type, keeps blocked ones visible with the reason', () => {
    const { el } = zug();
    expect([...el.querySelectorAll('h3')].map((h) => h.textContent?.split(' ')[0]?.trim())).toEqual(['Action', 'Bonus', 'Reaction', 'Free', 'Trigger']);
    const spark = [...el.querySelectorAll('.zeile')].find((z) => z.textContent?.includes('Spark'))!;
    expect(spark.classList).toContain('gesperrt');
    expect(spark.textContent).toContain('🔒 no free hand');
    expect(el.textContent).toContain('Blade 1d6');
  });

  it('filters by type with counts and by source', () => {
    const { el, fixture } = zug();
    const bonus = [...el.querySelectorAll('.filter .chip')].find((b) => b.textContent?.startsWith('Bonus')) as HTMLButtonElement;
    expect(bonus.textContent).toContain('1');
    bonus.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('h3').length).toBe(1);
    (el.querySelector('.quellen-knopf') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.quellen')?.textContent).toContain('Spells');
  });

  it('marks a type used, starts a new turn, and shows the toolbar for a chosen row', async () => {
    const { el, fixture, daten } = zug(['bonus']);
    const used = [...el.querySelectorAll('.used .chip')] as HTMLButtonElement[];
    expect(used.find((b) => b.textContent?.includes('Bonus'))?.getAttribute('aria-pressed')).toBe('true');
    used.find((b) => b.textContent?.includes('Action'))!.click();
    await Promise.resolve();
    expect((daten.vitals.mock.calls[0]![1] as () => unknown)()).toEqual({ turnUsed: ['bonus', 'action'] });
    ([...el.querySelectorAll('.zeile')].find((z) => z.textContent?.includes('Dash')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('nw-werkzeugleiste')?.textContent).toContain('Dash');
  });
});

describe('nw-zauberliste (T-246)', () => {
  function zauberliste(haende = handState([])) {
    const figur: Entity = { id: 'pc', interfaces: ['PlayerCharacter'], name: 'Pc', components: { Vitals: {} }, relations: [{ id: 'k1', type: 'casts', to: 'sp1', props: { mode: 'known' } }] };
    const spell: Entity = {
      id: 'sp1', interfaces: ['Spell'], name: 'Veil',
      components: { Spell: { level: 1, school: 'illusion', components: ['v', 's'], concentration: true, duration: 'timed', durationAmount: 10, durationUnit: 'minute', castingAction: 'at' } },
      relations: [],
    };
    const reg = { interfaces: { Spell: { name: 'Spell', schema: { properties: {} } } }, relations: {}, views: {}, units: {}, settings: {} };
    const daten = {
      fuer: () => ({
        zauber: signal([{ kante: figur.relations![0]!, spell }]),
        haende: signal(haende),
        kopf: signal(kopf({ slots: [{ level: 1, max: 2, used: 0 }] })),
      }),
      vitals: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: FigurDaten, useValue: daten },
        { provide: Api, useValue: { list: vi.fn().mockResolvedValue({ total: 14, rows: [{ id: 'x', name: 'Charm' }] }) } },
        { provide: Bestand, useValue: { registry: signal(reg), name: signal((id: string) => (id === 'at' ? 'Action' : undefined)), voll: signal(new Map([['at', { id: 'at', interfaces: ['ActionType'], name: 'Action', components: {}, relations: [] }]])) } },
        { provide: Session, useValue: { darfSchreiben: signal(() => true) } },
      ],
    });
    TestBed.overrideComponent(Zauberliste, { set: { styleUrl: undefined, styleUrls: [], styles: [], imports: [RouterLink, QuickAttrappe] } });
    const fixture = TestBed.createComponent(Zauberliste);
    Object.assign(fixture.componentInstance, { artikel: signal(figur) });
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, daten };
  }

  it('lists spells by level with time, tags and Cast with the slot it uses', async () => {
    const { el, fixture } = zauberliste();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    expect(el.querySelector('h3')?.textContent).toContain('1st level');
    const z = el.querySelector('.zeile')!;
    expect(z.textContent).toContain('Veil');
    expect(z.textContent).toContain('1 action');
    expect(z.querySelector('.tag.konz')).not.toBeNull();
    expect(z.querySelector('.wirken')?.textContent?.trim()).toBe('Cast 1st');
    expect(el.textContent).toContain('Possible for you now');
    expect(el.textContent).toContain('all 14');
    expect(el.querySelector('.weg')?.textContent).toContain('Spells known');
    expect(el.querySelector('details summary')?.textContent).toContain('Other ways');
  });

  it('casting uses the slot, starts concentration and marks the action used', async () => {
    const { el, daten } = zauberliste();
    (el.querySelector('.wirken') as HTMLButtonElement).click();
    await Promise.resolve();
    const aendern = daten.vitals.mock.calls[0]![1] as (v: Record<string, unknown>) => Record<string, unknown>;
    expect(aendern({})).toEqual({ slotsUsed: [1], concentration: 'sp1', durations: { concentration: 'up to 10 minutes' }, turnUsed: ['action'] });
  });

  it('blocks casting without a free hand and says why', () => {
    const { el } = zauberliste(handState([{ id: 'a', name: 'A', slot: 'mainHand', properties: [] }, { id: 'b', name: 'B', slot: 'offHand', properties: [] }]));
    expect(el.querySelector('.wirken')?.textContent).toContain('Blocked');
    expect(el.querySelector('.sperre')?.textContent).toContain('no free hand');
  });
});
