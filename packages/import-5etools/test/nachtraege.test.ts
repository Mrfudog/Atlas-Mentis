import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';

/** Ein kleiner Datenstand mit allem, was T-084 nachträgt, und einem 2024-Zugang aus T-087. */
function datenstand(): Datenstand {
  const arten = new Map<string, Knoten[]>();
  const add = (art: string, ...e: Knoten[]) => arten.set(art, [...(arten.get(art) ?? []), ...e]);
  add('background', { name: 'Acolyte', source: 'PHB', entries: ['Temple service.'] });
  add('spell', { name: 'Minor Illusion', source: 'PHB', level: 0, school: 'I', time: [{ number: 1, unit: 'action' }], entries: ['An image.'] });
  add('cult', { name: 'Cult of Baalzebul', source: 'MTF', type: 'Diabolical', entries: ['Hope.'], goal: { entry: 'Restoration of honor' },
    cultists: { entry: 'Any NPC who fell from grace' }, signatureSpells: { entry: '{@spell Minor illusion} (cantrip)' } });
  add('boon', { name: 'Demonic Boon of Baphomet', source: 'MTF', type: 'Demonic', entries: ['A boon.'], abilityEntry: 'Up to +4 Strength',
    signatureSpells: { entry: '{@spell minor illusion} (cantrip)' } });
  add('class', { name: 'Barbarian', source: 'PHB', hd: { number: 1, faces: 12 }, proficiency: ['str', 'con'] });
  add('baseitem',
    { name: 'Shield', source: 'PHB', type: 'S', ac: 2, armor: true, weight: 6, value: 1000, entries: ['A shield.'] },
    { name: 'Longsword', source: 'PHB', type: 'M', weaponCategory: 'martial', dmg1: '1d8', dmgType: 'S', weapon: true, sword: true, value: 1500, weight: 3 },
    { name: 'Net', source: 'PHB', type: 'R', weaponCategory: 'martial', weapon: true, net: true },
  );
  add('magicvariant', {
    name: '+1 Weapon', type: 'GV|DMG', requires: [{ weapon: true }], excludes: { net: true },
    inherits: { namePrefix: '+1 ', source: 'DMG', page: 213, rarity: 'uncommon', bonusWeapon: '+1', entries: ['A {=bonusWeapon} {=baseName/l}.'] },
  });
  add('table', { name: '10 gp Gemstones', source: 'DMG', colLabels: ['d6', 'Stone'], rows: [['1-6', 'Azurite']] });
  add('gems', { name: '10 gp Gemstones', source: 'DMG', type: 10, table: ['Azurite'] });
  add('magicItems', { name: 'Magic Item Table A', source: 'DMG', type: 'A', table: [{ min: 1, max: 100, item: '{@item +1 longsword}' }] });
  add('monster',
    { name: 'Grung', source: 'VGM', cr: '1/4', dex: 14, trait: [{ name: 'Poisonous Skin', entries: ['Poison.'] }],
      _versions: [{ name: 'Grung (Blue)', source: 'VGM', _mod: { trait: { mode: 'replaceArr', replace: 'Poisonous Skin', items: { name: 'Poisonous Skin', entries: ['Blue poison.'] } } } }] },
    { name: 'Goblin Warrior', source: 'XMM', cr: '1/4', dex: 15 },
  );
  {
    add('lifeBackground', { name: 'Acolyte', source: 'PHB', reasons: ['I ran away.', 'My family gave me.'] });
    add('lifeClass', { name: 'Barbarian', source: 'PHB', reasons: ['Devotion.'], other: { 'Personal Totems': ['None', 'A tuft of fur', 'Three feathers'] } });
    add('hoard', { name: 'Challenge 0-4', source: 'DMG', page: 137, crMin: 0, crMax: 4, coins: { cp: '6d6*100' },
      table: [{ min: 1, max: 6 }, { min: 7, max: 100, gems: { type: 10, amount: '2d6' }, magicItems: [{ type: 'A', amount: '1d6' }] }] });
    add('dragonMundaneItems', { min: 1, max: 100, item: 'A painting' });
  }
  return {
    arten,
    quellen: new Map([
      ['phb', { id: 'PHB', name: "Player's Handbook", published: '2014-08-19', art: 'book' }],
      ['dmg', { id: 'DMG', name: "Dungeon Master's Guide", published: '2014-12-09', art: 'book' }],
      ['vgm', { id: 'VGM', name: "Volo's Guide to Monsters", published: '2016-11-15', art: 'book' }],
      ['xmm', { id: 'XMM', name: 'Monster Manual (2025)', published: '2025-02-18', art: 'book' }],
      ['mtf', { id: 'MTF', name: "Mordenkainen's Tome of Foes", published: '2018-05-29', art: 'book' }],
      ['xge', { id: 'XGE', name: "Xanathar's Guide to Everything", published: '2017-11-21', art: 'book' }],
      ['ftd', { id: 'FTD', name: "Fizban's Treasury of Dragons", published: '2021-10-26', art: 'book' }],
    ]),
  };
}

const finde = (es: Entity[], typ: string, name: string) => es.find((e) => e.interfaces[0] === typ && e.name === name)!;
const nummer = (e: Entity) => (e.components['Identity'] as { id: string }).id;
const zeilen = (e: Entity) => (e.components['Table'] as { rows: { cells: string[]; text: string; weight?: number }[] }).rows;

describe('Nachträge aus 5e.tools (T-084)', () => {
  const { datei } = lauf(datenstand());
  const es = datei.entities;
  const additions = new Set(datei.additions);

  it('legt die Lebenstabellen an und hängt sie an Hintergrund und Klasse', () => {
    const gruende = finde(es, 'Table', 'Acolyte Reasons');
    expect(gruende.components['Source']).toMatchObject({ publication: 'XGE' });
    expect(zeilen(gruende).map((z) => z.text)).toEqual(['I ran away.', 'My family gave me.']);
    expect(gruende.components['Table']).toMatchObject({ die: '1d2' });
    const bg = finde(es, 'Background', 'Acolyte');
    expect(bg.relations?.some((r) => r.type === 'tableFor' && r.to === gruende.id)).toBe(true);
    /* Den Eintrag „None" setzt erst der Generator von 5e.tools davor. */
    const totems = finde(es, 'Table', 'Barbarian: Personal Totems');
    expect(zeilen(totems).map((z) => z.text)).toEqual(['A tuft of fur', 'Three feathers']);
    expect(finde(es, 'Class', 'Barbarian').relations?.filter((r) => r.type === 'tableFor')).toHaveLength(2);
  });

  it('schreibt den verschachtelten Wurf eines Horts als Verweis in die Zeile (REQ-186)', () => {
    const hort = finde(es, 'Table', 'Treasure Hoard: Challenge 0–4');
    const gems = finde(es, 'Table', '10 gp Gemstones');
    const a = finde(es, 'Table', 'Magic Item Table A');
    const [leer, voll] = zeilen(hort);
    expect(leer).toMatchObject({ cells: ['1–6', '—', '—'], weight: 6 });
    expect(voll!.cells[1]).toBe(`{{2d6}} × [[${nummer(gems)}|10 gp Gemstones]]`);
    expect(voll!.cells[2]).toBe(`{{1d6}} × [[${nummer(a)}|Magic Item Table A]]`);
    const prosa = JSON.stringify(hort.components['Prose']);
    expect(prosa).toContain('{{6d6}} × 100 cp');
    expect(finde(es, 'Table', 'Dragon Hoard: Mundane Items').components['Source']).toMatchObject({ publication: 'FTD' });
  });

  it('schreibt die Spielarten als Variante ihres Eintrags aus', () => {
    const grung = finde(es, 'Statblock', 'Grung');
    const blau = finde(es, 'Statblock', 'Grung (Blue)');
    expect(blau.relations?.some((r) => r.type === 'variantOf' && r.to === grung.id)).toBe(true);
    expect(blau.components['Abilities']).toMatchObject({ dex: 14 });
  });

  it('legt +N-Gegenstände nur an, wo ein Text sie nennt', () => {
    const plus = finde(es, 'Weapon', '+1 Longsword');
    expect(plus.relations?.some((r) => r.type === 'variantOf' && r.to === finde(es, 'Weapon', 'Longsword').id)).toBe(true);
    expect(plus.components['Item']).toMatchObject({ bonusWeapon: 1, rarity: 'uncommon' });
    expect(JSON.stringify(plus.components['Prose'])).toContain('A +1 longsword.');
    /* Niemand nennt „+1 Net" — und das Netz schliesst die Variante aus. */
    expect(es.some((e) => e.name === '+1 Net' || e.name === '+1 Shield')).toBe(false);
    /* Die Tabelle des Grundstands sieht den Nachtrag nicht: ihr Text bleibt, wie er auf dev steht. */
    expect(zeilen(finde(es, 'Table', 'Magic Item Table A'))[0]!.text).toBe('+1 longsword');
  });

  it('zählt die Nachträge hinter Grundstand und T-087 und nennt sie als Neuzugänge', () => {
    const ohne = lauf(datenstand(), { ohneNachtrag: true }).datei.entities;
    const vorher = new Map(ohne.map((e) => [e.id, nummer(e)]));
    for (const e of es) if (vorher.has(e.id)) expect(nummer(e), e.name).toBe(vorher.get(e.id));
    const neu = es.filter((e) => !vorher.has(e.id));
    expect(neu.map((e) => e.name)).toEqual(expect.arrayContaining(['Acolyte Reasons', 'Grung (Blue)', '+1 Longsword', 'Treasure Hoard: Challenge 0–4']));
    for (const e of neu) expect(additions.has(e.id), e.name).toBe(true);
    /* Der 2024-Zugang aus T-087 behält seine Nummer vor dem Nachtrag. */
    const warrior = Number(nummer(finde(es, 'Statblock', 'Goblin Warrior')).split('-')[1]);
    expect(Number(nummer(finde(es, 'Statblock', 'Grung (Blue)')).split('-')[1])).toBeGreaterThan(warrior);
  });

  it('liest Ziel, Anhänger und Signaturzauber eines Kults und eines Segens', () => {
    const zauber = finde(es, 'Spell', 'Minor Illusion');
    const kult = finde(es, 'Faction', 'Cult of Baalzebul');
    expect(kult.components['Faction']).toMatchObject({ goal: 'Restoration of honor' });
    const text = JSON.stringify(kult.components['Prose']);
    expect(text).toContain('Any NPC who fell from grace');
    expect(text).toContain('## Signature Spells');
    expect(kult.relations?.some((r) => r.type === 'casts' && r.to === zauber.id)).toBe(true);
    const segen = finde(es, 'Rule', 'Demonic Boon of Baphomet');
    expect(segen.relations?.some((r) => r.type === 'casts' && r.to === zauber.id)).toBe(true);
    expect(JSON.stringify(segen.components['Prose'])).toContain('Up to +4 Strength');
  });
});
