/**
 * **Der Statblock fragt seine Übungen in einem Abruf** (T-398, REQ-397):
 * bis zum 29.10. stellte er je Name eine eigene Suche (`list({of, q})`),
 * bei einer Figur mit vierzig Übungen also vierzig — und weil jede Antwort
 * `kurz` änderte, holte er die Artikel danach noch einmal schubweise.
 */

import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { Entity, Registry } from '@nw/model';
import { Statblock } from '../src/app/artikel/statblock';
import { Bestand } from '../src/app/kern/bestand';
import { Glossar } from '../src/app/kern/glossar';

const reg = {
  interfaces: {
    Identity: { name: 'Identity', abstract: true, schema: { properties: { name: { type: 'string' } } } },
    Skill: { name: 'Skill', label: 'Skill', extends: ['Identity'] },
    Language: { name: 'Language', label: 'Language', extends: ['Identity'] },
    Proficiencies: {
      name: 'Proficiencies',
      abstract: true,
      schema: { properties: { proficient: { type: 'array', enumRef: ['Skill', 'Language', 'Weapon.category'] } } },
    },
    Statblock: { name: 'Statblock', label: 'Statblock', extends: ['Identity', 'Proficiencies'] },
  },
  relations: {},
  views: {},
  units: {},
  vars: {},
  enums: {},
} as unknown as Registry;

const NAMEN = ['Athletics', 'Stealth', 'Perception', 'Common', 'Elvish', 'Dwarvish', 'Arcana', 'History'];

function aufbauen() {
  const kurz = signal<ReadonlyMap<string, Entity>>(new Map());
  const liste = vi.fn(async (frage: { name?: string[] }) => {
    /* Wie der Server: je gefundenem Namen eine Zeile, die in `kurz` landet. */
    const neu = new Map(kurz());
    for (const n of frage.name ?? []) {
      const id = `x_${n.toLowerCase()}`;
      neu.set(id, { id, interfaces: [n.length > 7 ? 'Skill' : 'Language'], name: n, components: { Identity: { name: n } } });
    }
    kurz.set(neu);
    return { rows: [], total: 0 };
  });
  const holen = vi.fn().mockResolvedValue(undefined);
  const bestand = {
    registry: signal(reg),
    kurz,
    voll: signal(new Map()),
    name: signal(() => undefined),
    liste,
    holen,
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: Bestand, useValue: bestand },
      { provide: Glossar, useValue: { feld: () => null } },
    ],
  });
  TestBed.overrideComponent(Statblock, { set: { template: '', imports: [], styleUrl: undefined, styleUrls: [], styles: [] } });
  const fixture = TestBed.createComponent(Statblock);
  const sb: Entity = {
    id: 'sb1',
    interfaces: ['Statblock'],
    name: 'Brakka',
    components: { Identity: { name: 'Brakka' }, Proficiencies: { proficient: NAMEN.slice(0, 6), expertise: NAMEN.slice(6) } },
    relations: [],
  };
  /* JIT kennt `input()` nicht: das Signal vorher ersetzen (wie sammlung.test.ts). */
  const artikel = signal(sb);
  Object.assign(fixture.componentInstance, { artikel, fassungen: signal([]) });
  fixture.detectChanges();
  return { fixture, liste, holen, sb, artikel };
}

describe('Statblock: proficiencies in one request (T-398)', () => {
  it('asks the list once for every name, limited to the source types', async () => {
    const { fixture, liste } = aufbauen();
    await fixture.whenStable();
    expect(liste).toHaveBeenCalledTimes(1);
    const frage = liste.mock.calls[0]![0] as { of: string[]; name: string[]; limit: number };
    expect(frage.of).toEqual(['Skill', 'Language']);
    expect(frage.name).toEqual(NAMEN);
    expect(frage.limit).toBeGreaterThanOrEqual(NAMEN.length);
  });

  it('fetches the found articles once, not once per answer', async () => {
    const { fixture, holen } = aufbauen();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    const gerufen = holen.mock.calls.filter((c) => (c[0] as string[]).length > 0);
    expect(gerufen).toHaveLength(1);
    expect(gerufen[0]![0]).toHaveLength(NAMEN.length);
  });

  it('does not ask again when the same article comes back (live update, save)', async () => {
    const { fixture, liste, sb, artikel } = aufbauen();
    await fixture.whenStable();
    artikel.set({ ...sb, components: { ...sb.components } });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(liste).toHaveBeenCalledTimes(1);
  });
});
