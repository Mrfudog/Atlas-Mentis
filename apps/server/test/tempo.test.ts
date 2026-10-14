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
  /* Die Bücher hängen in Gruppen (T-088): A hält 0–19, B hält 20–34 und
     darin, verschachtelt, C mit 30–34. */
  const gruppeVon = (l: number) => (l < 20 ? 'g_a' : l < 30 ? 'g_b' : l < 35 ? 'g_c' : '');
  for (const [g, in_] of [['g_a', ''], ['g_b', ''], ['g_c', 'g_b']] as const) {
    out.push({
      id: g,
      name: `Group ${g}`,
      interfaces: ['Layer'],
      components: { Identity: { name: `Group ${g}`, id: `layer-${g}`, aliases: [] }, Layer: { kind: 'group', order: 10 } },
      relations: in_ ? [{ id: `${g}~p`, type: 'partOf', to: in_, props: {} }] : [],
    });
  }
  for (let l = 0; l < EBENEN; l += 1) {
    const g = gruppeVon(l);
    out.push({
      id: `ly_${l}`,
      name: `Book ${l}`,
      interfaces: ['Layer'],
      components: { Identity: { name: `Book ${l}`, id: `layer-${l}`, aliases: [] }, Layer: { kind: 'book', order: 10, published: `2014-${String((l % 12) + 1).padStart(2, '0')}-01` } },
      relations: g ? [{ id: `ly_${l}~p`, type: 'partOf', to: g, props: {} }] : [],
    });
  }
  out.push({
    id: 'camp',
    name: 'Aus Nebel wacht',
    interfaces: ['Campaign'],
    components: { Identity: { name: 'Aus Nebel wacht', id: 'campaign-0001', aliases: [] } },
    /* Drei Viertel der Bücher aufgeschaltet, über die Gruppen A und B ohne
       die abgeschaltete Untergruppe C (T-088): der Rest zählt als
       ausgeblendet. Fünf davon sind Vergleichsebenen (T-092) — nicht im Spiel.
       Gruppe B bringt nur Regeln und Zauber (T-105): dieselben Artikel,
       aber jeder geht durch die Bereichsauswahl. */
    relations: [
      { id: 'ac_a', type: 'activates', to: 'g_a', props: { order: 10 } },
      { id: 'ac_b', type: 'activates', to: 'g_b', props: { order: 20, areas: ['rules'], types: ['Spell'] } },
      { id: 'off_c', type: 'activates', to: 'g_c', props: { mode: 'off' } },
      ...Array.from({ length: 5 }, (_, l) => ({
        id: `cmp_${l}`,
        type: 'activates',
        to: `ly_${EBENEN - 1 - l}`,
        props: { mode: 'compare', order: (l + 1) * 10 },
      })),
    ],
  });
  for (let i = 0; i < N; i += 1) {
    const relations: NonNullable<Entity['relations']> = [
      { id: `in_${i}`, type: 'inLayer', to: `ly_${i % EBENEN}`, props: {} },
    ];
    /* Jeder fünfzigste überschreibt seinen Vorgänger. */
    if (i % 50 === 1) relations.push({ id: `ov_${i}`, type: 'overrides', to: `r_${i - 1}`, props: {} });
    /* Jeder zwanzigste ist eine Fassung seines Vorvorgängers (T-092). */
    const fassung = i % 20 === 2;
    if (fassung) relations.push({ id: `va_${i}`, type: 'variantOf', to: `r_${i - 2}`, props: {} });
    const name = `Rule ${fassung ? i - 2 : i}`;
    out.push({
      id: `r_${i}`,
      name,
      interfaces: ['Rule'],
      components: { Identity: { name, id: `rule-${i}`, aliases: [] } },
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

    /* Fassungen gruppiert (T-092): ein Gang über die Treffer, nicht jeder gegen jeden. */
    t0 = performance.now();
    const gruppiert = await app.inject({ method: 'GET', url: '/api/list?type=Rule&limit=50&versions=1', headers: { cookie } });
    const msGruppiert = performance.now() - t0;
    expect(gruppiert.statusCode).toBe(200);
    expect(gruppiert.json().total).toBeLessThan(liste.json().total);
    expect(gruppiert.json().rows.some((r: { versions?: unknown[] }) => r.versions?.length)).toBe(true);

    t0 = performance.now();
    const fassungen = await app.inject({ method: 'GET', url: '/api/entities/r_20/versions', headers: { cookie } });
    const msFassungen = performance.now() - t0;
    expect(fassungen.statusCode).toBe(200);
    expect(fassungen.json().versions.map((v: { entity: { id: string } }) => v.entity.id)).toEqual(['r_22']);

    /* Die Kampagnenseite mit den Gruppen (T-088). */
    t0 = performance.now();
    const ebenen = await app.inject({ method: 'GET', url: '/api/campaigns/camp/layers', headers: { cookie } });
    const msEbenen = performance.now() - t0;
    expect(ebenen.statusCode).toBe(200);
    expect(ebenen.json().layers.filter((l: { inPlay: boolean; kind: string }) => l.inPlay && l.kind === 'book')).toHaveLength(30);

    expect(msListe).toBeLessThan(5000);
    expect(msEbenen).toBeLessThan(5000);
    expect(msUsage).toBeLessThan(5000);
    expect(msGruppiert).toBeLessThan(5000);
    expect(msFassungen).toBeLessThan(5000);
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
