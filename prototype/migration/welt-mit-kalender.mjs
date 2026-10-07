/**
 * **Die Welt trägt den Kalender** (Abgleich A11, 7.10.).
 *
 * Der Kalender stand dreimal: als Einstellung `calendar`, als Feld
 * `Time.calendar` je Artikel, und im Kopf. Jetzt steht er an einem Artikel
 * der Art `World`, und jede Kampagne hängt über `inWorld` daran. Die
 * Wanderung legt aus der Einstellung eine Welt an (oder nimmt die, die
 * es schon gibt), hängt jede Kampagne ohne `inWorld` an sie, streicht
 * `Time.calendar` überall (ein Wert, der nicht der Welt entspricht, wird
 * aufgezählt) und die Einstellung.
 *
 *   node welt-mit-kalender.mjs <verzeichnis-mit-entities>   (liest ../registry/settings.json daneben)
 *   node welt-mit-kalender.mjs <export.json> [ziel.json]
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const istArt = (e, a) => (e.interfaces ?? [])[0] === a;

function hoechsteNummer(E) {
  let hoch = 0;
  for (const e of E) { const m = /^world-(\d+)$/.exec(e.components?.Identity?.id ?? ''); if (m) hoch = Math.max(hoch, Number(m[1])); }
  return hoch;
}

export function wandere(E, settings, z) {
  const neu = [], geaendert = new Set();
  let welt = E.find((e) => istArt(e, 'World')) ?? null;
  const kalender = String(settings?.calendar ?? '').trim();
  if (!welt && (kalender || E.some((e) => istArt(e, 'Campaign')))) {
    const jetzt = new Date().toISOString();
    welt = {
      id: 'w_welt',
      name: 'Die Welt',
      interfaces: ['World'],
      components: {
        Identity: { name: 'Die Welt', id: `world-${String(hoechsteNummer(E) + 1).padStart(4, '0')}`, aliases: [] },
        World: kalender ? { calendar: kalender } : {},
        Status: { status: 'idea' },
        Tags: { tags: [] },
      },
      relations: [], adhoc: [], createdAt: jetzt, updatedAt: jetzt,
    };
    if (E.some((e) => e.id === welt.id)) welt.id = `w_welt_${Date.now()}`;
    neu.push(welt);
    z.angelegt.push(`${welt.id} (${welt.name}), calendar „${kalender || '—'}" — bitte umbenennen`);
  }
  const weltKalender = String(welt?.components?.World?.calendar ?? '');
  for (const e of E) {
    if (istArt(e, 'Campaign') && welt && !(e.relations ?? []).some((r) => r.type === 'inWorld')) {
      e.relations = (e.relations ?? []).concat([{ id: uid('r'), type: 'inWorld', to: welt.id, props: {} }]);
      z.notiert.push(`${e.id} (${e.name}): inWorld → ${welt.id}`);
      geaendert.add(e);
    }
    const t = e.components?.Time;
    if (t && 'calendar' in t) {
      const wert = String(t.calendar ?? '').trim();
      if (wert && wert !== weltKalender) z.offen.push(`${e.id} (${e.name}): Time.calendar „${wert}" ≠ Welt „${weltKalender}" — fällt weg`);
      delete t.calendar;
      geaendert.add(e);
    }
  }
  if (settings && 'calendar' in settings) { delete settings.calendar; z.einstellung = true; }
  return { neu, geaendert };
}

function bericht(z) {
  console.log(`${z.gelesen} Artikel gelesen.`);
  for (const a of z.angelegt) console.log(`  + ${a}`);
  for (const n of z.notiert) console.log(`  · ${n}`);
  for (const o of z.offen) console.log(`  ! ${o}`);
  if (z.einstellung) console.log('  − Einstellung calendar entfernt');
}

const ziel = process.argv[2];
if (!ziel) { console.error('Verzeichnis oder Ausfuhrdatei angeben.'); process.exit(2); }
const pfad = resolve(ziel);
if (!existsSync(pfad)) { console.error(`${pfad} gibt es nicht.`); process.exit(2); }
const z = { gelesen: 0, angelegt: [], notiert: [], offen: [], einstellung: false };

if (statSync(pfad).isDirectory()) {
  const dateien = readdirSync(pfad).filter((f) => f.endsWith('.json'));
  const E = dateien.map((f) => JSON.parse(readFileSync(join(pfad, f), 'utf8')));
  z.gelesen = E.length;
  const sp = join(pfad, '..', 'registry', 'settings.json');
  const settings = existsSync(sp) ? JSON.parse(readFileSync(sp, 'utf8')) : {};
  const { neu, geaendert } = wandere(E, settings, z);
  for (const e of neu) writeFileSync(join(pfad, `${e.id}.json`), `${JSON.stringify(e, null, 2)}\n`);
  E.forEach((e, i) => { if (geaendert.has(e)) writeFileSync(join(pfad, dateien[i]), `${JSON.stringify(e, null, 2)}\n`); });
  if (z.einstellung && existsSync(sp)) writeFileSync(sp, `${JSON.stringify(settings, null, 2)}\n`);
} else {
  const daten = JSON.parse(readFileSync(pfad, 'utf8'));
  const E = daten.entities ?? [];
  z.gelesen = E.length;
  const settings = daten.registry?.settings ?? {};
  const { neu } = wandere(E, settings, z);
  daten.entities = E.concat(neu);
  if (daten.registry) {
    const frisch = {};
    for (const f of readdirSync(REGISTRY_DIR)) if (f.endsWith('.json')) frisch[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(REGISTRY_DIR, f), 'utf8'));
    frisch.settings = { ...frisch.settings, ...settings };
    daten.registry = frisch;
  }
  const raus = resolve(process.argv[3] ?? pfad);
  writeFileSync(raus, `${JSON.stringify(daten, null, 2)}\n`);
  console.log(`geschrieben: ${raus}`);
}
bericht(z);
