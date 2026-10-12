import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { attackLine, attackNumbers } from '@nw/model';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';
import { zerlegeAngriff } from '../src/arten/angriff.js';

describe('Den Angriffssatz zerlegen (D51)', () => {
  it('liest Sorte, Treffer, Reichweite, Ziel, Würfel, Bonus und Art', () => {
    expect(zerlegeAngriff(['{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}7 ({@damage 2d4 + 2}) piercing damage.'])).toMatchObject({
      sorten: ['melee weapon'], treffer: 4, reach: 5, ziel: 'one target', wuerfel: '2d4', flach: 2, schadensart: 'piercing', rest: [],
    });
  });

  it('nimmt Zusatzschaden als Feld und den Rest als Satz', () => {
    const z = zerlegeAngriff(['{@atk mw} {@hit 6} to hit, reach 10 ft., one creature. {@h}9 ({@damage 1d10 + 4}) piercing damage plus 7 ({@damage 2d6}) poison damage. The target is {@condition grappled}.'])!;
    expect(z.zusatz).toEqual({ wuerfel: '2d6', art: 'poison' });
    expect(z.rest).toEqual(['The target is {@condition grappled}.']);
  });

  it('liest Nah- und Fernkampf zusammen', () => {
    expect(zerlegeAngriff(['{@atk mw,rw} {@hit 4} to hit, reach 5 ft. or range 20/60 ft., one target. {@h}4 ({@damage 1d4 + 2}) piercing damage.'])).toMatchObject({
      sorten: ['melee weapon', 'ranged weapon'], reach: 5, range: '20/60', ziel: 'one target',
    });
  });

  it('lässt anders gebaute Sätze als Text stehen', () => {
    expect(zerlegeAngriff(['{@atk mw} {@hit 0} to hit, reach 5 ft., one target. {@h}1 piercing damage.'])).toBeNull();
    expect(zerlegeAngriff(['{@atk mw} {@hit 3} to hit, reach 5 ft., one target. {@h}3 ({@damage 1d4 + 1}) bludgeoning or slashing damage.'])).toBeNull();
  });
});

function datenstand(): Datenstand {
  const biss = (hit: number, dmg: string, avg: number, rest = '') =>
    ({ name: 'Bite', entries: [`{@atk mw} {@hit ${hit}} to hit, reach 5 ft., one target. {@h}${avg} ({@damage ${dmg}}) piercing damage.${rest}`] });
  const monster: Knoten[] = [
    /* Wolf: Übung 2, DEX 15 — der Biss rechnet im Buch auf DEX. */
    { name: 'Wolf', source: 'MM', cr: '1/4', str: 12, dex: 15, action: [biss(4, '2d4 + 2', 7, ' If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked {@condition prone}.')] },
    /* Hai: Übung 2, STR 17 — derselbe Biss auf STR, andere Würfel, kein Satz. */
    { name: 'Reef Shark', source: 'MM', cr: '1/2', str: 14, dex: 13, action: [biss(4, '1d8 + 2', 6)] },
    { name: 'Hunter Shark', source: 'MM', cr: '2', str: 18, dex: 13, action: [biss(6, '2d8 + 4', 13)] },
    /* Ein Buchmonster mit Sonderwert: +7, wo die Rechnung +6 ergäbe. */
    { name: 'Odd Beast', source: 'MM', cr: '2', str: 18, dex: 10, action: [biss(7, '2d8 + 4', 13)] },
    { name: 'Orc', source: 'MM', cr: '1/2', str: 16, dex: 12, type: { type: 'humanoid', tags: ['orc'] }, trait: [{ name: 'Aggressive', entries: ['As a bonus action, the orc can move up to its speed toward a hostile creature that it can see.'] }] },
    /* Ein Tier mit einem gleichnamigen Merkmal und anderem Text: kein Ork,
       also keine Herkunft bei den Halb-Orks. */
    { name: 'Crocodile', source: 'MM', cr: '1/2', str: 15, dex: 10, type: 'beast', trait: [{ name: 'Aggressive', entries: ['The crocodile charges.'] }] },
  ];
  const arten = new Map<string, Knoten[]>([
    ['monster', monster],
    ['race', [{ name: 'Half-Orc', source: 'PHB', size: ['M'], speed: 30, entries: [{ type: 'entries', name: 'Aggressive', entries: ['As a bonus action, you can move toward an enemy.'] }] }]],
    ['condition', [{ name: 'Prone', source: 'PHB', entries: ['Down.'] }]],
  ]);
  return { arten, quellen: new Map([['mm', { id: 'MM', name: 'MM', published: '2014-09-30', art: 'book' }], ['phb', { id: 'PHB', name: 'PHB', published: '2014-08-19', art: 'book' }]]) };
}

const finde = (es: Entity[], typ: string, name: string) => es.find((e) => e.interfaces[0] === typ && e.name === name)!;

describe('Angriffe der Statblöcke, einer für alle (D51)', () => {
  const { datei, bericht } = lauf(datenstand());
  const es = datei.entities;
  const kanteVon = (sb: string) => {
    const s = finde(es, 'Statblock', sb);
    const r = s.relations!.find((x) => x.type === 'composedOf' && es.find((e) => e.id === x.to)?.name === 'Bite')!;
    return { s, r, a: es.find((e) => e.id === r.to)! };
  };

  it('legt einen Biss für alle an, mit den Vorgaben des häufigsten Falls', () => {
    expect(es.filter((e) => e.name === 'Bite')).toHaveLength(1);
    const { a } = kanteVon('Wolf');
    expect(a.components['Action']).toMatchObject({ attack: ['melee weapon'], damageType: 'piercing', reach: 5, target: 'one target', damageDice: '2d8' });
    expect(bericht.angriffe).toMatchObject({ artikel: 1, verwendungen: 4 });
  });

  it('rechnet an jedem Statblock die Buchzahl nach — und die Kante trägt nur, was abweicht', () => {
    for (const [sb, buch] of [['Wolf', [4, '2d4 + 2']], ['Reef Shark', [4, '1d8 + 2']], ['Hunter Shark', [6, '2d8 + 4']], ['Odd Beast', [7, '2d8 + 4']]] as const) {
      const { s, r, a } = kanteVon(sb);
      const n = attackNumbers(a.components['Action'], { ...s.components['Abilities'], ...s.components['Statblock'] }, r.props ?? {})!;
      expect([sb, n.toHit, n.damage]).toEqual([sb, ...buch]);
    }
    expect(kanteVon('Hunter Shark').r.props).toBeUndefined();
    expect(kanteVon('Wolf').r.props).toMatchObject({ ability: 'dex', damageDice: '2d4' });
  });

  it('hält die Buchzahl fest, wo die Rechnung etwas anderes ergäbe, und sagt es', () => {
    const { s, r, a } = kanteVon('Odd Beast');
    expect(r.props).toEqual({ toHit: 7 });
    const n = attackNumbers(a.components['Action'], { ...s.components['Abilities'], ...s.components['Statblock'] }, r.props)!;
    expect(n).toMatchObject({ toHitFixed: true, toHitComputed: 6 });
    expect(bericht.angriffe.buchTreffer).toBe(1);
  });

  it('stellt den Satz, den nur einer hat, an seine Kante', () => {
    const { s, r, a } = kanteVon('Wolf');
    expect(r.props?.['note']).toMatch(/knocked \[\[condition-\d+\|prone\]\]\.$/);
    expect(a.components['Prose']).toBeUndefined();
    const n = attackNumbers(a.components['Action'], { ...s.components['Abilities'], ...s.components['Statblock'] }, r.props)!;
    expect(attackLine(n)).toBe('*Melee Weapon Attack:* {{+4}} to hit, reach 5 ft., one target. *Hit:* 7 ({{2d4 + 2}}) piercing damage.');
  });

  it('zeigt vom Merkmal auf das Volksmerkmal, wenn ein Träger zu dem Volk gehört', () => {
    const volksmerkmal = es.find((e) => e.name === 'Aggressive' && e.components['Feature']?.['featureType'] === 'ancestry')!;
    const ork = es.find((e) => e.name === 'Aggressive' && e.components['Prose'] && JSON.stringify(e.components['Prose']).includes('{CREATURE}'))!;
    expect(ork.relations?.find((r) => r.type === 'variantOf')?.to).toBe(volksmerkmal.id);
    const krokodil = es.find((e) => e.name === 'Aggressive' && JSON.stringify(e.components['Prose'] ?? '').includes('charges'))!;
    expect(krokodil.relations?.some((r) => r.type === 'variantOf')).toBe(false);
    expect(bericht.herkunft).toBe(1);
  });
});
