/**
 * Glossar und Handbuch in der Oberfläche (T-242, T-225): ein Begriff im
 * Text ist gepunktet markiert, Strg/⌘+Klick öffnet ihn in der Leiste, und
 * das Handbuch nimmt jede Seite, jede Regeloption und jedes Kapitel mit.
 * Erfundene Wörter.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { RULE_OPTIONS, type GlossaryEntry } from '@nw/model';
import { Api } from '../src/app/kern/api';
import { Bestand } from '../src/app/kern/bestand';
import { Glossar } from '../src/app/kern/glossar';
import { WurfZiel } from '../src/app/kern/wurfziel';
import { Text } from '../src/app/artikel/text';
import { HILFE, abschnittFuer, abschnittId } from '../src/app/kern/hilfe';
import { ERZEUGT, KAPITEL, buchstabe, regelKapitel } from '../src/app/kern/handbuch';

const eintrag = (id: string, term: string, mehr: Partial<GlossaryEntry> = {}): GlossaryEntry => ({
  id, term, aliases: [], sort: 'condition', definition: `${term}.`, examples: [], translations: [], explains: [], autolink: true, article: true, ...mehr,
});

describe('nw-text mit Glossar (T-242)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Api,
          useValue: {
            glossary: vi.fn().mockResolvedValue({
              terms: [
                eintrag('g1', 'Glum', { aliases: ['gloomy'] }),
                eintrag('g2', 'Sprightly', { autolink: false }),
                eintrag('app:layer', 'Layer', { sort: 'app', article: false, autolink: false }),
              ],
            }),
            glossaryUses: vi.fn().mockResolvedValue({ counted: true, total: 0, rows: [] }),
          },
        },
        WurfZiel,
        { provide: Bestand, useValue: { verweise: signal(new Map([['glossaryterm-0002', [{ id: 'g2', name: 'Sprightly' }]]])) } },
      ],
    });
  });

  async function zeichne(text: string) {
    await TestBed.inject(Glossar).laden();
    const fixture = TestBed.createComponent(Text);
    Object.assign(fixture.componentInstance, { text: signal(text), scopes: signal({}), inline: signal(false), vorspann: signal(''), vorspannZiel: signal('') });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('marks terms by name and alias, not those that say no, nor words of the app', async () => {
    const el = await zeichne('The gloomy bard feels glum on every layer, never sprightly.');
    const begriffe = [...el.querySelectorAll('.begriff')].map((b) => [b.textContent, b.getAttribute('data-begriff')]);
    expect(begriffe).toEqual([
      ['gloomy', 'g1'],
      ['glum', 'g1'],
    ]);
  });

  it('draws a link to a glossary article as a term', async () => {
    const el = await zeichne('See [[glossaryterm-0002|lively]].');
    const b = el.querySelector('.begriff');
    expect(b?.textContent).toBe('lively');
    expect(b?.getAttribute('data-begriff')).toBe('g2');
    expect(el.querySelector('a')).toBeNull();
  });

  it('opens the entry beside the page on Ctrl/⌘+click, not on a plain click', async () => {
    const el = await zeichne('Glum.');
    const b = el.querySelector('.begriff') as HTMLElement;
    const glossar = TestBed.inject(Glossar);
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(glossar.offen()).toBeNull();
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true, cancelable: true }));
    expect(glossar.offen()).toBe('g1');
  });

  it('finds the entry of a condition by its explains edge, else by name', async () => {
    const glossar = TestBed.inject(Glossar);
    await glossar.laden();
    expect(glossar.begriffZu('c_x', 'Glum')).toBe('g1');
    expect(glossar.begriffZu('c_y', 'Unknown')).toBeNull();
  });
});

describe('Handbuch (T-242, T-225)', () => {
  it('has every chapter once, the generated ones included', () => {
    const ids = KAPITEL.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of ERZEUGT) expect(ids).toContain(k);
    for (const k of KAPITEL) {
      expect(k.title.trim(), k.id).not.toBe('');
      expect(k.intro.trim(), k.id).not.toBe('');
      if (!(ERZEUGT as readonly string[]).includes(k.id)) expect(k.sections?.length, k.id).toBeGreaterThan(0);
    }
  });

  it('gives every page of help its own section, which “?” and What’s new open', () => {
    const ids = HILFE.map(abschnittId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(abschnittFuer('/play')).toBe('page-play');
    expect(abschnittFuer('/artikel/x')).toMatch(/^page-[a-z0-9-]+$/);
    expect(abschnittFuer('/login')).toBeNull();
  });

  it('lists every rule option under its sort', () => {
    const gezeigt = regelKapitel().flatMap((k) => k.optionen.map((o) => o.key));
    expect(RULE_OPTIONS.map((o) => o.key).filter((k) => !gezeigt.includes(k))).toEqual([]);
  });

  it('sorts terms under their first letter', () => {
    expect(buchstabe('Ébène')).toBe('E');
    expect(buchstabe('5-foot step')).toBe('#');
  });
});
