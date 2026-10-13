/**
 * **Eine Ebene je Buch** (T-081, E-017) — dieselbe Wanderung wie die
 * Server-Migration `apps/server/migrations/025_ebene_je_buch.sql`, für eine
 * Ausfuhr aus dem Prototyp oder ein Verzeichnis mit Artikeln.
 *
 *   node ebene-je-buch.mjs <verzeichnis-mit-entities>
 *   node ebene-je-buch.mjs <export.json> [ziel.json]
 *
 * Jeder Artikel der alten Ebene „D&D 5e (2014)" hängt danach an der Ebene
 * seines Buchs (`Source.publication`, sonst die Fundstelle in den Notizen);
 * Id und Inhalt bleiben. Jede Kampagne, die die alte Ebene aufschaltete,
 * schaltet die Bücher auf derselben Höhe dazu. Gelöscht wird nichts; was
 * ohne Quelle in der alten Ebene bleibt, wird aufgezählt.
 *
 * Die Namen der Bücher liest das Skript aus der Migration — die Tabelle
 * steht einmal.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HIER, '..', '..', 'apps', 'server', 'migrations', '025_ebene_je_buch.sql');
const ALT_ID = 'e5_367c46d7f4ff';
const ALT_NAME = 'D&D 5e (2014)';

/** Wie `buchEbeneId` im Importer. */
const buchId = (q) => `e5_book_${q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

/** Kürzel → [Name, Gruppe], aus den `values`-Zeilen der Migration. */
function titel() {
  const m = new Map();
  for (const z of readFileSync(MIGRATION, 'utf8').matchAll(/^\s*\('([^']+)', '((?:[^']|'')+)', '(core|sourcebook|adventure)'\)/gm)) {
    m.set(z[1].toLowerCase(), [z[2].replace(/''/g, "'"), z[3], z[1]]);
  }
  return m;
}

function quelleVon(e) {
  const p = e.components?.Source?.publication;
  if (typeof p === 'string' && p.trim()) return p.trim();
  const n = (Array.isArray(e.components?.Notes?.note) ? e.components.Notes.note : []).find((x) => x?.id === 'source');
  const t = typeof n?.value === 'string' ? /^Source: ([^,]+)/.exec(n.value)?.[1]?.trim() : '';
  return t || '';
}

export function wandere(entities) {
  const istEbene = (e) => (e.interfaces ?? [])[0] === 'Layer';
  const alt = new Set(entities.filter((e) => istEbene(e) && (e.id === ALT_ID || e.name === ALT_NAME)).map((e) => e.id));
  const nachId = new Map(entities.map((e) => [e.id, e]));
  const T = titel();
  const buecher = new Map();
  const geblieben = [];
  let umgezogen = 0;
  let nr = Math.max(0, ...entities.map((e) => Number(/^layer-(\d+)$/.exec(e.components?.Identity?.id ?? '')?.[1] ?? 0)));

  for (const e of entities) {
    for (const r of e.relations ?? []) {
      if (r.type !== 'inLayer' || !alt.has(r.to) || r.props?.mode === 'removes') continue;
      const q = quelleVon(e);
      if (!q) {
        geblieben.push(e.name);
        continue;
      }
      const id = buchId(q);
      if (id === 'e5_book_') continue;
      if (!buecher.has(id)) {
        const [name, gruppe, kuerzel] = T.get(q.toLowerCase()) ?? [q, 'sourcebook', q];
        if (!nachId.has(id)) {
          const l = {
            id,
            name,
            interfaces: ['Layer'],
            components: {
              Identity: { name, id: `layer-${String(++nr).padStart(4, '0')}` },
              Status: { status: 'ready' },
              Layer: { kind: 'book', order: 0, version: '2014' },
              Tags: { tags: [gruppe] },
              Prose: { paragraph: [{ id: 'text', value: `${name} (${kuerzel}), taken over from 5e.tools. Turn it on for a campaign to bring its articles into play.` }] },
            },
            relations: [],
          };
          entities.push(l);
          nachId.set(id, l);
        }
        buecher.set(id, true);
      }
      r.to = id;
      umgezogen += 1;
    }
  }

  let aufgeschaltet = 0;
  for (const k of entities.filter((e) => (e.interfaces ?? [])[0] === 'Campaign')) {
    const rel = (k.relations ??= []);
    for (const a of rel.filter((r) => r.type === 'activates' && alt.has(r.to))) {
      for (const id of buecher.keys()) {
        if (rel.some((r) => r.type === 'activates' && r.to === id)) continue;
        rel.push({ id: `${k.id}~activates-${id}`, type: 'activates', to: id, props: { ...(a.props ?? {}) } });
        aufgeschaltet += 1;
      }
    }
  }
  return { umgezogen, buecher: buecher.size, aufgeschaltet, geblieben };
}

function bericht(z) {
  console.log(`${z.umgezogen} Artikel in ${z.buecher} Buchebenen umgehängt, ${z.aufgeschaltet} Kanten „activates" dazu.`);
  if (z.geblieben.length) console.log(`Ohne Quelle in der alten Ebene geblieben (${z.geblieben.length}): ${z.geblieben.slice(0, 50).join(', ')}${z.geblieben.length > 50 ? ' …' : ''}`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  const quelle = process.argv[2];
  if (!quelle || !existsSync(quelle)) {
    console.error('node ebene-je-buch.mjs <verzeichnis-mit-entities | export.json> [ziel.json]');
    process.exit(2);
  }
  if (statSync(quelle).isDirectory()) {
    const dateien = readdirSync(quelle).filter((f) => f.endsWith('.json'));
    const entities = dateien.map((f) => JSON.parse(readFileSync(join(quelle, f), 'utf8')));
    const z = wandere(entities);
    for (const e of entities) writeFileSync(join(quelle, `${e.id}.json`), `${JSON.stringify(e, null, 1)}\n`);
    bericht(z);
  } else {
    const datei = JSON.parse(readFileSync(quelle, 'utf8'));
    const z = wandere(datei.entities ?? []);
    writeFileSync(process.argv[3] ?? quelle, JSON.stringify(datei));
    bericht(z);
  }
}
