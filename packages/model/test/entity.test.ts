import { describe, expect, it } from 'vitest';
import {
  articleId,
  backlinks,
  fieldTitle,
  findByName,
  idPrefix,
  nextId,
  relationAccepts,
  relationDef,
  setTags,
  splitRelations,
  tagsOf,
} from '../src/entity.js';
import { validateEntity } from '../src/validate.js';
import type { Entity, Registry } from '../src/types.js';

const registry: Registry = {
  interfaces: {
    Identity: {
      name: 'Identity',
      abstract: true,
      schema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          key: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    NPC: {
      name: 'NPC',
      extends: ['Identity'],
      schema: { type: 'object', properties: { rolle: { type: 'string' } } },
    },
    /* Eigener Obertyp, damit `StatblockInfo` eine Karte bleibt — dieselbe
       Form wie im echten Register. */
    StatblockInfo: {
      name: 'StatblockInfo',
      abstract: true,
      schema: {
        type: 'object',
        required: ['system'],
        properties: { system: { type: 'string' }, ac: { type: 'number' } },
      },
    },
    Statblock: { name: 'Statblock', extends: ['Identity', 'StatblockInfo'] },
  },
  relations: {
    schuldet: { type: 'schuldet', label: 'schuldet', inverseLabel: 'Gläubiger von', from: ['NPC'], to: ['NPC'] },
    composedOf: { type: 'composedOf', label: 'besteht aus', inverseLabel: 'verwendet in', from: ['Statblock'], to: ['*'], section: 'Aktionen' },
  },
  views: {},
  vars: {},
};

const volo: Entity = {
  id: 'n_volo',
  interfaces: ['NPC'],
  name: 'Volo Geddarm',
  components: {
    Identity: { name: 'Volo Geddarm', key: 'npc/volo', aliases: ['Volothamp Geddarm', 'Der Dicke'] },
  },
  relations: [{ id: 'r1', type: 'schuldet', to: 'n_floon', props: { note: '80 Drachen' } }],
};

const floon: Entity = {
  id: 'n_floon',
  interfaces: ['NPC'],
  name: 'Floon Blagmaar',
  components: { Identity: { name: 'Floon Blagmaar' } },
};

describe('backlinks', () => {
  it('derives the reverse direction with the inverse label', () => {
    const found = backlinks(registry, [volo, floon], 'n_floon');
    expect(found).toHaveLength(1);
    expect(found[0]!.from.id).toBe('n_volo');
    expect(found[0]!.def.inverseLabel).toBe('Gläubiger von');
  });

  it('is empty when nothing points at the entity', () => {
    expect(backlinks(registry, [volo, floon], 'n_volo')).toEqual([]);
  });

  it('cannot go stale, because only one direction is stored', () => {
    // Floon carries no edge of its own; the relationship exists once, on Volo.
    expect(floon.relations ?? []).toEqual([]);
    expect(backlinks(registry, [volo, floon], 'n_floon')).toHaveLength(1);
  });
});

describe('findByName', () => {
  it('matches the name and every alias, case-insensitively', () => {
    expect(findByName([volo, floon], 'volo geddarm')?.id).toBe('n_volo');
    expect(findByName([volo, floon], 'Der Dicke')?.id).toBe('n_volo');
    expect(findByName([volo, floon], 'niemand')).toBeUndefined();
    expect(findByName([volo, floon], '')).toBeUndefined();
  });
});

describe('relationAccepts', () => {
  it('honours explicit targets, wildcards and `same`', () => {
    expect(relationAccepts(registry.relations['schuldet']!, 'NPC', 'NPC')).toBe(true);
    expect(relationAccepts(registry.relations['schuldet']!, 'NPC', 'Statblock')).toBe(false);
    expect(relationAccepts(registry.relations['composedOf']!, 'Statblock', 'NPC')).toBe(true);
    expect(relationAccepts({ type: 'x', label: 'x', inverseLabel: 'y', to: ['same'] }, 'Ort', 'Ort')).toBe(true);
    expect(relationAccepts({ type: 'x', label: 'x', inverseLabel: 'y', to: ['same'] }, 'Ort', 'NPC')).toBe(false);
  });
});

describe('relationDef', () => {
  it('invents a readable fallback for an unregistered type', () => {
    const def = relationDef(registry, 'gibtsnicht');
    expect(def.label).toBe('gibtsnicht');
    expect(def.inverseLabel).toContain('gibtsnicht');
  });
});

describe('splitRelations', () => {
  it('separates composition sections from plain references', () => {
    const statblock: Entity = {
      id: 'sb', interfaces: ['Statblock'], name: 'Schleim',
      components: { Identity: { name: 'Schleim' }, StatblockInfo: { system: 'dnd5e' } },
      relations: [
        { id: 'a', type: 'composedOf', to: 'r_amorph' },
        { id: 'b', type: 'schuldet', to: 'n_floon' },
      ],
    };
    const { sections, plain } = splitRelations(registry, statblock);
    expect(Object.keys(sections)).toEqual(['Aktionen']);
    expect(plain.map((r) => r.id)).toEqual(['b']);
  });
});

describe('validateEntity', () => {
  it('accepts a well-formed entity', () => {
    expect(validateEntity(registry, volo)).toEqual([]);
  });

  /* Eine fehlende Karte ist kein eigener Fall mehr: wo sie fehlt, fehlen
     ihre Pflichtfelder, und genau das steht da. */
  it('reports the required fields of a card that is not there at all', () => {
    const broken: Entity = { ...volo, interfaces: ['Statblock'], components: { Identity: { name: 'x' } } };
    const issue = validateEntity(registry, broken).find((i) => i.code === 'missing_property');
    expect(issue?.component).toBe('StatblockInfo');
    expect(issue?.property).toBe('system');
  });

  it('reports a missing required property', () => {
    const broken: Entity = {
      id: 'sb', interfaces: ['Statblock'], name: 'x',
      components: { Identity: { name: 'x' }, StatblockInfo: {} },
    };
    const issue = validateEntity(registry, broken).find((i) => i.code === 'missing_property');
    expect(issue?.property).toBe('system');
  });

  it('refuses a card whose type this article does not inherit, and relents in expert mode (D2)', () => {
    const odd: Entity = {
      ...volo,
      components: { ...volo.components, StatblockInfo: { system: 'dnd5e' } },
    };
    expect(validateEntity(registry, odd).map((i) => i.code)).toContain('card_not_inherited');
    expect(validateEntity(registry, odd, { expertMode: true }).map((i) => i.code)).not.toContain(
      'card_not_inherited',
    );
  });

  it('reports an edge pointing at nothing', () => {
    const known = new Set(['n_volo']);
    const codes = validateEntity(registry, volo, { knownIds: known }).map((i) => i.code);
    expect(codes).toContain('dangling_relation');
  });

  it('reports an unknown interface instead of throwing', () => {
    const alien: Entity = { ...volo, interfaces: ['Vogelscheuche'] };
    expect(validateEntity(registry, alien)).toEqual([
      expect.objectContaining({ code: 'unknown_interface' }),
    ]);
  });
});

/* Marken waren die einzige Eigenschaft, die keiner Art gehörte — und damit
   die einzige, die man nirgends weglassen konnte. Jetzt ist es ein
   Bestandteil, und `abwesend` heisst „trägt keine Marken", nicht „hat
   gerade keine". */
describe('tagsOf / setTags', () => {
  it('reads the tags from the card and never throws on an article without one', () => {
    expect(tagsOf({ id: 'x', interfaces: ['NPC'], name: 'x', components: {} })).toEqual([]);
    expect(tagsOf(undefined)).toEqual([]);
    expect(
      tagsOf({
        id: 'x', interfaces: ['NPC'], name: 'x',
        components: { Tags: { tags: ['händler', 'stadt'] } },
      }),
    ).toEqual(['händler', 'stadt']);
  });

  it('writes them back, trims them, and drops the card when nothing is left', () => {
    const e: Entity = { id: 'x', interfaces: ['NPC'], name: 'x', components: {} };
    setTags(e, [' händler ', '', 'stadt']);
    expect(e.components['Tags']).toEqual({ tags: ['händler', 'stadt'] });
    setTags(e, []);
    expect(e.components['Tags']).toBeUndefined();
  });
});

/* ---- Wie ein Feld an dieser Art heisst ----
   Derselbe `Time.until` ist an einem Ereignis, wann es aufhört, und an
   einem Auftrag, wann es zu spät ist. `Time` dafür zu verdoppeln wäre der
   teurere Weg zum selben Satz. */
describe('fieldTitle', () => {
  const reg: Pick<Registry, 'interfaces'> = {
    interfaces: {
      Time: {
        name: 'Time',
        abstract: true,
        schema: {
          type: 'object',
          properties: {
            until: { type: 'string', title: 'Until' },
            display: { type: 'string', title: 'Date' },
            bare: { type: 'string' },
          },
        },
      },
      Story: { name: 'Story', abstract: true, extends: ['Time'], titles: { 'Time.display': 'When' } },
      Quest: { name: 'Quest', extends: ['Time'], titles: { 'Time.until': 'Deadline' } },
      Event: { name: 'Event', extends: ['Time'] },
      Session: { name: 'Session', extends: ['Story'] },
      Recap: { name: 'Recap', extends: ['Story'], titles: { 'Time.display': 'Played on' } },
    },
  };
  const feld = (key: string) => ({
    type: 'Time',
    key,
    prop: reg.interfaces['Time']?.schema?.properties?.[key] ?? { type: 'string' as const },
  });

  it('takes the name the kind gives it', () => {
    expect(fieldTitle(reg, 'Quest', feld('until'))).toBe('Deadline');
  });

  it('leaves every other kind alone', () => {
    expect(fieldTitle(reg, 'Event', feld('until'))).toBe('Until');
    expect(fieldTitle(reg, 'Quest', feld('display'))).toBe('Date');
  });

  it('inherits a rename from a supertype', () => {
    expect(fieldTitle(reg, 'Session', feld('display'))).toBe('When');
  });

  /* Die nähere Art gewinnt — sonst hinge die Beschriftung davon ab, wie tief
     der Baum gerade ist, und niemand könnte sie dort ändern, wo er sie sieht. */
  it('and the nearer kind wins over the one further up', () => {
    expect(fieldTitle(reg, 'Recap', feld('display'))).toBe('Played on');
  });

  it('falls back to the key when the field carries no title at all', () => {
    expect(fieldTitle(reg, 'Event', feld('bare'))).toBe('bare');
  });

  /* Ohne Art gibt es keine Umbenennung: eine Feldliste im Register ist
     nicht die eines Artikels. */
  it('without a kind there is nothing to rename', () => {
    expect(fieldTitle(reg, undefined, feld('until'))).toBe('Until');
  });

  /* Eine leere Beschriftung ist keine: sie stehenzulassen hiesse, ein Feld
     ohne Namen zu zeigen, weil jemand das Eingabefeld geleert hat. */
  it('an empty rename does not blank the field', () => {
    const leer: Pick<Registry, 'interfaces'> = {
      interfaces: { ...reg.interfaces, Quest: { name: 'Quest', extends: ['Time'], titles: { 'Time.until': '  ' } } },
    };
    expect(fieldTitle(leer, 'Quest', feld('until'))).toBe('Until');
  });
});

/* ---- Die ausgegebene Nummer ----
   `Identity.id` ist `npc-0042` und hiess einmal `key`: `npc/volo-geddarm`,
   also ein Name, der ein zweites Mal derselbe Name war. Beim Umbenennen
   musste er entweder mitwandern — dann war er kein fester Bezeichner — oder
   nicht, und dann log er. */
describe('nextId', () => {
  const mit = (...ids: string[]): Pick<Entity, 'components'>[] =>
    ids.map((id) => ({ components: { Identity: { id } } }));

  it('starts at one when the kind has none yet', () => {
    expect(nextId([], 'NPC')).toBe('npc-0001');
  });

  it('counts on from the highest that is already there', () => {
    expect(nextId(mit('npc-0001', 'npc-0007', 'npc-0003'), 'NPC')).toBe('npc-0008');
  });

  /* Je Art gezählt: ein Gegenstand füllt keine Lücke bei den NSC. */
  it('counts per kind', () => {
    const bestand = mit('npc-0004', 'item-0011');
    expect(nextId(bestand, 'NPC')).toBe('npc-0005');
    expect(nextId(bestand, 'Item')).toBe('item-0012');
  });

  /* Ein Import legt zwanzig Artikel auf einmal an. Ohne die zweite Liste
     bekämen alle zwanzig dieselbe Nummer. */
  it('also counts what a batch has just issued', () => {
    expect(nextId(mit('npc-0002'), 'NPC', ['npc-0003', 'npc-0004'])).toBe('npc-0005');
  });

  /* Eine Lücke bleibt eine Lücke: die höchste plus eins, nicht die erste
     freie. Nummern nachzureichen hiesse, eine alte wiederzuverwenden, und
     dann zeigte eine Freigabe auf den falschen Artikel. */
  it('never fills a gap a deletion left', () => {
    expect(nextId(mit('npc-0001', 'npc-0009'), 'NPC')).toBe('npc-0010');
  });

  it('ignores what does not look like one of its numbers', () => {
    expect(nextId(mit('npc/volo-geddarm', 'npcx-0900', 'npc-0002'), 'NPC')).toBe('npc-0003');
  });

  it('folds a kind name down to something writable', () => {
    expect(idPrefix('PlayerCharacter')).toBe('playercharacter');
    expect(idPrefix('Statblock Info')).toBe('statblock-info');
    expect(idPrefix('')).toBe('article');
  });

  it('reads the number back off an article', () => {
    expect(articleId({ components: { Identity: { id: 'npc-0003' } } })).toBe('npc-0003');
    expect(articleId({ components: {} })).toBe('');
  });
});
