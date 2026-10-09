/**
 * **Der Bericht eines Laufs** als Markdown: je Art, wie viele Einträge
 * gelesen und wie viele Artikel daraus wurden, was ausgeschlossen wurde,
 * welche 5e.tools-Schlüssel kein Feld trägt, und welche Verweise ins Leere
 * gehen. Ein stiller Verlust sähe später aus wie ein leeres Feld
 * (CLAUDE.md) — hier steht er mit Zähler.
 */

import type { Bericht } from './werkbank.js';

const zahl = (n: number) => n.toLocaleString('de-CH');

function sortiert<K>(m: Map<K, number>): [K, number][] {
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function kurz(m: Map<string, number>, max = 12): string {
  const s = sortiert(m);
  const teil = s.slice(0, max).map(([k, n]) => `\`${k}\` ${zahl(n)}`).join(', ');
  return s.length > max ? `${teil}, … (${s.length - max} weitere)` : teil;
}

export interface BerichtKopf {
  /** Stand des Datenbestands (Commit oder Datum). */
  stand?: string;
  /** Wie der Lauf aufgerufen wurde. */
  aufruf?: string;
  artikel: number;
}

export function berichtMarkdown(b: Bericht, kopf: BerichtKopf): string {
  const z: string[] = [];
  z.push('# 5e.tools-Übernahme — Bericht');
  z.push('');
  z.push('Erzeugt von `packages/import-5etools` (Paket P5, [5etools-Arbeitsplan.md](5etools-Arbeitsplan.md)). **Nicht von Hand ändern** — ein neuer Lauf schreibt die Datei neu.');
  z.push('');
  if (kopf.stand) z.push(`- Datenstand: ${kopf.stand}`);
  if (kopf.aufruf) z.push(`- Aufruf: \`${kopf.aufruf}\``);
  z.push(`- **${zahl(kopf.artikel)} Artikel**, alle durch \`validateEntity\` mit \`knownTypes\``);
  z.push(`- Gleichlautende Merkmale der Statblöcke (Arbeitsplan §2.5): ${zahl(b.geteilt.merkmale)} Aktionen und Merkmale stehen an mehr als einem Statblock; ${zahl(b.geteilt.verwendungen)} Doppel wurden dadurch nicht angelegt`);
  z.push('');

  z.push('## Artikel je Art (unsere)');
  z.push('');
  z.push('| Art | Artikel |');
  z.push('| --- | ---: |');
  for (const [t, n] of [...b.typen.entries()].sort((a, c) => a[0].localeCompare(c[0]))) z.push(`| \`${t}\` | ${zahl(n)} |`);
  z.push('');

  z.push('## Je 5e.tools-Art');
  z.push('');
  z.push('*Gelesen* ist jeder Eintrag der Liste, *Artikel* die daraus angelegten Hauptartikel (ohne die Aktionen und Merkmale, die ein Statblock oder eine Klasse dazu anlegt). Die Differenz steht unter *ausgeschlossen* und *Notizen*.');
  z.push('');
  z.push('| 5e.tools | gelesen | Artikel | ausgeschlossen | Notizen |');
  z.push('| --- | ---: | ---: | ---: | --- |');
  const arten = [...b.arten.entries()].filter(([, a]) => a.gelesen > 0).sort((a, c) => a[0].localeCompare(c[0]));
  for (const [art, a] of arten) {
    const artikel = [...a.artikel.entries()].map(([t, n]) => `${zahl(n)} ${t}`).join(', ') || '—';
    let weg = 0;
    for (const m of a.ausgeschlossen.values()) for (const n of m.values()) weg += n;
    z.push(`| \`${art}\` | ${zahl(a.gelesen)} | ${artikel} | ${weg ? zahl(weg) : '—'} | ${a.notizen.size ? kurz(a.notizen, 6).replace(/\|/g, '\\|') : '—'} |`);
  }
  z.push('');

  z.push('## Ausgeschlossene Quellen');
  z.push('');
  z.push('Nach Arbeitsplan §1, E2: 2014 als Basis. Je Grund die Quellen mit Anzahl Einträgen, über alle Arten.');
  z.push('');
  const gruende = new Map<string, Map<string, number>>();
  for (const a of b.arten.values()) {
    for (const [g, m] of a.ausgeschlossen) {
      const ziel = gruende.get(g) ?? new Map<string, number>();
      for (const [q, n] of m) ziel.set(q, (ziel.get(q) ?? 0) + n);
      gruende.set(g, ziel);
    }
  }
  for (const [g, m] of [...gruende.entries()].sort()) {
    let summe = 0;
    for (const n of m.values()) summe += n;
    z.push(`- **${g}** (${zahl(summe)}): ${sortiert(m).map(([q, n]) => `${q} ${zahl(n)}`).join(', ')}`);
  }
  if (!gruende.size) z.push('- keine');
  z.push('');
  if (b.fremdeQuellen.size) {
    z.push('Quellen, die in keiner Bücher- oder Abenteuerliste stehen und hereinkamen (nicht nach Datum geprüft):');
    z.push('');
    z.push(`- ${sortiert(b.fremdeQuellen).map(([q, n]) => `${q} ${zahl(n)}`).join(', ')}`);
    z.push('');
  }

  z.push('## Schlüssel, die kein Feld trägt');
  z.push('');
  z.push('Je Art die 5e.tools-Schlüssel, die keine Zuordnung liest, mit der Zahl der Einträge, in denen sie stehen. Bewusst überall weggelassen und hier nicht aufgeführt: Fundstellen (`page`, `otherSources`, `referenceSources`, `reprintedAs`), Lizenzflaggen (in `Source.srd`), Bildflaggen (`hasToken`, `hasFluffImages`, E5) und die vorgerechneten Filterschlüssel (`*Tags`, Abgleich §3).');
  z.push('');
  for (const [art, a] of arten) {
    if (!a.liegen.size) continue;
    z.push(`- **${art}:** ${kurz(a.liegen, 30)}`);
  }
  z.push('');

  z.push('## Verweise ins Leere');
  z.push('');
  z.push('Marken, deren Ziel nicht hereinkam — meist ein Eintrag aus einer ausgeschlossenen Quelle. Sie stehen als Text da.');
  z.push('');
  z.push('| Marke | Verweise | verschiedene Ziele | häufigste |');
  z.push('| --- | ---: | ---: | --- |');
  for (const [tag, m] of [...b.insLeere.entries()].sort((a, c) => a[0].localeCompare(c[0]))) {
    let summe = 0;
    for (const n of m.values()) summe += n;
    z.push(`| \`@${tag}\` | ${zahl(summe)} | ${zahl(m.size)} | ${kurz(m, 5).replace(/\|/g, '\\|')} |`);
  }
  z.push('');

  z.push('## Unbekannte Eintragsarten und Marken');
  z.push('');
  if (b.unbekannt.size) z.push(`- ${kurz(b.unbekannt, 40)}`);
  else z.push('- keine');
  z.push('');
  return z.join('\n');
}
