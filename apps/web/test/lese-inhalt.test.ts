/**
 * Das aufklappbare Inhaltsverzeichnis der Leseansicht (T-167): ein Baum
 * aus der flachen Liste, jede Stufe einzeln auf und zu, „alle auf/zu",
 * der Weg zum aktuellen Abschnitt klappt von selbst auf, und der Stand
 * gehört dem Gerät, je Buch.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LeseInhalt } from '../src/app/lesen/inhalt';
import type { LeseZeile } from '../src/app/kern/api';

const z = (id: string, depth: number, unit: string): LeseZeile => ({ id, name: id, type: 'Scene', depth, unit });
const TOC: LeseZeile[] = [
  z('buch', 0, 'buch'),
  z('k1', 1, 'k1'),
  z('s1', 2, 'k1'),
  z('s1a', 3, 'k1'),
  z('s2', 2, 'k1'),
  z('k2', 1, 'k2'),
  z('s3', 2, 'k2'),
];

function aufbau(aktuell: string | null = null, layer = 'ly1') {
  const f = TestBed.createComponent(LeseInhalt);
  /* JIT kennt `input()` nicht (siehe text.test.ts): die Signale vor dem ersten Zeichnen ersetzen. */
  Object.assign(f.componentInstance, { layer: signal(layer), toc: signal(TOC), aktuell: signal(aktuell), stueck: signal(undefined) });
  f.detectChanges();
  const sichtbar = () => Array.from(f.nativeElement.querySelectorAll('li') as NodeListOf<HTMLElement>).map((li) => li.dataset['id']);
  const klick = (id: string) => {
    (f.nativeElement.querySelector(`li[data-id="${id}"] .pfeil`) as HTMLButtonElement).click();
    f.detectChanges();
  };
  return { f, sichtbar, klick };
}

describe('the collapsible contents (T-167)', () => {
  beforeEach(() => localStorage.clear());

  it('starts with the top level open and opens one level at a time', () => {
    const { sichtbar, klick } = aufbau();
    expect(sichtbar()).toEqual(['buch', 'k1', 'k2']);
    klick('k1');
    expect(sichtbar()).toEqual(['buch', 'k1', 's1', 's2', 'k2']);
    klick('s1');
    expect(sichtbar()).toEqual(['buch', 'k1', 's1', 's1a', 's2', 'k2']);
    klick('k1');
    expect(sichtbar()).toEqual(['buch', 'k1', 'k2']);
  });

  it('expands and collapses everything at once', () => {
    const { f, sichtbar } = aufbau();
    const knopf = (text: string) =>
      Array.from(f.nativeElement.querySelectorAll('.alle button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes(text))!;
    knopf('Expand all').click();
    f.detectChanges();
    expect(sichtbar()).toEqual(TOC.map((x) => x.id));
    knopf('Collapse all').click();
    f.detectChanges();
    expect(sichtbar()).toEqual(['buch', 'k1', 'k2']);
  });

  it('opens the way to where the reader is and marks it', async () => {
    const { f, sichtbar } = aufbau('s1a');
    await f.whenStable();
    f.detectChanges();
    expect(sichtbar()).toEqual(['buch', 'k1', 's1', 's1a', 's2', 'k2']);
    expect(f.nativeElement.querySelector('li.hier')?.dataset['id']).toBe('s1a');
    expect(Array.from(f.nativeElement.querySelectorAll('li.weg') as NodeListOf<HTMLElement>).map((li) => li.dataset['id'])).toEqual([
      'buch',
      'k1',
      's1',
    ]);
  });

  it('keeps what is open per book on this device', () => {
    aufbau().klick('k2');
    expect(aufbau().sichtbar()).toEqual(['buch', 'k1', 'k2', 's3']);
    /* Ein anderes Buch fängt von vorn an. */
    expect(aufbau(null, 'ly2').sichtbar()).toEqual(['buch', 'k1', 'k2']);
  });
});
