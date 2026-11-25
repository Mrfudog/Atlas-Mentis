import { describe, expect, it } from 'vitest';
import { inTimeWindow, parseTimeWindow } from '../src/index.js';

/* 22.10.2026, 09:30 in Zürich (MESZ, UTC+2 → getTimezoneOffset -120). */
const jetzt = new Date('2026-10-22T07:30:00Z');
const ZUERICH = -120;

describe('parseTimeWindow (T-382)', () => {
  it('today beginnt um Mitternacht in der Zeitzone des Browsers', () => {
    expect(parseTimeWindow('today', jetzt, ZUERICH)).toEqual({ from: '2026-10-21T22:00:00.000Z' });
    expect(parseTimeWindow('today', jetzt, 0)).toEqual({ from: '2026-10-22T00:00:00.000Z' });
  });

  it('kurz nach Mitternacht in Zürich ist in UTC noch gestern', () => {
    const frueh = new Date('2026-10-21T22:30:00Z');
    expect(parseTimeWindow('today', frueh, ZUERICH)).toEqual({ from: '2026-10-21T22:00:00.000Z' });
  });

  it('7d heisst heute und die sechs Tage davor', () => {
    expect(parseTimeWindow('7d', jetzt, ZUERICH)).toEqual({ from: '2026-10-15T22:00:00.000Z' });
    expect(parseTimeWindow('30d', jetzt, 0)).toEqual({ from: '2026-09-23T00:00:00.000Z' });
    expect(parseTimeWindow('1d', jetzt, 0)).toEqual(parseTimeWindow('today', jetzt, 0));
  });

  it('ein Zeitraum schliesst den letzten Tag ein, eine Seite darf fehlen', () => {
    expect(parseTimeWindow('2026-10-01..2026-10-03', jetzt, 0)).toEqual({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-04T00:00:00.000Z',
    });
    expect(parseTimeWindow('..2026-10-03', jetzt, 0)).toEqual({ to: '2026-10-04T00:00:00.000Z' });
    expect(parseTimeWindow('2026-10-01..', jetzt, ZUERICH)).toEqual({ from: '2026-09-30T22:00:00.000Z' });
  });

  it('Unsinn gibt null, nicht ein leeres Fenster', () => {
    for (const w of ['', undefined, null, 'gestern', '0d', '..', '2026-13-40..', '2026-10-05..2026-10-01', '7 d']) {
      expect(parseTimeWindow(w, jetzt, 0)).toBeNull();
    }
  });

  it('eine unsinnige Zeitzone wird begrenzt', () => {
    expect(parseTimeWindow('today', jetzt, Number.NaN)).toEqual({ from: '2026-10-22T00:00:00.000Z' });
    expect(parseTimeWindow('today', jetzt, 99999)?.from).toBeTruthy();
  });
});

describe('inTimeWindow', () => {
  const fenster = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-04T00:00:00.000Z' };
  it('zählt den Anfang mit, das Ende nicht', () => {
    expect(inTimeWindow('2026-10-01T00:00:00.000Z', fenster)).toBe(true);
    expect(inTimeWindow('2026-10-03T23:59:59.000Z', fenster)).toBe(true);
    expect(inTimeWindow('2026-10-04T00:00:00.000Z', fenster)).toBe(false);
    expect(inTimeWindow('2026-09-30T23:59:59.000Z', fenster)).toBe(false);
  });
  it('ohne Zeitpunkt oder mit Unsinn nie', () => {
    expect(inTimeWindow(undefined, {})).toBe(false);
    expect(inTimeWindow('kein Datum', {})).toBe(false);
  });
  it('ein offenes Fenster nimmt jedes Datum', () => {
    expect(inTimeWindow('1999-01-01T00:00:00Z', {})).toBe(true);
  });
});

describe('cleanColumns nimmt die Angaben von T-382', () => {
  it('behält @created, @updated, @addedBy', async () => {
    const { cleanColumns } = await import('../src/index.js');
    expect(cleanColumns('@created,@updated,@addedBy,@Böse')).toEqual(['@created', '@updated', '@addedBy']);
  });
});
