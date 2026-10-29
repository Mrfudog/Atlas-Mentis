import type { RuleOptionState, RuleSortKey, RuleSortState } from './ruleOptions.js';

/**
 * **Die Entscheidungen einer Kampagne** (T-141): der Kampagnenmanager als
 * Liste — je Entscheidung eine Zeile mit ihrem Stand, dem Ort, an dem sie
 * geändert wird, und dem, was eine Änderung bewirkt. Jede lässt sich für
 * sich neu treffen; niemand muss das Anlegen noch einmal durchlaufen.
 *
 * Gerechnet aus dem, was die Seite ohnehin holt (Ebenen, Mitglieder,
 * Regeloptionen), nicht gespeichert (D8): eine zweite Liste der
 * Entscheidungen wäre die Stelle, die nach der ersten Änderung falsch steht.
 */
export interface CampaignDecision {
  /** `layers`, `compare`, `members` oder `rule:<Regel>`. */
  key: string;
  /** Die Überschrift, unter der sie steht: „At the table“ oder das Regelsystem. */
  group: string;
  label: string;
  /** Der Stand in Worten; leer, wenn nichts gewählt ist. */
  value: string;
  /** `set` gewählt, `default` die Vorgabe gilt, `open` nichts gewählt. */
  state: 'set' | 'default' | 'open';
  /** Wo sie geändert wird: der Reiter der Kampagnenseite, bei Regeln die Stelle darin. */
  change: { tab: 'layers' | 'members' | 'rules'; anchor?: string };
  /** Was eine Änderung bewirkt — und was sie nicht anfasst. */
  consequence: string;
  /** Eine Einstellung der Installation: sie gilt für jede Kampagne. */
  installation?: boolean;
}

export interface CampaignSetupInput {
  sorts: readonly RuleSortState[];
  /** Die Namen der Ebenen im Spiel und der Vergleichsebenen; ohne fehlen die Zeilen. */
  layers?: { inPlay: readonly string[]; compare: readonly string[] } | null;
  /** Wie viele leiten (gm, co-gm), spielen und zuschauen; ohne fehlt die Zeile. */
  members?: { leads: number; players: number; spectators: number } | null;
}

export const TABLE_GROUP = 'At the table';

/** Was beim Anlegen einer Figur gilt, wirkt nur auf das nächste Anlegen. */
const BEIM_ANLEGEN: ReadonlySet<RuleSortKey> = new Set(['abilities', 'equipment', 'character']);

const FOLGEN = {
  layers:
    'Turning a layer off takes its articles out of play for everyone in this campaign; nothing is deleted, and turning it on again brings them back.',
  compare: 'Compare layers only show other versions side by side; nothing in play changes.',
  members: 'A role decides what an account sees in this campaign; characters stay with their accounts.',
  anlegen: 'Applies to characters made or levelled up from now on; existing characters keep what they chose.',
  lesen: 'Read at once everywhere: nothing stored is rewritten, so switching back brings the old picture back.',
  installation: 'An installation setting: it changes every campaign, and only the administration changes it.',
} as const;

function regelStand(o: RuleOptionState): Pick<CampaignDecision, 'value' | 'state'> {
  if (o.variants) {
    const gewaehlt = o.variants.filter((v) => v.chosen).map((v) => v.label);
    return { value: gewaehlt.join(', '), state: gewaehlt.length ? 'set' : 'open' };
  }
  if (o.methods) {
    const namen = o.methods.map((m) => m.name).join(', ');
    /* Nur Vorgaben aus dem Code: gewählt hat niemand, es gilt die Vorgabe. */
    return { value: namen, state: !o.methods.length ? 'open' : o.methods.every((m) => m.builtIn) ? 'default' : 'set' };
  }
  const wert = (o.value ?? []).join(', ');
  return { value: wert, state: wert ? 'set' : 'open' };
}

const zahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

/** Wie viele Ebenen ausgeschrieben werden; darüber Zahl und Anfang (auf dev stehen 150 im Spiel). */
const EBENEN_AUSGESCHRIEBEN = 6;
function ebenenText(namen: readonly string[]): string {
  if (namen.length <= EBENEN_AUSGESCHRIEBEN) return namen.join(', ');
  const vorn = EBENEN_AUSGESCHRIEBEN - 1;
  return `${namen.length} layers: ${namen.slice(0, vorn).join(', ')} and ${namen.length - vorn} more`;
}

export function campaignDecisions(input: CampaignSetupInput): CampaignDecision[] {
  const raus: CampaignDecision[] = [];
  if (input.layers) {
    const { inPlay, compare } = input.layers;
    raus.push({
      key: 'layers',
      group: TABLE_GROUP,
      label: 'Layers in play',
      value: ebenenText(inPlay),
      state: inPlay.length ? 'set' : 'open',
      change: { tab: 'layers' },
      consequence: FOLGEN.layers,
    });
    raus.push({
      key: 'compare',
      group: TABLE_GROUP,
      label: 'Compare layers',
      value: ebenenText(compare),
      /* Keine Vergleichsebene ist eine gültige Wahl und die Vorgabe. */
      state: compare.length ? 'set' : 'default',
      change: { tab: 'layers' },
      consequence: FOLGEN.compare,
    });
  }
  if (input.members) {
    const { leads, players, spectators } = input.members;
    const teile = [zahl(leads, 'lead', 'leads'), zahl(players, 'player', 'players'), ...(spectators ? [zahl(spectators, 'spectator', 'spectators')] : [])];
    raus.push({
      key: 'members',
      group: TABLE_GROUP,
      label: 'Members and roles',
      value: teile.join(' · '),
      state: leads ? 'set' : 'open',
      change: { tab: 'members' },
      consequence: FOLGEN.members,
    });
  }
  for (const s of input.sorts) {
    for (const o of s.options) {
      const installation = o.scope === 'installation';
      raus.push({
        key: `rule:${o.key}`,
        group: s.label,
        label: o.label,
        ...regelStand(o),
        change: { tab: 'rules', anchor: `regel-${s.key}` },
        consequence: installation ? FOLGEN.installation : BEIM_ANLEGEN.has(s.key) ? FOLGEN.anlegen : FOLGEN.lesen,
        ...(installation ? { installation } : {}),
      });
    }
  }
  return raus;
}
