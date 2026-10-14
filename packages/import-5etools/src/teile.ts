/**
 * **Buchtext als Teile** (T-108, E-028, E-029): aus dem Textbaum eines
 * Buchs oder Abenteuers werden Teil-Artikel in Lesereihenfolge, jeder mit
 * `partOf` und `rank` an seinem Ganzen (Kapitel oder Szene).
 *
 * - Ein **Absatz** (eine Zeichenkette, eine Liste, ein Kasten, ein Zitat,
 *   eine Tabelle) wird ein `Paragraph`; seine `kind` sagt, wie er gesetzt
 *   wird.
 * - Ein **benannter Abschnitt** wird eine `Heading`, solange seine Stufe
 *   nicht tiefer als drei ist (`##` und `###` unter dem Kapitel); was er
 *   enthält, folgt flach dahinter im selben Ganzen — eine Überschrift
 *   gliedert den Fluss, sie enthält ihn nicht. Tiefer steht der Name als
 *   fetter Satzanfang im Absatz, wie 5e.tools ihn zeichnet.
 * - Ein **Vorlesetext** wird ein `ReadAloudText`.
 * - **Was schon Artikel ist, wird nicht verdoppelt:** ein eingebetteter
 *   Statblock, ein Zauber, ein Gegenstand (`statblock`), eine Tabelle mit
 *   dem Namen einer `Table`, ein benannter Abschnitt mit dem Namen eines
 *   Artikels aus demselben Buch („Blinded" im Anhang des PHB, „Fighter" im
 *   Klassenkapitel) — das wird ein `Embed`, der darauf zeigt.
 * - Im **Abenteuer** darf ein benannter Abschnitt eine Szene werden
 *   (`szene`): sie steht als Teil an ihrer Stelle, und was sie enthält, wird
 *   ihr eigener Fluss. Karten gibt `bild` weiter.
 *
 * Die Peg-Id eines Teils ist aus seinem Ganzen und seinem Rang gerechnet:
 * zwei Läufe über denselben Text schreiben dieselben Ids, und `--only-new`
 * legt keinen Teil zweimal an.
 */

import type { Entity } from '@nw/model';
import { partName } from '@nw/model';
import type { Knoten } from './copy.js';
import { inline, markdown } from './text.js';
import type { TextKontext } from './text.js';
import type { Werkbank } from './werkbank.js';
import { zaehle } from './werkbank.js';

/** Bis zu welcher Stufe ein benannter Abschnitt eine eigene Überschrift wird. */
const TIEFSTE_UEBERSCHRIFT = 3;

/**
 * Die Marken, unter denen ein benannter Abschnitt schon ein Artikel sein
 * kann — gefragt wird nur mit der Quelle des Buchs selbst, damit „Fighter"
 * im Kapitel eines Settingbuchs nicht auf die Klasse im PHB zeigt.
 */
const SCHON_ARTIKEL = [
  'condition', 'status', 'disease', 'sense', 'skill', 'action', 'variantrule', 'feat', 'background',
  'race', 'class', 'language', 'deity', 'itemProperty', 'reward', 'boon', 'cult', 'trap', 'hazard',
  'object', 'optfeature', 'table', 'spell', 'item', 'creature',
] as const;

/** Was beim Zerlegen gebraucht wird. */
export interface TeileOptionen {
  /** Die Quelle des Buchs (`PHB`) — für die Fundstelle und die Suche nach Artikeln. */
  quelle: string;
  /** Der Textkontext (Verweise, `{@area}`). */
  ctx: TextKontext;
  /** Je angelegtem Artikel, etwa `audience: 'gm'` im Abenteuer. */
  angelegt?: (e: Entity) => void;
  /**
   * Im Abenteuer: wird dieser benannte Abschnitt eine eigene Szene? Dann
   * gibt die Funktion sie zurück (angelegt, ohne Kante zum Ganzen), und ihr
   * Inhalt wird ihr eigener Fluss.
   */
  szene?: (k: Knoten, ganzes: Entity, stufe: number) => Entity | undefined;
  /** Ein Bild im Text (Karten im Abenteuer); ohne Rückgabe wird es nur gezählt. */
  bild?: (b: Knoten, ganzes: Entity) => void;
  /** Bericht-Art (`bookData`, `adventureData`). */
  art: string;
}

/** Was das Zerlegen eines Ganzen ergab — für Tests und den Bericht. */
export interface Fluss {
  teile: Entity[];
}

const name = (e: Knoten): string => (typeof e['name'] === 'string' ? e['name'].trim() : '');

/**
 * Den Fluss eines Ganzen anlegen: `liste` sind die Einträge in seinem Text,
 * `stufe` die Überschriftenstufe des Ganzen (das Kapitel ist 1). Gibt die
 * angelegten Teile in Reihenfolge zurück.
 */
export function legeTeileAn(wb: Werkbank, ganzes: Entity, liste: unknown[], stufe: number, o: TeileOptionen, seite?: unknown): Entity[] {
  const raus: Entity[] = [];
  const b = wb.artBericht(o.art);
  let rang = 0;

  const teil = (typ: string, n: string, s: unknown): Entity => {
    rang += 1;
    const e = wb.anlegen(typ, n || typ, `part|${ganzes.id}|${rang}`, { source: o.quelle, ...(s !== undefined && s !== 0 ? { page: s } : {}) });
    wb.kante(e, 'partOf', ganzes.id, { rank: rang });
    zaehle(b.artikel, typ);
    o.angelegt?.(e);
    raus.push(e);
    return e;
  };
  const absatz = (text: string, kind: string, s: unknown): void => {
    if (!text.trim()) return;
    const e = teil('Paragraph', partName(text), s);
    wb.prosa(e, text.trim());
    if (kind !== 'text') wb.feld(e, 'Paragraph', 'kind', kind);
  };
  const verweis = (ziel: Entity, s: unknown): void => {
    const e = teil('Embed', ziel.name ?? '', s);
    wb.feld(e, 'Embed', 'target', ziel.id);
  };
  /** Ein benannter Abschnitt, der schon ein Artikel aus diesem Buch ist. */
  const schonDa = (n: string): Entity | undefined => {
    for (const tag of SCHON_ARTIKEL) {
      const t = wb.hole(tag, n, o.quelle);
      if (t && !t.interfaces[0]?.match(/^(Heading|Paragraph|ReadAloudText|Embed|Chapter)$/)) return t;
    }
    return undefined;
  };

  const gehe = (eintraege: unknown[], tiefe: number, s: unknown): void => {
    for (const x of eintraege) {
      if (typeof x === 'string') {
        absatz(inline(x, o.ctx), 'text', s);
        continue;
      }
      if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
      const k = x as Knoten;
      const typ = String(k['type'] ?? 'entries');
      const hier = k['page'] ?? s;
      switch (typ) {
        case 'entries': case 'section': {
          const n = name(k);
          const kinder = Array.isArray(k['entries']) ? (k['entries'] as unknown[]) : [];
          if (!n) {
            gehe(kinder, tiefe, hier);
            break;
          }
          const da = schonDa(n);
          if (da) {
            verweis(da, hier);
            break;
          }
          const sz = o.szene?.(k, ganzes, tiefe + 1);
          if (sz) {
            rang += 1;
            wb.kante(sz, 'partOf', ganzes.id, { rank: rang });
            raus.push(sz, ...legeTeileAn(wb, sz, kinder, tiefe + 1, o, hier));
            break;
          }
          if (tiefe + 1 <= TIEFSTE_UEBERSCHRIFT) {
            /* Der Name einer Überschrift ist Klartext: ein Verweis darin
               bliebe als `[[…]]` im Inhaltsverzeichnis stehen. */
            const h = teil('Heading', partName(inline(n, o.ctx), 200), hier);
            wb.feld(h, 'Heading', 'level', tiefe + 1);
            gehe(kinder, tiefe + 1, hier);
          } else {
            absatz(markdown([k], o.ctx, 5).trim(), 'text', hier);
          }
          break;
        }
        case 'insetReadaloud': {
          const text = markdown(k['entries'], o.ctx, 6).trim();
          if (!text) break;
          const e = teil('ReadAloudText', partName(text), hier);
          wb.feld(e, 'ReadAloud', 'readaloud', [{ id: 'read', value: text }]);
          break;
        }
        case 'inset': case 'variant':
          absatz(markdown([k], o.ctx, 6), 'sidebar', hier);
          break;
        case 'quote':
          absatz(markdown([k], o.ctx, 6), 'quote', hier);
          break;
        case 'list':
          absatz(markdown([k], o.ctx, 6), 'list', hier);
          break;
        case 'table': {
          const titel = typeof k['caption'] === 'string' ? k['caption'].trim() : '';
          const t = titel ? wb.hole('table', titel, o.quelle) : undefined;
          if (t) verweis(t, hier);
          else absatz(markdown([k], o.ctx, 6), 'table', hier);
          break;
        }
        case 'tableGroup':
          gehe(Array.isArray(k['tables']) ? (k['tables'] as unknown[]) : [], tiefe, hier);
          break;
        case 'statblock': case 'statblockInline': {
          const tag = String(k['tag'] ?? 'creature');
          const n = String(k['name'] ?? (k['data'] as Knoten | undefined)?.['name'] ?? '');
          const ziel = n ? wb.finde(tag, [n, String(k['source'] ?? '')]) : undefined;
          if (ziel) verweis(ziel, hier);
          else {
            if (n) o.ctx.insLeere(tag, `${n}|${String(k['source'] ?? '')}`);
            absatz(markdown([k], o.ctx, 6), 'text', hier);
          }
          break;
        }
        case 'image': case 'gallery': {
          const bilder = typ === 'gallery' ? (Array.isArray(k['images']) ? (k['images'] as Knoten[]) : []) : [k];
          for (const bld of bilder) {
            if (o.bild) o.bild(bld, ganzes);
            else zaehle(b.notizen, 'Bild im Buchtext (weggelassen, E5)');
          }
          break;
        }
        case 'hr':
          break;
        default:
          absatz(markdown([k], o.ctx, Math.min(6, tiefe + 1)), 'text', hier);
      }
    }
  };

  gehe(liste, stufe, seite);
  return raus;
}
