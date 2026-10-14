/**
 * Der Live-Kanal in der Oberfläche (T-116): verbunden, solange jemand
 * angemeldet ist; Komponenten hören auf Artikel und Sitzungszustand, ohne
 * den Transport zu kennen; geöffnete Artikel werden neu geholt.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Session } from '../src/app/kern/session';
import { Bestand } from '../src/app/kern/bestand';
import { LIVE_TRANSPORT, Live, type LiveEmpfang, type LiveTransport } from '../src/app/kern/live';

interface Antwort {
  status: number;
  body: unknown;
}
function stubFetch(antworten: Record<string, Antwort | (() => Antwort)>) {
  const gesehen: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    gesehen.push(url);
    const roh = antworten[url];
    const a = (typeof roh === 'function' ? roh() : roh) ?? { status: 404, body: { error: 'nope' } };
    return {
      ok: a.status >= 200 && a.status < 300,
      status: a.status,
      headers: new Headers(),
      text: async () => JSON.stringify(a.body),
      json: async () => a.body,
    } as Response;
  });
  return gesehen;
}

/** Ein Transport aus Speicher: der Test spielt den Server. */
function speicherTransport() {
  const t = { empfang: null as LiveEmpfang | null, offen: 0, zu: 0 };
  const transport: LiveTransport = (empfang) => {
    t.empfang = empfang;
    t.offen++;
    empfang.stand('offen');
    return () => {
      t.zu++;
      t.empfang = null;
    };
  };
  return { t, transport };
}

const ME = { user: { id: 'u', name: 'Sela', isAdmin: false, roles: { c: 'player' } }, writable: [], setup: null };
const markt = (name: string, revision: number) => ({
  id: 'p_markt',
  interfaces: ['Place'],
  name,
  revision,
  components: { Identity: { name } },
  relations: [],
  refs: { names: {}, links: {} },
});

describe('Live', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('connects while someone is signed in, and not before', async () => {
    stubFetch({ '/api/me': { status: 200, body: ME } });
    const { t, transport } = speicherTransport();
    TestBed.configureTestingModule({ providers: [{ provide: LIVE_TRANSPORT, useValue: transport }] });
    const live = TestBed.inject(Live);
    TestBed.tick();
    expect(t.offen).toBe(0);
    expect(live.stand()).toBe('aus');

    await TestBed.inject(Session).load();
    TestBed.tick();
    expect(t.offen).toBe(1);
    expect(live.stand()).toBe('offen');

    stubFetch({ '/api/logout': { status: 200, body: { ok: true } } });
    await TestBed.inject(Session).logout();
    TestBed.tick();
    expect(t.zu).toBe(1);
    expect(live.stand()).toBe('aus');
  });

  it('hands article and session events to whoever listens — without the transport', () => {
    stubFetch({});
    const { transport } = speicherTransport();
    TestBed.configureTestingModule({ providers: [{ provide: LIVE_TRANSPORT, useValue: transport }] });
    const live = TestBed.inject(Live);
    const artikel: unknown[] = [];
    const sitzung: unknown[] = [];
    const ab = live.onArtikel((e) => artikel.push(e));
    live.onSitzung((z) => sitzung.push(z));

    live.verteile('entity', { id: 'm_gang', type: 'Map', revision: 4 });
    live.verteile('gone', { id: 'p_alt' });
    live.verteile('session', { id: 's_eins', activeMap: 'm_gang', activeEncounter: null });
    expect(artikel).toEqual([
      { kind: 'changed', id: 'm_gang', type: 'Map', revision: 4 },
      { kind: 'gone', id: 'p_alt' },
    ]);
    expect(sitzung).toEqual([{ id: 's_eins', activeMap: 'm_gang', activeEncounter: null, activeScene: null, nowPlaying: null }]);
    expect(live.sitzungen().get('s_eins')?.activeMap).toBe('m_gang');

    ab();
    live.verteile('entity', { id: 'x' });
    expect(artikel).toHaveLength(2);
  });
});

describe('Bestand follows the live channel', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('fetches an open article again when it changed, and forgets it when it is gone', async () => {
    let stand = markt('Der Markt', 1);
    const gesehen = stubFetch({ '/api/entities/p_markt': () => ({ status: 200, body: stand }) });
    const { transport } = speicherTransport();
    TestBed.configureTestingModule({ providers: [{ provide: LIVE_TRANSPORT, useValue: transport }] });
    const bestand = TestBed.inject(Bestand);
    const live = TestBed.inject(Live);
    await bestand.oeffnen('p_markt', false, false);
    expect(bestand.voll().get('p_markt')?.name).toBe('Der Markt');

    /* Derselbe Stand (das eigene Speichern) wird nicht noch einmal geholt. */
    live.verteile('entity', { id: 'p_markt', type: 'Place', revision: 1 });
    expect(gesehen.filter((u) => u === '/api/entities/p_markt')).toHaveLength(1);

    stand = markt('Der Fischmarkt', 2);
    live.verteile('entity', { id: 'p_markt', type: 'Place', revision: 2 });
    await vi.waitFor(() => expect(bestand.voll().get('p_markt')?.name).toBe('Der Fischmarkt'));

    /* Was niemand geöffnet hat, wird nicht geholt. */
    live.verteile('entity', { id: 'p_anders', type: 'Place', revision: 1 });
    expect(gesehen).not.toContain('/api/entities/p_anders');

    live.verteile('gone', { id: 'p_markt' });
    expect(bestand.voll().has('p_markt')).toBe(false);
    expect(bestand.fehlt().has('p_markt')).toBe(true);
  });
});
