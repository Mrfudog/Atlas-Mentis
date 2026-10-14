/**
 * Was neu ist (T-157): die Einträge in `whats-new.json` und der Stand je
 * Konto. Die Datei pflegt jeder Pull Request von Hand — was hier geprüft
 * wird, ist das, was beim Abtippen schiefgeht: doppelte Ids, ein Datum,
 * das keines ist, ein Sprung an eine Stelle, die es nicht gibt.
 */

import { describe, expect, it } from 'vitest';
import { EINTRAEGE, abKonto, istNeu, seitKonto, standAus, standNach, type NeuEintrag } from '../src/app/kern/neues';
import { routes } from '../src/app/app.routes';

const e = (id: string, date: string): NeuEintrag => ({
  id,
  date,
  title: id,
  text: id,
  area: 'Play',
});

describe('whats-new.json', () => {
  it('has unique ids that start with their date', () => {
    const ids = EINTRAEGE.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of EINTRAEGE) {
      expect(x.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(x.id.startsWith(`${x.date}-`), x.id).toBe(true);
      expect(x.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('is sorted newest first', () => {
    const daten = EINTRAEGE.map((x) => x.date);
    expect([...daten].sort().reverse()).toEqual(daten);
  });

  it('has a title, a short text and an area on every entry', () => {
    for (const x of EINTRAEGE) {
      expect(x.title.trim(), x.id).not.toBe('');
      expect(x.area.trim(), x.id).not.toBe('');
      expect(x.text.length, x.id).toBeGreaterThan(10);
      expect(x.text.length, x.id).toBeLessThanOrEqual(400);
    }
  });

  it('links only to pages that exist', () => {
    const pfade = routes.map((r) => r.path).filter((p): p is string => !!p && p !== '**');
    const passt = (link: string) =>
      pfade.some((p) => new RegExp(`^/${p.replace(/:[^/]+/g, '[^/]+')}$`).test(link.split('?')[0]));
    for (const x of EINTRAEGE) if (x.link) expect(passt(x.link), `${x.id}: ${x.link}`).toBe(true);
  });
});

describe('what is new for an account', () => {
  const liste = [e('2026-10-14-b', '2026-10-14'), e('2026-10-13-a', '2026-10-13')];

  it('counts everything as new without a stored state', () => {
    expect(liste.every((x) => istNeu(x, null))).toBe(true);
  });

  it('sees everything after marking, and an entry added later is new', () => {
    const stand = standNach(liste, new Date('2026-10-14T10:00:00Z'));
    expect(liste.some((x) => istNeu(x, stand))).toBe(false);
    /* Ein Pull Request, der länger offen lag, trägt ein älteres Datum. */
    expect(istNeu(e('2026-10-12-spaet', '2026-10-12'), stand)).toBe(true);
  });

  it('keeps the list short: old entries count as seen by date', () => {
    const alt = e('2026-01-01-alt', '2026-01-01');
    const stand = standNach([...liste, alt], new Date('2026-10-14T10:00:00Z'));
    expect(stand.seen).not.toContain(alt.id);
    expect(istNeu(alt, stand)).toBe(false);
  });

  it('ignores a broken stored value', () => {
    expect(standAus('x')).toBeNull();
    expect(standAus({ until: 'gestern' })).toBeNull();
    expect(standAus({ until: '2026-10-01', seen: ['a', 3] })).toEqual({
      until: '2026-10-01',
      seen: ['a'],
    });
  });
});

describe('only what is new since the account was created (T-163)', () => {
  const liste = [
    e('2026-10-14-b', '2026-10-14'),
    e('2026-10-13-a', '2026-10-13'),
    e('2026-09-01-alt', '2026-09-01'),
  ];

  it('starts at the day the account was created', () => {
    expect(abKonto('2026-10-13T21:30:00.000Z')).toBe('2026-10-13');
    expect(seitKonto(liste, abKonto('2026-10-13T21:30:00.000Z')).map((x) => x.id)).toEqual([
      '2026-10-14-b',
      '2026-10-13-a',
    ]);
  });

  it('shows a brand-new account nothing of the history', () => {
    expect(seitKonto(liste, abKonto('2026-10-15T08:00:00Z'))).toEqual([]);
  });

  it('shows everything when the date is missing or broken', () => {
    expect(abKonto(undefined)).toBeNull();
    expect(abKonto('kaputt')).toBeNull();
    expect(seitKonto(liste, null)).toHaveLength(3);
  });
});
