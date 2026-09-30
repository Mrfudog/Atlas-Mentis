import { describe, expect, it } from 'vitest';
import {
  articleVisible,
  campaignOf,
  campaignsOf,
  gmAccounts,
  leadsCampaign,
  tableRole,
} from '../src/visibility.js';
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

  /* Zwei Runden auf einer Installation, jede mit ihrer Leitung. Sie teilen
     das Grundregelwerk und haben je eine eigene Ebene — daran hängt die
     ganze Frage, wem ein Artikel gehört. */
  { id: 'ly_system', name: 'Grundregelwerk', interfaces: ['Layer'] },
  { id: 'ly_nebel', name: 'Ebene: Nebelwacht', interfaces: ['Layer'] },
  { id: 'ly_salz', name: 'Ebene: Salzpfad', interfaces: ['Layer'] },
  {
    id: 'camp_nebel',
    name: 'Aus Nebel wacht',
    interfaces: ['Campaign'],
    components: { Access: { role: 'gm', userIds: ['u_basil'] } },
    relations: [
      { id: 'a1', type: 'activates', to: 'ly_system' },
      { id: 'a2', type: 'activates', to: 'ly_nebel' },
    ],
  },
  {
    id: 'camp_salz',
    name: 'Der Salzpfad',
    interfaces: ['Campaign'],
    components: { Access: { role: 'gm', userIds: ['u_mira'] } },
    relations: [
      { id: 'b1', type: 'activates', to: 'ly_system' },
      { id: 'b2', type: 'activates', to: 'ly_salz' },
    ],
  },
].map((e) => [e.id, e as Entity]);

const entities = new Map<EntityId, Entity>(welt);

/** Ein Artikel mit genau dieser Sichtbarkeitskarte, wahlweise in Ebenen. */
function artikel(vis?: Record<string, unknown>, ebenen?: string[]): Entity {
  return {
    id: 'npc_baron',
    name: 'Baron',
    interfaces: ['Creature'],
    ...(vis ? { components: { Visibility: vis } } : {}),
    ...(ebenen
      ? { relations: ebenen.map((l, i) => ({ id: `l${i}`, type: 'inLayer', to: l })) }
      : {}),
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

  /* Eine Leitung hat keine Figur — ihre Rolle steht an der Kampagne. */
  it('reads gm from the campaign, not from a figure', () => {
    expect(tableRole(entities, { user: 'u_basil' })).toBe('gm');
    expect(tableRole(entities, { user: 'u_fremd' })).toBe(null);
    expect(tableRole(entities, { actors: ['pc_sela'], user: 'u_basil' })).toBe('gm');
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

  /* Eine Leitung sieht jede Stufe darunter mit — ohne das wäre ein Artikel
     „für die Spielenden" vor ihr verborgen, und das ist Unsinn. */
  it('lets the campaign lead through every step below', () => {
    const stufen = ['public', 'campaign', 'players', 'gm'];
    const zeile = stufen
      .map((a) => (articleVisible(entities, artikel({ audience: a }), { user: 'u_basil' }) ? '1' : '0'))
      .join('');
    expect(zeile).toBe('1111');
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

/* ---------------------------------------------------------------------
   Wem ein Artikel gehört, sagt die Ebene. Eine Ebene, die genau eine
   Kampagne aufschaltet, gehört ihr; eine, die mehrere aufschalten, ist
   gemeinsam. Kein Feld sagt es — ein Feld, das gleichzeitig Regel ist,
   leckt beim ersten Tippfehler.
   --------------------------------------------------------------------- */
describe('wem ein Artikel gehört', () => {
  it('reads the owners off the layers, not off a field', () => {
    expect([...(campaignsOf(entities, artikel(undefined, ['ly_nebel'])) ?? [])])
      .toEqual(['camp_nebel']);
    expect([...(campaignsOf(entities, artikel(undefined, ['ly_system'])) ?? [])].sort())
      .toEqual(['camp_nebel', 'camp_salz']);
  });

  /* Ohne Ebenenkante sagt der Stapel nichts — das ist heute der Normalfall
     („ohne Ebene gehört er der Kampagne und ist immer da"), und mit zwei
     Kampagnen braucht jede ihre eigene Ebene. Eine eigene Entscheidung. */
  it('says nothing about an article with no layer', () => {
    expect(campaignsOf(entities, artikel())).toBe(null);
    expect(campaignOf(entities, artikel())).toBe(undefined);
  });

  /* Eine Ebene, die den Artikel herausnimmt, bringt ihn nicht mit und
     besitzt ihn nicht. */
  it('does not count a layer that removes the article', () => {
    const e = {
      ...artikel(undefined, ['ly_nebel']),
      relations: [{ id: 'x', type: 'inLayer', to: 'ly_nebel', props: { mode: 'removes' } }],
    } as Entity;
    expect(campaignsOf(entities, e)).toBe(null);
  });

  it('names the lead accounts of a campaign', () => {
    expect([...gmAccounts(entities.get('camp_nebel'))]).toEqual(['u_basil']);
    /* Eine Karte ohne `gm` ist keine Leitung — an einer Figur steht
       dieselbe Karte und meint etwas anderes. */
    expect([...gmAccounts(entities.get('pc_sela'))]).toEqual([]);
    expect(leadsCampaign(entities, 'u_basil', 'camp_nebel')).toBe(true);
    expect(leadsCampaign(entities, 'u_basil', 'camp_salz')).toBe(false);
    expect(leadsCampaign(entities, 'u_basil')).toBe(true);
    expect(leadsCampaign(entities, undefined)).toBe(false);
  });
});

/* Und die Regel, um die es geht. */
describe('audience gm, je Kampagne', () => {
  const basil = { user: 'u_basil' };
  const mira = { user: 'u_mira' };

  it('keeps a campaign layer with that campaign’s lead', () => {
    const e = artikel({ audience: 'gm' }, ['ly_nebel']);
    expect(articleVisible(entities, e, basil)).toBe(true);
    expect(articleVisible(entities, e, mira)).toBe(false);
  });

  /* Ein Grundregelwerk, das beide Runden aufschalten, gehört keiner davon —
     seine Spielleitungshinweise vor der anderen zu verbergen wäre eine
     Sperre ohne Grund. */
  it('shows a shared layer to every lead', () => {
    const e = artikel({ audience: 'gm' }, ['ly_system']);
    expect(articleVisible(entities, e, basil)).toBe(true);
    expect(articleVisible(entities, e, mira)).toBe(true);
  });

  /* Ohne Ebene ist er keiner Runde zuzuordnen: dann gilt dasselbe wie für
     die geteilte Ebene. Das ist genau das heutige Verhalten. */
  it('falls back to every lead when no layer says otherwise', () => {
    const e = artikel({ audience: 'gm' });
    expect(articleVisible(entities, e, basil)).toBe(true);
    expect(articleVisible(entities, e, mira)).toBe(true);
  });

  it('keeps it from a player either way', () => {
    for (const ebenen of [undefined, ['ly_nebel'], ['ly_system']]) {
      expect(articleVisible(entities, artikel({ audience: 'gm' }, ebenen), 'pc_sela')).toBe(false);
    }
  });

  /* Ein Verbot schlägt auch die Leitung: es ist die Ausnahme, die jemand
     von Hand eingetragen hat — und eine Leitung, die ihre eigene Sperre
     nicht sieht, hätte sie nicht gesetzt. */
  it('still lets hiddenFrom win', () => {
    const e = {
      ...artikel({ audience: 'gm', hiddenFrom: ['pc_sela'] }, ['ly_nebel']),
    } as Entity;
    expect(articleVisible(entities, e, { actors: ['pc_sela'], user: 'u_basil' })).toBe(false);
  });
});
