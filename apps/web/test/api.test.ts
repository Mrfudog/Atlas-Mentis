/**
 * Die Schnittstelle in der Oberfläche: wartet sie, und läuft hier noch die
 * Oberfläche, die der Server ausliefert (T-086, REQ-246)?
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Api } from '../src/app/kern/api';

function stubFetch(bau: () => string | null, warte?: Promise<void>) {
  vi.stubGlobal('fetch', async () => {
    if (warte) await warte;
    const b = bau();
    return {
      ok: true,
      status: 200,
      headers: new Headers(b ? { 'x-atlas-build': b } : {}),
      text: async () => JSON.stringify({ user: null }),
    } as Response;
  });
}

describe('Api', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('counts the requests under way, so the page can say it is loading', async () => {
    let los!: () => void;
    stubFetch(() => null, new Promise<void>((r) => (los = r)));
    const api = TestBed.inject(Api);
    const lauf = api.me();
    expect(api.unterwegs()).toBe(1);
    los();
    await lauf;
    expect(api.unterwegs()).toBe(0);
  });

  it('notices when the server ships a different build than the one running', async () => {
    let b = 'aaa';
    stubFetch(() => b);
    const api = TestBed.inject(Api);
    await api.me();
    await api.me();
    expect(api.neueVersion()).toBe(false);
    b = 'bbb';
    await api.me();
    expect(api.neueVersion()).toBe(true);
  });

  it('says nothing without a build header (development server)', async () => {
    stubFetch(() => null);
    const api = TestBed.inject(Api);
    await api.me();
    await api.me();
    expect(api.neueVersion()).toBe(false);
  });
});
