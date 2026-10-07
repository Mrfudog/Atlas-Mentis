import { describe, expect, it } from 'vitest';
import {
  articleVisible,
  audienceAllows,
  campaignOf,
  campaignsOf,
  tableRole,
  type Viewer,
} from '../src/visibility.js';
import type { Entity, EntityId } from '../src/types.js';

/* Zwei Runden auf einer Installation. Sie teilen das Grundregelwerk und
   haben je eine eigene Ebene — daran hängt, wem ein Artikel gehört. Die
   Rollen stehen **nicht** in den Artikeln: sie kommen mit dem Betrachter,
   wie am Server aus `campaign_member`. */
const welt: [EntityId, Entity][] = [
  {
    id: 'pc_sela',
    name: 'Sela',
    interfaces: ['PlayerCharacter'],
    relations: [
      { id: 's1', type: 'memberOfParty', to: 'pa_wacht' },
      /* Sela ist im Auge — eine Fraktion zählt als Träger wie die Gruppe. */
      { id: 's2', type: 'memberOf', to: 'f_auge', props: { rank: 'adept' } },
    ],
  },
  {
    id: 'pc_rook',
    name: 'Rook',
    interfaces: ['PlayerCharacter'],
    relations: [{ id: 'r1', type: 'memberOfParty', to: 'pa_wacht' }],
  },
  { id: 'pa_wacht', name: 'Nebelwacht', interfaces: ['Party'] },
  { id: 'f_auge', name: 'Das Auge', interfaces: ['Faction'] },
  { id: 'npc_baron', name: 'Baron', interfaces: ['Creature'] },
  { id: 'ly_system', name: 'Grundregelwerk', interfaces: ['Layer'] },
  { id: 'ly_nebel', name: 'Ebene: Nebelwacht', interfaces: ['Layer'] },
  { id: 'ly_salz', name: 'Ebene: Salzpfad', interfaces: ['Layer'] },
  {
    id: 'camp_nebel',
    name: 'Aus Nebel wacht',
    interfaces: ['Campaign'],
    relations: [
      { id: 'a1', type: 'activates', to: 'ly_system' },
      { id: 'a2', type: 'activates', to: 'ly_nebel' },
    ],
  },
  {
    id: 'camp_salz',
    name: 'Der Salzpfad',
    interfaces: ['Campaign'],
    relations: [
      { id: 'b1', type: 'activates', to: 'ly_system' },
      { id: 'b2', type: 'activates', to: 'ly_salz' },
    ],
  },
].map((e) => [e.id, e as Entity]);

const entities = new Map<EntityId, Entity>(welt);

/* Die Konten, wie sie der Server aus `app_user_actor` und `campaign_member`
   zusammensetzt. */
const sela: Viewer = { actors: ['pc_sela'], roles: { camp_nebel: 'player' } };
const rook: Viewer = { actors: ['pc_rook'], roles: { camp_nebel: 'player' } };
const gast: Viewer = { actors: [], roles: { camp_nebel: 'spectator' } };
const basil: Viewer = { roles: { camp_nebel: 'gm', camp_salz: 'player' } };
const mira: Viewer = { roles: { camp_salz: 'gm' } };
const niemand: Viewer = { actors: [] };

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
  /* Die Rolle steht am Konto, je Kampagne — eine Figur sagt nicht, in
     welcher Runde ihr Konto was ist. */
  it('reads the role in the named campaign', () => {
    expect(tableRole(basil, 'camp_nebel')).toBe('gm');
    expect(tableRole(basil, 'camp_salz')).toBe('player');
    expect(tableRole(mira, 'camp_nebel')).toBe(null);
  });

  it('takes the strongest role anywhere when no campaign is named', () => {
    expect(tableRole(basil)).toBe('gm');
    expect(tableRole(gast)).toBe('spectator');
    expect(tableRole(niemand)).toBe(null);
  });

  /* Eine blosse Figurenliste trägt keine Rolle — geraten wird nicht. */
  it('gives no role to a bare list of figures', () => {
    expect(tableRole(['pc_sela'])).toBe(null);
    expect(tableRole('pc_sela')).toBe(null);
  });

  it('ignores a role that does not exist', () => {
    expect(tableRole({ roles: { camp_nebel: 'kaiser' as never } }, 'camp_nebel')).toBe(null);
  });
});

describe('audienceAllows', () => {
  it('narrows from outside in', () => {
    const stufen = ['public', 'campaign', 'players', 'gm'] as const;
    const zeile = (r: Parameters<typeof audienceAllows>[1]): string =>
      stufen.map((a) => (audienceAllows(a, r) ? '1' : '0')).join('');
    expect(zeile('gm')).toBe('1111');
    expect(zeile('co-gm')).toBe('1111');
    expect(zeile('player')).toBe('1110');
    expect(zeile('spectator')).toBe('1100');
    expect(zeile(null)).toBe('1000');
  });
});

describe('articleVisible', () => {
  /* Die Verwaltung ist `undefined` und nicht die leere Liste. */
  it('shows everything to the installation admin', () => {
    expect(articleVisible(entities, artikel({ audience: 'gm' }))).toBe(true);
  });

  it('treats an unclassified article as public', () => {
    expect(articleVisible(entities, artikel(), niemand)).toBe(true);
    expect(articleVisible(entities, artikel({}), 'pc_sela')).toBe(true);
  });

  it('narrows from outside in for real viewers', () => {
    const stufen = ['public', 'campaign', 'players', 'gm'];
    const zeile = (wer: Viewer): string =>
      stufen.map((a) => (articleVisible(entities, artikel({ audience: a }), wer) ? '1' : '0')).join('');
    expect(zeile(sela)).toBe('1110');
    expect(zeile(gast)).toBe('1100');
    expect(zeile(niemand)).toBe('1000');
    expect(zeile(basil)).toBe('1111');
  });

  /* `revealedTo` schlägt die Stufe, und nur für den, den es nennt. */
  it('lets revealedTo beat the step, for whom it names', () => {
    const e = artikel({ audience: 'gm', revealedTo: ['pc_sela'] });
    expect(articleVisible(entities, e, sela)).toBe(true);
    expect(articleVisible(entities, e, rook)).toBe(false);
  });

  /* Das Verbot gewinnt: es ist die Ausnahme, die jemand von Hand
     eingetragen hat. */
  it('lets hiddenFrom beat revealedTo', () => {
    const e = artikel({ audience: 'public', revealedTo: ['pc_sela'], hiddenFrom: ['pc_sela'] });
    expect(articleVisible(entities, e, sela)).toBe(false);
    expect(articleVisible(entities, e, rook)).toBe(true);
  });

  /* Ein Träger ist einen Schritt weit auch seine Gruppe. */
  it('counts the party as a holder', () => {
    const e = artikel({ hiddenFrom: ['pa_wacht'] });
    expect(articleVisible(entities, e, sela)).toBe(false);
    expect(articleVisible(entities, e, rook)).toBe(false);
    expect(articleVisible(entities, e, gast)).toBe(true);
  });

  /* Und die Fraktion ebenso (A7): ihre Mitglieder sind gemeint, nicht sie. */
  it('counts the faction as a holder', () => {
    const e = artikel({ hiddenFrom: ['f_auge'] });
    expect(articleVisible(entities, e, sela)).toBe(false);
    expect(articleVisible(entities, e, rook)).toBe(true);
    const f = artikel({ audience: 'gm', revealedTo: ['f_auge'] });
    expect(articleVisible(entities, f, sela)).toBe(true);
    expect(articleVisible(entities, f, rook)).toBe(false);
  });
});

/* ---------------------------------------------------------------------
   Wem ein Artikel gehört, sagt die Ebene. Eine Ebene, die genau eine
   Kampagne aufschaltet, gehört ihr; eine, die mehrere aufschalten, ist
   gemeinsam.
   --------------------------------------------------------------------- */
describe('wem ein Artikel gehört', () => {
  it('reads the owners off the layers, not off a field', () => {
    expect([...(campaignsOf(entities, artikel(undefined, ['ly_nebel'])) ?? [])])
      .toEqual(['camp_nebel']);
    expect([...(campaignsOf(entities, artikel(undefined, ['ly_system'])) ?? [])].sort())
      .toEqual(['camp_nebel', 'camp_salz']);
  });

  it('says nothing about an article with no layer', () => {
    expect(campaignsOf(entities, artikel())).toBe(null);
    expect(campaignOf(entities, artikel())).toBe(undefined);
  });

  it('does not count a layer that removes the article', () => {
    const e = {
      ...artikel(),
      relations: [{ id: 'x', type: 'inLayer', to: 'ly_nebel', props: { mode: 'removes' } }],
    } as Entity;
    expect(campaignsOf(entities, e)).toBe(null);
  });
});

describe('die Rolle zählt in der Kampagne, der der Artikel gehört', () => {
  it('keeps a gm article in a campaign layer with that campaign’s lead', () => {
    const e = artikel({ audience: 'gm' }, ['ly_nebel']);
    expect(articleVisible(entities, e, basil)).toBe(true);
    expect(articleVisible(entities, e, mira)).toBe(false);
  });

  /* Basil leitet Nebelwacht und spielt im Salzpfad — dort ist er Spieler
     und sieht die Geheimnisse der Salzpfad-Leitung nicht. Mit der Rolle an
     einer Figur liess sich das nicht sagen. */
  it('treats the same account by its role in that campaign', () => {
    const e = artikel({ audience: 'gm' }, ['ly_salz']);
    expect(articleVisible(entities, e, basil)).toBe(false);
    expect(articleVisible(entities, e, mira)).toBe(true);
    expect(articleVisible(entities, artikel({ audience: 'players' }, ['ly_salz']), basil)).toBe(true);
  });

  /* Ein Grundregelwerk, das beide Runden aufschalten, gehört keiner davon. */
  it('shows a shared layer to every lead', () => {
    const e = artikel({ audience: 'gm' }, ['ly_system']);
    expect(articleVisible(entities, e, basil)).toBe(true);
    expect(articleVisible(entities, e, mira)).toBe(true);
  });

  it('falls back to every lead when no layer says otherwise', () => {
    const e = artikel({ audience: 'gm' });
    expect(articleVisible(entities, e, basil)).toBe(true);
    expect(articleVisible(entities, e, mira)).toBe(true);
  });

  /* Wer an der einen Runde nicht sitzt, ist dort nicht „am Tisch". */
  it('does not seat a viewer at a table they have no role at', () => {
    expect(articleVisible(entities, artikel({ audience: 'campaign' }, ['ly_nebel']), mira))
      .toBe(false);
    expect(articleVisible(entities, artikel({ audience: 'campaign' }, ['ly_nebel']), gast))
      .toBe(true);
  });

  it('keeps it from a player either way', () => {
    for (const ebenen of [undefined, ['ly_nebel'], ['ly_system']]) {
      expect(articleVisible(entities, artikel({ audience: 'gm' }, ebenen), sela)).toBe(false);
    }
  });

  /* Ein Verbot schlägt auch die Leitung. */
  it('still lets hiddenFrom win', () => {
    const e = artikel({ audience: 'gm', hiddenFrom: ['pc_sela'] }, ['ly_nebel']);
    expect(articleVisible(entities, e, { actors: ['pc_sela'], roles: { camp_nebel: 'gm' } }))
      .toBe(false);
  });
});
