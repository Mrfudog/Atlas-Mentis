import type { ObjectSchema } from '@nw/model';

/**
 * Feldgruppen — **ein Ordnungsmittel dieser Datei und keine Registerzeile.**
 *
 * Im Register gibt es sie nicht: eine Art trägt ihre Felder selbst
 * (`interfaces.ts` setzt sie mit `merge` zusammen). Hier stehen sie
 * gruppiert, weil 19 Felder an `Base` als eine Liste niemand liest.
 *
 * Es waren einmal Komponenten mit `name`, `label` und `engine`. `engine` las
 * keine Zeile Code; die Namen standen zweimal da; und die Bezeichnung einer
 * Gruppe war eine Überschrift, die keine Ansicht zeichnete.
 */
interface FieldGroup {
  schema: ObjectSchema;
}

/* `satisfies` statt einer Annotation: so kennt der Übersetzer die Namen
   und `g.Vitals` ist nicht „vielleicht undefiniert". */
export const fieldGroups = {

  /* Wer der Artikel ist. Das erbt jede Artikelart — ohne Namen und ohne
     Schlüssel gibt es nichts nachzuschlagen. */
  Identity: {
    schema: {
      type: 'object',
      required: ['name', 'id'],
      properties: {
        name: { type: 'string', title: 'Name' },
        /* **Ausgegeben, nicht eingetippt** (`npc-0042`): die Artikelart und
           eine laufende Nummer darin. Es hiess einmal `key` und stand als
           `npc/volo-geddarm` da — ein Name, der ein zweites Mal derselbe
           Name war, und der beim Umbenennen entweder mitwandern musste oder
           still falsch wurde. Eine Nummer sagt nichts und bleibt deshalb
           richtig; wie der Artikel heisst, steht daneben. */
        id: { type: 'string', title: 'ID', readOnly: true },
        aliases: { type: 'array', title: 'Aliases', items: { type: 'string' } },
        /* Der Deckname (REQ-178): was ein Spieler sieht, solange der echte
           Name von einer Information beansprucht wird, die er nicht kennt.
           Ohne ihn stünde dort der echte Name oder gar nichts — beides
           macht partielle Enthüllung unspielbar. */
        cover: { type: 'string', title: 'Cover name' },
      },
    },
  },

  Description: {
    schema: {
      type: 'object',
      properties: { description: { type: 'string', format: 'long', title: 'Description' } },
    },
  },

  /**
   * Marken. Bis hierher war `tags` eine Eigenschaft der Entität selbst —
   * die einzige, die keiner Art gehörte, und damit die einzige, die man
   * nirgends weglassen konnte. Jetzt ist es ein Bestandteil wie jeder
   * andere: wer ihn erbt, hat Marken, und wer nicht, hat keine.
   *
   * Die Marken selbst sind keine Aufzählung im Register: welche es gibt,
   * sagen die Artikel. Eine feste Liste hiesse, dass eine neue Marke eine
   * Registeränderung braucht — und gemarkt wird während der Sitzung.
   */
  Tags: {
    schema: {
      type: 'object',
      properties: {
        tags: { type: 'array', format: 'tags', title: 'Tags', items: { type: 'string' } },
      },
    },
  },

  Status: {
    schema: {
      type: 'object',
      properties: {
        /* `default` gilt beim Anlegen, nicht rückwirkend. Bis hierher stand
           „idea" fest im Code, der Artikel anlegt — also genau die Sorte
           Wissen, die eine Registerzeile sein soll. */
        /* Die Werte stehen als Aufzählungszeile `State` im Register und
           nicht hier: derselbe Vorbereitungsstand gilt für jeden Artikel,
           und wer die Liste ändert, ändert sie an einer Stelle.

           Aus vier Wörtern sind drei geworden. `used` und `discarded`
           waren keine Zustände, sondern Ereignisse — dass eine Begegnung
           gespielt wurde, gehört ins Kampagnenlog, und nicht in ein Feld,
           das danach für immer „benutzt" sagt. */
        status: {
          type: 'string',
          title: 'Status',
          enumRef: 'State',
          default: 'idea',
        },
      },
    },
  },

  /* ---------------------------------------------------------------- Prosa

     Das waren einmal **Blöcke**: `{blockType, body, anchor}` neben den
     Feldern, mit einer eigenen Liste erlaubter Arten je Artikelart. Ein
     zweiter Begriff für Text, der neben den Feldern lag — und der Preis
     dafür war, dass jede Frage zweimal beantwortet werden musste: welche
     Felder darf diese Art, *und* welche Blockarten.

     Jetzt ist die Blockart das Feld. `secret` ist ein Feld mit `many`, und
     seine Einträge tragen die Id, an der die Wissensfreigabe hängt — das
     war der Anker. Eine Art, die Geheimnisse trägt, nimmt `Secrets` dazu;
     eine, die keine hat, lässt es weg. */

  /** Fliesstext, den jeder Artikel haben darf. */
  Prose: {
    schema: {
      type: 'object',
      properties: {
        paragraph: { type: 'string', format: 'long', many: true, title: 'Text' },
      },
    },
  },

  /** Was die Spielleitung sich notiert. Steht offen — es ist keine Zusage. */
  Notes: {
    schema: {
      type: 'object',
      properties: {
        note: { type: 'string', format: 'long', many: true, title: 'Notes' },
      },
    },
  },

  /** Was man darüber weiss, wenn man sich auskennt. */
  Lore: {
    schema: {
      type: 'object',
      properties: {
        lore: { type: 'string', format: 'long', many: true, title: 'Lore' },
      },
    },
  },

  /**
   * Was nicht an den Tisch geht, solange es niemand freigibt. Steht in der
   * Einstellung `gmFields` und wird deshalb am Server zurückgehalten — ein
   * Eintrag, den eine bekannte Information freigibt, bleibt trotzdem
   * seiner.
   */
  Secrets: {
    schema: {
      type: 'object',
      properties: {
        secret: { type: 'string', format: 'long', many: true, title: 'Secrets' },
      },
    },
  },

  /** Was man vorliest. */
  ReadAloud: {
    schema: {
      type: 'object',
      properties: {
        readaloud: { type: 'string', format: 'long', many: true, title: 'Read aloud' },
      },
    },
  },

  /** Einzelne festgestellte Tatsachen — je Eintrag freigebbar (REQ-059). */
  Facts: {
    schema: {
      type: 'object',
      properties: {
        fact: { type: 'string', format: 'long', many: true, title: 'Facts' },
      },
    },
  },

  /** Wie man es spielt. Gehört der Spielleitung wie die Geheimnisse. */
  Tactics: {
    schema: {
      type: 'object',
      properties: {
        tactics: { type: 'string', format: 'long', many: true, title: 'Tactics' },
      },
    },
  },

  /**
   * Stored in full from day one; only `audience` gm/campaign is evaluated for
   * now. The remaining fields exist so player access is not a schema change.
   */
  Visibility: {
    schema: {
      type: 'object',
      properties: {
        audience: { type: 'string', title: 'Audience', enum: ['gm', 'campaign', 'players', 'public'] },
        scope: { type: 'string', title: 'Scope' },
        revealedTo: { type: 'array', title: 'Revealed to', items: { type: 'string' } },
        hiddenFrom: { type: 'array', title: 'Hidden from', items: { type: 'string' } },
        sharedUsers: { type: 'array', title: 'Shared with', items: { type: 'string' } },
        inherit: { type: 'boolean', title: 'Inherit to children', default: true },
      },
    },
  },


  Image: {
    schema: {
      type: 'object',
      properties: {
        /* `image` zeigt auf ein Asset, eine Ablage-Id oder eine fremde
           Adresse und wird vom Auflöser gelesen.

           Daneben stand einmal `url`, „Source (legacy)": die Adresse des
           Bildes aus der Zeit vor den Assets. **Woher ein Bild stammt,
           gehört ans Asset** — das ist ein Artikel und erbt `Source`. Am
           Artikel, der es zeigt, stünde dieselbe Herkunft noch einmal, und
           zwar bei jedem der fünf Orte, die dasselbe Wappen zeigen. */
        image: { type: 'string', format: 'asset', title: 'Image' },
        caption: { type: 'string', title: 'Caption' },
        alt: { type: 'string', title: 'Alt text' },
      },
    },
  },

  /** Entity-level defaults for {VAR} placeholders (REQ-174). */
  Vars: {
    schema: { type: 'object', properties: { bindings: { type: 'object', title: 'Bindings' } } },
  },

  CreatureInfo: {
    schema: {
      type: 'object',
      properties: {
        /* Prosa, die nur eine Kreatur hat. Ein eigener Bestandteil dafür
           wäre einer mit genau einem Nutzer — davon gab es hier schon
           achtunddreissig. */
        appearance: { type: 'string', format: 'long', many: true, title: 'Appearance' },
        personality: { type: 'string', format: 'long', many: true, title: 'Personality' },
        species: { type: 'string', title: 'Species' },
        /**
         * **Was für eine Kreatur das ist** — npc, companion, retainer,
         * pet, summon, follower.
         *
         * Das waren eigene Artikelarten: `NPC`, `Companion`, `Retainer`,
         * drei Zeilen, die zusammen kein einziges eigenes Feld trugen.
         * Eine Art, die nichts eigenes erklärt, erklärt nichts — und die
         * Sonderregeln, die einen Begleiter zum Begleiter machen, stehen
         * ohnehin am Statblock und an der Regel, auf die er zeigt.
         *
         * Ein freies Wort und keine Aufzählung: die Maske schlägt vor, was
         * an anderen Kreaturen schon dasteht, und eine neue Sorte ist ein
         * Eintrag und keine Registeränderung. `role` bleibt daneben und
         * meint etwas anderes — der Wirt, die Wache, die Händlerin.
         */
        kind: { type: 'string', title: 'Kind' },
        role: { type: 'string', title: 'Role' },
        attitude: {
          type: 'string',
          title: 'Attitude',
          enum: ['freundlich', 'neutral', 'feindlich', 'unbekannt'],
        },
      },
    },
  },

  /**
   * **Die sechs Werte** — und was sich unmittelbar aus ihnen rechnet.
   *
   * Sie standen in `StatblockInfo`, einer Karte mit dreissig Feldern: die
   * Werte, die Rüstungsklasse, die Trefferpunkte, die Sinne, die
   * Widerstände. Ein Sammelname für alles, was an einem Statblock steht —
   * also keine Auskunft. Jetzt trägt der Statblock seine eigenen Felder und
   * nimmt `Abilities` dazu; eine andere Art, die die sechs Werte braucht,
   * nimmt dieselbe Zeile.
   *
   * Die gerechneten stehen **hier** und nicht am Statblock: `mod(dex)` löst
   * gegen die Nachbarn derselben Karte auf (D8). Ein Modifikator in einer
   * anderen Karte als sein Wert könnte nichts rechnen.
   */
  Abilities: {
    schema: {
      type: 'object',
      properties: {
        str: { type: 'number', title: 'STR' },
        strMod: { type: 'number', title: 'STR mod', derived: 'mod(str)', of: 'str', format: 'signed' },
        dex: { type: 'number', title: 'DEX' },
        dexMod: { type: 'number', title: 'DEX mod', derived: 'mod(dex)', of: 'dex', format: 'signed' },
        con: { type: 'number', title: 'CON' },
        conMod: { type: 'number', title: 'CON mod', derived: 'mod(con)', of: 'con', format: 'signed' },
        int: { type: 'number', title: 'INT' },
        intMod: { type: 'number', title: 'INT mod', derived: 'mod(int)', of: 'int', format: 'signed' },
        wis: { type: 'number', title: 'WIS' },
        wisMod: { type: 'number', title: 'WIS mod', derived: 'mod(wis)', of: 'wis', format: 'signed' },
        cha: { type: 'number', title: 'CHA' },
        chaMod: { type: 'number', title: 'CHA mod', derived: 'mod(cha)', of: 'cha', format: 'signed' },
        initiative: { type: 'number', title: 'Initiative', derived: 'mod(dex)', format: 'signed' },
        passivePerception: { type: 'number', title: 'Passive perception', derived: '10+mod(wis)' },
      },
    },
  },

  /**
   * Was der Statblock **selbst** festhält: Regelwerk, Grösse, Art,
   * Gesinnung, Panzerung, Trefferpunkte, Bewegung, Herausforderung,
   * Übungsbonus, Rolle, Sinne und die drei Widerstandsfelder.
   *
   * `system` war Pflicht, solange die Karte nur am Statblock hing. Als
   * geteilte Karte hiesse Pflicht: jede Kreatur, die ihre Zahlen borgt,
   * müsste trotzdem ein Regelwerk angeben. Statt der Pflicht steht ein
   * Vorgabewert.
   */
  StatblockCore: {
    schema: {
      type: 'object',
      properties: {
        system: { type: 'string', title: 'System', default: 'dnd5e' },
        size: {
          type: 'string',
          title: 'Size',
          enum: ['winzig', 'klein', 'mittel', 'gross', 'riesig', 'gewaltig'],
        },
        kind: { type: 'string', title: 'Creature type' },
        alignment: { type: 'string', title: 'Alignment' },
        ac: { type: 'number', title: 'Armour class' },
        acNote: { type: 'string', title: 'AC note' },
        hp: { type: 'number', title: 'Hit points' },
        hpFormula: { type: 'string', title: 'Hit dice' },
        /* `unit` ist das Ausgangsmass: die Einheit der Zahlen, die keine
           nennen. „40 ft, climb 20 ft" sagt es selbst, „40" nicht. */
        speed: { type: 'string', format: 'measure', unit: 'ft', title: 'Speed' },
        cr: { type: 'string', title: 'Challenge rating' },
        prof: { type: 'number', title: 'Proficiency bonus' },
        combatRole: { type: 'string', title: 'Combat role' },
        senses: { type: 'string', title: 'Senses' },
        /* `languages`, `saves` und `skills` standen hier als freier Text
           und zugleich als Listen an `Proficiencies` — dieselbe Sache
           zweimal, einmal zum Rechnen und einmal zum Lesen. Die Listen
           gewinnen: darauf rechnet der Bogen. */
        resistances: { type: 'string', title: 'Resistances' },
        vulnerabilities: { type: 'string', title: 'Vulnerabilities' },
        immunities: { type: 'string', title: 'Immunities' },
      },
    },
  },

  RuleInfo: {
    schema: {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: {
          type: 'string',
          title: 'Rule kind',
          enum: [
            'action',
            'bonus',
            'reaction',
            'feature',
            'trait',
            'condition',
            'legendary',
            'lair',
            'feat',
            'skill',
          ],
        },
        uses: { type: 'string', title: 'Uses' },
        /* Ob der Name dieser Regel im Fliesstext erkannt werden darf
           (REQ-175). Ein falscher Treffer kostet mehr Vertrauen, als zehn
           richtige einbringen — deshalb lässt er sich hier abschalten. */
        autolink: { type: 'boolean', title: 'Spot it in prose', default: true },
        recharge: { type: 'string', title: 'Recharge' },
      },
    },
  },

  FeatInfo: {
    schema: {
      type: 'object',
      properties: {
        prerequisite: { type: 'string', title: 'Prerequisite' },
        repeatable: { type: 'boolean', title: 'May be taken again', default: false },
      },
    },
  },

  /* Eine Fertigkeit ist auch das Werkzeug, mit dem jemand umgehen kann: in
     5e stehen beide auf derselben Liste und werden gleich geprüft. `tool`
     sagt, welche von beiden es ist — nicht zwei Artikelarten, die sich in
     nichts unterscheiden ausser im Wort. */
  SkillInfo: {
    schema: {
      type: 'object',
      properties: {
        /* Welcher der sechs Werte die Probe trägt. Die Liste steht als
           Aufzählungszeile `Ability` im Register — an `RecipeInfo.ability`
           standen dieselben sechs Wörter ein zweites Mal. */
        ability: {
          type: 'string',
          title: 'Ability',
          enumRef: 'Ability',
        },
        tool: { type: 'boolean', title: 'A tool, not a skill', default: false },
      },
    },
  },

  LocationInfo: {
    schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          title: 'Place type',
          enum: ['Reich', 'Stadt', 'Distrikt', 'Gasse', 'Gebäude', 'Raum', 'Wildnis'],
        },
        environment: { type: 'string', title: 'Environment' },
        /* `settlementType` fiel weg: `kind` sagt es schon, mit
           `Stadt`/`Distrikt`/`Gebäude`. Zwei Felder für dieselbe Frage
           heissen, dass eines gefüllt wird und das andere gelesen. Wird
           eine Siedlung einmal genauer, ist sie ein Untertyp von `Place`
           und keine zweite Spalte. */
      },
    },
  },

  FactionInfo: {
    schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', title: 'Kind' },
        /* `format: 'color'` und nicht bloss ein String: sonst steht in der
           Feldtabelle `#8b5cf6` als Text, und das Feld heisst „Colour",
           ohne je eine zu zeigen. Die Prüfung hat es nicht gesehen, weil
           sie die Feldart selbst setzt — sie prüfte den Editor, nicht die
           Zeile. */
        color: { type: 'string', format: 'color', title: 'Colour' },
      },
    },
  },

  // ---------------------------------------------------------------- items

  ItemInfo: {
    schema: {
      type: 'object',
      properties: {
        itemType: { type: 'string', title: 'Item type' },
        // Two different scales, deliberately kept apart: `rarity` is the 5e
        // magic-item rarity, `availability` is how hard the thing is to buy.
        rarity: { type: 'string', title: 'Rarity',
          enum: ['gewöhnlich', 'ungewöhnlich', 'selten', 'sehr selten', 'legendär', 'artefakt'] },
        /* **Nicht dasselbe wie `rarity`.** Die ist die Seltenheit des
           magischen Gegenstands („selten", „legendär"); das hier ist, wie
           schwer er zu *kaufen* ist — im Vault die Hausregel-Leiter
           `Kaufrarität`. Die beiden zusammenzulegen verlöre genau die
           Unterscheidung, die dort jemand sorgfältig gemacht hat. */
        availability: { type: 'string', title: 'Purchase rarity' },
        copperPrice: { type: 'number', title: 'Price in copper' },
        /* Leer, solange das Hausregel-Inventar nicht läuft: dort sagt
           die Stapelgrösse, wie viele auf ein Feld gehen. Kein totes Feld,
           sondern ein Feld eines Moduls. */
        stackSize: { type: 'number', title: 'Stack size' },
        /* Ein Gewicht als **Zahl mit Einheit** und nicht als Text: was sich
           addieren lassen soll, muss eine Zahl sein. In welcher Einheit es
           dasteht, sagt `unit`; was der Leser sieht, entscheidet die
           Einstellung oder die Artikelart. */
        /* Ebenso: das Standardmodul rechnet mit Gewicht, das
           Kachelinventar mit `rows`. Beide dürfen dastehen, weil nur eines
           von beiden zur Zeit gilt. */
        weight: { type: 'number', unit: 'lb', title: 'Weight' },
      },
    },
  },

  /**
   * The grid-inventory shape. Its dimensions are derived, never stored.
   * `colCount` / `rowCount` / `cellCount` are Calculation-engine function names
   * (see `calc.ts`), not field names — they stay as the engine spells them.
   */
  Footprint: {
    schema: {
      type: 'object',
      properties: {
        rows: { type: 'array', title: 'Grid', items: { type: 'string' } },
        width: { type: 'number', title: 'Width', derived: 'colCount(rows)' },
        height: { type: 'number', title: 'Height', derived: 'rowCount(rows)' },
        cells: { type: 'number', title: 'Cells', derived: 'cellCount(rows)' },
      },
    },
  },

  WeaponInfo: {
    schema: {
      type: 'object',
      properties: {
        damage: { type: 'string', title: 'Damage' },
        damageType: { type: 'string', title: 'Damage type' },
        range: { type: 'string', format: 'measure', unit: 'ft', title: 'Range' },
        /* **Die Eigenschaften sind Kanten**, keine Aufzählung im Text:
           `hasProperty` zeigt auf gepoolte Regelartikel. Genau darum ging
           es beim Import — „Versatil" als Text zu übernehmen kopiert, was
           geteilt gehört, und der Merkzettel am Tisch findet es nicht.
           Hier stand `Properties` mit grossem P: das einzige Feld im ganzen
           Register, das so hiess, und es war ein String. */
      },
    },
  },

  ArmorInfo: {
    schema: {
      type: 'object',
      properties: {
        ac: { type: 'number', title: 'Armour class' },
        armorType: { type: 'string', title: 'Armour type' },
      },
    },
  },

  MaterialInfo: {
    schema: {
      type: 'object',
      properties: {
        materialType: { type: 'string', title: 'Material type' },
        trades: { type: 'array', title: 'Trades', items: { type: 'string' } },
      },
    },
  },

  // ---------------------------------------------------------------- story

  StoryInfo: {
    schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          title: 'Kind',
          enum: ['campaign', 'arc', 'chapter', 'session', 'scene'],
        },
        played: { type: 'string', title: 'Played on' },
        /* Hier stand ein zweiter Zustand — geplant, läuft, gespielt,
           verworfen — neben `Status`. Zwei Felder für „wie weit ist das",
           und keines davon las irgendein Schirm. Was vorbereitet ist, sagt
           `Status`; dass es gespielt wurde, sagt `played` mit einem Datum,
           und das ist die Angabe, die man später wirklich sucht. */
        summary: { type: 'string', format: 'long', title: 'Recap' },
      },
    },
  },

  /**
   * **Wie schwer es ist — als Stufe von 1 bis 20.**
   *
   * Es stand zweimal da und zweimal anders: an der Begegnung als
   * Aufzählung von fünf Wörtern, an der Szene als freier Text, den nie
   * jemand gefüllt hat. Fünf Wörter sind fünf Stufen mit Lücken dazwischen
   * — „zwischen medium und hard" gibt es dann nicht —, und ein freier Text
   * lässt sich nicht vergleichen.
   *
   * Eine Spanne ist keine Aufzählung von zwanzig Wörtern: die Grenzen
   * sagen, was gilt, die Prüfung hält sie, und die Maske macht daraus ein
   * Zahlenfeld mit Anschlag.
   */
  Difficulty: {
    schema: {
      type: 'object',
      properties: {
        difficulty: { type: 'number', title: 'Difficulty', min: 1, max: 20 },
      },
    },
  },

  SceneInfo: {
    schema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          title: 'Mode',
          enum: ['roleplay', 'encounter', 'exploration', 'downtime'],
          default: 'roleplay',
        },
        /* Der Vorlesetext stand hier als **ein** Absatz und kam mit
           `ReadAloud.readaloud` noch einmal herein, sobald die Blockarten
           Felder wurden — zwei Felder mit demselben Namen, eines davon
           heimlich. Eine Szene hat mehrere Vorlesestellen; das Feld mit
           `many` kann das, dieses konnte es nie. */
      },
    },
  },

  QuestInfo: {
    schema: {
      type: 'object',
      properties: {
        /* Wie weit der Auftrag ist — **nicht**, wie weit seine
           Vorbereitung ist. Das Feld hiess `state` wie drei andere in drei
           anderen Typen, und jedes meinte etwas anderes; `Status` ist der
           Vorbereitungsstand, dies der Gang der Sache am Tisch. */
        progress: {
          type: 'string',
          title: 'Progress',
          enum: ['rumoured', 'offered', 'accepted', 'done', 'failed', 'abandoned'],
          default: 'rumoured',
        },
        reward: { type: 'string', title: 'Reward' },
        deadline: { type: 'string', title: 'Deadline' },
        restriction: { type: 'string', title: 'Restriction' },
        /* Aufgaben liegen als Feld am Auftrag, nicht als Kanten: „bring das
           Fass zurück" zeigt auf nichts, was eine eigene ID verdiente.
           Zeigt eine Aufgabe doch auf etwas, steht das im Text als
           [[Verweis]] — und der löst sich auf wie jeder andere. */
        tasks: { type: 'array', title: 'Tasks', items: { type: 'object' } },
      },
    },
  },

  // ---------------------------------------------------------------- party

  CharacterInfo: {
    schema: {
      type: 'object',
      properties: {
        backstory: { type: 'string', format: 'long', many: true, title: 'Backstory' },
        player: { type: 'string', title: 'Player' },
        ancestry: { type: 'string', title: 'Ancestry' },
        class: { type: 'string', title: 'Class' },
        level: { type: 'number', title: 'Level', default: 1 },
        /* The 5e proficiency bonus follows from the level, so it is computed
           on read (D8) and never stored — truncated, like every derived value. */
        proficiency: {
          type: 'number',
          title: 'Proficiency',
          derived: '2+(level-1)/4',
          format: 'signed',
        },
      },
    },
  },

  PartyInfo: {
    schema: {
      type: 'object',
      properties: {
        level: { type: 'number', title: 'Party level' },
        motto: { type: 'string', title: 'Motto' },
      },
    },
  },

  InventoryInfo: {
    schema: {
      type: 'object',
      properties: {
        capacity: { type: 'number', title: 'Slots' },
        copper: { type: 'number', title: 'Purse in copper' },
      },
    },
  },

  /**
   * Wissen (A6): ein Bündel von Feldern und Textstellen eines Artikels, das
   * als Ganzes zugeteilt wird. Die Karte sagt nur, *was* das Bündel umfasst —
   * *wer* es kennt, steht an den `knownBy`-Kanten, weil ein Empfänger ein
   * Peg ist und eine Liste von IDs in einer Karte kein Rückbezug wäre.
   */
  Info: {
    schema: {
      type: 'object',
      properties: {
        /* Feldverweise in der Schreibweise der Ansichten: `Type` nimmt alle
           Felder dieser Art, `Type.field` genau eines — und `Type.field#id`
           genau einen Eintrag eines Feldes mit `many`. Die dritte Form war
           einmal der Blockanker: ein Geheimnis von dreien freizugeben
           heisst, genau dieses freizugeben. */
        fields: { type: 'array', title: 'Fields', items: { type: 'string' } },
        /* Nur Anzeige und Sortierung. Was jemand sehen darf, entscheiden die
           Kanten — ein Rang hier wäre eine zweite, widersprechende Quelle. */
        tier: {
          type: 'string',
          title: 'Guardedness',
          enum: ['open', 'rumour', 'secret'],
          default: 'secret',
        },
      },
    },
  },

  /**
   * Assets (REQ-021). Der Verweis ist der haltbare Zeiger, nicht die Adresse:
   * eine Ablage-Adresse gilt je Ansicht, die Id für immer. Wer ein Bild
   * zeigt, ruft den Auflöser und fragt nie, welche Art Verweis es ist — nur
   * so lässt sich die Ablage wechseln, ohne jeden Verbraucher anzufassen.
   */
  AssetInfo: {
    schema: {
      type: 'object',
      required: ['ref'],
      properties: {
        backend: {
          type: 'string',
          title: 'Backend',
          enum: ['app', 'nas', 'external'],
          default: 'app',
        },
        ref: { type: 'string', title: 'Reference' },
        mime: { type: 'string', title: 'Media type' },
        width: { type: 'number', title: 'Width in px' },
        height: { type: 'number', title: 'Height in px' },
        bytes: { type: 'number', title: 'Bytes' },
      },
    },
  },

  /** Woher eine Angabe stammt (REQ-020) — Publikation, Seite, Anker. */
  Source: {
    schema: {
      type: 'object',
      properties: {
        publication: { type: 'string', title: 'Publication' },
        page: { type: 'string', title: 'Page' },
        anchor: { type: 'string', title: 'Anchor' },
        url: { type: 'string', title: 'URL' },
      },
    },
  },

  /**
   * Ein Datum in der Spielwelt (REQ-024). Zwei Felder, weil das eine sortiert
   * und das andere gelesen wird: „Mirtul 12, 1492 DR" lässt sich nicht
   * vergleichen, und `14920512` liest niemand vor.
   */
  /**
   * Wann etwas in der Welt steht. `sort` ordnet, `display` wird gelesen.
   *
   * Eine **Spanne**, nicht ein Punkt: eine Ära dauert, ein Kataklysmus hat
   * ein Ende, ein Meilenstein fällt auf einen Tag. Bliebe es bei einem
   * Datum, wäre die Weltgeschichte eine Liste von Augenblicken — und für
   * „das Dritte Zeitalter" müsste sich jemand etwas ausdenken.
   */
  Time: {
    schema: {
      type: 'object',
      properties: {
        sort: { type: 'number', title: 'Sortable value' },
        display: { type: 'string', format: 'date', title: 'Date' },
        untilSort: { type: 'number', title: 'Sortable value of the end' },
        until: { type: 'string', format: 'date', title: 'Until' },
        calendar: { type: 'string', title: 'Calendar' },
        duration: { type: 'string', title: 'Duration' },
      },
    },
  },

  /**
   * Karten (REQ-130). Das Gitter steht in Bildpunkten, nicht in Feldern: eine
   * Karte wird fotografiert oder gezeichnet, und was darauf ein Feld ist,
   * misst man am Bild. `scale` sagt, was ein Feld in der Welt bedeutet —
   * ohne das ist ein Gitter Dekoration.
   */
  MapInfo: {
    schema: {
      type: 'object',
      properties: {
        /* Das Bild der Karte ist `Image.image` und steht nicht noch einmal
           hier: eine Karte *hat* ein Bild wie jeder andere Artikel, und
           genau dieses Bild ist ihr Hintergrund. Zwei Felder dafür hiessen,
           dass eines gefüllt wird und der Zeichner das andere liest. */
        /* **Zeichenebenen** (REQ-130). Nicht zu verwechseln mit den
           Inhaltsebenen (`Layer`, der Stapel): das hier sind Bilder
           übereinander auf *einer* Karte — Gelände, Beschriftung, Ruinen,
           Schnee —, und nur die Spielleitung entscheidet, welche liegen.
           Sie heissen im Schema `sheets` (Kartenblätter), damit das Wort
           „Ebene" für die Inhaltsebenen frei bleibt; in der Kartenleiste
           steht „Layers", weil dort nichts zu verwechseln ist.

           `Image.image` bleibt das unterste Blatt: es ist die Karte selbst,
           und an ihm hängt ihre natürliche Grösse. Was in `sheets` steht,
           liegt darüber. */
        sheets: { type: 'array', title: 'Drawing layers', items: { type: 'object' } },
        /* Was am untersten Blatt einstellbar ist, steht an der Karte — es
           hat keinen eigenen Eintrag in `sheets`, weil es die Karte *ist*. */
        baseHidden: { type: 'boolean', title: 'Hide the base image' },
        baseGmOnly: { type: 'boolean', title: 'Base image is GM only' },
        kind: {
          type: 'string',
          title: 'Map kind',
          enum: ['world', 'region', 'settlement', 'district', 'building', 'battle'],
          default: 'region',
        },
        gridShape: {
          type: 'string',
          title: 'Grid',
          enum: ['none', 'square', 'hex'],
          default: 'none',
        },
        gridSize: { type: 'number', title: 'Grid size in px', default: 70 },
        gridOffsetX: { type: 'number', title: 'Grid offset X', default: 0 },
        gridOffsetY: { type: 'number', title: 'Grid offset Y', default: 0 },
        /* Eine Karte ist metrisch gemessen, auch wenn die Regeln in Fuss
           rechnen: das Raster steht in Metern da, und wer „1,5" schreibt,
           meint Meter. */
        scale: { type: 'string', format: 'measure', unit: 'm', title: 'One square is', default: '1,5 m' },
        // Nebel und Licht (REQ-139, 140). Aufgedecktes wird gespeichert, weil
        // es bleibt; Beleuchtetes nie, weil es sich mit jedem Zug ändert.
        lighting: {
          type: 'string',
          title: 'Lighting',
          enum: ['bright', 'dim', 'dark'],
          default: 'bright',
        },
        fog: { type: 'boolean', title: 'Fog of war', default: false },
        reveal: { type: 'array', title: 'Uncovered areas', items: { type: 'object' } },
        /* Sperren, nicht nur Sichtblocker: eine Wand hält Blick und Schritt,
           ein Fenster nur den Schritt, ein Abgrund auch nur den Schritt, und
           eine Tür hält beides, solange sie zu ist. Was welche Sorte ist,
           steht an der Sperre (`kind`) — eine zweite Liste je Sorte hiesse,
           vier Listen zu pflegen, die dasselbe meinen. */
        walls: { type: 'array', title: 'Walls, doors, windows, chasms', items: { type: 'object' } },
        // Kacheln (REQ-138) für Scans, die als ein Stück niemand lädt.
        tiles: { type: 'string', title: 'Tile pattern ({x}, {y})' },
        tileCols: { type: 'number', title: 'Tile columns' },
        tileRows: { type: 'number', title: 'Tile rows' },
        tileSize: { type: 'number', title: 'Tile size in px', default: 256 },
      },
    },
  },

  /**
   * Was sich am Tisch ändert (REQ-051, 063). Getrennt vom Statblock,
   * weil das zwei verschiedene Sorten Zahl sind: die Rüstungsklasse ändert
   * sich einmal pro Ausrüstungswechsel, die Trefferpunkte zwanzigmal pro
   * Kampf. In einer Karte lägen sie im Weg — jede Änderung schriebe die
   * andere mit, und die Wissensgruppen könnten sie nicht trennen.
   */
  Vitals: {
    schema: {
      type: 'object',
      properties: {
        hp: { type: 'number', title: 'Hit points now' },
        hpTemp: { type: 'number', title: 'Temporary HP' },
        hitDiceLeft: { type: 'number', title: 'Hit dice left' },
        deathSuccess: { type: 'number', title: 'Death saves passed', default: 0 },
        deathFail: { type: 'number', title: 'Death saves failed', default: 0 },
        inspiration: { type: 'boolean', title: 'Inspiration' },
        exhaustion: { type: 'number', title: 'Exhaustion', default: 0 },
        conditions: { type: 'array', title: 'Conditions', items: { type: 'string' } },
        nat1: { type: 'number', title: 'Natural 1s', default: 0 },
      },
    },
  },

  /**
   * Übung und Expertise als Listen, nicht als Feld je Fertigkeit. Eine
   * Kampagne mit anderen Fertigkeiten ist damit eine andere Einstellung und
   * kein Schemawechsel — die Liste der Fertigkeiten steht in den
   * Kampagneneinstellungen, wo sie jemand ändern kann.
   */
  /**
   * **Worin jemand geübt ist** — eine Gruppe und nicht sechs Felder an
   * sechs Stellen: Fertigkeiten, Sprachen, Werkzeuge, Rüstungen, Waffen
   * und (Hausregel) Wissensgebiete.
   *
   * Sie hiess `Skills` und trug nur die Hälfte davon. Die andere Hälfte
   * stand als freier Text am Statblock (`languages`, `saves`, `skills`) —
   * dieselbe Sache zweimal, einmal als Liste und einmal als Satz, und
   * gefüllt war fast immer nur eine davon.
   *
   * Der **Übungsbonus** steht hier bewusst nicht: an einem Statblock ist
   * er gegeben (`Statblock.prof`), an einer Figur gerechnet
   * (`CharacterInfo.proficiency` aus der Stufe). Ein gerechneter Wert sieht
   * nur seine Nachbarn in derselben Karte (D8) — ein drittes Feld hier
   * könnte nichts rechnen und wäre die Zahl, die als erste veraltet.
   */
  Proficiencies: {
    schema: {
      type: 'object',
      properties: {
        /**
         * **Ein Feld für alle Übungen**, und es zieht seine Werte aus sechs
         * Listen: Fertigkeiten, Werkzeuge, Sprachen, Waffengruppen,
         * Rüstungsgruppen und (Hausregel) Wissensgebiete.
         *
         * Vorher stand je Sorte ein Feld — `proficient`, `languages`,
         * `tools`, `armor`, `weapons`, `knowledge` —, also dieselbe Frage
         * sechsmal, und die siebte Sorte hätte ein siebtes Feld gebraucht.
         * Woher ein Wert kommt, sagt die Liste, in der er steht
         * (`enumSource`); der Bogen gruppiert danach, ohne dass es im Feld
         * stünde.
         */
        proficient: {
          type: 'array',
          title: 'Proficient in',
          items: { type: 'string' },
          enumRef: ['Skill', 'Tool', 'Language', 'WeaponTraining', 'ArmorTraining', 'KnowledgeField'],
        },
        /* Dieselben Listen: Expertise ist eine Übung, die doppelt zählt. */
        expertise: {
          type: 'array',
          title: 'Expertise in',
          items: { type: 'string' },
          enumRef: ['Skill', 'Tool', 'Language', 'WeaponTraining', 'ArmorTraining', 'KnowledgeField'],
        },
        /* Rettungswürfe sind Attribute und sonst nichts — eine Liste aus
           **einer** Zeile, und genau das ist der Unterschied zur Probe am
           Rezept, die genau eines nennt. */
        saves: {
          type: 'array',
          title: 'Saving throws',
          items: { type: 'string' },
          enumRef: 'Ability',
        },
      },
    },
  },

  /**
   * Rezepte (REQ-184). Die Eingaben stehen nicht hier, sondern an
   * `needs`-Kanten: ein Material ist ein Artikel, und wie viel davon ein
   * Rezept braucht, gehört an die Verbindung zwischen beiden. Eine Liste
   * von Namen im Feld wäre eine zweite Wahrheit neben dem Materialartikel —
   * und die erste, die veraltet, wenn jemand den Namen ändert.
   */
  RecipeInfo: {
    schema: {
      type: 'object',
      properties: {
        trade: { type: 'string', title: 'Trade' },
        tool: { type: 'string', title: 'Tool needed' },
        /* Dieselbe Aufzählungszeile wie an der Fertigkeit. `titles` gibt
           ihr hier den Namen „Check", ohne dass es die Liste zweimal
           gäbe — eine Beschriftung ist kein zweites Feld. */
        ability: {
          type: 'string',
          title: 'Check',
          enumRef: 'Ability',
          default: 'int',
        },
        dc: { type: 'number', title: 'DC', default: 12 },
        time: { type: 'string', title: 'Time' },
        // Eine Zahl neben dem Text: „2 Stunden“ liest sich schön und rechnet
        // nicht. Ein Gang unter einem Tag ist eine Sitzung (REQ-184).
        days: { type: 'number', title: 'Days of work', default: 1 },
        yieldCount: { type: 'number', title: 'Yield', default: 1 },
        /* Was beim Misslingen passiert, gehört ins Rezept: sonst entscheidet
           es jedes Mal die Laune am Tisch, und das merkt sich niemand. */
        onFailure: {
          type: 'string',
          title: 'On a failure',
          enum: ['materialsLost', 'halfLost', 'nothingLost'],
          default: 'halfLost',
        },
      },
    },
  },

  /**
   * Boards (REQ-111, 157 bis 166). Eine Leinwand, auf der Artikel frei
   * liegen.
   *
   * `rules` ist die Darstellungsauflösung (REQ-161): je Schnittstelle eine
   * Ansicht, die das Board vorschlägt. Die Platzierung darf sie überstimmen —
   * *dieser* Statblock hier soll voll stehen, alle anderen kurz. Priorität
   * also: Platzierung, dann Board-Regel, dann die erste Ansicht.
   *
   * `shapes` und `anchors` liegen als Felder am Board und nicht als Kanten,
   * und das ist kein Rückfall: ein Rechteck zeigt auf nichts. Ein Token zeigt
   * auf einen Artikel, deshalb ist es eine Kante; eine Linie, die zwei
   * Kästen umfasst, ist Zeichnung und gehört dem Board.
   */
  BoardInfo: {
    schema: {
      type: 'object',
      properties: {
        width: { type: 'number', title: 'Width in px', default: 2400 },
        height: { type: 'number', title: 'Height in px', default: 1500 },
        snap: { type: 'number', title: 'Snap to px', default: 10 },
        background: { type: 'string', format: 'asset', title: 'Background' },
        rules: { type: 'object', title: 'View per interface' },
        shapes: { type: 'array', title: 'Shapes', items: { type: 'object' } },
        anchors: { type: 'array', title: 'Anchors', items: { type: 'object' } },
      },
    },
  },

  /**
   * Begegnungen (REQ-085, 115). `round` und `turn` sind Spielzustand und
   * liegen vorläufig hier — richtig wären Sitzungszustände mit einem
   * Echtzeitkanal (REQ-116). Das ist die Stelle, die dann umzieht; sie steht
   * absichtlich beieinander, damit der Umzug eine Karte betrifft und nicht
   * ein Dutzend Felder.
   */
  EncounterInfo: {
    schema: {
      type: 'object',
      properties: {
        /* Die Schwierigkeit stand hier als Aufzählung von fünf Wörtern und
           an der Szene als freier Text. Sie ist jetzt eine Stufe von 1 bis
           20 und steht einmal, im Typ `Difficulty`. */
        xpBudget: { type: 'number', title: 'XP budget' },
        /* Wo der Kampf steht, während er läuft — die Initiative schreibt
           es. Es hiess `state`, wie drei weitere Felder in drei weiteren
           Typen; `phase` sagt, was es ist, und lässt `Status` den
           Vorbereitungsstand. */
        phase: {
          type: 'string',
          title: 'Phase',
          enum: ['planned', 'running', 'done', 'skipped'],
          default: 'planned',
        },
        round: { type: 'number', title: 'Round', default: 0 },
        turn: { type: 'number', title: 'Turn', default: 0 },
        surprise: { type: 'string', title: 'Surprise' },
      },
    },
  },

  /**
   * Wer diese Figur spielt (REQ-033, 035, 036). Die Zuordnung steht in den
   * Daten und nicht in der Sitzung, damit die Spielleitung sie ändern kann,
   * ohne dass jemand sich neu anmeldet.
   *
   * Gespeichert wird die undurchsichtige Nutzer-Id, nie ein Name: Namen
   * unterscheiden sich je Betrachter, frieren beim Schreiben ein und
   * überleben Menschen.
   */
  /**
   * Eine **Gruppe von Menschen**, nicht von Figuren (REQ-040).
   *
   * Wissen liess sich schon einer `Party` zuteilen, und jedes Mitglied
   * bekam es über `memberOfParty`. Das deckt die Abenteuergruppe ab und
   * sonst nichts: „die Spieler dieser Kampagne" ist etwas anderes. Wer
   * keine Figur hat, wer gerade eine neue baut, wer als Gast zusieht —
   * keiner davon steht in einer Party, und alle sollen dasselbe erfahren.
   *
   * Deshalb eine eigene Art, die **kein** Figurengefüge ist. Ein Konto
   * zeigt auf sie wie auf eine Figur, und `knownBy` darf sie nennen: ein
   * dritter Halter neben Figur und Party, im selben Verfahren.
   */
  GroupInfo: {
    schema: {
      type: 'object',
      properties: {
        /* `purpose` fiel weg: wozu eine Gruppe da ist, steht in ihrer
           Beschreibung — und `kind` sagt, was für eine sie ist. */
        /* Wozu sie da ist — damit eine Liste von Gruppen lesbar bleibt,
           wenn es fünf davon gibt. Aufzählungswerte sind Kampagneninhalt
           und bleiben deutsch, wo sie welche sind; diese hier sind es
           nicht, sie beschreiben das Werkzeug. */
        kind: {
          type: 'string',
          title: 'Kind',
          enum: ['players', 'table', 'guests', 'crew'],
          default: 'players',
        },
      },
    },
  },

  Access: {
    schema: {
      type: 'object',
      properties: {
        userIds: { type: 'array', title: 'User ids', items: { type: 'string' } },
        /* „Account role" und nicht „Role": eine Kreatur trägt schon ein
           `role` — das ist ihre Rolle in der Welt (Händler), nicht die des
           Kontos am Tisch. Zwei Felder namens „Role" untereinander sind
           die Sorte Liste, bei der man das falsche erwischt. */
        role: { type: 'string', title: 'Account role', enum: ['player', 'co-gm', 'spectator'], default: 'player' },
        /* Eine Notiz zum Zugang ist eine Notiz. `Notes.note` gibt es, und
           es kann mehrere und lange — ein zweites Feld daneben heisst nur,
           dass man beide durchsuchen muss. */
      },
    },
  },

  /**
   * Was gerade läuft (REQ-116). Es liegt an der Sitzung und im Speicher,
   * nicht im Echtzeitkanal: wer zehn Minuten später dazukommt, muss es auch
   * sehen, und der Kanal wiederholt nichts. Der Kanal trägt nur, was ein
   * Augenblick ist — ein Wurf, ein Zeigen auf die Karte.
   */
  SessionState: {
    schema: {
      type: 'object',
      properties: {
        /* Was hinterher darüber steht. Vor der Sitzung leer, danach der
           Text, den die Runde liest. */
        recap: { type: 'string', format: 'long', many: true, title: 'Recap' },
        /* **Ein Verweisfeld nennt seinen Zieltyp** (`target.interfaces`,
           Untertypen eingeschlossen). Ohne das hielt „Scene in play" die
           Id von irgendetwas — und am Tisch fällt das erst auf, wenn der
           Beamer eine Rüstung zeigt. */
        activeScene: {
          type: 'string', format: 'link', title: 'Scene in play',
          target: { interfaces: ['Scene'] },
        },
        activeEncounter: {
          type: 'string', format: 'link', title: 'Fight in play',
          target: { interfaces: ['Encounter'] },
        },
        activeMap: {
          type: 'string', format: 'link', title: 'Map on the table',
          target: { interfaces: ['Map'] },
        },
        nowPlaying: { type: 'string', title: 'Now playing' },
        partyNote: { type: 'string', format: 'long', title: 'Note for the table' },
        /* Wer schreiben darf (REQ-117). `gm` ist die Vorgabe; `table` heisst,
           dass auch die Spieler die Notiz führen dürfen. Feiner wird es
           erst, wenn jemand den Bedarf zeigt. */
        stewardship: {
          type: 'string',
          title: 'Who may write',
          enum: ['gm', 'table'],
          default: 'gm',
        },
      },
    },
  },

  /**
   * Tabellen (REQ-085, 125, 172, 186). Einträge, die auf einen Artikel
   * zeigen, sind Kanten (`entry`); Einträge, die auf nichts zeigen — ein
   * Name, ein Satz, ein Wetter — stehen in `rows`. Dieselbe Trennlinie wie
   * bei den Formen auf dem Board und den Aufgaben im Auftrag.
   *
   * Gewichte statt Bereiche: „1–3, 4–5, 6" von Hand zu führen bricht, sobald
   * jemand eine Zeile einfügt. Die Bereiche rechnet die Seite aus, der
   * Würfel steht daneben und heisst, womit gewürfelt wird, wenn jemand am
   * Tisch selbst würfeln will.
   */
  TableInfo: {
    schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          title: 'Kind',
          enum: ['loot', 'encounter', 'name', 'shop', 'event', 'generic'],
          default: 'generic',
        },
        die: { type: 'string', title: 'Die', default: '1d100' },
        rows: { type: 'array', title: 'Plain entries', items: { type: 'object' } },
        /* Eine Notiz zur Tabelle ist eine Notiz — `Notes.note` kann mehrere
           und lange. Zwei Felder namens „Note" untereinander hiesse, beide
           durchsuchen zu müssen. */
      },
    },
  },

  /**
   * Was an einem Artikel noch zu tun ist (REQ-189, 190). Einträge, die auf
   * nichts zeigen — dieselbe Regel wie bei den Aufgaben im Auftrag. Der
   * Unterschied zum Auftrag ist der Adressat: eine Quest-Aufgabe ist für die
   * Gruppe, ein Todo für die Spielleitung.
   *
   * `at` ist die Zeit der Notiz, nicht der Erledigung: „das habe ich mir
   * mitten in der Sitzung notiert" ist die Angabe, die hilft.
   */
  Todos: {
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', title: 'Items', items: { type: 'object' } },
      },
    },
  },

  /**
   * Erkundungsstand eines Ortes (REQ-169). Drei Stufen, nicht zwei:
   * „verborgen" heisst, die Gruppe weiss nicht einmal, dass es ihn gibt;
   * „entdeckt" heisst, sie weiss davon und war nicht dort; „erkundet"
   * heisst, sie war da. Zwei Stufen könnten „wir haben davon gehört" nicht
   * abbilden, und genau daraus entsteht das Reisen.
   *
   * Das ist nicht dasselbe wie Sichtbarkeit und nicht dasselbe wie Wissen:
   * ein Ort kann bekannt und trotzdem unerkundet sein.
   */
  Explored: {
    schema: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          title: 'State',
          enum: ['hidden', 'discovered', 'explored'],
          default: 'hidden',
        },
        /* `since` fiel weg — seit wann es den Ort gibt, ist ein Datum,
           und `Time` führt Daten. */
        /* Was beim Ankommen vorgelesen wird — an den Ort, nicht an die
           Kante: man kommt auf mehreren Wegen an und sieht dasselbe. */
        arrival: { type: 'string', format: 'long', title: 'On arrival' },
      },
    },
  },

  /**
   * Wo die Gruppe gerade ist und was die Reise bisher gekostet hat
   * (REQ-170). Die Zehrung zählt Knoten, nicht Stunden: ein Punktreise-Zug
   * ist die Einheit, in der am Tisch gerechnet wird.
   */
  TravelInfo: {
    schema: {
      type: 'object',
      properties: {
        /* Der Knoten, auf dem die Gruppe steht — ein Ort, wie jeder
           Punktreise-Knoten (`partOf` unter dem Ort, der die Reise
           trägt). */
        at: {
          type: 'string', format: 'link', title: 'Currently at',
          target: { interfaces: ['Place'] },
        },
        day: { type: 'number', title: 'Day', default: 1 },
        watch: { type: 'number', title: 'Watch', default: 1 },
        sinceRation: { type: 'number', title: 'Nodes since rations', default: 0 },
        sinceLight: { type: 'number', title: 'Nodes since light', default: 0 },
        /* Was jede Figur an diesem Knoten tut (REQ-171): Figur → Handlung.
           Wird beim Weiterziehen geleert, weil eine Handlung zum Knoten
           gehört und nicht zur Figur. */
        actions: { type: 'object', title: 'Actions at this node' },
      },
    },
  },

  /**
   * Eine Ebene (REQ-004). Sie ist ein Artikel, kein Registereintrag: sie
   * trägt einen Namen, eine Beschreibung, eine Quellenangabe und — vor
   * allem — Kanten. „Welche Ebene bringt diesen Artikel mit?" ist damit ein
   * Rückbezug wie jeder andere.
   *
   * `order` ist die Spezifität: höher schlägt niedriger, wenn zwei Ebenen
   * dasselbe anfassen. Das Grundregelwerk steht unten, die Kampagne oben.
   */
  LayerInfo: {
    schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          title: 'Kind',
          enum: ['system', 'expansion', 'world', 'pack', 'campaign', 'overrides'],
          default: 'pack',
        },
        order: { type: 'number', title: 'Specificity', default: 10 },
        version: { type: 'string', title: 'Version' },
      },
    },
  },

} satisfies Record<string, FieldGroup>;
