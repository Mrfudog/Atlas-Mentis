/**
 * Gleichzeitig auf der Karte (T-399, REQ-398 Akzeptanz 4, REQ-192): die
 * Leitung zieht ein Token, während jemand anders ein anderes zieht. Der
 * Server weist das zweite Schreiben ab (409); was sich nicht berührt, wird
 * zusammengeführt und gleich nochmals geschrieben. Berührt es sich, gilt,
 * wer zuerst speicherte.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { Brett } from '../src/app/boards/brett';
import { Bestand } from '../src/app/kern/bestand';

const marker = (id: string, x: number) => ({ id, type: 'marker', to: 'p_markt', props: { x, y: 0.5, kind: 'token' } });
const karte = (revision: number, a: number, b: number): Entity => ({
  id: 'm_gang',
  interfaces: ['Map'],
  name: 'Der Gang',
  revision,
  components: { Identity: { name: 'Der Gang', id: 'map-0001', aliases: [] } },
  relations: [marker('mk_a', a), marker('mk_b', b)],
});
const xVon = (e: Entity, id: string) => (e.relations?.find((r) => r.id === id)?.props as { x: number }).x;

/** Ein Server aus Speicher: hält die Karte, weist ein veraltetes Schreiben ab. */
function server(stand: Entity) {
  const geschrieben: Entity[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    let status = 200;
    let body: unknown;
    if (url === '/api/registry') body = seedRegistry;
    else if (url === '/api/entities/m_gang' && init?.method === 'PUT') {
      const e = JSON.parse(String(init.body)) as Entity;
      geschrieben.push(e);
      if (e.revision !== stand.revision) {
        status = 409;
        body = { error: 'conflict' };
      } else {
        stand = { ...e, revision: (stand.revision ?? 0) + 1 };
        body = stand;
      }
    } else if (url.startsWith('/api/entities/m_gang')) body = { ...stand, refs: { names: {}, links: {} } };
    else {
      status = 404;
      body = { error: 'nope' };
    }
    return {
      ok: status < 300,
      status,
      headers: new Headers(),
      text: async () => JSON.stringify(body),
      json: async () => body,
    } as Response;
  });
  return { geschrieben, stand: () => stand };
}

describe('two people on one map (T-399)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('merges moves of different tokens instead of throwing one away', async () => {
    const basis = karte(1, 0.2, 0.3);
    /* Inzwischen zog jemand anders Token B. */
    const s = server(karte(2, 0.2, 0.7));
    await TestBed.inject(Bestand).load();
    const mine = { ...basis, relations: [marker('mk_a', 0.4), marker('mk_b', 0.3)] };

    const mangel = await TestBed.inject(Brett).schreiben(mine, basis);

    expect(mangel).toBeNull();
    expect(s.geschrieben).toHaveLength(2);
    expect(xVon(s.stand(), 'mk_a')).toBe(0.4);
    expect(xVon(s.stand(), 'mk_b')).toBe(0.7);
  });

  it('lets the first one win when both moved the same token', async () => {
    const basis = karte(1, 0.2, 0.3);
    const s = server(karte(2, 0.9, 0.3));
    await TestBed.inject(Bestand).load();
    const mine = { ...basis, relations: [marker('mk_a', 0.4), marker('mk_b', 0.3)] };

    const mangel = await TestBed.inject(Brett).schreiben(mine, basis);

    expect(mangel?.text).toMatch(/Someone else changed this/);
    expect(s.geschrieben).toHaveLength(1);
    expect(xVon(s.stand(), 'mk_a')).toBe(0.9);
  });
});
