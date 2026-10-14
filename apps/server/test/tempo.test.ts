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

    /* **Aufschalten im Popup** (T-143): ein Häkchen schreibt den Stapel,
       danach fragt das Popup die Ebenen neu. Die Zählung je Ebene hängt
       nicht am Stapel und steht je Bestand einmal — nur was die Kampagne
       ändert, wird neu gerechnet. Und eine ganze Gruppe zum Vergleich. */
    t0 = performance.now();
    const auf = await app.inject({ method: 'PUT', url: '/api/campaigns/camp/layers', headers: { cookie }, payload: { layers: ['g_a', 'g_b', 'ly_36'] } });
    const msAuf = performance.now() - t0;
    expect(auf.statusCode).toBe(200);
    t0 = performance.now();
    const danach = await app.inject({ method: 'GET', url: '/api/campaigns/camp/layers', headers: { cookie } });
    const msDanach = performance.now() - t0;
    expect(danach.json().layers.find((l: { id: string }) => l.id === 'ly_36').inPlay).toBe(true);
    t0 = performance.now();
    await app.inject({ method: 'GET', url: '/api/campaigns/camp/layers', headers: { cookie } });
    const msWieder = performance.now() - t0;
    const vergleich = await app.inject({ method: 'PUT', url: '/api/campaigns/camp/compare', headers: { cookie }, payload: { layers: ['g_c'] } });
    expect(vergleich.json().layers).toEqual(['g_c']);
    console.log(
      `T-143 · 20k: Ebenen ${msEbenen.toFixed(0)} ms, aufschalten ${msAuf.toFixed(0)} ms, Ebenen danach ${msDanach.toFixed(0)} ms, noch einmal ${msWieder.toFixed(0)} ms`,
    );

    expect(msListe).toBeLessThan(5000);
    expect(msEbenen).toBeLessThan(5000);
    expect(msAuf).toBeLessThan(5000);
    expect(msDanach).toBeLessThan(5000);
    /* Derselbe Bestand: nichts zu zählen, nur die Kampagne. */
    expect(msWieder).toBeLessThan(1000);
    expect(msUsage).toBeLessThan(5000);
    expect(msGruppiert).toBeLessThan(5000);
    expect(msFassungen).toBeLessThan(5000);
  }, 60_000);
});

/**
 * **Mit Buchtext: eine Viertelmillion Artikel** (T-108, T-086). Seit jeder
 * Absatz eines Buchs ein Artikel ist (E-028), hat ein frischer Bestand aus
 * 5e.tools gut 150 000 Artikel; die Leitung rechnete mit bis zu 250 000.
 * Hier stehen neben den 20 000 Regeln oben 230 000 Teile in 400 Kapiteln
 * von 40 Büchern. Teile stehen in keiner Liste — die Liste darf durch sie
 * nicht langsamer werden —, und die Leseansicht liest ein Buch und ein
 * Kapitel. Die Grenzen sind wie oben grosszügig.
 */
const TEILE = 230_000;
const KAPITEL = 400;

function mitBuchtext(): Entity[] {
  const out = bestand();
  for (let k = 0; k < KAPITEL; k += 1) {
    out.push({
      id: `ch_${k}`,
      name: `Chapter ${k}`,
      interfaces: ['Chapter'],
      components: { Identity: { name: `Chapter ${k}`, id: `chapter-${k}`, aliases: [] } },
      relations: [{ id: `ch_${k}~in`, type: 'inLayer', to: `ly_${k % EBENEN}`, props: {} }],
    });
  }
  const arten = ['Paragraph', 'Paragraph', 'Paragraph', 'Heading', 'ReadAloudText'];
  for (let i = 0; i < TEILE; i += 1) {
    const k = i % KAPITEL;
    const typ = arten[i % arten.length]!;
    const name = `Part ${i}`;
    out.push({
      id: `p_${i}`,
      name,
      interfaces: [typ],
      components: {
        Identity: { name, id: `${typ.toLowerCase()}-${i}`, aliases: [] },
        ...(typ === 'Paragraph' ? { Prose: { paragraph: [{ id: 'text', value: `Words of part ${i}, about [[rule-${i % N}|a rule]].` }] } } : {}),
        ...(typ === 'Heading' ? { Heading: { level: 2 } } : {}),
        ...(typ === 'ReadAloudText' ? { ReadAloud: { readaloud: [{ id: 'read', value: `Hear part ${i}.` }] } } : {}),
      },
      relations: [
        { id: `p_${i}~in`, type: 'inLayer', to: `ly_${k % EBENEN}`, props: {} },
        { id: `p_${i}~p`, type: 'partOf', to: `ch_${k}`, props: { rank: Math.floor(i / KAPITEL) + 1 } },
      ],
    });
  }
  return out;
}

describe('a list and a book over 250 000 articles (T-108, REQ-246)', () => {
  it('answers well within the limit, though most articles are book parts', async () => {
    const repo = new InMemoryRepository(seedRegistry, mitBuchtext());
    await repo.putUser({ id: 'u_admin', name: 'Admin', passwordHash: await hashPassword(PASSWORT), isAdmin: true, actorIds: [], roles: {} });
    const app = buildApp({ repo });
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Admin', password: PASSWORT } });
    const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
    const zeit = async (url: string) => {
      const t0 = performance.now();
      const r = await app.inject({ method: 'GET', url, headers: { cookie } });
      return { r, ms: performance.now() - t0 };
    };
    const liste = await zeit('/api/list?type=Rule&limit=50');
    expect(liste.r.statusCode).toBe(200);
    expect(liste.r.json().total).toBe((N * 3) / 4 - (N * 3) / 4 / 50);
    /* Kein Teil in der Liste, auch ohne Art. */
    const alle = await zeit('/api/list?limit=5');
    expect(alle.r.json().rows.some((z: { type: string }) => ['Paragraph', 'Heading', 'ReadAloudText'].includes(z.type))).toBe(false);
    const zweite = await zeit('/api/list?type=Rule&limit=50&offset=50');
    /* Ein Buch (Ebene 0, im Spiel über Gruppe A): zehn Kapitel, je ihre Überschriften im Verzeichnis. */
    const buch = await zeit('/api/read/ly_0');
    expect(buch.r.statusCode).toBe(200);
    expect(buch.r.json().toc.filter((z: { type: string }) => z.type === 'Chapter')).toHaveLength(KAPITEL / EBENEN);
    const stueck = await zeit('/api/read/ly_0/unit/ch_0');
    expect(stueck.r.statusCode).toBe(200);
    expect(stueck.r.json().sections).toHaveLength(TEILE / KAPITEL + 1);
    const suche = await zeit('/api/read/ly_0/search?q=part%20229');
    expect(suche.r.statusCode).toBe(200);
    const teile = await zeit('/api/entities/ch_0/parts');
    expect(teile.r.json().parts).toHaveLength(TEILE / KAPITEL);
    const usage = await zeit('/api/registry/usage');
    expect(usage.r.statusCode).toBe(200);
    /* **Die übergreifende Suche beim Tippen** (T-138): je Tastendruck eine
       Frage an den fertigen Index. Ein Buchstabe trifft fast alles — das
       ist der teuerste Fall —, „rule 1203" genau einen. */
    const tippen = [];
    for (const q of ['r', 'ru', 'rule', 'rule 1', 'rule 12', 'rule 1203']) tippen.push(await zeit(`/api/search?q=${encodeURIComponent(q)}&limit=12`));
    expect(tippen.at(-1)!.r.json().rows[0].name).toBe('Rule 1203');
    expect(tippen[0]!.r.json().rows.every((z: { type: string }) => z.type !== 'Paragraph')).toBe(true);
    const msTippen = Math.max(...tippen.map((x) => x.ms));
    /* Zum Nachlesen im Lauf: was eine Viertelmillion kostet. */
    console.log(
      `T-108 · 250k: Liste ${liste.ms.toFixed(0)} ms (danach ${zweite.ms.toFixed(0)}), Buch ${buch.ms.toFixed(0)} ms, ` +
        `Kapitel ${stueck.ms.toFixed(0)} ms, Suche ${suche.ms.toFixed(0)} ms, Teile ${teile.ms.toFixed(0)} ms, Zählung ${usage.ms.toFixed(0)} ms, ` +
        `Suche beim Tippen höchstens ${msTippen.toFixed(0)} ms (${tippen.map((x) => x.ms.toFixed(0)).join('/')})`,
    );
    /* Die erste Liste liest den Bestand in den Speicher (hier: klont ihn
       das Prüf-Repository) und baut den Index — das ist der Anlauf; alles
       danach fragt den fertigen Stand. */
    expect(liste.ms).toBeLessThan(45_000);
    for (const x of [zweite, buch, stueck, suche, teile, usage]) expect(x.ms).toBeLessThan(10_000);
    /* Beim Tippen zählt jede Zehntelsekunde; die Grenze ist trotzdem für
       einen langsamen CI-Rechner bemessen. */
    expect(msTippen).toBeLessThan(2_000);
  }, 180_000);
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
