/**
 * **Abenteuer als eigene Ebene** (T-082, REQ-240, E-018; T-108, E-029).
 *
 * Ein Abenteuer aus 5e.tools ist ein Textbaum: Kapitel (`section` auf der
 * obersten Stufe), darin benannte Abschnitte, darin Vorlesetext, Karten
 * und Marken, die auf Kreaturen, Gegenstände und Zauber zeigen. Daraus
 * wird hier, in der Ebene des Abenteuers (`kind: 'adventure'`):
 *
 *  - das Abenteuer selbst als `Story` mit `kind: 'adventure'`,
 *  - je Kapitel **zweimal dasselbe** (E-029): ein `Arc` (E-026), `partOf`
 *    das Abenteuer — die Geschichte, die sich als Ganzes in die eigene
 *    Kampagne holen lässt —, und ein `Chapter` (`<Arc>_chapter`,
 *    `chapterOf` der Arc) — die Lesestruktur. Beide zeigen auf dieselben
 *    Szenen; nichts ist verdoppelt;
 *  - je Abschnitt eine `Scene`: auf Kapitelstufe `partOf` der Arc und mit
 *    Rang im Chapter; ein Abschnitt, der selbst nummerierte Räume hat
 *    („Cragmaw Hideout" mit „1. Cave Mouth" …), bekommt sie als eigene
 *    Szenen mit Rang in ihm;
 *  - der Text als **Teile** (E-028, `teile.ts`): Absätze, Überschriften,
 *    Vorlesetexte (`ReadAloudText`), Verweise auf Statblöcke — mit Rang
 *    im Chapter oder in der Szene, an der Stelle, an der sie im Buch stehen.
 *    Einen Vorlesetext holt man so einzeln in die eigene Szene;
 *  - je Karte (`imageType: 'map'`) eine `Map`, `mapOf` ihr Abschnitt. Das
 *    Bild bleibt bei 5e.tools, hier steht nur seine Adresse. **Eine Karte
 *    steht immer an einer Szene** (E-026): liegt sie im Text des Kapitels
 *    selbst, bekommt sie eine eigene Szene (`mode: 'exploration'`, `partOf`
 *    der Arc, mit Rang im Chapter);
 *  - je Abschnitt, der einen Ort beschreibt (ein Raum mit Schlüssel, ein
 *    Abschnitt mit eigener Karte, ein erster Satz „X is a
 *    village …"; benannt nach dem Titel der Karte), ein `Place` (T-175,
 *    `orte.ts`): `describedIn` die Szene,
 *    die Szene `happensAt` ihn, `partOf` der Ort der umgebenden Szene, und
 *    die Karten der Szene `mapOf` auch ihn;
 *  - je Abschnitt, der Kreaturen mit Anzahl nennt („two {@creature
 *    goblin}"), eine `Encounter`, `partOf` der Abschnitt (der damit eine
 *    Szene mit `mode: 'encounter'` ist), mit einer Kante
 *    `participates` je Teilnehmer auf den Statblock aus dem Buch.
 *
 * Die Peg-Ids von Story, Arc, Szene, Karte und Begegnung sind dieselben
 * wie seit T-097: ein Lauf `--only-new` findet jeden schon geladenen
 * Artikel wieder.
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
import {
  bereichAusKarte,
  bereichAusKarten,
  hatRaeume as hatOrtRaeume,
  kartenTitel,
  legeOrtAn,
  klartext,
  listenBereich,
  ortAusKarte,
  ortBefund,
  ortFuerUeberschrift,
  ortKandidat,
  ortsnameAusKarten,
  schluesselBereich,
} from '../orte.js';
import { legeTeileAn } from '../teile.js';
import type { TextKontext } from '../text.js';
import { kapitelTitel } from './buch.js';
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
  const gm = (ent: Entity): void => {
    wb.feld(ent, 'Visibility', 'audience', 'gm');
    angelegt.push(ent);
  };
  const neu = (typ: string, n: string, teile: string[], seite?: unknown, peg?: string): Entity => {
    const ent = wb.anlegen(typ, n, herkunft(teile), { source: quelle, ...(seite !== undefined ? { page: seite } : {}) }, peg);
    zaehle(b.artikel, typ);
    gm(ent);
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

  /* 2. Erster Gang: Kapitel und Szenen anlegen, damit `{@area}` jeden
        Abschnitt findet, auch einen, der später im Buch kommt. Je Kapitel
        ein Arc (die Geschichte, E-026) und ein Chapter (die Lesestruktur,
        E-029); die Szenen gehören beiden. */
  const nachId = new Map<string, Entity>();
  /** Welcher Eintrag welche Szene wurde — der zweite Gang fragt danach. */
  const szeneVon = new Map<Knoten, Entity>();
  /** Je Szene der Text, der ihr selbst gehört (ohne eigene Szenen), für die Begegnung. */
  const inhaltVon = new Map<Entity, unknown[]>();
  const kapitel: { arc: Entity; chapter: Entity; kap: Knoten }[] = [];
  const ordnung = (Array.isArray(a.kopf['contents']) ? (a.kopf['contents'] as Knoten[]) : []);
  /** Der Ort je Szene (T-175). */
  const ortVon = new Map<string, Entity>();
  /** Die Orte nach Name: zwei Karten derselben Gegend sind ein Ort. */
  const ortNachName = new Map<string, Entity>();
  /* **Bereiche** (T-182): ein Abenteuer nennt einen Ort auch über seinen
     Buchstaben. „Map 6.1: Old Bonegrinder (Area O)" steht im ersten Raum
     „O1. Ground Floor", ist aber die Karte des ganzen Bereichs O; und die
     Liste der Gegend („Areas of Barovia") führt „N. Town of Vallaki" — der
     Ort mit der Karte „(Area N)" liegt also in ihr. Nur, was der Text so
     sagt: ein Buchstabe, den zwei Listen führen, verbindet nichts. */
  const bereichsOrt = new Map<string, Entity>();
  const listeVon = new Map<string, Entity | null>();
  /** Dieselbe Liste nach dem Namen hinter dem Buchstaben: „E. Village of Barovia". */
  const listeNachName = new Map<string, Entity | null>();
  const merkeListe = (k: Knoten, ort: Entity): void => {
    const merke = <K>(m: Map<K, Entity | null>, key: K) => {
      const alt = m.get(key);
      m.set(key, alt === undefined || alt === ort ? ort : null);
    };
    for (const x of kinder(k)) {
      const l = listenBereich(name(x));
      if (!l) continue;
      merke(listeVon, l);
      merke(listeNachName, kl(klartext(name(x)).replace(/^[A-Z]{1,2}\.\s+/, '')));
    }
  };
  const abschnitte = (e: Knoten, arc: Entity, pfad: string[], elternOrt?: Entity): unknown[] => {
    const inhalt: unknown[] = [];
    const raeume = hatRaeume(e) || e['type'] === 'section';
    /** Der letzte Ort aus einer Karte auf dieser Stufe (T-175). */
    let nachbarOrt: Entity | undefined;
    /* Eine Bereichskarte in einem Raum dieser Stufe: vorher, damit auch die
       Räume vor ihr in ihm liegen. */
    for (const k of kinder(e)) {
      const bl = schluesselBereich(name(k));
      if (!bl || bereichsOrt.has(bl)) continue;
      const titel = kartenTitel(k['entries']).find((t) => bereichAusKarte(t) === bl);
      const ortName = titel ? ortAusKarte(titel) : undefined;
      if (!ortName) continue;
      const schon = ortNachName.get(ortName.toLowerCase());
      const ort = schon ?? legeOrtAn(wb, ortName, {
        abschnitt: szeneVon.get(e),
        eltern: elternOrt,
        befund: { ort: true, karte: true },
        quelle,
        seite: k['page'],
        art: 'adventureData',
        herkunft: `place|area|${kl(a.id)}|${bl}`,
      });
      if (!schon) {
        gm(ort);
        ortNachName.set(ortName.toLowerCase(), ort);
      }
      bereichsOrt.set(bl, ort);
    }
    for (const k of Array.isArray(e['entries']) ? (e['entries'] as unknown[]) : []) {
      /* Eigene Szenen werden: auf Kapitelstufe jeder benannte Abschnitt,
         darunter nur Räume und Unterkapitel. Der Rest ist Text. */
      const eigen = istAbschnitt(k) && (pfad.length === 1 || (raeume && (RAUM.test(name(k)) || k['type'] === 'section')));
      if (!eigen) {
        inhalt.push(k);
        continue;
      }
      const szene = neu('Scene', name(k), [...pfad, name(k)], k['page']);
      /* Eine Szene auf Kapitelstufe gehört dem Arc (die Geschichte); ein
         Raum hängt mit Rang an seiner Szene — das legt der zweite Gang an. */
      if (pfad.length === 1) wb.kante(szene, 'partOf', arc.id);
      if (typeof k['id'] === 'string') nachId.set(k['id'], szene);
      szeneVon.set(k, szene);
      /* Ist der Abschnitt ein Ort? Vor den Räumen darin, die in ihm liegen. */
      const befund = ortBefund(name(k), k['entries'], { raeume: hatOrtRaeume(k['entries']), karte: ortsnameAusKarten(k['entries']) });
      let ort: Entity | undefined;
      if (befund.ort) {
        const ortName = befund.name ?? name(k);
        const schon = befund.kind === 'Raum' ? undefined : ortNachName.get(ortName.toLowerCase());
        if (schon) ort = schon;
        else {
          /* Ein Raum neben dem Ort seiner Karte liegt in ihm, sonst im Ort seines Bereichs. */
          const bl = schluesselBereich(name(k));
          const eltern = befund.kind === 'Raum' ? (elternOrt ?? nachbarOrt ?? (bl ? bereichsOrt.get(bl) : undefined)) : elternOrt;
          ort = legeOrtAn(wb, ortName, { abschnitt: szene, eltern, befund, quelle, seite: k['page'], art: 'adventureData' });
          gm(ort);
          if (befund.kind !== 'Raum') ortNachName.set(ortName.toLowerCase(), ort);
        }
        if (befund.karte) {
          nachbarOrt = ort;
          const bl = bereichAusKarten(k['entries']);
          if (bl && !bereichsOrt.has(bl)) bereichsOrt.set(bl, ort);
        }
        if (befund.kind !== 'Raum') merkeListe(k, ort);
        wb.kante(szene, 'happensAt', ort.id);
        ortVon.set(szene.id, ort);
      } else if (befund.kandidat) ortKandidat(wb, 'adventureData');
      /* Eine Liste („Areas of Vallaki") ist kein Ort; ihre Räume liegen im
         Ort ihres Nachbarn mit der Karte („Approaching the Town" → Vallaki). */
      inhaltVon.set(szene, abschnitte(k, arc, [...pfad, name(k)], ort ?? elternOrt ?? nachbarOrt));
    }
    return inhalt;
  };
  a.daten.forEach((kap, i) => {
    const n = name(kap);
    if (!n || OHNE_KAPITEL.test(n)) {
      if (n) wb.notiz(`Kapitel weggelassen: ${n}`, 'adventureData');
      return;
    }
    const { titel, ordinal } = kapitelTitel(n, ordnung[i]?.['ordinal'] as Knoten | undefined);
    /* Ein Kapitel ist ein Arc (E-026, REQ-252) — kein Wort an einer Story. */
    const arc = neu('Arc', titel, [n], kap['page']);
    wb.kante(arc, 'partOf', ganz.id);
    if (typeof kap['id'] === 'string') nachId.set(kap['id'], arc);
    /* … und ein Chapter (E-029): dasselbe Kapitel zum Lesen. Seine Id ist
       die des Arcs mit `_chapter` — so bildet die Migration 046 für schon
       geladene Kapitel dieselbe, und `--only-new` legt keines zweimal an. */
    const chapter = neu('Chapter', titel, ['chapter', n], kap['page'], `${arc.id}_chapter`);
    wb.feld(chapter, 'Chapter', 'ordinal', ordinal);
    wb.kante(chapter, 'chapterOf', arc.id);
    abschnitte(kap, arc, [n]);
    kapitel.push({ arc, chapter, kap });
  });
  /* Ein Bereich liegt in der Gegend, deren Liste seinen Buchstaben führt —
     wenn er nicht schon woanders liegt und die Gegend nicht in ihm. */
  const orteNachId = new Map([...ortNachName.values()].map((o) => [o.id, o]));
  const inGegend: [Entity, Entity | null | undefined][] = [
    ...[...bereichsOrt].map(([bl, ort]) => [ort, listeVon.get(bl)] as [Entity, Entity | null | undefined]),
    ...[...ortNachName].map(([n, ort]) => [ort, listeNachName.get(n)] as [Entity, Entity | null | undefined]),
  ];
  for (const [ort, gegend] of inGegend) {
    if (!gegend || gegend === ort || (ort.relations ?? []).some((r) => r.type === 'partOf')) continue;
    let x: Entity | undefined = gegend;
    for (let i = 0; x && x !== ort && i < 20; i += 1) {
      const hoch: string | undefined = (x.relations ?? []).find((r) => r.type === 'partOf')?.to;
      x = hoch ? orteNachId.get(hoch) : undefined;
    }
    if (x === ort) continue;
    wb.kante(ort, 'partOf', gegend.id);
  }

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

  /* 3. Zweiter Gang: der Text als Teile (E-028) — Absätze, Vorlesetexte,
        Überschriften, Verweise, die Szenen an ihrer Stelle; dazu Karten. */
  wb.aktuelleArt = 'adventureData';
  for (const { arc, chapter, kap } of kapitel) {
    const bild = (k: Knoten, ganzes: Entity): Entity | undefined => {
      if (k['imageType'] !== 'map') return undefined;
      const pfad = (k['href'] as Knoten | undefined)?.['path'];
      if (typeof pfad !== 'string' || !pfad) return undefined;
      const imKapitel = ganzes.id === chapter.id;
      /* Im Kapiteltext heisst der Ort wie der Arc — so rechnete T-097 die
         Herkunft, und die Peg-Ids bleiben. */
      const ortName = imKapitel ? arc.name : ganzes.name;
      const titel = typeof k['title'] === 'string' && k['title'].trim() ? k['title'].trim() : ortName;
      const karte = neu('Map', titel, ['map', ortName, titel]);
      /* An einer Szene hängt die Karte an ihr; im Text eines Kapitels
         bekommt sie ihre eigene (E-026), die als Teil an dieser Stelle
         steht. Deren Id ist die der Karte mit `_scene` — so bildet die
         Migration 041 für schon geladene Karten dieselbe. */
      let ort = ganzes;
      let teil: Entity | undefined;
      if (imKapitel) {
        ort = neu('Scene', titel, ['map-scene', ortName, titel], undefined, `${karte.id}_scene`);
        wb.feld(ort, 'Scene', 'mode', 'exploration');
        wb.kante(ort, 'partOf', arc.id);
        teil = ort;
      }
      wb.feld(karte, 'Image', 'image', BILD_ADRESSE + pfad.split('/').map(encodeURIComponent).join('/'));
      wb.feld(karte, 'Image', 'caption', [titel, k['credit'] ? `Map by ${String(k['credit'])}` : ''].filter(Boolean).join(' · '));
      wb.feld(karte, 'Image', 'alt', titel);
      raster(wb, karte, k['grid'] as Knoten | undefined);
      wb.kante(karte, 'mapOf', ort.id);
      /* Die Karte einer Szene zeigt auch ihren Ort (T-175). */
      const platz = ortVon.get(ort.id);
      if (platz) wb.kante(karte, 'mapOf', platz.id);
      /* Die Karte eines Bereichs zeigt auch ihn (T-182), wo immer sie steht. */
      const bereich = bereichsOrt.get(bereichAusKarte(titel) ?? '');
      if (bereich && bereich !== platz) wb.kante(karte, 'mapOf', bereich.id);
      else if (imKapitel) wb.notiz('Karte im Kapiteltext: ohne benannten Abschnitt kein Ort (T-175)', 'adventureData');
      return teil;
    };
    legeTeileAn(wb, chapter, Array.isArray(kap['entries']) ? (kap['entries'] as unknown[]) : [], 1, {
      quelle,
      ctx,
      art: 'adventureData',
      angelegt: gm,
      szene: (k) => szeneVon.get(k),
      bild,
      ort: ortFuerUeberschrift(wb, quelle, 'adventureData', gm, true),
      ortVon: (sz) => ortVon.get(sz.id),
    }, kap['page']);
  }

  /* 4. Begegnungen: nur an einer Szene — ein Kapitel nennt Kreaturen, um
        sie vorzustellen, nicht um sie kämpfen zu lassen. */
  for (const [szene, inhalt] of inhaltVon) {
    const wer = kreaturenMitAnzahl(zeichenketten(ohneVorlesen(inhalt)));
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
    const kampf = neu('Encounter', szene.name, ['encounter', szene.id]);
    wb.kante(kampf, 'partOf', szene.id);
    wb.feld(szene, 'Scene', 'mode', 'encounter');
    for (const { sb, anzahl } of teilnehmer) {
      for (let i = 1; i <= anzahl; i += 1) {
        wb.kante(kampf, 'participates', sb.id, { label: anzahl > 1 ? `${sb.name} ${i}` : sb.name });
      }
    }
  }
  return angelegt;
}

/** Der Text ohne Vorlesetext, in jeder Tiefe — die Runde hört ihn, kämpft aber nicht darin. */
function ohneVorlesen(liste: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const x of liste) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) {
      out.push(x);
      continue;
    }
    const o = x as Knoten;
    if (o['type'] === 'insetReadaloud') continue;
    out.push(Array.isArray(o['entries']) ? { ...o, entries: ohneVorlesen(o['entries'] as unknown[]) } : o);
  }
  return out;
}
