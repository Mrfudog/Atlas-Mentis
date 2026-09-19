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

/** The rows a fresh database is seeded with. */
export const seedRegistry: Registry = { components, interfaces, relations, views, vars };
