import type { ViewDef } from '@nw/model';

/**
 * Darstellungsstufen (facets, REQ-164). A view names either a whole
 * component or a single field, so Kampf can take the armour class without
 * dragging in the ability scores.
 *
 * `spieler` is the shape player access will take: it excludes `secret`
 * blocks and the DM-only components. It is not yet an access control —
 * that is enforced server-side when player links land.
 */
export const views: Record<string, ViewDef> = {
  schnell: {
    label: 'Schnell',
    order: 1,
    felder: 'keine',
    bloecke: ['paragraph', 'readaloud'],
    beschreibung: true,
    bausteine: false,
    bezuege: true,
    bindungen: false,
    bild: false,
  },

  voll: {
    label: 'Voll',
    order: 2,
    felder: 'alle',
    bloecke: 'alle',
    beschreibung: true,
    bausteine: true,
    bezuege: true,
    bindungen: true,
    bild: true,
  },

  kampf: {
    label: 'Kampf',
    order: 3,
    felder: [
      'StatblockInfo.ac',
      'StatblockInfo.tp',
      'StatblockInfo.tempo',
      'StatblockInfo.initiative',
      'StatblockInfo.passivWahr',
      'StatblockInfo.cr',
      'StatblockInfo.kampfrolle',
      'StatblockInfo.resistenzen',
      'StatblockInfo.immunitaeten',
      'CreatureInfo.haltung',
      'RuleInfo.kind',
    ],
    bloecke: ['tactics'],
    beschreibung: false,
    bausteine: true,
    bezuege: true,
    bindungen: false,
    bild: false,
  },

  bild: {
    label: 'Bild',
    order: 4,
    felder: 'keine',
    bloecke: [],
    beschreibung: false,
    bausteine: false,
    bezuege: false,
    bindungen: false,
    bild: true,
  },

  spieler: {
    label: 'Spieler',
    order: 5,
    felder: ['CreatureInfo', 'LocationInfo', 'FactionInfo'],
    bloecke: ['paragraph', 'readaloud', 'lore', 'appearance', 'fact'],
    beschreibung: true,
    bausteine: false,
    bezuege: false,
    bindungen: false,
    bild: true,
  },

  werte: {
    label: 'Werte',
    order: 6,
    felder: ['StatblockInfo'],
    bloecke: [],
    beschreibung: false,
    bausteine: false,
    bezuege: false,
    bindungen: false,
    bild: false,
  },
};
