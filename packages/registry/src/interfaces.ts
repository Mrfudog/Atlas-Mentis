import type { InterfaceDef, ObjectSchema } from '@nw/model';
import { fieldGroups as g } from './fieldgroups.js';

/**
 * `interface` rows — **die einzige Registerzeile für eine Artikelart.**
 * Membership is asserted with `Typed` and verified by Validation (D5); it is
 * never inferred from which fields happen to be filled. Adding a kind of
 * thing is a row here, not a code change.
 *
 * Jede Art trägt ihre Felder selbst. Was mehrere Arten teilen, ist ein
 * Obertyp — `Vars`, `Abilities`, `Vitals`, `Proficiencies` — und
 * behält damit seine eigene Karte am Artikel. Genau das hält `hp` an der
 * Kreatur von `hp` am Statblock auseinander.
 *
 * Der **erste** Eintrag in `extends` ist der, an dem der Artenbaum zeichnet;
 * weitere sind Beimischungen. Deshalb steht dort nie eine Beimischung
 * zuerst — sonst hinge die halbe Kampagne unter „Quellenangabe".
 */

/** Feldgruppen zu einem Schema zusammenlegen. Pflichtfelder wandern mit. */
function merge(...gruppen: { schema: ObjectSchema }[]): ObjectSchema {
  const properties: ObjectSchema['properties'] = {};
  const required: string[] = [];
  for (const { schema } of gruppen) {
    Object.assign(properties, schema.properties);
    required.push(...(schema.required ?? []));
  }
  return required.length
    ? { type: 'object', required, properties }
    : { type: 'object', properties };
}
export const interfaces: Record<string, InterfaceDef> = {
  /* Die Arten, die mehrere andere teilen. Sie waren Komponenten, weil eine
     Kreatur nun einmal Statblockzahlen trägt und eine Regel Variablen; jetzt
     sind sie Obertypen, und ihre Karte bleibt ihre Karte. Abstrakt, weil
     niemand einen Artikel „Zugriff" anlegt. */
  Vars: {
    name: 'Vars',
    label: 'Variables',
    abstract: true,
    schema: g.Vars.schema,
  },

  /* **Die sechs Werte.** Sie lagen in `StatblockInfo` — einer Karte mit
     dreissig Feldern, von der Rüstungsklasse bis zu den Immunitäten. Ein
     Sammelname für „alles, was an einem Statblock steht", ist keine
     Auskunft; jetzt trägt der Statblock seine Felder selbst und nimmt diese
     Zeile dazu. */
  Abilities: {
    name: 'Abilities',
    label: 'Abilities',
    abstract: true,
    schema: g.Abilities.schema,
  },

  /* Zwei weitere, die keine Kreatur mit einer anderen teilt und die trotzdem
     eigene Arten bleiben: eine Ansicht nennt sie als Ganzes. Der Bogen oben
     zeichnet die Werte schon, also nimmt die Feldtabelle `except: ['Vitals']`
     — und das ist genau der Verweis, der verschwände, legte man die Felder zu
     `Creature` dazu. Dann stünde dort eine Aufzählung von vierzehn Namen, und
     die wäre am Tag des fünfzehnten falsch.

     Sachlich stimmt es auch: was eine Kreatur *ist*, ändert sich selten; was
     sie gerade *aushält*, ändert sich jede Runde. */
  /* **Der Stand, nicht die Festlegung.** Am Statblock ist `hp` das Maximum
     und wird einmal festgelegt; hier ist es der Stand und ändert sich
     mitten im Zug. Welche Felder deshalb immer als Eingabe dastehen, sagt
     jedes für sich (`alwaysEdit` am Feld) — am Typ war es ein Schalter für
     alle neun, und die Zustandsliste ist ein Satz Häkchen und kein Stand. */
  Vitals: {
    name: 'Vitals',
    label: 'Vitals',
    abstract: true,
    schema: g.Vitals.schema,
  },

  /* Worin jemand geübt ist. Es hiess `Skills` und trug nur Fertigkeiten,
     Sprachen und Werkzeuge; Rüstungen, Waffen und Wissensgebiete standen
     nirgends oder als freier Text am Statblock. Seit M5 nimmt es der
     Statblock und nicht mehr die Kreatur: die Übungen gehören zu den
     Zahlen, und die wohnen dort. Klasse, Abstammung und Hintergrund nehmen
     es für das, was sie gewähren (M3). */
  Proficiencies: {
    name: 'Proficiencies',
    label: 'Proficiencies',
    abstract: true,
    schema: g.Proficiencies.schema,
  },

  /* Was zu wählen ist: Klasse, Unterklasse, Abstammung, Hintergrund,
     Talent (REQ-238, E-015 a). Die Antworten stehen an der Figur (`chose`). */
  Choices: {
    name: 'Choices',
    label: 'Choices',
    abstract: true,
    schema: g.Choices.schema,
  },

  /* Was ein Artikel an der Figur verändert (REQ-238, REQ-063, E-025 a):
     heute nimmt ihn der Gegenstand; gerechnet wird beim Lesen (`effectsAt`). */
  Effects: {
    name: 'Effects',
    label: 'Effects',
    abstract: true,
    schema: g.Effects.schema,
  },

  /* Eine Stufe von 1 bis 20, die Begegnung und Szene teilen. */
  /** Wann und wo eine Karte oder Begegnung gespielt wurde (T-289) — nur an der Instanz gefüllt. */
  Played: {
    name: 'Played',
    label: 'Played',
    abstract: true,
    schema: g.Played.schema,
  },

  Difficulty: {
    name: 'Difficulty',
    label: 'Difficulty',
    abstract: true,
    schema: g.Difficulty.schema,
  },

  /* ---------- Basistypen ----------
     Jeder erklärt Felder und erbt nichts. Was eine Artikelart braucht,
     nimmt sie dazu — deshalb trägt ein Ereignis kein Bild, und zwar nicht,
     weil jemand ein Feld ausgeblendet hat, sondern weil es keins hat.

     Vorher stand das alles in einem Sammeltyp `Base`, den jede Art erbte:
     28 Felder, von denen 17 in keinem einzigen der 73 Artikel belegt waren.
     Ein Ereignis schleppte Bildunterschrift, Alt-Text und Seitenzahl mit. */

  /** Wer der Artikel ist. Das erbt jede Artikelart. */
  /* Und sonst nichts: `Prose` und `Notes` hingen hier einmal, weil
     `Identity` der einzige Typ ist, den wirklich jede Art erbt. Das war
     bequem und falsch — auf der Typenseite stand unter „Identity" ein Feld
     namens „Text", das mit Identität nichts zu tun hat. Ein Basistyp erbt
     nichts; wer Fliesstext haben soll, nimmt ihn dazu. */
  Identity: {
    name: 'Identity',
    label: 'Identity',
    abstract: true,
    schema: g.Identity.schema,
  },

  Status: {
    name: 'Status',
    label: 'Status',
    abstract: true,
    schema: g.Status.schema,
  },

  Description: {
    name: 'Description',
    label: 'Description',
    abstract: true,
    schema: g.Description.schema,
  },

  Visibility: {
    name: 'Visibility',
    label: 'Visibility',
    abstract: true,
    schema: g.Visibility.schema,
  },

  /* Die Regeln je Gruppe an der Kampagne (T-252, E-098). Ein eigener
     Typ und kein Feld von CampaignInfo: das sind die Regeloptionen, und
     wer sieht was ist keine Option, wie gespielt wird. */
  VisibilityRules: {
    name: 'VisibilityRules',
    label: 'Visibility by group',
    abstract: true,
    schema: g.VisibilityRules.schema,
  },

  /** Marken — ein Bestandteil und keine Eigenschaft der Entität. */
  Tags: {
    name: 'Tags',
    label: 'Tags',
    abstract: true,
    schema: g.Tags.schema,
  },

  /* ---- Prosa ----
     Das waren die **Blockarten**: eine eigene Liste je Artikelart, neben
     den Feldern, und damit eine zweite Frage, die jede Art zweimal
     beantworten musste. Jetzt ist die Blockart das Feld — `secret` ist ein
     Feld mit `many`, und seine Einträge tragen die Id, an der die
     Wissensfreigabe hängt. Das war der Anker. */

  Prose: { name: 'Prose', label: 'Text', abstract: true, schema: g.Prose.schema },
  Notes: { name: 'Notes', label: 'Notes', abstract: true, schema: g.Notes.schema },
  Lore: { name: 'Lore', label: 'Lore', abstract: true, schema: g.Lore.schema },
  Secrets: { name: 'Secrets', label: 'Secrets', abstract: true, schema: g.Secrets.schema },
  ReadAloud: { name: 'ReadAloud', label: 'Read aloud', abstract: true, schema: g.ReadAloud.schema },
  Facts: { name: 'Facts', label: 'Facts', abstract: true, schema: g.Facts.schema },
  Tactics: { name: 'Tactics', label: 'Tactics', abstract: true, schema: g.Tactics.schema },

  /** Wann etwas in der Welt steht: `sort` ordnet, `display` wird gelesen. */
  Time: {
    name: 'Time',
    label: 'Time',
    abstract: true,
    schema: g.Time.schema,
  },

  Image: {
    name: 'Image',
    label: 'Image',
    abstract: true,
    schema: g.Image.schema,
  },

  /** Woher es stammt: Buch, Seite, Anker, Adresse. */
  Source: {
    name: 'Source',
    label: 'Source',
    abstract: true,
    schema: g.Source.schema,
  },


  Todos: {
    name: 'Todos',
    label: 'Todos',
    abstract: true,
    schema: g.Todos.schema,
  },


  /**
   * Abstract, and the reason the rows below are short: everything that walks
   * shares the same components, block types and edges, so they are declared
   * once here and every creature under it inherits them unchanged.
   */
  Creature: {
    name: 'Creature',
    area: 'world',
    label: 'Creature',
    /**
     * **Eine Kreatur ist selbst eine Art und kein Oberbegriff.**
     *
     * Darunter hingen `NPC`, `Companion` und `Retainer` — drei Zeilen, die
     * zusammen kein eigenes Feld trugen und sich nur im Namen
     * unterschieden. Was sie voneinander trennt, ist jetzt das freie Feld
     * `kind`: npc, companion, retainer, pet, summon. Eine neue Sorte ist
     * damit ein Eintrag und keine Registerzeile, und die Sonderregeln, die
     * einen Begleiter zum Begleiter machen, stehen am Statblock und an der
     * Regel, auf die er zeigt.
     *
     * `PlayerCharacter` bleibt eine eigene Art: er trägt die gerechnete
     * Stufe, den Übungsbonus und die Kanten zu Klasse, Abstammung und
     * Hintergrund — was keine andere Kreatur hat.
     *
     * `Proficiencies` stand hier bis P4. Die Übungen gehören zu den Zahlen,
     * und die wohnen am Statblock (M5) — an beiden Stellen wären sie zwei
     * Antworten auf „worin ist sie geübt".
     */
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Source', 'Vars', 'Vitals', 'Lore', 'Facts', 'Secrets', 'ReadAloud'],
    schema: g.CreatureInfo.schema,
    /* **Die Zahlen wohnen am Statblock**, auch die eines Spielercharakters.
       Er hat mehr darüber hinaus — Stufe, Klasse, Hintergrund —, aber AC,
       HP-Maximum und die sechs Werte sind dieselbe Sache wie bei jedem
       Monster, und `belongsTo` sagt, welcher Statblock es ist.

       Die Statblockzahlen lagen hier einmal *auch*, „erst die eigene Karte, dann
       die geborgte". Das waren zwei Formen für dasselbe, und wer eine
       Kreatur änderte, musste wissen, in welcher der beiden ihre Zahlen
       gerade standen. `Vitals` bleibt: das ist, was sich während der Sitzung
       ändert, und es gehört der Figur und nicht ihrem Bogen. */
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    /**
   * **Eine Kreatur ist ihr Bogen, und ein Bogen hat Reiter.**
   *
   * Untereinander war alles da und nichts zu finden: der Kampf oben,
   * das Inventar in der Mitte, die Geschichte unten, und am Tisch
   * scrollt man zwischen zweien hin und her. Nach Reitern getrennt
   * schaut man auf einen — so, wie Rooks Bogen es vormacht.
   *
   * **Der Bogen steht über den Reitern**, nicht in einem: Trefferpunkte
   * und Rüstungsklasse braucht man, ohne umzuschalten. Dieselbe Regel
   * wie bei der Initiative am Spieltisch.
   */
    views: {
      /* Die Spalten im Kompendium (W7, `listColumns`). */
      overview: [{ id: 'c-ov-img', el: 'image' }, { id: 'c-ov', el: 'fields', fields: ['Creature.kind', 'Creature.species', 'Creature.role'] }],
      full: [
        { id: 'c-sheet', el: 'sheet' },
        {
          id: 'c-tabs',
          el: 'tabs',
          tabs: [
            /* **Die Übersicht ist der erste Reiter und trägt die Felder.**
               Man öffnet einen Artikel, um zu wissen, wen man vor sich hat —
               und wer etwas ändern will, soll nicht erst umschalten. Ein
               eigener Reiter „More" für die Feldtabelle sah aufgeräumt aus
               und versteckte das Bearbeiten.

               `except` statt einer Aufzählung: ein neues Feld an
               CreatureInfo stünde sonst nirgends, bis es jemand von Hand
               nachträgt. */
            {
              id: 'about',
              label: 'Overview',
              layout: [
                { id: 'c-img', el: 'image' },
                /* Das Token ihres Statblocks, zum Einstellen (T-297). */
                { id: 'c-token', el: 'token' },
                { id: 'c-desc', el: 'description' },
                /* **Der Statblock steht hier und nicht hinter einem
                   Sprung.** Seine Felder gehören zu dem, was man gerade
                   offen hat; gezeichnet werden seine eigenen Eingaben, die
                   in ihn schreiben. Das Inventar bleibt aussen vor: es hat
                   im Reiter „Gear" sein eigenes Element, und zweimal
                   dasselbe ist keine Gliederung. */
                { id: 'c-linked', el: 'linked', except: ['Inventory'] },
                {
                  id: 'c-f',
                  el: 'fields',
                  fields: 'all',
                  /* Die Statblockzahlen stehen hier nicht mehr: sie
                     wohnen am Statblock, also hat die Kreatur sie gar
                     nicht. Eine Ausnahme für etwas, das es nicht gibt,
                     wird am Tag des Umzugs still falsch — darum steht
                     `Proficiencies` seit M5 auch nicht mehr hier. */
                  except: ['Vitals'],
                },
                { id: 'c-b', el: 'prose', fields: 'all' },
              ],
            },
            /* Was im Kampf zählt. Die Zahlen stehen oben im Bogen; hier
               steht, was man mit ihnen tut. */
            /* „Your turn" vor den Abschnitten (T-247): eine Liste nach
               Aktionsart, und was die Hände sperren, steht mit Grund da. */
            { id: 'combat', label: 'Combat', layout: [{ id: 'c-turn', el: 'turn' }, { id: 'c-c', el: 'composed' }] },
            /* Die Zauber (T-246), nur an einer Kreatur, die zaubert. */
            { id: 'spells', label: 'Spells', layout: [{ id: 'c-spells', el: 'spells', when: { relation: 'casts' } }] },
            { id: 'gear', label: 'Gear', layout: [{ id: 'c-inv', el: 'inventory' }] },
            { id: 'craft', label: 'Crafting', layout: [{ id: 'c-craft', el: 'crafting' }] },
            /* Was die Kampagne der Figur gezeigt hat (T-247) — an der
               Spielerfigur, nicht an jedem NSC; gesiebt am Server. */
            { id: 'campaign', label: 'Campaign', layout: [{ id: 'c-camp', el: 'campaign', when: { type: 'PlayerCharacter' } }] },
            /* Wer wie zu wem steht, und woran sie sonst hängt. */
            {
              id: 'ties',
              label: 'Ties',
              layout: [
                { id: 'c-stand', el: 'standing' },
                { id: 'c-r', el: 'relations' },
              ],
            },
          ],
        },
      ],
    },
  },

  PlayerCharacter: {
    name: 'PlayerCharacter',
    area: 'world',
    label: 'Player character',
    extends: ['Creature'],
    schema: merge(g.CharacterInfo),
  },

  Place: {
    name: 'Place',
    area: 'world',
    label: 'Place',
    /* `Source`: ein Ort aus einem Buch nennt Quelle und Seite (T-175). */
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Lore', 'ReadAloud', 'Secrets', 'Source'],
    schema: merge(g.LocationInfo, g.Explored),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    /* Ein Ort trägt seine Punktreise selbst — sie ist kein eigener Ort,
     sondern wie dieser hier von innen aussieht. */
    views: {
      full: [
        { id: 'o-img', el: 'image' },
        { id: 'o-desc', el: 'description' },
        { id: 'o-f', el: 'fields', fields: 'all' },
        { id: 'o-b', el: 'prose', fields: 'all' },
        { id: 'o-crawl', el: 'crawl' },
        /* Worauf man hier würfelt. Die Tabelle gehört nicht dem Ort — sie
           gilt für ihn, und das steht an der Kante `tableFor`. */
        { id: 'o-table', el: 'table' },
        /* Was in diesem Ort liegt und wer hier lebt (T-425): je in der
           Ansicht seiner Art — die Unterorte als Liste, die Bewohner als
           Karten. */
        { id: 'o-within', el: 'collection', text: 'Places within', path: [{ relation: 'partOf', dir: 'in' }], types: ['Place'], show: 'list', sort: { by: 'name' } },
        { id: 'o-residents', el: 'collection', text: 'Residents', path: [{ relation: 'livesIn', dir: 'in' }], types: ['Creature'], show: 'tiles', sort: { by: 'name' } },
        { id: 'o-r', el: 'relations' },
      ],
    },
  },

  /**
   * **Ein Laden ist ein Ort** (T-129): er liegt in einer Gasse, hat ein
   * Bild und Geheimnisse, und eine Fraktion kann ihn kontrollieren
   * (`controls`). Dazu führt er Waren (`sells`) und gibt Rabatte
   * (`discount`); wer ihn hält, steht an `shopkeeper`.
   */
  Shop: {
    name: 'Shop',
    area: 'world',
    label: 'Shop',
    extends: ['Place'],
    schema: merge(g.ShopInfo),
    /* Die Anordnung des Orts und die Waren davor: wer einen Laden
       aufschlägt, will wissen, was er führt — die Punktreise und die
       Würfeltabelle des Orts bleiben dabei, wenn er sie hat. */
    views: {
      full: { adjust: { extra: [{ id: 'shop-wares', el: 'wares' }], order: ['o-img', 'o-desc', 'o-f', 'shop-wares'] } },
    },
  },

  Faction: {
    name: 'Faction',
    area: 'world',
    label: 'Faction',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Lore', 'Secrets'],
    schema: merge(g.FactionInfo),
  },

  Article: {
    name: 'Article',
    area: 'world',
    label: 'Article',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Source', 'Todos', 'Lore', 'Secrets'],
    /* `poem` und `song` standen hier als eigene Prosafelder — ein Gedicht
       ist Prosa und steht in `lore`, mit seiner Überschrift im Text; zwei
       Felder, die niemand füllte (A14, 7.10.). */
  },

  /** The reuse pool: the shared root of conditions, actions, features, feats … (D48). */
  Rule: {
    name: 'Rule',
    area: 'rules',
    label: 'Rule Element',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Source', 'Vars'],
    schema: merge(g.RuleInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'rul-ov', el: 'fields', fields: ['Rule.kind'] }] },
  },

  /**
   * Talent und Fertigkeit sind eigene Arten und nicht nur zwei Werte in
   * `RuleInfo.kind`, weil Beute auf sie zeigen darf und auf eine Lauernde
   * Aktion nicht. Eine Kante nennt Arten, keine Aufzählungswerte — und was
   * eine Kante unterscheiden muss, gehört in eine Art.
   */
  Feat: {
    name: 'Feat',
    area: 'rules',
    label: 'Feat',
    /* Ein Talent fragt selbst (+1 auf welches Attribut?, REQ-238) und
       wirkt wie ein Gegenstand (T-180, `effectsAt` liest es schon). */
    extends: ['Rule', 'Choices', 'Effects'],
    schema: merge(g.FeatInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'fea-ov', el: 'fields', fields: ['Feat.prerequisite', 'Feat.repeatable'] }] },
  },

  Skill: {
    name: 'Skill',
    area: 'rules',
    label: 'Skill',
    extends: ['Rule'],
    schema: merge(g.SkillInfo),
  },

  /** Eine Sprache (M6): war ein Wort in einer Aufzählungszeile. */
  Language: {
    name: 'Language',
    area: 'rules',
    label: 'Language',
    extends: ['Rule'],
    schema: merge(g.LanguageInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'lan-ov', el: 'fields', fields: ['Language.languageType', 'Language.script'] }] },
  },

  /* ---------- Charakterbau (M3) ----------
     Klasse, Unterklasse, Abstammung, Hintergrund: Regeln mit eigenen
     Feldern, also Arten unter `Rule`. Was sie gewähren, steht dreifach
     getrennt da, je nach Sorte: Übungen in `Proficiencies` (dieselbe Gruppe
     wie am Statblock, nur heisst sie hier „gewährt"), Wahlen in
     `Choices` (die Antworten an der Figur, `chose`), Merkmale an der Kante `grants` mit Stufe. Die
     Figur zeigt über `hasClass`, `hasAncestry`, `hasBackground` darauf. */
  Class: {
    name: 'Class',
    area: 'rules',
    label: 'Class',
    extends: ['Rule', 'Proficiencies', 'Choices', 'Lore', 'Image'],
    schema: merge(g.ClassInfo, g.ClassCasting),
    titles: {
      'Proficiencies.proficient': 'Grants proficiency in',
      'Proficiencies.expertise': 'Grants expertise in',
    },
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'cla-ov-img', el: 'image' }, { id: 'cla-ov', el: 'fields', fields: ['Class.hitDie', 'Class.primaryAbility', 'Class.casterProgression'] }] },
  },

  Subclass: {
    name: 'Subclass',
    area: 'rules',
    label: 'Subclass',
    extends: ['Rule', 'Proficiencies', 'Choices', 'Lore', 'Image'],
    schema: merge(g.SubclassInfo, g.ClassCasting),
    titles: {
      'Proficiencies.proficient': 'Grants proficiency in',
      'Proficiencies.expertise': 'Grants expertise in',
    },
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'sub-ov-img', el: 'image' }, { id: 'sub-ov', el: 'fields', fields: ['Subclass.shortName', 'Subclass.casterProgression'] }] },
  },

  Ancestry: {
    name: 'Ancestry',
    area: 'rules',
    label: 'Ancestry',
    extends: ['Rule', 'Proficiencies', 'Choices', 'Lore', 'Image'],
    schema: merge(g.AncestryInfo),
    titles: {
      'Proficiencies.proficient': 'Grants proficiency in',
      'Proficiencies.expertise': 'Grants expertise in',
    },
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'anc-ov-img', el: 'image' }, { id: 'anc-ov', el: 'fields', fields: ['Ancestry.size', 'Ancestry.speed'] }] },
  },

  Background: {
    name: 'Background',
    area: 'rules',
    label: 'Background',
    extends: ['Rule', 'Proficiencies', 'Choices', 'Lore', 'Image'],
    schema: merge(g.BackgroundInfo),
    titles: {
      'Proficiencies.proficient': 'Grants proficiency in',
      'Proficiencies.expertise': 'Grants expertise in',
    },
  },

  /** Wie Spielende zu ihren Attributswerten kommen (E-016 a): ein Artikel je Verfahren. */
  AbilityMethod: {
    name: 'AbilityMethod',
    area: 'rules',
    label: 'Ability score method',
    extends: ['Rule'],
    schema: merge(g.AbilityMethodInfo),
    views: { overview: [{ id: 'abm-ov', el: 'fields', fields: ['AbilityMethod.method', 'AbilityMethod.scope'] }] },
  },

  /** Wie Spielende zu ihrer Startausrüstung kommen (REQ-250, T-096): ein Artikel je Verfahren. */
  EquipmentMethod: {
    name: 'EquipmentMethod',
    area: 'rules',
    label: 'Starting equipment method',
    extends: ['Rule'],
    schema: merge(g.EquipmentMethodInfo),
    views: { overview: [{ id: 'eqm-ov', el: 'fields', fields: ['EquipmentMethod.method', 'EquipmentMethod.gold', 'EquipmentMethod.budget'] }] },
  },

  /** Ein Zustand, den man hat — und die Art, die `Vitals.conditions` verlangt (D48). */
  Condition: {
    name: 'Condition',
    area: 'rules',
    label: 'Condition',
    /* Ein Zustand wirkt wie ein Gegenstand (T-275): gepackt deckelt das
       Tempo auf 0, geblendet gibt Nachteil auf eigene Angriffe —
       `effectsAt` liest `Vitals.conditions` und die Initiative. */
    extends: ['Rule', 'Effects'],
    schema: merge(g.ConditionInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'con-ov', el: 'fields', fields: ['Condition.kind'] }] },
  },

  /** Eine Krankheit: zuweisbar wie ein Zustand, mit eigenen Feldern (D48). */
  Disease: {
    name: 'Disease',
    area: 'rules',
    label: 'Disease',
    extends: ['Condition'],
    schema: merge(g.DiseaseInfo),
  },

  /** Aktionsart: Action, Bonus Action, Reaction, Movement … (D48). */
  ActionType: {
    name: 'ActionType',
    area: 'rules',
    label: 'Action type',
    extends: ['Rule'],
    schema: merge(g.ActionTypeInfo),
  },

  /** Eine Aktion; ihre Art ist ein Verweis und Pflicht (D48). */
  Action: {
    name: 'Action',
    area: 'rules',
    label: 'Action',
    extends: ['Rule'],
    schema: merge(g.ActionInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'act-ov', el: 'fields', fields: ['Action.actionType', 'Action.attack', 'Action.damageType', 'Action.recharge'] }] },
  },

  /** Merkmal: alles Dauerhafte — Klasse, Volk, Monster, Region (D48). */
  Feature: {
    name: 'Feature',
    area: 'rules',
    label: 'Feature',
    /* Ein Merkmal fragt selbst (Fighting Style, Ability Score
       Improvement); gewährt eine Klasse es mehrmals, fragt es jedes Mal
       (T-107, E-027). Seine Wirkungen gelten, sobald es gewährt ist
       (T-180, `effectsAt`). */
    extends: ['Rule', 'Choices', 'Effects'],
    schema: merge(g.FeatureInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'ftr-ov', el: 'fields', fields: ['Feature.featureType'] }] },
  },

  /** Gegenstandseigenschaft: Finesse, Versatile, Heavy (D48). */
  ItemProperty: {
    name: 'ItemProperty',
    area: 'rules',
    label: 'Item property',
    extends: ['Rule'],
    schema: merge(g.ItemPropertyInfo),
  },

  /**
   * Ein Zauber (M2): eine Regel mit Grad, Schule, Wirkzeit, Reichweite,
   * Komponenten, Dauer. Wer ihn wirkt, sagt die Kante `casts`.
   */
  Spell: {
    name: 'Spell',
    area: 'rules',
    label: 'Spell',
    extends: ['Rule'],
    schema: merge(g.SpellInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    /* **Wie im Spielerhandbuch** (W2): Grad und Schule kursiv, die vier
       Kopfzeilen, der Text, „At Higher Levels". Das Element `spell`
       zeichnet die Karte `Spell` ganz und den Haupttext (Beschreibung und
       `Prose.paragraph`) dazu, weil „At Higher Levels" hinter ihm steht —
       darum nehmen Feldtabelle und Prosa beides heraus. */
    views: {
      overview: [{ id: 'spe-ov', el: 'fields', fields: ['Spell.level', 'Spell.school', 'Spell.duration', 'Spell.concentration', 'Spell.ritual'] }],
      full: [
        { id: 'sp-book', el: 'spell' },
        { id: 'sp-f', el: 'fields', fields: 'all', except: ['Spell'] },
        { id: 'sp-b', el: 'prose', fields: 'all', except: ['Prose.paragraph'] },
        { id: 'sp-c', el: 'composed' },
        { id: 'sp-used', el: 'usedBy' },
        { id: 'sp-r', el: 'relations' },
      ],
    },
  },

  /** Falle oder Gefahr (M7). Auf der Karte über `marker`. */
  Hazard: {
    name: 'Hazard',
    area: 'world',
    label: 'Hazard',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Source', 'Secrets'],
    schema: merge(g.HazardInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'haz-ov-img', el: 'image' }, { id: 'haz-ov', el: 'fields', fields: ['Hazard.kind', 'Hazard.category', 'Hazard.threat'] }] },
  },

  /**
   * Eine Zonenart (REQ-208, D56): eine Regel, die an Orten auf der Karte
   * gilt. Wo, sagt die Kante `zone`.
   */
  ZoneKind: {
    name: 'ZoneKind',
    area: 'rules',
    label: 'Zone kind',
    extends: ['Rule'],
    schema: merge(g.ZoneInfo),
  },

  /** Gottheit (M7); Anhänger über die Kante `worships`. */
  Deity: {
    name: 'Deity',
    area: 'world',
    label: 'Deity',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Source', 'Lore', 'Secrets'],
    schema: merge(g.DeityInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'dei-ov-img', el: 'image' }, { id: 'dei-ov', el: 'fields', fields: ['Deity.pantheon', 'Deity.alignment', 'Deity.domains'] }] },
  },

  /** An entity of its own (D4), referenced by creatures, never embedded. */
  Statblock: {
    name: 'Statblock',
    area: 'rules',
    label: 'Statblock',
    /* M5: `Proficiencies` (von der Kreatur herüber), `Lore` und `Image`
       (5e.tools `monsterFluff`). */
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Source', 'Abilities', 'Proficiencies', 'Vars', 'Tactics', 'Lore', 'Image'],
    /* Das Zauberwirken trägt der Statblock selbst (M2): es braucht
       `prof` aus derselben Karte, und eine eigene Art dafür hätte keinen
       zweiten Nutzer. */
    schema: merge(g.StatblockCore, g.Spellcasting),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    views: {
      /* Die Spalten im Kompendium (W7, `listColumns`). */
      /* Ein Verweis sagt, was man vor sich hat: Herausforderung, Grösse,
         Art (T-206). Die Gesinnung steht im Bogen. */
      overview: [{ id: 's-ov-img', el: 'image' }, { id: 's-ov', el: 'fields', fields: ['Statblock.cr', 'Statblock.size', 'Statblock.creatureType'] }],
      /* **Die Kurzansicht sind die Kennzahlen** (T-206, Leitung 15.10.):
         AC, HP, Bewegung, Initiative, passive Wahrnehmung, CR in einer
         Reihe — Karte, Popup und Token. Bis dahin stand hier der ganze
         Bogen (REQ-211), und die Kurzansicht war länger als die Seite
         daneben; der Bogen gehört zu `full`. Das Bild zuletzt (T-346). */
      quick: [{ id: 's-q-stats', el: 'stats' }, { id: 's-q-img', el: 'image' }],
      /* **Wie im Monster Manual** (W2, Leitung 13.10.): das Element
         `statblock` zeichnet Kopf, Werte und die Abschnitte aus
         `composedOf` — es ersetzt Feldtabelle und `composed` für die
         Karten `Statblock`, `Abilities` und `Proficiencies`. Was der
         Statblock sonst trägt (Marken, Stand, Quelle …), steht weiter in
         der Feldtabelle darunter. */
      full: [
        /* Das Bild obenan (T-211): seit dem Lauf der 5e.tools-Bilder hat
           fast jeder Statblock eins, und der Bogen zeigt es nicht. */
        { id: 's-img', el: 'image' },
        /* Das Token, wie es auf der Karte steht, zum Einstellen (T-297). */
        { id: 's-token', el: 'token' },
        { id: 's-sb', el: 'statblock' },
        { id: 's-f', el: 'fields', fields: 'all', except: ['Statblock', 'Abilities', 'Proficiencies'] },
        { id: 's-b', el: 'prose', fields: 'all' },
        { id: 's-used', el: 'usedBy' },
        { id: 's-r', el: 'relations' },
      ],
    },
  },

  /**
   * Items. `Gegenstandstyp` in the vault maps onto these: a weapon, armour
   * and a material differ by which component they carry, which is exactly
   * what interfaces are for.
   */
  Item: {
    name: 'Item',
    area: 'world',
    label: 'Item',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Source', 'Lore', 'Secrets', 'Facts', 'Effects'],
    schema: merge(g.ItemInfo, g.Footprint),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    /* **Wie im Spielleiterhandbuch** (W2): Art, Seltenheit und Einstimmung
       kursiv unter dem Namen, Rüstungsklasse, Schaden, Preis und Gewicht
       als Kopfzeilen. Waffe, Rüstung und Material erben die Anordnung;
       das Element zeichnet ihre Karten mit. */
    views: {
      overview: [{ id: 'ite-ov-img', el: 'image' }, { id: 'ite-ov', el: 'fields', fields: ['Item.itemType', 'Item.rarity', 'Item.attunement'] }],
      full: [
        { id: 'it-img', el: 'image' },
        { id: 'it-book', el: 'item' },
        /* Form, Stapelgrösse und Inventarbild (T-142): das Element malt
           und zeigt sie, das Buch nimmt sie nicht in seine Zusatzzeilen. */
        { id: 'it-shape', el: 'shape' },
        { id: 'it-desc', el: 'description' },
        { id: 'it-f', el: 'fields', fields: 'all', except: ['Item', 'Weapon', 'Armor', 'Material'] },
        { id: 'it-linked', el: 'linked' },
        { id: 'it-b', el: 'prose', fields: 'all' },
        { id: 'it-c', el: 'composed' },
        /* Was man mit einem Werkzeug fertigt (T-196) — an jedem anderen
           Gegenstand zeichnet das Element nichts. */
        { id: 'it-craft', el: 'crafting' },
        { id: 'it-used', el: 'usedBy' },
        { id: 'it-stand', el: 'standing' },
        { id: 'it-r', el: 'relations' },
      ],
    },
  },

  Weapon: {
    name: 'Weapon',
    area: 'world',
    label: 'Weapon',
    extends: ['Item'],
    schema: merge(g.WeaponInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'wea-ov-img', el: 'image' }, { id: 'wea-ov', el: 'fields', fields: ['Weapon.category', 'Weapon.damage', 'Weapon.damageType', 'Item.rarity'] }] },
  },

  Armor: {
    name: 'Armor',
    area: 'world',
    label: 'Armor',
    extends: ['Item'],
    schema: merge(g.ArmorInfo),
    /* Die Spalten im Kompendium (W7, `listColumns`): eine Zeile ist ein
       Verweis, also `overview`. */
    views: { overview: [{ id: 'arm-ov-img', el: 'image' }, { id: 'arm-ov', el: 'fields', fields: ['Armor.armorType', 'Armor.ac', 'Armor.strength', 'Armor.stealthDisadvantage'] }] },
  },

  Material: {
    name: 'Material',
    area: 'world',
    label: 'Material',
    extends: ['Item'],
    schema: merge(g.MaterialInfo),
  },

  /* `Consumable` war hier eine Art ohne ein einziges eigenes Feld — ein
     Verbrauchsgut ist ein Wert von `Item.itemType` (Abgleich A5, Regel T2,
     7.10.). Wanderung: `prototype/migration/arten-werden-woerter.mjs`. */

  Party: {
    name: 'Party',
    area: 'world',
    label: 'Party',
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Lore', 'Notes'],
    schema: merge(g.PartyInfo, g.TravelInfo),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    /* Eine Gruppe hat kein eigenes Blatt, aber denselben Beutel und
     dieselben Beziehungen wie eine Figur. */
    views: {
      full: [
        /* Die Gruppe nimmt `Image` und zeigte es nirgends (T-211). */
        { id: 'p-img', el: 'image' },
        { id: 'p-desc', el: 'description' },
        { id: 'p-f', el: 'fields', fields: 'all' },
        { id: 'p-inv', el: 'inventory' },
        { id: 'p-craft', el: 'crafting' },
        { id: 'p-r', el: 'relations' },
      ],
    },
  },

  Inventory: {
    name: 'Inventory',
    area: 'rules',
    label: 'Inventory',
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Notes'],
    schema: merge(g.InventoryInfo, g.Container),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    views: {
      full: [
        { id: 'i-inv', el: 'inventory' },
        { id: 'i-desc', el: 'description' },
        /* **Nur der Geldbeutel ist ausgenommen** — den zeigt das
           Inventar-Element in seiner Leiste. Vorher stand hier die ganze
           Art (`except: ['Inventory']`), und das war richtig, solange sie
           nur Fassung und Münzen trug; seit sie ihre **Form** und ihre
           **Zonen** trägt, hiess es: die zwei Felder, mit denen man einen
           Behälter überhaupt einrichtet, stehen nirgends. */
        { id: 'i-f', el: 'fields', fields: 'all', except: ['Inventory.copper'] },
        { id: 'i-r', el: 'relations' },
      ],
    },
  },

  /**
   * Die Sprosse der Erzählung. Kampagne, Arc, Sitzung und Szene sind eigene
   * Arten, weil sie eigene Felder und Ansichten tragen; was darüber hinaus
   * eine Sprosse ist (das Abenteuer selbst, ein Prolog), ist ein Wort in
   * `Story.kind` (Abgleich A5, Regel T2). Darum ist `Story` nicht
   * abstrakt. **Der Arc war bis 14.10. ein Wort** (`kind: 'arc'`) — mit
   * E-026 bekam er eigene Felder (Stufen, Hook, Ausgang) und ist eine
   * Zeile, die von `Story` erbt, wie `Session`; ein Kapitel eines
   * Abenteuers ist ein Arc. Die Hierarchie trägt `partOf`.
   */
  /* Bereich `story` (bis 13.10. `history`): was nur die Kampagne
     betrifft — sie, ihre Sitzungen, Szenen und Aufträge. Die Weltgeschichte
     (`World`, `Event`) steht unter `world`. */
  Story: {
    name: 'Story',
    area: 'story',
    label: 'Story',
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Todos', 'Time', 'Lore', 'Secrets', 'ReadAloud', 'Notes'],
    schema: merge(g.StoryInfo),
    /* **Was ohne Rang zu einer Geschichte gehört** (T-425, löst „Contains"
       aus T-422 ab): die Szenen eines Arcs, die Begegnungen einer Szene —
       als Kacheln in der Kurzansicht ihrer Art, gleich nach den Teilen
       (Position 65 liegt zwischen `l-parts` und `l-c`). Was mit Rang
       dasteht, zeigt der Lesefluss. */
    views: {
      full: {
        adjust: {
          extra: [
            {
              id: 'st-contains',
              el: 'collection',
              text: 'Contains',
              path: [{ relation: 'partOf', dir: 'in' }],
              types: ['Story', 'Encounter'],
              unranked: true,
              show: 'tiles',
              groupBy: 'type',
              pos: 65,
            },
          ],
        },
      },
    },
  },

  /**
   * **Ein Arc ist ein Kapitel der Geschichte** (E-026, REQ-252): eine
   * Kampagne hat Arcs, ein Arc Sitzungen und Szenen. Ein Kapitel eines
   * importierten Abenteuers ist dieselbe Art — so lässt es sich mit allen
   * Szenen darunter in die eigene Kampagne holen (`take`, als Fassung
   * in der Kampagnenebene, E-018 a), und es steht dort, wo ein eigener Arc
   * stünde.
   */
  Arc: {
    name: 'Arc',
    area: 'story',
    label: 'Arc',
    extends: ['Story'],
    schema: merge(g.ArcInfo),
  },

  /**
   * **Ein Kapitel ist die Lesestruktur eines Buchs** (T-108, E-029 a): ein
   * Regelbuch („Chapter 9: Combat") und ein Abenteuer haben Kapitel, eine
   * Kampagne hat Arcs. Ein Kapitel besteht aus **Teilen** — Überschriften,
   * Absätzen, Vorlesetexten, Verweisen, Szenen —, jeder ein eigener Artikel,
   * in der Reihenfolge von `partOf.rank`. **Ein Kapitel eines offiziellen
   * Abenteuers gibt es zweimal, und seine Teile einmal:** als Chapter zum
   * Lesen und als Arc zum Spielen (`chapterOf`), beide über denselben
   * Szenen. Ohne Bereich: Kapitel liest man in der Leseansicht, nicht in
   * einer Liste.
   */
  Chapter: {
    name: 'Chapter',
    label: 'Chapter',
    extends: ['Identity', 'Prose', 'Description', 'Visibility', 'Tags', 'Source', 'Notes'],
    schema: merge(g.ChapterInfo),
  },

  /**
   * **Ein Teil eines Kapitels** (T-108, E-028): was ein Buch Absatz für
   * Absatz sagt. Jeder Teil ist ein Artikel, damit man ihn einzeln
   * wiederverwendet — einen Vorlesetext in die eigene Szene holt. Teile
   * stehen **in keiner Liste und sind kein Verweisziel nach Namen**
   * (`isBookPart`): hundertfünfzigtausend Absätze, die „Surprise" heissen
   * können, machten jeden `[[Verweis]]` mehrdeutig. Gefunden werden sie in
   * der Leseansicht und über ihr Kapitel.
   */
  BookPart: {
    name: 'BookPart',
    label: 'Book part',
    abstract: true,
    extends: ['Identity', 'Visibility', 'Tags', 'Source', 'Notes'],
  },

  Heading: {
    name: 'Heading',
    label: 'Heading',
    extends: ['BookPart'],
    schema: merge(g.HeadingInfo),
  },

  Paragraph: {
    name: 'Paragraph',
    label: 'Paragraph',
    extends: ['BookPart', 'Prose'],
    schema: merge(g.ParagraphInfo),
  },

  /** Der Vorlesetext als eigener Teil (E-028); sein Text steht in `ReadAloud.readaloud`. */
  ReadAloudText: {
    name: 'ReadAloudText',
    label: 'Read-aloud text',
    extends: ['BookPart', 'ReadAloud'],
  },

  Embed: {
    name: 'Embed',
    label: 'Embedded article',
    extends: ['BookPart'],
    schema: merge(g.EmbedInfo),
  },

  /**
   * **Ein Bild im Buchtext** (T-210): ein Teil wie ein Absatz, mit
   * Bildunterschrift und Alternativtext aus `Image`. Kein `Embed` auf das
   * Asset: dessen Ziel ist Pflicht, und das Bild kommt erst mit dem
   * Hochladen (T-284) — bis dahin steht die Unterschrift an ihrer Stelle.
   * Die Unterschrift gehört zur Stelle im Buch und nicht zur Datei, und das
   * Bild erbt beim Hochladen Ebene und Sichtbarkeit seines Teils.
   */
  Illustration: {
    name: 'Illustration',
    label: 'Illustration',
    extends: ['BookPart', 'Image'],
  },

  /**
   * **Wer die Kampagne leitet, steht nicht an ihr**, sondern am Konto:
   * `campaign_member` hält je Konto und Kampagne eine Rolle (`gm`, `co-gm`,
   * `player`, `spectator`). Für einen Tag stand hier eine `Access`-Karte mit
   * `role: 'gm'` — eine Kontoangabe in einem Artikel, die beim Export
   * mitgewandert wäre, und eine zweite Stelle neben den Figuren der Konten.
   */
  /**
   * Die Welt, in der Kampagnen spielen (A11, 7.10.): sie trägt den
   * Kalender, und jede Kampagne hängt über `inWorld` an genau einer. Was
   * alle Runden in derselben Welt teilen, gehört hierher und nicht in die
   * Einstellungen einer Kampagne.
   */
  World: {
    name: 'World',
    area: 'world',
    label: 'World',
    extends: ['Identity', 'Prose', 'Description', 'Visibility', 'Tags', 'Image', 'Lore', 'Notes'],
    schema: merge(g.WorldInfo),
  },

  Campaign: {
    name: 'Campaign',
    area: 'story',
    label: 'Campaign',
    extends: ['Story', 'VisibilityRules'],
    /* Wer die Vergleichsebenen sieht (T-092, E-021 d). */
    schema: merge(g.CampaignInfo),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    /* Die Kampagne trägt, was über ihr Ganzes geht: welche Ebenen laufen,
     was offen ist, was wann geschah. Das sind keine eigenen
     Artikelarten — es sind Fragen an die Kampagne. */
    views: {
      full: [
        { id: 'k-desc', el: 'description' },
        /* Die eigenen Felder der Kampagne sind Regeloptionen: sie stehen
           gruppiert und erklärt unter dem Reiter „Rules & options" (T-190),
           hier nur der Verweis; bearbeitet werden sie mit den übrigen. */
        { id: 'k-rules', el: 'rules', fields: ['Campaign'] },
        { id: 'k-f', el: 'fields', fields: 'all' },
        { id: 'k-stack', el: 'stack' },
        /* Wer an diesem Tisch sitzt. Die Rollen stehen am Konto; gepflegt
           werden sie hier, weil man sie hier sucht. Spielende bekommen das
           Element nicht zu sehen. */
        { id: 'k-mem', el: 'members' },
        { id: 'k-q', el: 'quests' },
        { id: 'k-time', el: 'timeline' },
        { id: 'k-prep', el: 'prep' },
        { id: 'k-b', el: 'prose', fields: 'all' },
        { id: 'k-r', el: 'relations' },
      ],
    },
  },

  Session: {
    name: 'Session',
    area: 'story',
    label: 'Session',
    extends: ['Story'],
    schema: merge(g.SessionState),
    /* Eine Sitzung hat kein Weltdatum, sondern einen Abend. */
    titles: { 'Time.display': 'Played on', 'Time.duration': 'Ran for' },
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    /* Eine Sitzung ist der Abend selbst: was läuft, und was noch zu tun
     war, bevor er anfing. */
    views: {
      full: [
        { id: 'se-live', el: 'live' },
        { id: 'se-prep', el: 'prep' },
        { id: 'se-desc', el: 'description' },
        { id: 'se-f', el: 'fields', fields: 'all' },
        { id: 'se-b', el: 'prose', fields: 'all' },
        { id: 'se-r', el: 'relations' },
        /* Was zur Sitzung gehört (T-422, REQ-427): die Szenen und
           Begegnungen, die `partOf` auf sie zeigen — nur ihre, nicht das
           ganze Kapitel. Seit T-425 (REQ-430) eine Collection: jede in
           ihrer eigenen Kurzansicht, als Kacheln, nach Art gruppiert. Sie
           ersetzt `parts` (Migration 144), das hier nur „Contains" zeigte. */
        {
          id: 'se-contains',
          el: 'collection',
          text: 'Scenes and encounters',
          path: [{ relation: 'partOf', dir: 'in' }],
          types: ['Scene', 'Encounter'],
          show: 'tiles',
          groupBy: 'type',
        },
      ],
    },
  },

  Scene: {
    name: 'Scene',
    area: 'story',
    label: 'Scene / Encounter',
    extends: ['Story', 'Tactics', 'Difficulty'],
    schema: merge(g.SceneInfo),
  },

  /**
   * Its own thing, not a rung of the story ladder: a quest outlives the
   * session it was handed out in, and nests through `partOf` like the rest.
   */
  Quest: {
    name: 'Quest',
    area: 'story',
    label: 'Quest',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Todos', 'Time', 'Lore', 'Secrets'],
    schema: merge(g.QuestInfo),
    /* Derselbe `Time.until` heisst hier anders, weil er hier etwas anderes
       ist: bei einem Ereignis ist es, wann es aufhört, bei einem Auftrag,
       wann es zu spät ist. `Time` dafür zu verdoppeln wäre der teurere Weg
       zum selben Satz. */
    titles: { 'Time.until': 'Deadline', 'Time.display': 'Taken on' },
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    /* Ein Auftrag trägt seine Aufgaben selbst — sie sind Felder an ihm
     und keine eigene Artikelart. Das Element zeichnet auf dem Auftrag
     genau ihn; auf der Kampagne das ganze Brett. */
    views: {
      full: [
        { id: 'qu-q', el: 'quests' },
        { id: 'qu-desc', el: 'description' },
        { id: 'qu-f', el: 'fields', fields: 'all', except: ['Quest.tasks'] },
        { id: 'qu-b', el: 'prose', fields: 'all' },
        { id: 'qu-r', el: 'relations' },
      ],
    },
  },

  /**
   * Wissen (A6). Eine Information ist ein eigener Artikel, kein Feldattribut:
   * nur ein Peg trägt Kanten, und „wer weiss davon?" soll ein Rückbezug sein
   * wie jeder andere. Sie hängt über `knowledge` am Artikel, den sie betrifft,
   * und zeigt über `knownBy` auf ihre Empfänger.
   */
  Information: {
    name: 'Information',
    area: 'rules',
    label: 'Information',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Secrets', 'Facts'],
    schema: merge(g.Info),
  },

  /**
   * **Ein Bündel von Informationen** — „was ein Kanalgänger weiss", „die
   * Gerüchte vom Lampenplatz". Es nennt sie über `includes` und wird wie
   * eine einzelne Information zugeteilt: dieselbe Kante `knownBy`, dieselben
   * Empfänger.
   *
   * Es hiess einmal `KnowledgeLevel` und war etwas anderes: ein *Stand*, dem
   * Figuren über `atLevel` angehörten. Das war ein zweiter Weg zu „wer weiss
   * das" — Party konnte schon Empfänger sein — und in zwei Jahren
   * hat ihn niemand benutzt: kein Artikel, keine Kante.
   *
   * Eigene Felder hat es keine. Was ein Bündel ist, sagen seine Kanten; ein
   * Feld daneben wäre eine zweite Liste derselben Informationen.
   */
  Knowledge: {
    name: 'Knowledge',
    area: 'rules',
    label: 'Knowledge',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags'],
    /* **Was es vereint, ausgeschrieben** (T-287, REQ-353): je Information
       die Artikel mit genau ihren Feldern, gesiebt am Server — die Stelle,
       an der Spielende ihr Wissen abrufen. */
    views: { full: { adjust: { extra: [{ id: 'kn-contents', el: 'knowledgeContents' }] } } },
  },

  /**
   * Ein Asset ist ein Artikel, kein blosser Anhang: so trägt es Marken, eine
   * Quellenangabe und eine Sichtbarkeit, und dieselbe Datei kann von zwei
   * Karten benutzt werden, ohne zweimal dazuliegen.
   */
  Asset: {
    name: 'Asset',
    label: 'Asset',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Source'],
    schema: merge(g.AssetInfo),
    /* In einer Liste und in der Galerie (T-119): das Bild und seine Klasse
       — die Klasse als Spalte, damit die Liste nach ihr filtert. */
    views: { overview: [{ id: 'as-ov-img', el: 'image' }, { id: 'as-ov', el: 'fields', fields: ['Asset.kind'] }] },
  },

  /**
   * Eine Karte ist ein Artikel wie jeder andere — sie trägt Marken, einen
   * Stand und Wissen. Was sie darstellt, sagt die Kante `mapOf`; was auf ihr
   * liegt, sagen die `marker`-Kanten. Eine Karte, die ihre Marken als Feld
   * trüge, könnte keinen Rückbezug beantworten: „auf welchen Karten kommt
   * der Baron vor?" ist so eine Abfrage wie jede andere.
   */
  Map: {
    name: 'Map',
    area: 'play',
    label: 'Map',
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Notes', 'Secrets', 'ReadAloud', 'Played'],
    schema: merge(g.MapInfo),
    /* Das Kartenbild wählt aus Kartenbildern (T-119): `Image.image` bietet
       sonst allgemeine Bilder an. */
    targets: { 'Image.image': { where: { component: 'Asset', property: 'kind', value: 'map' } } },
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    /* Karte, Board und Begegnung gehören in den Bereich **Play** und
     werden dort gezeichnet. Landet jemand trotzdem auf dem Artikel,
     soll er nicht vor einer leeren Seite stehen — deshalb steht das
     Element auch hier. */
    views: {
      full: [
        { id: 'm-map', el: 'map' },
        { id: 'm-desc', el: 'description' },
        { id: 'm-f', el: 'fields', fields: 'all' },
      ],
    },
  },

  /**
   * Ein Rezept ist ein Artikel — und damit gilt für es alles, was für
   * Artikel gilt: es trägt einen Stand, Marken, eine Beschreibung. Vor allem
   * aber kann es über eine Information *zugeteilt* werden: ein Rezept, das
   * jemand kennt, ist Wissen, und Wissen hat dieses Modell schon (A6).
   * Ein Feld „bekannt von" am Rezept wäre ein zweites, schwächeres
   * Wissensmodell neben dem vorhandenen.
   */
  Recipe: {
    name: 'Recipe',
    area: 'rules',
    label: 'Recipe',
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Source', 'Notes', 'Secrets', 'Lore'],
    schema: merge(g.RecipeInfo),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    views: {
      full: [
        { id: 'rz-craft', el: 'crafting' },
        { id: 'rz-desc', el: 'description' },
        { id: 'rz-f', el: 'fields', fields: 'all' },
        { id: 'rz-b', el: 'prose', fields: 'all' },
        { id: 'rz-r', el: 'relations' },
      ],
    },
  },

  /**
   * **Ein Beruf** (T-196) ist eine Regel: er trägt den Text des Regelwerks,
   * Quelle und Marken wie jede, und dazu seine Werkzeuge. Seine Seite ist
   * die Handwerksübersicht — Beschreibung, Rezepte mit SG und Zeit, die
   * Materialien —, gezeichnet vom Element `crafting`, das am Rezept die
   * Werkbank ist: ein Element, das am Server fragt, was hier zu zeigen ist.
   */
  Trade: {
    name: 'Trade',
    area: 'rules',
    label: 'Trade',
    extends: ['Rule'],
    schema: merge(g.TradeInfo),
    /* Als Anpassung: die Karte nennt die Werkzeuge, die Seite die
       Übersicht unter Bild und Beschreibung (wie `uebersicht` in
       ansichten.ts, nur mit der Art angelegt, Migration 087). */
    views: {
      quick: { adjust: { add: { 'q-f': ['Trade.tools'] } } },
      full: { adjust: { extra: [{ id: 'l-crafting', el: 'crafting' }], order: ['l-img', 'l-desc', 'l-crafting'] } },
    },
  },

  /**
   * **Ein Material nach Eigenschaft** (T-197): ein Rezept braucht „ein
   * Reagenz, mindestens ungewöhnlich" — die `needs`-Kante zeigt auf diese
   * Gruppe statt auf einen Gegenstand. Eine Regel, kein Gegenstand: man
   * trägt sie nicht, man erfüllt sie.
   */
  MaterialGroup: {
    name: 'MaterialGroup',
    area: 'rules',
    label: 'Material group',
    extends: ['Rule'],
    schema: merge(g.MaterialGroupInfo),
  },

  /**
   * **Eine Ersatzregel** (T-197): welche Materialien für welche einspringen
   * dürfen. Gilt, wo die Kampagne sie nennt (`allowsSubstitution`).
   */
  Substitution: {
    name: 'Substitution',
    area: 'rules',
    label: 'Material substitution',
    extends: ['Rule'],
    schema: merge(g.SubstitutionInfo),
  },

  /**
   * **Ein Begriff im Glossar** (T-242): ein Wort mit Definition, Wirkung,
   * Beispielen und Übersetzungen. Erbt von `Rule`, weil er wie eine Regel
   * nachgeschlagen wird und `Rule.autolink` sagt, ob sein Name im
   * Fliesstext erkannt wird (REQ-175). Worauf er sich bezieht — den
   * Zustand, die Eigenschaft, die Aktion —, sagt die Kante `explains`.
   * Spielbegriffe liegen als Artikel in der Ebene ihres Regelwerks, eigene
   * in der Kampagne; die Wörter der App selbst stehen im Repo
   * (`packages/registry/src/glossar.ts`), weil sie zum Code gehören.
   */
  /**
   * **Eine Notiz auf der Karte** (T-214, E-070 a): ein eigener Artikel und
   * kein Text an der Kante — so hat sie Sichtbarkeit, Stand, Ebene und
   * Verweise wie alles andere, und zurückgehalten wird sie am Server wie
   * jeder Artikel. Auf der Karte steht ein Marker, der auf sie zeigt; der
   * Text ist `Description.description`. Gelesen wird sie als Karte
   * (`markerView: 'card'`).
   */
  Note: {
    name: 'Note',
    area: 'play',
    label: 'Note',
    extends: ['Identity', 'Description', 'Status', 'Visibility', 'Tags'],
    titles: { 'Description.description': 'Text' },
    markerView: 'card',
  },

  GlossaryTerm: {
    name: 'GlossaryTerm',
    area: 'rules',
    label: 'Glossary term',
    extends: ['Rule'],
    schema: merge(g.GlossaryTermInfo),
    titles: { 'Description.description': 'Definition' },
    views: { overview: [{ id: 'glo-ov', el: 'fields', fields: ['GlossaryTerm.sort', 'Description.description'] }] },
  },

  /**
   * **Ein Fertigungsauftrag** (T-128) ist eine Instanz des Rezepts: er
   * erbt von `Recipe` und zeigt mit `instanceOf` auf das Rezept, liest dort
   * Werkzeug, SG, Zeit, Material und Ertrag und speichert nur, was abweicht
   * (ein anderer SG für diesen einen Auftrag). Eigen sind ihm Fortschritt,
   * Ausgang und Proben. Nicht das Endprodukt: ein Ertrag von drei Tränken
   * ist ein Stapel im Inventar, keine Instanz, und eine Instanz ist kein
   * Verweisziel — ein Gegenstand im Inventar ist eines.
   */
  CraftingOrder: {
    name: 'CraftingOrder',
    area: 'play',
    label: 'Crafting order',
    extends: ['Recipe'],
    schema: merge(g.CraftingOrderInfo),
    views: {
      full: [
        { id: 'co-craft', el: 'crafting' },
        { id: 'co-f', el: 'fields', fields: 'all' },
        { id: 'co-b', el: 'prose', fields: 'all' },
        { id: 'co-r', el: 'relations' },
      ],
    },
  },

  /**
   * Ein Board ist ein Artikel, und was darauf liegt, sind Kanten. Damit
   * beantwortet „wo liegt dieser NSC überall?" derselbe Rückbezug wie
   * überall sonst — und ein Board kann geteilt, versioniert und mit Wissen
   * belegt werden, ohne dass dafür etwas Neues erfunden wird.
   */
  Board: {
    name: 'Board',
    area: 'play',
    label: 'Board',
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Notes'],
    schema: merge(g.BoardInfo),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    views: {
      full: [
        { id: 'b-board', el: 'board' },
        { id: 'b-f', el: 'fields', fields: 'all', except: ['Board.shapes', 'Board.anchors'] },
      ],
    },
  },

  /**
   * Eine Begegnung hängt über `partOf` an irgendeiner Stufe der Geschichte —
   * an einer Szene, einem Kapitel, einer Kampagne. Sie ist keine eigene
   * Stufe der Leiter, denn dieselbe Begegnung kann in zwei Sitzungen
   * auftauchen, und eine Stufe kann das nicht.
   */
  Encounter: {
    name: 'Encounter',
    area: 'play',
    label: 'Encounter',
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Todos', 'Tactics', 'ReadAloud', 'Notes', 'Secrets', 'Difficulty', 'Played'],
    schema: merge(g.EncounterInfo),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    views: {
      overview: [{ id: 'e-ov', el: 'fields', fields: ['Encounter.kind', 'Encounter.phase'] }],
      /* Anzeige je Art (T-184): die Initiative bei einem Kampf, bei
         Teilnehmenden oder wenn die Art nicht gesagt ist — so stand sie
         vor T-178 an jeder Begegnung; die übrigen Gruppen nur bei ihrer
         Art. Was ein ausgelassenes Element gezeichnet hätte, nehmen
         `e-f` und `e-b`. */
      full: [
        { id: 'e-init', el: 'initiative', when: { field: 'Encounter.kind', has: ['combat'], empty: true, relation: 'participates' } },
        { id: 'e-desc', el: 'description' },
        { id: 'e-read', el: 'prose', fields: ['ReadAloud.readaloud'], when: { field: 'Encounter.kind', has: ['story', 'social', 'exploration'] } },
        { id: 'e-puzzle', el: 'fields', fields: ['Encounter.solution'], when: { field: 'Encounter.kind', has: ['puzzle'] } },
        { id: 'e-hints', el: 'prose', fields: ['Encounter.hint'], when: { field: 'Encounter.kind', has: ['puzzle'] } },
        { id: 'e-social', el: 'fields', fields: ['Encounter.goal'], when: { field: 'Encounter.kind', has: ['social'] } },
        { id: 'e-yield', el: 'fields', fields: ['Encounter.check'], when: { field: 'Encounter.kind', has: ['resource', 'exploration', 'hazard', 'trap'] } },
        { id: 'e-f', el: 'fields', fields: 'all' },
        { id: 'e-b', el: 'prose', fields: 'all' },
      ],
    },
  },

  /**
   * Ein Ereignis in der Weltzeit (REQ-106). Es verlangt ein Weltdatum —
   * ohne das ist es kein Ereignis, sondern eine Notiz. Sortiert wird nach
   * `Time.sort`, gelesen wird `Time.display`.
   */
  /* `Story` ist die Geschichte des *Spiels* — Kampagne, Arc (auch ein
     Abenteuerkapitel), Sitzung, Szene. Was der Welt widerfuhr, bevor jemand sie bespielte,
     hängt dagegen an `Event`: eine Ära dauert Jahrhunderte, ein Kataklysmus
     Tage, ein Meilenstein einen Nachmittag. `Era`, `Cataclysm` und
     `Milestone` waren drei Zeilen ohne ein eigenes Feld — jetzt sind sie
     Wörter in `Event.kind` (Abgleich A5, Regel T2, 7.10.).
     **Bereich `world`** (13.10.): die Weltgeschichte steht bei der Welt;
     `story` ist nur, was die Kampagne betrifft. */
  Event: {
    name: 'Event',
    area: 'world',
    label: 'Event',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Time', 'Lore', 'Secrets', 'ReadAloud'],
    schema: merge(g.EventInfo),
  },

  /**
   * Eine Tabelle ist ein Artikel: sie trägt Marken, einen Stand und Wissen,
   * und sie kann in einer anderen Tabelle stehen. Verschachtelung ist eine
   * Kante auf eine Tabelle, nicht ein Sonderfeld — deshalb braucht sie
   * einen Zyklusschutz und sonst nichts.
   */
  Table: {
    name: 'Table',
    area: 'rules',
    label: 'Table',
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Source', 'Notes', 'Secrets'],
    schema: merge(g.TableInfo),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    views: {
      /* Die Spalten im Kompendium (W7, `listColumns`). */
      overview: [{ id: 't-ov', el: 'fields', fields: ['Table.kind', 'Table.die'] }],
      full: [
        { id: 't-table', el: 'table' },
        { id: 't-desc', el: 'description' },
        { id: 't-f', el: 'fields', fields: 'all', except: ['Table.rows'] },
        { id: 't-b', el: 'prose', fields: 'all' },
      ],
    },
  },

  /**
   * Eine Ebene ist ein Artikel (REQ-004). Was zu ihr gehört, sagen Kanten —
   * `inLayer` von der Sache zur Ebene, nicht umgekehrt: eine Liste an der
   * Ebene müsste bei jedem neuen Artikel angefasst werden, und wer sie
   * vergisst, hat einen Artikel, den niemand findet.
   */
  Layer: {
    name: 'Layer',
    label: 'Layer',
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Notes'],
    schema: merge(g.LayerInfo),
  },

  /**
   * **Regelsystem und Regelmechanik sind Ebenen** (E-166): eigene Arten,
   * damit „ist ein Regelsystem“ keine Bedeutung eines `kind`-Wortes wird.
   * Sie erben alles von `Layer` — aufschalten, ordnen, schreiben — und
   * stehen in `LAYER_TYPES` (`packages/model/src/stack.ts`).
   */
  RuleSystem: {
    name: 'RuleSystem',
    label: 'Rule system',
    extends: ['Layer'],
    schema: merge(g.RuleSystemInfo),
  },

  /* Die Karte der Vorgabeformen (T-394, E-165): nur an Regelmechaniken. */
  ShapeDefaults: {
    name: 'ShapeDefaults',
    label: 'Default shapes',
    abstract: true,
    schema: g.ShapeDefaults.schema,
  },

  RuleMechanic: {
    name: 'RuleMechanic',
    label: 'Rule mechanic',
    extends: ['Layer', 'ShapeDefaults'],
    schema: merge(g.RuleMechanicInfo),
  },

  /**
   * Eine Gruppe von Menschen. Sie trägt kein Blatt, keine Werte und keine
   * Ausrüstung — sie ist da, damit Wissen einen Empfänger hat, der grösser
   * ist als eine Figur und anders als eine Party.
   *
   * Bereich `rules`: sie gehört zur Einrichtung der Runde und nicht in die
   * Welt. Eine Gruppe im Kompendium neben den Fraktionen zu führen hiesse,
   * sie für Kampagneninhalt zu halten.
   *
   * Sie stand bis 2026-09-21 in `play` — die Umbenennung `game` → `rules`
   * hat hier `play` eingesetzt, und der Kommentar daneben sagte weiter
   * `game`. Play ist, worauf man während der Sitzung schaut; eine Gruppe
   * richtet man vorher ein.
   */
  /* `Group` stand hier: ein Träger von Konten für „die Spieler dieser
     Kampagne“, die ein Konto wie eine Figur führte (`app_user_actor`).
     Seit `campaign_member` ist das eine Rolle; im Register und im Prototyp
     gab es keine Mitgliedskante. Es gibt eine Gruppe, die von Figuren,
     und die heisst `Party` (A8, 7.10.).
     Wanderung: `prototype/migration/gruppe-ist-party.mjs`. */
};
