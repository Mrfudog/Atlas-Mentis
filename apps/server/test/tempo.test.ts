/**
 * **Eine Liste über den ganzen Bestand bleibt schnell** (T-086, REQ-246).
 *
 * Mit 21 576 Artikeln aus 5e.tools und einer Kampagne, die ihre Bücher
 * aufschaltet, brauchte die erste Liste je Bestand und die Zählung des
 * Registers gut 35 Sekunden: `inPlay` suchte je Artikel im ganzen Bestand
 * nach einer Überschreibung. Die Grenze hier ist grosszügig, damit ein
 * langsamer CI-Rechner nicht rot wird — quadratisch wäre sie um ein
 * Vielfaches überschritten.
 */

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const N = 20_000;
const EBENEN = 40;

function bestand(): Entity[] {
  const out: Entity[] = [];
  for (let l = 0; l < EBENEN; l += 1) {
    out.push({
      id: `ly_${l}`,
      name: `Book ${l}`,
      interfaces: ['Layer'],
      components: { Identity: { name: `Book ${l}`, id: `layer-${l}`, aliases: [] }, Layer: { kind: 'book', order: 10 } },
      relations: [],
    });
  }
  out.push({
    id: 'camp',
    name: 'Aus Nebel wacht',
    interfaces: ['Campaign'],
    components: { Identity: { name: 'Aus Nebel wacht', id: 'campaign-0001', aliases: [] } },
    /* Drei Viertel der Bücher aufgeschaltet: der Rest zählt als ausgeblendet. */
    relations: Array.from({ length: (EBENEN * 3) / 4 }, (_, l) => ({
      id: `ac_${l}`,
      type: 'activates',
      to: `ly_${l}`,
      props: { order: (l + 1) * 10 },
    })),
  });
  for (let i = 0; i < N; i += 1) {
    const relations: NonNullable<Entity['relations']> = [
      { id: `in_${i}`, type: 'inLayer', to: `ly_${i % EBENEN}`, props: {} },
    ];
    /* Jeder fünfzigste überschreibt seinen Vorgänger. */
    if (i % 50 === 1) relations.push({ id: `ov_${i}`, type: 'overrides', to: `r_${i - 1}`, props: {} });
    out.push({
      id: `r_${i}`,
      name: `Rule ${i}`,
      interfaces: ['Rule'],
      components: { Identity: { name: `Rule ${i}`, id: `rule-${i}`, aliases: [] } },
      relations,
    });
  }
  return out;
}

describe('a list over 20 000 articles (REQ-246)', () => {
  it('answers well within the limit, and the registry count too', async () => {
    const repo = new InMemoryRepository(seedRegistry, bestand());
    await repo.putUser({
      id: 'u_admin',
      name: 'Admin',
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: true,
      actorIds: [],
      roles: {},
    });
    const app = buildApp({ repo });
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Admin', password: PASSWORT } });
    const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
    let t0 = performance.now();
    const liste = await app.inject({ method: 'GET', url: '/api/list?type=Rule&limit=50', headers: { cookie } });
    const msListe = performance.now() - t0;
    expect(liste.statusCode).toBe(200);
    /* 30 von 40 Büchern an, davon jeder fünfzigste Artikel überschrieben. */
    expect(liste.json().total).toBe((N * 3) / 4 - (N * 3) / 4 / 50);
    expect(liste.headers['server-timing']).toMatch(/^app;dur=\d/);

    t0 = performance.now();
    const usage = await app.inject({ method: 'GET', url: '/api/registry/usage', headers: { cookie } });
    const msUsage = performance.now() - t0;
    expect(usage.statusCode).toBe(200);
    expect(usage.json().inPlay.Rule).toBe(liste.json().total);

    expect(msListe).toBeLessThan(5000);
    expect(msUsage).toBeLessThan(5000);
  }, 60_000);
});

describe('the build the server ships (T-086)', () => {
  it('names it on every API answer, so an open page can tell it is outdated', async () => {
    const ort = mkdtempSync(join(tmpdir(), 'atlas-bau-'));
    writeFileSync(join(ort, 'index.html'), '<script src="main-ABC123.js"></script>');
    const app = buildApp({ repo: new InMemoryRepository(seedRegistry, []), staticRoot: ort });
    const a = await app.inject({ method: 'GET', url: '/api/health' });
    expect(a.headers['x-atlas-build']).toMatch(/^[0-9a-f]{12}$/);
    writeFileSync(join(ort, 'index.html'), '<script src="main-DEF456.js"></script>');
    const b = await buildApp({ repo: new InMemoryRepository(seedRegistry, []), staticRoot: ort }).inject({
      method: 'GET',
      url: '/api/health',
    });
    expect(b.headers['x-atlas-build']).not.toBe(a.headers['x-atlas-build']);
  });
});

describe('a server that is still reading its articles (T-086)', () => {
  it('says so with 503 and the count, and lets sign-in through', async () => {
    let anlauf: { artikel: number } | null = { artikel: 21576 };
    const app = buildApp({ repo: new InMemoryRepository(seedRegistry, []), anlauf: () => anlauf });
    const liste = await app.inject({ method: 'GET', url: '/api/list?limit=5' });
    expect(liste.statusCode).toBe(503);
    expect(liste.headers['retry-after']).toBe('1');
    expect(liste.json()).toEqual({ error: 'Server is starting', starting: { articles: 21576 } });
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    anlauf = null;
    expect((await app.inject({ method: 'GET', url: '/api/list?limit=5' })).statusCode).not.toBe(503);
  });
});
