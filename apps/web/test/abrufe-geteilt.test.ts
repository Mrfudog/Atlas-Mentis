/**
 * **Wer gleichzeitig dasselbe fragt, bekommt dieselbe Antwort** (T-398):
 * beim Start fragten Klappstand, Neues, Spalten und Kapitel je für sich nach
 * `/api/me/prefs`, Wache und Kopfleiste je nach `/api/home`. Geteilt wird
 * nur, solange die Frage läuft — danach fragt man wieder neu.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../src/app/kern/api';
import { Heim } from '../src/app/kern/heim';
import { LIVE_TRANSPORT } from '../src/app/kern/live';

const gefragt: string[] = [];

beforeEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
  gefragt.length = 0;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    gefragt.push(`${init?.method ?? 'GET'} ${url}`);
    await new Promise((r) => setTimeout(r, 5));
    return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ ok: true }) } as Response;
  });
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: LIVE_TRANSPORT, useValue: () => () => undefined }],
  });
});

describe('shared requests (T-398)', () => {
  it('asks /api/me/prefs once for callers at the same time, and again afterwards', async () => {
    const api = TestBed.inject(Api);
    const [a, b, c] = await Promise.all([api.prefs(), api.prefs(), api.prefs()]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(gefragt.filter((g) => g === 'GET /api/me/prefs')).toHaveLength(1);
  });

  it('keeps the answer for a short while: one page load asks once, not three times (dev, 29.10.)', async () => {
    const api = TestBed.inject(Api);
    let jetzt = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => jetzt);
    await api.prefs();
    jetzt += 3000;
    await api.prefs();
    expect(gefragt.filter((g) => g === 'GET /api/me/prefs')).toHaveLength(1);
    /* Danach wieder frisch: ein anderes Gerät kann geschrieben haben. */
    jetzt += 20_000;
    await api.prefs();
    expect(gefragt.filter((g) => g === 'GET /api/me/prefs')).toHaveLength(2);
  });

  it('asks again after any write, and after switching whose view it is', async () => {
    const api = TestBed.inject(Api);
    await api.prefs();
    /* Auch Schreiben, das nicht setPref heisst, ändert Prefs am Server (Schreibebene, Ebenenauswahlen). */
    await api.setListColumnDefault('x', null);
    await api.prefs();
    expect(gefragt.filter((g) => g === 'GET /api/me/prefs')).toHaveLength(2);
    api.setViewAs('u_andere');
    await api.prefs();
    expect(gefragt.filter((g) => g === 'GET /api/me/prefs')).toHaveLength(3);
    api.setViewAs(null);
  });

  it('does not hand out a running answer after a write', async () => {
    const api = TestBed.inject(Api);
    const vorher = api.prefs();
    await api.setPref('x', 1);
    await Promise.all([vorher, api.prefs()]);
    expect(gefragt.filter((g) => g === 'GET /api/me/prefs')).toHaveLength(2);
  });

  it('asks /api/home once when two ask for the same viewer at the same time', async () => {
    const heim = TestBed.inject(Heim);
    await Promise.all([heim.laden(true, 'u1||0'), heim.laden(true, 'u1||0'), heim.jetzt()]);
    expect(gefragt.filter((g) => g === 'GET /api/home')).toHaveLength(1);
    await heim.laden(true, 'u1||1');
    expect(gefragt.filter((g) => g === 'GET /api/home')).toHaveLength(2);
  });
});
