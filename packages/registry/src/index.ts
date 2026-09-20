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
};

/** The rows a fresh database is seeded with. */
export const seedRegistry: Registry = { components, interfaces, relations, views, vars, settings };
