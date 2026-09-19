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

  /**
   * The creature link, stored on the STATBLOCK side.
   *
   * `Schemas.md` puts it the other way round (`Creature.hasStatblock`), but
   * the vault writes `kreatur:` in the statblock's frontmatter, so that is
   * where the edge exists in the data we actually have. One edge, one
   * direction; the creature reads it through `inverseLabel`.
   */
  gehoertZu: {
    type: 'gehoertZu',
    label: 'gehört zu',
    inverseLabel: 'Statblock',
    from: ['Statblock'],
    to: ['NPC'],
    cardinality: 'one',
  },

  /** Weapon properties are pooled rules, referenced rather than copied. */
  hatEigenschaft: {
    type: 'hatEigenschaft',
    label: 'Eigenschaft',
    inverseLabel: 'Eigenschaft von',
    from: ['Waffe', 'Gegenstand', 'Ruestung'],
    to: ['Regel'],
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
