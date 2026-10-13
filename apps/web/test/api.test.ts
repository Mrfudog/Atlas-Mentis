/**
 * Die Schnittstelle in der Oberfläche: wartet sie, und läuft hier noch die
 * Oberfläche, die der Server ausliefert (T-086, REQ-246)?
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Api, wasLaedt } from '../src/app/kern/api';

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
    const lauf = api.registry();
    expect(api.laufend()).toEqual(['registry']);
    los();
    await lauf;
    expect(api.laufend()).toEqual([]);
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

  it('names what is loading', () => {
    expect(wasLaedt('/api/registry/usage')).toBe('registry');
    expect(wasLaedt('/api/list?area=rules')).toBe('list');
    expect(wasLaedt('/api/entities/x')).toBe('articles');
  });

  it('waits while the server starts, then answers', async () => {
    const antworten = [
      { status: 503, body: { error: 'Server is starting', starting: { articles: 42 } } },
      { status: 200, body: { ok: 1 } },
    ];
    vi.useFakeTimers();
    vi.stubGlobal('fetch', async () => {
      const a = antworten.shift()!;
      return { ok: a.status < 300, status: a.status, text: async () => JSON.stringify(a.body) } as Response;
    });
    const api = TestBed.inject(Api);
    const lauf = api.registry();
    await vi.advanceTimersByTimeAsync(10);
    expect(api.anlauf()).toBe(42);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await lauf).toEqual({ ok: 1 });
    expect(api.anlauf()).toBeNull();
    vi.useRealTimers();
  });

  it('holds a failed read until retry, then hands over the answer', async () => {
    let n = 0;
    vi.stubGlobal('fetch', async () => {
      n += 1;
      if (n === 1) throw new TypeError('Failed to fetch');
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: 2 }) } as Response;
    });
    const api = TestBed.inject(Api);
    const lauf = api.registry();
    await new Promise((r) => setTimeout(r, 0));
    expect(api.fehler()?.was).toBe('registry');
    api.fehler()!.nochmal();
    expect(await lauf).toEqual({ ok: 2 });
    expect(api.fehler()).toBeNull();
  });

  it('does not repeat a write that failed', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const api = TestBed.inject(Api);
    await expect(api.logout()).rejects.toThrow('Failed to fetch');
    expect(api.fehler()).toBeNull();
  });
});
