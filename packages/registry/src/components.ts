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
        url: { type: 'string', title: 'Source' },
        caption: { type: 'string', title: 'Caption' },
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
};
