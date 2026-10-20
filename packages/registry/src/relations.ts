import type { RelationDef } from '@nw/model';
import { TOOLS_ONLY } from './fieldgroups.js';

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
    means: 'A statblock is built from a pooled rule (an attack, a trait); the rule lists the statblocks that use it.',
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
    means: 'A statblock belongs to one creature; the creature reads its numbers from it.',
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
    means: 'A condition is a stage of another (exhaustion 3 of exhaustion); the base condition lists its stages.',
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
    means: 'A rule changes another rule (a feat that alters grappling); the changed rule lists what affects it.',
    intended: 'Apply the change in play: when the source rule is active, the effect it names should alter the target rule’s numbers or text where the target is used.',
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
    means: 'A creature or faction worships a deity; the deity lists its worshippers.',
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
   * Seit T-089 auch vom Talent: Drow High Magic wirkt Levitate einmal am Tag
   * wie die Abstammung ihr Thaumaturgy — `grants` hätte das „1/day"
   * verloren. Seit T-084 auch vom Kult (`Faction`) und vom Segen (`Rule`):
   * ihre Signaturzauber, die wirkt, wer ihm angehört oder ihn trägt.
   */
  casts: {
    type: 'casts',
    label: 'casts',
    inverseLabel: 'cast by',
    means: 'A statblock, character, item, subclass, ancestry, feat, cult or boon can cast a spell; the spell lists who casts it.',
    from: ['Statblock', 'PlayerCharacter', 'Item', 'Subclass', 'Ancestry', 'Feat', 'Faction', 'Rule'],
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
        /* Mit welchem Attribut (T-309): das Regelwerk sagt es je Quelle —
           der Tiefling wirkt mit CHA, auch wenn er Magier ist. Ohne Angabe
           das Attribut der Quelle, sonst das der Figur. */
        ability: { type: 'string', title: 'Spellcasting ability', enumRef: 'Ability' },
        level: { type: 'number', min: 0, max: 9, title: 'At level' },
        charges: { type: 'number', min: 0, title: 'Charges per cast' },
        fromLevel: { type: 'number', min: 1, max: 20, title: 'From level' },
      },
    },
  },

  /**
   * **Die Zauberliste einer Klasse** (T-212): welche Zauber ein Magier, ein
   * Kleriker, ein Hexenmeister mit Paktgeber lernen oder vorbereiten
   * *darf* — nicht, was er wirkt (das ist `casts`), und nicht, was er
   * bekommt (das wäre `grants`: dessen Ziele bringen ihre Wirkungen ohne
   * Bedingung an die Figur, `effectsAt`). Von der Unterklasse die
   * erweiterte Liste (Paktgeber, Eldritch Knight). `optional` sind die
   * Ergänzungen aus Tasha's (`classVariant` bei 5e.tools), die eine Kampagne
   * erlaubt oder nicht.
   *
   * „Usable by <Figur>" liest sie: ein Zauber auf der Liste einer Klasse der
   * Figur, bis zu dem Grad, den sie dort wirkt (`spellListRequirement`).
   */
  spellList: {
    type: 'spellList',
    label: 'spell list',
    inverseLabel: 'on the spell list of',
    means: 'A class or subclass has a spell on its spell list; the spell lists the classes that may learn it.',
    from: ['Class', 'Subclass'],
    to: ['Spell'],
    /* Am Zauber die erste Frage: welche Klasse ihn hat (T-212). */
    facet: { label: 'Class spell list', order: 0 },
    props: {
      type: 'object',
      properties: {
        optional: { type: 'boolean', title: 'Optional (expanded list)' },
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
    means: 'A statblock has an item equipped; the item lists who wears or wields it.',
    intended: 'Count equipped items: armour and shields should set AC, weapons should become attacks on the statblock.',
    from: ['Statblock'],
    to: ['Item'],
  },

  // ------------------------------------------------------------ charakterbau

  /** Zu welcher Klasse eine Unterklasse gehört (M3). */
  subclassOf: {
    type: 'subclassOf',
    label: 'subclass of',
    inverseLabel: 'subclasses',
    means: 'A subclass belongs to one class; the class lists its subclasses.',
    from: ['Subclass'],
    to: ['Class'],
    cardinality: 'one',
  },

  /** Hill Dwarf ist eine Unterart von Dwarf (M3). Die Herkunftsansicht
      liest sie (T-166): die Seite der Herkunft führt ihre Unterarten als
      Leiste. Dass eine Unterart erbt, was die Herkunft gewährt, tut noch
      niemand — das steht als Aufgabe am Brett, nicht als Versprechen hier. */
  subraceOf: {
    type: 'subraceOf',
    label: 'subrace of',
    inverseLabel: 'subraces',
    means: 'An ancestry is a subrace of another; the parent lists its subraces.',
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
    means: 'A player character has levels in a class; the class lists who took it.',
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
        /* **Was der Trefferwürfel je Stufe brachte** (T-194), ohne KON; der
           erste Eintrag die erste Stufe. Gewürfelt oder der Durchschnitt,
           sagt die Kampagne (`Campaign.hitPoints`). Das Maximum am
           Statblock rechnet daraus, wer KON ändert, würfelt nicht neu. */
        hp: { type: 'array', items: { type: 'number' }, title: 'Hit points per level' },
      },
    },
  },

  /** Die Abstammung einer Figur — eine (M3). */
  hasAncestry: {
    type: 'hasAncestry',
    label: 'ancestry',
    inverseLabel: 'ancestry of',
    means: 'A player character has one ancestry; the ancestry lists the characters of it.',
    from: ['PlayerCharacter'],
    to: ['Ancestry'],
    cardinality: 'one',
  },

  /** Der Hintergrund einer Figur — einer (M3). */
  hasBackground: {
    type: 'hasBackground',
    label: 'background',
    inverseLabel: 'background of',
    means: 'A player character has one background; the background lists the characters with it.',
    from: ['PlayerCharacter'],
    to: ['Background'],
    cardinality: 'one',
  },

  /**
   * **Welche Attributsverfahren eine Kampagne erlaubt** (E-016 a). Nennt
   * sie keines, gelten Standardreihe und Punktekauf
   * (`DEFAULT_ABILITY_METHODS`).
   */
  allowsMethod: {
    type: 'allowsMethod',
    label: 'allows ability method',
    inverseLabel: 'allowed in',
    means: 'A campaign allows a way of determining ability scores; the method lists the campaigns that allow it.',
    from: ['Campaign'],
    to: ['AbilityMethod'],
  },

  /**
   * **Welche Verfahren für die Startausrüstung eine Kampagne erlaubt**
   * (REQ-250, T-096). Nennt sie keines, gelten „Klasse und Hintergrund"
   * und „Startgold" (`DEFAULT_EQUIPMENT_METHODS`).
   */
  /**
   * **Welche Ersatzregeln eine Kampagne spielt** (T-197): Pflanzen statt
   * Reagenzien und dergleichen. Nennt sie keine, zählt nur, was das Rezept
   * nennt (`materialFit`).
   */
  allowsSubstitution: {
    type: 'allowsSubstitution',
    label: 'allows substitution',
    inverseLabel: 'allowed in',
    means: 'A campaign plays by a material substitution rule; the rule lists the campaigns that allow it.',
    from: ['Campaign'],
    to: ['Substitution'],
  },

  /**
   * **Ein Glossarbegriff erklärt einen Artikel** (T-242): „Poisoned" im
   * Glossar zeigt auf den Zustand, „Versatile" auf die Eigenschaft. Der
   * Begriff sagt in einem Satz, was er heisst; die Regel steht am Ziel.
   * Rückwärts liest eine Regel, welche Begriffe sie erklären — so findet
   * die Maske zu einem Zustand seinen Eintrag.
   */
  explains: {
    type: 'explains',
    label: 'explains',
    inverseLabel: 'explained by',
    means: 'A glossary term explains an article (a condition, a property, a rule); the article lists the terms that explain it.',
    from: ['GlossaryTerm'],
    to: ['*'],
  },

  allowsEquipment: {
    type: 'allowsEquipment',
    label: 'allows equipment method',
    inverseLabel: 'allowed in',
    means: 'A campaign allows a way of getting starting equipment; the method lists the campaigns that allow it.',
    from: ['Campaign'],
    to: ['EquipmentMethod'],
  },

  /**
   * **Der Gruppenpool** (E-016 a): einmal für die Gruppe gewürfelt, und
   * jede ihrer Figuren verteilt dieselben Werte selbst. Gewürfelt wird am
   * Server (`POST /api/abilities/roll`), und jeder Wurf steht im
   * Protokoll; wer gewürfelt hat, steht dort und nicht hier (REQ-199).
   */
  abilityPool: {
    type: 'abilityPool',
    label: 'rolled ability pool',
    inverseLabel: 'pool of',
    means: 'A party has rolled a pool of ability scores with a method; the method lists the parties that rolled with it.',
    from: ['Party'],
    to: ['AbilityMethod'],
    props: {
      type: 'object',
      required: ['values'],
      properties: {
        values: { type: 'array', items: { type: 'number' }, title: 'Scores' },
        rolls: { type: 'array', items: { type: 'string' }, title: 'Rolls' },
        at: { type: 'string', title: 'Rolled at' },
      },
    },
  },

  /**
   * **Was eine Figur gewählt hat** (REQ-238, E-015 a): je Wahl eine Kante
   * auf den Artikel, der fragt, mit der `id` der Wahl und den Antworten
   * (Namen, Artikel-Ids oder der Schlüssel einer Möglichkeit). Die Figur
   * kopiert nichts — was die Antworten ergeben, wird beim Lesen gerechnet
   * (`chosenResult`, D8), also erreicht eine Änderung am Artikel jede
   * Figur. Eine Antwort, deren Wahl es nicht mehr gibt, ist verwaist und
   * bleibt stehen, bis jemand sie löscht.
   *
   * An einem Merkmal, das mehrfach gewährt wird, sagen `by` und `level`,
   * zu welcher Kante `grants` die Antwort gehört (T-107, E-027): die
   * Attributssteigerung auf Stufe 4 und die auf 8 sind zwei Antworten.
   *
   * `items` füllt die offenen Stellen der gewählten Möglichkeit (T-162):
   * „two martial weapons of your choice" sind zwei Artikel-Ids, der Reihe
   * nach; geprüft wird beim Ausrüsten (`slotAccepts`).
   */
  chose: {
    type: 'chose',
    label: 'chose',
    inverseLabel: 'chosen by',
    means: 'A player character answered a choice (a skill, a feat, a subclass); the source of the choice lists who chose from it.',
    from: ['PlayerCharacter'],
    to: ['Choices'],
    props: {
      type: 'object',
      required: ['choice'],
      properties: {
        choice: { type: 'string', title: 'Choice' },
        picks: { type: 'array', items: { type: 'string' }, title: 'Picks' },
        by: { type: 'string', title: 'Granted by' },
        level: { type: 'number', min: 1, max: 20, title: 'At level' },
        items: { type: 'array', items: { type: 'string' }, title: 'Items for open slots' },
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
    means: 'A class, subclass, ancestry, background or feat grants a feature, from a level on; the feature lists what grants it.',
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
    means: 'A weapon, armour or item has a property (finesse, heavy); the property lists the items that have it.',
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
    means: 'A creature owes another something (a favour, a debt); the creditor lists who owes it.',
    from: ['Creature'],
    to: ['Creature'],
  },

  memberOf: {
    type: 'memberOf',
    label: 'member of',
    inverseLabel: 'members',
    means: 'A creature is a member of a faction, at a rank; the faction lists its members.',
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
    means: 'A creature lives in a place; the place lists its residents.',
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
    means: 'An article is part of a larger one (a room of a house, a scene of an arc, a book of a group); the larger one lists what it contains, in rank order.',
    /* `Encounter` (T-082): eine Begegnung hängt an ihrer Szene oder ihrem
       Kapitel — so stand es am Typ, die Kante liess es nicht zu. */
    /* `Rule` (T-270): eine Option hängt an ihrer Regel, die Regel an ihrem System. */
    from: ['Place', 'Story', 'Quest', 'Event', 'Board', 'Encounter', 'Layer', 'Chapter', 'BookPart', 'Rule'],
    /* `Layer` (E-022 b, T-088): eine Ebene hängt an ihrer Gruppe — einer
       Ebene mit `kind: 'group'`. Eine Ebene darf in mehreren Gruppen sein. */
    to: ['Place', 'Story', 'Event', 'Layer', 'Chapter', 'Rule'],
    /* **Die Reihenfolge der Teile steht an der Kante** (T-108): derselbe
       Vorlesetext steht im Kapitel an dritter Stelle und in der eigenen
       Szene an erster — eine Zahl am Teil gälte nur für eines davon. Ohne
       `rank` ist ein Teil angehängt (eine Begegnung an ihrer Szene) und
       steht nicht im Lesefluss. */
    props: {
      type: 'object',
      properties: {
        rank: { type: 'number', title: 'Order' },
      },
    },
  },

  /**
   * **Ein Kapitel und sein Arc** (T-108, E-029): ein Kapitel eines
   * offiziellen Abenteuers ist aus Buchsicht ein `Chapter` und aus
   * Geschichtssicht ein `Arc`. Die Kante geht vom Kapitel zum Arc und sagt
   * nur, dass beide dasselbe erzählen — ihre Teile (Szenen, Vorlesetexte,
   * Begegnungen) gibt es einmal, und beide zeigen auf sie.
   */
  chapterOf: {
    type: 'chapterOf',
    label: 'chapter of',
    inverseLabel: 'read as chapter',
    means: 'A chapter is read as a chapter of a story (the arc of an adventure); the story lists the chapters that read it.',
    from: ['Chapter'],
    to: ['Story'],
    cardinality: 'one',
  },

  controls: {
    type: 'controls',
    label: 'controls',
    inverseLabel: 'controlled by',
    means: 'A faction controls a place; the place lists who controls it.',
    from: ['Faction'],
    to: ['Place'],
  },

  /**
   * **Was ein Laden führt** (T-129). Menge, Preis und Abschlag stehen an
   * der Kante, nicht am Gegenstand: dieselbe Laterne kostet im einen Laden
   * mehr als im anderen, und ein Feld am Gegenstand trüge nur eine der
   * beiden Wahrheiten. `price` ersetzt den Listenpreis (`Item.copperPrice`,
   * ebenfalls in Kupfer), `mod` schlägt etwas ab oder auf (`−1 gp`,
   * `−10 %`). Leere Menge heisst: so viele, wie man will; 0 ist
   * ausverkauft.
   */
  sells: {
    type: 'sells',
    label: 'sells',
    inverseLabel: 'sold at',
    means: 'A shop sells an item, with quantity, its own price and mark-down; the item lists where it is sold.',
    from: ['Shop'],
    to: ['Item'],
    props: {
      type: 'object',
      properties: {
        qty: { type: 'number', min: 0, title: 'Quantity' },
        price: { type: 'number', min: 0, title: 'Price in copper (instead of list price)' },
        mod: { type: 'string', title: 'Price modifier (−1 gp, −10 %)' },
        available: { type: 'boolean', title: 'Available', default: true },
      },
    },
  },

  /**
   * **Ein Rabatt ist eine Kante vom Gebenden zum Empfangenden** (T-129).
   * Geben kann der Laden selbst, eine Fraktion, die ihn kontrolliert
   * (`controls`), oder einer seiner Ladenhalter (`shopkeeper`) — so gibt
   * die Gilde in jedem ihrer Läden dasselbe, ohne dass es an jedem Laden
   * steht. Empfangen kann eine Figur, eine Gruppe (die der Kampagne) oder
   * eine Fraktion; an einer Fraktion darf die Kante einen Mindestrang
   * nennen (`rank`, ein Wort aus `Faction.ranks`, wie bei `knownBy`, A7):
   * was der Zirkel bekommt, bekommt der Novize noch nicht. Eine Fraktion,
   * die ihren eigenen Mitgliedern Rabatt gibt, zeigt auf sich selbst.
   * Gerechnet wird beim Lesen (D8, `shopWares`).
   */
  discount: {
    type: 'discount',
    label: 'discount for',
    inverseLabel: 'discount from',
    means: 'A shop, a faction or a shopkeeper gives a creature, a party or a faction (from a rank) a price modifier at its shops; the receiver lists who gives it one.',
    from: ['Shop', 'Faction', 'Creature'],
    to: ['Creature', 'Party', 'Faction'],
    props: {
      type: 'object',
      properties: {
        mod: { type: 'string', title: 'Price modifier (−10 gp, −10 %)' },
        rank: { type: 'string', title: 'From rank (faction)' },
        note: { type: 'string', title: 'Why' },
      },
    },
  },

  /** Wer einen Laden hält (T-129): seine Rabatte und seine Beziehungen gelten dort. */
  shopkeeper: {
    type: 'shopkeeper',
    label: 'shopkeeper',
    inverseLabel: 'keeps shop',
    means: 'A shop is kept by a creature, whose discounts count at the shop; the creature lists the shops it keeps.',
    from: ['Shop'],
    to: ['Creature'],
  },

  describedIn: {
    type: 'describedIn',
    label: 'described in',
    inverseLabel: 'describes',
    means: 'An article is described in another article or a section of a book; that one lists what it describes.',
    from: ['*'],
    /* Auch ein Abschnitt eines Buchs (`BookPart`, eine Überschrift) und
       eine Szene: ein Ort aus einem Buch zeigt auf den Text, der ihn
       beschreibt (T-175). */
    to: ['Article', 'Story', 'BookPart'],
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
    means: 'A creature is in a party; the party lists its members.',
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
    means: 'A party plays in one campaign; the campaign lists its parties.',
    from: ['Party'],
    to: ['Campaign'],
    cardinality: 'one',
  },

  carries: {
    type: 'carries',
    label: 'carries',
    inverseLabel: 'carried by',
    means: 'A creature, party or item carries one inventory; the inventory knows who carries it.',
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
    means: 'An inventory holds an item, with quantity and place in the grid; the item lists where it is held.',
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
        /* **Reserviert für …** (T-127, für den Handwerksauftrag T-128): der
           Artikel, der diesen Stapel gerade braucht. Das Stück bleibt, wo es
           liegt; verschieben lässt es sich nicht, bis die Reservierung fällt
           (`reservedFor`, `moveHeld`). */
        reservedFor: { type: 'string', format: 'link', target: { interfaces: ['Identity'] }, title: 'Reserved for' },
        /* **Für welchen Bestandteil** (T-197): die `needs`-Kante des
           Rezepts, für die das Stück reserviert ist — ein Ersatzstück oder
           eines aus einer Gruppe ist nicht der Gegenstand, den das Rezept
           nennt, und die Abrechnung muss wissen, ob es verbraucht wird. */
        forNeed: { type: 'string', title: 'For the recipe’s material' },
        /* **Noch nicht verstaut** (T-140): gekauft, erbeutet, geschenkt —
           liegt vor der Figur und noch nicht in ihren Sachen. Verstaut ist
           es im Raster, an einem Platz, in einem Behälter. Wie lange es so
           liegen darf, sagt `Campaign.stowing`; danach steht es als
           `leftBehind` an der Sitzung. */
        unstowed: { type: 'boolean', title: 'Not stowed yet' },
      },
    },
  },

  /**
   * **Liegengelassen** (T-140): was bis zum Sitzungsende (oder bis der
   * Tisch weiterzog) nicht verstaut war, bleibt an der Sitzung zurück —
   * nicht gelöscht, nur nicht mehr im Inventar. Die Kante steht an der
   * Sitzung, weil dort der Ort ist, an dem es liegt; `from` nennt das
   * Inventar, aus dem es kam. Aufheben nimmt die Kante weg und legt den
   * Stapel unverstaut zurück (`pickUp`).
   */
  leftBehind: {
    type: 'leftBehind',
    label: 'left behind',
    inverseLabel: 'left behind at',
    means: 'A session keeps what was not stowed in time, with quantity and the inventory it came from; the item lists where it was left behind.',
    from: ['Session'],
    to: ['Item'],
    props: {
      type: 'object',
      properties: {
        qty: { type: 'number', min: 1, title: 'Quantity' },
        from: { type: 'string', format: 'link', target: { interfaces: ['Inventory'] }, title: 'Left by' },
        at: { type: 'string', title: 'When' },
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
    means: 'A quest is given by a creature or faction; they list the quests they give.',
    from: ['Quest'],
    to: ['Creature', 'Faction'],
  },

  questAbout: {
    type: 'questAbout',
    label: 'concerns',
    inverseLabel: 'concerned by',
    means: 'A quest concerns an article; the article lists the quests about it.',
    from: ['Quest'],
    to: ['*'],
  },

  happensAt: {
    type: 'happensAt',
    label: 'happens at',
    inverseLabel: 'scenes here',
    means: 'A story happens at a place; the place lists the scenes there.',
    from: ['Story'],
    to: ['Place'],
  },

  features: {
    type: 'features',
    label: 'features',
    inverseLabel: 'appears in',
    means: 'A story or encounter features a creature, statblock, faction or hazard; they list where they appear.',
    /* Seit T-184 auch die Begegnung: wer an einem Gespräch beteiligt ist
       (die Haltung steht als `regards` bei der Kreatur), welche Falle eine
       Fallenbegegnung ist — die Falle steht als `Hazard` für sich. */
    from: ['Story', 'Encounter'],
    to: ['Creature', 'Statblock', 'Faction', 'Hazard'],
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
    means: 'An article has a piece of information about it; the information says what it is about.',
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
    means: 'Information or knowledge is known by a creature, party or faction (from a rank) — or by every character with an ancestry, background, class, subclass or feat; they list what they know.',
    /* Eine einzelne Information **oder ein Bündel**: dieselbe Kante, weil
       es dieselbe Frage ist. Wer ein Bündel kennt, kennt alles darin. */
    from: ['Information', 'Knowledge'],
    // Eine Fraktion kann etwas erfahren — „das Auge weiss es“ ist eine
    // Frage, die eine Kampagne stellt (REQ-040).
    //
    // „Die Spieler dieser Kampagne“ sind eine Rolle am Konto, kein Träger:
    // `audience: players` sagt es. `Group` als vierter Träger ist weg (A8).
    //
    // Herkunft, Hintergrund, Klasse, Unterklasse und Talent (T-285,
    // REQ-351): jede Figur, die das ist oder gewählt hat, weiss es — ein
    // Schritt weit, wie Gruppe und Fraktion (`knowledgeHolders`).
    to: ['Creature', 'Party', 'Faction', 'Ancestry', 'Background', 'Class', 'Subclass', 'Feat'],
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
    means: 'A bundle of knowledge includes a piece of information; the information lists the bundles it is part of.',
    from: ['Knowledge'],
    to: ['Information'],
  },

  // ------------------------------------------------------------------ maps

  mapOf: {
    type: 'mapOf',
    label: 'map of',
    inverseLabel: 'maps',
    means: 'A map shows a place or story; the place lists its maps.',
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
    means: 'A map lies inside another map, at a rectangle; the outer map lists what you can zoom into.',
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
    means: 'A map has a marker for an article, at a point; the article lists the maps it is marked on.',
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
          enum: ['static', 'scenery', 'party', 'quest', 'play', 'passage'],
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
        /* An/aus in Play (T-305): die Laterne bleibt, wo sie steht, und
           behält ihre Radien — aus ist sie nur gerade. Gilt auch für das
           Licht, das das Ziel trägt (die Fackel in der Hand). */
        lightOff: { type: 'boolean', title: 'Light switched off' },
        /* Fix oder verschiebbar (T-306): ein Asset (`scenery`) steht fest,
           bis die Leitung es in der Bearbeitung verschiebt; mit `movable`
           wandert es auch in Play — an der Instanz, nicht an der Vorlage.
           An der Kante, weil dieselbe Kiste hier Kulisse und dort Hindernis
           ist, das man schiebt. */
        movable: { type: 'boolean', title: 'Movable in play' },
        /* Was das Asset hält (T-306), als Sperrart (`WALL_KINDS`): sein
           Umriss wird beim Lesen zu Sperren dieser Art. Leer: nichts. */
        blocks: { type: 'string', title: 'Blocks like', enum: ['wall', 'window', 'chasm', 'invisible'] },
        /* Versteckt (REQ-209): Spielende sehen das Token nicht, bis es
           aufgedeckt wird — von Hand oder entlang eines bestätigten Pfads.
           `stealth` ist, was die passive Wahrnehmung schlagen muss: der
           Heimlichkeitswurf einer Kreatur, der SG einer Falle. Es steht an
           der Kante, weil dieselbe Falle auf einer Karte offen liegt und
           auf der nächsten unter Laub. */
        hidden: { type: 'boolean', title: 'Hidden from players' },
        stealth: { type: 'number', title: 'Stealth (to notice)' },
        /* Vorplatziert (T-203): das Token steht für diese Begegnung bereit,
           versteckt, bis „Start encounter" sie beginnt und es aufdeckt. An
           der Kante, weil dieselbe Kreatur auf einer anderen Karte für eine
           andere Begegnung stehen kann. */
        encounter: { type: 'string', format: 'link', target: { interfaces: ['Encounter'] }, title: 'Prepared for encounter' },
        /* **Ebene und Übergang** (T-307, E-108). `floor`: auf welcher Ebene
           der Karte der Marker steht (leer: der ersten). Ein Marker
           `kind: 'passage'` ist ein Übergang — Treppe, Leiter, Brücke,
           Portal; die Kante zeigt auf die Zielkarte (dieselbe für Treppen),
           `toFloor`/`toX`/`toY` sagen Ebene und Punkt dort. `sight`:
           durchsehen oder nur durchgehen; `oneWay`: kein Weg zurück. */
        floor: { type: 'string', title: 'Floor' },
        passage: { type: 'string', title: 'Passage', enum: ['stairs', 'ladder', 'bridge', 'portal'] },
        toFloor: { type: 'string', title: 'Leads to floor' },
        toX: { type: 'number', title: 'Leads to X (0–1)' },
        toY: { type: 'number', title: 'Leads to Y (0–1)' },
        sight: { type: 'string', title: 'Sight through it', enum: ['through', 'none'], default: 'through' },
        oneWay: { type: 'boolean', title: 'One way' },
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
    means: 'A map has a zone of a kind (difficult terrain, darkness); the zone kind lists where it lies.',
    intended: 'Draw on the map screen and count it: a zone should change movement and sight where it lies.',
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
    means: 'A map shows an article’s territory as a shape; the article lists where it holds ground.',
    intended: 'Draw on the map screen: the shape in its colour over the map.',
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
    means: 'A recipe needs an item — or any piece of a material group — in a quantity; the item lists the recipes that use it.',
    from: ['Recipe'],
    /* Eine Materialgruppe (T-197) steht für „irgendein Reagenz ab
       ungewöhnlich" — welches Stück, wählt man beim Start. */
    to: ['Item', 'MaterialGroup'],
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
    means: 'A recipe yields one item; the item lists the recipe that makes it.',
    from: ['Recipe'],
    to: ['Item'],
    cardinality: 'one',
  },

  /**
   * **Womit gefertigt wird, wenn nicht wie im Buch** (T-122). Das Rezept
   * nennt Werkzeug, Attribut und SG seiner Quelle; eine Kampagne, eine
   * Gruppe oder eine Figur weicht davon ab, ohne das Rezept zu kopieren —
   * für ein Rezept (Kante zum Rezept) oder für jedes Rezept eines Werkzeugs
   * (Kante zum Werkzeug: „Kräuterkunde mit Weisheit"). Die Kante trägt nur,
   * was sie ändert; Spezifischeres schlägt Allgemeineres (`craftCheck`).
   * Das Werkzeug selbst tauscht nur eine Kante zum Rezept.
   */
  craftsWith: {
    type: 'craftsWith',
    label: 'crafts with',
    inverseLabel: 'crafted differently by',
    means: 'A campaign, party or creature crafts a recipe — or every recipe of a tool — with another tool, ability or DC than the source says; the recipe or tool lists who does.',
    from: ['Campaign', 'Party', 'Creature'],
    to: ['Recipe', 'Item'],
    props: {
      type: 'object',
      properties: {
        tool: { type: 'string', title: 'Tool instead', enumRef: 'Item', enumWhere: TOOLS_ONLY },
        ability: { type: 'string', title: 'Ability instead', enumRef: 'Ability' },
        dc: { type: 'number', title: 'DC instead' },
        note: { type: 'string', title: 'Note' },
      },
    },
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
    means: 'A board has an article placed on it as a card; the article lists the boards it lies on.',
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
    means: 'An encounter has a creature, statblock or party in the fight, with initiative and hit points; they list the fights they are in.',
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

  /** Wo sie stattfindet — damit der Initiative-Zeiger auf die Karte kann
      (REQ-144, T-117: `turnOf`, `/api/maps/:id/context`). */
  onMap: {
    type: 'onMap',
    label: 'fought on',
    inverseLabel: 'fights here',
    means: 'An encounter or story is fought on a map; the map lists what is fought there.',
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
    means: 'An encounter, story or quest has loot (an item, information, a feat), with quantity and chance; the loot lists where it is found.',
    intended: 'Roll and hand out: finishing the encounter should roll the chance and offer the loot to the party’s inventory or knowledge.',
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
    means: 'An event involves an article; the article lists the events it took part in.',
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
    means: 'A table has an entry, with a weight; the entry lists the tables it can be rolled on.',
    intended: 'Roll on the table: the weights should decide which entry a roll lands on.',
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
    means: 'A place, story, encounter or character option rolls on a table; the table lists where it is used.',
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
    means: 'A place leads to another, with travel hours and terrain; the other lists where it is reached from.',
    intended: 'Travel: moving the party along a route should advance the watch and day counters by its hours.',
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
    means: 'An article comes from a layer (a book, the campaign, homebrew); the layer lists what it brings.',
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
    means: 'A campaign plays in one world; the world lists its campaigns.',
    intended: 'Share the world: the campaign should read its calendar and history from this world.',
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
    means: 'A campaign puts a layer in play, in an order and mode; the layer lists the campaigns it is in play in.',
    from: ['Campaign'],
    to: ['Layer'],
    props: {
      type: 'object',
      properties: {
        order: { type: 'number', title: 'Order' },
        /* `compare` (T-092, E-021 d): die Ebene ist nicht im Spiel, ihre
           Fassungen stehen auf Wunsch an den Feldern und lassen sich als
           Überschreibung übernehmen. `off` (T-088): die Ebene ist aus,
           auch wenn eine aufgeschaltete Gruppe sie brächte. Ohne Angabe:
           im Spiel. */
        mode: { type: 'string', title: 'Mode', enum: ['compare', 'off'] },
        /* Teilweise aufschalten (T-105, REQ-255): was die Ebene bringt —
           Bereiche (`area` der Art) und einzelne Arten. Ohne beide: alles. */
        areas: { type: 'array', items: { type: 'string' }, title: 'Areas' },
        types: { type: 'array', items: { type: 'string' }, title: 'Types' },
        /* Von den Typ-Regeln ausgenommen (T-187): die Ebene bringt alles,
           auch wenn eine Regel ihrer Gruppe weniger sagt. */
        exempt: { type: 'boolean', title: 'Exempt from type rules' },
      },
    },
  },

  /**
   * **Typ-Regel über viele Quellen** (T-187): was jede Ebene einer Gruppe
   * bringt, wo sie im Spiel ist und selbst nichts sagt — „aus allen
   * Abenteuern nur Regeln, Gegenstände und Zauber", einmal gesetzt statt je
   * Buch. Die eigene Auswahl an `activates` schlägt sie.
   */
  layerRule: {
    type: 'layerRule',
    label: 'Type rule for',
    inverseLabel: 'Type rule in',
    means: 'A campaign says what every layer in a group brings when that layer says nothing itself; the group lists the campaigns with such a rule.',
    from: ['Campaign'],
    to: ['Layer'],
    props: {
      type: 'object',
      properties: {
        areas: { type: 'array', items: { type: 'string' }, title: 'Areas' },
        types: { type: 'array', items: { type: 'string' }, title: 'Types' },
      },
    },
  },

  /**
   * **Einzelne Artikel freigeben** (T-187): Extra-Inhalt aus einer Ebene,
   * die nicht im Spiel ist — der Artikel ist es trotzdem. Rückgängig an
   * derselben Stelle; die Fassungen (Vergleich) bleiben, wie sie sind.
   */
  enables: {
    type: 'enables',
    label: 'Extra content',
    inverseLabel: 'Enabled in',
    means: 'A campaign puts a single article in play although its layer is not; the article lists the campaigns that enabled it.',
    from: ['Campaign'],
    to: ['*'],
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
   * derselben Art wie ihre Vorlage** (`same`) **oder von einem Untertyp**:
   * ein Statblock liest keinen Gegenstand, ein Fertigungsauftrag aber sein
   * Rezept (T-128) — er *ist* eines, mit Fortschritt dazu. Eine weitere
   * Art kommt in `from` dazu und braucht keine Codeänderung.
   */
  instanceOf: {
    type: 'instanceOf',
    label: 'instance of',
    inverseLabel: 'instances',
    means: 'A statblock, item, crafting order, map or encounter is an instance of a template and stores only what differs; the template lists its instances.',
    /* Ein Fertigungsauftrag ist eine Instanz seines Rezepts (T-128) —
       `same` nimmt die Obertypen mit: ein Auftrag *ist* ein Rezept. Eine
       Karte oder Begegnung im Spiel ist eine Instanz ihrer Vorlage (T-289):
       Tokens, Nebel und Kampfstand je Runde, die Vorlage bleibt unberührt. */
    from: ['Statblock', 'Item', 'CraftingOrder', 'Map', 'Encounter'],
    to: ['same'],
    cardinality: 'one',
  },

  /** Eine Kopie mit Herkunft (REQ-008) — sie ersetzt nichts. */
  variantOf: {
    type: 'variantOf',
    label: 'variant of',
    inverseLabel: 'has variants',
    means: 'An article is a variant of another (an adopted or adapted copy); the original lists its variants.',
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
    means: 'A version replaces another article wherever its layer is in play; the replaced one lists what replaces it.',
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
   * **Wer fertigt** (REQ-184). In der Seite zeigt die Kante auf einen
   * **Fertigungsauftrag** (T-128) — eine Instanz des Rezepts, die
   * Fortschritt, Ausgang und Proben hält (`CraftingOrder`); ein Auftrag
   * *ist* ein Rezept, darum reicht `to: ['Recipe']`. Das Material bleibt
   * im Inventar und ist für den Auftrag reserviert
   * (`holds.props.reservedFor`, T-127): sichtbar, unbeweglich, bei Erfolg
   * verbraucht, beim Abbruch frei, beim Misserfolg nach
   * `Campaign.craftFailure` (nur dort, T-165).
   *
   * Die Eigenschaften `day`, `days`, `put` und `rolls` an der Kante sind
   * die Form des Prototyps (D55: ein Gang ohne Artikel, das Material in
   * `put`); die Seite liest und schreibt sie nicht.
   */
  crafting: {
    type: 'crafting',
    label: 'working on',
    inverseLabel: 'worked on by',
    means: 'A creature or party works on a crafting order (an instance of a recipe, with progress and checks); the order lists who works on it.',
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
    means: 'A creature, party or faction regards another, in words (trusts, fears); the other lists who judges it — the reverse is its own edge.',
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
