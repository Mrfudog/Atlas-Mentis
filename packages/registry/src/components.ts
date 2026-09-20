import type { ComponentDef } from '@nw/model';

/**
 * `component_def` rows. One card per type per entity, absent when unused.
 * `engine: null` means plain data; a named engine owns the meaning (D1).
 */
export const components: Record<string, ComponentDef> = {
  Name: {
    name: 'Name',
    label: 'Name',
    engine: null,
    schema: { type: 'object', required: ['text'], properties: { text: { type: 'string', title: 'Name' } } },
  },

  Identity: {
    name: 'Identity',
    label: 'Identity',
    engine: 'Resolution',
    schema: {
      type: 'object',
      required: ['key'],
      properties: {
        key: { type: 'string', title: 'Key' },
        aliases: { type: 'array', title: 'Aliases', items: { type: 'string' } },
      },
    },
  },

  Description: {
    name: 'Description',
    label: 'Description',
    engine: null,
    schema: { type: 'object', properties: { raw: { type: 'string', format: 'long', title: 'Text' } } },
  },

  Status: {
    name: 'Status',
    label: 'Status',
    engine: 'Status',
    schema: {
      type: 'object',
      properties: {
        /* `default` gilt beim Anlegen, nicht rückwirkend. Bis hierher stand
           „idea" fest im Code, der Artikel anlegt — also genau die Sorte
           Wissen, die eine Registerzeile sein soll. */
        value: {
          type: 'string',
          title: 'Status',
          enum: ['idea', 'planned', 'used', 'discarded'],
          default: 'idea',
        },
      },
    },
  },

  /**
   * Stored in full from day one; only `audience` gm/campaign is evaluated for
   * now. The remaining fields exist so player access is not a schema change.
   */
  Visibility: {
    name: 'Visibility',
    label: 'Visibility',
    engine: 'Access',
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

  /** REQ-019: an import keeps its original form beside the structured result. */
  RawContent: {
    name: 'RawContent',
    label: 'Raw content',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        raw: { type: 'string', format: 'long', title: 'Original' },
        format: { type: 'string', title: 'Format', enum: ['obsidian', 'markdown', 'json', 'plain'] },
        importedAt: { type: 'string', title: 'Imported at' },
      },
    },
  },

  Image: {
    name: 'Image',
    label: 'Image',
    engine: 'Asset',
    schema: {
      type: 'object',
      properties: {
        /* `ref` zeigt auf ein Asset, eine Ablage-Id oder eine fremde Adresse
           und wird vom Auflöser gelesen. `url` bleibt daneben stehen: die
           vorhandenen Artikel tragen es, und ein Zwangsumzug brächte nichts,
           was ein Blick auf beide Felder nicht auch bringt. */
        ref: { type: 'string', format: 'asset', title: 'Image' },
        url: { type: 'string', title: 'Source (legacy)' },
        caption: { type: 'string', title: 'Caption' },
        alt: { type: 'string', title: 'Alt text' },
      },
    },
  },

  /** Entity-level defaults for {VAR} placeholders (REQ-174). */
  Vars: {
    name: 'Vars',
    label: 'Variables',
    engine: null,
    schema: { type: 'object', properties: { bindings: { type: 'object', title: 'Bindings' } } },
  },

  CreatureInfo: {
    name: 'CreatureInfo',
    label: 'Creature',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        species: { type: 'string', title: 'Species' },
        role: { type: 'string', title: 'Role' },
        attitude: {
          type: 'string',
          title: 'Attitude',
          enum: ['freundlich', 'neutral', 'feindlich', 'unbekannt'],
        },
      },
    },
  },

  StatblockInfo: {
    name: 'StatblockInfo',
    label: 'Stats',
    engine: 'Calculation',
    schema: {
      type: 'object',
      required: ['system'],
      properties: {
        system: { type: 'string', title: 'System' },
        size: {
          type: 'string',
          title: 'Size',
          enum: ['winzig', 'klein', 'mittel', 'gross', 'riesig', 'gewaltig'],
        },
        kind: { type: 'string', title: 'Kind' },
        alignment: { type: 'string', title: 'Alignment' },
        ac: { type: 'number', title: 'Armour class' },
        acNote: { type: 'string', title: 'AC source' },
        hp: { type: 'number', title: 'Hit points' },
        hpFormula: { type: 'string', title: 'Hit dice' },
        speed: { type: 'string', title: 'Speed' },
        cr: { type: 'string', title: 'Challenge rating' },
        prof: { type: 'number', title: 'Proficiency bonus' },
        combatRole: { type: 'string', title: 'Combat role' },
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
        senses: { type: 'string', title: 'Senses' },
        languages: { type: 'string', title: 'Languages' },
        saves: { type: 'string', title: 'Saving throws' },
        skills: { type: 'string', title: 'Skills' },
        resistances: { type: 'string', title: 'Resistances' },
        vulnerabilities: { type: 'string', title: 'Vulnerabilities' },
        immunities: { type: 'string', title: 'Immunities' },
      },
    },
  },

  RuleInfo: {
    name: 'RuleInfo',
    label: 'Rule',
    engine: null,
    schema: {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: {
          type: 'string',
          title: 'Rule kind',
          enum: ['action', 'bonus', 'reaction', 'feature', 'trait', 'condition', 'legendary', 'lair'],
        },
        uses: { type: 'string', title: 'Uses' },
        recharge: { type: 'string', title: 'Recharge' },
      },
    },
  },

  LocationInfo: {
    name: 'LocationInfo',
    label: 'Place',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          title: 'Place type',
          enum: ['Reich', 'Stadt', 'Distrikt', 'Gasse', 'Gebäude', 'Raum', 'Wildnis'],
        },
        environment: { type: 'string', title: 'Environment' },
        settlementType: { type: 'string', title: 'Settlement type' },
      },
    },
  },

  FactionInfo: {
    name: 'FactionInfo',
    label: 'Faction',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', title: 'Kind' },
        color: { type: 'string', title: 'Colour' },
      },
    },
  },

  // ---------------------------------------------------------------- items

  ItemInfo: {
    name: 'ItemInfo',
    label: 'Item',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        itemType: { type: 'string', title: 'Item type' },
        // Two different scales, deliberately kept apart: `rarity` is the 5e
        // magic-item rarity, `availability` is how hard the thing is to buy.
        rarity: { type: 'string', title: 'Rarity',
          enum: ['gewöhnlich', 'ungewöhnlich', 'selten', 'sehr selten', 'legendär', 'artefakt'] },
        availability: { type: 'string', title: 'Availability' },
        copperPrice: { type: 'number', title: 'Price in copper' },
        stackSize: { type: 'number', title: 'Stack size' },
      },
    },
  },

  /**
   * The grid-inventory shape. Its dimensions are derived, never stored.
   * `colCount` / `rowCount` / `cellCount` are Calculation-engine function names
   * (see `calc.ts`), not field names — they stay as the engine spells them.
   */
  Footprint: {
    name: 'Footprint',
    label: 'Footprint',
    engine: 'Calculation',
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
    name: 'WeaponInfo',
    label: 'Weapon',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        damage: { type: 'string', title: 'Damage' },
        damageType: { type: 'string', title: 'Damage type' },
        range: { type: 'string', title: 'Range' },
        Properties: { type: 'string', title: 'Properties' },
      },
    },
  },

  ArmorInfo: {
    name: 'ArmorInfo',
    label: 'Armor',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        ac: { type: 'number', title: 'Armour class' },
        armorType: { type: 'string', title: 'Armour type' },
      },
    },
  },

  MaterialInfo: {
    name: 'MaterialInfo',
    label: 'Material',
    engine: null,
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
    name: 'StoryInfo',
    label: 'Story',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          title: 'Kind',
          enum: ['campaign', 'arc', 'chapter', 'session', 'scene'],
        },
        played: { type: 'string', title: 'Played on' },
        /* Where the telling stands, which is not where the article stands:
           `Status` tracks the writing, `state` tracks the play. */
        state: {
          type: 'string',
          title: 'State',
          enum: ['planned', 'running', 'played', 'dropped'],
          default: 'planned',
        },
        summary: { type: 'string', format: 'long', title: 'Recap' },
      },
    },
  },

  SceneInfo: {
    name: 'SceneInfo',
    label: 'Scene',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          title: 'Mode',
          enum: ['roleplay', 'encounter', 'exploration', 'downtime'],
          default: 'roleplay',
        },
        difficulty: { type: 'string', title: 'Difficulty' },
        readaloud: { type: 'string', format: 'long', title: 'Read aloud' },
      },
    },
  },

  QuestInfo: {
    name: 'QuestInfo',
    label: 'Quest',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          title: 'State',
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
    name: 'CharacterInfo',
    label: 'Character',
    engine: null,
    schema: {
      type: 'object',
      properties: {
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
    name: 'PartyInfo',
    label: 'Party',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        level: { type: 'number', title: 'Party level' },
        motto: { type: 'string', title: 'Motto' },
      },
    },
  },

  InventoryInfo: {
    name: 'InventoryInfo',
    label: 'Inventory',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        capacity: { type: 'number', title: 'Slots' },
        copper: { type: 'number', title: 'Purse in copper' },
      },
    },
  },

  /**
   * Wissen (A6): ein Bündel von Feldern und Textblöcken eines Artikels, das
   * als Ganzes zugeteilt wird. Die Karte sagt nur, *was* das Bündel umfasst —
   * *wer* es kennt, steht an den `knownBy`-Kanten, weil ein Empfänger ein
   * Peg ist und eine Liste von IDs in einer Karte kein Rückbezug wäre.
   */
  Info: {
    name: 'Info',
    label: 'Information',
    engine: 'Knowledge',
    schema: {
      type: 'object',
      properties: {
        /* Feldverweise in der Schreibweise der Ansichten: `Comp` nimmt die
           ganze Komponente, `Comp.field` genau ein Feld. */
        fields: { type: 'array', title: 'Fields', items: { type: 'string' } },
        blocks: { type: 'array', title: 'Text blocks', items: { type: 'string' } },
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

  /** Ein benannter Wissensstand, dem Figuren angehören: „Gildenwissen". */
  KnowledgeInfo: {
    name: 'KnowledgeInfo',
    label: 'Knowledge level',
    engine: 'Knowledge',
    schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', title: 'Scope', enum: ['common', 'group', 'personal'], default: 'group' },
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
    name: 'AssetInfo',
    label: 'Asset',
    engine: 'Asset',
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
  SourceRef: {
    name: 'SourceRef',
    label: 'Source',
    engine: null,
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
  WorldDate: {
    name: 'WorldDate',
    label: 'World date',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        sort: { type: 'number', title: 'Sortable value' },
        display: { type: 'string', format: 'date', title: 'Date' },
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
    name: 'MapInfo',
    label: 'Map',
    engine: 'Map',
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'asset', title: 'Image' },
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
        scale: { type: 'string', title: 'One square is', default: '1,5 m' },
      },
    },
  },

  /**
   * Was sich am Tisch ändert (REQ-051, 063). Getrennt von `StatblockInfo`,
   * weil das zwei verschiedene Sorten Zahl sind: die Rüstungsklasse ändert
   * sich einmal pro Ausrüstungswechsel, die Trefferpunkte zwanzigmal pro
   * Kampf. In einer Karte lägen sie im Weg — jede Änderung schriebe die
   * andere mit, und die Wissensgruppen könnten sie nicht trennen.
   */
  Vitals: {
    name: 'Vitals',
    label: 'Vitals',
    engine: 'Play',
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
  Skills: {
    name: 'Skills',
    label: 'Skills',
    engine: 'Play',
    schema: {
      type: 'object',
      properties: {
        proficient: { type: 'array', title: 'Proficient in', items: { type: 'string' } },
        expertise: { type: 'array', title: 'Expertise in', items: { type: 'string' } },
        saves: { type: 'array', title: 'Saving throws', items: { type: 'string' } },
        languages: { type: 'array', title: 'Languages', items: { type: 'string' } },
        tools: { type: 'array', title: 'Tool proficiencies', items: { type: 'string' } },
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
    name: 'RecipeInfo',
    label: 'Recipe',
    engine: 'Craft',
    schema: {
      type: 'object',
      properties: {
        trade: { type: 'string', title: 'Trade' },
        tool: { type: 'string', title: 'Tool needed' },
        ability: {
          type: 'string',
          title: 'Check',
          enum: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
          default: 'int',
        },
        dc: { type: 'number', title: 'DC', default: 12 },
        time: { type: 'string', title: 'Time' },
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
    name: 'BoardInfo',
    label: 'Board',
    engine: 'Board',
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
    name: 'EncounterInfo',
    label: 'Encounter',
    engine: 'Play',
    schema: {
      type: 'object',
      properties: {
        difficulty: {
          type: 'string',
          title: 'Difficulty',
          enum: ['trivial', 'easy', 'medium', 'hard', 'deadly'],
          default: 'medium',
        },
        xpBudget: { type: 'number', title: 'XP budget' },
        state: {
          type: 'string',
          title: 'State',
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
  Access: {
    name: 'Access',
    label: 'Access',
    engine: 'Access',
    schema: {
      type: 'object',
      properties: {
        userIds: { type: 'array', title: 'User ids', items: { type: 'string' } },
        role: {
          type: 'string',
          title: 'Role',
          enum: ['player', 'co-gm', 'spectator'],
          default: 'player',
        },
        note: { type: 'string', title: 'Note' },
      },
    },
  },
};
