import { describe, expect, it } from 'vitest';
import { plainText } from '@nw/model';
import { platzhalter, selbst, vorlagenwerte } from '../src/arten/monster.js';

/* Die Fälle stammen aus dem vollen Bestand (W1): wer darf `{CREATURE}`
   werden, und liest der Text danach noch wie im Buch? */
const ersetze = (text: string, monster: Record<string, unknown>) => platzhalter(text, selbst(monster));

/** Der Text, wie er mit der Bindung an der Kante gelesen wird. */
const gelesen = (r: { text: string; wort?: string }) =>
  plainText(r.text, { reference: r.wort ? { CREATURE: r.wort } : {} });

describe('platzhalter: {CREATURE} trägt den Artikel', () => {
  it('nimmt „the" und Wörter aus dem Kreaturtyp, die weder erstes noch letztes Namenswort sind', () => {
    const r = ersetze('The dragon can breathe air and water.', { name: 'Black Dragon Wyrmling', type: 'dragon' });
    expect(r).toEqual({ text: '{CREATURE} can breathe air and water.', wort: 'the dragon' });
    expect(gelesen(r)).toBe('The dragon can breathe air and water.');
  });

  it('nimmt die längste Folge aus dem Namen und lässt Füllwörter am Ende weg', () => {
    expect(ersetze('If the guard drake dies, the drake drops.', { name: 'Black Guard Drake', type: 'dragon' }).wort).toBe(
      'the guard drake',
    );
    expect(ersetze('The swarm of bats can occupy …', { name: 'Swarm of Rats', type: { type: 'beast', swarmSize: 'T' } }).wort).toBe(
      'the swarm',
    );
    expect(ersetze('The giant can …', { name: 'Storm Giant Quintessent', type: 'giant' }).wort).toBe('the giant');
  });

  it('setzt einen Namen je Text ein, und jedes Vorkommen davon', () => {
    const r = ersetze('The goblin swaps places; the boss stays. Then the goblin hides.', { name: 'Goblin Boss', type: 'humanoid' });
    expect(r.text).toBe('{CREATURE} swaps places; the boss stays. Then {CREATURE} hides.');
    expect(gelesen(r)).toBe('The goblin swaps places; the boss stays. Then the goblin hides.');
  });

  it('erkennt benannte Kreaturen ohne Artikel, auch an einem Teil des Namens', () => {
    const venomfang = { name: 'Venomfang', isNamedCreature: true, type: 'dragon' };
    expect(ersetze('Venomfang can breathe air and water.', venomfang)).toEqual({
      text: '{CREATURE} can breathe air and water.',
      wort: 'Venomfang',
    });
    expect(ersetze('Gar can breathe air and water.', { name: 'Gar Shatterkeel', isNamedCreature: true }).wort).toBe('Gar');
    expect(ersetze('Magical darkness doesn’t impede Serissa’s darkvision.', { name: 'Princess Serissa', isNamedCreature: true }).text).toBe(
      'Magical darkness doesn’t impede {CREATURE}’s darkvision.',
    );
    /* Die ganze Folge, nicht ihr Anfang: „Wei Feng" ist einer. */
    expect(ersetze('Wei Feng has advantage.', { name: 'Wei Feng Ying', isNamedCreature: true }).wort).toBe('Wei Feng');
  });

  it('nimmt Eigennamen nur bei benannten Kreaturen', () => {
    expect(ersetze('Goblin tribes fear it.', { name: 'Goblin', type: 'humanoid' }).wort).toBeUndefined();
  });

  it('nimmt Grossgeschriebenes nach „the" nur, wie der Name es schreibt', () => {
    const vampir = { name: 'Vampire', type: { type: 'undead', tags: ['shapechanger'] } };
    expect(ersetze('If the vampire is not in its coffin, it uses the Shapechanger trait.', vampir).wort).toBe('the vampire');
    expect(ersetze('The Scarlet Sentinel has advantage.', { name: 'Scarlet Sentinel', type: 'construct' }).wort).toBe(
      'The Scarlet Sentinel',
    );
    /* Ein Titel behält seinen Artikel, wie er dasteht. */
    const abt = ersetze('When The Abbot hits, The Abbot heals.', { name: 'The Abbot', type: 'celestial' });
    expect(gelesen(abt)).toBe('When The Abbot hits, The Abbot heals.');
  });

  it('bricht beim Genitiv ab und lässt Verweise und Würfel stehen', () => {
    const r = ersetze('The dragon’s breath hits [[statblock-0012|Adult Black Dragon]] for {{2d6}}.', {
      name: 'Black Dragon Wyrmling',
      type: 'dragon',
    });
    expect(r.text).toBe('{CREATURE}’s breath hits [[statblock-0012|Adult Black Dragon]] for {{2d6}}.');
  });

  it('lässt einen Text ohne den Namen, wie er ist', () => {
    expect(ersetze('The target must succeed on a saving throw.', { name: 'Goblin', type: 'humanoid' })).toEqual({
      text: 'The target must succeed on a saving throw.',
    });
  });
});

describe('vorlagenwerte: was 5e.tools in Vorlagen offen lässt', () => {
  const drow = { name: 'Drow Acolyte', cr: '1/4', con: 14, wis: 13, str: 10 };
  it('setzt den kurzen Namen mit Artikel und die Zahlen dieses Statblocks ein', () => {
    expect(vorlagenwerte('<$title_short_name$> has advantage; <$short_name$> hides.', drow)).toBe(
      'The drow acolyte has advantage; the drow acolyte hides.',
    );
    expect(vorlagenwerte('DC <$dc__con$> or <$spell_dc__wis$>, <$to_hit__str$> to hit, <$wis_mod$>', drow)).toBe(
      'DC 12 or 11, +2 to hit, +1',
    );
  });

  it('nimmt bei benannten Kreaturen den Namen ohne Artikel', () => {
    expect(vorlagenwerte('<$title_short_name$> can …', { name: 'Asha Vandree', isNamedCreature: true, shortName: 'Asha' })).toBe(
      'Asha can …',
    );
  });
});
