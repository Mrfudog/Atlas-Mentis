/*
  Die Anforderungen als Notizen im Vault (T-154, E-048 a): je Epic, Feature
  und Story eine Notiz in VTT/Epics, VTT/Features, VTT/Stories. Die Notizen
  sind die Quelle; was daraus folgt (VTT/Requirements.md, Requirements by
  Epic, Areas, docs/Anforderungen.md, Umsetzung), erzeugt `anforderungen.mjs`.

  Das Frontmatter ist ein kleiner Ausschnitt aus YAML: `schlüssel: wert` je
  Zeile, Texte und Listen in JSON-Schreibweise (gültiges YAML, und Obsidian
  liest es als Eigenschaften). Ein YAML-Paket bräuchte es dafür nicht — und
  ein Leser, der mehr versteht, als der Schreiber schreibt, liest eines Tages
  etwas, das niemand so gemeint hat.
*/
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const ROLLEN = ['Spieler', 'Spielleitung', 'Mitleitung', 'Zuschauer', 'Verwaltung'];
export const STAENDE = ['steht', 'teils', 'offen', 'ersetzt', 'verworfen'];
export const STATUS = ['idea', 'defined', 'planned', 'in progress', 'done', 'dropped'];

/* Reihenfolge der Schlüssel im Frontmatter; was hier fehlt, kommt danach. */
const ORDNUNG = {
  epic: ['id', 'title', 'typ', 'umfang', 'frueher', 'tags'],
  feature: ['id', 'title', 'typ', 'epic', 'beschreibung', 'tags'],
  story: ['id', 'title', 'typ', 'epic', 'feature', 'rolle', 'prio', 'aufwand', 'v1', 'v1pts',
    'phase', 'wert', 'vorbereitung', 'abhaengig', 'status', 'stand', 'standNotiz',
    'ersetztDurch', 'herkunft', 'tags'],
};

export function leseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const zeile of m[1].split('\n')) {
    const k = zeile.match(/^([A-Za-z0-9_]+):\s?(.*)$/);
    if (!k) continue;
    const roh = k[2].trim();
    let wert = roh;
    if (roh === '') wert = null;
    else if (roh.startsWith('"') || roh.startsWith('[')) wert = JSON.parse(roh);
    else if (/^-?\d+(\.\d+)?$/.test(roh)) wert = Number(roh);
    fm[k[1]] = wert;
  }
  return { fm, body: text.slice(m[0].length) };
}

function wertText(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return '[' + v.map((x) => JSON.stringify(x)).join(', ') + ']';
  return JSON.stringify(v);
}

export function schreibeFrontmatter(fm, typ) {
  const reihe = ORDNUNG[typ] ?? [];
  const keys = [...reihe.filter((k) => k in fm), ...Object.keys(fm).filter((k) => !reihe.includes(k))];
  return '---\n' + keys.map((k) => `${k}: ${wertText(fm[k])}`.trimEnd()).join('\n') + '\n---\n';
}

/* Eine Story-Notiz hat diese Abschnitte, in dieser Reihenfolge:
   Überschrift, der Satz (Als … möchte ich … damit …), Akzeptanzkriterien,
   Anmerkungen, Bisheriger Wortlaut. Nur der Satz und die Kriterien sind
   Pflicht für eine fertige Story; die übrigen dürfen fehlen. */
export function leseStoryBody(body) {
  const teile = { satz: '', akzeptanz: [], anmerkungen: '', wortlaut: '' };
  let ort = 'satz';
  for (const zeile of body.split('\n')) {
    if (/^# /.test(zeile)) continue;
    const h = zeile.match(/^## (.+)$/);
    if (h) {
      ort = { Akzeptanzkriterien: 'akzeptanz', Anmerkungen: 'anmerkungen', 'Bisheriger Wortlaut': 'wortlaut' }[h[1].trim()] ?? 'anmerkungen';
      continue;
    }
    if (ort === 'akzeptanz') {
      const p = zeile.match(/^- (?:\[[ x]\] )?(.*)$/);
      if (p) teile.akzeptanz.push(p[1]);
      else if (zeile.trim() && teile.akzeptanz.length) teile.akzeptanz[teile.akzeptanz.length - 1] += ' ' + zeile.trim();
    } else {
      teile[ort] += zeile + '\n';
    }
  }
  for (const k of ['satz', 'anmerkungen', 'wortlaut']) teile[k] = teile[k].trim();
  teile.wortlaut = teile.wortlaut.replace(/^> ?/gm, '');
  return teile;
}

export function schreibeStory(fm, teile) {
  const z = [schreibeFrontmatter(fm, 'story'), `# ${fm.id} ${fm.title}`, ''];
  z.push(teile.satz || '*Noch als Story zu formulieren.*', '');
  if (teile.akzeptanz?.length) {
    z.push('## Akzeptanzkriterien', '');
    for (const a of teile.akzeptanz) z.push(`- ${a}`);
    z.push('');
  }
  if (teile.anmerkungen) z.push('## Anmerkungen', '', teile.anmerkungen, '');
  if (teile.wortlaut) z.push('## Bisheriger Wortlaut', '', ...teile.wortlaut.split('\n').map((l) => `> ${l}`.trimEnd()), '');
  return z.join('\n');
}

/* Der Satz aus seinen drei Teilen. Ein Ziel beginnt klein („mein Token …“),
   der Nutzen ohne „damit“ — beides setzt der Satz. */
export function satz(rolle, ziel, nutzen) {
  return `**Als** ${rolle} **möchte ich** ${ziel}${nutzen ? `, **damit** ${nutzen}` : ''}.`;
}

/* Ein Link `[[F-012 Name]]` oder `[[F-012 Name|…]]` → `F-012`. */
export function linkId(link) {
  const m = String(link ?? '').match(/\[\[([A-Z]+-\d+)/);
  return m ? m[1] : null;
}

function leseOrdner(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const text = readFileSync(join(dir, f), 'utf8');
    return { datei: f, ...leseFrontmatter(text) };
  });
}

/* Alles einlesen und gegeneinander prüfen. `fehler` sind Brüche
   (Story ohne Feature, Nummer doppelt, Verweis ins Leere); sie lassen den
   Lauf fehlschlagen — eine Übersicht über einen kaputten Bestand sähe aus,
   als stimme er. */
export function leseAnforderungen(repo) {
  const vtt = join(repo, 'VTT');
  const epics = leseOrdner(join(vtt, 'Epics')).map((n) => ({ ...n.fm, datei: n.datei, body: n.body }));
  const features = leseOrdner(join(vtt, 'Features')).map((n) => ({ ...n.fm, datei: n.datei, body: n.body }));
  const stories = leseOrdner(join(vtt, 'Stories')).map((n) => ({ ...n.fm, datei: n.datei, ...leseStoryBody(n.body) }));
  const fehler = [];
  const nach = (liste) => new Map(liste.map((x) => [x.id, x]));
  const E = nach(epics), F = nach(features), S = nach(stories);
  for (const [liste, art] of [[epics, 'Epic'], [features, 'Feature'], [stories, 'Story']]) {
    const gesehen = new Set();
    for (const x of liste) {
      if (!x.id) fehler.push(`${art} ohne id: ${x.datei}`);
      else if (gesehen.has(x.id)) fehler.push(`${art} doppelt: ${x.id}`);
      gesehen.add(x.id);
    }
  }
  for (const f of features) {
    const e = linkId(f.epic);
    if (!E.has(e)) fehler.push(`${f.id}: Epic ${f.epic ?? '(keins)'} gibt es nicht`);
    f.epicId = e;
  }
  for (const s of stories) {
    const f = linkId(s.feature);
    if (!F.has(f)) fehler.push(`${s.id}: Feature ${s.feature ?? '(keins)'} gibt es nicht`);
    s.featureId = f;
    s.epicId = F.get(f)?.epicId ?? null;
    if (linkId(s.epic) !== s.epicId) fehler.push(`${s.id}: Epic ${s.epic} passt nicht zum Feature ${f} (${s.epicId})`);
    if (s.rolle && !ROLLEN.includes(s.rolle)) fehler.push(`${s.id}: Rolle „${s.rolle}“ unbekannt`);
    if (!STAENDE.includes(s.stand)) fehler.push(`${s.id}: Stand „${s.stand}“ unbekannt`);
    if (!STATUS.includes(s.status)) fehler.push(`${s.id}: Status „${s.status}“ unbekannt`);
    for (const d of [...(s.abhaengig ?? []), ...(s.ersetztDurch ?? [])]) {
      if (!S.has(d)) fehler.push(`${s.id}: verweist auf ${d}, das es nicht gibt`);
    }
    if (s.status === 'dropped' && !s.ersetztDurch?.length && !s.standNotiz) {
      fehler.push(`${s.id}: dropped ohne ersetztDurch und ohne Begründung`);
    }
  }
  epics.sort((a, b) => a.id.localeCompare(b.id));
  features.sort((a, b) => a.id.localeCompare(b.id));
  stories.sort((a, b) => a.id.localeCompare(b.id));
  return { epics, features, stories, fehler };
}

export function schreibeDatei(pfad, text) {
  writeFileSync(pfad, text.endsWith('\n') ? text : text + '\n');
}
