/**
 * **Collection** (T-425, REQ-430): die Session zeigt ihre Szenen und
 * Begegnungen, jede in der Kurzansicht ihrer eigenen Art.
 *
 * Geprüft wird, was der Zeichner tut: je Treffer eine Kachel mit Namen und
 * eingebetteter Kurzansicht (`nw-vorschau`, Ansicht der Zielart), nach Art
 * gruppiert; was der Server zurückhielt, steht nicht da; in einer Kachel
 * zeichnet eine weitere Collection nichts (eine Stufe).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA, Component, Input, computed, signal, ɵresolveComponentResources as stileAufloesen } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { RouterLink, provideRouter } from '@angular/router';
import { seedRegistry } from '@nw/registry';
import type { Entity, IncomingEdge, LayoutElement } from '@nw/model';
import { Ansichtsbaum, SAMMLUNGSTIEFE, Sammelfach } from '../src/app/ansichten/baum';
import { Bestand } from '../src/app/kern/bestand';

const id = (name: string, nr: string) => ({ Identity: { name, id: nr, aliases: [] } });
const session: Entity = { id: 'ses_1', interfaces: ['Session'], name: 'Session 1', components: id('Session 1', 'session-0001') };
const alter: Entity = { id: 'sc_alter', interfaces: ['Scene'], name: 'Der Alte', components: id('Der Alte', 'scene-0002'), relations: [{ type: 'partOf', to: 'ses_1' }] };
const miene: Entity = { id: 'sc_miene', interfaces: ['Scene'], name: 'Die Miene', components: id('Die Miene', 'scene-0010'), relations: [{ type: 'partOf', to: 'ses_1' }] };
const ratten: Entity = { id: 'enc_rats', interfaces: ['Encounter'], name: 'Rats', components: id('Rats', 'encounter-0001'), relations: [{ type: 'partOf', to: 'ses_1' }] };
const rueck: IncomingEdge[] = [alter, miene, ratten].map((e) => ({ type: 'partOf', from: e.id }));

const sammlung: LayoutElement = {
  id: 'se-contains',
  el: 'collection',
  text: 'Scenes and encounters',
  path: [{ relation: 'partOf', dir: 'in' }],
  types: ['Scene', 'Encounter'],
  groupBy: 'type',
};

/* Die Kurzansicht als Attrappe: JIT löst den Kreis Baum ↔ Kurzansicht
   (forwardRef) nicht auf, und hier zählt nur, dass je Treffer eine mit
   der richtigen Ansicht gezeichnet wird. */
@Component({ selector: 'nw-vorschau', template: `<i class="attrappe">{{ id }} · {{ ansicht }}</i>` })
class VorschauAttrappe {
  @Input() id = '';
  @Input() ansicht = '';
  @Input() eingebettet = false;
  @Input() rueck = true;
}

/** Ein Bestand, wie ihn der Server für einen Betrachter gefüllt hat. */
function bestand(sichtbar: readonly Entity[]) {
  const voll = signal(new Map(sichtbar.map((e) => [e.id, e])));
  return {
    registry: signal(seedRegistry),
    voll,
    rueckbezuege: signal(new Map()),
    fehlt: signal(new Set<string>()),
    vergleich: signal(new Set<string>()),
    bild: signal(new Map()),
    name: computed(() => (x: string) => voll().get(x)?.name),
    holen: vi.fn(async () => undefined),
    oeffnen: vi.fn(async () => undefined),
    load: vi.fn(async () => undefined),
  };
}

async function aufsetzen(sichtbar: readonly Entity[], tiefe = 0) {
  await stileAufloesen(() => Promise.resolve(''));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: Bestand, useValue: bestand(sichtbar) }, { provide: SAMMLUNGSTIEFE, useValue: tiefe }],
  });
  /* Wie bogen.test.ts: ohne Stildatei, und nur, was eine Collection braucht —
     die übrigen Zeichner (Statblock, Zauber …) stehen hier als fremde Elemente. */
  TestBed.overrideComponent(Ansichtsbaum, {
    set: { styleUrl: undefined, styleUrls: [], styles: [], imports: [NgTemplateOutlet, RouterLink, Sammelfach, VorschauAttrappe], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
  });
}

/** Den Baum zeichnen; JIT kennt `input()` nicht, also die Signale vorher ersetzen (wie verlinkt.test.ts). */
function zeichnen(layout: LayoutElement[] = [sammlung]) {
  const f = TestBed.createComponent(Ansichtsbaum);
  Object.assign(f.componentInstance, { artikel: signal(session), layout: signal(layout), rueck: signal(rueck), register: signal(null) });
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('collection in a view (T-425)', () => {
  beforeEach(() => aufsetzen([session, alter, miene, ratten]));
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('draws one tile per article, grouped by type, each in the quick view of its own type', () => {
    const el = zeichnen();
    const kopf = el.querySelector('.sammlung h3')?.textContent ?? '';
    expect(kopf).toContain('Scenes and encounters');
    expect(kopf).toContain('3');
    const gruppen = [...el.querySelectorAll('.sammlung .gruppe')].map((g) => g.textContent?.trim().split(/\s+/)[0]);
    expect(gruppen).toEqual([seedRegistry.interfaces['Encounter']!.label?.split(/\s+/)[0], seedRegistry.interfaces['Scene']!.label?.split(/\s+/)[0]]);
    const namen = [...el.querySelectorAll('.sammelkachel .kname')].map((a) => a.textContent?.trim());
    expect(namen).toEqual(['Rats', 'Der Alte', 'Die Miene']);
    expect(el.querySelector('.sammelkachel .kname')?.getAttribute('href')).toBe('/artikel/enc_rats');
    /* Die Kachel ist die Kurzansicht der Zielart — die Views werden wiederverwendet. */
    expect([...el.querySelectorAll('.sammelkachel nw-vorschau')].map((v) => v.textContent?.trim())).toEqual([
      'enc_rats · quick',
      'sc_alter · quick',
      'sc_miene · quick',
    ]);
  });

  it('shows only what the server sent: a held-back scene is not there', async () => {
    await aufsetzen([session, alter, ratten]);
    const namen = [...zeichnen().querySelectorAll('.sammelkachel .kname')].map((a) => a.textContent?.trim());
    expect(namen).toEqual(['Rats', 'Der Alte']);
  });

  it('draws nothing without hits, and nothing inside a tile of another collection', async () => {
    expect(zeichnen([{ ...sammlung, types: ['Place'] }]).querySelector('.sammlung')).toBeNull();
    await aufsetzen([session, alter, miene, ratten], 1);
    expect(zeichnen().querySelector('.sammlung')).toBeNull();
  });

  it('as a list: a row per article with its type, in the overview view', () => {
    const el = zeichnen([{ ...sammlung, show: 'list', groupBy: undefined }]);
    const zeilen = [...el.querySelectorAll('.sammelliste li')];
    expect(zeilen.map((z) => z.querySelector('.kname')?.textContent?.trim())).toEqual(['Rats', 'Der Alte', 'Die Miene']);
    expect(zeilen[1]!.querySelector('.art')?.textContent).toBe(seedRegistry.interfaces['Scene']!.label);
    expect(zeilen[1]!.querySelector('nw-vorschau')?.textContent?.trim()).toBe('sc_alter · overview');
  });
});
