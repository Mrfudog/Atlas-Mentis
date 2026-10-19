import { describe, expect, it } from 'vitest';
import { informationsOf, knowledgeHolders, knows, redactEntity } from '../src/knowledge.js';
import type { Entity, EntityId, Registry } from '../src/types.js';

/* Wissen für Gruppen (T-285, REQ-350/351): eine Information mit Geltung
   gilt an jedem passenden Artikel, und eine Figur weiss, was ihrer
   Herkunft zugeteilt ist. */
const registry: Pick<Registry, 'interfaces'> = {
  interfaces: {
    Identity: { name: 'Identity', abstract: true },
    Creature: {
      name: 'Creature',
      extends: ['Identity'],
      schema: { type: 'object', properties: { trait: { type: 'string' }, species: { type: 'string' } } },
    },
    PlayerCharacter: { name: 'PlayerCharacter', extends: ['Creature'] },
    Ancestry: { name: 'Ancestry', extends: ['Identity'] },
    Information: { name: 'Information', extends: ['Identity'] },
    Knowledge: { name: 'Knowledge', extends: ['Identity'] },
  },
};

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});

const orc = art('anc-orc', 'Ancestry');
const bergorc = art('anc-orc-mountain', 'Ancestry', {}, [{ id: 's', type: 'subraceOf', to: 'anc-orc' }]);
const elf = art('anc-elf', 'Ancestry');
/* Der Trait jedes Orcs: Kreaturen mit Herkunft Orc (Unterarten mit) oder Art „orc". */
const orcTrait = art('info-orc', 'Information', {
  Information: { fields: ['Creature.trait'], applies: { types: ['Creature'], where: [{ relation: 'hasAncestry', to: ['anc-orc'], field: 'Creature.species', has: ['orc'] }] } },
});
const orcWissen = art('kn-orcs', 'Knowledge', {}, [
  { id: 'i', type: 'includes', to: 'info-orc' },
  { id: 'k', type: 'knownBy', to: 'anc-orc' },
]);
const grok = art('npc-grok', 'Creature', { Creature: { trait: 'Relentless', species: 'orc' } });
const brak = art('pc-brak', 'PlayerCharacter', { Creature: { trait: 'Relentless' } }, [{ id: 'a', type: 'hasAncestry', to: 'anc-orc-mountain' }]);
const lia = art('pc-lia', 'PlayerCharacter', { Creature: { trait: 'Trance' } }, [{ id: 'a', type: 'hasAncestry', to: 'anc-elf' }]);
const bestand = new Map<EntityId, Entity>([orc, bergorc, elf, orcTrait, orcWissen, grok, brak, lia].map((e) => [e.id, e]));

describe('information for a group (T-285, REQ-350)', () => {
  it('holds for every article its applies matches, a subrace counting for its base', () => {
    expect(informationsOf(bestand, grok, registry).map((i) => i.id)).toEqual(['info-orc']);
    expect(informationsOf(bestand, brak, registry).map((i) => i.id)).toEqual(['info-orc']);
    expect(informationsOf(bestand, lia, registry)).toEqual([]);
    /* Ohne Register wie bisher: nur, was der Artikel selbst nennt. */
    expect(informationsOf(bestand, grok)).toEqual([]);
  });

  it('withholds the field from someone who does not know, shows it to an orc character', () => {
    expect(redactEntity(registry, bestand, grok, 'pc-lia').components?.['Creature']).toEqual({ species: 'orc' });
    expect(redactEntity(registry, bestand, grok, 'pc-brak').components?.['Creature']).toMatchObject({ trait: 'Relentless' });
  });
});

describe('knowledge through what a character is (T-285, REQ-351)', () => {
  it('counts ancestry with its base, background, class, subclass and chosen feats as holders', () => {
    const f = art('pc-x', 'PlayerCharacter', {}, [
      { id: 'a', type: 'hasAncestry', to: 'anc-orc-mountain' },
      { id: 'b', type: 'hasBackground', to: 'bg-1' },
      { id: 'c', type: 'hasClass', to: 'cl-1', props: { level: 3, subclass: 'sc-1' } },
      { id: 'd', type: 'chose', to: 'bg-1', props: { choice: 'feat', picks: ['feat-1', 'Athletics'] } },
    ]);
    const m = new Map<EntityId, Entity>([...bestand, [f.id, f], ['feat-1', art('feat-1', 'Feat')]]);
    const h = knowledgeHolders(m, 'pc-x');
    for (const id of ['anc-orc-mountain', 'anc-orc', 'bg-1', 'cl-1', 'sc-1', 'feat-1']) expect(h.has(id)).toBe(true);
    expect(h.has('Athletics')).toBe(false);
  });

  it('knows what is given to the ancestry, through the bundle', () => {
    expect(knows(bestand, orcTrait, 'pc-brak')).toBe(true);
    expect(knows(bestand, orcTrait, 'pc-lia')).toBe(false);
  });
});
