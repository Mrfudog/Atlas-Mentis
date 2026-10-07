/*
  Ein Typ, vollständig — zum Durchgehen.

  Der Katalog beantwortet die vier Fragen für **alle** Arten auf einmal und
  ist damit gut zum Nachschlagen und schlecht zum Entscheiden: wer eine Art
  streichen will, braucht eine fünfte Frage, die er nicht beantwortet —
  **wird das überhaupt benutzt?** Eine Angabe, die in der Kampagne nirgends
  steht, ist ein Feld, das jemand einmal für richtig hielt, und keines, das
  jemand füllt.

  Also liest dieses Skript neben dem Register auch den **Bestand** und zählt
  je Feld, in wie vielen Artikeln etwas darin steht. Ohne Bestand läuft es
  auch, dann fehlt eben die Spalte — geraten wird nichts.

  Aufruf:
    node scripts/typ.mjs <Typ> [verzeichnis-mit-artikeln | ausfuhr.json]
    node scripts/typ.mjs --liste            # alle Arten, nach Bereich

  Das Verzeichnis ist eines mit einer JSON-Datei je Artikel (wie
  `prototype/test/dbdump/entities`); die Ausfuhrdatei ist eine Sicherung aus
  dem laufenden Prototyp.
*/
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { areaOf, typeChain } from '@nw/model';
import { seedRegistry as R } from '../dist/index.js';

const argv = process.argv.slice(2);
const TYP = argv[0];
const DATEN = argv[1];

/* ---------- der Bestand, wenn es einen gibt ---------- */
function ladeArtikel(pfad) {
  if (!pfad) return null;
  try {
    if (statSync(pfad).isDirectory()) {
      return readdirSync(pfad)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(pfad, f), 'utf8')));
    }
    const roh = JSON.parse(readFileSync(pfad, 'utf8'));
    return Array.isArray(roh) ? roh : (roh.entities ?? []);
  } catch (x) {
    console.error(`Bestand nicht lesbar (${pfad}): ${x.message}`);
    return null;
  }
}
const ARTIKEL = ladeArtikel(DATEN);

/** Steht in diesem Feld etwas? Leer ist leer — auch die leere Liste. */
const gefuellt = (v) =>
  !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)
    || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length));

/** Wie oft `Typ.feld` im Bestand gefüllt ist, und in wie vielen Artikeln es
 *  überhaupt stehen könnte. */
function zaehle(art, feld) {
  if (!ARTIKEL) return null;
  let moeglich = 0;
  let steht = 0;
  for (const e of ARTIKEL) {
    const eigen = (e.interfaces ?? [])[0];
    if (!eigen || !typeChain(R, eigen).includes(art)) continue;
    moeglich += 1;
    if (gefuellt((e.components ?? {})[art]?.[feld])) steht += 1;
  }
  return { steht, moeglich };
}

/* ---------- wie ein Feld heisst, was es hält ---------- */
function wieFeld(p) {
  if (p.derived) return `gerechnet: ${p.derived}`;
  const refs = p.enumRef ? (Array.isArray(p.enumRef) ? p.enumRef : [p.enumRef]) : [];
  if (refs.length) {
    const woerter = refs.reduce((n, r) => n + (R.enums?.[r]?.values?.length ?? 0), 0);
    return `${p.type === 'array' ? 'mehrere aus ' : 'aus '}${refs.join(' + ')} (${woerter} Wörter)`;
  }
  if (p.enum) return p.enum.join(' | ');
  if ((p.target?.interfaces ?? []).length) return `Verweis → ${p.target.interfaces.join(' | ')}`;
  if (p.unit) return p.format === 'measure' ? `Mass in ${p.unit}` : `${p.type} in ${p.unit}`;
  if (p.min !== undefined || p.max !== undefined) return `${p.min ?? '−∞'}…${p.max ?? '∞'}`;
  if (p.many && p.format === 'long') return 'Textblöcke (mehrere)';
  return p.format ?? p.type ?? '?';
}

/* ---------- eine Feldtabelle ---------- */
function tabelle(art) {
  const schema = R.interfaces[art]?.schema;
  const props = schema?.properties ?? {};
  const pflicht = new Set(schema?.required ?? []);
  const keys = Object.keys(props);
  if (!keys.length) return ['_Keine eigenen Felder._'];
  const mitZahl = !!ARTIKEL;
  const kopf = mitZahl
    ? '| Feld | Beschriftung | Hält | Pflicht | Gefüllt |\n| --- | --- | --- | --- | --- |'
    : '| Feld | Beschriftung | Hält | Pflicht |\n| --- | --- | --- | --- |';
  const zeilen = keys.map((k) => {
    const p = props[k];
    const z = zaehle(art, k);
    /* Ein `|` in einer Aufzählung schliesst sonst die Spalte: „gm |
       campaign" wurden zwei Zellen, und die Zeile verrutschte. */
    const spalten = [
      `\`${k}\``,
      p.title ?? k,
      wieFeld(p).replace(/\|/g, '\u2223'),
      pflicht.has(k) ? '**ja**' : '—',
    ];
    if (mitZahl) {
      spalten.push(
        p.derived ? '—' : z && z.moeglich ? `${z.steht} / ${z.moeglich}` : '0 / 0',
      );
    }
    return `| ${spalten.join(' | ')} |`;
  });
  return [kopf, ...zeilen];
}

/* ---------- Kanten ---------- */
/**
 * **Genannt ist nicht dasselbe wie getroffen.**
 *
 * Eine Kante mit `from: ['*']` gilt für jede Art — sie über einem Typ
 * aufzuzählen sagt nichts über ihn, sondern über das Register. Also stehen
 * hier die Kanten, die diese Art (oder einen ihrer Obertypen) **nennen**,
 * und die allgemeinen werden nur gezählt.
 */
function kanten(name) {
  const drin = typeChain(R, name);
  const nennt = (liste) => (liste ?? []).some((x) => drin.includes(x));
  const wild = (liste) => (liste ?? ['*']).includes('*');
  const zahl = (typ) =>
    ARTIKEL
      ? ARTIKEL.reduce((n, e) => n + (e.relations ?? []).filter((r) => r.type === typ).length, 0)
      : null;
  const zeilen = [];
  let allgemein = 0;
  for (const [k, r] of Object.entries(R.relations)) {
    const raus = nennt(r.from);
    const rein = nennt(r.to);
    if (!raus && !rein) {
      if (wild(r.from) || wild(r.to)) allgemein += 1;
      continue;
    }
    const n = zahl(k);
    const wie = [
      r.cardinality === 'one' ? 'eine' : 'mehrere',
      r.owned ? 'besitzend' : null,
      r.asField ? `liest sich am Ende \`${r.asField}\` wie ein Feld` : null,
      r.section ? `Abschnitt „${r.section}"` : null,
      n === null ? null : `${n}× im Bestand`,
    ].filter(Boolean).join(', ');
    if (raus) zeilen.push(`| → | \`${k}\` | ${r.label} | ${(r.to ?? ['*']).join(' ǀ ')} | ${wie} |`);
    if (rein) zeilen.push(`| ← | \`${k}\` | ${r.inverseLabel} | ${(r.from ?? ['*']).join(' ǀ ')} | ${wie} |`);
  }
  const fuss = allgemein
    ? [`\n_Dazu ${allgemein} Kantenarten, die jede Art treffen (\`*\`) — sie sagen über`
       + ` diese hier nichts._`]
    : [];
  if (!zeilen.length) {
    return ['_**Keine Kante nennt diese Art.**_', ...fuss];
  }
  return ['| | Kante | Heisst | Gegenüber | Wie |', '| --- | --- | --- | --- | --- |',
    ...zeilen, ...fuss];
}

/* ---------- ein Bericht ---------- */
function bericht(name) {
  const d = R.interfaces[name];
  if (!d) {
    console.error(`Keine Zeile „${name}" im Register.`);
    process.exit(1);
  }
  const kette = typeChain(R, name);
  const geerbt = kette.slice(1);
  const nutzer = Object.keys(R.interfaces).filter(
    (n) => n !== name && typeChain(R, n).includes(name),
  );
  /* Zwei verschiedene Zahlen: wie viele Artikel **diese Art sind**, und wie
     viele sie **mittragen**. Bei einem geteilten Typ ist die erste immer
     null, und die zweite ist die, um die es geht. */
  const eigene = ARTIKEL
    ? ARTIKEL.filter((e) => (e.interfaces ?? [])[0] === name).length
    : null;
  const traegt = ARTIKEL
    ? ARTIKEL.filter((e) => typeChain(R, (e.interfaces ?? [])[0] ?? '').includes(name)).length
    : null;

  const out = [];
  out.push(`## ${d.label ?? name}`);
  out.push('');
  const kopf = [
    `\`${name}\``,
    d.abstract ? 'geteilt (nicht anlegbar)' : 'anlegbar',
    `Bereich: ${areaOf(R, name) || '—'}`,
    d.units ? `Einheiten: ${d.units}` : null,
    d.alwaysEdit ? 'Felder immer als Eingabe' : null,
    traegt === null ? null
      : d.abstract ? `${traegt} von ${ARTIKEL.length} Artikeln tragen ihn`
      : `${eigene} Artikel im Bestand`,
  ].filter(Boolean);
  out.push(kopf.join(' · '));
  out.push('');

  out.push('**Eigene Felder**');
  out.push('');
  out.push(...tabelle(name));
  out.push('');

  if (geerbt.length) {
    out.push(`**Geerbt** — ${geerbt.length} Typen, `
      + `${geerbt.reduce((n, a) => n + Object.keys(R.interfaces[a]?.schema?.properties ?? {}).length, 0)} Felder`);
    out.push('');
    for (const a of geerbt) {
      const props = R.interfaces[a]?.schema?.properties ?? {};
      const direkt = (d.extends ?? []).includes(a) ? 'hier dazugenommen' : 'über einen anderen';
      const ks = Object.keys(props);
      out.push(`- *\`${a}\`* (${direkt}) — ${ks.length
        ? ks.map((k) => `\`${k}\``).join(', ')
        : 'keine Felder'}`);
    }
    out.push('');
  }

  out.push('**Kanten**');
  out.push('');
  out.push(...kanten(name));
  out.push('');

  if (nutzer.length) {
    out.push(`**Genommen von** ${nutzer.length} Arten: ${nutzer.join(', ')}`);
    out.push('');
  }
  return out.join('\n');
}

/* ---------- Liste aller Arten, in der Reihenfolge des Durchgangs ---------- */
function liste() {
  const nach = {};
  for (const n of Object.keys(R.interfaces)) {
    const a = R.interfaces[n].abstract ? 'geteilt' : (areaOf(R, n) || 'ohne Bereich');
    (nach[a] = nach[a] ?? []).push(n);
  }
  const out = [];
  for (const a of Object.keys(nach).sort()) {
    out.push(`### ${a} (${nach[a].length})`);
    out.push(nach[a].sort().join(', '));
    out.push('');
  }
  return out.join('\n');
}

if (!TYP || TYP === '--liste') console.log(liste());
else console.log(bericht(TYP));
