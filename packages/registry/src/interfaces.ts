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
     nirgends oder als freier Text am Statblock. */
  Proficiencies: {
    name: 'Proficiencies',
    label: 'Proficiencies',
    abstract: true,
    schema: g.Proficiencies.schema,
  },

  /* Eine Stufe von 1 bis 20, die Begegnung und Szene teilen. */
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
     * `PlayerCharacter` bleibt eine eigene Art: er trägt Stufe, Klasse,
     * Herkunft und den gerechneten Übungsbonus — Felder, die keine andere
     * Kreatur hat.
     */
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Source', 'Vars', 'Vitals', 'Proficiencies', 'Lore', 'Facts', 'Secrets', 'ReadAloud'],
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
                     wird am Tag des Umzugs still falsch. */
                  except: ['Vitals', 'Proficiencies'],
                },
                { id: 'c-b', el: 'prose', fields: 'all' },
              ],
            },
            /* Was im Kampf zählt. Die Zahlen stehen oben im Bogen; hier
               steht, was man mit ihnen tut. */
            { id: 'combat', label: 'Combat', layout: [{ id: 'c-c', el: 'composed' }] },
            { id: 'gear', label: 'Gear', layout: [{ id: 'c-inv', el: 'inventory' }] },
            { id: 'craft', label: 'Craft', layout: [{ id: 'c-craft', el: 'crafting' }] },
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
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Lore', 'ReadAloud', 'Secrets'],
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
        { id: 'o-r', el: 'relations' },
      ],
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
    /* Ein Gedicht und ein Lied hat sonst keine Art. Einen Bestandteil für
       einen einzigen Nutzer anzulegen wäre der Umweg, den es hier schon
       achtunddreissigmal gab. */
    schema: {
      type: 'object',
      properties: {
        poem: { type: 'string', format: 'long', many: true, title: 'Poems' },
        song: { type: 'string', format: 'long', many: true, title: 'Songs' },
      },
    },
  },

  /** The reuse pool: traits, actions, conditions, feats — all one interface. */
  Rule: {
    name: 'Rule',
    area: 'rules',
    label: 'Rule Element',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Source', 'Vars'],
    schema: merge(g.RuleInfo),
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
    extends: ['Rule'],
    schema: merge(g.FeatInfo),
  },

  Skill: {
    name: 'Skill',
    area: 'rules',
    label: 'Skill',
    extends: ['Rule'],
    schema: merge(g.SkillInfo),
  },

  /** An entity of its own (D4), referenced by creatures, never embedded. */
  Statblock: {
    name: 'Statblock',
    area: 'rules',
    label: 'Statblock',
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Source', 'Abilities', 'Vars', 'Tactics'],
    schema: merge(g.StatblockCore),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    views: {
      full: [
        { id: 's-f', el: 'fields', fields: 'all' },
        { id: 's-c', el: 'composed' },
        { id: 's-b', el: 'prose', fields: 'all' },
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
    extends: ['Identity', 'Prose', 'Notes', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Source', 'Lore', 'Secrets', 'Facts'],
    schema: merge(g.ItemInfo, g.Footprint),
  },

  Weapon: {
    name: 'Weapon',
    area: 'world',
    label: 'Weapon',
    extends: ['Item'],
    schema: merge(g.WeaponInfo),
  },

  Armor: {
    name: 'Armor',
    area: 'world',
    label: 'Armor',
    extends: ['Item'],
    schema: merge(g.ArmorInfo),
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
   * Die Sprosse der Erzählung. Kampagne, Sitzung und Szene sind eigene
   * Arten, weil sie eigene Felder und Ansichten tragen; **Arc und Kapitel
   * sind Wörter** in `Story.kind` (Abgleich A5, Regel T2, 7.10.) — sie
   * trugen als Zeilen kein eigenes Feld und keine Kante. Darum ist `Story`
   * nicht mehr abstrakt: ein Arc *ist* eine Story mit `kind: 'arc'`.
   * Braucht eine Sprosse einmal eigene Felder, wird sie eine Zeile, die von
   * `Story` erbt — wie `Session`. Die Hierarchie trägt `partOf`.
   */
  Story: {
    name: 'Story',
    area: 'history',
    label: 'Story',
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Todos', 'Time', 'Lore', 'Secrets', 'ReadAloud', 'Notes'],
    schema: merge(g.StoryInfo),
  },

  /**
   * **Wer die Kampagne leitet, steht nicht an ihr**, sondern am Konto:
   * `campaign_member` hält je Konto und Kampagne eine Rolle (`gm`, `co-gm`,
   * `player`, `spectator`). Für einen Tag stand hier eine `Access`-Karte mit
   * `role: 'gm'` — eine Kontoangabe in einem Artikel, die beim Export
   * mitgewandert wäre, und eine zweite Stelle neben den Figuren der Konten.
   */
  Campaign: {
    name: 'Campaign',
    area: 'history',
    label: 'Campaign',
    extends: ['Story'],
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    /* Die Kampagne trägt, was über ihr Ganzes geht: welche Ebenen laufen,
     was offen ist, was wann geschah. Das sind keine eigenen
     Artikelarten — es sind Fragen an die Kampagne. */
    views: {
      full: [
        { id: 'k-desc', el: 'description' },
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
    area: 'history',
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
      ],
    },
  },

  Scene: {
    name: 'Scene',
    area: 'history',
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
    area: 'history',
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
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Notes', 'Secrets', 'ReadAloud'],
    schema: merge(g.MapInfo),
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
    extends: ['Identity', 'Prose', 'Status', 'Description', 'Visibility', 'Tags', 'Todos', 'Tactics', 'ReadAloud', 'Notes', 'Secrets', 'Difficulty'],
    schema: merge(g.EncounterInfo),
    /* Wie diese Art gezeichnet wird. **Die Anordnung wohnt am Typ**;
       Untertypen erben sie, bis einer etwas Eigenes sagt. */
    views: {
      full: [
        { id: 'e-init', el: 'initiative' },
        { id: 'e-desc', el: 'description' },
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
  /* `Story` ist die Geschichte des *Spiels* — Kampagne, Arc, Kapitel,
     Sitzung, Szene. Was der Welt widerfuhr, bevor jemand sie bespielte,
     hängt dagegen an `Event`: eine Ära dauert Jahrhunderte, ein Kataklysmus
     Tage, ein Meilenstein einen Nachmittag. `Era`, `Cataclysm` und
     `Milestone` waren drei Zeilen ohne ein eigenes Feld — jetzt sind sie
     Wörter in `Event.kind` (Abgleich A5, Regel T2, 7.10.). */
  Event: {
    name: 'Event',
    area: 'history',
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
