import { describe, expect, it } from 'vitest';
import { validateEntity } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';

/* Erfundene Einträge in der Form von 5e.tools für die Fehler, die die
   Artikelprüfung (T-089) wiederholt fand. Keine Texte aus den Büchern. */
function datenstand(): Datenstand {
  const arten = new Map<string, Knoten[]>();
  const add = (art: string, ...e: Knoten[]) => arten.set(art, [...(arten.get(art) ?? []), ...e]);
  add('condition', { name: 'Restrained', source: 'PHB', entries: ['Held.'] }, { name: 'Poisoned', source: 'PHB', entries: ['Sick.'] });
  add('disease',
    { name: 'Web Rot', source: 'PHB', entries: ['A victim is cocooned and can escape with a {@dc 15} Strength check. Later it must make a {@dc 12} Constitution saving throw.'] },
    { name: 'Escape Only', source: 'PHB', entries: ['Escape with a {@dc 14} Dexterity check.'] },
  );
  add('variantrule',
    { name: 'Long Rules', source: 'PHB', ruleType: 'O', type: 'section', entries: ['Text.'] },
    { name: 'Short Rules', source: 'PHB', type: 'entries', entries: ['Text.'] },
  );
  const zauber = (name: string, level: number): Knoten => ({ name, source: 'PHB', level, school: 'T', time: [{ number: 1, unit: 'action' }], range: { type: 'point', distance: { type: 'self' } }, duration: [{ type: 'instant' }], entries: ['Magic.'] });
  add('spell', zauber('Levitate', 2), zauber('Hex', 1), zauber('Light', 0));
  add('feat',
    { name: 'Deep Magic', source: 'PHB', additionalSpells: [{ ability: 'cha', innate: { _: { daily: { '1e': ['levitate'] } } }, known: { _: [{ choose: 'level=0|class=Wizard' }] } }], entries: ['Spells.'] },
    {
      name: 'Twin Lists', source: 'PHB', entries: ['Pick a list.'],
      additionalSpells: [
        { name: 'Bright List', known: { _: ['light#c'] }, innate: { _: { daily: { 1: [{ choose: 'level=1|class=Cleric' }] } } } },
        { name: 'Dark List', innate: { _: { daily: { '1e': [{ choose: { from: ['hex'], count: 1 } }] } } } },
      ],
    },
  );
  add('monsterTemplate', {
    name: 'Stone Kin', source: 'PHB', page: 1,
    prerequisite: { size: { max: 'H' }, type: { oneOf: ['beast', 'plant'] }, int: { max: 3 } },
    apply: {
      _root: { size: ['M'], type: { type: 'humanoid', tags: [{ tag: 'dwarf' }] }, speed: { walk: 25, climb: 20 } },
      _mod: {
        _: [{ mode: 'addSenses', senses: { type: 'darkvision', range: 60 } }, { mode: 'scalarMultXp', scalar: 0.5, floor: true }],
        resist: { mode: 'appendIfNotExistsArr', items: 'poison' },
        conditionImmune: { mode: 'appendIfNotExistsArr', items: ['poisoned'] },
        languages: { mode: 'appendIfNotExistsArr', items: 'Dwarvish' },
        trait: { mode: 'appendArr', items: [{ name: 'Stone Skin', entries: ['<$title_short_name$> shrugs off <$short_name$>\'s bruises; save {@dc <$spell_dc__con$>}.'] }] },
        action: { mode: 'scalarAddHit', scalar: -2 },
      },
    },
  });
  return { arten, quellen: new Map([['phb', { id: 'PHB', name: "Player's Handbook", published: '2014-08-19', art: 'book' }]]) };
}

describe('Importer-Regeln aus der Artikelprüfung (T-089)', () => {
  const { datei } = lauf(datenstand());
  const es = datei.entities;
  const finde = (name: string) => es.find((e) => e.components['Identity']?.['name'] === name)!;
  const text = (name: string) => ((finde(name).components['Prose']?.['paragraph'] as { value: string }[] | undefined) ?? []).map((p) => p.value).join('\n');

  it('nimmt den SG einer Krankheit nur aus einem Rettungswurf', () => {
    expect(finde('Web Rot').components['Disease']).toEqual({ dc: 12, save: 'con' });
    expect(finde('Escape Only').components['Disease']).toBeUndefined();
  });

  it('macht aus der Darstellungsart einer Variantregel keine Marke', () => {
    expect(finde('Long Rules').components['Tags']?.['tags']).toEqual(['optional']);
    expect(finde('Short Rules').components['Tags']).toBeUndefined();
  });

  it('schreibt aus, was eine Monsterschablone ändert', () => {
    const t = text('Stone Kin');
    expect(t).toContain('**Prerequisite:** size Huge or smaller; beast or plant; INT 3 or lower');
    expect(t).toContain('**Size:** Medium');
    expect(t).toContain('**Type:** humanoid (dwarf)');
    expect(t).toContain('**Speed:** 25 ft., climb 20 ft.');
    expect(t).toContain('**Senses:** darkvision 60 ft.');
    expect(t).toContain('**XP:** × 0.5, rounded down');
    expect(t).toContain('**Damage resistances:** poison');
    expect(t).toMatch(/\*\*Condition immunities:\*\* \[\[condition-\d+\|poisoned\]\]/);
    expect(t).toContain('**Attack bonus (Actions):** -2');
    expect(t).toContain('### Traits');
    expect(t).toContain("The creature shrugs off the creature's bruises; save DC 8 + PB + CON.");
    expect(t).not.toContain('<$');
  });

  it('liest die Zauber eines Talents: fest als casts, gewählt als Wahl', () => {
    const deep = finde('Deep Magic');
    const levitate = finde('Levitate');
    expect(deep.relations.filter((r) => r.type === 'casts')).toMatchObject([{ to: levitate.id, props: { mode: 'innate', uses: '1/day', ability: 'cha' } }]);
    /* Das Attribut des Blocks gilt für feste und gewählte Zauber (T-309). */
    expect(deep.components['Choices']?.['choices']).toMatchObject([{ kind: 'spell', count: 1, ability: 'cha', from: { interfaces: ['Spell'] }, note: 'level 0, class Wizard' }]);
  });

  it('macht aus mehreren Zauberlisten eine Möglichkeit und hängt die Zauber daran', () => {
    const twin = finde('Twin Lists');
    expect(twin.relations.filter((r) => r.type === 'casts')).toEqual([]);
    const wahlen = twin.components['Choices']?.['choices'] as { id: string; kind: string; onlyIf?: unknown; default?: string[]; from?: unknown }[];
    const option = wahlen[0]!;
    expect(option).toMatchObject({ kind: 'option', from: { options: [{ key: 'bright-list', label: 'Bright List' }, { key: 'dark-list', label: 'Dark List' }] } });
    expect(wahlen.filter((w) => w.kind === 'spell').map((w) => w.onlyIf)).toEqual([
      { choice: option.id, pick: 'bright-list' },
      { choice: option.id, pick: 'bright-list' },
      { choice: option.id, pick: 'dark-list' },
    ]);
    expect(wahlen.find((w) => w.default)?.default).toEqual([finde('Light').id]);
  });

  it('besteht die Prüfung', () => {
    const arten = new Map(es.map((e) => [e.id, e.interfaces[0]!] as const));
    for (const n of ['Stone Kin', 'Web Rot', 'Long Rules', 'Deep Magic', 'Twin Lists']) expect(validateEntity(seedRegistry, finde(n), { knownTypes: arten })).toEqual([]);
  });
});
