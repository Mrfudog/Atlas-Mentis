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
    /* **Was dieser Statblock anders macht** (D51): ein Biss ist ein Artikel
       für alle, die beissen; die Kante trägt nur, was hier abweicht —
       andere Würfel, Reichweite, ein Zusatzschaden, ein Satz nur für
       diesen. `toHit` und `damageFlat` sind die **Buchzahl**, wo sie nicht
       aus der Rechnung folgt: gezeigt wird das Buch, und dass die Zahl
       fest steht, sieht man ihr an (`attackNumbers` im Modell). */
    props: {
      type: 'object',
      properties: {
        vars: { type: 'object', title: 'Variable bindings' },
        ability: { type: 'string', title: 'Ability', enum: ['str', 'dex', 'con', 'int', 'wis', 'cha', 'finesse', 'spell'] },
        damageDice: { type: 'string', title: 'Damage dice' },
        damageType: { type: 'string', title: 'Damage type', enumRef: 'DamageType' },
        reach: { type: 'number', min: 0, unit: 'ft', title: 'Reach' },
        range: { type: 'string', format: 'measure', unit: 'ft', title: 'Range' },
        target: { type: 'string', title: 'Target' },
        toHitBonus: { type: 'number', title: 'To-hit bonus', format: 'signed' },
        damageBonus: { type: 'number', title: 'Damage bonus', format: 'signed' },
        extraDamageDice: { type: 'string', title: 'Extra damage dice' },
        extraDamageType: { type: 'string', title: 'Extra damage type', enumRef: 'DamageType' },
        toHit: { type: 'number', title: 'To hit (book, fixed)', format: 'signed' },
        damageFlat: { type: 'number', title: 'Damage modifier (book, fixed)', format: 'signed' },
        note: { type: 'string', format: 'long', title: 'Only here' },
      },
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
    /* **Jede Kreatur**, nicht nur ein NSC: ein Spielercharakter hat
       dieselben Zahlen wie ein Monster und mehr darüber hinaus. Solange
       hier nur der NSC stand, konnte er gar keinen Statblock haben und musste
       seine Zahlen selbst tragen — die zweite Form für dieselbe Sache. */
    to: ['Creature'],
    /* **`one`: ein Statblock gehört einer Kreatur.** Dreissig Wachen
       teilen sich nicht einen Bogen — dann wäre jede Änderung an Wache 7
       eine an allen dreissig —, sondern lesen je ihre **Instanz** einer
       Vorlage (`instanceOf`): was gleich ist, kommt von der Vorlage, was
       abweicht, steht an der Instanz. Für einen Tag stand hier `many`, und
       die Seite warnte „shared by 30"; die Warnung beschrieb genau den
       Fall, den niemand wollte. */
    cardinality: 'one',
    /* **An der Kreatur liest sich das wie ein Feld.** Ihre Zahlen stehen am
       Statblock, und der ist ein eigener Artikel — austauschbar (Wolfsgestalt,
       verzauberte Fassung), aus einer Vorlage gezogen (dreissig Wachen, eine
       Vorlage). Für die Kreatur ist er trotzdem kein Verweis auf etwas
       Fremdes, sondern der Teil von ihr, der woanders wohnt. Also zeigt das
       Register seine Felder an der Kreatur mit, und die Artikelseite lässt
       sie dort bearbeiten, statt auf einen zweiten Artikel zu springen. */
    asField: 'to',
  },

  /**
   * **Die Stufe eines Zustands** (D48): „Exhaustion 3" ist Stufe 3 von
   * „Exhaustion". Dasselbe Muster trägt die Stadien einer Krankheit. Die
   * Zustandsliste hält höchstens eine Stufe je Grundzustand; ändert sich
   * die Stufe, wird ersetzt (gleicher `stageOf`, `stage ± 1`).
   */
  stageOf: {
    type: 'stageOf',
    label: 'stage of',
    inverseLabel: 'has stages',
    from: ['Condition'],
    to: ['Condition'],
    cardinality: 'one',
  },

  /**
   * **Wirkungen zwischen Regeln** (D48): gelähmt *bewirkt* kampfunfähig,
   * kampfunfähig *verbietet* Reaktionen. Gespeichert wird vorwärts; die
   * Gegenfrage („was verbietet mir Reaktionen?") ist eine Abfrage.
   * **Ausgewertet wird vorerst nichts** — die Kanten sind Daten, die der
   * Bogen anzeigt. Der Importer legt sie nicht an: dass ein Text einen
   * anderen Zustand nennt, heisst nicht, dass er ihn bewirkt.
   */
  affects: {
    type: 'affects',
    label: 'affects',
    inverseLabel: 'affected by',
    from: ['Rule'],
    to: ['Rule'],
    props: {
      type: 'object',
      properties: {
        effect: {
          type: 'string',
          title: 'Effect',
          enum: ['imposes', 'prevents', 'limits', 'advantage', 'disadvantage', 'triggers'],
        },
        on: { type: 'string', suggest: true, title: 'On' },
        note: { type: 'string', title: 'Note' },
      },
    },
  },

  /** Wer an eine Gottheit glaubt (M7). Die Anhänger sind die Gegenrichtung. */
  worships: {
    type: 'worships',
    label: 'worships',
    inverseLabel: 'worshipped by',
    from: ['Creature', 'Faction'],
    to: ['Deity'],
  },

  /**
   * **Wer einen Zauber wirkt, und wie (M2).** Der Zauber steht einmal da;
   * die Kante sagt, was er beim Wirkenden ist: vorbereitet, bekannt,
   * angeboren oder in einem Gegenstand gespeichert. `uses` ist die
   * Häufigkeit, wie sie im Statblock steht („at will", „3/day"), `level`
   * der Grad, auf dem er so gewirkt wird, `charges` was ein Gegenstand
   * dafür verbraucht (der Zauberstab der Magischen Geschosse: 1).
   *
   * Vom Statblock und nicht von der Kreatur: die Zahlen und das
   * Zauberwirken wohnen dort. Seit P4 auch von der Unterklasse und der
   * Abstammung: Domänenzauber des Klerikers, das angeborene Thaumaturgy
   * des Tieflings — mit `fromLevel`, ab welcher Klassen- bzw. Figurenstufe.
   */
  casts: {
    type: 'casts',
    label: 'casts',
    inverseLabel: 'cast by',
    from: ['Statblock', 'PlayerCharacter', 'Item', 'Subclass', 'Ancestry'],
    to: ['Spell'],
    props: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          title: 'How',
          enum: ['prepared', 'known', 'innate', 'item'],
        },
        uses: { type: 'string', suggest: true, title: 'Uses' },
        level: { type: 'number', min: 0, max: 9, title: 'At level' },
        charges: { type: 'number', min: 0, title: 'Charges per cast' },
        fromLevel: { type: 'number', min: 1, max: 20, title: 'From level' },
      },
    },
  },

  /**
   * **Was ein Statblock in der Hand hat** (M5): der Goblin führt Krummsäbel
   * und Kurzbogen. Ein Verweis auf den Gegenstand aus dem Buch und kein
   * Inventar — das hat eine Figur am Tisch (`carries`), nicht eine Vorlage.
   */
  equips: {
    type: 'equips',
    label: 'equips',
    inverseLabel: 'equipped by',
    from: ['Statblock'],
    to: ['Item'],
  },

  // ------------------------------------------------------------ charakterbau

  /** Zu welcher Klasse eine Unterklasse gehört (M3). */
  subclassOf: {
    type: 'subclassOf',
    label: 'subclass of',
    inverseLabel: 'subclasses',
    from: ['Subclass'],
    to: ['Class'],
    cardinality: 'one',
  },

  /** Hill Dwarf ist eine Unterart von Dwarf (M3). */
  subraceOf: {
    type: 'subraceOf',
    label: 'subrace of',
    inverseLabel: 'subraces',
    from: ['Ancestry'],
    to: ['Ancestry'],
    cardinality: 'one',
  },

  /**
   * **Eine Figur hat Klassen, jede mit ihrer Stufe** (M3). Mehrklassig ist
   * zwei Kanten: Kämpfer 3 und Magier 2. Die Stufe der Figur ist die Summe
   * (`sum(hasClass.level)`, gerechnet, D8); die Unterklasse steht an der
   * Kante, weil sie zu **dieser** Klasse der Figur gehört.
   */
  hasClass: {
    type: 'hasClass',
    label: 'class',
    inverseLabel: 'taken by',
    from: ['PlayerCharacter'],
    to: ['Class'],
    props: {
      type: 'object',
      required: ['level'],
      properties: {
        level: { type: 'number', min: 1, max: 20, title: 'Level' },
        subclass: {
          type: 'string',
          format: 'link',
          title: 'Subclass',
          target: { interfaces: ['Subclass'] },
        },
      },
    },
  },

  /** Die Abstammung einer Figur — eine (M3). */
  hasAncestry: {
    type: 'hasAncestry',
    label: 'ancestry',
    inverseLabel: 'ancestry of',
    from: ['PlayerCharacter'],
    to: ['Ancestry'],
    cardinality: 'one',
  },

  /** Der Hintergrund einer Figur — einer (M3). */
  hasBackground: {
    type: 'hasBackground',
    label: 'background',
    inverseLabel: 'background of',
    from: ['PlayerCharacter'],
    to: ['Background'],
    cardinality: 'one',
  },

  /**
   * **Was eine Figur gewählt hat** (REQ-238, E-015 a): je Wahl eine Kante
   * auf den Artikel, der fragt, mit der `id` der Wahl und den Antworten
   * (Namen, Artikel-Ids oder der Schlüssel einer Möglichkeit). Die Figur
   * kopiert nichts — was die Antworten ergeben, wird beim Lesen gerechnet
   * (`chosenResult`, D8), also erreicht eine Änderung am Artikel jede
   * Figur. Eine Antwort, deren Wahl es nicht mehr gibt, ist verwaist und
   * bleibt stehen, bis jemand sie löscht.
   */
  chose: {
    type: 'chose',
    label: 'chose',
    inverseLabel: 'chosen by',
    from: ['PlayerCharacter'],
    to: ['Choices'],
    props: {
      type: 'object',
      required: ['choice'],
      properties: {
        choice: { type: 'string', title: 'Choice' },
        picks: { type: 'array', items: { type: 'string' }, title: 'Picks' },
      },
    },
  },

  /**
   * **Was Klasse, Abstammung, Hintergrund oder Talent mitbringen** (M3):
   * Merkmale, Aktionen, Zustände — jede Regel. Die Stufe steht an der
   * Kante, nicht am Merkmal: „Ability Score Improvement" ist ein Artikel,
   * den der Kämpfer auf Stufe 4, 6, 8, 12, 14, 16 und 19 bekommt (D50).
   *
   * Das ist die Kante, die der Arbeitsplan `featureOf` nannte — nur
   * vorwärts vom Gebenden aus. Beide Richtungen als eigene Kanten wären
   * ein Gegenstück, das verwaist.
   */
  grants: {
    type: 'grants',
    label: 'grants',
    inverseLabel: 'granted by',
    from: ['Class', 'Subclass', 'Ancestry', 'Background', 'Feat'],
    to: ['Rule'],
    props: {
      type: 'object',
      properties: {
        level: { type: 'number', min: 1, max: 20, title: 'At level' },
      },
    },
  },

  /** Weapon properties are pooled rules, referenced rather than copied. */
  hasProperty: {
    type: 'hasProperty',
    label: 'has property',
    inverseLabel: 'property of',
    from: ['Weapon', 'Item', 'Armor'],
    to: ['ItemProperty'],
  },

  /* `NPC` stand hier, solange es die Art gab. Jetzt ist eine Kreatur die
     Art, und `kind` sagt, was für eine — eine Kante, die auf den Namen
     einer verschwundenen Art zeigt, gilt für nichts. */
  owes: {
    type: 'owes',
    label: 'owes',
    inverseLabel: 'creditor of',
    from: ['Creature'],
    to: ['Creature'],
  },

  memberOf: {
    type: 'memberOf',
    label: 'member of',
    inverseLabel: 'members',
    from: ['Creature'],
    to: ['Faction'],
    /* Der Rang steht an der Kante: dieselbe Figur ist in der einen Fraktion
       Meisterin und in der anderen Novizin. Das Wort kommt aus
       `Faction.ranks` (A7, REQ-203). */
    props: {
      type: 'object',
      properties: {
        rank: { type: 'string', title: 'Rank' },
        note: { type: 'string', title: 'Note' },
      },
    },
  },

  livesIn: {
    type: 'livesIn',
    label: 'lives in',
    inverseLabel: 'residents',
    from: ['Creature'],
    to: ['Place'],
  },

  /**
   * One containment edge for everything that nests, rather than a second
   * hierarchy beside it: a chapter sits in an arc the way a room sits in a
   * building, and a quest hangs off the story it belongs to. Widening the
   * ends of an existing edge keeps one set of backlinks, one `contains`.
   *
   * **Eine Spur der Weltgeschichte enthält ihre Ereignisse über diese
   * Kante** (REQ-220, D57): eine Schlacht ist Teil des Kriegs, der Krieg
   * Teil des Zeitalters, und ein Ereignis am Tisch Teil der Kampagne. Nicht
   * über den Zeitraum — sonst läge jede Hochzeit im Norden im Krieg im
   * Süden.
   *
   * **Ein Board gehört über diese Kante zu seinem Geschichtsartikel**
   * (REQ-205): das Board der Sitzung ist Teil der Sitzung, und der
   * Brotkrumenpfad „Kampagne › Kapitel › Sitzung" ist dieselbe Kette, an
   * der auch das Board hängt. Eine eigene Kante `boardOf` wäre eine zweite
   * Hierarchie neben dieser — mit eigenen Rückbezügen, die niemand neben
   * „contains" sucht. Ein Board ohne die Kante ist ein Regel-Board.
   */
  partOf: {
    type: 'partOf',
    label: 'part of',
    inverseLabel: 'contains',
    from: ['Place', 'Story', 'Quest', 'Event', 'Board'],
    to: ['Place', 'Story', 'Event'],
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

  /* Hier stand `playedBy` (Spielerfigur → `*`): die eine Kante, die aus
     der Fiktion hinauszeigte. Wer eine Figur spielt, ist eine Angabe über
     ein Konto und steht dort (`app_user_actor`), nicht in einem Artikel —
     Abgleich A1, REQ-199. Im Bestand hat sie nie jemand gesetzt. */

  memberOfParty: {
    type: 'memberOfParty',
    label: 'in the party',
    inverseLabel: 'members',
    from: ['Creature'],
    to: ['Party'],
  },

  /**
   * **Die Gruppe hängt an der Kampagne, und ihre Figuren darüber** (A8,
   * 7.10.). Eine Party ist das Figurengefüge einer Runde; eine andere
   * Konstellation gibt es nicht. Eine Kampagne darf mehrere haben (zwei
   * Tische in derselben Welt), eine Party gehört genau einer — darum
   * `one`. Die laufende Kampagne findet ihre Gruppe hierüber, nicht über
   * die erste Party, die im Speicher steht.
   */
  partyOf: {
    type: 'partyOf',
    label: 'party of',
    inverseLabel: 'parties',
    from: ['Party'],
    to: ['Campaign'],
    cardinality: 'one',
  },

  carries: {
    type: 'carries',
    label: 'carries',
    inverseLabel: 'carried by',
    /* Ein Gegenstand trägt eins, wenn er ein Behälter ist (M4): der
       Rucksack hat sein Raster, der Köcher seine Form. */
    from: ['Creature', 'Party', 'Item'],
    to: ['Inventory'],
    cardinality: 'one',
    /* Dasselbe am anderen Ende: das Inventar ist ein eigener Artikel, weil
       es den Träger wechselt — aber wer eine Figur aufschlägt, will ihre
       Sachen sehen und nicht einen Verweis darauf. */
    asField: 'from',
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
          /* `ground`: fallen gelassen (REQ-225, D58) — liegt der Figur zu
             Füssen, gehört ihr weiter und steht weiter in ihrem Inventar,
             ohne Platz und ohne Raster. Aufheben heisst: wieder hinlegen. */
          enum: ['held', 'worn', 'belt', 'pack', 'ground', 'stored'],
          default: 'pack',
        },
        /* **Die Plätze nach Basils Blatt** (REQ-214, D54): Kopf, Schultern,
           Torso, rechte und linke Hand (beide nehmen alles), Beine,
           Stiefel, Gurt mit zwei Holstern, je vier Ringe an jeder Hand,
           vier Halsketten. `hands` (Handschuhe) steht nicht auf dem Blatt
           und bleibt, bis die Verwaltung es anders sagt. Aus `cloak`,
           `neck`, `ring1`, `ring2` wurden `shoulders`, `neck1`, `ringR1`,
           `ringL1` — Wanderung: `prototype/migration/plaetze-nach-dem-blatt.mjs`.
           Wie schnell etwas von einem Platz kommt, sagt die Einstellung
           `slotDraw`, nicht diese Liste. */
        slot: {
          type: 'string',
          title: 'Body slot',
          enum: ['head', 'shoulders', 'torso', 'hands', 'mainHand', 'offHand',
            'legs', 'feet', 'belt', 'holster1', 'holster2',
            'ringR1', 'ringR2', 'ringR3', 'ringR4', 'ringL1', 'ringL2', 'ringL3', 'ringL4',
            'neck1', 'neck2', 'neck3', 'neck4'],
        },
        gx: { type: 'number', title: 'Grid column' },
        gy: { type: 'number', title: 'Grid row' },
        /* Die Drehung im Raster schrieb der Prototyp schon immer; hier
           stand sie nicht (D54 zieht sie nach). */
        rot: { type: 'number', title: 'Rotation in degrees', default: 0 },
        attuned: { type: 'boolean', title: 'Attuned' },
        note: { type: 'string', title: 'Note' },
      },
    },
  },

  // ---------------------------------------------------------------- story

  /* `followsFrom` (Story → Story, one) stand hier neben `partOf` und
     `Time.sort`: die Reihenfolge der Sprossen sagt das Datum, die
     Hierarchie die Kante `partOf`. Nie gesetzt, weg (A15, 7.10.). */

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
    to: ['Creature', 'Statblock', 'Faction'],
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
    /* Eine einzelne Information **oder ein Bündel**: dieselbe Kante, weil
       es dieselbe Frage ist. Wer ein Bündel kennt, kennt alles darin. */
    from: ['Information', 'Knowledge'],
    // Eine Fraktion kann etwas erfahren — „das Auge weiss es“ ist eine
    // Frage, die eine Kampagne stellt (REQ-040).
    //
    // „Die Spieler dieser Kampagne“ sind eine Rolle am Konto, kein Träger:
    // `audience: players` sagt es. `Group` als vierter Träger ist weg (A8).
    to: ['Creature', 'Party', 'Faction'],
    /* An eine Fraktion darf die Zuteilung einen **Mindestrang** nennen
       (`Faction.ranks`): wer auf dieser Sprosse oder höher steht, weiss es.
       Ohne Rang weiss es jedes Mitglied. An einer Figur oder Gruppe sagt
       das Feld nichts (A7, REQ-203). */
    props: {
      type: 'object',
      properties: {
        rank: { type: 'string', title: 'From rank' },
      },
    },
  },

  /**
   * Was in einem Bündel steckt. Nur vorwärts gespeichert: „in welchen
   * Bündeln steckt diese Information" ist ein Rückbezug wie jeder andere.
   *
   * Nicht `owned`: dieselbe Information darf in zwei Bündeln stehen, und
   * ein Bündel zu löschen darf sie nicht mitnehmen.
   */
  includes: {
    type: 'includes',
    label: 'includes',
    inverseLabel: 'part of',
    from: ['Knowledge'],
    to: ['Information'],
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
        /* Versteckt (REQ-209): Spielende sehen das Token nicht, bis es
           aufgedeckt wird — von Hand oder entlang eines bestätigten Pfads.
           `stealth` ist, was die passive Wahrnehmung schlagen muss: der
           Heimlichkeitswurf einer Kreatur, der SG einer Falle. Es steht an
           der Kante, weil dieselbe Falle auf einer Karte offen liegt und
           auf der nächsten unter Laub. */
        hidden: { type: 'boolean', title: 'Hidden from players' },
        stealth: { type: 'number', title: 'Stealth (to notice)' },
      },
    },
  },

  /**
   * **Wo eine Zone liegt** (REQ-208, D56). Eine Form auf der Karte, die auf
   * ihre Zonenart zeigt — wie `territory`, und wie dort aufs Gitter
   * gerastert: am Tisch zählt, welche Quadrate Eis sind. Die Regel steht am
   * Artikel und gilt für jede Stelle, die auf ihn zeigt; was nur hier
   * gilt (schon entdeckt), steht an der Kante.
   */
  zone: {
    type: 'zone',
    label: 'zone',
    inverseLabel: 'lies on',
    from: ['Map'],
    to: ['ZoneKind'],
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
        /* Eine Zone mit `hiddenUntil` ist versteckt, bis jemand sie
           bemerkt; dann steht hier, dass sie es nicht mehr ist. */
        found: { type: 'boolean', title: 'Found' },
        note: { type: 'string', title: 'Note' },
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
   * Zustände und Notizen tragen ihre Dauer mit (REQ-212, D53): `rounds`
   * zählt herunter, wenn der Zug des Ankers anfängt oder endet. Ohne Dauer
   * vergisst sie der Tisch. RK und TP-Maximum stehen **nicht** hier, sondern
   * am Statblock der Instanz (REQ-211); `hp` ist der Stand im Kampf.
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
        /* Abschrift aus der Zeit vor D53. Gelesen wird das Maximum am
           Statblock (`participantStats`); dieses Feld nur, wo keiner hängt. */
        hpMax: { type: 'number', title: 'Maximum (without statblock)' },
        ally: { type: 'boolean', title: 'On the party’s side' },
        /* Zustände und Notizen mit Dauer (REQ-115, REQ-212, D53). Je Eintrag
           entweder `rule` (Id eines Artikels der Art `Condition`; der
           Schlüssel heisst aus alter Zeit so) oder `text` (eine Notiz), dazu
           `rounds` (wie oft der Zeitpunkt noch vorbeikommt), `anchor` (Id
           der Teilnehmerkante, an deren Zug gezählt wird; leer: der eigene),
           `at` (`start` | `end`; leer: `end`), `source` (wer ihn verhängt
           hat, als Text) und `hidden` (nicht für Spielende). Ohne `anchor`
           und `at` verhält sich ein Eintrag wie vor D53. Wie in
           `Vitals.conditions` höchstens eine Stufe je Grundzustand. */
        conditions: { type: 'array', title: 'Conditions and notes', items: { type: 'object' } },
        note: { type: 'string', title: 'GM note' },
        /* Die Spieleransicht (REQ-213, D53): gezeigt wird die Gruppe und wer
           `revealed` oder `involved` ist; ohne `identified` der Deckname. */
        revealed: { type: 'boolean', title: 'Revealed to the players' },
        involved: { type: 'boolean', title: 'Involved (has acted or been hit)' },
        identified: { type: 'boolean', title: 'Identified by the players' },
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

  /**
   * Was dabei zu holen ist. Nicht nur Gegenstände: was jemand *erfährt*, ist
   * genauso Beute, und manchmal die einzige — ein Brief im Nachlass, ein Name,
   * den der Sterbende noch sagt. Selten, aber nicht nie: ein Talent oder eine
   * Fertigkeit, die aus der Begegnung mitkommt.
   *
   * Deshalb zeigt die Kante auf `Feat` und `Skill` und nicht auf `Rule`: eine
   * Lauernde Aktion ist auch eine Regel, und sie ist keine Beute.
   */
  loot: {
    type: 'loot',
    label: 'loot',
    inverseLabel: 'found in',
    from: ['Encounter', 'Story', 'Quest'],
    to: ['Item', 'Information', 'Feat', 'Skill'],
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
  /* Seit M3 auch die Stufentabelle einer Klasse und die vier
     Charakterzug-Tabellen eines Hintergrunds: eine Tabelle ist ein Artikel
     mit Spalten (M8), und eine Liste am Typ wäre die zweite Tabelle. */
  tableFor: {
    type: 'tableFor',
    label: 'rolls on',
    inverseLabel: 'used at',
    from: ['Place', 'Story', 'Encounter', 'Class', 'Subclass', 'Ancestry', 'Background'],
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
  /** In welcher Welt die Kampagne spielt — und damit, in welchem Kalender (A11). */
  inWorld: {
    type: 'inWorld',
    label: 'in the world',
    inverseLabel: 'campaigns',
    from: ['Campaign'],
    to: ['World'],
    cardinality: 'one',
  },

  /**
   * **Was eine Kampagne zeigt** (E2, T-069): die Ebenen, die sie
   * aufschaltet, von unten nach oben (`props.order`). Was keine davon
   * bringt, steht nicht in ihren Listen — gelöscht ist es nicht. Die Kante
   * hiess „runs on", und die Leitung fand sie nicht, als nach dem Anlegen
   * einer Kampagne alle Artikel aus 5e.tools fehlten. Gepflegt wird sie
   * auf der Kampagnenseite (Liste mit Häkchen und Reihenfolge).
   */
  activates: {
    type: 'activates',
    label: 'Layers in play',
    inverseLabel: 'In play in',
    from: ['Campaign'],
    to: ['Layer'],
    props: {
      type: 'object',
      properties: {
        order: { type: 'number', title: 'Order' },
      },
    },
  },

  /**
   * **Eine Instanz liest ihre Vorlage.** Gespeichert wird an ihr nur, was
   * abweicht; gelesen wird beides zusammen (`resolveInstance` im Modell).
   * Eine Korrektur an der Vorlage erreicht jede Instanz, die das Feld nicht
   * selbst gesetzt hat. Wer den Wert der Vorlage einträgt, folgt ihr wieder.
   *
   * Anders als `variantOf`, das eine Kopie mit Herkunft ist und nichts
   * nachliest. Erlaubt ist es am Statblock und am Gegenstand (M4): das
   * +1-Langschwert am Tisch ist eine Instanz des Langschwerts, die nur
   * `bonusWeapon` und `rarity` selbst trägt. **Eine Instanz ist von
   * derselben Art wie ihre Vorlage** (`same`): ein Statblock liest keinen
   * Gegenstand. Eine weitere Art kommt in `from` dazu und braucht keine
   * Codeänderung.
   */
  instanceOf: {
    type: 'instanceOf',
    label: 'instance of',
    inverseLabel: 'instances',
    from: ['Statblock', 'Item'],
    to: ['same'],
    cardinality: 'one',
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
   * `put` ist das Stück, an dem alles hängt: **das Material wird beim
   * Start gebunden** (REQ-219, D55). Was das Rezept braucht und dabei ist,
   * verlässt das Inventar und steht hier — auch, was nicht verbraucht wird,
   * denn gebunden heisst: nicht zugleich für etwas anderes da. Bis D52 ging
   * nichts hinein, und angehängt wurde unterwegs (Aufgabe #34); das bleibt
   * für Material, das erst später dazukommt, und ein Gang aus der Zeit davor
   * ist dieselbe Kante mit weniger in `put`. Tage lassen sich von Anfang an
   * arbeiten; fertig wird es nicht, bevor alles drin ist.
   *
   * Was am Ende zurückkommt: was nicht verbraucht wird, immer; das Übrige
   * beim Misslingen und beim Abbruch nach `Recipe.onFailure`.
   */
  crafting: {
    type: 'crafting',
    label: 'working on',
    inverseLabel: 'worked on by',
    from: ['Creature', 'PlayerCharacter', 'Party'],
    to: ['Recipe'],
    props: {
      type: 'object',
      properties: {
        day: { type: 'number', title: 'Days done', default: 0 },
        days: { type: 'number', title: 'Days needed', default: 1 },
        put: { type: 'array', title: 'Materials bound to it' },
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
    /* `PlayerCharacter` stand hier daneben, obwohl die `extends`-Kette es
       abdeckt — eine Spielerfigur *ist* eine Kreatur (Abgleich A12). */
    from: ['Creature', 'Party', 'Faction'],
    to: ['Creature', 'Party', 'Faction'],
    props: {
      type: 'object',
      properties: {
        tags: { type: 'array', title: 'Thoughts', items: { type: 'string' } },
        note: { type: 'string', title: 'Why' },
      },
    },
  },
};
