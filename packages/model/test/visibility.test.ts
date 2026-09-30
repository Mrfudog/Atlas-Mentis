import { describe, expect, it } from 'vitest';
import { articleVisible, tableRole } from '../src/visibility.js';
import type { Entity, EntityId } from '../src/types.js';

/* Ein Tisch: zwei Spielerinnen in einer Gruppe, ein Zuschauer, und ein
   Konto ohne Figur (das gibt es — ein Zugang, dem noch nichts zugeteilt
   wurde). */
const welt: [EntityId, Entity][] = [
  {
    id: 'pc_sela',
    name: 'Sela',
    interfaces: ['PlayerCharacter'],
    components: { Access: { role: 'player' } },
    relations: [{ id: 's1', type: 'memberOfParty', to: 'pa_wacht' }],
  },
  {
    id: 'pc_rook',
    name: 'Rook',
    interfaces: ['PlayerCharacter'],
    components: { Access: { role: 'player' } },
    relations: [{ id: 'r1', type: 'memberOfParty', to: 'pa_wacht' }],
  },
  {
    id: 'npc_gast',
    name: 'Gast',
    interfaces: ['Creature'],
    components: { Access: { role: 'spectator' } },
  },
  { id: 'pa_wacht', name: 'Nebelwacht', interfaces: ['Party'] },
  { id: 'npc_baron', name: 'Baron', interfaces: ['Creature'] },
].map((e) => [e.id, e as Entity]);

const entities = new Map<EntityId, Entity>(welt);

/** Ein Artikel mit genau dieser Sichtbarkeitskarte. */
function artikel(vis?: Record<string, unknown>): Entity {
  return {
    id: 'npc_baron',
    name: 'Baron',
    interfaces: ['Creature'],
    ...(vis ? { components: { Visibility: vis } } : {}),
  } as Entity;
}

describe('tableRole', () => {
  it('reads Access.role from the figure', () => {
    expect(tableRole(entities, 'pc_sela')).toBe('player');
    expect(tableRole(entities, 'npc_gast')).toBe('spectator');
  });

  /* Ein Konto ohne Figur gehört nicht an den Tisch — es hat noch keinen
     Platz, und das ist etwas anderes als ein Zuschauer. */
  it('gives no role to an account without a figure', () => {
    expect(tableRole(entities, [])).toBe(null);
    expect(tableRole(entities, 'npc_baron')).toBe(null);
  });

  /* Wer zwei Figuren führt, gilt als die stärkere: eine Seite, die ihm den
     Spielerblick vorenthält, weil er auch einen Zuschauerplatz hält,
     zwingt ihn zum Umschalten und sonst zu nichts. */
  it('takes the strongest role of several figures', () => {
    expect(tableRole(entities, ['npc_gast', 'pc_sela'])).toBe('player');
  });
});

describe('articleVisible', () => {
  /* Die Leitung ist `undefined` und nicht die leere Liste. */
  it('shows everything to the GM', () => {
    expect(articleVisible(entities, artikel({ audience: 'gm' }))).toBe(true);
  });

  it('treats an unclassified article as public', () => {
    expect(articleVisible(entities, artikel(), 'pc_sela')).toBe(true);
    expect(articleVisible(entities, artikel({}), 'pc_sela')).toBe(true);
    expect(articleVisible(entities, artikel({ audience: 'public' }), [])).toBe(true);
  });

  it('narrows from outside in', () => {
    const stufen = ['public', 'campaign', 'players', 'gm'];
    const zeile = (wer: EntityId | readonly EntityId[]): string =>
      stufen.map((a) => (articleVisible(entities, artikel({ audience: a }), wer) ? '1' : '0')).join('');
    expect(zeile('pc_sela')).toBe('1110');
    expect(zeile('npc_gast')).toBe('1100');
    expect(zeile([])).toBe('1000');
  });

  /* `revealedTo` war bis hierher nie gelesen — eine Freigabe, die nichts
     tat. Jetzt schlägt sie die Stufe, und nur für den, den sie nennt. */
  it('lets revealedTo beat the step, for whom it names', () => {
    const e = artikel({ audience: 'gm', revealedTo: ['pc_sela'] });
    expect(articleVisible(entities, e, 'pc_sela')).toBe(true);
    expect(articleVisible(entities, e, 'pc_rook')).toBe(false);
  });

  /* Das Verbot gewinnt: es ist die Ausnahme, die jemand von Hand
     eingetragen hat. */
  it('lets hiddenFrom beat revealedTo', () => {
    const e = artikel({ audience: 'public', revealedTo: ['pc_sela'], hiddenFrom: ['pc_sela'] });
    expect(articleVisible(entities, e, 'pc_sela')).toBe(false);
    expect(articleVisible(entities, e, 'pc_rook')).toBe(true);
  });

  /* Ein Träger ist einen Schritt weit auch seine Gruppe — dieselbe Regel
     wie beim Wissen, und aus demselben Grund nicht transitiv. */
  it('counts the party as a holder', () => {
    const e = artikel({ hiddenFrom: ['pa_wacht'] });
    expect(articleVisible(entities, e, 'pc_sela')).toBe(false);
    expect(articleVisible(entities, e, 'pc_rook')).toBe(false);
    expect(articleVisible(entities, e, 'npc_gast')).toBe(true);
  });
});
