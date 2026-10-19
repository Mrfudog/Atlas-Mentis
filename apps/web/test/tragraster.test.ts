/**
 * Das Tragraster einstellen (REQ-355): der Editor liest die Einstellungen
 * von Basils Blatt und schreibt sie so zurück, wie das Inventar sie liest —
 * eine gelöschte Behältervorlage ist danach auch in den Einstellungen weg.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { parseContainerPreset } from '@nw/model';
import { Tragraster } from '../src/app/artikel/tragraster';
import { Bestand } from '../src/app/kern/bestand';

const EINSTELLUNGEN = {
  gridSize: '70',
  inventoryCols: '10',
  inventoryRows: '6',
  carrySquares: 'tiny:3, medium:5',
  carryZones: '0-1:bonus action, 2-4:action',
  handActions: 'drop:free action, stow:bonus action',
  slotDraw: 'mainHand:free action, belt:action',
  'container:Backpack': '.##./#### | 0-1:action, 2-3:turn',
  'container:Pouch': '##',
};

async function erzeuge() {
  const schreibe = vi.fn().mockResolvedValue(undefined);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: Bestand,
        useValue: {
          registry: signal({
            interfaces: {},
            settings: EINSTELLUNGEN,
            enums: { DrawTime: { name: 'DrawTime', values: ['free action', 'bonus action', 'action', 'turn', 'round'] } },
          }),
          registerSchreiben: schreibe,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Tragraster);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement, schreibe };
}

function waehle(el: Element, wert: string): void {
  const s = el as HTMLSelectElement;
  s.value = wert;
  s.dispatchEvent(new Event('change'));
}

describe('nw-tragraster', () => {
  it('draws the widest base square plus the extra square, with a zone above each column', async () => {
    const { el } = await erzeuge();
    /* 5 (medium) + 5 Zusatz = 10 Spalten im Tragraster, dazu 4 der ersten Vorlage und 2 der zweiten. */
    const raster = el.querySelectorAll('.raster');
    expect(raster[0]!.querySelectorAll('select.spalte')).toHaveLength(10);
    expect((raster[0]!.querySelectorAll('select.spalte')[3] as HTMLSelectElement).value).toBe('action');
    expect([...el.querySelectorAll('.groesse input.name')].map((i) => (i as HTMLInputElement).value)).toEqual(['tiny', 'medium']);
  });

  it('writes the settings back in the form the inventory reads them', async () => {
    const { fixture, el, schreibe } = await erzeuge();
    const spalten = el.querySelectorAll('.raster')[0]!.querySelectorAll('select.spalte');
    waehle(spalten[5]!, 'turn');
    waehle(spalten[6]!, 'turn');
    fixture.detectChanges();
    /* Die zweite Vorlage weg, in der ersten ein Feld schliessen. */
    (el.querySelectorAll('.vorlage button[aria-label^="Remove"]')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.vorlage button.feld[aria-label="Cell 1,2"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('button.pri') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(schreibe).toHaveBeenCalledTimes(1);
    const [teil, neu] = schreibe.mock.calls[0]!;
    expect(teil).toBe('settings');
    expect(neu.carryZones).toBe('0-1:bonus action, 2-4:action, 5-6:turn');
    expect(neu.carrySquares).toBe('tiny:3, medium:5');
    expect(neu.gridSize).toBe('70');
    expect(neu['container:Pouch']).toBeUndefined();
    expect(parseContainerPreset(neu['container:Backpack'])!.grid).toEqual(['.##.', '.###']);
    expect(neu.handActions).toBe('drop:free action, stow:bonus action');
  });

  it('refuses two templates with the same name', async () => {
    const { fixture, el, schreibe } = await erzeuge();
    const namen = el.querySelectorAll('.vorlage input.name');
    const zweite = namen[1] as HTMLInputElement;
    zweite.value = 'Backpack';
    zweite.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (el.querySelector('button.pri') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(schreibe).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('name of its own');
  });
});
