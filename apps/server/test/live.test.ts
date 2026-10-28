/**
 * Der Live-Kanal (T-116, REQ-116): was sich ändert, geht an jedes offene
 * Gerät — gesiebt je Empfänger. Der Kanal ist kein Umweg an der
 * Sichtbarkeit vorbei: ein Artikel, den ein Spieler nicht sieht, kommt bei
 * ihm nicht an, auch nicht als Id.
 */

import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { LocalChangeFeed, leseEventId, mitKanal } from '../src/live.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ebene: Entity = {
  id: 'ly_nebel',
  interfaces: ['Layer'],
  name: 'Nebel',
  components: { Identity: { name: 'Nebel', id: 'layer-0001', aliases: [] } },
  relations: [],
};
const runde: Entity = {
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
  relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
};
const art = (id: string, type: string, name: string, extra: Record<string, unknown> = {}): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name, id: `${type.toLowerCase()}-${id}`, aliases: [] }, ...extra },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} }],
});

interface Ereignis {
  event: string;
  id?: string;
  data: Record<string, unknown>;
}

const offen: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (offen.length) await offen.pop()!();
});

async function aufbau() {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [
      ebene,
      runde,
      art('p_markt', 'Place', 'Der Markt'),
      art('p_geheim', 'Place', 'Die Gruft', { Visibility: { audience: 'gm' } }),
      art('m_gang', 'Map', 'Der Gang'),
      art('m_geheim', 'Map', 'Der Geheimgang', { Visibility: { audience: 'gm' } }),
      art('s_eins', 'Session', 'Sitzung 1'),
    ],
  );
  const feed = new LocalChangeFeed({ flushMs: 5 });
  const app = buildApp({ repo, live: feed, liveHeartbeatMs: 40 });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = (app.server.address() as AddressInfo).port;
  offen.push(() => app.close());

  for (const [name, roles] of [
    ['Mira', { camp_nebel: 'gm' }],
    ['Sela', { camp_nebel: 'player' }],
  ] as const) {
    await repo.putUser({
      id: `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`,
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: false,
      actorIds: [],
      roles: { ...roles },
    });
  }
  const kekse = new Map<string, string>();
  const keks = async (name: string): Promise<string> => {
    if (kekse.has(name)) return kekse.get(name)!;
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = res.cookies.find((x) => x.name === 'nw_session');
    if (!c) throw new Error(`keine Sitzung für ${name}`);
    kekse.set(name, `nw_session=${c.value}`);
    return kekse.get(name)!;
  };

  /** Ein Gerät, das zuhört: sammelt die Ereignisse, bis es geschlossen wird. */
  const geraet = async (name: string, lastEventId?: string) => {
    const ctrl = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/live`, {
      headers: { cookie: await keks(name), ...(lastEventId ? { 'last-event-id': lastEventId } : {}) },
      signal: ctrl.signal,
    });
    const ereignisse: Ereignis[] = [];
    const lauf = (async () => {
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let rest = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          rest += dec.decode(value, { stream: true });
          let i: number;
          while ((i = rest.indexOf('\n\n')) >= 0) {
            const block = rest.slice(0, i);
            rest = rest.slice(i + 2);
            const e: Ereignis = { event: 'message', data: {} };
            let hat = false;
            for (const zeile of block.split('\n')) {
              if (zeile.startsWith('event: ')) e.event = zeile.slice(7);
              else if (zeile.startsWith('id: ')) e.id = zeile.slice(4);
              else if (zeile.startsWith('data: ')) {
                e.data = JSON.parse(zeile.slice(6)) as Record<string, unknown>;
                hat = true;
              }
            }
            if (hat) ereignisse.push(e);
          }
        }
      } catch {
        /* abgebrochen */
      }
    })();
    const zu = async () => {
      ctrl.abort();
      await lauf;
    };
    offen.push(zu);
    const warte = async (pruef: (e: Ereignis[]) => boolean, ms = 2000): Promise<Ereignis[]> => {
      const bis = Date.now() + ms;
      while (!pruef(ereignisse)) {
        if (Date.now() > bis) throw new Error(`gewartet: ${JSON.stringify(ereignisse)}`);
        await new Promise((r) => setTimeout(r, 10));
      }
      return ereignisse;
    };
    await warte((e) => e.some((x) => x.event === 'hello'));
    return { res, ereignisse, warte, zu };
  };

  /** Als Konto einen Artikel ändern, über die gewöhnliche Route. */
  const aendere = async (name: string, id: string, f: (e: Entity) => Entity) => {
    const jetzt = (await repo.getEntity(id))!;
    const res = await app.inject({
      method: 'PUT',
      url: `/api/entities/${id}`,
      headers: { cookie: await keks(name) },
      payload: f(jetzt) as object,
    });
    expect(res.statusCode, res.body).toBe(200);
  };
  /** Kurz warten, ob noch etwas kommt — für „kommt nicht an". */
  const ruhe = () => new Promise((r) => setTimeout(r, 80));
  return { repo, app, feed, port, keks, geraet, aendere, ruhe };
}

const umbenannt = (name: string) => (e: Entity): Entity => ({
  ...e,
  name,
  components: { ...e.components, Identity: { ...(e.components['Identity'] ?? {}), name } },
});

describe('live channel (T-116)', () => {
  it('refuses a stream without login', async () => {
    const { port, repo } = await aufbau();
    expect(await repo.countUsers()).toBeGreaterThan(0);
    const res = await fetch(`http://127.0.0.1:${port}/api/live`);
    expect(res.status).toBe(401);
  });

  it('tells every device that can see the article — and no other', async () => {
    const { geraet, aendere, ruhe } = await aufbau();
    const mira = await geraet('Mira');
    const sela = await geraet('Sela');
    expect(mira.res.headers.get('content-type')).toMatch(/text\/event-stream/);

    await aendere('Mira', 'p_markt', umbenannt('Der Fischmarkt'));
    await sela.warte((e) => e.some((x) => x.event === 'entity' && x.data['id'] === 'p_markt'));
    await mira.warte((e) => e.some((x) => x.event === 'entity' && x.data['id'] === 'p_markt'));
    expect(sela.ereignisse.find((x) => x.event === 'entity')?.data).toMatchObject({ id: 'p_markt', type: 'Place' });

    /* Die Gruft ist `audience: gm` — die Leitung erfährt es, der Spieler nicht, auch nicht die Id. */
    await aendere('Mira', 'p_geheim', umbenannt('Die alte Gruft'));
    await mira.warte((e) => e.some((x) => x.data['id'] === 'p_geheim'));
    await ruhe();
    expect(sela.ereignisse.some((x) => JSON.stringify(x).includes('p_geheim'))).toBe(false);
  });

  it('tells about a turn plan only who sees its map (T-198)', async () => {
    const { geraet, feed, ruhe } = await aufbau();
    const mira = await geraet('Mira');
    const sela = await geraet('Sela');
    feed.publish({ kind: 'plan', id: 'm_gang' });
    feed.publish({ kind: 'plan', id: 'm_geheim' });
    await sela.warte((e) => e.some((x) => x.event === 'plan' && x.data['id'] === 'm_gang'));
    await mira.warte((e) => e.some((x) => x.event === 'plan' && x.data['id'] === 'm_geheim'));
    await ruhe();
    expect(sela.ereignisse.some((x) => x.event === 'plan' && x.data['id'] === 'm_geheim')).toBe(false);
  });

  it('says `gone` when an article the player saw is hidden or deleted', async () => {
    const { geraet, aendere, app, keks } = await aufbau();
    const sela = await geraet('Sela');
    await aendere('Mira', 'p_markt', (e) => ({ ...e, components: { ...e.components, Visibility: { audience: 'gm' } } }));
    await sela.warte((e) => e.some((x) => x.event === 'gone' && x.data['id'] === 'p_markt'));
    expect(sela.ereignisse.some((x) => x.event === 'entity' && x.data['id'] === 'p_markt')).toBe(false);

    const res = await app.inject({ method: 'DELETE', url: '/api/entities/m_gang', headers: { cookie: await keks('Mira') } });
    expect(res.statusCode, res.body).toBeLessThan(300);
    await sela.warte((e) => e.some((x) => x.event === 'gone' && x.data['id'] === 'm_gang'));
  });

  it('keeps quiet when a player would see the same map as before (T-399)', async () => {
    const { geraet, aendere, ruhe } = await aufbau();
    const marker = (id: string, x: number, hidden = false) => ({
      id,
      type: 'marker',
      to: 'p_markt',
      props: { x, y: 0.5, kind: 'token', ...(hidden ? { hidden: true } : {}) },
    });
    await aendere('Mira', 'm_gang', (e) => ({ ...e, relations: [...e.relations, marker('mk_offen', 0.2), marker('mk_versteckt', 0.3, true)] }));
    await ruhe();
    const mira = await geraet('Mira');
    const sela = await geraet('Sela');
    const zieh = (id: string, x: number) => (e: Entity): Entity => ({
      ...e,
      relations: e.relations.map((r) => (r.id === id ? { ...r, props: { ...r.props, x } } : r)),
    });
    const karte = (x: Ereignis) => x.event === 'entity' && x.data['id'] === 'm_gang';

    /* Ein verborgener Gegner zieht: die Leitung erfährt es, die Spielerin nicht — auch nicht, dass sich etwas tat. */
    await aendere('Mira', 'm_gang', zieh('mk_versteckt', 0.6));
    await mira.warte((e) => e.some(karte));
    await ruhe();
    expect(sela.ereignisse.filter(karte)).toHaveLength(0);

    /* Ein sichtbares Token zieht: beide. */
    const bisher = mira.ereignisse.filter(karte).length;
    await aendere('Mira', 'm_gang', zieh('mk_offen', 0.4));
    await sela.warte((e) => e.some(karte));
    await mira.warte((e) => e.filter(karte).length > bisher);
  });

  it('carries the session state, so play follows the map on the table', async () => {
    const { geraet, aendere } = await aufbau();
    const sela = await geraet('Sela');
    await aendere('Mira', 's_eins', (e) => ({ ...e, components: { ...e.components, Session: { activeMap: 'm_gang' } } }));
    const ev = await sela.warte((e) => e.some((x) => x.event === 'session'));
    expect(ev.find((x) => x.event === 'session')?.data).toMatchObject({ id: 's_eins', activeMap: 'm_gang', activeEncounter: null });
  });

  it('replays what a device missed after `Last-Event-ID`, and resets on an unknown boot', async () => {
    const { geraet, aendere } = await aufbau();
    const erst = await geraet('Sela');
    const hallo = erst.ereignisse.find((x) => x.event === 'hello')!;
    await erst.zu();
    await aendere('Mira', 'p_markt', umbenannt('Der Fischmarkt'));
    await aendere('Mira', 'p_geheim', umbenannt('Die alte Gruft'));
    await new Promise((r) => setTimeout(r, 30));

    const wieder = await geraet('Sela', hallo.id);
    await wieder.warte((e) => e.some((x) => x.event === 'entity' && x.data['id'] === 'p_markt'));
    expect(wieder.ereignisse.some((x) => JSON.stringify(x).includes('p_geheim'))).toBe(false);

    const fremd = await geraet('Sela', '0badc0de.3');
    await fremd.warte((e) => e.some((x) => x.event === 'reset'));
  });

  it('sends a heartbeat the browser can see, so a dead connection is noticed (T-399)', async () => {
    const { geraet } = await aufbau();
    const sela = await geraet('Sela');
    const ev = await sela.warte((e) => e.some((x) => x.event === 'ping'));
    /* Ohne Id: ein Lebenszeichen verschiebt nicht, wo das Nachholen anfängt. */
    expect(ev.find((x) => x.event === 'ping')?.id).toBeUndefined();
  });

  it('tells about registry rows', async () => {
    const { geraet, app, keks, repo } = await aufbau();
    const mira = await geraet('Mira');
    const enums = (await repo.getRegistry()).enums;
    const res = await app.inject({ method: 'PUT', url: '/api/registry/enums', headers: { cookie: await keks('Mira') }, payload: enums as object });
    expect(res.statusCode, res.body).toBe(200);
    await mira.warte((e) => e.some((x) => x.event === 'registry' && x.data['part'] === 'enums'));
  });
});

describe('change feed', () => {
  it('folds a burst per article and resets on a flood', () => {
    const feed = new LocalChangeFeed({ flushMs: 1000, flood: 3 });
    const gesehen: string[][] = [];
    feed.subscribe((b) => gesehen.push(b.map((e) => `${e.kind}:${e.id}`)));
    feed.publish({ kind: 'entity', id: 'a' });
    feed.publish({ kind: 'entity', id: 'b' });
    feed.publish({ kind: 'entity', id: 'a' });
    feed.flush();
    expect(gesehen).toEqual([['entity:b', 'entity:a']]);
    for (const id of ['c', 'd', 'e', 'f']) feed.publish({ kind: 'entity', id });
    feed.publish({ kind: 'registry', id: 'enums' });
    feed.flush();
    expect(gesehen[1]).toEqual(['reset:', 'registry:enums']);
  });

  it('keeps the first `before` when an article changes twice in one burst', () => {
    const feed = new LocalChangeFeed({ flushMs: 1000 });
    let erstes: unknown;
    feed.subscribe((b) => (erstes = b[0]?.kind === 'entity' ? b[0].before : undefined));
    const alt = art('x', 'Place', 'Alt');
    feed.publish({ kind: 'entity', id: 'x', before: alt });
    feed.publish({ kind: 'entity', id: 'x', before: art('x', 'Place', 'Mitte') });
    feed.flush();
    expect(erstes).toEqual(alt);
  });

  it('answers `since` with what is left — or null when it is gone', () => {
    const feed = new LocalChangeFeed({ flushMs: 1000, keep: 2 });
    for (const id of ['a', 'b', 'c']) {
      feed.publish({ kind: 'entity', id });
      feed.flush();
    }
    expect(feed.since(3)).toEqual([]);
    expect(feed.since(1)?.map((e) => e.seq)).toEqual([2, 3]);
    expect(feed.since(0)).toBeNull();
    expect(feed.since(9)).toBeNull();
  });

  it('wraps a repository: writes and deletes are reported, reads pass through', async () => {
    const feed = new LocalChangeFeed({ flushMs: 1000 });
    const roh = new InMemoryRepository(undefined, [art('x', 'Place', 'X')]);
    const repo = mitKanal(roh, feed);
    const gesehen: string[] = [];
    feed.subscribe((b) => gesehen.push(...b.map((e) => `${e.kind}:${e.id}${e.kind === 'entity' && e.deleted ? '-' : ''}`)));
    expect(await repo.countEntities()).toBe(1);
    await repo.putEntity(art('y', 'Place', 'Y'));
    await repo.deleteEntity('x');
    await repo.deleteEntity('gibt-es-nicht');
    feed.flush();
    expect(gesehen).toEqual(['entity:y', 'entity:x-']);
  });

  it('reads `Last-Event-ID`', () => {
    expect(leseEventId('0badc0de.12')).toEqual({ boot: '0badc0de', seq: 12 });
    expect(leseEventId('12')).toBeNull();
    expect(leseEventId(undefined)).toBeNull();
  });
});
