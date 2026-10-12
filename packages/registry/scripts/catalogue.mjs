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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { areaOf as areaVon, typeChain } from '@nw/model';
import { seedRegistry as R } from '../dist/index.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = resolve(
  process.argv[2] ?? join(HIER, '..', '..', '..', 'docs', 'Artikeltypen.md'),
);

/**
 * **Welche Bereiche es gibt, sagt das Register und nicht diese Datei.**
 *
 * Hier stand eine feste Liste mit `story` und `game` — den Namen von vor der
 * Umbenennung zu `history` und `rules`. Die Schleife lief über die Liste und
 * nicht über den Bestand, also fielen einundzwanzig Artikelarten aus dem
 * Katalog: Kampagne, Sitzung, Szene, Quest, Regel, Talent, Fertigkeit,
 * Statblock, Rezept … Gemerkt hat es niemand, weil eine Überschrift, die
 * fehlt, keine Lücke hinterlässt.
 *
 * Also andersherum: die Bereiche kommen aus den Zeilen. Was hier steht, ist
 * nur die **Reihenfolge** und der Satz darunter; ein Bereich, den niemand
 * beschrieben hat, kommt trotzdem — hinten, ohne Satz. Ein neuer Bereich
 * braucht dann keine Codeänderung, um im Katalog zu stehen.
 */
const AREA_TITEL = {
  world: ['World', 'Wer und was es gibt.'],
  history: ['History', 'Was passiert und passiert ist.'],
  rules: ['Rules', 'Woran man sich hält.'],
  play: ['Play', 'Worauf man während der Sitzung schaut.'],
  '': ['Ohne Bereich', 'Abstrakte Oberbegriffe — sie tragen keine Artikel.'],
};
const AREA_ORDER = ['world', 'history', 'rules', 'play', ''];

function areas() {
  const da = new Set(Object.keys(R.interfaces).map((n) => areaOf(n) || ''));
  const bekannt = AREA_ORDER.filter((k) => da.has(k));
  /* Was das Register kennt und diese Datei nicht. Aufgezählt und nicht
     verschwiegen — genau daran ist die alte Liste gescheitert. */
  const rest = [...da].filter((k) => !AREA_ORDER.includes(k)).sort();
  if (rest.length) console.log(`Bereiche ohne Beschreibung: ${rest.join(', ')}`);
  return [...bekannt, ...rest].map((k) => [k, ...(AREA_TITEL[k] ?? [k, ''])]);
}

/* **Die Kette und der Bereich kommen aus dem Paket.** Sie standen hier als
   eigene Schleife über `extends[0]` — und seit `extends` ein Array ist, war
   das die falsche Antwort: der Katalog verschwieg 360 geerbte Typen bei 37
   von 59 Arten, weil eine Art, die von zweien erbt, nur unter einem davon
   erschien. Zwei Regeln für eine Frage halten genau so lange, wie beide
   jemandem einfallen. */
const areaOf = (n) => areaVon(R, n);
const kette = (n) => typeChain(R, n).slice(1);
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
    /* Seit M6 darf ein Name eine Artikelart sein (die Namen ihrer Artikel)
       oder `Typ.feld` (dessen Liste). Dann steht da, woher — Wörter gibt es
       bei einer Art erst mit dem Bestand. */
    const nichtZeile = refs.some((r) => !R.enums?.[r]);
    const zeile = zeilen.length === 1 && !nichtZeile ? zeilen[0] : null;
    const quelle = (r) => R.enums?.[r] ? r
      : R.interfaces?.[r] ? `${r} articles`
      : r;
    const viele = zeilen.length > 1 || nichtZeile
      ? refs.map(quelle).join(' + ')
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
    /* `same` heisst „die Art der Quelle": hierher kommt die Kante, wenn
       sie von hier ausgehen darf (`instanceOf`). */
    rein: alle.filter((r) => passt(r.to) || ((r.to ?? []).includes('same') && passt(r.from))),
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
z('steht kursiv dabei — ohne das liest man bei `Weapon` drei Waffenfelder');
z('und übersieht, dass sie über `Item` die halbe Kampagne trägt.');
z();

for (const [key, titel, wozu] of areas()) {
  const arten = Object.keys(R.interfaces)
    .filter((n) => areaOf(n) === key)
    .sort((a, b) => a.localeCompare(b));
  if (!arten.length) continue;
  z('---');
  z();
  z(`## ${titel}`);
  z();
  z(wozu ? `*${wozu}* — ${arten.length} Arten.` : `${arten.length} Arten.`);
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

/* ---------- die Übersicht im Konzept ----------
   `docs/Datenmodell.md` sagt, was gilt, und zeigt in einem Abschnitt, was
   das Register heute trägt — je Art, je Kante, je Aufzählung eine Zeile.
   Der Abschnitt steht zwischen zwei Marken und wird hier geschrieben; eine
   Übersicht, die jemand abtippt, stimmt am Tag ihrer Entstehung und danach
   nie wieder. Fehlen die Marken, bleibt die Datei unberührt und es wird
   gesagt. */
const KONZEPT = resolve(join(HIER, '..', '..', '..', 'docs', 'Datenmodell.md'));
const GRUND = ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Notes', 'Prose'];
const code = (xs) => xs.map((x) => `\`${x}\``).join(' ');
const eigeneFelder = (n) => Object.keys(R.interfaces[n]?.schema?.properties ?? {});
const nimmt = (n) => Object.keys(R.interfaces).filter((m) => (R.interfaces[m].extends ?? []).includes(n));

function uebersicht() {
  const u = [];
  const w = (s = '') => u.push(s);
  const arten = Object.keys(R.interfaces);
  const abstrakt = arten.filter((n) => R.interfaces[n].abstract).sort();
  const konkret = arten.filter((n) => !R.interfaces[n].abstract);
  w(`Stand ${new Date().toISOString().slice(0, 10)}: ${konkret.length} Artikelarten, ` +
    `${abstrakt.length} Grundtypen, ${Object.keys(R.relations).length} Kantenarten, ` +
    `${Object.keys(R.enums ?? {}).length} Aufzählungszeilen, ` +
    `${Object.keys(R.units ?? {}).length} Einheiten, ${Object.keys(R.vars ?? {}).length} Variablen.`);
  w();
  w('### Grundtypen');
  w();
  w('| Grundtyp | Felder | genommen von |');
  w('|---|---|---|');
  for (const n of abstrakt) {
    const f = eigeneFelder(n).map((k) => k + (R.interfaces[n].schema.properties[k].derived ? '*' : ''));
    const wer = nimmt(n);
    w(`| \`${n}\`${R.interfaces[n].area ? ` (${R.interfaces[n].area})` : ''} | ${code(f) || '—'} | ${wer.length <= 3 ? code(wer) : wer.length} |`);
  }
  w();
  w('Ein `*` am Feld heisst gerechnet.');
  w();
  w('### Artikelarten');
  w();
  w('Die Grundausstattung (`' + GRUND.join('`, `') + '`) nimmt jede Art und steht nicht dabei; ' +
    '„erbt" nennt die übrigen direkten Obertypen.');
  for (const [key, titel] of areas()) {
    const hier = konkret.filter((n) => areaOf(n) === key).sort();
    if (!hier.length) continue;
    w();
    w(`**${titel}**`);
    w();
    w('| Art | erbt | eigene Felder | Kanten von hier | Kanten hierher | Anordnung |');
    w('|---|---|---|---|---|---|');
    for (const n of hier) {
      const d = R.interfaces[n];
      const erbt = (d.extends ?? []).filter((x) => !GRUND.includes(x));
      const f = eigeneFelder(n).map((k) => k + (d.schema.properties[k].derived ? '*' : ''));
      const { raus, rein } = kantenVon(n);
      /* Kanten mit `*` treffen jede Art und sagen über diese nichts. */
      const eigen = (xs, seite) => xs.filter((r) => !(r[seite] ?? []).includes('*')).map((r) => r.type);
      w(`| \`${n}\` | ${code(erbt) || '—'} | ${code(f) || '—'} | ${code(eigen(raus, 'from')) || '—'} | ${code(eigen(rein, 'to')) || '—'} | ${d.views ? Object.keys(d.views).join(', ') : '—'} |`);
    }
  }
  w();
  w('### Kanten');
  w();
  w('| Kante | von → nach | eins | liest sich / setzt ein | Eigenschaften |');
  w('|---|---|---|---|---|');
  for (const r of Object.values(R.relations).sort((a, b) => a.type.localeCompare(b.type))) {
    const wie = [r.asField ? `Feld am \`${r.asField}\`-Ende` : '', r.section ? `Abschnitt „${r.section}"` : '', r.owned ? 'owned' : '']
      .filter(Boolean).join(', ');
    const props = Object.keys(r.props?.properties ?? {});
    w(`| \`${r.type}\` | ${(r.from ?? []).join(' \\| ')} → ${(r.to ?? []).join(' \\| ')} | ${r.cardinality === 'one' ? 'ja' : ''} | ${wie || '—'} | ${code(props) || '—'} |`);
  }
  w();
  w('### Aufzählungszeilen');
  w();
  w('| Zeile | Wörter | genannt von |');
  w('|---|---|---|');
  const nutzer = {};
  for (const n of arten) {
    for (const [k, p] of Object.entries(R.interfaces[n].schema?.properties ?? {})) {
      for (const ref of p.enumRef ? [].concat(p.enumRef) : []) (nutzer[ref] ??= []).push(`${n}.${k}`);
    }
  }
  for (const [name, z] of Object.entries(R.enums ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const werte = z.values ?? [];
    w(`| \`${name}\` | ${werte.length <= 8 ? werte.join(' · ') : `${werte.length}: ${werte.slice(0, 4).join(' · ')} …`} | ${code(nutzer[name] ?? []) || '—'} |`);
  }
  w();
  w('### Einheiten, Variablen, Einstellungen');
  w();
  const einheiten = {};
  for (const [c, d] of Object.entries(R.units ?? {})) (einheiten[`${d.quantity} · ${d.system}`] ??= []).push(c);
  w('- Einheiten: ' + Object.entries(einheiten).map(([k, v]) => `${k}: ${code(v)}`).join('; '));
  w('- Variablen: ' + code(Object.keys(R.vars ?? {})));
  w('- Einstellungen: ' + code(Object.keys(R.settings ?? {})));
  return u;
}

try {
  const text = readFileSync(KONZEPT, 'utf8');
  const ANFANG = '<!-- register:anfang -->', ENDE = '<!-- register:ende -->';
  const a = text.indexOf(ANFANG), e = text.indexOf(ENDE);
  if (a < 0 || e < 0 || e < a) {
    console.log(`Marken ${ANFANG} … ${ENDE} nicht gefunden — ${KONZEPT} unverändert`);
  } else {
    const neu = text.slice(0, a + ANFANG.length) + '\n' + uebersicht().join('\n') + '\n' + text.slice(e);
    writeFileSync(KONZEPT, neu, 'utf8');
    console.log(`geschrieben: ${KONZEPT} (Abschnitt „Das Register heute")`);
  }
} catch (error) {
  console.log(`Konzept nicht nachgezogen: ${error instanceof Error ? error.message : String(error)}`);
}
