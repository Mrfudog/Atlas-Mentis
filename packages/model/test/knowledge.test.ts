import { describe, expect, it } from 'vitest';
import {
  bundlesWith,
  covers,
  factionRanks,
  rankIndex,
  informationsIn,
  informationsOf,
  knowledgeGroups,
  knowledgeHolders,
  knows,
  visibleFields,
} from '../src/knowledge.js';
import type { Entity, EntityId, Registry } from '../src/types.js';

const registry: Pick<Registry, 'interfaces'> = {
  interfaces: {
    Identity: { name: 'Identity', abstract: true },
    /* Ein Sack mit Einträgen: an jedem hängt eine Id, und an der die
       Freigabe. Das war einmal ein Block mit seinem Anker. */
    Secrets: {
      name: 'Secrets',
      abstract: true,
      schema: {
        type: 'object',
        properties: { secret: { type: 'string', format: 'long', many: true } },
      },
    },
    NPC: { name: 'NPC', extends: ['Identity'] },
    PlayerCharacter: { name: 'PlayerCharacter', extends: ['Identity'] },
    Party: { name: 'Party', extends: ['Identity'] },
    Faction: { name: 'Faction', extends: ['Identity'] },
    Knowledge: { name: 'Knowledge', extends: ['Identity'] },
    Information: { name: 'Information', extends: ['Identity'] },
  },
};

function entity(id: string, name: string, extra: Partial<Entity> = {}): Entity {
  return {
    id,
    interfaces: ['NPC'],
    name,
    components: { Identity: { name } },
    ...extra,
  };
}

/** Der Baron: ein offenes Feld, ein Gerücht, ein Geheimnis. */
const trueName = entity('i_name', 'Sein wahrer Name', {
  interfaces: ['Information'],
  components: {
    Identity: { name: 'Sein wahrer Name' },
    Information: { fields: ['Identity.aliases'], tier: 'secret' },
  },
  relations: [{ id: 'r1', type: 'knownBy', to: 'pc_mara' }],
});

const rumour = entity('i_debt', 'Seine Schulden', {
  interfaces: ['Information'],
  components: {
    Identity: { name: 'Seine Schulden' },
    Information: { fields: ['Creature', 'Secrets.secret#b_secret'], tier: 'rumour' },
  },
  /* Diese Information wird **nicht** einzeln zugeteilt: sie steckt in
     einem Bündel, und das Bündel kennt jemand. */
  relations: [],
});

const baron = entity('n_baron', 'Der Baron', {
  components: {
    Identity: { name: 'Der Baron' },
    Secrets: {
      secret: [
        { id: 'b_open', value: 'Er trägt Grau.' },
        { id: 'b_secret', value: 'Er schuldet der Gilde.' },
      ],
    },
  },
  relations: [
    { id: 'r3', type: 'knowledge', to: 'i_name' },
    { id: 'r4', type: 'knowledge', to: 'i_debt' },
  ],
});

const mara = entity('pc_mara', 'Mara', {
  interfaces: ['PlayerCharacter'],
  relations: [
    { id: 'r5', type: 'memberOfParty', to: 'p_wacht' },
    /* Mara ist Adeptin der Gilde — der Rang steht an der Kante. */
    { id: 'r8', type: 'memberOf', to: 'f_guild', props: { rank: 'adept' } },
  ],
});
const torn = entity('pc_torn', 'Torn', {
  interfaces: ['PlayerCharacter'],
  /* Torn ist Mitglied ohne Rang. */
  relations: [{ id: 'r9', type: 'memberOf', to: 'f_guild' }],
});
const party = entity('p_wacht', 'Die Wacht', { interfaces: ['Party'] });
/* **Eine Fraktion weiss nichts, ihre Mitglieder wissen** (A7): die Gilde
   hat eine Rangleiter, und eine Zuteilung an sie darf einen Mindestrang
   nennen. */
const guild = entity('f_guild', 'Die Gilde', {
  interfaces: ['Faction'],
  components: { Identity: { name: 'Die Gilde' }, Faction: { ranks: ['novice', 'adept', 'master'] } },
});
const guildLore = entity('i_lore', 'Das Gildenzeichen', {
  interfaces: ['Information'],
  components: { Identity: { name: 'Das Gildenzeichen' }, Information: { fields: ['Identity.aliases'] } },
  relations: [{ id: 'r10', type: 'knownBy', to: 'f_guild' }],
});
const guildSecret = entity('i_adept', 'Der Griff der Adepten', {
  interfaces: ['Information'],
  components: { Identity: { name: 'Der Griff der Adepten' }, Information: { fields: ['Identity.aliases'] } },
  relations: [{ id: 'r11', type: 'knownBy', to: 'f_guild', props: { rank: 'adept' } }],
});
const guildInner = entity('i_master', 'Das Meisterwort', {
  interfaces: ['Information'],
  components: { Identity: { name: 'Das Meisterwort' }, Information: { fields: ['Identity.aliases'] } },
  relations: [{ id: 'r12', type: 'knownBy', to: 'f_guild', props: { rank: 'master' } }],
});
const guildTypo = entity('i_typo', 'Ein verschriebener Rang', {
  interfaces: ['Information'],
  components: { Identity: { name: 'Ein verschriebener Rang' }, Information: { fields: ['Identity.aliases'] } },
  relations: [{ id: 'r13', type: 'knownBy', to: 'f_guild', props: { rank: 'adpet' } }],
});
/* Ein **Bündel**: es nennt seine Informationen über `includes` und wird
   über dieselbe `knownBy`-Kante zugeteilt wie eine einzelne. */
const street = entity('k_street', 'Gassenwissen', {
  interfaces: ['Knowledge'],
  relations: [
    { id: 'r6', type: 'includes', to: 'i_debt' },
    { id: 'r7', type: 'knownBy', to: 'pc_torn' },
  ],
});

const entities = new Map<EntityId, Entity>(
  [baron, trueName, rumour, mara, torn, party, street, guild, guildLore, guildSecret, guildInner, guildTypo]
    .map((e) => [e.id, e]),
);

const ALL = [
  'Identity.key',
  'Identity.aliases',
  'Creature.attitude',
  'Vitals.hp',
  'Secrets.secret#b_open',
  'Secrets.secret#b_secret',
];

describe('knowledge', () => {
  it('findet die Informationen am Artikel', () => {
    expect(informationsOf(entities, baron).map((i) => i.id)).toEqual(['i_name', 'i_debt']);
  });

  it('beansprucht ein Feld einzeln und eine Art ganz', () => {
    expect(covers(trueName, 'Identity', 'aliases')).toBe(true);
    expect(covers(trueName, 'Identity', 'key')).toBe(false);
    /* `Creature` ohne Punkt nimmt jedes Feld, das diese Art erklärt. */
    expect(covers(rumour, 'Creature', 'attitude')).toBe(true);
  });

  it('zählt die Gruppe und die Fraktion zum Betrachter', () => {
    expect([...knowledgeHolders(entities, 'pc_mara')].sort()).toEqual(['f_guild', 'p_wacht', 'pc_mara']);
    expect([...knowledgeHolders(entities, 'pc_torn')].sort()).toEqual(['f_guild', 'pc_torn']);
  });

  /* Eine Fraktion weiss nichts — ihre Mitglieder wissen, und der Rang an
     der Zuteilung sagt, welche (A7, REQ-203). */
  it('reicht Wissen an die Fraktion je Rang weiter', () => {
    expect(factionRanks(guild)).toEqual(['novice', 'adept', 'master']);
    expect(rankIndex(entities, 'pc_mara', 'f_guild')).toBe(1);
    expect(rankIndex(entities, 'pc_torn', 'f_guild')).toBe(-1);
    expect(rankIndex(entities, 'n_baron', 'f_guild')).toBeNull();
    /* Ohne Rang an der Zuteilung: jedes Mitglied. */
    expect(knows(entities, guildLore, 'pc_mara')).toBe(true);
    expect(knows(entities, guildLore, 'pc_torn')).toBe(true);
    expect(knows(entities, guildLore, 'n_baron')).toBe(false);
    /* Ab Adept: Mara ja, Torn ohne Rang nein. */
    expect(knows(entities, guildSecret, 'pc_mara')).toBe(true);
    expect(knows(entities, guildSecret, 'pc_torn')).toBe(false);
    /* Ab Meister: niemand von beiden. */
    expect(knows(entities, guildInner, 'pc_mara')).toBe(false);
    /* Ein Rang, der nicht in der Leiter steht, schliesst nichts auf. */
    expect(knows(entities, guildTypo, 'pc_mara')).toBe(false);
    /* Zwei Figuren: die höhere Sprosse zählt. */
    expect(rankIndex(entities, ['pc_torn', 'pc_mara'], 'f_guild')).toBe(1);
  });

  it('kennt direkt und über ein Bündel', () => {
    /* Mara hat den wahren Namen über ihre Gruppe. */
    expect(knows(entities, trueName, 'pc_mara')).toBe(true);
    expect(knows(entities, trueName, 'pc_torn')).toBe(false);
    /* Torn kennt die Schulden nur, weil er das Bündel kennt, in dem sie
       stecken — die Information selbst ist ihm nie zugeteilt worden. */
    expect(knows(entities, rumour, 'pc_torn')).toBe(true);
    expect(knows(entities, rumour, 'pc_mara')).toBe(false);
    /* Ohne Betrachter ist es die Spielleitung. */
    expect(knows(entities, trueName)).toBe(true);
  });

  it('findet die Bündel, in denen eine Information steckt', () => {
    expect(bundlesWith(entities, 'i_debt').map((b) => b.id)).toEqual(['k_street']);
    expect(bundlesWith(entities, 'i_name')).toEqual([]);
    expect(informationsIn(entities, street).map((i) => i.id)).toEqual(['i_debt']);
  });

  /* Ein Bündel in einem Bündel zählt nicht: ein Schritt weit, dieselbe
     Regel wie bei den Haltern. Sonst reichte eine Freigabe weiter, als
     jemand gemeint hat. */
  it('reicht nicht über ein zweites Bündel hinaus', () => {
    const aussen = entity('k_alles', 'Alles', {
      interfaces: ['Knowledge'],
      relations: [
        { id: 'r8', type: 'includes', to: 'k_street' },
        { id: 'r9', type: 'knownBy', to: 'pc_mara' },
      ],
    });
    const mehr = new Map(entities);
    mehr.set(aussen.id, aussen);
    expect(knows(mehr, rumour, 'pc_mara')).toBe(false);
  });

  it('stellt das Offene voran und beansprucht den Rest', () => {
    const groups = knowledgeGroups(registry, entities, baron, ALL);
    expect(groups[0]?.open).toBe(true);
    expect(groups[0]?.fields).toEqual([
      'Identity.key',
      'Vitals.hp',
      'Secrets.secret#b_open',
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Open', 'Sein wahrer Name', 'Seine Schulden']);
    /* Ein Eintrag von zweien: die Information nimmt genau den, den sie
       nennt — über den Index ginge das auch, bis jemand umsortiert. */
    expect(groups[2]?.fields).toContain('Secrets.secret#b_secret');
    expect(groups[2]?.fields).not.toContain('Secrets.secret#b_open');
  });

  it('zeigt einem Betrachter das Offene plus sein Wissen', () => {
    expect(visibleFields(registry, entities, baron, ALL, 'pc_mara')).toEqual([
      'Identity.key',
      'Identity.aliases',
      'Vitals.hp',
      'Secrets.secret#b_open',
    ]);
    /* Torn kennt das Gerücht — also auch den einen Eintrag, den es nennt. */
    expect(visibleFields(registry, entities, baron, ALL, 'pc_torn')).toEqual([
      'Identity.key',
      'Creature.attitude',
      'Vitals.hp',
      'Secrets.secret#b_open',
      'Secrets.secret#b_secret',
    ]);
    /* Ein Fremder sieht nur, was keine Information beansprucht. */
    expect(visibleFields(registry, entities, baron, ALL, 'pc_niemand')).toEqual([
      'Identity.key',
      'Vitals.hp',
      'Secrets.secret#b_open',
    ]);
    /* Und die Spielleitung alles. */
    expect(visibleFields(registry, entities, baron, ALL)).toEqual(ALL);
  });
});
