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
function felderVon(art) {
  const schema = R.interfaces[art]?.schema;
  const props = schema?.properties ?? {};
  const pflicht = new Set(schema?.required ?? []);
  return Object.entries(props).map(([k, p]) => {
    /* Nennt das Feld eine Aufzählungszeile, steht deren Name da und
       dahinter ihre Wörter: `Ability` sagt, wo die Liste wohnt, und die
       Liste sagt, was drinsteht. Eine Spanne sagt ihre Grenzen. */
    /* Ein Feld darf mehrere Zeilen nennen: worin jemand geübt ist, kommt
       aus sechs Listen. Dann steht hier, welche — und nicht die
       fünfunddreissig Wörter daraus. */
    const refs = p.enumRef ? (Array.isArray(p.enumRef) ? p.enumRef : [p.enumRef]) : [];
    const zeilen = refs.map((r) => R.enums?.[r]).filter(Boolean);
    const zeile = zeilen.length === 1 ? zeilen[0] : null;
    const viele = zeilen.length > 1
      ? `${refs.join(' + ')}: ${zeilen.reduce((n, z) => n + (z.values?.length ?? 0), 0)} words`
      : null;
    const spanne = (p.min !== undefined || p.max !== undefined)
      ? `${p.min ?? '−∞'}…${p.max ?? '∞'}` : null;
    /* Ein Verweis sagt, worauf er zeigen darf, und ein Mass, in welcher
       Einheit es dasteht. Ohne das hiesse beides nur „link" und
       „measure" — also der Name des Mechanismus statt der Angabe. */
    const ziel = (p.target?.interfaces ?? []).length
      ? `link → ${p.target.interfaces.join(' | ')}` : null;
    const mass = p.unit
      ? (p.format === 'measure' ? `measure in ${p.unit}` : `${p.type} in ${p.unit}`) : null;
    const wie = p.derived ? 'gerechnet'
      : viele ?? (zeile ? `${refs[0]}: ${(zeile.values ?? []).join(' | ')}`
      : p.enum ? p.enum.join(' | ')
      : ziel ?? mass ?? spanne ?? (p.format ?? p.type ?? '?'));
    return `\`${k}\`${pflicht.has(k) ? ' **Pflicht**' : ''} *${wie}*`;
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
/* Die Anordnung wohnt am Typ. Gesucht wird die `extends`-Kette hoch — eine
   an `Creature` deckt die Spielerfigur mit ab. */
function sichtVon(name) {
  for (const at of [name, ...kette(name)]) {
    const eigen = R.interfaces[at]?.views?.full;
    if (eigen?.length) return { von: at, layout: eigen };
  }
  return { von: '(Vorgabe)', layout: R.views.full?.layout ?? [] };
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
  `${Object.keys(R.relations).length} Kantenarten.`);
z();
z('Je Art vier Fragen: **welche Felder sie selbst trägt**, **welche sie');
z('erbt**, **welche Kanten** sie trägt und **wie sie gezeichnet wird**. Geerbtes');
z('steht kursiv dabei — ohne das liest man bei `Consumable` „verlangt');
z('nichts" und übersieht, dass er über `Item` die halbe Kampagne trägt.');
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
    const { raus, rein } = kantenVon(n);
    const sicht = sichtVon(n);

    z(`### ${d.label ?? n}${d.abstract ? ' — *abstrakt*' : ''}`);
    z();
    z(`\`${n}\`${k.length ? ` · erbt von ${k.map((x) => `\`${x}\``).join(' ← ')}` : ''}`);
    z();
    const eigene = felderVon(n);
    if (eigene.length) {
      z('**Eigene Felder**');
      z();
      z(`- ${eigene.join(', ')}`);
      z();
    }
    const vonOben = k.map((a) => [a, felderVon(a)]).filter(([, f]) => f.length);
    if (vonOben.length) {
      z('**Geerbte Felder**');
      z();
      for (const [a, f] of vonOben) z(`- *\`${a}\`* — ${f.join(', ')}`);
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
