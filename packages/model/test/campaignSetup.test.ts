import { describe, expect, it } from 'vitest';
import { campaignDecisions, type RuleSortState } from '../src/index.js';

/* Die Entscheidungen einer Kampagne (T-141): je Entscheidung eine Zeile mit Stand, Ort zum Ändern und Folgen. */
const sorts: RuleSortState[] = [
  {
    key: 'abilities',
    label: 'Ability scores',
    does: '',
    options: [
      {
        key: 'abilityMethods',
        label: 'Methods',
        does: '',
        scope: 'campaign',
        relation: 'allowsMethod',
        methods: [
          { id: 'std', name: 'Standard array', does: '', builtIn: true },
          { id: 'pb', name: 'Point buy', does: '', builtIn: true },
        ],
      },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    does: '',
    options: [
      {
        key: 'inventory',
        label: 'Counting',
        does: '',
        scope: 'campaign',
        field: 'Campaign.inventory',
        variants: [
          { key: 'weight', label: 'Weight', does: '', chosen: false },
          { key: 'grid', label: 'Grid', does: '', chosen: true },
        ],
      },
      { key: 'zones', label: 'Draw zones', does: '', scope: 'campaign', field: 'Campaign.zones', variants: [{ key: 'on', label: 'On', does: '', chosen: false }] },
    ],
  },
  {
    key: 'units',
    label: 'Units',
    does: '',
    options: [{ key: 'units', label: 'Units shown', does: '', scope: 'installation', value: ['metric'] }],
  },
];

describe('campaign decisions (T-141)', () => {
  it('lists the table first, then every rule, each with its state and where to change it', () => {
    const d = campaignDecisions({
      sorts,
      layers: { inPlay: ['Basic Rules', 'Nebelwacht'], compare: [] },
      members: { leads: 1, players: 4, spectators: 0 },
    });
    expect(d.map((x) => [x.key, x.state])).toEqual([
      ['layers', 'set'],
      ['compare', 'default'],
      ['members', 'set'],
      ['rule:abilityMethods', 'default'],
      ['rule:inventory', 'set'],
      ['rule:zones', 'open'],
      ['rule:units', 'set'],
    ]);
    expect(d[0]).toMatchObject({ value: 'Basic Rules, Nebelwacht', change: { tab: 'layers' } });
    expect(d[2]!.value).toBe('1 lead · 4 players');
    expect(d[3]).toMatchObject({ group: 'Ability scores', value: 'Standard array, Point buy', change: { tab: 'rules', anchor: 'regel-abilities' } });
    expect(d[4]!.value).toBe('Grid');
    expect(d[5]!.value).toBe('');
  });

  it('says what a change does: new characters only, at once everywhere, or for every campaign', () => {
    const d = campaignDecisions({ sorts, layers: null, members: null });
    const folge = (k: string) => d.find((x) => x.key === k)!.consequence;
    expect(folge('rule:abilityMethods')).toMatch(/characters made or levelled up from now on/);
    expect(folge('rule:inventory')).toMatch(/nothing stored is rewritten/);
    expect(d.find((x) => x.key === 'rule:units')!.installation).toBe(true);
    expect(folge('rule:units')).toMatch(/every campaign/);
    /* Ohne Ebenen- und Mitgliederstand stehen nur die Regeln da. */
    expect(d.some((x) => x.key === 'layers' || x.key === 'members')).toBe(false);
  });

  it('marks a campaign without layers or without a lead as open', () => {
    const d = campaignDecisions({ sorts: [], layers: { inPlay: [], compare: ['SRD 2024'] }, members: { leads: 0, players: 2, spectators: 1 } });
    expect(d.map((x) => [x.key, x.state, x.value])).toEqual([
      ['layers', 'open', ''],
      ['compare', 'set', 'SRD 2024'],
      ['members', 'open', '0 leads · 2 players · 1 spectator'],
    ]);
  });
});
