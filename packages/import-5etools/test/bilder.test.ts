import { describe, expect, it } from 'vitest';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';
import { planZahlen, tokenName, tokenPfad } from '../src/bilder.js';

/** Erfundene Einträge in der Form von 5e.tools — keine Daten von dort. */
function datenstand(): Datenstand {
  const arten = new Map<string, Knoten[]>();
  arten.set('monster', [
    { name: 'Mire Gnasher', source: 'MM', cr: '1', dex: 12, hasToken: true, hasFluffImages: true },
    { name: 'Reed Wisp', source: 'MM', cr: '1/2', dex: 16 },
    { name: 'Æther "Moth"', source: 'MM', cr: '1/8', dex: 14, hasToken: true },
    { name: 'Lantern Toad', source: 'MM', cr: '0', dex: 10, token: { name: 'Mire Gnasher', source: 'MM' } },
  ]);
  arten.set('monsterFluff', [
    { name: 'Mire Gnasher', source: 'MM', images: [
      { type: 'image', href: { type: 'internal', path: 'bestiary/MM/Mire Gnasher.webp' } },
      { type: 'image', href: { type: 'internal', path: 'bestiary/MM/Mire Gnasher Lair.webp' }, title: 'Its lair' },
      { type: 'image', href: { type: 'external', url: 'https://example.org/x.png' } },
    ] },
  ]);
  arten.set('item', [{ name: 'Reed Flute', source: 'DMG', rarity: 'common', type: 'INS' }]);
  arten.set('itemFluff', [{ name: 'Reed Flute', source: 'DMG', images: [{ type: 'image', href: { type: 'internal', path: 'items/DMG/Reed Flute.webp' } }] }]);
  return {
    arten,
    quellen: new Map([
      ['mm', { id: 'MM', name: 'Monster Manual', published: '2014-09-30', art: 'book' }],
      ['dmg', { id: 'DMG', name: "Dungeon Master's Guide", published: '2014-12-09', art: 'book' }],
    ]),
  } as Datenstand;
}

describe('the image plan (T-144)', () => {
  it('follows 5e.tools for token paths: token before tokenHref before name, and only with hasToken', () => {
    expect(tokenName('Æther "Moth"')).toBe('AEther Moth');
    expect(tokenName('Naïve Señor')).toBe('Naive Senor');
    expect(tokenPfad({ name: 'X', source: 'MM' }, 'bestiary/tokens')).toBeUndefined();
    expect(tokenPfad({ name: 'X', source: 'MM', hasToken: true }, 'bestiary/tokens')).toBe('bestiary/tokens/MM/X.webp');
    expect(tokenPfad({ name: 'X', source: 'MM', tokenHref: { type: 'internal', path: 'img/a/b.webp' } }, 'bestiary/tokens')).toBe('a/b.webp');
  });

  it('puts tokens on the statblock and the first picture into its image, the rest only into the gallery', () => {
    const { datei, bilder } = lauf(datenstand());
    const id = (name: string) => datei.entities.find((e) => e.name === name && ['Statblock', 'Item'].includes(e.interfaces[0]!))!.id;
    const von = (name: string) => bilder!.eintraege.filter((b) => b.ziel === id(name)).map((b) => [b.klasse, b.feld ?? '', b.pfad]);
    expect(von('Mire Gnasher')).toEqual([
      ['token', 'Statblock.token', 'bestiary/tokens/MM/Mire Gnasher.webp'],
      ['image', 'Image.image', 'bestiary/MM/Mire Gnasher.webp'],
      ['image', '', 'bestiary/MM/Mire Gnasher Lair.webp'],
    ]);
    expect(von('Reed Wisp')).toEqual([]);
    expect(von('Æther "Moth"')).toEqual([['token', 'Statblock.token', 'bestiary/tokens/MM/AEther Moth.webp']]);
    expect(von('Lantern Toad')).toEqual([['token', 'Statblock.token', 'bestiary/tokens/MM/Mire Gnasher.webp']]);
    expect(von('Reed Flute')).toEqual([['image', 'Image.image', 'items/DMG/Reed Flute.webp']]);
    expect(planZahlen(bilder!)).toEqual({ dateien: 5, eintraege: 6, jeKlasse: { token: 3, image: 3 }, verknuepft: 5 });
  });
});
