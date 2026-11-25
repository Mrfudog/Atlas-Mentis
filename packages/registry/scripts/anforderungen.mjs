/*
  Die Anforderungen als Epics → Features → Stories (T-154, E-048 a, E-049).

  Quelle sind die Notizen im Vault: VTT/Epics, VTT/Features, VTT/Stories —
  je eine Notiz mit Frontmatter (siehe `stories-lib.mjs`). Der Stand einer
  Story (`stand`, `standNotiz`) steht in ihrer Notiz; er ist ein Urteil,
  keine Messung — wer ihn anders sieht, ändert die Notiz.

  Erzeugt werden, und von Hand geändert wird davon nichts:
  - VTT/Requirements.md — alle Nummern in einer Tabelle,
  - VTT/Requirements by Epic.md — je Epic und Feature,
  - VTT/Areas.md — die Epics im Überblick,
  - die Listen in den Epic- und Feature-Notizen (zwischen den Marken
    `stories:anfang` und `stories:ende`),
  - docs/Anforderungen.md, mit `--umsetzung <datei>` dieselbe Übersicht als
    Notiz im Vault (VTT/Umsetzung.md).

  Bricht etwas (Story ohne Feature, Verweis ins Leere, doppelte Nummer),
  schreibt der Lauf nichts und schlägt fehl.

  Aufruf: pnpm --filter @nw/registry anforderungen -- --umsetzung VTT/Umsetzung.md
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leseAnforderungen, schreibeDatei } from './stories-lib.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HIER, '..', '..', '..');
const argv = process.argv.slice(2).filter((a) => a !== '--');
const umsetzungAt = argv.indexOf('--umsetzung');
/* Ein relativer Pfad meint das Repo, nicht das Paket — pnpm läuft in
   packages/registry, der Aufruf steht in CLAUDE.md vom Wurzelverzeichnis aus. */
const UMSETZUNG = umsetzungAt >= 0 ? resolve(REPO, argv[umsetzungAt + 1] ?? '') : null;
const VTT = join(REPO, 'VTT');

const { epics, features, stories, fehler } = leseAnforderungen(REPO);
if (fehler.length) {
  console.error(`${fehler.length} Fehler in den Anforderungen:\n  ` + fehler.join('\n  '));
  process.exit(1);
}
const heute = new Date().toISOString().slice(0, 10);
const zelle = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const name = (datei) => datei.replace(/\.md$/, '');
const E = new Map(epics.map((e) => [e.id, e]));
const F = new Map(features.map((f) => [f.id, f]));
const storiesVon = (fid) => stories.filter((s) => s.featureId === fid);
const featuresVon = (eid) => features.filter((f) => f.epicId === eid);
const punkte = (liste) => liste.reduce((n, s) => n + (Number(s.aufwand) || 0), 0);
const zaehle = (liste, k) => liste.reduce((m, s) => ((m[s[k]] = (m[s[k]] ?? 0) + 1), m), {});
const STAENDE = ['steht', 'teils', 'offen', 'ersetzt', 'verworfen'];
const standZeile = (liste) => {
  const z = zaehle(liste, 'stand');
  return STAENDE.filter((s) => z[s]).map((s) => `${z[s]} ${s}`).join(' · ');
};
/* Eine Story ohne Satz ist noch die alte Anforderung (vor T-154). */
const formuliert = (s) => /^\*\*Als\*\*/.test(s.satz);

/* --- Listen in Epic- und Feature-Notizen ------------------------------- */
function setzeListe(datei, zeilen) {
  const pfad = join(VTT, datei);
  const text = readFileSync(pfad, 'utf8');
  const block = ['<!-- stories:anfang — erzeugt von anforderungen.mjs, nicht von Hand ändern -->', ...zeilen, '<!-- stories:ende -->'].join('\n');
  const neu = /<!-- stories:anfang[\s\S]*?<!-- stories:ende -->/.test(text)
    ? text.replace(/<!-- stories:anfang[\s\S]*?<!-- stories:ende -->/, block)
    : text.trimEnd() + '\n\n' + block + '\n';
  if (neu !== text) writeFileSync(pfad, neu);
}
for (const f of features) {
  const ss = storiesVon(f.id);
  setzeListe(join('Features', f.datei), [
    `${ss.length} Stories · ${punkte(ss)} Punkte · ${standZeile(ss)}`, '',
    '| Story | Rolle | Prio | Stand |', '|---|---|---|---|',
    ...ss.map((s) => `| [[${s.id}]] ${zelle(s.title)} | ${s.rolle ?? '–'} | ${s.prio ?? '–'} | ${s.stand} |`),
  ]);
}
/* Wo ein Epic wohnt (T-156): Arten, Kanten, Code und Doku stehen als
   Eigenschaften an der Epic-Notiz; daraus wird hier der Weg vom Überblick
   bis in den Code. `basis` führt vom Ort der Seite zur Wurzel des Repos. */
const typAnker = new Set(
  [...readFileSync(join(REPO, 'docs', 'Artikeltypen.md'), 'utf8').matchAll(/^### (\w+)$/gm)].map((m) => m[1]),
);
const pfadLink = (p, basis) => `[${p.replace(/^docs\//, '')}](${basis}${p.includes(' ') ? encodeURI(p) : p})`;
function woEsWohnt(e, basis, story) {
  const z = [];
  const arten = (e.arten ?? []).map((a) => (typAnker.has(a) ? `[${a}](${basis}docs/Artikeltypen.md#${a.toLowerCase()})` : `\`${a}\``));
  if (arten.length) z.push(`**Arten:** ${arten.join(', ')}`);
  if (e.kanten?.length) z.push(`**Kanten:** ${e.kanten.map((k) => `\`${k}\``).join(', ')}`);
  if (e.code?.length) z.push(`**Code:** ${e.code.map((c) => `\`${c}\``).join(', ')}`);
  if (e.doku?.length) z.push(`**Erklärt in:** ${e.doku.map((d) => pfadLink(d, basis)).join(', ')}`);
  const offen = stories.filter((s) => s.epicId === e.id && ['offen', 'teils'].includes(s.stand) && Number(s.prio) <= 3);
  if (offen.length) z.push(`**Offen mit Prio 1–3:** ${offen.map((s) => `${story(s.id)} ${zelle(s.title)} (${s.stand})`).join(' · ')}`);
  z.push('**Aufgaben und offene Entscheidungen:** im Projektbrett, je Aufgabe mit ihren Stories.');
  return z.flatMap((l) => [l, '']).slice(0, -1);
}
for (const e of epics) {
  const fs = featuresVon(e.id);
  setzeListe(join('Epics', e.datei), [
    '| Feature | Stories | Punkte | Stand |', '|---|---|---|---|',
    ...fs.map((f) => { const ss = storiesVon(f.id); return `| [[${name(f.datei)}]] — ${zelle(f.beschreibung)} | ${ss.length} | ${punkte(ss)} | ${standZeile(ss)} |`; }),
    '', '### Wo es wohnt', '',
    ...woEsWohnt(e, '../../', (id) => `[[${id}]]`),
  ]);
}

/* --- VTT/Requirements.md ---------------------------------------------- */
const kopf = (tags, titel) => ['---', `tags: [${tags}]`, 'status: derived', `updated: ${heute}`, '---', '', `# ${titel}`, ''];
const hinweis = [
  '> [!info] Erzeugt aus den Notizen',
  '> Quelle sind die Story-Notizen in `VTT/Stories/`, die Features in `VTT/Features/`, die Epics in `VTT/Epics/`.',
  '> `pnpm --filter @nw/registry anforderungen -- --umsetzung VTT/Umsetzung.md` schreibt diese Seite neu — von Hand geändert wird die Notiz, nicht die Seite.',
  '',
];
{
  const z = [...kopf('vtt, requirements, registry', 'Requirements Registry'), ...hinweis];
  z.push('Alle Anforderungen als **User Stories** (T-154, E-048 a): je Story eine Notiz `REQ-nnn`, je Story ein **Feature** (eine Funktion, eine Artikelart oder eine Ansicht), je Feature ein **Epic** (ein Funktionsbereich, siehe [[Areas]]). **Nummern sind unveränderlich**: fortlaufend, nie neu vergeben, ohne Bedeutung. Was wegfällt, bleibt mit `dropped` stehen und nennt, was es ersetzt (`ersetztDurch`) oder warum nicht.');
  z.push('');
  z.push('**Vorrang (D42, 7.10.2026):** was der Tisch von Nebelwacht braucht, vor dem, was ein beliebiger Tisch brauchen könnte; die Spalte *Prio* bleibt, der Vorrang gilt bei gleicher Prio. Einschneidende Änderungen entscheidet die Verwaltung.');
  z.push('');
  z.push('**Ein neuer Wunsch** wird zuerst eine Story oder ändert eine bestehende (bzw. setzt sie auf `dropped`); Aufgaben im Projektbrett hängen an Stories. Ablauf: [CONTRIBUTING.md](../CONTRIBUTING.md#anforderungen-als-user-stories).');
  z.push('');
  z.push('## Skalen');
  z.push('- **Rolle** Spieler · Spielleitung · Mitleitung · Zuschauer · Verwaltung');
  z.push('- **Prio** 1 Gerüst · 2 erster Einsatz am Tisch · 3 volle v1.0 · 4 Ausbau · 5 Ideenparkplatz');
  z.push('- **Aufwand** Fibonacci-Punkte: 1 ≈ ein Abend · 2 · 3 ≈ zwei Abendwochen · 5 · 8 ≈ ein Monat+ · 13 = vorher teilen');
  z.push('- **Status** idea · defined · planned · in progress · done · dropped — folgt dem **Stand** (steht → done, teils → in progress, ersetzt/verworfen → dropped)');
  z.push('- **Stand** steht · teils · offen · ersetzt · verworfen — ein Urteil über das Repo, mit Anmerkung in `standNotiz`');
  z.push('- **Phase** prep · play · both — **Wert** enables · efficiency — **Vorbereitung** none · low · high — **v1** full · minimal · stub · later ([[Scope v1]])');
  z.push('');
  z.push('## Übersicht');
  z.push('');
  z.push('| Prio | Stories | Punkte | Stand |');
  z.push('|---|---|---|---|');
  for (const p of [1, 2, 3, 4, 5]) {
    const ss = stories.filter((s) => Number(s.prio) === p);
    z.push(`| ${p} | ${ss.length} | ${punkte(ss)} | ${standZeile(ss)} |`);
  }
  z.push(`| **Zusammen** | **${stories.length}** | **${punkte(stories)}** | ${standZeile(stories)} |`);
  z.push('');
  const offen = stories.filter((s) => !formuliert(s) && s.status !== 'dropped').length;
  if (offen) z.push(`${offen} Stories tragen noch den alten Wortlaut und sind als Story zu formulieren.`, '');
  z.push('## Register');
  z.push('');
  z.push('| ID | Story | Rolle | Feature | Prio | Aufwand | Status | Stand |');
  z.push('|---|---|---|---|---|---|---|---|');
  for (const s of stories) {
    const f = F.get(s.featureId);
    z.push(`| [[${s.id}]] | ${zelle(s.title)} | ${s.rolle ?? '–'} | [[${name(f.datei)}\\|${zelle(f.title)}]] | ${s.prio ?? '–'} | ${s.aufwand ?? '–'} | ${s.status} | ${s.stand} |`);
  }
  z.push('');
  z.push('## Verlauf');
  z.push('- **0.9** (2026-10-14): Umstellung auf User Stories (T-154): 12 Epics, Features, je Story eine Notiz; REQ-236 … REQ-257 aus dem Projektbrett nachgetragen, REQ-258 ff. aus der Ernte aller Gespräche. Die Tabelle wird seither erzeugt.');
  z.push('- **0.1 … 0.8** (2026-08-28 … 2026-10-13): eine von Hand gepflegte Tabelle — im Git-Verlauf dieser Datei.');
  schreibeDatei(join(VTT, 'Requirements.md'), z.join('\n'));
}

/* --- VTT/Requirements by Epic.md --------------------------------------- */
{
  const z = [...kopf('vtt, requirements, view', 'Requirements by Epic'), ...hinweis];
  z.push('Sprung: ' + epics.map((e) => `[[#${e.id} ${e.title}]]`).join(' · '));
  z.push('');
  for (const e of epics) {
    const ss = stories.filter((s) => s.epicId === e.id);
    z.push(`## ${e.id} ${e.title}`, '');
    z.push(`${ss.length} Stories · ${punkte(ss)} Punkte · ${standZeile(ss)} — [[${name(e.datei)}]]`, '');
    for (const f of featuresVon(e.id)) {
      const fs = storiesVon(f.id);
      z.push(`### ${f.id} ${f.title}`, '', `${zelle(f.beschreibung)} — [[${name(f.datei)}]]`, '');
      z.push('| ID | Story | Rolle | Prio | Aufwand | Stand |', '|---|---|---|---|---|---|');
      for (const s of fs.slice().sort((a, b) => (a.prio ?? 9) - (b.prio ?? 9) || a.id.localeCompare(b.id))) {
        z.push(`| [[${s.id}]] | ${zelle(s.title)} | ${s.rolle ?? '–'} | ${s.prio ?? '–'} | ${s.aufwand ?? '–'} | ${s.stand} |`);
      }
      z.push('');
    }
  }
  schreibeDatei(join(VTT, 'Requirements by Epic.md'), z.join('\n'));
}

/* --- VTT/Areas.md: die Epics ------------------------------------------ */
{
  const z = ['---', 'tags: [vtt, epics, view]', 'aliases: [Epics]', 'status: derived', `updated: ${heute}`, '---', '', '# Epics', '', ...hinweis];
  z.push('Die Funktionsbereiche von früher sind die **Epics** (E-049): je Epic ein Bereich mit seinem Umfang, darin die Features — einzelne Funktionen, Artikelarten oder Ansichten. Die Bereiche der App (World, Story, Rules, Play, Register …) sind Features in ihrem Epic, z. B. „Bereich World“ in Welt & Lore. Der Querschnitt (früher „Cross-cutting“) ist auf die passenden Epics verteilt.');
  z.push('');
  z.push('| Epic | Umfang | Features | Stories | Punkte | Stand |');
  z.push('|---|---|---|---|---|---|');
  for (const e of epics) {
    const ss = stories.filter((s) => s.epicId === e.id);
    z.push(`| [[${name(e.datei)}]] | ${zelle(e.umfang)} | ${featuresVon(e.id).length} | ${ss.length} | ${punkte(ss)} | ${standZeile(ss)} |`);
  }
  schreibeDatei(join(VTT, 'Areas.md'), z.join('\n'));
}

/* --- docs/Anforderungen.md -------------------------------------------- */
const z = [];
const w = (s = '') => z.push(s);
w('# Anforderungen — was gefordert war und was steht');
w();
w(`Stand ${heute}. Jede Story aus dem Vault (\`VTT/Stories/\`, gegliedert in Epics und Features), mit dem Stand im Repo.`);
w('Erzeugt von `packages/registry/scripts/anforderungen.mjs`; der Stand ist ein Urteil und steht in der Story-Notiz');
w('(`stand`, `standNotiz`) — wer ihn anders sieht, ändert die Notiz und lässt das Skript laufen.');
w();
w('| Stand | Heisst |');
w('|---|---|');
w('| **steht** | gebaut, in der Form der Anforderung oder einer gleichwertigen |');
w('| **teils** | ein Teil steht; was fehlt, steht in der Anmerkung |');
w('| **offen** | nichts davon steht |');
w('| **ersetzt** | anders gelöst als gefordert, mit Absicht — die Anmerkung sagt wie |');
w('| **verworfen** | entschieden gegen die Anforderung |');
w();
w(`Zusammen: ${standZeile(stories)} — ${stories.length} Stories in ${features.length} Features und ${epics.length} Epics.`);
w();
w('| Epic | Stories | Stand |');
w('|---|---|---|');
for (const e of epics) {
  const ss = stories.filter((s) => s.epicId === e.id);
  w(`| [${e.id} ${e.title}](#${(e.id + ' ' + e.title).toLowerCase().replace(/[^a-z0-9äöüß -]/g, '').replace(/ /g, '-')}) | ${ss.length} | ${standZeile(ss)} |`);
}
w();
for (const e of epics) {
  w(`## ${e.id} ${e.title}`);
  w();
  w(e.umfang);
  w();
  for (const l of woEsWohnt(e, '../', (id) => id)) w(l);
  w();
  for (const f of featuresVon(e.id)) {
    w(`### ${f.id} ${f.title}`);
    w();
    w('| ID | Story | Prio | Stand | Anmerkung |');
    w('|---|---|---|---|---|');
    for (const s of storiesVon(f.id)) w(`| ${s.id} | ${zelle(s.title)} | ${s.prio ?? '–'} | **${s.stand}** | ${zelle(s.standNotiz)} |`);
    w();
  }
}
w('## Was offen ist und wehtut');
w();
w('Offene und teilweise Stories mit Priorität 1 bis 3, nach Priorität:');
w();
for (const s of stories.filter((s) => ['offen', 'teils'].includes(s.stand) && Number(s.prio) <= 3)
  .sort((a, b) => a.prio - b.prio || a.id.localeCompare(b.id))) {
  w(`- **${s.id}** (${s.prio}, ${s.stand}, ${E.get(s.epicId).title}) — ${s.title}${s.standNotiz ? ` — *${s.standNotiz}*` : ''}`);
}
w();
schreibeDatei(join(REPO, 'docs', 'Anforderungen.md'), z.join('\n'));
console.log(`geschrieben: ${stories.length} Stories, ${features.length} Features, ${epics.length} Epics`);

if (UMSETZUNG) {
  /* Dieselbe Übersicht als Vault-Notiz: Frontmatter davor, der Rest wörtlich. */
  const vorn = [
    '---', 'tags: [vtt, requirements, view, umsetzung]', 'status: derived', `updated: ${heute}`, 'source: ../docs/Anforderungen.md', '---', '',
    '> [!info] Erzeugt aus den Story-Notizen',
    '> `pnpm --filter @nw/registry anforderungen -- --umsetzung VTT/Umsetzung.md` im Repo schreibt diese Notiz neu.',
    '> Wer einen Stand anders sieht, ändert ihn in der Story-Notiz (`VTT/Stories/REQ-nnn.md`).',
    '',
  ];
  const koerper = z.map((l) => l.replace(/^\| (REQ-\d{3}) \|/, '| [[$1]] |').replace(/^- \*\*(REQ-\d{3})\*\*/, '- **[[$1]]**'));
  schreibeDatei(UMSETZUNG, vorn.concat(koerper).join('\n'));
  console.log(`geschrieben: ${UMSETZUNG}`);
}
