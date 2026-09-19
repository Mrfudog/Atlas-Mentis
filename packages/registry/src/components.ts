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
    label: 'Identität',
    engine: 'Resolution',
    schema: {
      type: 'object',
      required: ['key'],
      properties: {
        key: { type: 'string', title: 'Schlüssel' },
        aliases: { type: 'array', title: 'Aliasse', items: { type: 'string' } },
      },
    },
  },

  Description: {
    name: 'Description',
    label: 'Beschreibung',
    engine: null,
    schema: { type: 'object', properties: { raw: { type: 'string', format: 'long', title: 'Text' } } },
  },

  Status: {
    name: 'Status',
    label: 'Stand',
    engine: 'Status',
    schema: {
      type: 'object',
      properties: {
        value: { type: 'string', title: 'Stand', enum: ['idea', 'planned', 'used', 'discarded'] },
      },
    },
  },

  /**
   * Stored in full from day one; only `audience` gm/campaign is evaluated for
   * now. The remaining fields exist so player access is not a schema change.
   */
  Visibility: {
    name: 'Visibility',
    label: 'Sichtbarkeit',
    engine: 'Access',
    schema: {
      type: 'object',
      properties: {
        audience: { type: 'string', title: 'Publikum', enum: ['gm', 'campaign', 'players', 'public'] },
        scope: { type: 'string', title: 'Geltungsbereich' },
        revealedTo: { type: 'array', title: 'Freigegeben an', items: { type: 'string' } },
        hiddenFrom: { type: 'array', title: 'Verborgen vor', items: { type: 'string' } },
        sharedUsers: { type: 'array', title: 'Geteilt mit', items: { type: 'string' } },
        inherit: { type: 'boolean', title: 'An Kinder vererben', default: true },
      },
    },
  },

  /** REQ-019: an import keeps its original form beside the structured result. */
  RawContent: {
    name: 'RawContent',
    label: 'Rohfassung',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        raw: { type: 'string', format: 'long', title: 'Original' },
        format: { type: 'string', title: 'Format', enum: ['obsidian', 'markdown', 'json', 'plain'] },
        importedAt: { type: 'string', title: 'Importiert am' },
      },
    },
  },

  Bild: {
    name: 'Bild',
    label: 'Bild',
    engine: 'Asset',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', title: 'Bildquelle' },
        bu: { type: 'string', title: 'Bildunterschrift' },
      },
    },
  },

  /** Entity-level defaults for {VAR} placeholders (REQ-174). */
  Vars: {
    name: 'Vars',
    label: 'Variablen',
    engine: null,
    schema: { type: 'object', properties: { bindings: { type: 'object', title: 'Vorgaben' } } },
  },

  CreatureInfo: {
    name: 'CreatureInfo',
    label: 'Geschöpf',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        spezies: { type: 'string', title: 'Spezies' },
        rolle: { type: 'string', title: 'Rolle' },
        haltung: {
          type: 'string',
          title: 'Haltung',
          enum: ['freundlich', 'neutral', 'feindlich', 'unbekannt'],
        },
      },
    },
  },

  StatblockInfo: {
    name: 'StatblockInfo',
    label: 'Werte',
    engine: 'Calculation',
    schema: {
      type: 'object',
      required: ['system'],
      properties: {
        system: { type: 'string', title: 'System' },
        groesse: {
          type: 'string',
          title: 'Grösse',
          enum: ['winzig', 'klein', 'mittel', 'gross', 'riesig', 'gewaltig'],
        },
        art: { type: 'string', title: 'Art' },
        gesinnung: { type: 'string', title: 'Gesinnung' },
        ac: { type: 'number', title: 'Rüstungsklasse' },
        tp: { type: 'number', title: 'Trefferpunkte' },
        tpFormel: { type: 'string', title: 'TP-Formel' },
        tempo: { type: 'string', title: 'Tempo' },
        cr: { type: 'string', title: 'Herausforderungsgrad' },
        prof: { type: 'number', title: 'Übungsbonus' },
        kampfrolle: { type: 'string', title: 'Kampfrolle' },
        str: { type: 'number', title: 'STÄ' },
        strMod: { type: 'number', title: 'STÄ-Mod', derived: 'mod(str)', of: 'str', format: 'signed' },
        dex: { type: 'number', title: 'GES' },
        dexMod: { type: 'number', title: 'GES-Mod', derived: 'mod(dex)', of: 'dex', format: 'signed' },
        con: { type: 'number', title: 'KON' },
        conMod: { type: 'number', title: 'KON-Mod', derived: 'mod(con)', of: 'con', format: 'signed' },
        int: { type: 'number', title: 'INT' },
        intMod: { type: 'number', title: 'INT-Mod', derived: 'mod(int)', of: 'int', format: 'signed' },
        wis: { type: 'number', title: 'WEI' },
        wisMod: { type: 'number', title: 'WEI-Mod', derived: 'mod(wis)', of: 'wis', format: 'signed' },
        cha: { type: 'number', title: 'CHA' },
        chaMod: { type: 'number', title: 'CHA-Mod', derived: 'mod(cha)', of: 'cha', format: 'signed' },
        initiative: { type: 'number', title: 'Initiative', derived: 'mod(dex)', format: 'signed' },
        passivWahr: { type: 'number', title: 'Passive Wahrnehmung', derived: '10+mod(wis)' },
        sinne: { type: 'string', title: 'Sinne' },
        sprachen: { type: 'string', title: 'Sprachen' },
        resistenzen: { type: 'string', title: 'Resistenzen' },
        immunitaeten: { type: 'string', title: 'Immunitäten' },
      },
    },
  },

  RuleInfo: {
    name: 'RuleInfo',
    label: 'Regel',
    engine: null,
    schema: {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: {
          type: 'string',
          title: 'Regelart',
          enum: ['action', 'bonus', 'reaction', 'feature', 'trait', 'condition', 'legendary', 'lair'],
        },
        uses: { type: 'string', title: 'Einsätze' },
        recharge: { type: 'string', title: 'Aufladung' },
      },
    },
  },

  LocationInfo: {
    name: 'LocationInfo',
    label: 'Ort',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        art: {
          type: 'string',
          title: 'Ortsart',
          enum: ['Reich', 'Stadt', 'Distrikt', 'Gasse', 'Gebäude', 'Raum', 'Wildnis'],
        },
        umwelt: { type: 'string', title: 'Umgebung' },
      },
    },
  },

  FactionInfo: {
    name: 'FactionInfo',
    label: 'Fraktion',
    engine: null,
    schema: {
      type: 'object',
      properties: {
        art: { type: 'string', title: 'Fraktionsart' },
        farbe: { type: 'string', title: 'Farbe' },
      },
    },
  },
};
