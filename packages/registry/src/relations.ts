import type { RelationDef } from '@nw/model';

/**
 * `relation_def` rows. Every edge is stored once, in one direction;
 * `inverseLabel` is how it reads from the other end (REQ-182), so there is
 * no mirrored second edge to fall out of step.
 *
 * `section` turns an edge into a composition heading on the source article —
 * that is how a statblock is built from pooled rules rather than copies.
 */
export const relations: Record<string, RelationDef> = {
  composedOf: {
    type: 'composedOf',
    label: 'besteht aus',
    inverseLabel: 'verwendet in',
    from: ['Statblock'],
    to: ['Regel'],
    section: 'Aktionen & Merkmale',
    props: {
      type: 'object',
      properties: { vars: { type: 'object', title: 'Variablenbindung' } },
    },
  },

  hatStatblock: {
    type: 'hatStatblock',
    label: 'Statblock',
    inverseLabel: 'verwendet von',
    from: ['NPC'],
    to: ['Statblock'],
    cardinality: 'one',
  },

  schuldet: {
    type: 'schuldet',
    label: 'schuldet',
    inverseLabel: 'Gläubiger von',
    from: ['NPC'],
    to: ['NPC'],
  },

  mitgliedVon: {
    type: 'mitgliedVon',
    label: 'Mitglied von',
    inverseLabel: 'Mitglieder',
    from: ['NPC'],
    to: ['Fraktion'],
  },

  wohntIn: {
    type: 'wohntIn',
    label: 'wohnt in',
    inverseLabel: 'Bewohner',
    from: ['NPC'],
    to: ['Ort'],
  },

  teilVon: {
    type: 'teilVon',
    label: 'Teil von',
    inverseLabel: 'enthält',
    from: ['Ort'],
    to: ['Ort'],
  },

  herrschtUeber: {
    type: 'herrschtUeber',
    label: 'herrscht über',
    inverseLabel: 'beherrscht von',
    from: ['Fraktion'],
    to: ['Ort'],
  },

  beschriebenIn: {
    type: 'beschriebenIn',
    label: 'beschrieben in',
    inverseLabel: 'beschreibt',
    from: ['*'],
    to: ['Artikel'],
  },
};
