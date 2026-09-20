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
    label: 'composed of',
    inverseLabel: 'used in',
    from: ['Statblock'],
    to: ['Rule'],
    section: 'Actions & traits',
    props: {
      type: 'object',
      properties: { vars: { type: 'object', title: 'Variable bindings' } },
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
  belongsTo: {
    type: 'belongsTo',
    label: 'belongs to',
    inverseLabel: 'statblock of',
    from: ['Statblock'],
    to: ['NPC'],
    cardinality: 'one',
  },

  /** Weapon properties are pooled rules, referenced rather than copied. */
  hasProperty: {
    type: 'hasProperty',
    label: 'has property',
    inverseLabel: 'property of',
    from: ['Weapon', 'Item', 'Armor'],
    to: ['Rule'],
  },

  owes: {
    type: 'owes',
    label: 'owes',
    inverseLabel: 'creditor of',
    from: ['NPC'],
    to: ['NPC'],
  },

  memberOf: {
    type: 'memberOf',
    label: 'member of',
    inverseLabel: 'members',
    from: ['NPC'],
    to: ['Faction'],
  },

  livesIn: {
    type: 'livesIn',
    label: 'lives in',
    inverseLabel: 'residents',
    from: ['NPC'],
    to: ['Place'],
  },

  /**
   * One containment edge for everything that nests, rather than a second
   * hierarchy beside it: a chapter sits in an arc the way a room sits in a
   * building, and a quest hangs off the story it belongs to. Widening the
   * ends of an existing edge keeps one set of backlinks, one `contains`.
   */
  partOf: {
    type: 'partOf',
    label: 'part of',
    inverseLabel: 'contains',
    from: ['Place', 'Story', 'Quest'],
    to: ['Place', 'Story'],
  },

  controls: {
    type: 'controls',
    label: 'controls',
    inverseLabel: 'controlled by',
    from: ['Faction'],
    to: ['Place'],
  },

  describedIn: {
    type: 'describedIn',
    label: 'described in',
    inverseLabel: 'describes',
    from: ['*'],
    to: ['Article'],
  },

  // ------------------------------------------------------ players & party

  /** The one edge that leaves the fiction: who at the table runs this one. */
  playedBy: {
    type: 'playedBy',
    label: 'played by',
    inverseLabel: 'plays',
    from: ['PlayerCharacter'],
    to: ['*'],
    cardinality: 'one',
  },

  memberOfParty: {
    type: 'memberOfParty',
    label: 'in the party',
    inverseLabel: 'members',
    from: ['Creature'],
    to: ['Party'],
  },

  carries: {
    type: 'carries',
    label: 'carries',
    inverseLabel: 'carried by',
    from: ['Creature', 'Party'],
    to: ['Inventory'],
    cardinality: 'one',
  },

  /**
   * Was im Inventar liegt — und *wie* es dort liegt (REQ-064, 065). Die
   * Angaben stehen an der Kante, nicht am Gegenstand: dasselbe Seil liegt
   * bei der einen Figur am Gürtel und bei der anderen ganz unten im Rucksack,
   * und ein Feld am Gegenstand könnte nur eine der beiden Wahrheiten tragen.
   *
   * `tier` ist der Griffabstand, nicht der Ort: was in der Hand ist, was am
   * Körper, was am Gürtel, was im Rucksack, was zu Hause. Genau diese Frage
   * stellt sich am Tisch — „habe ich das jetzt?" —, und sie ist eine andere
   * als „gehört es mir?".
   */
  holds: {
    type: 'holds',
    label: 'holds',
    inverseLabel: 'held in',
    from: ['Inventory'],
    to: ['Item'],
    props: {
      type: 'object',
      properties: {
        qty: { type: 'number', title: 'Quantity', default: 1 },
        tier: {
          type: 'string',
          title: 'Within reach',
          enum: ['held', 'worn', 'belt', 'pack', 'stored'],
          default: 'pack',
        },
        slot: {
          type: 'string',
          title: 'Body slot',
          enum: ['head', 'neck', 'cloak', 'torso', 'hands', 'mainHand', 'offHand',
            'belt', 'legs', 'feet', 'ring1', 'ring2'],
        },
        gx: { type: 'number', title: 'Grid column' },
        gy: { type: 'number', title: 'Grid row' },
        attuned: { type: 'boolean', title: 'Attuned' },
        note: { type: 'string', title: 'Note' },
      },
    },
  },

  // ---------------------------------------------------------------- story

  followsFrom: {
    type: 'followsFrom',
    label: 'follows',
    inverseLabel: 'followed by',
    from: ['Story'],
    to: ['Story'],
    cardinality: 'one',
  },

  questGiver: {
    type: 'questGiver',
    label: 'given by',
    inverseLabel: 'gives',
    from: ['Quest'],
    to: ['Creature', 'Faction'],
  },

  questAbout: {
    type: 'questAbout',
    label: 'concerns',
    inverseLabel: 'concerned by',
    from: ['Quest'],
    to: ['*'],
  },

  happensAt: {
    type: 'happensAt',
    label: 'happens at',
    inverseLabel: 'scenes here',
    from: ['Story'],
    to: ['Place'],
  },

  features: {
    type: 'features',
    label: 'features',
    inverseLabel: 'appears in',
    from: ['Story'],
    to: ['Creature', 'NPC', 'Statblock', 'Faction'],
  },

  // ------------------------------------------------------------- knowledge

  /**
   * Der Artikel trägt die Kante zu seinen Informationen, nicht umgekehrt:
   * so steht die Liste dort, wo das Seitenpanel sie bearbeitet, und `owned`
   * lässt die Bündel mit dem Artikel sterben statt verwaist zurückzubleiben.
   */
  knowledge: {
    type: 'knowledge',
    label: 'knowledge about it',
    inverseLabel: 'about',
    from: ['*'],
    to: ['Information'],
    owned: true,
  },

  /**
   * Die Zuteilung. Ein Ziel, drei Sorten Empfänger — Figur, Gruppe oder
   * Wissensstand — und die Auflösung ist immer dieselbe Abfrage.
   */
  knownBy: {
    type: 'knownBy',
    label: 'known by',
    inverseLabel: 'knows',
    from: ['Information'],
    to: ['Creature', 'Party', 'KnowledgeLevel'],
  },

  atLevel: {
    type: 'atLevel',
    label: 'knows as',
    inverseLabel: 'known to',
    from: ['Creature', 'Party'],
    to: ['KnowledgeLevel'],
  },

  // ------------------------------------------------------------------ maps

  mapOf: {
    type: 'mapOf',
    label: 'map of',
    inverseLabel: 'maps',
    from: ['Map'],
    to: ['Place', 'Story'],
  },

  /**
   * Verschachtelte Karten (REQ-131). Der Ankerbereich steht an der Kante, in
   * Anteilen der Elternkarte — nicht in Bildpunkten, denn ein Bild darf
   * ersetzt werden, ohne dass jede Untergliederung wandert.
   */
  insideMap: {
    type: 'insideMap',
    label: 'inside',
    inverseLabel: 'zoom into',
    from: ['Map'],
    to: ['Map'],
    cardinality: 'one',
    props: {
      type: 'object',
      properties: {
        x: { type: 'number', title: 'X (0–1)' },
        y: { type: 'number', title: 'Y (0–1)' },
        w: { type: 'number', title: 'Width (0–1)' },
        h: { type: 'number', title: 'Height (0–1)' },
      },
    },
  },

  /**
   * Ein Token ist eine Kante mit Koordinaten (REQ-133 bis 136). Es zeigt auf
   * einen Artikel, also öffnet ein Klick darauf den Artikel — ein Marker, der
   * nur einen Namen trüge, wäre eine zweite Wahrheit neben dem Artikel.
   *
   * `kind` trennt, was vorbereitet ist (`static`, `scenery`) von dem, was im
   * Spiel entsteht (`play`, `party`, `quest`). Solange es keine Sitzungs-
   * zustände gibt, liegen auch die letzteren an der Karte; das ist die
   * Stelle, die sich ändert, wenn REQ-116 kommt.
   */
  marker: {
    type: 'marker',
    label: 'marker',
    inverseLabel: 'on the map',
    from: ['Map'],
    to: ['*'],
    props: {
      type: 'object',
      properties: {
        x: { type: 'number', title: 'X (0–1)' },
        y: { type: 'number', title: 'Y (0–1)' },
        kind: {
          type: 'string',
          title: 'Token kind',
          enum: ['static', 'scenery', 'party', 'quest', 'play'],
          default: 'static',
        },
        size: { type: 'number', title: 'Size in squares', default: 1 },
        note: { type: 'string', title: 'Note' },
      },
    },
  },

  // -------------------------------------------------------------- crafting

  /**
   * Was ein Rezept verbraucht (REQ-184). Die Menge steht an der Kante, weil
   * sie von beiden Enden abhängt: dasselbe Material geht in das eine Rezept
   * einmal und in das andere zwölfmal ein.
   */
  needs: {
    type: 'needs',
    label: 'needs',
    inverseLabel: 'used in',
    from: ['Recipe'],
    to: ['Item'],
    props: {
      type: 'object',
      properties: {
        qty: { type: 'number', title: 'Quantity', default: 1 },
        consumed: { type: 'boolean', title: 'Consumed', default: true },
        note: { type: 'string', title: 'Note' },
      },
    },
  },

  /** Was dabei herauskommt. */
  yields: {
    type: 'yields',
    label: 'yields',
    inverseLabel: 'made by',
    from: ['Recipe'],
    to: ['Item'],
    cardinality: 'one',
  },

  // ---------------------------------------------------------------- boards

  /**
   * Was auf dem Board liegt (REQ-157, 158, 165). Die Platzierung trägt Ort,
   * Grösse und — wenn sie will — die Ansicht, in der sie gezeichnet wird.
   * Ohne eigene Ansicht entscheidet die Regel des Boards (REQ-161).
   */
  placed: {
    type: 'placed',
    label: 'on the board',
    inverseLabel: 'lies on',
    from: ['Board'],
    to: ['*'],
    props: {
      type: 'object',
      properties: {
        x: { type: 'number', title: 'X in px' },
        y: { type: 'number', title: 'Y in px' },
        w: { type: 'number', title: 'Width in px', default: 260 },
        h: { type: 'number', title: 'Height in px', default: 180 },
        view: { type: 'string', title: 'Shown as' },
        z: { type: 'number', title: 'Layer', default: 0 },
        locked: { type: 'boolean', title: 'Locked' },
        note: { type: 'string', title: 'Note' },
      },
    },
  },

  // ------------------------------------------------------------ encounters

  /**
   * Wer mitkämpft (REQ-115). Eine Kante je Teilnehmer, nicht eine mit
   * Anzahl: drei Goblins haben drei Mal Trefferpunkte, und eine Zahl an
   * einer Kante könnte nur einen davon verletzen.
   *
   * Zustände tragen ihre Dauer mit; sie zählt am Ende des Zuges herunter,
   * der sie gesetzt hat. Ohne Dauer vergisst sie der Tisch.
   */
  participates: {
    type: 'participates',
    label: 'in the fight',
    inverseLabel: 'fights in',
    from: ['Encounter'],
    to: ['Creature', 'Statblock', 'Party'],
    props: {
      type: 'object',
      properties: {
        label: { type: 'string', title: 'Name at the table' },
        init: { type: 'number', title: 'Initiative' },
        hp: { type: 'number', title: 'Hit points' },
        hpMax: { type: 'number', title: 'Maximum' },
        ally: { type: 'boolean', title: 'On the party’s side' },
        conditions: { type: 'array', title: 'Conditions', items: { type: 'object' } },
        note: { type: 'string', title: 'Note' },
      },
    },
  },

  /** Wo sie stattfindet — damit der Initiative-Zeiger auf die Karte kann. */
  onMap: {
    type: 'onMap',
    label: 'fought on',
    inverseLabel: 'fights here',
    from: ['Encounter', 'Story'],
    to: ['Map'],
    cardinality: 'one',
  },

  /** Was dabei zu holen ist. */
  loot: {
    type: 'loot',
    label: 'loot',
    inverseLabel: 'found in',
    from: ['Encounter', 'Story'],
    to: ['Item'],
    props: {
      type: 'object',
      properties: {
        qty: { type: 'number', title: 'Quantity', default: 1 },
        chance: { type: 'number', title: 'Chance in percent' },
      },
    },
  },

  // --------------------------------------------------------------- events

  /** Wen oder was ein Ereignis betrifft. */
  involves: {
    type: 'involves',
    label: 'involves',
    inverseLabel: 'took part in',
    from: ['Event'],
    to: ['*'],
  },
};
