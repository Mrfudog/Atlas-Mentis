/*
  Der Katalog der Artikeltypen — aus dem Register erzeugt, nicht von Hand
  geschrieben.

  Eine Übersicht, die jemand abtippt, stimmt am Tag ihrer Entstehung und
  danach nie wieder. Diese hier liest `seedRegistry` und schreibt
  `docs/Artikeltypen.md`; wer eine Zeile ändert, lässt sie neu laufen.

  Sie ist zum **Durchgehen** gedacht: je Artikelart steht, was sie verlangt,
  was sie erlaubt, welche Kanten von ihr ausgehen und welche auf sie zeigen,
  und wie sie gezeichnet wird. Genau die vier Fragen, die man stellt, wenn
  man entscheiden will, ob eine Art so bleiben soll.

  Aufruf: node scripts/catalogue.mjs [zieldatei]
*/
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedRegistry as R } from '../dist/index.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = resolve(
  process.argv[2] ?? join(HIER, '..', '..', '..', 'docs', 'Artikeltypen.md'),
);

const AREAS = [
  ['story', 'Story', 'Was passiert und passiert ist.'],
  ['world', 'World', 'Wer und was es gibt.'],
  ['game', 'Game', 'Woran man sich hält.'],
  ['play', 'Play', 'Worauf man während der Sitzung schaut.'],
  ['', 'Ohne Bereich', 'Abstrakte Oberbegriffe — sie tragen keine Artikel.'],
];

/* Dieselbe Regel wie in der Oberfläche: der Bereich wird geerbt. Sie hier
   nachzubauen wäre die zweite Stelle, an der jemand sie ändern müsste —
   aber `areaOf` lebt im Prototyp und nicht im Paket, also steht sie
   ausnahmsweise zweimal. Wenn sie ein drittes Mal gebraucht wird, gehört
   sie nach `packages/model`. */
const elternOf = (n) => (R.interfaces[n]?.extends ?? [])[0];
function areaOf(n) {
  let at = n;
  for (let i = 0; at && i < 64; i++) {
    const a = R.interfaces[at]?.area;
    if (a) return a;
    at = elternOf(at);
  }
  return '';
}
function kette(n) {
  const out = [];
  let at = elternOf(n);
  for (let i = 0; at && i < 64; i++) {
    out.push(at);
    at = elternOf(at);
  }
  return out;
}
/* Was eine Art erbt: die Komponenten und Blockarten ihrer Vorfahren. Ohne
   das liest man bei `NPC` „verlangt nichts" und übersieht, dass sie über
   `Creature` die halbe Kampagne trägt. */
function geerbt(n, feld) {
  const out = [];
  for (const a of kette(n)) out.push(...(R.interfaces[a]?.[feld] ?? []));
  return [...new Set(out)];
}
function felderVon(comp) {
  const props = R.components[comp]?.schema?.properties ?? {};
  return Object.entries(props).map(([k, p]) => {
    const art = p.derived ? 'gerechnet' : (p.enum ? p.enum.join(' | ') : (p.format ?? p.type ?? '?'));
    return `\`${k}\` *${art}*`;
  });
}
function kantenVon(name) {
  const alle = Object.values(R.relations);
  const passt = (liste) => (liste ?? []).some((x) => x === '*' || x === name || kette(name).includes(x));
  return {
    raus: alle.filter((r) => passt(r.from)),
    rein: alle.filter((r) => passt(r.to)),
  };
}
function sichtVon(name) {
  const v = R.views.full;
  const by = v?.byInterface ?? {};
  for (const at of [name, ...kette(name)]) {
    if (by[at]?.length) return { von: at, layout: by[at] };
  }
  return { von: '(Vorgabe)', layout: v?.layout ?? [] };
}
function layoutText(layout, tiefe = 0) {
  return layout
    .map((x) => {
      const pre = '  '.repeat(tiefe);
      if (x.el === 'tabs') {
        const reiter = (x.tabs ?? [])
          .map((t) => `${pre}  - **${t.label}** — ${layoutText(t.layout, 0)}`)
          .join('\n');
        return `Reiter:\n${reiter}`;
      }
      const zusatz = x.except?.length ? ` (ohne ${x.except.join(', ')})` : '';
      return `\`${x.el}\`${zusatz}`;
    })
    .join(', ');
}

const zeilen = [];
const z = (s = '') => zeilen.push(s);

z('# Artikeltypen — zum Durchgehen');
z();
z('<!-- Erzeugt aus `packages/registry`. Nicht von Hand ändern:');
z('     `pnpm --filter @nw/registry catalogue` schreibt die Datei neu. -->');
z();
z(`Stand ${new Date().toISOString().slice(0, 10)}. ` +
  `${Object.keys(R.interfaces).length} Schnittstellen, ` +
  `${Object.keys(R.components).length} Komponenten, ` +
  `${Object.keys(R.relations).length} Kantenarten.`);
z();
z('Je Art vier Fragen: **was sie verlangt**, **was sie erlauben darf**,');
z('**welche Kanten** sie trägt und **wie sie gezeichnet wird**. Geerbtes');
z('steht kursiv dabei — ohne das liest man bei `NPC` „verlangt nichts" und');
z('übersieht, dass sie über `Creature` die halbe Kampagne trägt.');
z();

for (const [key, titel, wozu] of AREAS) {
  const arten = Object.keys(R.interfaces)
    .filter((n) => areaOf(n) === key)
    .sort((a, b) => a.localeCompare(b));
  if (!arten.length) continue;
  z('---');
  z();
  z(`## ${titel}`);
  z();
  z(`*${wozu}* — ${arten.length} Arten.`);
  z();
  for (const n of arten) {
    const d = R.interfaces[n];
    const k = kette(n);
    const req = d.requires ?? [];
    const allow = d.allows ?? [];
    const reqE = geerbt(n, 'requires');
    const allowE = geerbt(n, 'allows');
    const { raus, rein } = kantenVon(n);
    const sicht = sichtVon(n);

    z(`### ${d.label ?? n}${d.abstract ? ' — *abstrakt*' : ''}`);
    z();
    z(`\`${n}\`${k.length ? ` · erbt von ${k.map((x) => `\`${x}\``).join(' ← ')}` : ''}`);
    z();
    if (req.length || reqE.length) {
      z('**Verlangt**');
      z();
      for (const c of req) z(`- \`${c}\` — ${felderVon(c).join(', ') || '*keine Felder*'}`);
      for (const c of reqE) if (!req.includes(c)) z(`- *\`${c}\`* — ${felderVon(c).join(', ') || '*keine Felder*'}`);
      z();
    }
    if (allow.length || allowE.length) {
      z('**Erlaubt**');
      z();
      for (const c of allow) z(`- \`${c}\` — ${felderVon(c).join(', ') || '*keine Felder*'}`);
      for (const c of allowE) if (!allow.includes(c)) z(`- *\`${c}\`* — ${felderVon(c).join(', ') || '*keine Felder*'}`);
      z();
    }
    if (d.blockTypes?.length) {
      z(`**Blöcke** ${d.blockTypes.map((b) => `\`${b}\``).join(' ')}`);
      z();
    }
    if (raus.length) {
      z('**Kanten von hier**');
      z();
      for (const r of raus) z(`- \`${r.type}\` → ${(r.to ?? []).join(' | ')} — „${r.label}"`);
      z();
    }
    if (rein.length) {
      z('**Kanten hierher**');
      z();
      for (const r of rein) z(`- ${(r.from ?? []).join(' | ')} — \`${r.type}\` → „${r.inverseLabel ?? r.label}"`);
      z();
    }
    z(`**Gezeichnet** (aus \`${sicht.von}\`): ${layoutText(sicht.layout)}`);
    z();
  }
}

mkdirSync(dirname(ZIEL), { recursive: true });
writeFileSync(ZIEL, `${zeilen.join('\n')}\n`, 'utf8');
console.log(`geschrieben: ${ZIEL} (${zeilen.length} Zeilen)`);
