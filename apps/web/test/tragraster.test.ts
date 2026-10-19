/**
 * Das Tragblatt einstellen (REQ-355, REQ-356): der Editor liest die
 * Bausteine (aus `carrySheet` oder den älteren Einstellungen), zeigt sie
 * für eine gewählte Grösse und Stärke aneinandergefügt und schreibt das
 * Blatt so zurück, wie das Inventar es liest.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { parseCarrySheet, parseContainerTemplate, zoneMap } from '@nw/model';
import { Tragraster } from '../src/app/artikel/tragraster';
import { Zonenmaler } from '../src/app/artikel/zonenmaler';
import { Bestand } from '../src/app/kern/bestand';

const LEITER = ['free action', 'bonus action', 'action', 'turn', 'round'];

const EINSTELLUNGEN = {
  gridSize: '70',
  inventoryCols: '10',
  inventoryRows: '6',
  carrySquares: 'tiny:3, medium:5',
  carryZones: '0-1:bonus action, 2-4:action, 5-10:turn',
  handActions: 'drop:free action, stow:bonus action',
  slotDraw: 'mainHand:free action, belt:action',
  'container:Backpack': '.##./#### | 0-1:action, 2-3:turn',
  'container:Pouch': '##',
};

const REGISTER = {
  interfaces: {
    Abilities: { name: 'Abilities', label: 'Abilities', schema: { properties: { str: { type: 'number', title: 'STR' } } } },
    Statblock: {
      name: 'Statblock',
      extends: ['Abilities'],
      schema: {
        properties: {
          size: { type: 'string', title: 'Size', enumRef: 'Size' },
          carryExtra: { type: 'number', title: 'Extra carry square', derived: 'mod(str)', min: 0, max: 5 },
        },
      },
    },
  },
  settings: EINSTELLUNGEN,
  enums: {
    DrawTime: { name: 'DrawTime', values: LEITER },
    Size: { name: 'Size', values: ['tiny', 'small', 'medium', 'large'] },
  },
};

async function erzeuge() {
  const schreibe = vi.fn().mockResolvedValue(undefined);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: Bestand, useValue: { registry: signal(REGISTER), registerSchreiben: schreibe } }],
  });
  /* JIT kennt Signal-Eingaben nicht (siehe text.test.ts): der Maler wird hier
     nicht gezeichnet, er hat unten eigene Tests. */
  TestBed.overrideComponent(Tragraster, { remove: { imports: [Zonenmaler] }, add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] } });
  const fixture = TestBed.createComponent(Tragraster);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, schreibe };
}

function waehle(el: Element, wert: string, ereignis = 'change'): void {
  (el as HTMLInputElement).value = wert;
  el.dispatchEvent(new Event(ereignis));
}

describe('nw-tragraster', () => {
  it('joins the blocks that apply — the preview shows what strength adds', async () => {
    const { fixture, el } = await erzeuge();
    /* Vorgabe der Vorschau: medium, STR 16 → +3. */
    expect(el.querySelector('.bilanz')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Size: medium 5×5 + Strength +3 3×3 = 8×5, 34 cells');
    const str = [...el.querySelectorAll('.probe label')].find((l) => l.textContent?.includes('STR'))!.querySelector('input')!;
    waehle(str, '10', 'input');
    fixture.detectChanges();
    expect(el.querySelector('.bilanz')?.textContent).not.toContain('Strength');
    waehle(str, '20', 'input');
    fixture.detectChanges();
    expect(el.querySelector('.bilanz')?.textContent).toContain('Strength +5');
    /* Das Zusatzquadrat liest die Spalten ab dem grössten Grundquadrat weiter: „turn". */
    expect(el.querySelectorAll('.vorschau .feld.naht').length).toBeGreaterThan(0);
  });

  it('saves the sheet as blocks with zones, and templates with theirs', async () => {
    const { fixture, el, schreibe } = await erzeuge();
    /* Die zweite Vorlage weg. */
    const vorlagen = [...el.querySelectorAll('details.baustein')].filter((d) => d.querySelector('input[aria-label="Template name"]'));
    (vorlagen[1]!.querySelector('button[aria-label^="Remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('button.pri') as HTMLButtonElement).click();
    await fixture.whenStable();

    const [teil, neu] = schreibe.mock.calls[0]!;
    expect(teil).toBe('settings');
    const blatt = parseCarrySheet(neu.carrySheet)!;
    expect(blatt.blocks.map((b) => b.id)).toEqual(['size-tiny', 'size-medium', 'strength-1', 'strength-2', 'strength-3', 'strength-4', 'strength-5']);
    expect(zoneMap(blatt.blocks[1]!.rows, blatt.blocks[1]!.zones)['4,0']).toBe('action');
    /* Die älteren Einstellungen bleiben stehen; `carrySheet` geht vor. */
    expect(neu.carrySquares).toBe('tiny:3, medium:5');
    expect(neu['container:Pouch']).toBeUndefined();
    const rucksack = parseContainerTemplate(neu['container:Backpack'])!;
    expect(zoneMap(rucksack.rows, rucksack.zones)['0,1']).toBe('action');
    expect(neu.gridSize).toBe('70');
  });

  it('refuses two templates with the same name', async () => {
    const { fixture, el, schreibe } = await erzeuge();
    const namen = el.querySelectorAll('input[aria-label="Template name"]');
    waehle(namen[1]!, 'Backpack');
    fixture.detectChanges();
    (el.querySelector('button.pri') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(schreibe).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('name of its own');
  });
});

describe('nw-zonenmaler', () => {
  function maler(zones: { id: string; draw: string; cells: string[] }[] = []) {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(Zonenmaler);
    /* JIT kennt `input()` nicht: die Signale vor dem ersten Zeichnen ersetzen. */
    Object.assign(fixture.componentInstance, { rows: signal(['###', '###']), zones: signal(zones), leiter: signal(LEITER), label: signal('Grid') });
    const raus: unknown[] = [];
    fixture.componentInstance.aendern.subscribe((g) => raus.push(g));
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, raus };
  }

  const zelle = (el: HTMLElement, k: string) => el.querySelector(`[data-zelle="${k}"]`) as HTMLButtonElement;

  it('makes a zone from the selected cells and takes them from the old one', () => {
    const { fixture, el, raus } = maler([{ id: 'z1', draw: 'action', cells: ['0,0', '1,0'] }]);
    for (const k of ['1,0', '2,0']) zelle(el, k).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('Clear selection (2)');
    const neu = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Zone from selection'))!;
    neu.click();
    expect(raus.at(-1)).toEqual({
      rows: ['###', '###'],
      zones: [{ id: 'z1', draw: 'action', cells: ['0,0'] }, { id: 'z2', draw: 'free action', cells: ['1,0', '2,0'] }],
    });
  });

  it('closes selected cells and drops them from every zone', () => {
    const { fixture, el, raus } = maler([{ id: 'z1', draw: 'turn', cells: ['0,1', '1,1'] }]);
    zelle(el, '0,1').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Close cells')!.click();
    expect(raus.at(-1)).toEqual({ rows: ['###', '.##'], zones: [{ id: 'z1', draw: 'turn', cells: ['1,1'] }] });
  });
});
