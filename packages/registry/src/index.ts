import type { Registry } from '@nw/model';
import { components } from './components.js';
import { interfaces } from './interfaces.js';
import { relations } from './relations.js';
import { views } from './views.js';

export { components, interfaces, relations, views };

/** Campaign-wide defaults, the last scope {VAR} resolution falls back to. */
export const vars: Record<string, string> = {
  REICHWEITE: '1,5 m',
  TYP: 'wuchtig',
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
  /* Fertigkeit zu Attribut. Steht hier und nicht im Code, damit eine
     Kampagne mit anderen Fertigkeiten eine Einstellung ist und kein
     Schemawechsel. Die Seite hat denselben Satz als Rückfall, damit sie
     auch ohne diese Zeile rechnet. */
  skills:
    'acrobatics:dex,animalHandling:wis,arcana:int,athletics:str,deception:cha,' +
    'history:int,insight:wis,intimidation:cha,investigation:int,medicine:wis,' +
    'nature:int,perception:wis,performance:cha,persuasion:cha,religion:int,' +
    'sleightOfHand:dex,stealth:dex,survival:wis',
  conditions:
    'blinded,charmed,deafened,frightened,grappled,incapacitated,invisible,' +
    'paralysed,petrified,poisoned,prone,restrained,stunned,unconscious',
};

/** The rows a fresh database is seeded with. */
export const seedRegistry: Registry = { components, interfaces, relations, views, vars, settings };
