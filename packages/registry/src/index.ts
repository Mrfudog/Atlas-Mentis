import type { Registry } from '@nw/model';
import { interfaces } from './interfaces.js';
import { relations } from './relations.js';
import { views } from './views.js';
import { units } from './units.js';
import { enums } from './enums.js';

export { interfaces, relations, views, units, enums };

/** Campaign-wide defaults, the last scope {VAR} resolution falls back to. */
export const vars: Record<string, string> = {
  /* Die Namen sind englisch wie jede Registerzeile. Sie standen hier noch
     deutsch, nachdem die Oberfläche umgestellt war — gemerkt hat es
     niemand, weil Paket und Prototyp jedes für sich stimmten. Genau dafür
     gibt es jetzt `emit-seed`. */
  ATK: '+4',
  DMG: '4 (1d6)',
  DMG2: '(5 1d8)',
  DMGTYP: 'bludgeoning',
  DMGTYP2: 'piercing',
  RNG: '5 ft.',
};

/**
 * Kampagneneinstellungen (REQ-043). Jeder Bereich liest die Schlüssel, die
 * er kennt, und lässt den Rest liegen — deshalb steht hier kein Schema.
 */
export const settings: Record<string, string> = {
  gridSize: '70',
  gridUnit: '1,5 m',
  inventoryCols: '10',
  inventoryRows: '6',
  /* **Basils Blatt** (REQ-214–216, D54). Das Tragraster einer Kreatur
     ohne eigene Form: Seitenlänge des Grundquadrats je Grösse (eine
     Grösse, die hier fehlt, behält das Rechteck oben), und die Zonen nach
     Spalten. Das Zusatzquadrat rechnet der Statblock (`carryExtra`). */
  carrySquares: 'tiny:3, small:4, medium:5, large:6',
  carryZones: '0-1:bonus action, 2-4:action, 5-8:turn, 9-10:round',
  /* Wie schnell etwas von einem Körperplatz kommt — und ein Behälter an
     diesem Platz gibt seinem Inhalt eine Stufe dazu. Ein Platz, der hier
     fehlt, hat keine Stufe. */
  slotDraw: 'mainHand:free action, offHand:free action, holster1:free action, holster2:free action, '
    + 'belt:bonus action, shoulders:bonus action, head:action, torso:action, hands:action, '
    + 'legs:action, feet:action, ringR1:action, ringR2:action, ringR3:action, ringR4:action, '
    + 'ringL1:action, ringL2:action, ringL3:action, ringL4:action, '
    + 'neck1:action, neck2:action, neck3:action, neck4:action',
  /* Vorlagen beim Anlegen eines Behälters, `container:<Name>`: Zeilen mit
     `/`, nach dem Strich die Zonen nach Spalten. Eine neue Vorlage ist
     eine neue Einstellung. */
  'container:Backpack': '.###../######/######/######/.###.. | 0-1:action, 2-3:turn, 4-5:round',
  'container:Bag of Holding': '####/####/####/####/####/####/####/####',
  /* `calendar` stand hier: der Kalender hängt seit dem 7.10. an der Welt
     (`World.calendar`, Kante `inWorld` von der Kampagne), A11. */
  /* Der Tag, an dem die Kampagne steht. Leer heisst: das jüngste benutzte
     Ereignis. Gruppenstufe und Gruppen-Aufenthaltsort stehen hier
     ausdrücklich NICHT — sie werden gerechnet (B3, D8), und eine
     eingetippte Gruppenstufe ist nach der ersten Stufe falsch. */
  today: '',
  /* `skills` stand hier: Fertigkeit zu Attribut (`stealth:dex`). Seit M6
     ist eine Fertigkeit ein Artikel und trägt ihr Attribut selbst
     (`Skill.ability`) — die Einstellung wäre die zweite Stelle dafür. */
  /* Felder, die ein Spieler nicht sieht, solange keine bekannte
     Information sie ausdrücklich freigibt. Als Einstellung, weil eine
     Kampagne das anders halten darf. Es hiess `gmBlockTypes` und nannte
     Blockarten — die gibt es nicht mehr, es sind Felder. */
  gmFields: 'Secrets.secret,Tactics.tactics',
  /* Welches Mass-System die Seite zeigt: `imperial`, `metric` oder `both`.
     Eine Artikelart darf es überschreiben (`InterfaceDef.units`) — eine
     Kreatur darf imperial bleiben, weil ihre Zahlen aus dem Regelwerk
     kommen, während der Rest der Kampagne metrisch dasteht. */
  units: 'both',
  /* Reisezehrung (REQ-170): alle wie viele Knoten eine Ration und ein
     Licht fällig werden. Null schaltet die Zählung ab. */
  travelRationEvery: '3',
  travelLightEvery: '4',
  travelWatchesPerDay: '3',
  /* `travelActions` und `conditions` standen hier als Wortlisten. Beides
     sind seit dem 7.10. Regelartikel (`Rule.kind` travel bzw. seit D48 die Art `Condition`,
     Abgleich A3): ein Wort hat keine Beschreibung und keine Quelle, ein
     Artikel schon. Wanderung: `prototype/migration/zustaende-als-regeln.mjs`. */
};

/** The rows a fresh database is seeded with. */
export const seedRegistry: Registry = { interfaces, relations, views, units, enums, vars, settings };
