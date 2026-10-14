/**
 * **Abenteuer als eigene Ebene** (T-082, REQ-240, E-018).
 *
 * Ein Abenteuer aus 5e.tools ist ein Textbaum: Kapitel (`section` auf der
 * obersten Stufe), darin benannte Abschnitte, darin Vorlesetext, Karten
 * und Marken, die auf Kreaturen, Gegenstände und Zauber zeigen. Daraus
 * wird hier, in der Ebene des Abenteuers (`kind: 'adventure'`):
 *
 *  - das Abenteuer selbst als `Story` mit `kind: 'adventure'`,
 *  - je Kapitel ein `Arc` (E-026), `partOf` das Abenteuer — dieselbe Art
 *    wie ein Arc der eigenen Kampagne, damit es sich als Ganzes dorthin
 *    übernehmen lässt,
 *  - je Abschnitt eine `Scene`, `partOf` ihr Kapitel oder ihr Abschnitt —
 *    ein Abschnitt, der selbst nummerierte Räume hat („Cragmaw Hideout"
 *    mit „1. Cave Mouth" …), bekommt sie als eigene Szenen;
 *  - der Vorlesetext als `ReadAloud.readaloud`, der übrige Text als Prosa;
 *  - je Karte (`imageType: 'map'`) eine `Map`, `mapOf` ihr Abschnitt. Das
 *    Bild bleibt bei 5e.tools, hier steht nur seine Adresse. **Eine Karte
 *    steht immer an einer Szene** (E-026): liegt sie im Text des Kapitels
 *    selbst, bekommt sie eine eigene Szene (`mode: 'exploration'`, `partOf`
 *    das Kapitel) — so lässt sie sich wie jede Szene einzeln übernehmen;
 *  - je Abschnitt, der Kreaturen mit Anzahl nennt („two {@creature
 *    goblin}"), eine `Encounter`, `partOf` der Abschnitt (der damit eine
 *    Szene mit `mode: 'encounter'` ist), mit einer Kante
 *    `participates` je Teilnehmer auf den Statblock aus dem Buch.
 *
 * **Verweise, keine Kopien:** eine Kreatur, ein Gegenstand, ein Zauber im
 * Text ist ein `[[Verweis]]` auf den Buchartikel, wie überall im Importer.
 * Die NSC eines Abenteuers stehen in 5e.tools unter seiner Quelle und
 * liegen darum schon in seiner Ebene.
 *
 * **Leitungstext:** ein Abenteuer verrät, was die Spielenden erst finden
 * sollen. Darum steht jeder Artikel hier auf `audience: 'gm'`; was die
 * Runde sehen soll, gibt die Leitung frei — am Original oder an ihrer
 * Fassung. 5e.tools kennzeichnet keine Geheimnisse eigens; `Secrets` bleibt
 * leer, bis die Leitung etwas hineinschreibt.
 *
 * **Anpassen** heisst eine Fassung in der Kampagnenebene, die das Original
 * überschreibt (`overrides`, E-018) — das macht der Server, nicht der
 * Importer. Das Original bleibt, wie 5e.tools es bringt.
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import type { Abenteuer } from '../lesen.js';
import { markdown } from '../text.js';
import type { TextKontext } from '../text.js';
import type { Werkbank } from '../werkbank.js';
import { zaehle } from '../werkbank.js';

/** Wo die Bilder von 5e.tools liegen; der Pfad im Datenstand hängt daran. */
export const BILD_ADRESSE = 'https://5e.tools/img/';

/** Kapitel, die kein Spiel sind. */
const OHNE_KAPITEL = /^credits$/i;

/** Ein nummerierter Raum: „1. Cave Mouth", „12a. Vault", „A3. Gate". */
const RAUM = /^([A-Z]{0,2}\d+[a-z]?)\.\s/;

const ZAHLWORT: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, 'a pair of': 2, 'a dozen': 12,
};

/** Mehr Teilnehmer je Art legt der Importer nicht an — „a hundred zombies" ist eine Horde. */
const HOECHSTENS = 20;

/** Die Arten, die als Abschnitt gelesen werden. */
const ABSCHNITT = new Set(['entries', 'section']);

const kl = (s: unknown) => String(s ?? '').trim().toLowerCase();

interface Knotenpunkt {
  /** Der Artikel dieses Knotens. */
  ent: Entity;
  /** Die Einträge, die in den Text dieses Artikels gehören (ohne eigene Szenen). */
  inhalt: unknown[];
}

/** Hat dieser Eintrag Kinder, die Räume sind? Dann werden sie eigene Szenen. */
function hatRaeume(e: Knoten): boolean {
  return kinder(e).some((k) => RAUM.test(name(k)));
}

function kinder(e: Knoten): Knoten[] {
  return (Array.isArray(e['entries']) ? e['entries'] : []).filter(
    (k): k is Knoten => !!k && typeof k === 'object' && !Array.isArray(k),
  );
}

function name(e: Knoten): string {
  return typeof e['name'] === 'string' ? e['name'].trim() : '';
}

/** Ein Abschnitt, der eine eigene Szene wird: benannt und von einer Abschnittsart. */
function istAbschnitt(k: unknown): k is Knoten {
  return !!k && typeof k === 'object' && !Array.isArray(k) && ABSCHNITT.has(String((k as Knoten)['type'] ?? 'entries')) && !!name(k as Knoten);
}

/**
 * Den Vorlesetext herausnehmen, in jeder Tiefe, und die Karten
 * einsammeln. Was übrig bleibt, ist der Text des Artikels.
 */
function zerlege(liste: unknown[], vorlesen: unknown[][], karten: Knoten[]): unknown[] {
  const out: unknown[] = [];
  for (const x of liste) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) {
      out.push(x);
      continue;
    }
    const o = x as Knoten;
    const typ = String(o['type'] ?? 'entries');
    if (typ === 'insetReadaloud') {
      vorlesen.push(Array.isArray(o['entries']) ? (o['entries'] as unknown[]) : []);
      continue;
    }
    if (typ === 'image' || typ === 'gallery') {
      const bilder = typ === 'gallery' ? (Array.isArray(o['images']) ? (o['images'] as Knoten[]) : []) : [o];
      karten.push(...bilder.filter((b) => b && b['imageType'] === 'map'));
      continue;
    }
    if (Array.isArray(o['entries'])) {
      out.push({ ...o, entries: zerlege(o['entries'] as unknown[], vorlesen, karten) });
    } else out.push(o);
  }
  return out;
}

/** Alle Zeichenketten eines Teilbaums, für die Suche nach Kreaturen. */
function zeichenketten(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) for (const y of x) zeichenketten(y, out);
  else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x as Knoten)) if (k === 'entries' || k === 'items' || k === 'entry') zeichenketten(v, out);
  }
  return out;
}

/**
 * Die Kreaturen mit Anzahl in einem Text: „Two {@creature goblin||goblins}",
 * „a {@creature bugbear} named Klarg". Ohne Zahlwort davor zählt eine
 * Kreatur nicht — „the dwarf {@creature Gundren Rockseeker|LMoP}" ist eine
 * Erwähnung und kein Kampf.
 */
export function kreaturenMitAnzahl(texte: string[]): { name: string; quelle: string; anzahl: number }[] {
  const out = new Map<string, { name: string; quelle: string; anzahl: number }>();
  const worte = Object.keys(ZAHLWORT).sort((a, b) => b.length - a.length).join('|');
  const re = new RegExp(`(?:^|[\\s(])(\\d+|${worte})\\s+\\{@creature ([^}|]+)(?:\\|([^}|]*))?[^}]*\\}`, 'gi');
  for (const t of texte) {
    for (const m of t.matchAll(re)) {
      const wort = (m[1] ?? '').toLowerCase();
      const anzahl = /^\d+$/.test(wort) ? Number(wort) : (ZAHLWORT[wort] ?? 0);
      if (!anzahl) continue;
      const n = (m[2] ?? '').trim();
      const q = (m[3] ?? '').trim();
      const k = `${kl(n)}|${kl(q)}`;
      const alt = out.get(k);
      out.set(k, { name: n, quelle: q, anzahl: Math.min(HOECHSTENS, (alt?.anzahl ?? 0) + anzahl) });
    }
  }
  return [...out.values()];
}

/** Ein Raster aus 5e.tools als unsere Kartenfelder. */
function raster(wb: Werkbank, karte: Entity, grid: Knoten | undefined): void {
  if (!grid) return;
  const typ = String(grid['type'] ?? '');
  const form = typ === 'square' ? 'square' : typ.startsWith('hex') ? 'hex' : typ === 'none' ? 'none' : '';
  wb.feld(karte, 'Map', 'gridShape', form);
  if (form === 'square') wb.feld(karte, 'Map', 'kind', 'battle');
  if (form === 'hex') wb.feld(karte, 'Map', 'kind', 'region');
  if (form && form !== 'none') {
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    wb.feld(karte, 'Map', 'gridSize', n(grid['size']));
    wb.feld(karte, 'Map', 'gridOffsetX', n(grid['offsetX']));
    wb.feld(karte, 'Map', 'gridOffsetY', n(grid['offsetY']));
  }
}

/**
 * Ein Abenteuer in seine Ebene. Läuft nach dem Füllen der übrigen Arten:
 * jeder Verweis im Text findet dann sein Ziel. Gibt die angelegten Artikel
 * zurück (für Tests und den Bericht).
 */
export function abenteuer(wb: Werkbank, a: Abenteuer): Entity[] {
  const angelegt: Entity[] = [];
  const b = wb.artBericht('adventureData');
  b.gelesen += 1;
  /* Die Quelle ist die des Kopfs: ein Abenteuer in einem Quellenbuch
     („Theros: No Silent Secret" in MOT) liegt in dessen Ebene, wie seine
     Kreaturen. */
  const quelle = String(a.kopf['source'] ?? a.id);
  const kopfName = String(a.kopf['name'] ?? a.id);
  const pfade = new Set<string>();
  /* Die Herkunft eines Artikels ist sein Pfad aus Namen — die Ids von
     5e.tools (`01e`) zählen nur durch und wandern, wenn ein Abschnitt
     dazukommt. Ein zweiter gleicher Pfad bekommt eine Nummer. */
  const herkunft = (teile: string[]): string => {
    let p = `adventure|${kl(a.id)}|${teile.map(kl).join('|')}`;
    for (let i = 2; pfade.has(p); i += 1) p = `${p.replace(/#\d+$/, '')}#${i}`;
    pfade.add(p);
    return p;
  };
  const neu = (typ: string, n: string, teile: string[], seite?: unknown, peg?: string): Entity => {
    const ent = wb.anlegen(typ, n, herkunft(teile), { source: quelle, ...(seite !== undefined ? { page: seite } : {}) }, peg);
    wb.feld(ent, 'Visibility', 'audience', 'gm');
    zaehle(b.artikel, typ);
    angelegt.push(ent);
    return ent;
  };

  /* 1. Das Abenteuer selbst. */
  const stufe = a.kopf['level'] as Knoten | undefined;
  const ganz = neu('Story', kopfName, []);
  wb.feld(ganz, 'Story', 'kind', 'adventure');
  const kopfText = [
    stufe && stufe['start'] !== undefined ? `Levels ${String(stufe['start'])}–${String(stufe['end'] ?? stufe['start'])}.` : '',
    a.kopf['storyline'] ? `Storyline: ${String(a.kopf['storyline'])}.` : '',
    a.kopf['published'] ? `Published ${String(a.kopf['published']).slice(0, 10)}.` : '',
  ].filter(Boolean).join(' ');
  wb.feld(ganz, 'Description', 'description', kopfText);

  /* 2. Erster Gang: Kapitel und Abschnitte anlegen, damit `{@area}` jeden
        Abschnitt findet, auch einen, der später im Buch kommt. */
  const knoten: Knotenpunkt[] = [];
  const nachId = new Map<string, Entity>();
  const ordnung = (Array.isArray(a.kopf['contents']) ? (a.kopf['contents'] as Knoten[]) : []);
  const abschnitte = (e: Knoten, eltern: Entity, pfad: string[]): unknown[] => {
    const inhalt: unknown[] = [];
    const raeume = hatRaeume(e) || e['type'] === 'section';
    for (const k of Array.isArray(e['entries']) ? (e['entries'] as unknown[]) : []) {
      /* Eigene Szenen werden: auf Kapitelstufe jeder benannte Abschnitt,
         darunter nur Räume und Unterkapitel. Der Rest ist Text. */
      const eigen = istAbschnitt(k) && (pfad.length === 1 || (raeume && (RAUM.test(name(k)) || k['type'] === 'section')));
      if (!eigen) {
        inhalt.push(k);
        continue;
      }
      const szene = neu('Scene', name(k), [...pfad, name(k)], k['page']);
      wb.kante(szene, 'partOf', eltern.id);
      if (typeof k['id'] === 'string') nachId.set(k['id'], szene);
      knoten.push({ ent: szene, inhalt: abschnitte(k, szene, [...pfad, name(k)]) });
    }
    return inhalt;
  };
  a.daten.forEach((kap, i) => {
    const n = name(kap);
    if (!n || OHNE_KAPITEL.test(n)) {
      if (n) wb.notiz(`Kapitel weggelassen: ${n}`, 'adventureData');
      return;
    }
    const ord = ordnung[i]?.['ordinal'] as Knoten | undefined;
    /* „Part 1: Goblin Arrows" wie bei 5e.tools — ausser der Name sagt es
       schon („Appendix A: Magic Items"). */
    const art = String(ord?.['type'] ?? '').replace(/^./, (c) => c.toUpperCase());
    const titel = ord && art && !n.toLowerCase().startsWith(art.toLowerCase()) ? `${art} ${String(ord['identifier'] ?? '')}: ${n}` : n;
    /* Ein Kapitel ist ein Arc (E-026, REQ-252) — kein Wort an einer Story. */
    const kapitel = neu('Arc', titel, [n], kap['page']);
    wb.kante(kapitel, 'partOf', ganz.id);
    if (typeof kap['id'] === 'string') nachId.set(kap['id'], kapitel);
    knoten.push({ ent: kapitel, inhalt: abschnitte(kap, kapitel, [n]) });
  });

  /* `{@area 2|01e}` findet den Abschnitt in diesem Abenteuer. */
  const basis = wb.ctx;
  const ctx: TextKontext = {
    ...basis,
    finde: (tag, t) => {
      if (tag === 'area') {
        const z = nachId.get(t[0] ?? '');
        return z ? wb.nummer(z) : undefined;
      }
      return basis.finde(tag, t);
    },
  };

  /* 3. Zweiter Gang: Text, Vorlesetext, Karten, Begegnungen. */
  wb.aktuelleArt = 'adventureData';
  for (const { ent, inhalt } of knoten) {
    const vorlesen: unknown[][] = [];
    const karten: Knoten[] = [];
    const rest = zerlege(inhalt, vorlesen, karten);
    wb.prosa(ent, markdown(rest, ctx, 2).trim());
    const vor = vorlesen.map((v) => markdown(v, ctx, 6).trim()).filter(Boolean);
    if (vor.length) {
      wb.feld(ent, 'ReadAloud', 'readaloud', vor.map((value, i) => ({ id: i ? `read${i + 1}` : 'read', value })));
    }

    for (const k of karten) {
      const pfad = (k['href'] as Knoten | undefined)?.['path'];
      if (typeof pfad !== 'string' || !pfad) continue;
      const titel = typeof k['title'] === 'string' && k['title'].trim() ? k['title'].trim() : ent.name;
      const karte = neu('Map', titel, ['map', ent.name, titel]);
      /* An einer Szene hängt die Karte an ihr; im Text eines Kapitels
         bekommt sie ihre eigene (E-026). Deren Id ist die der Karte mit
         `_scene` — so bildet die Migration 041 für schon geladene Karten
         dieselbe, und `--only-new` legt keine zweite an. */
      let ort = ent;
      if (ent.interfaces[0] !== 'Scene') {
        ort = neu('Scene', titel, ['map-scene', ent.name, titel], undefined, `${karte.id}_scene`);
        wb.feld(ort, 'Scene', 'mode', 'exploration');
        wb.kante(ort, 'partOf', ent.id);
      }
      wb.feld(karte, 'Image', 'image', BILD_ADRESSE + pfad.split('/').map(encodeURIComponent).join('/'));
      wb.feld(karte, 'Image', 'caption', [titel, k['credit'] ? `Map by ${String(k['credit'])}` : ''].filter(Boolean).join(' · '));
      wb.feld(karte, 'Image', 'alt', titel);
      raster(wb, karte, k['grid'] as Knoten | undefined);
      wb.kante(karte, 'mapOf', ort.id);
    }

    /* Begegnung nur an einer Szene: ein Kapitel nennt Kreaturen, um sie
       vorzustellen, nicht um sie kämpfen zu lassen. */
    if (ent.interfaces[0] !== 'Scene') continue;
    const wer = kreaturenMitAnzahl(zeichenketten(rest));
    const teilnehmer: { sb: Entity; anzahl: number }[] = [];
    for (const k of wer) {
      const sb = wb.finde('creature', [k.name, k.quelle]);
      if (!sb) {
        wb.ctx.insLeere('creature', `${k.name}|${k.quelle}`);
        continue;
      }
      teilnehmer.push({ sb, anzahl: k.anzahl });
    }
    if (!teilnehmer.length) continue;
    /* Die Peg-Id der Szene ist aus ihrem Pfad gerechnet und bleibt von
       Lauf zu Lauf gleich — die Begegnung damit auch. */
    const kampf = neu('Encounter', ent.name, ['encounter', ent.id]);
    wb.kante(kampf, 'partOf', ent.id);
    wb.feld(ent, 'Scene', 'mode', 'encounter');
    for (const { sb, anzahl } of teilnehmer) {
      for (let i = 1; i <= anzahl; i += 1) {
        wb.kante(kampf, 'participates', sb.id, { label: anzahl > 1 ? `${sb.name} ${i}` : sb.name });
      }
    }
  }
  return angelegt;
}
