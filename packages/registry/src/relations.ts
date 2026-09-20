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
    // Eine Fraktion kann etwas erfahren — „das Auge weiss es“ ist eine
    // Frage, die eine Kampagne stellt (REQ-040).
    //
    // Und eine **Gruppe von Menschen**: „die Spieler dieser Kampagne" ist
    // kein Figurengefüge, also keine Party. Sie dazuzunehmen ist eine
    // Zeile und keine zweite Mechanik — `knowledgeHolders` fragt ohnehin
    // nach Haltern und nicht nach Figuren.
    to: ['Creature', 'Party', 'Faction', 'KnowledgeLevel', 'Group'],
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
        /* Gedreht wird an der Kante und nicht am Bild: dasselbe Fass steht
           auf einer Karte quer und auf der nächsten längs, und ein
           gedrehtes Bild als eigenes Asset wäre ein zweites Fass. */
        rot: { type: 'number', title: 'Rotation in degrees', default: 0 },
        /* Ein Möbel ist nicht rund. `ratio` ist Höhe geteilt durch Breite;
           ohne es wäre jeder Tisch ein Quadrat. Nur `scenery` braucht es —
           eine Kreatur belegt Felder, kein Rechteck. */
        ratio: { type: 'number', title: 'Height ÷ width', default: 1 },
        note: { type: 'string', title: 'Note' },
        // Licht hängt an beiden Enden: dieselbe Laterne leuchtet auf einer
        // Stadtkarte anders weit als auf einer Kampfkarte, weil das Quadrat
        // ein anderes ist. Also steht der Radius an der Kante (REQ-140).
        light: { type: 'number', title: 'Bright light in squares' },
        dim: { type: 'number', title: 'Dim light in squares' },
      },
    },
  },

  /**
   * Wem ein Stück Karte gehört (REQ-193). Eine Form auf der Karte, die auf
   * einen Artikel zeigt — und weil sie auf etwas zeigt, ist sie eine Kante
   * und kein Feld. Gezeichnet wird sie aufs Gitter gerastert: am Tisch
   * zählt, welche Quadrate unsere sind, nicht wo die Linie genau verläuft.
   */
  territory: {
    type: 'territory',
    label: 'territory',
    inverseLabel: 'holds ground on',
    from: ['Map'],
    to: ['*'],
    props: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          title: 'Shape',
          enum: ['rect', 'circle', 'poly'],
          default: 'rect',
        },
        x: { type: 'number', title: 'X (0–1)' },
        y: { type: 'number', title: 'Y (0–1)' },
        w: { type: 'number', title: 'Width (0–1)' },
        h: { type: 'number', title: 'Height (0–1)' },
        r: { type: 'number', title: 'Radius (0–1)' },
        pts: { type: 'array', title: 'Points' },
        color: { type: 'string', format: 'color', title: 'Colour' },
        opacity: { type: 'number', title: 'Opacity', default: 0.18 },
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

  // --------------------------------------------------------------- tables

  /**
   * Ein Eintrag, der auf einen Artikel zeigt — einen Gegenstand, ein
   * Geschöpf, oder eine weitere Tabelle (REQ-186). `weight` ist das
   * Gewicht, nicht der Bereich: Bereiche von Hand zu führen bricht, sobald
   * jemand eine Zeile einfügt.
   */
  entry: {
    type: 'entry',
    label: 'entry',
    inverseLabel: 'rolled on',
    from: ['Table'],
    to: ['*'],
    props: {
      type: 'object',
      properties: {
        weight: { type: 'number', title: 'Weight', default: 1 },
        qty: { type: 'string', title: 'Quantity', default: '1' },
        label: { type: 'string', title: 'Shown as' },
        /* Eine Bedingung, die den Eintrag aus dem Topf nimmt: eine Marke,
           die der Ort tragen muss (REQ-172). Leer heisst „immer". */
        requiresTag: { type: 'string', title: 'Only where tagged' },
        note: { type: 'string', title: 'Note' },
      },
    },
  },

  /** Welche Tabelle an diesem Ort gilt (REQ-172). */
  tableFor: {
    type: 'tableFor',
    label: 'rolls on',
    inverseLabel: 'used at',
    from: ['Place', 'Story', 'Encounter'],
    to: ['Table'],
  },

  // ---------------------------------------------------------------- travel

  /**
   * Ein Weg zwischen zwei Orten (REQ-168). Der Sinneseindruck steht an der
   * Kante, nicht am Ziel: was man unterwegs hört und riecht, hängt vom Weg
   * ab — dieselbe Lichtung riecht von der Sumpfseite anders als vom Grat.
   * Genau das ist der Grund, warum eine Punktreise mehr ist als eine Liste
   * von Orten.
   */
  route: {
    type: 'route',
    label: 'leads to',
    inverseLabel: 'reached from',
    from: ['Place'],
    to: ['Place'],
    props: {
      type: 'object',
      properties: {
        hours: { type: 'number', title: 'Hours' },
        terrain: { type: 'string', title: 'Terrain' },
        signal: { type: 'string', format: 'long', title: 'What you sense on the way' },
        hidden: { type: 'boolean', title: 'Has to be found' },
        oneWay: { type: 'boolean', title: 'One way only' },
      },
    },
  },

  // ---------------------------------------------------------------- layers

  /**
   * Wozu ein Artikel gehört (REQ-005). Ohne diese Kante gehört er der
   * Kampagne selbst und ist immer da — das ist der Normalfall und soll
   * keine Zeile kosten.
   *
   * `mode: removes` nimmt etwas aus dem Stapel, das eine niedrigere Ebene
   * mitbringt. Löschen ginge nicht: der Artikel gehört der anderen Ebene,
   * und beim nächsten Import wäre er wieder da.
   */
  inLayer: {
    type: 'inLayer',
    label: 'from',
    inverseLabel: 'brings',
    from: ['*'],
    to: ['Layer'],
    props: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          title: 'Mode',
          enum: ['adds', 'removes'],
          default: 'adds',
        },
        addedAt: { type: 'string', title: 'Added at' },
      },
    },
  },

  /**
   * Welche Ebenen diese Kampagne aufschaltet, in welcher Reihenfolge
   * (REQ-006). An der Kampagne und nicht an der Ebene, weil zwei Kampagnen
   * dieselbe Ebene verschieden hoch hängen dürfen.
   */
  activates: {
    type: 'activates',
    label: 'runs on',
    inverseLabel: 'used by',
    from: ['Campaign'],
    to: ['Layer'],
    props: {
      type: 'object',
      properties: {
        order: { type: 'number', title: 'Order' },
      },
    },
  },

  /** Eine Kopie mit Herkunft (REQ-008) — sie ersetzt nichts. */
  variantOf: {
    type: 'variantOf',
    label: 'variant of',
    inverseLabel: 'has variants',
    from: ['*'],
    to: ['*'],
    cardinality: 'one',
  },

  /**
   * Eine Fassung, die eine andere ersetzt (REQ-009), solange ihre Ebene
   * aufgeschaltet ist. Der Unterschied zur Variante ist die Absicht: eine
   * Variante steht daneben, eine Überschreibung tritt an die Stelle.
   */
  overrides: {
    type: 'overrides',
    label: 'replaces',
    inverseLabel: 'replaced by',
    from: ['*'],
    to: ['*'],
    cardinality: 'one',
    props: {
      type: 'object',
      properties: {
        scope: { type: 'string', title: 'Scope' },
        note: { type: 'string', title: 'Why' },
      },
    },
  },

  // ------------------------------------------------- Beziehungen

  /**
   * Ein laufender Handwerksgang (REQ-184). Er hängt an beiden Enden — an
   * dem, der arbeitet, und an dem Rezept — also steht er an einer Kante,
   * wie die Tragestufe im Inventar. Kein Artikel: ein Gang ist vorbei, wenn
   * er vorbei ist, und ein Artikel, den man anschliessend löscht, war
   * keiner.
   *
   * `put` ist das Stück, an dem alles hängt: **das Material wird
   * angehängt, während der Gang läuft**, nicht am Anfang hineingelegt. Es
   * ging einmal am Anfang hinein, und das hiess, dass anfangen nur konnte,
   * wer schon alles hatte — am Tisch ist es andersherum. Tage lassen sich
   * von Anfang an arbeiten; fertig wird es nicht, bevor alles drin ist.
   *
   * Und nur weil etwas drin liegt, kann ein Fehlschlag etwas kosten und
   * `onFailure` mehr sein als eine Zeile.
   */
  crafting: {
    type: 'crafting',
    label: 'working on',
    inverseLabel: 'worked on by',
    from: ['Creature', 'NPC', 'PlayerCharacter', 'Party'],
    to: ['Recipe'],
    props: {
      type: 'object',
      properties: {
        day: { type: 'number', title: 'Days done', default: 0 },
        days: { type: 'number', title: 'Days needed', default: 1 },
        put: { type: 'array', title: 'Materials put in so far' },
        rolls: { type: 'array', title: 'Rolls' },
      },
    },
  },

  /**
   * Was einer vom anderen hält (REQ-030, 081) — und mehr ist es nicht.
   *
   * Es gab hier einmal eine gerechnete Leiter: Taten als eigene Artikel,
   * ein Gewicht je Tat, ein Ausgangswert, und daraus eine Zahl von −3 bis
   * +3. Das war zu viel Maschinerie für eine Frage, die am Tisch in einem
   * Satz beantwortet wird. Geblieben ist **eine Kante mit Marken**: die
   * Gedanken, die der eine über den anderen hat.
   *
   * Die Marken sind Worte und keine Aufzählung im Register. Was jemand
   * vom anderen hält, ist Kampagneninhalt — „schuldet mir was",
   * „misstraut mir seit Nashkel" —, und eine feste Liste hätte entweder
   * zwanzig Einträge oder die falschen drei.
   *
   * Sie steht beim Urteilenden, nicht beim Beurteilten: „das Auge hält von
   * euch nichts" ist eine Aussage über das Auge. Die Gegenrichtung ist
   * eine eigene Kante und darf etwas ganz anderes sagen — genau da wird es
   * interessant (REQ-081): einer traut, der andere nicht.
   */
  regards: {
    type: 'regards',
    label: 'regards',
    inverseLabel: 'judged by',
    from: ['Creature', 'NPC', 'PlayerCharacter', 'Party', 'Faction'],
    to: ['Creature', 'NPC', 'PlayerCharacter', 'Party', 'Faction'],
    props: {
      type: 'object',
      properties: {
        tags: { type: 'array', title: 'Thoughts', items: { type: 'string' } },
        note: { type: 'string', title: 'Why' },
      },
    },
  },
};
