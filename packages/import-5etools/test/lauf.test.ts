import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { stageBases, validateEntity } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { ausschnitt, blocklistGruppen, gruppeVon, herausgeberVon, lauf, OHNE_BUCH } from '../src/lauf.js';
import { berichtMarkdown } from '../src/bericht.js';
import { buchEbeneId, gruppeEbeneId, herausgeberEbeneId, ohneBuchEbeneId } from '../src/werkbank.js';

/** Ein kleiner Datenstand in der Form von 5e.tools — genug, um jede Stufe zu berühren. */
function datenstand(): Datenstand {
  const arten = new Map<string, Knoten[]>();
  const add = (art: string, ...e: Knoten[]) => arten.set(art, [...(arten.get(art) ?? []), ...e]);
  add('condition',
    { name: 'Blinded', source: 'PHB', page: 290, srd: true, entries: [{ type: 'list', items: ["A blinded creature can't see."] }] },
    {
      name: 'Exhaustion', source: 'PHB', page: 291, srd: true,
      entries: ['Measured in levels.', { type: 'table', colLabels: ['Level', 'Effect'], rows: [['1', 'Disadvantage on ability checks'], ['2', 'Speed halved']] }],
    },
    { name: 'Blinded', source: 'XPHB', entries: ['2024.'] },
  );
  add('skill', { name: 'Stealth', source: 'PHB', ability: 'dex', entries: ['Hide.'] });
  add('language', { name: 'Common', source: 'PHB', type: 'standard', entries: ['Common.'] }, { name: 'Goblin', source: 'PHB', type: 'standard', script: 'Dwarvish', entries: [] });
  add('action', { name: 'Disengage', source: 'PHB', time: [{ number: 1, unit: 'action' }], entries: ['Move away.'] });
  add('itemProperty', { abbreviation: 'L', source: 'PHB', entries: [{ type: 'entries', name: 'Light', entries: ['Small and easy.'] }] });
  add('baseitem', { name: 'Scimitar', source: 'PHB', type: 'M', weaponCategory: 'martial', dmg1: '1d6', dmgType: 'S', property: ['F', 'L'], weapon: true, value: 2500, weight: 3 });
  add('spell', {
    name: 'Fireball', source: 'PHB', page: 241, srd: true, level: 3, school: 'V', time: [{ number: 1, unit: 'action' }],
    range: { type: 'point', distance: { type: 'feet', amount: 150 } }, components: { v: true, s: true, m: 'bat guano' },
    duration: [{ type: 'instant' }], savingThrow: ['dexterity'], damageInflict: ['fire'],
    entries: ['Takes {@damage 8d6} fire damage. See {@creature goblin}.'],
    entriesHigherLevel: [{ type: 'entries', name: 'At Higher Levels', entries: ['+{@scaledamage 8d6|3-9|1d6} per level.'] }],
  });
  const goblin: Knoten = {
    name: 'Goblin', source: 'MM', page: 166, srd: true, size: ['S'], type: { type: 'humanoid', tags: ['goblinoid'] },
    alignment: ['N', 'E'], ac: [{ ac: 15, from: ['{@item scimitar|phb}'] }], hp: { average: 7, formula: '2d6' },
    speed: { walk: 30 }, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8, skill: { stealth: '+6' },
    senses: ['darkvision 60 ft.'], passive: 9, languages: ['Common', 'Goblin'], cr: '1/4',
    trait: [{ name: 'Nimble Escape', entries: ['The goblin can take the {@action Disengage} action as a bonus action.'] }],
    action: [{ name: 'Scimitar', entries: ['{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d6 + 2}) slashing damage.'] }],
    environment: ['forest'], attachedItems: ['scimitar|phb'], hasToken: true, sizeNote: 'small',
  };
  add('monster',
    goblin,
    { name: 'Goblin Boss', source: 'MM', page: 166, _copy: { name: 'Goblin', source: 'MM', _mod: { '*': { mode: 'replaceTxt', replace: 'the goblin', with: 'the goblin boss', flags: 'i' } } }, cr: '1' },
    { name: 'Wolf', source: 'MM', cr: '1/4', dex: 15, trait: [{ name: 'Pack Tactics', entries: ['The wolf has advantage on an attack roll.'] }] },
    { name: 'Jackal', source: 'MM', cr: '0', dex: 15, trait: [{ name: 'Pack Tactics', entries: ['The jackal has advantage on an attack roll.'] }] },
    { name: 'Mage', source: 'MM', cr: '6', int: 17, spellcasting: [{ name: 'Spellcasting', type: 'spellcasting', ability: 'int', headerEntries: ['The mage is a 9th-level spellcaster.'], spells: { 3: { slots: 3, spells: ['{@spell fireball}'] } } }] },
    { name: 'Goblin Warrior', source: 'XMM', cr: '1/4', dex: 15,
      action: [{ name: 'Scimitar', entries: ['{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d6 + 2}) slashing damage.'] }] },
  );
  const asi = (level: number): Knoten => ({
    name: 'Ability Score Improvement', source: 'PHB', className: 'Fighter', classSource: 'PHB', level,
    entries: [`When you reach ${level}th level, you can increase one ability score.`],
  });
  add('classFeature', asi(4), asi(6), { name: 'Second Wind', source: 'PHB', className: 'Fighter', classSource: 'PHB', level: 1, entries: ['Regain {@dice 1d10} hit points.'] });
  add('subclassFeature', { name: 'Improved Critical', source: 'PHB', className: 'Fighter', classSource: 'PHB', subclassShortName: 'Champion', subclassSource: 'PHB', level: 3, entries: ['Crit on 19.'] });
  add('class', {
    name: 'Fighter', source: 'PHB', hd: { number: 1, faces: 10 }, proficiency: ['str', 'con'],
    startingProficiencies: { armor: ['light', 'shield'], weapons: ['simple', 'martial'], skills: [{ choose: { from: ['stealth'], count: 1 } }] },
    multiclassing: { requirements: { or: [{ str: 13, dex: 13 }] } },
    classFeatures: ['Second Wind|Fighter||1', 'Ability Score Improvement|Fighter||4', 'Ability Score Improvement|Fighter||6'],
    subclassTitle: 'Martial Archetype',
  });
  add('subclass', { name: 'Champion', shortName: 'Champion', source: 'PHB', className: 'Fighter', classSource: 'PHB', subclassFeatures: ['Improved Critical|Fighter||Champion||3'],
    subclassTableGroups: [{ subclasses: [{ name: 'Champion', source: 'PHB' }], colLabels: ['{@filter Spells Known|spells}'], rows: Array.from({ length: 20 }, (_, i) => [i < 2 ? 0 : i + 1]) }] });
  add('table', { name: 'Trinkets', source: 'PHB', colLabels: ['d6', 'Trinket'], rows: [['1-3', 'A {@item scimitar|phb}'], ['4-6', 'A button']] });
  /* T-087: der 2024-Kämpfer mit gleichnamigem Merkmal, und der
     2014-Champion, den 5e.tools ihm gibt. */
  add('classFeature', { name: 'Second Wind', source: 'XPHB', className: 'Fighter', classSource: 'XPHB', level: 1, entries: ['Regain {@dice 1d10} hit points.'] });
  add('class', { name: 'Fighter', source: 'XPHB', hd: { number: 1, faces: 10 }, proficiency: ['str', 'con'], classFeatures: ['Second Wind|Fighter|XPHB|1'] });
  add('subclass', { name: 'Champion', shortName: 'Champion', source: 'PHB', className: 'Fighter', classSource: 'XPHB', subclassFeatures: [] });
  add('spell', { name: 'Fireball', source: 'XPHB', level: 3, school: 'V', time: [{ number: 1, unit: 'action' }], entries: ['Like {@spell fireball|PHB}, but 2024.'] });
  add('itemMastery', { name: 'Nick', source: 'XPHB', entries: ['An extra attack.'] });
  add('baseitem', { name: 'Scimitar', source: 'XPHB', type: 'M|XPHB', weaponCategory: 'martial', dmg1: '1d6', dmgType: 'S', property: ['F', 'L'], mastery: ['Nick|XPHB'], weapon: true });
  add('vehicle', { name: 'Galley', source: 'GoS', vehicleType: 'SHIP', terrain: ['sea'], capCrew: 80, hull: { ac: 15, hp: 500, dt: 20 }, str: 24, dex: 4, con: 20, int: 0, wis: 0, cha: 0 });
  add('card', { name: 'Vizier', source: 'DMG', set: 'Deck of Many Things', entries: ['Answer a question.'] }, { name: 'Fool', source: 'DMG', set: 'Deck of Many Things', entries: ['Lose XP.'] });
  add('deck', { name: 'Deck of Many Things', source: 'DMG', cards: ['Vizier|Deck of Many Things', { uid: 'Fool|Deck of Many Things', count: 2 }], entries: ['A deck of cards.'] });
  add('facility', { name: 'Armory', source: 'XDMG', facilityType: 'special', level: 5, space: ['roomy'], hirelings: [{ exact: 1 }], orders: ['trade'], entries: ['Weapons.'] });
  add('monster', { name: 'Chef', source: 'HFLotT', cr: '0' });
  return {
    arten,
    quellen: new Map([
      ['phb', { id: 'PHB', name: "Player's Handbook", published: '2014-08-19', art: 'book' }],
      ['mm', { id: 'MM', name: 'Monster Manual', published: '2014-09-30', art: 'book' }],
      ['xphb', { id: 'XPHB', name: "Player's Handbook (2024)", published: '2024-09-17', art: 'book' }],
      ['xmm', { id: 'XMM', name: 'Monster Manual (2025)', published: '2025-02-18', art: 'book' }],
      ['dmg', { id: 'DMG', name: "Dungeon Master's Guide", published: '2014-12-09', art: 'book' }],
      ['xdmg', { id: 'XDMG', name: "Dungeon Master's Guide (2024)", published: '2024-11-12', art: 'book' }],
      ['gos', { id: 'GoS', name: 'Ghosts of Saltmarsh', published: '2019-05-21', art: 'adventure' }],
    ]),
  };
}

const finde = (es: Entity[], typ: string, name: string) => es.find((e) => e.interfaces[0] === typ && e.name === name)!;
const prosa = (e: Entity) => ((e.components['Prose']?.['paragraph'] as { value: string }[] | undefined) ?? [])[0]?.value ?? '';

describe('Ein Lauf (Abgleich §4.2)', () => {
  const { datei, bericht } = lauf(datenstand());
  const es = datei.entities;

  it('legt jedes Buch in seine eigene Ebene und schreibt das Format der Einfuhr (T-081)', () => {
    expect(datei.format).toBe('nebelwacht/1');
    expect(datei.registry.interfaces['Spell']).toBeDefined();
    const ebene = finde(es, 'Layer', OHNE_BUCH);
    expect(ebene.components['Layer']).toMatchObject({ kind: 'system' });
    expect(ebene.id).toBe(ohneBuchEbeneId());
    const phb = finde(es, 'Layer', "Player's Handbook");
    expect(phb.id).toBe(buchEbeneId('PHB'));
    expect(phb.components['Layer']).toMatchObject({ kind: 'book', order: 0 });
    expect(phb.components['Tags']).toEqual({ tags: ['core'] });
    const ebenen = new Map(es.filter((e) => e.interfaces[0] === 'Layer').map((e) => [e.id, e]));
    for (const e of es.filter((x) => !ebenen.has(x.id))) {
      const in_ = (e.relations ?? []).filter((r) => r.type === 'inLayer');
      expect(in_, `${e.name}`).toHaveLength(1);
      const quelle = (e.components['Source'] as { publication?: string } | undefined)?.publication;
      /* Mit Quelle in der Ebene ihres Buchs, ohne in der Systemebene —
         ausser sie hängt an einer Klasse eines anderen Regelstands (T-087). */
      const zuKlasse = e.name.endsWith('(PHB, XPHB)') ? 'XPHB' : quelle;
      expect(in_[0]!.to, `${e.name}`).toBe(zuKlasse ? buchEbeneId(zuKlasse) : ebene.id);
    }
    /* Keine Ebene steht selbst in einer Ebene, und keine Buchebene ist leer. */
    for (const l of ebenen.values()) {
      expect(l.relations?.some((r) => r.type === 'inLayer') ?? false).toBe(false);
      if (l === ebene) continue;
      /* Eine Gruppe (T-088) enthält Ebenen, keine Artikel. */
      const gruppe = (l.components['Layer'] as { kind?: string }).kind === 'group';
      const inhalt = gruppe ? (e: Entity) => e.relations?.some((r) => r.type === 'partOf' && r.to === l.id) : (e: Entity) => e.relations?.some((r) => r.type === 'inLayer' && r.to === l.id);
      expect(es.some((e) => inhalt(e)), l.name).toBe(true);
    }
  });

  it('hängt jedes Buch an seine Gruppe und beschreibt es (T-088, E-022 b)', () => {
    const phb = finde(es, 'Layer', "Player's Handbook");
    expect(phb.components['Layer']).toMatchObject({ abbreviation: 'PHB', published: '2014-08-19', version: '2014' });
    expect(phb.components['Description']).toEqual({ description: "PHB — Player's Handbook" });
    const kern = es.find((e) => e.id === gruppeEbeneId('core'))!;
    expect(kern.name).toBe('Core rules');
    expect(kern.components['Layer']).toMatchObject({ kind: 'group' });
    expect((phb.relations ?? []).filter((r) => r.type === 'partOf').map((r) => r.to)).toEqual([
      kern.id,
      herausgeberEbeneId('official'),
      finde(es, 'Layer', 'D&D 5e (2014)').id,
    ]);
    /* Ohne Mitglied keine Gruppe: Settings gibt es in diesem Stand nicht. */
    expect(es.some((e) => e.id === gruppeEbeneId('setting'))).toBe(false);
  });

  it('macht „D&D 5e (2014)" zur Gruppe der offiziellen 2014-Bücher (T-109)', () => {
    const gruppe = finde(es, 'Layer', 'D&D 5e (2014)');
    expect(gruppe.components['Layer']).toMatchObject({ kind: 'group', version: '2014' });
    expect(gruppe.components['Layer']).not.toHaveProperty('groupBy');
    const phb = finde(es, 'Layer', "Player's Handbook");
    expect((phb.relations ?? []).some((r) => r.type === 'partOf' && r.to === gruppe.id)).toBe(true);
    /* Was kein Buch nennt, ist offiziell und in der Gruppe. */
    const ohne = finde(es, 'Layer', OHNE_BUCH);
    expect((ohne.relations ?? []).filter((r) => r.type === 'partOf').map((r) => r.to).sort()).toEqual([gruppe.id, herausgeberEbeneId('official')].sort());
    /* Kein Partner-Buch darin. */
    for (const b of es.filter((e) => e.relations?.some((r) => r.type === 'partOf' && r.to === herausgeberEbeneId('partnered')))) {
      expect(b.relations?.some((r) => r.type === 'partOf' && r.to === gruppe.id), b.name).toBe(false);
    }
  });

  it('hängt jedes Buch auch an seinen Herausgeber (T-094)', () => {
    const offiziell = es.find((e) => e.id === herausgeberEbeneId('official'))!;
    expect(offiziell.name).toBe('Official');
    expect(offiziell.components['Layer']).toMatchObject({ kind: 'group', groupBy: 'publisher' });
    /* Die Kategorien ordnen ohne Angabe. */
    expect(es.find((e) => e.id === gruppeEbeneId('core'))!.components['Layer']).not.toHaveProperty('groupBy');
    /* Jedes Buch steht in genau einer Herausgeber-Gruppe. */
    const buecher = es.filter((e) => e.interfaces[0] === 'Layer' && ['book', 'adventure'].includes(String((e.components['Layer'] as { kind?: string }).kind)));
    expect(buecher.length).toBeGreaterThan(0);
    for (const b of buecher) {
      expect((b.relations ?? []).filter((r) => r.type === 'partOf' && r.to.startsWith('e5_publisher_')), b.name).toHaveLength(1);
    }
  });

  it('ordnet Herausgeber und Blocklist-Kategorien nach den Listen von 5e.tools (T-094)', () => {
    expect(herausgeberVon('PHB')).toBe('official');
    expect(herausgeberVon('EGW')).toBe('partnered');
    expect(herausgeberVon('crcotn')).toBe('partnered');
    expect(herausgeberVon('XGE')).toBe('official');
    expect(blocklistGruppen('EGW')).toEqual(['non-fr']);
    expect(blocklistGruppen('LK')).toEqual(['nonstandard', 'comedy', 'non-fr']);
    expect(blocklistGruppen('PS-Z')).toEqual(['nonstandard']);
    expect(blocklistGruppen('MCV1SC')).toEqual(['nonstandard']);
    expect(blocklistGruppen('PHB')).toEqual([]);
  });

  it('ordnet Bücher nach der Gruppe in 5e.tools, dem Erscheinen und dem Kürzel', () => {
    const q = (group: string, published = '2017-01-01', art: 'book' | 'adventure' = 'book') => ({ id: 'X', name: 'X', published, art, group });
    expect(gruppeVon('PHB', undefined)).toBe('core');
    expect(gruppeVon('XGE', q('supplement'))).toBe('supplement');
    expect(gruppeVon('ERLW', q('setting'))).toBe('setting');
    expect(gruppeVon('CoS', q('supplement', '2016-03-15', 'adventure'))).toBe('adventure');
    expect(gruppeVon('UATest', q('prerelease'))).toBe('ua');
    expect(gruppeVon('XPHB', q('core', '2024-09-17'))).toBe('2024');
    expect(gruppeVon('DMS', q('screen'))).toBe('other');
  });

  it('vergibt Kanten-Ids, die im ganzen Bestand nur einmal vorkommen', () => {
    const ids = es.flatMap((e) => (e.relations ?? []).map((r) => r.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of es) for (const r of e.relations ?? []) expect(r.id.startsWith(`${e.id}~`)).toBe(true);
  });

  it('lässt mit --only-2014 2024 und die neuen Arten weg und zählt es', () => {
    const nur = lauf(datenstand(), { nurGrundstand: true });
    expect(nur.datei.entities.some((e) => e.name === 'Goblin Warrior')).toBe(false);
    expect(nur.datei.entities.filter((e) => e.name.startsWith('Blinded'))).toHaveLength(1);
    expect(nur.bericht.arten.get('monster')?.ausgeschlossen.get('2024-Kernbuch')?.get('XMM')).toBe(1);
    expect(nur.bericht.arten.get('vehicle')?.ausgeschlossen.get('neue Art (T-087)')?.get('GoS')).toBe(1);
  });

  it('schreibt den Grundstand mit 2024 Zeichen für Zeichen wie ohne (T-087)', () => {
    const nur = lauf(datenstand(), { nurGrundstand: true }).datei.entities;
    const alle = new Map(es.map((e) => [e.id, e]));
    for (const e of nur) {
      const da = alle.get(e.id);
      expect(da, `${e.interfaces[0]} ${e.name}`).toBeDefined();
      /* Gleich bis auf die Gruppe: die neuen Ebenen zählen dort mit. */
      expect({ ...da!, relations: da!.relations?.filter((r) => r.type !== 'partOf') }).toEqual({ ...e, relations: e.relations?.filter((r) => r.type !== 'partOf') });
    }
  });

  it('legt 2024 in eigene Ebenen, nicht aufgeschaltet und nicht in der 2014-Gruppe (T-087)', () => {
    const xmm = finde(es, 'Layer', 'Monster Manual (2025)');
    expect(xmm.components['Layer']).toMatchObject({ kind: 'book', version: '2024', abbreviation: 'XMM' });
    const gruppen = (l: Entity) => (l.relations ?? []).filter((r) => r.type === 'partOf').map((r) => r.to);
    expect(gruppen(xmm)).toContain(gruppeEbeneId('2024'));
    expect(gruppen(xmm)).not.toContain(finde(es, 'Layer', 'D&D 5e (2014)').id);
    expect(gruppen(finde(es, 'Layer', "Player's Handbook"))).toContain(finde(es, 'Layer', 'D&D 5e (2014)').id);
    /* Eine 2014-Ebene, die nur Neues bringt, ebensowenig. */
    expect(gruppen(finde(es, 'Layer', 'Ghosts of Saltmarsh'))).not.toContain(finde(es, 'Layer', 'D&D 5e (2014)').id);
    const krieger = finde(es, 'Statblock', 'Goblin Warrior');
    expect(krieger.relations?.find((r) => r.type === 'inLayer')?.to).toBe(xmm.id);
    expect(es.some((e) => e.interfaces[0] === 'Campaign' || (e.relations ?? []).some((r) => r.type === 'activates'))).toBe(false);
  });

  it('macht die 2024-Fassung zur Variante der von 2014 (E-021 d)', () => {
    const alt = finde(es, 'Spell', 'Fireball');
    const neu = finde(es, 'Spell', 'Fireball (XPHB)');
    expect(alt.components['Source']).toMatchObject({ publication: 'PHB' });
    expect(neu.relations?.find((r) => r.type === 'variantOf')?.to).toBe(alt.id);
    expect(prosa(neu)).toContain(`[[${(alt.components['Identity'] as { id: string }).id}|`);
    expect(finde(es, 'Condition', 'Blinded (XPHB)').relations?.find((r) => r.type === 'variantOf')?.to).toBe(finde(es, 'Condition', 'Blinded').id);
  });

  it('gibt dem 2024-Kämpfer seine eigenen Merkmale und legt den 2014-Champion zu ihm (T-087)', () => {
    const k24 = finde(es, 'Class', 'Fighter (XPHB)');
    const xphb = buchEbeneId('XPHB');
    const ziele = (k24.relations ?? []).filter((r) => r.type === 'grants').map((r) => es.find((e) => e.id === r.to)!);
    expect(ziele.map((z) => z.components['Source']?.['publication'])).toEqual(['XPHB']);
    expect(ziele[0]!.relations?.find((r) => r.type === 'inLayer')?.to).toBe(xphb);
    const champ = finde(es, 'Subclass', 'Champion (PHB, XPHB)');
    expect(champ.relations?.find((r) => r.type === 'inLayer')?.to).toBe(xphb);
    expect(champ.relations?.find((r) => r.type === 'subclassOf')?.to).toBe(k24.id);
    expect(finde(es, 'Subclass', 'Champion').relations?.find((r) => r.type === 'subclassOf')?.to).toBe(finde(es, 'Class', 'Fighter').id);
  });

  it('teilt keinen Angriff zwischen Grundstand und 2024 (T-087)', () => {
    const angriff = (name: string) => finde(es, 'Statblock', name).relations!.filter((r) => r.type === 'composedOf').map((r) => r.to);
    expect(angriff('Goblin Warrior')).toHaveLength(1);
    expect(angriff('Goblin')).not.toContain(angriff('Goblin Warrior')[0]);
  });

  it('nimmt Fahrzeuge, Decks, Bastionen und Meisterschaften herein (E4, T-087)', () => {
    const galeere = finde(es, 'Statblock', 'Galley');
    expect(galeere.components['Statblock']).toMatchObject({ creatureType: 'vehicle (ship)', ac: 15, hp: 500 });
    expect(galeere.relations?.find((r) => r.type === 'inLayer')?.to).toBe(buchEbeneId('GoS'));
    expect(prosa(galeere)).toContain('**Crew:** 80');
    const deck = finde(es, 'Table', 'Deck of Many Things');
    expect(deck.components['Table']).toMatchObject({ kind: 'deck', die: '1d3' });
    const karten = (deck.relations ?? []).filter((r) => r.type === 'entry');
    expect(karten.map((r) => [es.find((e) => e.id === r.to)!.name, r.props?.['weight']])).toEqual([['Vizier', undefined], ['Fool', 2]]);
    expect(finde(es, 'Rule', 'Vizier').components['Rule']).toMatchObject({ kind: 'card' });
    expect(finde(es, 'Rule', 'Armory').components['Rule']).toMatchObject({ kind: 'facility' });
    expect(prosa(finde(es, 'Rule', 'Armory'))).toContain('Level 5');
    const nick = finde(es, 'ItemProperty', 'Nick');
    expect(nick.components['Tags']).toEqual({ tags: ['mastery'] });
    expect(finde(es, 'Weapon', 'Scimitar (XPHB)').relations?.some((r) => r.type === 'hasProperty' && r.to === nick.id)).toBe(true);
    expect(finde(es, 'Weapon', 'Scimitar').relations?.some((r) => r.to === nick.id)).toBe(false);
  });

  it('lässt Kochbücher weg (T-087)', () => {
    expect(es.some((e) => e.name === 'Chef')).toBe(false);
  });

  it('besteht die Prüfung, auch als Ausschnitt für sich', () => {
    const teil = ausschnitt(es, [{ typ: 'Statblock', namen: ['Goblin'] }]);
    const arten = new Map(teil.map((e) => [e.id, e.interfaces[0]!] as const));
    for (const e of teil) expect(validateEntity(seedRegistry, e, { knownTypes: arten, stageOf: stageBases(teil) })).toEqual([]);
    expect(teil.some((e) => e.name === 'Scimitar' && e.interfaces[0] === 'Weapon')).toBe(true);
  });

  it('zerlegt den Statblock in Merkmal und Aktion mit Angriffsfeldern (§2.5)', () => {
    const goblin = finde(es, 'Statblock', 'Goblin');
    expect(goblin.components['Statblock']).toMatchObject({ size: 'small', ac: 15, hp: 7, cr: '1/4', prof: 2, creatureType: 'humanoid (goblinoid)', alignment: 'neutral evil' });
    expect(goblin.components['Proficiencies']).toMatchObject({ proficient: ['Common', 'Goblin'], expertise: ['Stealth'] });
    const teile = (goblin.relations ?? []).filter((r) => r.type === 'composedOf').map((r) => es.find((e) => e.id === r.to)!);
    expect(teile.map((t) => `${t.interfaces[0]} ${t.name}`)).toEqual(['Feature Nimble Escape', 'Action Scimitar']);
    /* Die Zahlen rechnet der Statblock (D51): +4 ist Übung 2 und DEX 14,
       also rechnet der Krummsäbel des Goblins auf DEX und nichts steht fest. */
    expect(teile[1]!.components['Action']).toMatchObject({ attack: ['melee weapon'], ability: 'dex', reach: 5, target: 'one target', damageDice: '1d6', damageType: 'slashing' });
    expect(teile[1]!.components['Action']?.['toHit']).toBeUndefined();
    const kante = goblin.relations!.find((r) => r.to === teile[1]!.id)!;
    expect(kante.props).toBeUndefined();
    expect(prosa(teile[0]!)).toBe('{CREATURE} can take the [[action-0001|Disengage]] action as a bonus action.');
    expect(goblin.relations?.some((r) => r.type === 'equips')).toBe(true);
  });

  it('legt gleichlautende Merkmale einmal an, mit dem Namen an der Kante', () => {
    const pack = es.filter((e) => e.name === 'Pack Tactics');
    expect(pack).toHaveLength(1);
    const kanten = es.flatMap((e) => (e.relations ?? []).filter((r) => r.to === pack[0]!.id).map((r) => r.props?.vars?.['CREATURE']));
    expect(kanten.sort()).toEqual(['the jackal', 'the wolf']);
    /* Der Goblin Boss ist eine Kopie des Goblins: „the goblin boss" wird
       ebenso `{CREATURE}`, also teilen beide Nimble Escape und Scimitar. */
    expect(bericht.geteilt).toMatchObject({ merkmale: 3, verwendungen: 3 });
    expect(es.filter((e) => e.name === 'Nimble Escape')).toHaveLength(1);
  });

  it('löst _copy auf und hält die Herkunft in variantOf', () => {
    const boss = finde(es, 'Statblock', 'Goblin Boss');
    expect(boss.components['Statblock']).toMatchObject({ cr: '1', prof: 2, ac: 15 });
    expect(boss.relations?.find((r) => r.type === 'variantOf')?.to).toBe(finde(es, 'Statblock', 'Goblin').id);
    expect(boss.components['Source']).toMatchObject({ publication: 'MM', page: '166' });
  });

  it('macht Zauberwirken zu Feldern und casts-Kanten', () => {
    const mage = finde(es, 'Statblock', 'Mage');
    expect(mage.components['Statblock']).toMatchObject({ spellAbility: 'int', casterLevel: 9, spellSlots: [0, 0, 3] });
    expect(mage.relations?.find((r) => r.type === 'casts')).toMatchObject({ to: finde(es, 'Spell', 'Fireball').id, props: { mode: 'prepared', level: 3 } });
  });

  it('schreibt den Zauber mit Feldern, Würfeln und Verweisen', () => {
    const fb = finde(es, 'Spell', 'Fireball');
    expect(fb.components['Spell']).toMatchObject({ level: 3, school: 'evocation', castingTime: 1, rangeKind: 'point', range: 150, components: ['v', 's', 'm'], duration: 'instant', save: ['dex'], damageTypes: ['fire'], higherLevels: '+{{1d6}} per level.' });
    expect(prosa(fb)).toBe(`Takes {{8d6}} fire damage. See [[${(finde(es, 'Statblock', 'Goblin').components['Identity'] as { id: string }).id}|goblin]].`);
  });

  it('macht aus Erschöpfung einen Grundzustand mit Stufen (§2.3)', () => {
    const grund = finde(es, 'Condition', 'Exhaustion');
    const stufe2 = finde(es, 'Condition', 'Exhaustion 2');
    expect(stufe2.components['Condition']).toMatchObject({ stage: 2, recovery: 'longRestStep' });
    expect(stufe2.relations?.find((r) => r.type === 'stageOf')?.to).toBe(grund.id);
  });

  it('vereint dasselbe Klassenmerkmal auf mehreren Stufen zu einem Artikel (D50)', () => {
    const fighter = finde(es, 'Class', 'Fighter');
    const asi = es.filter((e) => e.name === 'Ability Score Improvement');
    expect(asi).toHaveLength(1);
    expect(prosa(asi[0]!)).toBe('When you reach a level that grants this feature, you can increase one ability score.');
    const stufen = (fighter.relations ?? []).filter((r) => r.type === 'grants' && r.to === asi[0]!.id).map((r) => r.props?.['level']);
    expect(stufen).toEqual([4, 6]);
    expect(fighter.components['Class']).toMatchObject({ hitDie: 10, multiclassRequirement: 'STR 13 or DEX 13', subclassTitle: 'Martial Archetype' });
    expect(fighter.components['Choices']?.['choices']).toEqual([
      { id: 'skills', kind: 'proficiency', when: 'start', count: 1, from: { values: ['Stealth'] } },
    ]);
    const champion = finde(es, 'Subclass', 'Champion');
    expect(champion.relations?.find((r) => r.type === 'subclassOf')?.to).toBe(fighter.id);
  });

  it('legt die Zusatzspalten einer Unterklasse als eigene Tabelle an (W6)', () => {
    const champion = finde(es, 'Subclass', 'Champion');
    const t = finde(es, 'Table', 'Champion Table');
    expect(champion.relations?.find((r) => r.type === 'tableFor')?.to).toBe(t.id);
    expect(t.components['Table']).toMatchObject({ columns: ['Level', 'Spells Known'] });
    const zeilen = t.components['Table']!['rows'] as { cells: string[] }[];
    expect(zeilen[0]!.cells).toEqual(['1', '—']);
    expect(zeilen[2]!.cells).toEqual(['3', '3']);
  });

  it('gibt einer Würfeltabelle Spalten, Gewichte und den Würfel', () => {
    const t = finde(es, 'Table', 'Trinkets');
    expect(t.components['Table']).toMatchObject({ die: '1d6', columns: ['d6', 'Trinket'] });
    expect((t.components['Table']!['rows'] as { weight: number }[]).map((r) => r.weight)).toEqual([3, 3]);
  });

  it('schreibt einen Bericht mit Zahlen und Auslassungen', () => {
    const md = berichtMarkdown(bericht, { artikel: es.length });
    expect(md).toContain('| `monster` | 7 | 6 Statblock | 1 |');
    expect(md).toContain('## Artikel je Ebene');
    expect(md).toContain('| Monster Manual (2025) | `XMM` | book | 2024 |');
    expect(md).toContain('**monster:** `sizeNote` 2');
    expect(md).not.toContain('| `race` |');
  });
});
