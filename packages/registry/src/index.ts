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
  calendar: 'Harptos',
  /* Der Tag, an dem die Kampagne steht. Leer heisst: das jüngste benutzte
     Ereignis. Gruppenstufe und Gruppen-Aufenthaltsort stehen hier
     ausdrücklich NICHT — sie werden gerechnet (B3, D8), und eine
     eingetippte Gruppenstufe ist nach der ersten Stufe falsch. */
  today: '',
  /* Fertigkeit zu Attribut. Steht hier und nicht im Code, damit eine
     Kampagne mit anderen Fertigkeiten eine Einstellung ist und kein
     Schemawechsel. Die Seite hat denselben Satz als Rückfall, damit sie
     auch ohne diese Zeile rechnet. */
  skills:
    'acrobatics:dex,animalHandling:wis,arcana:int,athletics:str,deception:cha,' +
    'history:int,insight:wis,intimidation:cha,investigation:int,medicine:wis,' +
    'nature:int,perception:wis,performance:cha,persuasion:cha,religion:int,' +
    'sleightOfHand:dex,stealth:dex,survival:wis',
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
  /* Was eine Figur an einem Knoten tun kann (REQ-171). */
  travelActions: 'scout,forage,craft,rest,guard,tend the fire',
  conditions:
    'blinded,charmed,deafened,frightened,grappled,incapacitated,invisible,' +
    'paralysed,petrified,poisoned,prone,restrained,stunned,unconscious',
};

/** The rows a fresh database is seeded with. */
export const seedRegistry: Registry = { interfaces, relations, views, units, enums, vars, settings };
